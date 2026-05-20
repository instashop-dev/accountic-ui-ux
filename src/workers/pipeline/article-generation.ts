import { createAIClient, checkTokenBudget, incrementTokensUsed } from '../../lib/ai';
import { computeInputHash, generateId } from '../../lib/queue';
import { scoreArticle } from '../../lib/quality';
import { parseFrontmatter } from '../../lib/frontmatter';
import { toSlug } from '../../lib/slug';
import { logEvent } from '../../lib/analytics';
import { checkEmergencyStop, EmergencyStopError, checkCircuitBreaker, CircuitBreakerError, budgetAllowsEnqueue } from '../../lib/safety';

interface Env {
  BLOG_DB: D1Database;
  BLOG_HUMANIZE_QUEUE: Queue;
  ANTHROPIC_API_KEY: string;
  BLOG_ANALYTICS?: AnalyticsEngineDataset;
}

interface ArticleMessage {
  stage: string;
  outline_id: string;
  _replay_job_id?: string;
}

interface OutlineRow {
  id: string;
  topic_id: string;
  outline_json: string;
}

interface TopicRow {
  id: string;
  title: string;
  pillar: string;
}

interface PromptRow {
  id: string;
  version: number;
  system_prompt: string;
  user_prompt_template: string;
}

export default {
  async queue(batch: MessageBatch<ArticleMessage>, env: Env): Promise<void> {
    const db = env.BLOG_DB;
    const ai = createAIClient(env);

    for (const msg of batch.messages) {
      const { outline_id } = msg.body;
      const start = Date.now();

      if (!outline_id) {
        console.warn('[article-generation] Missing outline_id');
        msg.ack();
        continue;
      }

      // ── Emergency stop ─────────────────────────────────────────────────────
      try {
        await checkEmergencyStop(db);
      } catch (e) {
        if (e instanceof EmergencyStopError) {
          console.warn('[article-generation] Emergency stop active — acking without processing:', outline_id);
          msg.ack();
          continue;
        }
        throw e;
      }

      // ── Circuit breaker ────────────────────────────────────────────────────
      // Halt if ≥50% of article-generation jobs failed in the last hour.
      try {
        await checkCircuitBreaker(db, 'article-generation');
      } catch (e) {
        if (e instanceof CircuitBreakerError) {
          console.warn('[article-generation] Circuit breaker open:', e.message);
          msg.ack();
          continue;
        }
        throw e;
      }

      const outline = await db
        .prepare('SELECT id, topic_id, outline_json FROM outlines WHERE id = ?')
        .bind(outline_id)
        .first<OutlineRow>();

      if (!outline) {
        console.warn('[article-generation] Outline not found:', outline_id);
        msg.ack();
        continue;
      }

      const topic = await db
        .prepare('SELECT id, title, pillar FROM topics WHERE id = ?')
        .bind(outline.topic_id)
        .first<TopicRow>();

      const promptRow = await db
        .prepare('SELECT id, version, system_prompt, user_prompt_template FROM prompts WHERE stage = ? AND is_active = 1')
        .bind('article-generation')
        .first<PromptRow>();

      if (!promptRow) {
        console.error('[article-generation] No active prompt found');
        msg.ack();
        continue;
      }

      logEvent(env, { event: 'article_generation_start', stage: 'article-generation', article_id: outline_id, tokens_used: 0, duration_ms: 0, quality_score: 0, outcome: 'success' });

      // Idempotency check
      const inputHash = await computeInputHash({ outline_id, prompt_version: promptRow.version });
      const existingJob = await db
        .prepare('SELECT id, output_ref FROM generation_jobs WHERE input_hash = ? AND status = ?')
        .bind(inputHash, 'done')
        .first<{ id: string; output_ref: string | null }>();

      if (existingJob) {
        console.log('[article-generation] Idempotent skip for outline:', outline_id);
        logEvent(env, { event: 'article_generation_skipped', stage: 'article-generation', article_id: outline_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'skipped', reason: 'idempotent' });
        msg.ack();
        continue;
      }

      // On replay, reuse the existing job row so it doesn't stay stuck at
      // 'pending'. On a fresh run, insert a new row as usual.
      const replayJobId = msg.body._replay_job_id;
      const jobId = replayJobId ?? generateId();
      if (replayJobId) {
        await db
          .prepare(`UPDATE generation_jobs SET status = 'running', error = NULL, updated_at = datetime('now') WHERE id = ?`)
          .bind(replayJobId)
          .run();
      } else {
        await db
          .prepare('INSERT INTO generation_jobs (id, stage, status, input_hash, stage_payload) VALUES (?, ?, ?, ?, ?)')
          .bind(jobId, 'article-generation', 'running', inputHash, JSON.stringify({ outline_id }))
          .run();
      }

      // Parse outline for read_time estimate
      let outlineParsed: { estimated_read_time?: number } = {};
      try { outlineParsed = JSON.parse(outline.outline_json) as { estimated_read_time?: number }; } catch { /**/ }
      const readTime = outlineParsed.estimated_read_time ?? 5;

      const estimatedTokens = 4000;
      try {
        await checkTokenBudget(db, estimatedTokens);
      } catch (e) {
        console.warn('[article-generation] Token budget exceeded for outline:', outline_id);
        await failJob(db, jobId, 'Token budget exceeded');
        msg.ack();
        continue;
      }

      const userPrompt = promptRow.user_prompt_template
        .replace('{{outline_json}}', outline.outline_json)
        .replace('{{read_time}}', String(readTime));

      let result: { text: string; inputTokens: number; outputTokens: number };
      try {
        result = await ai.generate({
          system: promptRow.system_prompt,
          user: userPrompt,
          maxTokens: 6000,
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        await failJob(db, jobId, errMsg);
        msg.retry();
        continue;
      }

      await incrementTokensUsed(db, result.inputTokens + result.outputTokens);

      // Build frontmatter from outline JSON + topic data.
      // The article prompt instructs Claude NOT to write frontmatter (it's pipeline
      // responsibility), so we construct it here from structured data we already have.
      //
      // Strip any ```mdx ... ``` wrapper and/or embedded frontmatter Claude may have
      // written despite instructions — publisher builds frontmatter from structured data.
      const fullContent = stripArticleOutput(result.text);

      let outlineMeta: {
        title?: string;
        description?: string;
        readTime?: number;
        slug?: string;
        pillar?: string;
      } = {};
      try {
        outlineMeta = JSON.parse(outline.outline_json) as typeof outlineMeta;
      } catch { /**/ }

      const title = String(outlineMeta.title ?? topic?.title ?? 'untitled');
      const slug = outlineMeta.slug ? outlineMeta.slug : toSlug(title);

      // Estimate read time from word count if not in outline (~200 wpm)
      const wordCount = fullContent.match(/\b\w+\b/g)?.length ?? 0;
      const estimatedReadTime = outlineMeta.readTime ?? Math.max(3, Math.round(wordCount / 200));

      const fm = {
        title,
        description: String(outlineMeta.description ?? ''),
        pubDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD string
        pillar: topic?.pillar ?? outlineMeta.pillar ?? 'Income Tax Notices',
        author: 'Accountic Team',
        readTime: estimatedReadTime,
        tone: 'emerald',
        featured: false,
      };

      // Run quality gate
      const qualityReport = scoreArticle(fullContent, fm, slug);

      const draftId = generateId();
      const draftStatus = qualityReport.passed ? 'ready' : 'failed';
      const draftError = qualityReport.passed ? null : JSON.stringify(qualityReport.errors);

      await db.batch([
        db.prepare(
          `INSERT INTO drafts (id, outline_id, slug, content, frontmatter_json, status, error, quality_report_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          draftId,
          outline_id,
          slug,
          fullContent,
          JSON.stringify(fm),
          draftStatus,
          draftError,
          JSON.stringify(qualityReport),
        ),
        db.prepare(
          `UPDATE generation_jobs SET status = 'done', output_ref = ?, updated_at = datetime('now') WHERE id = ?`,
        ).bind(draftId, jobId),
      ]);

      if (qualityReport.passed) {
        console.log('[article-generation] Draft ready:', draftId, slug);
        // Pre-enqueue budget check: only dispatch humanizer work if budget allows
        if (await budgetAllowsEnqueue(db, 2000, 'humanizer')) {
          await env.BLOG_HUMANIZE_QUEUE.send({ draft_id: draftId });
        }
        logEvent(env, { event: 'article_generated', stage: 'article-generation', article_id: draftId, tokens_used: result.inputTokens + result.outputTokens, duration_ms: Date.now() - start, quality_score: qualityReport.scores.readability, outcome: 'success' });
      } else {
        console.warn('[article-generation] Draft failed quality gate:', draftId, qualityReport.errors);
        logEvent(env, { event: 'article_generation_failed', stage: 'article-generation', article_id: draftId, tokens_used: result.inputTokens + result.outputTokens, duration_ms: Date.now() - start, quality_score: qualityReport.scores.readability, outcome: 'failure' });
      }

      msg.ack();
    }
  },
};

async function failJob(db: D1Database, jobId: string, error: string): Promise<void> {
  await db
    .prepare(`UPDATE generation_jobs SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(error, jobId)
    .run();
}

/**
 * Clean raw model output before storing as draft content.
 * - Strips a wrapping ```mdx / ``` code fence if Claude wrapped its response
 * - Strips any embedded YAML frontmatter (pipeline builds frontmatter from structured data)
 */
function stripArticleOutput(raw: string): string {
  let content = raw.trim();
  // Strip outer code fence (```mdx ... ``` or ``` ... ```)
  const fenceMatch = content.match(/^```(?:mdx|markdown|md)?\r?\n([\s\S]*?)\r?\n```\s*$/);
  if (fenceMatch) content = fenceMatch[1].trim();
  // Strip embedded frontmatter
  content = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trimStart();
  return content;
}
