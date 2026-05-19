import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub each sub-worker before importing the dispatcher
vi.mock('./topic-discovery', () => ({ default: { queue: vi.fn() } }));
vi.mock('./outline-generation', () => ({ default: { queue: vi.fn() } }));
vi.mock('./article-generation', () => ({ default: { queue: vi.fn() } }));
vi.mock('./humanizer', () => ({ default: { queue: vi.fn() } }));
vi.mock('./publisher', () => ({ default: { queue: vi.fn() } }));
vi.mock('./refresh', () => ({ default: { queue: vi.fn() } }));
vi.mock('./cron', () => ({ default: { scheduled: vi.fn() } }));

import dispatcher from './index';
import topicDiscovery from './topic-discovery';
import outlineGeneration from './outline-generation';
import articleGeneration from './article-generation';
import humanizer from './humanizer';
import publisher from './publisher';
import refresh from './refresh';
import cron from './cron';

function makeMsg(body: unknown) {
  return { body, ack: vi.fn(), retry: vi.fn() };
}

function makeBatch(queue: string, messages: unknown[]) {
  const msgs = messages.map(makeMsg);
  return {
    queue,
    messages: msgs,
    ackAll: vi.fn(() => msgs.forEach((m) => m.ack())),
    retryAll: vi.fn(),
  };
}

const env = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pipeline dispatcher — queue', () => {
  it('routes topic-discovery messages to topic-discovery handler', async () => {
    const batch = makeBatch('blog-pipeline', [{ stage: 'topic-discovery', count: 3 }]);
    await dispatcher.queue(batch as never, env);
    expect(topicDiscovery.queue).toHaveBeenCalledOnce();
    expect(outlineGeneration.queue).not.toHaveBeenCalled();
    expect(articleGeneration.queue).not.toHaveBeenCalled();
  });

  it('routes outline-generation messages to outline-generation handler', async () => {
    const batch = makeBatch('blog-pipeline', [{ stage: 'outline-generation', topic_id: 't1' }]);
    await dispatcher.queue(batch as never, env);
    expect(outlineGeneration.queue).toHaveBeenCalledOnce();
    expect(topicDiscovery.queue).not.toHaveBeenCalled();
    expect(articleGeneration.queue).not.toHaveBeenCalled();
  });

  it('routes article-generation messages to article-generation handler', async () => {
    const batch = makeBatch('blog-pipeline', [{ stage: 'article-generation', outline_id: 'o1' }]);
    await dispatcher.queue(batch as never, env);
    expect(articleGeneration.queue).toHaveBeenCalledOnce();
    expect(topicDiscovery.queue).not.toHaveBeenCalled();
    expect(outlineGeneration.queue).not.toHaveBeenCalled();
  });

  it('routes blog-humanize to humanizer handler', async () => {
    const batch = makeBatch('blog-humanize', [{ stage: 'humanize', draft_id: 'd1' }]);
    await dispatcher.queue(batch as never, env);
    expect(humanizer.queue).toHaveBeenCalledOnce();
  });

  it('routes blog-publish to publisher handler', async () => {
    const batch = makeBatch('blog-publish', [{ stage: 'publisher', draft_id: 'd1' }]);
    await dispatcher.queue(batch as never, env);
    expect(publisher.queue).toHaveBeenCalledOnce();
  });

  it('routes blog-refresh to refresh handler', async () => {
    const batch = makeBatch('blog-refresh', [{ stage: 'refresh', post_id: 'p1' }]);
    await dispatcher.queue(batch as never, env);
    expect(refresh.queue).toHaveBeenCalledOnce();
  });

  it('acks unknown stage on blog-pipeline', async () => {
    const batch = makeBatch('blog-pipeline', [{ stage: 'unknown-stage' }]);
    await dispatcher.queue(batch as never, env);
    expect(batch.messages[0].ack).toHaveBeenCalled();
  });

  it('acks all on unknown queue', async () => {
    const batch = makeBatch('blog-unknown', [{ stage: 'x' }]);
    await dispatcher.queue(batch as never, env);
    expect(batch.ackAll).toHaveBeenCalled();
  });
});

describe('pipeline dispatcher — scheduled', () => {
  it('delegates scheduled event to cron handler', async () => {
    const event = { cron: '0 3 * * 1' } as ScheduledEvent;
    const ctx = {} as ExecutionContext;
    await dispatcher.scheduled(event, env, ctx);
    expect(cron.scheduled).toHaveBeenCalledWith(event, env, ctx);
  });
});
