import { createAIClient, checkTokenBudget, incrementTokensUsed } from '../../lib/ai';
import { generateId, outlineMessage } from '../../lib/queue';
import { PILLARS } from '../../blog-meta';
import { checkEmergencyStop, EmergencyStopError, budgetAllowsEnqueue } from '../../lib/safety';
import { safeErrorMessage } from '../../lib/redact';

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

      // ── Emergency stop ─────────────────────────────────────────────────────
      try {
        await checkEmergencyStop(db);
      } catch (e) {
        if (e instanceof EmergencyStopError) {
          console.warn('[topic-discovery] Emergency stop active — acking without processing');
          msg.ack();
          continue;
        }
        throw e;
      }

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

      // ── Build coverage brief for editorial-aware generation ────────────────
      const pillarCountRows = await db
        .prepare("SELECT pillar, COUNT(*) as count FROM topics WHERE status != 'failed' GROUP BY pillar")
        .all<{ pillar: string; count: number }>();

      const recentTitleRows = await db
        .prepare(
          "SELECT title FROM topics WHERE status != 'failed' AND created_at >= datetime('now', '-90 days') ORDER BY created_at DESC LIMIT 300",
        )
        .all<{ title: string }>();

      const coverageBrief = buildCoverageBrief(pillarCountRows.results, recentTitleRows.results);

      const userPrompt = promptRow.user_prompt_template
        .replace('{{coverage_brief}}', coverageBrief)
        .replace('{{count}}', String(count));

      const estimatedTokens = 2000;
      try {
        await checkTokenBudget(db, estimatedTokens);
      } catch (e) {
        console.warn('[topic-discovery] Token budget exceeded, skipping');
        msg.ack();
        continue;
      }

      let result: { text: string; inputTokens: number; outputTokens: number };
      try {
        result = await ai.generate({ system: promptRow.system_prompt, user: userPrompt });
      } catch (e) {
        console.error('[topic-discovery] AI call failed:', safeErrorMessage(e));
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

      // Fetch existing titles for deduplication (topics + published posts)
      const existingRows = await db
        .prepare('SELECT title FROM topics UNION SELECT title FROM posts')
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

          // Pre-enqueue budget check: only dispatch outline work if downstream has token headroom.
          // Topic is inserted even if skipped — admin can replay pending topics later.
          if (await budgetAllowsEnqueue(db, 1500, 'outline-generation')) {
            await env.BLOG_PIPELINE_QUEUE.send(outlineMessage(id));
            existingTitles.add(candidate.title.toLowerCase());
            inserted++;
          } else {
            existingTitles.add(candidate.title.toLowerCase());
          }
        } catch (e) {
          console.warn('[topic-discovery] Insert failed (likely duplicate):', candidate.title, safeErrorMessage(e));
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

/**
 * Builds a compact editorial coverage brief for injection into the topic-discovery prompt.
 *
 * Two sections:
 *   1. Per-pillar counts (all-time, excluding failed topics) — signals saturation balance
 *   2. Recent titles (last 90 days, up to 300) — enables semantic recency dedup by the AI
 *
 * If both sections are empty (first run), returns an empty string so the replacement
 * in a template that contains `{{coverage_brief}}` is graceful.
 */
export function buildCoverageBrief(
  pillarCounts: Array<{ pillar: string; count: number }>,
  recentTitles: Array<{ title: string }>,
): string {
  if (pillarCounts.length === 0 && recentTitles.length === 0) return '';

  const countMap = new Map(pillarCounts.map((r) => [r.pillar, r.count]));
  const countsSection = PILLARS.map((p) => `- ${p}: ${countMap.get(p) ?? 0}`).join('\n');

  const titlesSection =
    recentTitles.length > 0
      ? recentTitles.map((r) => `- ${r.title}`).join('\n')
      : '(none in the last 90 days)';

  return (
    `Per-pillar topic counts (all time, excluding failed):\n${countsSection}\n\n` +
    `Topics covered in the last 90 days (most recent first):\n${titlesSection}`
  );
}
