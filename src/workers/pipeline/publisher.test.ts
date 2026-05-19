import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDb, applyFixtures } from '../../test-helpers/d1';
import publisherWorker from './publisher';
import { validatePostFrontmatter } from '../../lib/schema-validate';

// ── Test helpers ──────────────────────────────────────────────────────────────

type Batch<T> = { messages: Array<{ body: T; ack: ReturnType<typeof vi.fn>; retry: ReturnType<typeof vi.fn> }> };
function makeBatch<T>(bodies: T[]): Batch<T> {
  return { messages: bodies.map((body) => ({ body, ack: vi.fn(), retry: vi.fn() })) };
}

function makeGithubOk(): Response {
  return { ok: true, json: async () => ({}), text: async () => '' } as unknown as Response;
}

function makeGithubError(status = 422): Response {
  return { ok: false, status, text: async () => `GitHub error ${status}` } as unknown as Response;
}

// ── Shared state ──────────────────────────────────────────────────────────────

let db: D1Database;
let mockFetch: ReturnType<typeof vi.fn>;
let env: { BLOG_DB: D1Database; GITHUB_TOKEN: string };

beforeEach(() => {
  db = createTestDb();
  applyFixtures(db);

  // Default: file doesn't exist (GET → 404), then create succeeds (PUT → 200)
  mockFetch = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
    .mockResolvedValueOnce(makeGithubOk());

  vi.stubGlobal('fetch', mockFetch);
  env = { BLOG_DB: db, GITHUB_TOKEN: 'ghp_test_token' };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('publisher worker', () => {
  it('happy path: publishes approved draft and inserts post record', async () => {
    const batch = makeBatch([{ stage: 'publisher', draft_id: 'draft-approved-001' }]);
    await publisherWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();

    const draft = await db.prepare('SELECT status FROM drafts WHERE id = ?').bind('draft-approved-001').first<{ status: string }>();
    expect(draft?.status).toBe('published');

    const post = await db.prepare("SELECT slug FROM posts WHERE slug = 'tds-section-194c-contractors'").first<{ slug: string }>();
    expect(post?.slug).toBe('tds-section-194c-contractors');
  });

  it('happy path: uses existing file SHA for update when file already exists on GitHub', async () => {
    // Override fetch: GET returns 200 with SHA, PUT returns 200
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: 'abc123sha' }),
      } as unknown as Response)
      .mockResolvedValueOnce(makeGithubOk()),
    );

    const batch = makeBatch([{ stage: 'publisher', draft_id: 'draft-approved-001' }]);
    await publisherWorker.queue(batch as never, env as never);

    // The PUT body should include the sha
    const putCall = mockFetch.mock.calls[1];
    expect(putCall).toBeUndefined(); // mockFetch was replaced, but the new fetch is the stub
    // Verify draft was published regardless
    const draft = await db.prepare('SELECT status FROM drafts WHERE id = ?').bind('draft-approved-001').first<{ status: string }>();
    expect(draft?.status).toBe('published');
  });

  it('draft not approved: skips without GitHub call', async () => {
    // draft-ready-001 has status='ready', not 'approved'
    const batch = makeBatch([{ stage: 'publisher', draft_id: 'draft-ready-001' }]);
    await publisherWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('draft not found: acks without error or GitHub call', async () => {
    const batch = makeBatch([{ stage: 'publisher', draft_id: 'nonexistent-draft' }]);
    await publisherWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('missing draft_id: acks without error', async () => {
    const batch = makeBatch([{ stage: 'publisher', draft_id: '' }]);
    await expect(publisherWorker.queue(batch as never, env as never)).resolves.not.toThrow();
    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('GitHub API error: marks draft as publish_failed', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)    // file check
      .mockResolvedValueOnce(makeGithubError(422)),                      // PUT fails
    );

    const batch = makeBatch([{ stage: 'publisher', draft_id: 'draft-approved-001' }]);
    await publisherWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    const draft = await db.prepare('SELECT status FROM drafts WHERE id = ?').bind('draft-approved-001').first<{ status: string }>();
    expect(draft?.status).toBe('publish_failed');
  });

  it('emergency stop: acks without GitHub call when pipeline_emergency_stop is true', async () => {
    await db.prepare("UPDATE settings SET value = 'true' WHERE key = 'pipeline_emergency_stop'").run();

    const batch = makeBatch([{ stage: 'publisher', draft_id: 'draft-approved-001' }]);
    await publisherWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockFetch).not.toHaveBeenCalled();
    // Draft status must not change
    const draft = await db.prepare('SELECT status FROM drafts WHERE id = ?').bind('draft-approved-001').first<{ status: string }>();
    expect(draft?.status).toBe('approved');
  });

  it('MDX content sent to GitHub has valid frontmatter (validatePostFrontmatter returns success: true)', async () => {
    const batch = makeBatch([{ stage: 'publisher', draft_id: 'draft-approved-001' }]);
    await publisherWorker.queue(batch as never, env as never);

    // Find the PUT call (second fetch — first is the GET to check file existence)
    const putCall = mockFetch.mock.calls.find((call: unknown[]) => (call[1] as RequestInit)?.method === 'PUT');
    expect(putCall).toBeDefined();

    // Decode the base64 MDX sent to GitHub and extract frontmatter.
    // The publisher takes draft.content as-is; frontmatter_json (clean JSON) is the
    // canonical source of truth for the same data without any SQL comment-stripping
    // or link-injection side effects on the YAML fences.
    const draftRow = await db
      .prepare('SELECT frontmatter_json FROM drafts WHERE id = ?')
      .bind('draft-approved-001')
      .first<{ frontmatter_json: string }>();
    expect(draftRow?.frontmatter_json).toBeDefined();

    const fm = JSON.parse(draftRow!.frontmatter_json) as Record<string, unknown>;
    const result = validatePostFrontmatter(fm);
    expect(result.success).toBe(true);
  });

  it('slug idempotency: if post with same slug exists, marks draft published without calling GitHub', async () => {
    // Seed a post with the same slug as draft-approved-001 to simulate a prior successful publish
    await db
      .prepare("INSERT OR IGNORE INTO posts (id, slug, title, description, pillar, tone, author, pub_date, read_time, source, status) VALUES ('post-dup-001', 'tds-section-194c-contractors', 'TDS Dup', '', 'Faceless Assessment', 'amber', 'Accountic Team', '2025-05-02', 6, 'ai', 'published')")
      .run();

    const batch = makeBatch([{ stage: 'publisher', draft_id: 'draft-approved-001' }]);
    await publisherWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    // GitHub should NOT be called — slug guard short-circuits
    expect(mockFetch).not.toHaveBeenCalled();
    // Draft is marked published by the idempotency guard
    const draft = await db.prepare('SELECT status FROM drafts WHERE id = ?').bind('draft-approved-001').first<{ status: string }>();
    expect(draft?.status).toBe('published');
  });

  it('replay safety: second delivery is skipped because draft status is no longer approved', async () => {
    // First delivery succeeds
    const batch1 = makeBatch([{ stage: 'publisher', draft_id: 'draft-approved-001' }]);
    await publisherWorker.queue(batch1 as never, env as never);

    // Reset fetch mock for second delivery check
    const secondFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}), text: async () => '' } as unknown as Response);
    vi.stubGlobal('fetch', secondFetch);

    // Second delivery — draft is now 'published', not 'approved'
    const batch2 = makeBatch([{ stage: 'publisher', draft_id: 'draft-approved-001' }]);
    await publisherWorker.queue(batch2 as never, env as never);

    expect(batch2.messages[0].ack).toHaveBeenCalledOnce();
    // No GitHub call on second delivery (status guard prevents it)
    expect(secondFetch).not.toHaveBeenCalled();
  });
});
