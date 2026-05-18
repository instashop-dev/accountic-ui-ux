import { createAIClient, checkTokenBudget, incrementTokensUsed } from '../../lib/ai';
import { computeInputHash, generateId } from '../../lib/queue';
import { scoreArticle } from '../../lib/quality';
import { parseFrontmatter } from '../../lib/frontmatter';
import { toSlug } from '../../lib/slug';

interface Env {
  BLOG_DB: D1Database;
  ANTHROPIC_API_KEY: string;
}

interface ArticleMessage {
  stage: string;
  outline_id: string;
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

      if (!outline_id) {
        console.warn('[article-generation] Missing outline_id');
        msg.ack();
        continue;
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

      // Idempotency check
      const inputHash = await computeInputHash({ outline_id, prompt_version: promptRow.version });
      const existingJob = await db
        .prepare('SELECT id, output_ref FROM generation_jobs WHERE input_hash = ? AND status = ?')
        .bind(inputHash, 'done')
        .first<{ id: string; output_ref: string | null }>();

      if (existingJob) {
        console.log('[article-generation] Idempotent skip for outline:', outline_id);
        msg.ack();
        continue;
      }

      const jobId = generateId();
      await db
        .prepare('INSERT INTO generation_jobs (id, stage, status, input_hash, stage_payload) VALUES (?, ?, ?, ?, ?)')
        .bind(jobId, 'article-generation', 'running', inputHash, JSON.stringify({ outline_id }))
        .run();

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

      // Parse frontmatter from the generated MDX
      const { data: fm, content: bodyContent } = parseFrontmatter(result.text);
      const fullContent = result.text;

      // Generate slug from title
      const title = String(fm.title ?? topic?.title ?? 'untitled');
      const slug = toSlug(title);

      // Run quality gate
      const qualityReport = scoreArticle(fullContent, fm);

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
      } else {
        console.warn('[article-generation] Draft failed quality gate:', draftId, qualityReport.errors);
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
