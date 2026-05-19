import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb, applyFixtures } from '../../test-helpers/d1';
import outlineGenerationWorker from './outline-generation';

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

const VALID_OUTLINE_JSON = JSON.stringify({
  title: 'GST Input Tax Credit Reversal on Capital Goods',
  description: 'How to handle ITC reversal notices for capital goods under GST Rule 43',
  sections: [
    { heading: 'What is ITC Reversal', summary: 'Overview', key_points: ['Capital goods rule', 'Exempt supplies'] },
    { heading: 'Calculation Formula', summary: 'Rule 43 formula', key_points: ['Step by step', 'Examples'] },
  ],
  tone: 'emerald',
  estimated_read_time: 7,
});

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
  mockGenerate.mockResolvedValue({ text: VALID_OUTLINE_JSON, inputTokens: 400, outputTokens: 300 });

  env = { BLOG_DB: db, BLOG_PIPELINE_QUEUE: pipelineQueue, ANTHROPIC_API_KEY: 'test-key' };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('outline-generation worker', () => {
  it('happy path: creates outline and dispatches article-generation message', async () => {
    const batch = makeBatch([{ stage: 'outline-generation', topic_id: 'topic-test-001' }]);
    await outlineGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(pipelineQueue.send).toHaveBeenCalledOnce();

    const topic = await db.prepare('SELECT status FROM topics WHERE id = ?').bind('topic-test-001').first<{ status: string }>();
    expect(topic?.status).toBe('outlined');

    // A new outline should have been inserted (beyond the fixture outline)
    const outlines = await db.prepare("SELECT id FROM outlines WHERE topic_id = 'topic-test-001'").all<{ id: string }>();
    expect(outlines.results.length).toBeGreaterThanOrEqual(2); // fixture + new
  });

  it('JSON wrapped in prose: extracts the JSON object correctly', async () => {
    const wrapped = `Here is your outline:\n\n${VALID_OUTLINE_JSON}\n\nPlease review.`;
    mockGenerate.mockResolvedValue({ text: wrapped, inputTokens: 400, outputTokens: 350 });

    const batch = makeBatch([{ stage: 'outline-generation', topic_id: 'topic-test-001' }]);
    await outlineGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(pipelineQueue.send).toHaveBeenCalledOnce();
  });

  it('topic not found: acks without AI call', async () => {
    const batch = makeBatch([{ stage: 'outline-generation', topic_id: 'nonexistent-topic' }]);
    await outlineGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(pipelineQueue.send).not.toHaveBeenCalled();
  });

  it('missing topic_id: acks without AI call', async () => {
    const batch = makeBatch([{ stage: 'outline-generation', topic_id: '' }]);
    await outlineGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('no active prompt: marks topic as failed', async () => {
    await db.prepare("UPDATE prompts SET is_active = 0 WHERE stage = 'outline-generation'").run();

    const batch = makeBatch([{ stage: 'outline-generation', topic_id: 'topic-test-001' }]);
    await outlineGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();

    const topic = await db.prepare('SELECT status FROM topics WHERE id = ?').bind('topic-test-001').first<{ status: string }>();
    expect(topic?.status).toBe('failed');
  });

  it('token budget exceeded: marks topic as failed and acks', async () => {
    await db.prepare("UPDATE settings SET value = '199999' WHERE key = 'tokens_used_today'").run();

    const batch = makeBatch([{ stage: 'outline-generation', topic_id: 'topic-test-001' }]);
    await outlineGenerationWorker.queue(batch as never, env as never);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(pipelineQueue.send).not.toHaveBeenCalled();
    expect(batch.messages[0].ack).toHaveBeenCalledOnce();

    const topic = await db.prepare('SELECT status FROM topics WHERE id = ?').bind('topic-test-001').first<{ status: string }>();
    expect(topic?.status).toBe('failed');
  });

  it('AI error: marks topic as failed and retries message', async () => {
    mockGenerate.mockRejectedValue(new Error('Rate limit'));

    const batch = makeBatch([{ stage: 'outline-generation', topic_id: 'topic-test-001' }]);
    await outlineGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].retry).toHaveBeenCalledOnce();
    expect(batch.messages[0].ack).not.toHaveBeenCalled();

    const topic = await db.prepare('SELECT status FROM topics WHERE id = ?').bind('topic-test-001').first<{ status: string }>();
    expect(topic?.status).toBe('failed');
  });

  it('tokens_used is incremented after successful outline generation', async () => {
    const before = await db.prepare("SELECT value FROM settings WHERE key = 'tokens_used_today'").first<{ value: string }>();
    const tokensBefore = parseInt(before!.value, 10);

    const batch = makeBatch([{ stage: 'outline-generation', topic_id: 'topic-test-001' }]);
    await outlineGenerationWorker.queue(batch as never, env as never);

    const after = await db.prepare("SELECT value FROM settings WHERE key = 'tokens_used_today'").first<{ value: string }>();
    expect(parseInt(after!.value, 10)).toBe(tokensBefore + 700); // 400 + 300
  });

  it('emergency stop: acks without AI call when pipeline_emergency_stop is true', async () => {
    await db.prepare("UPDATE settings SET value = 'true' WHERE key = 'pipeline_emergency_stop'").run();

    const batch = makeBatch([{ stage: 'outline-generation', topic_id: 'topic-test-001' }]);
    await outlineGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(pipelineQueue.send).not.toHaveBeenCalled();
  });

  it('pre-enqueue budget check: stores outline but skips article-generation dispatch when budget low', async () => {
    // Budget enough for outline AI call (1500) but not for article-generation (4000)
    // Set tokens_used_today so that 1500 fits but 4000 does not: cap=200000, used=196001
    await db.prepare("UPDATE settings SET value = '196001' WHERE key = 'tokens_used_today'").run();

    const batch = makeBatch([{ stage: 'outline-generation', topic_id: 'topic-test-001' }]);
    await outlineGenerationWorker.queue(batch as never, env as never);

    // AI was called, outline was inserted, but article-generation was NOT dispatched
    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(pipelineQueue.send).not.toHaveBeenCalled();
    expect(batch.messages[0].ack).toHaveBeenCalledOnce();

    // Topic status advances to 'outlined' even without dispatch
    const topic = await db.prepare('SELECT status FROM topics WHERE id = ?').bind('topic-test-001').first<{ status: string }>();
    expect(topic?.status).toBe('outlined');
  });
});
