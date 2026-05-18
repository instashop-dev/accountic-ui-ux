import { topicDiscoveryMessage, refreshMessage } from '../../lib/queue';

interface Env {
  BLOG_DB: D1Database;
  BLOG_PIPELINE_QUEUE: Queue;
}

interface Post {
  id: string;
  updated_at: string;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const db = env.BLOG_DB;

    // Check master switch
    const genRow = await db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .bind('generation_enabled')
      .first<{ value: string }>();

    if (genRow?.value !== 'true') {
      console.log('[cron] Generation disabled, skipping');
      return;
    }

    const cron = event.cron;

    // Weekly topic discovery: every Monday at 03:00 UTC
    if (cron === '0 3 * * 1') {
      await env.BLOG_PIPELINE_QUEUE.send(topicDiscoveryMessage(10));
      console.log('[cron] Dispatched topic-discovery message');
    }

    // Daily refresh scan: every day at 04:00 UTC
    if (cron === '0 4 * * *') {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19);

      const stalePosts = await db
        .prepare('SELECT id, updated_at FROM posts WHERE updated_at < ? AND source = ?')
        .bind(sixtyDaysAgo, 'ai')
        .all<Post>();

      for (const post of stalePosts.results) {
        await env.BLOG_PIPELINE_QUEUE.send(refreshMessage(post.id));
      }

      console.log(`[cron] Dispatched ${stalePosts.results.length} refresh messages`);

      // Reset daily token counter
      await db
        .prepare(`UPDATE settings SET value = '0', updated_at = datetime('now') WHERE key = 'tokens_used_today'`)
        .run();
    }
  },
};
