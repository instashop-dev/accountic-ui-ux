import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb, applyFixtures } from '../../test-helpers/d1';
import humanizerWorker from './humanizer';

// ── Mock setup ────────────────────────────────────────────────────────────────

const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));

vi.mock('../../lib/ai', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/ai')>();
  return {
    ...original,
    createAIClient: vi.fn(() => ({ generate: mockGenerate })),
  };
});

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeQueue() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

type Batch<T> = { messages: Array<{ body: T; ack: ReturnType<typeof vi.fn>; retry: ReturnType<typeof vi.fn> }> };
function makeBatch<T>(bodies: T[]): Batch<T> {
  return { messages: bodies.map((body) => ({ body, ack: vi.fn(), retry: vi.fn() })) };
}

// ── Shared state ──────────────────────────────────────────────────────────────

let db: D1Database;
let publishQueue: ReturnType<typeof makeQueue>;
let env: { BLOG_DB: D1Database; BLOG_PUBLISH_QUEUE: unknown; ANTHROPIC_API_KEY: string };

beforeEach(async () => {
  db = createTestDb();
  applyFixtures(db);
  publishQueue = makeQueue();
  env = { BLOG_DB: db, BLOG_PUBLISH_QUEUE: publishQueue, ANTHROPIC_API_KEY: 'test-key' };

  vi.resetAllMocks();
  publishQueue = makeQueue(); // recreate after reset

  // Default: return the original draft content unchanged — self-comparison passes all gates
  const draftRow = await db
    .prepare('SELECT content FROM drafts WHERE id = ?')
    .bind('draft-ready-001')
    .first<{ content: string }>();
  mockGenerate.mockResolvedValue({ text: draftRow!.content, inputTokens: 500, outputTokens: 300 });

  env = { BLOG_DB: db, BLOG_PUBLISH_QUEUE: publishQueue, ANTHROPIC_API_KEY: 'test-key' };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('humanizer worker', () => {
  it('happy path: humanizes draft and dispatches to publish queue', async () => {
    const batch = makeBatch([{ draft_id: 'draft-ready-001' }]);
    await humanizerWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(publishQueue.send).toHaveBeenCalledOnce();
    expect(publishQueue.send).toHaveBeenCalledWith({ draft_id: 'draft-ready-001' });

    const draft = await db.prepare('SELECT status FROM drafts WHERE id = ?').bind('draft-ready-001').first<{ status: string }>();
    expect(draft?.status).toBe('humanized');
  });

  it('idempotency: skips already-humanized draft without AI call', async () => {
    const batch = makeBatch([{ draft_id: 'draft-humanized-001' }]);
    await humanizerWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(publishQueue.send).not.toHaveBeenCalled();
  });

  it('wrong status: skips draft that is not ready', async () => {
    const batch = makeBatch([{ draft_id: 'draft-approved-001' }]);
    await humanizerWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('disabled bypass: uses original content without AI call', async () => {
    await db.prepare("UPDATE settings SET value = 'false' WHERE key = 'humanizer_enabled'").run();

    const batch = makeBatch([{ draft_id: 'draft-ready-001' }]);
    await humanizerWorker.queue(batch as never, env as never);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(publishQueue.send).toHaveBeenCalledWith({ draft_id: 'draft-ready-001' });

    const draft = await db.prepare('SELECT status FROM drafts WHERE id = ?').bind('draft-ready-001').first<{ status: string }>();
    expect(draft?.status).toBe('humanized');
  });

  it('token budget exceeded: falls back to original without AI call', async () => {
    await db.prepare("UPDATE settings SET value = '199999' WHERE key = 'tokens_used_today'").run();

    const batch = makeBatch([{ draft_id: 'draft-ready-001' }]);
    await humanizerWorker.queue(batch as never, env as never);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(publishQueue.send).toHaveBeenCalledWith({ draft_id: 'draft-ready-001' });

    const draft = await db.prepare('SELECT status FROM drafts WHERE id = ?').bind('draft-ready-001').first<{ status: string }>();
    expect(draft?.status).toBe('humanized');
  });

  it('no active prompt: marks draft as failed and does not dispatch', async () => {
    await db.prepare("UPDATE prompts SET is_active = 0 WHERE stage = 'humanizer'").run();

    const batch = makeBatch([{ draft_id: 'draft-ready-001' }]);
    await humanizerWorker.queue(batch as never, env as never);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(publishQueue.send).not.toHaveBeenCalled();

    const draft = await db.prepare('SELECT status FROM drafts WHERE id = ?').bind('draft-ready-001').first<{ status: string }>();
    expect(draft?.status).toBe('failed');
  });

  it('API error: falls back to original content and dispatches', async () => {
    mockGenerate.mockRejectedValue(new Error('API timeout'));

    const batch = makeBatch([{ draft_id: 'draft-ready-001' }]);
    await humanizerWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(publishQueue.send).toHaveBeenCalledWith({ draft_id: 'draft-ready-001' });

    const draft = await db.prepare('SELECT status FROM drafts WHERE id = ?').bind('draft-ready-001').first<{ status: string }>();
    expect(draft?.status).toBe('humanized');
  });

  it('replay safety: second delivery is a no-op after first succeeds', async () => {
    const batch1 = makeBatch([{ draft_id: 'draft-ready-001' }]);
    await humanizerWorker.queue(batch1 as never, env as never);
    expect(mockGenerate).toHaveBeenCalledOnce();

    // Reset mock call counts but keep same mock (draft is now 'humanized')
    mockGenerate.mockClear();
    publishQueue.send.mockClear();

    const batch2 = makeBatch([{ draft_id: 'draft-ready-001' }]);
    await humanizerWorker.queue(batch2 as never, env as never);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(publishQueue.send).not.toHaveBeenCalled();
    expect(batch2.messages[0].ack).toHaveBeenCalledOnce();
  });

  it('missing draft_id: acks without error', async () => {
    const batch = makeBatch([{ draft_id: '' }]);
    await expect(humanizerWorker.queue(batch as never, env as never)).resolves.not.toThrow();
    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
  });

  it('tokens_used is incremented after successful humanization', async () => {
    const before = await db.prepare("SELECT value FROM settings WHERE key = 'tokens_used_today'").first<{ value: string }>();
    const tokensBefore = parseInt(before!.value, 10);

    const batch = makeBatch([{ draft_id: 'draft-ready-001' }]);
    await humanizerWorker.queue(batch as never, env as never);

    const after = await db.prepare("SELECT value FROM settings WHERE key = 'tokens_used_today'").first<{ value: string }>();
    const tokensAfter = parseInt(after!.value, 10);

    expect(tokensAfter).toBe(tokensBefore + 800); // 500 input + 300 output
  });

  it('emergency stop: acks without AI call when pipeline_emergency_stop is true', async () => {
    await db.prepare("UPDATE settings SET value = 'true' WHERE key = 'pipeline_emergency_stop'").run();

    const batch = makeBatch([{ draft_id: 'draft-ready-001' }]);
    await humanizerWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(publishQueue.send).not.toHaveBeenCalled();
  });

  it('API error log does not contain the stub API key value', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGenerate.mockRejectedValue(new Error('Rate limit exceeded'));

    const batch = makeBatch([{ draft_id: 'draft-ready-001' }]);
    await humanizerWorker.queue(batch as never, env as never);

    for (const call of errorSpy.mock.calls) {
      const output = call.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      expect(output).not.toContain('test-key');
    }
    errorSpy.mockRestore();
  });
});
