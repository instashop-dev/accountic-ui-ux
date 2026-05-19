import topicDiscovery from './topic-discovery';
import outlineGeneration from './outline-generation';
import articleGeneration from './article-generation';
import humanizer from './humanizer';
import publisher from './publisher';
import refresh from './refresh';
import cron from './cron';

// Combined Env — union of all pipeline worker bindings
interface Env {
  BLOG_DB: D1Database;
  BLOG_KV: KVNamespace;
  BLOG_ASSETS: R2Bucket;
  BLOG_ANALYTICS?: AnalyticsEngineDataset;
  BLOG_PIPELINE_QUEUE: Queue;
  BLOG_HUMANIZE_QUEUE: Queue;
  BLOG_PUBLISH_QUEUE: Queue;
  BLOG_REFRESH_QUEUE: Queue;
  ANTHROPIC_API_KEY: string;
  GITHUB_TOKEN: string;
}

// Builds a MessageBatch-compatible object containing a subset of messages.
// Used to route blog-pipeline messages to the right stage handler.
function subBatch<T>(messages: Message<T>[], queueName: string): MessageBatch<T> {
  return {
    queue: queueName,
    messages,
    ackAll() {
      for (const m of messages) m.ack();
    },
    retryAll(options?: QueueRetryOptions) {
      for (const m of messages) m.retry(options);
    },
  };
}

export default {
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    switch (batch.queue) {
      case 'blog-pipeline': {
        // blog-pipeline carries three stage types; route each subset to its handler
        const topic = batch.messages.filter(
          (m) => (m.body as { stage?: string }).stage === 'topic-discovery',
        );
        const outline = batch.messages.filter(
          (m) => (m.body as { stage?: string }).stage === 'outline-generation',
        );
        const article = batch.messages.filter(
          (m) => (m.body as { stage?: string }).stage === 'article-generation',
        );

        if (topic.length > 0)
          await topicDiscovery.queue(subBatch(topic, batch.queue) as MessageBatch<never>, env);
        if (outline.length > 0)
          await outlineGeneration.queue(subBatch(outline, batch.queue) as MessageBatch<never>, env);
        if (article.length > 0)
          await articleGeneration.queue(subBatch(article, batch.queue) as MessageBatch<never>, env);

        // Ack any messages that didn't match a known stage
        for (const m of batch.messages) {
          const stage = (m.body as { stage?: string }).stage;
          if (stage !== 'topic-discovery' && stage !== 'outline-generation' && stage !== 'article-generation') {
            console.warn(`[pipeline-index] Unknown blog-pipeline stage "${stage}" — acking`);
            m.ack();
          }
        }
        break;
      }

      case 'blog-humanize':
        await humanizer.queue(batch as MessageBatch<never>, env);
        break;

      case 'blog-publish':
        await publisher.queue(batch as MessageBatch<never>, env);
        break;

      case 'blog-refresh':
        await refresh.queue(batch as MessageBatch<never>, env);
        break;

      default:
        console.warn(`[pipeline-index] Unexpected queue: ${batch.queue} — acking all`);
        batch.ackAll();
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    await cron.scheduled(event, env, ctx);
  },
};
