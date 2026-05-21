import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb, applyFixtures } from '../../test-helpers/d1';
import topicDiscoveryWorker, { buildCoverageBrief } from './topic-discovery';
import { PILLARS } from '../../blog-meta';

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

const VALID_TOPICS_JSON = JSON.stringify([
  { title: 'GST Annual Return Reconciliation', pillar: 'Income Tax Notices', rationale: 'CAs need help with GSTR-9 reconciliation' },
  { title: 'TDS on Professional Fees Section 194J', pillar: 'Faceless Assessment', rationale: 'Common query for service providers' },
]);

// ── Shared state ──────────────────────────────────────────────────────────────

let db: D1Database;
let pipelineQueue: ReturnType<typeof makeQueue>;
let env: { BLOG_DB: D1Database; BLOG_PIPELINE_QUEUE: unknown; ANTHROPIC_API_KEY: string };

beforeEach(() => {
  db = createTestDb();
  applyFixtures(db);
  pipelineQueue = makeQueue();

  vi.resetAllMocks();
  pipelineQueue = makeQueue();
  mockGenerate.mockResolvedValue({ text: VALID_TOPICS_JSON, inputTokens: 300, outputTokens: 200 });

  env = { BLOG_DB: db, BLOG_PIPELINE_QUEUE: pipelineQueue, ANTHROPIC_API_KEY: 'test-key' };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PILLARS registry', () => {
  it('5.1: PILLARS has exactly 9 entries', () => {
    expect(PILLARS).toHaveLength(9);
  });

  it('5.2: Firm Operations is NOT in PILLARS', () => {
    expect(PILLARS).not.toContain('Firm Operations');
  });

  it('5.3: all 4 new pillar values are in PILLARS', () => {
    expect(PILLARS).toContain('CA Firm Automation');
    expect(PILLARS).toContain('AI Tools for Indian CAs');
    expect(PILLARS).toContain('GST Automation');
    expect(PILLARS).toContain('Audit Technology');
  });
});

describe('topic-discovery worker', () => {
  it('happy path: inserts new topics and dispatches outline messages', async () => {
    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(pipelineQueue.send).toHaveBeenCalledTimes(2);

    const topics = await db.prepare("SELECT title FROM topics WHERE status = 'pending'").all<{ title: string }>();
    const titles = topics.results.map((r) => r.title);
    expect(titles).toContain('GST Annual Return Reconciliation');
    expect(titles).toContain('TDS on Professional Fees Section 194J');
  });

  it('deduplication: skips topics whose titles already exist', async () => {
    // topic-test-001 is already in fixtures with title 'GST Input Tax Credit Reversal on Capital Goods'
    const duplicateJson = JSON.stringify([
      { title: 'GST Input Tax Credit Reversal on Capital Goods', pillar: 'Income Tax Notices', rationale: 'Dup' },
      { title: 'Completely New Topic', pillar: 'Faceless Assessment', rationale: 'Fresh' },
    ]);
    mockGenerate.mockResolvedValue({ text: duplicateJson, inputTokens: 200, outputTokens: 150 });

    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    // Only 1 new topic (duplicate is skipped)
    expect(pipelineQueue.send).toHaveBeenCalledTimes(1);
  });

  it('invalid pillar: skips topic with unrecognised pillar', async () => {
    const badPillarJson = JSON.stringify([
      { title: 'Some Topic', pillar: 'Not A Real Pillar', rationale: 'Test' },
      { title: 'Valid Topic', pillar: 'Income Tax Notices', rationale: 'Real' },
    ]);
    mockGenerate.mockResolvedValue({ text: badPillarJson, inputTokens: 200, outputTokens: 100 });

    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    // Only 1 dispatched (invalid pillar skipped)
    expect(pipelineQueue.send).toHaveBeenCalledTimes(1);
  });

  it('5.4: GST Automation candidate passes pillar validation and is inserted', async () => {
    const gstTopic = JSON.stringify([
      { title: 'GSTR-2B Reconciliation Using AI', pillar: 'GST Automation', rationale: 'New pillar test' },
    ]);
    mockGenerate.mockResolvedValue({ text: gstTopic, inputTokens: 200, outputTokens: 100 });

    const batch = makeBatch([{ stage: 'topic-discovery', count: 1 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    expect(pipelineQueue.send).toHaveBeenCalledTimes(1);
    const inserted = await db
      .prepare("SELECT pillar FROM topics WHERE title = 'GSTR-2B Reconciliation Using AI'")
      .first<{ pillar: string }>();
    expect(inserted?.pillar).toBe('GST Automation');
  });

  it('5.5: Firm Operations candidate is skipped with a warning and NOT inserted', async () => {
    const removedPillarJson = JSON.stringify([
      { title: 'Managing a CA Firm With Tally', pillar: 'Firm Operations', rationale: 'Removed pillar' },
      { title: 'AI for Notice 142(1) Response', pillar: 'Income Tax Notices', rationale: 'Valid' },
    ]);
    mockGenerate.mockResolvedValue({ text: removedPillarJson, inputTokens: 200, outputTokens: 100 });

    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    // Only the valid pillar topic is dispatched
    expect(pipelineQueue.send).toHaveBeenCalledTimes(1);
    const rejected = await db
      .prepare("SELECT title FROM topics WHERE title = 'Managing a CA Firm With Tally'")
      .first<{ title: string }>();
    expect(rejected).toBeNull();
  });

  it('no active prompt: acks without AI call', async () => {
    await db.prepare("UPDATE prompts SET is_active = 0 WHERE stage = 'topic-discovery'").run();

    const batch = makeBatch([{ stage: 'topic-discovery', count: 3 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(pipelineQueue.send).not.toHaveBeenCalled();
  });

  it('token budget exceeded: acks without AI call', async () => {
    await db.prepare("UPDATE settings SET value = '199999' WHERE key = 'tokens_used_today'").run();

    const batch = makeBatch([{ stage: 'topic-discovery', count: 3 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(pipelineQueue.send).not.toHaveBeenCalled();
    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
  });

  it('AI error: retries message', async () => {
    mockGenerate.mockRejectedValue(new Error('Network error'));

    const batch = makeBatch([{ stage: 'topic-discovery', count: 3 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    expect(batch.messages[0].retry).toHaveBeenCalledOnce();
    expect(batch.messages[0].ack).not.toHaveBeenCalled();
  });

  it('malformed JSON response: acks without inserting topics', async () => {
    mockGenerate.mockResolvedValue({ text: 'Not valid JSON at all', inputTokens: 100, outputTokens: 50 });

    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(pipelineQueue.send).not.toHaveBeenCalled();
  });

  it('count is capped at 10', async () => {
    // Return 15 topics but only 10 should be processed
    const manyTopics = Array.from({ length: 15 }, (_, i) => ({
      title: `Topic ${i + 1}`,
      pillar: 'Income Tax Notices',
      rationale: 'Test',
    }));
    mockGenerate.mockResolvedValue({ text: JSON.stringify(manyTopics), inputTokens: 500, outputTokens: 400 });

    const batch = makeBatch([{ stage: 'topic-discovery', count: 20 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    // count is capped at 10, so at most 10 dispatches
    expect(pipelineQueue.send.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it('emergency stop: acks without AI call when pipeline_emergency_stop is true', async () => {
    await db.prepare("UPDATE settings SET value = 'true' WHERE key = 'pipeline_emergency_stop'").run();

    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(pipelineQueue.send).not.toHaveBeenCalled();
  });

  it('pre-enqueue budget check: inserts topic but skips outline dispatch when downstream budget low', async () => {
    // AI budget check needs initial + 2000 ≤ 200000 → initial ≤ 198000
    // After AI (1800 tokens used): running_total = 197000 + 1800 = 198800
    // Enqueue check: 198800 + 1500 = 200300 > 200000 → skipped ✓
    await db.prepare("UPDATE settings SET value = '197000' WHERE key = 'tokens_used_today'").run();
    mockGenerate.mockResolvedValue({ text: VALID_TOPICS_JSON, inputTokens: 1200, outputTokens: 600 });

    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    // No outline dispatch — topics were inserted but budget too low to enqueue downstream work
    expect(pipelineQueue.send).not.toHaveBeenCalled();
    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    const topic = await db
      .prepare("SELECT title FROM topics WHERE status = 'pending' AND title = 'GST Annual Return Reconciliation'")
      .first<{ title: string }>();
    expect(topic?.title).toBe('GST Annual Return Reconciliation');
  });

  // ── Coverage brief tests (5.1–5.7) ─────────────────────────────────────────

  /** Helper: update the active topic-discovery prompt to a template containing {{coverage_brief}} */
  async function setPromptWithCoverageBrief(database: D1Database): Promise<void> {
    await database
      .prepare(
        "UPDATE prompts SET user_prompt_template = ? WHERE stage = 'topic-discovery' AND is_active = 1",
      )
      .bind(
        '{{coverage_brief}}\n\nGenerate {{count}} topics. Return JSON array: [{"title":"...","pillar":"...","rationale":"..."}]',
      )
      .run();
  }

  it('coverage brief: injected into AI prompt with per-pillar counts and recent titles', async () => {
    // fixture has topic-test-001 (Income Tax Notices, pending, created_at = now)
    await setPromptWithCoverageBrief(db);

    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    expect(mockGenerate).toHaveBeenCalledOnce();
    const userPrompt = mockGenerate.mock.calls[0][0].user as string;
    // Pillar counts section
    expect(userPrompt).toContain('Income Tax Notices: 1');
    expect(userPrompt).toContain('Faceless Assessment: 0');
    // Recent titles section
    expect(userPrompt).toContain('GST Input Tax Credit Reversal on Capital Goods');
  });

  it('coverage brief: failed topics excluded from counts and recent titles', async () => {
    await setPromptWithCoverageBrief(db);

    // Insert a failed topic — must NOT appear in brief
    await db
      .prepare("INSERT OR IGNORE INTO topics (id, title, pillar, rationale, status) VALUES (?, ?, ?, ?, 'failed')")
      .bind('topic-failed-001', 'Failed Topic Should Be Excluded', 'ICAI Ethics', 'test')
      .run();

    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    const userPrompt = mockGenerate.mock.calls[0][0].user as string;
    expect(userPrompt).not.toContain('Failed Topic Should Be Excluded');
    // ICAI Ethics count should still be 0 (failed topic excluded)
    expect(userPrompt).toContain('ICAI Ethics: 0');
  });

  it('coverage brief: empty DB — no error thrown and AI call proceeds', async () => {
    await setPromptWithCoverageBrief(db);

    // Remove all topics (and FK-dependent records in dependency order)
    await db.prepare('DELETE FROM drafts').run();
    await db.prepare('DELETE FROM outlines').run();
    await db.prepare('DELETE FROM topics').run();

    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    // Worker must not throw — AI must be called
    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
  });

  it('coverage brief: graceful no-op when template lacks {{coverage_brief}} placeholder', async () => {
    // Default fixture template has NO {{coverage_brief}} — replacement must be silent no-op
    // (prompt template already set correctly by applyFixtures)

    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    // No error — AI still called, topics still inserted
    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
  });

  it('coverage brief: recency section capped at 300 titles', async () => {
    await setPromptWithCoverageBrief(db);

    // Insert 301 topics (all created_at = now, within 90-day window)
    // Fixture already has topic-test-001 → total = 302 non-failed topics in window
    for (let i = 1; i <= 301; i++) {
      await db
        .prepare('INSERT OR IGNORE INTO topics (id, title, pillar, rationale, status) VALUES (?, ?, ?, ?, ?)')
        .bind(`cap-topic-${i}`, `Cap Test Topic ${i}`, 'Income Tax Notices', 'test', 'pending')
        .run();
    }

    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    const userPrompt = mockGenerate.mock.calls[0][0].user as string;
    // Count title lines in the recency section only (after the section header)
    const sectionHeader = 'Topics covered in the last 90 days (most recent first):';
    const sectionStart = userPrompt.indexOf(sectionHeader);
    expect(sectionStart).toBeGreaterThan(-1);
    const titleSection = userPrompt.slice(sectionStart + sectionHeader.length);
    const titleLines = titleSection.split('\n').filter((l) => l.trim().startsWith('- '));
    expect(titleLines.length).toBeLessThanOrEqual(300);
  });

  it('dedup includes posts: candidate matching a post title is skipped', async () => {
    // Fixture has a post titled "How to Claim ITC Under GST: Step-by-Step Procedure"
    const jsonWithPostTitle = JSON.stringify([
      { title: 'How to Claim ITC Under GST: Step-by-Step Procedure', pillar: 'Income Tax Notices', rationale: 'Dedup test' },
      { title: 'Brand New Section 80C Deduction Guide', pillar: 'Income Tax Notices', rationale: 'Fresh topic' },
    ]);
    mockGenerate.mockResolvedValue({ text: jsonWithPostTitle, inputTokens: 200, outputTokens: 150 });

    const batch = makeBatch([{ stage: 'topic-discovery', count: 2 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    // Post-title candidate skipped, only the genuinely new topic is inserted
    expect(pipelineQueue.send).toHaveBeenCalledTimes(1);
    const skipped = await db
      .prepare("SELECT title FROM topics WHERE title = 'How to Claim ITC Under GST: Step-by-Step Procedure'")
      .first<{ title: string }>();
    expect(skipped).toBeNull();
  });

  it('dedup across posts: case-insensitive match blocks candidate', async () => {
    // "How to Claim ITC Under GST: Step-by-Step Procedure" exists in posts (fixture)
    const jsonLowerCase = JSON.stringify([
      { title: 'how to claim itc under gst: step-by-step procedure', pillar: 'Income Tax Notices', rationale: 'Case test' },
    ]);
    mockGenerate.mockResolvedValue({ text: jsonLowerCase, inputTokens: 200, outputTokens: 100 });

    const batch = makeBatch([{ stage: 'topic-discovery', count: 1 }]);
    await topicDiscoveryWorker.queue(batch as never, env as never);

    expect(pipelineQueue.send).not.toHaveBeenCalled();
    const inserted = await db
      .prepare("SELECT title FROM topics WHERE title = 'how to claim itc under gst: step-by-step procedure'")
      .first<{ title: string }>();
    expect(inserted).toBeNull();
  });

  // ── buildCoverageBrief unit tests ────────────────────────────────────────────

  it('buildCoverageBrief: returns empty string when both inputs are empty', () => {
    expect(buildCoverageBrief([], [])).toBe('');
  });

  it('buildCoverageBrief: all nine PILLARS appear in counts section, missing ones default to 0', () => {
    const result = buildCoverageBrief(
      [{ pillar: 'Income Tax Notices', count: 5 }],
      [],
    );
    for (const pillar of PILLARS) {
      expect(result).toContain(pillar);
    }
    expect(result).toContain('Income Tax Notices: 5');
    expect(result).toContain('Faceless Assessment: 0');
  });

  it('buildCoverageBrief: shows (none in the last 90 days) when recentTitles is empty but counts exist', () => {
    const result = buildCoverageBrief([{ pillar: 'Income Tax Notices', count: 3 }], []);
    expect(result).toContain('(none in the last 90 days)');
  });

  it('buildCoverageBrief: title list appears in recency section', () => {
    const result = buildCoverageBrief(
      [{ pillar: 'ICAI Ethics', count: 1 }],
      [{ title: 'Section 148 Reassessment Guide' }, { title: 'DPDP Compliance Checklist' }],
    );
    expect(result).toContain('Section 148 Reassessment Guide');
    expect(result).toContain('DPDP Compliance Checklist');
  });

  it('5.6: brief contains a line for each of the 9 PILLARS when pillarCounts is empty (all default to 0)', () => {
    const result = buildCoverageBrief([], [{ title: 'Some Recent Title' }]);
    for (const pillar of PILLARS) {
      expect(result).toContain(`${pillar}: 0`);
    }
    // Firm Operations must not appear
    expect(result).not.toContain('Firm Operations');
    // Spot-check the four new pillars specifically
    expect(result).toContain('CA Firm Automation: 0');
    expect(result).toContain('AI Tools for Indian CAs: 0');
    expect(result).toContain('GST Automation: 0');
    expect(result).toContain('Audit Technology: 0');
  });
});
