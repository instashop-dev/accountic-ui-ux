import { createAIClient, checkTokenBudget, incrementTokensUsed } from '../../lib/ai';
import { generateId, articleMessage } from '../../lib/queue';
import { checkEmergencyStop, EmergencyStopError, budgetAllowsEnqueue } from '../../lib/safety';

interface Env {
  BLOG_DB: D1Database;
  BLOG_PIPELINE_QUEUE: Queue;
  ANTHROPIC_API_KEY: string;
}

interface OutlineMessage {
  stage: string;
  topic_id: string;
}

interface Topic {
  id: string;
  title: string;
  pillar: string;
  rationale: string;
  status: string;
}

export default {
  async queue(batch: MessageBatch<OutlineMessage>, env: Env): Promise<void> {
    const db = env.BLOG_DB;
    const ai = createAIClient(env);

    for (const msg of batch.messages) {
      const { topic_id } = msg.body;

      if (!topic_id) {
        console.warn('[outline-generation] Missing topic_id in message');
        msg.ack();
        continue;
      }

      // ── Emergency stop ─────────────────────────────────────────────────────
      try {
        await checkEmergencyStop(db);
      } catch (e) {
        if (e instanceof EmergencyStopError) {
          console.warn('[outline-generation] Emergency stop active — acking without processing:', topic_id);
          msg.ack();
          continue;
        }
        throw e;
      }

      const topic = await db
        .prepare('SELECT id, title, pillar, rationale, status FROM topics WHERE id = ?')
        .bind(topic_id)
        .first<Topic>();

      if (!topic) {
        console.warn('[outline-generation] Topic not found:', topic_id);
        msg.ack();
        continue;
      }

      // Mark as outlining
      await db
        .prepare(`UPDATE topics SET status = 'outlining', updated_at = datetime('now') WHERE id = ?`)
        .bind(topic_id)
        .run();

      const promptRow = await db
        .prepare('SELECT system_prompt, user_prompt_template FROM prompts WHERE stage = ? AND is_active = 1')
        .bind('outline-generation')
        .first<{ system_prompt: string; user_prompt_template: string }>();

      if (!promptRow) {
        console.error('[outline-generation] No active prompt found');
        await setTopicFailed(db, topic_id, 'No active outline-generation prompt');
        msg.ack();
        continue;
      }

      const userPrompt = promptRow.user_prompt_template
        .replace('{{title}}', topic.title)
        .replace('{{pillar}}', topic.pillar)
        .replace('{{rationale}}', topic.rationale ?? '');

      const estimatedTokens = 1500;
      try {
        await checkTokenBudget(db, estimatedTokens);
      } catch (e) {
        console.warn('[outline-generation] Token budget exceeded, skipping:', topic_id);
        await setTopicFailed(db, topic_id, 'Token budget exceeded');
        msg.ack();
        continue;
      }

      let result: { text: string; inputTokens: number; outputTokens: number };
      try {
        result = await ai.generate({ system: promptRow.system_prompt, user: userPrompt, maxTokens: 3500 });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error('[outline-generation] AI call failed:', errMsg);
        await setTopicFailed(db, topic_id, errMsg);
        msg.retry();
        continue;
      }

      await incrementTokensUsed(db, result.inputTokens + result.outputTokens);

      const outlineId = generateId();
      let outlineJson = result.text.trim();

      // Extract JSON object if wrapped in prose
      const objStart = outlineJson.indexOf('{');
      const objEnd = outlineJson.lastIndexOf('}');
      if (objStart !== -1 && objEnd !== -1) {
        outlineJson = outlineJson.slice(objStart, objEnd + 1);
      }

      try {
        await db
          .prepare('INSERT INTO outlines (id, topic_id, outline_json) VALUES (?, ?, ?)')
          .bind(outlineId, topic_id, outlineJson)
          .run();

        await db
          .prepare(`UPDATE topics SET status = 'outlined', updated_at = datetime('now') WHERE id = ?`)
          .bind(topic_id)
          .run();

        // Pre-enqueue budget check: only dispatch article work if downstream has token headroom.
        // Outline is stored even if skipped — admin can trigger article generation from the queue UI.
        if (await budgetAllowsEnqueue(db, 4000, 'article-generation')) {
          await env.BLOG_PIPELINE_QUEUE.send(articleMessage(outlineId));
        }
        console.log('[outline-generation] Outline created for topic:', topic_id);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        await db
          .prepare('INSERT OR IGNORE INTO outlines (id, topic_id, outline_json, error) VALUES (?, ?, ?, ?)')
          .bind(generateId(), topic_id, '{}', errMsg)
          .run();
        await setTopicFailed(db, topic_id, errMsg);
      }

      msg.ack();
    }
  },
};

async function setTopicFailed(db: D1Database, topic_id: string, error: string): Promise<void> {
  await db
    .prepare(`UPDATE topics SET status = 'failed', updated_at = datetime('now') WHERE id = ?`)
    .bind(topic_id)
    .run();
  console.error('[outline-generation] Topic failed:', topic_id, error);
}
