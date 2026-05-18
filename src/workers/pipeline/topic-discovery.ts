import { createAIClient, checkTokenBudget, incrementTokensUsed } from '../../lib/ai';
import { generateId, outlineMessage } from '../../lib/queue';
import { PILLARS } from '../../blog-meta';

interface Env {
  BLOG_DB: D1Database;
  BLOG_PIPELINE_QUEUE: Queue;
  ANTHROPIC_API_KEY: string;
}

interface TopicCandidate {
  title: string;
  pillar: string;
  rationale: string;
}

interface QueueMessage {
  stage: string;
  count?: number;
}

export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    const db = env.BLOG_DB;
    const ai = createAIClient(env);

    for (const msg of batch.messages) {
      const count = Math.min(msg.body.count ?? 10, 10);

      // Fetch active prompt
      const promptRow = await db
        .prepare('SELECT system_prompt, user_prompt_template FROM prompts WHERE stage = ? AND is_active = 1')
        .bind('topic-discovery')
        .first<{ system_prompt: string; user_prompt_template: string }>();

      if (!promptRow) {
        console.error('[topic-discovery] No active prompt found');
        msg.ack();
        continue;
      }

      const userPrompt = promptRow.user_prompt_template.replace('{{count}}', String(count));

      const estimatedTokens = 2000;
      try {
        await checkTokenBudget(db, estimatedTokens);
      } catch (e) {
        console.warn('[topic-discovery] Token budget exceeded, skipping:', e);
        msg.ack();
        continue;
      }

      let result: { text: string; inputTokens: number; outputTokens: number };
      try {
        result = await ai.generate({ system: promptRow.system_prompt, user: userPrompt });
      } catch (e) {
        console.error('[topic-discovery] AI call failed:', e);
        msg.retry();
        continue;
      }

      await incrementTokensUsed(db, result.inputTokens + result.outputTokens);

      let candidates: TopicCandidate[] = [];
      try {
        const jsonText = extractJson(result.text);
        candidates = JSON.parse(jsonText) as TopicCandidate[];
      } catch (e) {
        console.error('[topic-discovery] Failed to parse Claude response as JSON:', result.text.slice(0, 200));
        msg.ack();
        continue;
      }

      // Fetch existing titles for deduplication
      const existingRows = await db
        .prepare('SELECT title FROM topics')
        .all<{ title: string }>();
      const existingTitles = new Set(existingRows.results.map((r) => r.title.toLowerCase()));

      let inserted = 0;
      for (const candidate of candidates.slice(0, count)) {
        if (!candidate.title || !candidate.pillar) continue;
        if (!PILLARS.includes(candidate.pillar as typeof PILLARS[number])) {
          console.warn('[topic-discovery] Invalid pillar, skipping:', candidate.pillar);
          continue;
        }
        if (existingTitles.has(candidate.title.toLowerCase())) {
          continue;
        }

        const id = generateId();
        try {
          await db
            .prepare('INSERT INTO topics (id, title, pillar, rationale, status) VALUES (?, ?, ?, ?, ?)')
            .bind(id, candidate.title, candidate.pillar, candidate.rationale ?? '', 'pending')
            .run();

          // Dispatch outline message
          await env.BLOG_PIPELINE_QUEUE.send(outlineMessage(id));
          existingTitles.add(candidate.title.toLowerCase());
          inserted++;
        } catch (e) {
          console.warn('[topic-discovery] Insert failed (likely duplicate):', candidate.title, e);
        }
      }

      console.log(`[topic-discovery] Inserted ${inserted} new topics`);
      msg.ack();
    }
  },
};

function extractJson(text: string): string {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array found in response');
  return text.slice(start, end + 1);
}
