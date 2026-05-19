import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb, applyFixtures } from '../../test-helpers/d1';
import topicDiscoveryWorker from './topic-discovery';

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
});
