import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb, applyFixtures } from '../../test-helpers/d1';
import articleGenerationWorker from './article-generation';

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

// Content that passes quality gate: valid frontmatter + high Flesch readability (short sentences,
// short words) + originality marker (numbered workflow + table) + valid schema.
// Deliberately uses simple language to keep Flesch score well above the 70 threshold.
const MOCK_ARTICLE_TEXT = `---
title: GST Basics for CAs
description: A plain guide to GST for Indian Chartered Accountants in practice
pubDate: 2025-05-01
pillar: Income Tax Notices
author: Accountic Team
readTime: 5
tone: emerald
featured: false
---

## What is GST

GST is a tax. It has three parts. The parts are CGST, SGST, and IGST. Each part has a rate.

## How to File GST

1. Get a GSTIN from the tax portal
2. Log in to the GST site
3. Fill in your sales for the month
4. Pay the tax that is due
5. Submit the return and save the receipt

| Tax | Rate | Use |
|---|---|---|
| CGST | 9% | Same state sale |
| SGST | 9% | Same state sale |
| IGST | 18% | Cross state sale |

## Key Point

Your PAN must look like ABCDE1234F. Keep your PAN safe. Use it for all tax work.
`.trim();

// ── Shared state ──────────────────────────────────────────────────────────────

let db: D1Database;
let humanizeQueue: ReturnType<typeof makeQueue>;
let env: { BLOG_DB: D1Database; BLOG_HUMANIZE_QUEUE: unknown; ANTHROPIC_API_KEY: string };

beforeEach(() => {
  db = createTestDb();
  applyFixtures(db);
  humanizeQueue = makeQueue();

  vi.resetAllMocks();
  humanizeQueue = makeQueue();
  mockGenerate.mockResolvedValue({ text: MOCK_ARTICLE_TEXT, inputTokens: 800, outputTokens: 1200 });

  env = { BLOG_DB: db, BLOG_HUMANIZE_QUEUE: humanizeQueue, ANTHROPIC_API_KEY: 'test-key' };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('article-generation worker', () => {
  it('happy path: creates ready draft and dispatches to humanize queue', async () => {
    const batch = makeBatch([{ stage: 'article-generation', outline_id: 'outline-test-001' }]);
    await articleGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(humanizeQueue.send).toHaveBeenCalledOnce();
    expect(humanizeQueue.send.mock.calls[0][0]).toHaveProperty('draft_id');

    const draftId = humanizeQueue.send.mock.calls[0][0].draft_id as string;
    const draft = await db.prepare('SELECT status, slug FROM drafts WHERE id = ?').bind(draftId).first<{ status: string; slug: string }>();
    expect(draft?.status).toBe('ready');
    expect(draft?.slug).toBe('gst-basics-for-cas');
  });

  it('tokens_used is incremented after successful generation', async () => {
    const before = await db.prepare("SELECT value FROM settings WHERE key = 'tokens_used_today'").first<{ value: string }>();
    const tokensBefore = parseInt(before!.value, 10);

    const batch = makeBatch([{ stage: 'article-generation', outline_id: 'outline-test-001' }]);
    await articleGenerationWorker.queue(batch as never, env as never);

    const after = await db.prepare("SELECT value FROM settings WHERE key = 'tokens_used_today'").first<{ value: string }>();
    expect(parseInt(after!.value, 10)).toBe(tokensBefore + 2000); // 800 + 1200
  });

  it('idempotency: second delivery with same outline skips AI call', async () => {
    const batch1 = makeBatch([{ stage: 'article-generation', outline_id: 'outline-test-001' }]);
    await articleGenerationWorker.queue(batch1 as never, env as never);
    expect(mockGenerate).toHaveBeenCalledOnce();

    mockGenerate.mockClear();
    humanizeQueue.send.mockClear();

    const batch2 = makeBatch([{ stage: 'article-generation', outline_id: 'outline-test-001' }]);
    await articleGenerationWorker.queue(batch2 as never, env as never);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(humanizeQueue.send).not.toHaveBeenCalled();
    expect(batch2.messages[0].ack).toHaveBeenCalledOnce();
  });

  it('outline not found: acks without creating a draft', async () => {
    const batch = makeBatch([{ stage: 'article-generation', outline_id: 'outline-nonexistent' }]);
    await articleGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(humanizeQueue.send).not.toHaveBeenCalled();
  });

  it('no active prompt: acks without AI call', async () => {
    await db.prepare("UPDATE prompts SET is_active = 0 WHERE stage = 'article-generation'").run();

    const batch = makeBatch([{ stage: 'article-generation', outline_id: 'outline-test-001' }]);
    await articleGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('token budget exceeded: fails job and acks', async () => {
    await db.prepare("UPDATE settings SET value = '199999' WHERE key = 'tokens_used_today'").run();

    const batch = makeBatch([{ stage: 'article-generation', outline_id: 'outline-test-001' }]);
    await articleGenerationWorker.queue(batch as never, env as never);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(humanizeQueue.send).not.toHaveBeenCalled();
    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
  });

  it('AI error: marks job failed and retries message', async () => {
    mockGenerate.mockRejectedValue(new Error('API error'));

    const batch = makeBatch([{ stage: 'article-generation', outline_id: 'outline-test-001' }]);
    await articleGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].retry).toHaveBeenCalledOnce();
    expect(batch.messages[0].ack).not.toHaveBeenCalled();
    expect(humanizeQueue.send).not.toHaveBeenCalled();
  });

  it('quality gate fails: creates failed draft and does not dispatch', async () => {
    // Return content that fails readability and has no originality marker
    mockGenerate.mockResolvedValue({
      text: `---
title: GST Guide
description: Short guide
pubDate: 2025-05-01
pillar: Income Tax Notices
author: Accountic Team
readTime: 5
tone: emerald
featured: false
---

Short.`,
      inputTokens: 100,
      outputTokens: 50,
    });

    const batch = makeBatch([{ stage: 'article-generation', outline_id: 'outline-test-001' }]);
    await articleGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(humanizeQueue.send).not.toHaveBeenCalled();

    // Verify failed draft was created
    const failedDraft = await db
      .prepare("SELECT status FROM drafts WHERE status = 'failed' AND outline_id = 'outline-test-001' ORDER BY created_at DESC LIMIT 1")
      .first<{ status: string }>();
    expect(failedDraft?.status).toBe('failed');
  });

  it('emergency stop: acks without AI call', async () => {
    await db.prepare("UPDATE settings SET value = 'true' WHERE key = 'pipeline_emergency_stop'").run();

    const batch = makeBatch([{ stage: 'article-generation', outline_id: 'outline-test-001' }]);
    await articleGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(humanizeQueue.send).not.toHaveBeenCalled();
  });

  it('circuit breaker: acks without AI call when failure rate exceeds threshold', async () => {
    // Insert 5 failed jobs for article-generation stage (100% failure rate → breaker trips)
    for (let i = 0; i < 5; i++) {
      await db
        .prepare("INSERT INTO generation_jobs (id, stage, status, input_hash, stage_payload) VALUES (?, 'article-generation', 'failed', ?, '{}')")
        .bind(`cb-job-${i}`, `hash-${i}`)
        .run();
    }

    const batch = makeBatch([{ stage: 'article-generation', outline_id: 'outline-test-001' }]);
    await articleGenerationWorker.queue(batch as never, env as never);

    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('pre-enqueue budget check: does not dispatch to humanizer when budget exhausted after generation', async () => {
    // After generation, tokens_used is incremented. We simulate budget running out before the send.
    // Set budget so that after 4000 token AI call it goes over for the next 2000 token enqueue.
    await db.prepare("UPDATE settings SET value = '198001' WHERE key = 'tokens_used_today'").run();

    const batch = makeBatch([{ stage: 'article-generation', outline_id: 'outline-test-001' }]);
    await articleGenerationWorker.queue(batch as never, env as never);

    // Draft may or may not pass quality gate depending on mock content, but humanize queue
    // should NOT be called since remaining budget < 2000
    expect(humanizeQueue.send).not.toHaveBeenCalled();
    expect(batch.messages[0].ack).toHaveBeenCalledOnce();
  });
});
