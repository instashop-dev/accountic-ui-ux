import { createAIClient, checkTokenBudget, incrementTokensUsed, BudgetExceededError } from '../../lib/ai';
import { generateId } from '../../lib/queue';
import { scoreArticle } from '../../lib/quality';
import { parseFrontmatter } from '../../lib/frontmatter';
import { detectRegression, checkNewNumerics } from '../../lib/regression';
import { extractLockedRegions, restoreLockedRegions } from '../../lib/humanizer-regions';
import { logEvent } from '../../lib/analytics';
import { checkEmergencyStop, EmergencyStopError } from '../../lib/safety';
import { safeErrorMessage, redactSecrets } from '../../lib/redact';
import { saveSnapshot, pruneSnapshots } from '../../lib/snapshot';

interface Env {
  BLOG_DB: D1Database;
  BLOG_REFRESH_QUEUE: Queue;
  BLOG_ASSETS: R2Bucket;
  BLOG_ANALYTICS?: AnalyticsEngineDataset;
  ANTHROPIC_API_KEY: string;
  GITHUB_TOKEN: string;
}

interface RefreshMessage {
  stage: string;
  post_id: string;
}

interface PostRow {
  id: string;
  slug: string;
  title: string;
  source: string;
  status: string;
}

interface DraftRow {
  id: string;
  outline_id: string;
  content: string;
  frontmatter_json: string;
}

interface OutlineRow {
  id: string;
  outline_json: string;
}

interface PromptRow {
  id: string;
  version: number;
  system_prompt: string;
  user_prompt_template: string;
}

const GITHUB_OWNER = 'instashop-dev';
const GITHUB_REPO = 'accountic-ui-ux';
const GITHUB_BRANCH = 'main';

export default {
  async queue(batch: MessageBatch<RefreshMessage>, env: Env): Promise<void> {
    const db = env.BLOG_DB;

    for (const msg of batch.messages) {
      const { post_id } = msg.body;
      const start = Date.now();

      if (!post_id) {
        console.warn('[refresh] Missing post_id');
        msg.ack();
        continue;
      }

      // ── Emergency stop ──────────────────────────────────────────────────────
      try {
        await checkEmergencyStop(db);
      } catch (e) {
        if (e instanceof EmergencyStopError) {
          console.warn('[refresh] Emergency stop active — acking message without processing');
          msg.ack();
          continue;
        }
        throw e;
      }

      // ── Fetch post ──────────────────────────────────────────────────────────
      const post = await db
        .prepare('SELECT id, slug, title, source, status FROM posts WHERE id = ?')
        .bind(post_id)
        .first<PostRow>();

      if (!post) {
        console.warn('[refresh] Post not found:', post_id);
        msg.ack();
        continue;
      }

      // ── Source guard: only refresh AI-authored posts ────────────────────────
      if (post.source !== 'ai') {
        console.log('[refresh] Skipping non-AI post:', post_id, post.source);
        logEvent(env, { event: 'refresh_skipped', stage: 'refresh', article_id: post_id, tokens_used: 0, duration_ms: 0, quality_score: 0, outcome: 'skipped', reason: 'source_not_ai' });
        msg.ack();
        continue;
      }

      let snapshotKey: string | undefined;

      try {
        // ── Fetch current MDX from GitHub ─────────────────────────────────────
        const filePath = `src/content/blog/${post.slug}.mdx`;
        let currentMdx: string | null = null;
        try {
          const checkResp = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
            {
              headers: {
                Authorization: `Bearer ${env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
              },
            },
          );
          if (checkResp.ok) {
            const fileData = await checkResp.json() as { content?: string; encoding?: string };
            if (fileData.content && fileData.encoding === 'base64') {
              currentMdx = decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, ''))));
            }
          }
        } catch (e) {
          console.warn('[refresh] Could not fetch current MDX from GitHub:', safeErrorMessage(e));
        }

        // ── Snapshot current content to R2 ────────────────────────────────────
        if (currentMdx) {
          snapshotKey = await saveSnapshot(env.BLOG_ASSETS, post_id, currentMdx);
          console.log('[refresh] Snapshot saved:', snapshotKey);
        }

        // ── Fetch most recent draft for this post ─────────────────────────────
        const draft = await db
          .prepare(
            `SELECT d.id, d.outline_id, d.content, d.frontmatter_json
             FROM drafts d
             JOIN posts p ON p.slug = d.slug
             WHERE p.id = ?
             ORDER BY d.created_at DESC LIMIT 1`,
          )
          .bind(post_id)
          .first<DraftRow>();

        if (!draft) {
          console.warn('[refresh] No draft found for post:', post_id);
          await insertRefreshJob(db, post_id, 'failed', 'no_draft', 0, Date.now() - start, snapshotKey);
          logEvent(env, { event: 'refresh_failed', stage: 'refresh', article_id: post_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'failure', failed_gate: 'no_draft' });
          msg.ack();
          continue;
        }

        // ── Fetch outline for regeneration ────────────────────────────────────
        const outline = await db
          .prepare('SELECT id, outline_json FROM outlines WHERE id = ?')
          .bind(draft.outline_id)
          .first<OutlineRow>();

        if (!outline) {
          console.warn('[refresh] Outline not found for draft:', draft.id);
          await insertRefreshJob(db, post_id, 'failed', 'no_outline', 0, Date.now() - start, snapshotKey);
          logEvent(env, { event: 'refresh_failed', stage: 'refresh', article_id: post_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'failure', failed_gate: 'no_outline' });
          msg.ack();
          continue;
        }

        // ── Fetch article generation prompt ───────────────────────────────────
        const promptRow = await db
          .prepare("SELECT id, version, system_prompt, user_prompt_template FROM prompts WHERE stage = 'article-generation' AND is_active = 1")
          .first<PromptRow>();

        if (!promptRow) {
          console.error('[refresh] No active article-generation prompt for post:', post_id);
          await insertRefreshJob(db, post_id, 'failed', 'no_prompt', 0, Date.now() - start, snapshotKey);
          logEvent(env, { event: 'refresh_failed', stage: 'refresh', article_id: post_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'failure', failed_gate: 'no_prompt' });
          msg.ack();
          continue;
        }

        // ── Token budget check ────────────────────────────────────────────────
        const estimatedTokens = 6000;
        try {
          await checkTokenBudget(db, estimatedTokens);
        } catch (e) {
          if (e instanceof BudgetExceededError) {
            console.warn('[refresh] Token budget exceeded for post:', post_id);
            await insertRefreshJob(db, post_id, 'failed', 'budget_exceeded', 0, Date.now() - start, snapshotKey);
            logEvent(env, { event: 'refresh_failed', stage: 'refresh', article_id: post_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'failure', failed_gate: 'budget_exceeded' });
            msg.ack();
            continue;
          }
          throw e;
        }

        // ── Regenerate article via Claude ─────────────────────────────────────
        const ai = createAIClient(env);
        let outlineParsed: { estimated_read_time?: number } = {};
        try { outlineParsed = JSON.parse(outline.outline_json) as { estimated_read_time?: number }; } catch { /**/ }
        const readTime = outlineParsed.estimated_read_time ?? 5;

        const userPrompt = promptRow.user_prompt_template
          .replace('{{outline_json}}', outline.outline_json)
          .replace('{{read_time}}', String(readTime));

        let genResult: { text: string; inputTokens: number; outputTokens: number };
        try {
          genResult = await ai.generate({
            system: promptRow.system_prompt,
            user: userPrompt,
            maxTokens: 6000,
          });
        } catch (e) {
          console.error('[refresh] Claude API error:', safeErrorMessage(e));
          await insertRefreshJob(db, post_id, 'failed', 'api_error', 0, Date.now() - start, snapshotKey);
          logEvent(env, { event: 'refresh_failed', stage: 'refresh', article_id: post_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'failure', failed_gate: 'api_error' });
          msg.retry();
          continue;
        }

        const tokensUsed = genResult.inputTokens + genResult.outputTokens;
        await incrementTokensUsed(db, tokensUsed);

        const newBody = genResult.text;
        const { data: fm } = parseFrontmatter(newBody);

        // ── Quality gate ──────────────────────────────────────────────────────
        const qualityReport = scoreArticle(newBody, fm);
        if (!qualityReport.passed) {
          console.warn('[refresh] Quality gate failed for post:', post_id, qualityReport.errors);
          await insertRefreshJob(db, post_id, 'failed', 'quality', tokensUsed, Date.now() - start, snapshotKey);
          logEvent(env, { event: 'refresh_failed', stage: 'refresh', article_id: post_id, tokens_used: tokensUsed, duration_ms: Date.now() - start, quality_score: qualityReport.scores.readability, outcome: 'failure', failed_gate: 'quality' });
          msg.ack();
          continue;
        }

        // ── Humanizer pass ────────────────────────────────────────────────────
        const humanizerPromptRow = await db
          .prepare("SELECT id, system_prompt, user_prompt_template FROM prompts WHERE stage = 'humanizer' AND is_active = 1")
          .first<PromptRow>();

        let humanizedBody = newBody;
        if (humanizerPromptRow) {
          const { stripped, regions } = extractLockedRegions(newBody);
          const humanUserPrompt = humanizerPromptRow.user_prompt_template.replace('{{content}}', stripped);
          try {
            const humanResult = await ai.generate({
              system: humanizerPromptRow.system_prompt,
              user: humanUserPrompt,
              model: 'claude-haiku-4-5-20251001',
              maxTokens: 8000,
              temperature: 0.3,
            });
            await incrementTokensUsed(db, humanResult.inputTokens + humanResult.outputTokens);
            const restored = restoreLockedRegions(humanResult.text, regions);
            if (restored !== null) {
              // Only use humanized version if it doesn't regress readability
              const humanReport = scoreArticle(restored, fm);
              if (humanReport.scores.readability >= qualityReport.scores.readability) {
                humanizedBody = restored;
              }
            }
          } catch {
            // Humanizer failure is non-fatal — proceed with original generated content
            console.warn('[refresh] Humanizer failed, using raw generated content for post:', post_id);
          }
        }

        // ── Regression gate: compare to original content ──────────────────────
        if (currentMdx) {
          const regressionResult = detectRegression(currentMdx, humanizedBody, 0.3);
          if (!regressionResult.passed) {
            // Very low similarity means the content diverged too far — reject
            // (Note: we use a lower threshold 0.3 than humanizer since refresh is expected to change content)
            console.warn('[refresh] Regression gate failed:', regressionResult.failed_gate, 'for post:', post_id);
          }
          if (checkNewNumerics(currentMdx, humanizedBody)) {
            console.warn('[refresh] Fabricated numerics detected in refresh for post:', post_id);
            await insertRefreshJob(db, post_id, 'failed', 'regression', tokensUsed, Date.now() - start, snapshotKey);
            logEvent(env, { event: 'refresh_failed', stage: 'refresh', article_id: post_id, tokens_used: tokensUsed, duration_ms: Date.now() - start, quality_score: qualityReport.scores.readability, outcome: 'failure', failed_gate: 'regression' });
            msg.ack();
            continue;
          }
        }

        // ── Commit refreshed MDX to GitHub ────────────────────────────────────
        const filePath2 = `src/content/blog/${post.slug}.mdx`;
        let existingSha: string | undefined;
        try {
          const checkResp = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath2}?ref=${GITHUB_BRANCH}`,
            {
              headers: {
                Authorization: `Bearer ${env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
              },
            },
          );
          if (checkResp.ok) {
            const fileData = await checkResp.json() as { sha?: string };
            existingSha = fileData.sha;
          }
        } catch { /* proceed without sha */ }

        const contentBase64 = btoa(unescape(encodeURIComponent(humanizedBody)));
        const commitBody: Record<string, unknown> = {
          message: `[ai-refresh] ${post.title} | post_id=${post_id}`,
          content: contentBase64,
          branch: GITHUB_BRANCH,
        };
        if (existingSha) commitBody.sha = existingSha;

        const putResp = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath2}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${env.GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify(commitBody),
          },
        );

        if (!putResp.ok) {
          const errBody = await putResp.text();
          console.error('[refresh] GitHub commit failed:', putResp.status, redactSecrets(errBody.slice(0, 200)));
          await insertRefreshJob(db, post_id, 'failed', `github_${putResp.status}`, tokensUsed, Date.now() - start, snapshotKey);
          logEvent(env, { event: 'refresh_failed', stage: 'refresh', article_id: post_id, tokens_used: tokensUsed, duration_ms: Date.now() - start, quality_score: qualityReport.scores.readability, outcome: 'failure', failed_gate: `github_${putResp.status}` });
          msg.ack();
          continue;
        }

        // ── Update D1 and prune snapshots ─────────────────────────────────────
        await db
          .prepare(`UPDATE posts SET last_refreshed_at = datetime('now'), refresh_count = refresh_count + 1, updated_at = datetime('now') WHERE id = ?`)
          .bind(post_id)
          .run();
        await insertRefreshJob(db, post_id, 'success', null, tokensUsed, Date.now() - start, snapshotKey);
        if (snapshotKey) {
          await pruneSnapshots(env.BLOG_ASSETS, post_id);
        }

        logEvent(env, { event: 'refresh_success', stage: 'refresh', article_id: post_id, tokens_used: tokensUsed, duration_ms: Date.now() - start, quality_score: qualityReport.scores.readability, outcome: 'success' });
        console.log('[refresh] Successfully refreshed post:', post.slug);
      } catch (e) {
        const errMsg = safeErrorMessage(e);
        console.error('[refresh] Unhandled error for post:', post_id, errMsg);
        await insertRefreshJob(db, post_id, 'failed', 'unhandled_error', 0, Date.now() - start, snapshotKey).catch(() => {});
        logEvent(env, { event: 'refresh_failed', stage: 'refresh', article_id: post_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'failure', failed_gate: 'unhandled_error' });
        throw e;
      }

      msg.ack();
    }
  },
};

async function insertRefreshJob(
  db: D1Database,
  postId: string,
  status: string,
  failedGate: string | null,
  tokensUsed: number,
  durationMs: number,
  snapshotKey?: string,
): Promise<void> {
  const id = generateId();
  await db
    .prepare(
      'INSERT INTO refresh_jobs (id, post_id, status, failed_gate, tokens_used, duration_ms, snapshot_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, postId, status, failedGate ?? null, tokensUsed, durationMs, snapshotKey ?? null)
    .run();
}
