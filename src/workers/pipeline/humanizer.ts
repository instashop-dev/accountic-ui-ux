import { createAIClient, checkTokenBudget, incrementTokensUsed, BudgetExceededError } from '../../lib/ai';
import { scoreArticle } from '../../lib/quality';
import { parseFrontmatter } from '../../lib/frontmatter';
import { computeInputHash, generateId } from '../../lib/queue';
import { extractLockedRegions, restoreLockedRegions } from '../../lib/humanizer-regions';
import { detectRegression, checkNewNumerics } from '../../lib/regression';
import { logEvent } from '../../lib/analytics';
import { checkEmergencyStop, EmergencyStopError } from '../../lib/safety';
import { safeErrorMessage } from '../../lib/redact';

interface Env {
  BLOG_DB: D1Database;
  BLOG_PUBLISH_QUEUE: Queue;
  ANTHROPIC_API_KEY: string;
  BLOG_ANALYTICS?: AnalyticsEngineDataset;
}

interface HumanizerMessage {
  draft_id: string;
}

interface DraftRow {
  id: string;
  slug: string;
  content: string;
  frontmatter_json: string;
  status: string;
  quality_report_json: string | null;
}

interface PromptRow {
  id: string;
  version: number;
  system_prompt: string;
  user_prompt_template: string;
}

function clampTemperature(val: number): number {
  return Math.min(0.4, Math.max(0.2, val));
}

export default {
  async queue(batch: MessageBatch<HumanizerMessage>, env: Env): Promise<void> {
    const db = env.BLOG_DB;

    for (const msg of batch.messages) {
      const { draft_id } = msg.body;
      const start = Date.now();

      if (!draft_id) {
        console.warn('[humanizer] Missing draft_id');
        msg.ack();
        continue;
      }

      // ── Emergency stop ─────────────────────────────────────────────────────
      try {
        await checkEmergencyStop(db);
      } catch (e) {
        if (e instanceof EmergencyStopError) {
          console.warn('[humanizer] Emergency stop active — acking message without processing');
          msg.ack();
          continue;
        }
        throw e;
      }

      const draft = await db
        .prepare('SELECT id, slug, content, frontmatter_json, status, quality_report_json FROM drafts WHERE id = ?')
        .bind(draft_id)
        .first<DraftRow>();

      if (!draft) {
        console.warn('[humanizer] Draft not found:', draft_id);
        msg.ack();
        continue;
      }

      // Idempotency: already humanized
      if (draft.status === 'humanized') {
        logEvent(env, { event: 'humanizer_skipped', stage: 'humanizer', article_id: draft_id, tokens_used: 0, duration_ms: 0, quality_score: 0, outcome: 'skipped', reason: 'already_humanized' });
        msg.ack();
        continue;
      }

      // Wrong status guard
      if (draft.status !== 'ready') {
        console.warn('[humanizer] Draft status is not ready:', draft_id, draft.status);
        logEvent(env, { event: 'humanizer_skipped', stage: 'humanizer', article_id: draft_id, tokens_used: 0, duration_ms: 0, quality_score: 0, outcome: 'skipped', reason: `wrong_status:${draft.status}` });
        msg.ack();
        continue;
      }

      // ── Read settings ──────────────────────────────────────────────────────
      const [enabledRow, tempRow, thresholdRow] = await Promise.all([
        db.prepare('SELECT value FROM settings WHERE key = ?').bind('humanizer_enabled').first<{ value: string }>(),
        db.prepare('SELECT value FROM settings WHERE key = ?').bind('humanizer_temperature').first<{ value: string }>(),
        db.prepare('SELECT value FROM settings WHERE key = ?').bind('humanizer_similarity_threshold').first<{ value: string }>(),
      ]);

      const humanizerEnabled = (enabledRow?.value ?? 'true') === 'true';
      const temperature = clampTemperature(parseFloat(tempRow?.value ?? '0.3'));
      const similarityThreshold = parseFloat(thresholdRow?.value ?? '0.70');

      // ── Disabled bypass ────────────────────────────────────────────────────
      if (!humanizerEnabled) {
        await setHumanized(db, draft_id, draft.content);
        await dispatchToPublish(env, draft_id);
        await recordJob(db, draft_id, draft.id, 'skipped', 0, Date.now() - start);
        logEvent(env, { event: 'humanizer_fallback', stage: 'humanizer', article_id: draft_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'fallback', reason: 'disabled' });
        msg.ack();
        continue;
      }

      // ── Fetch active humanizer prompt ──────────────────────────────────────
      const promptRow = await db
        .prepare("SELECT id, version, system_prompt, user_prompt_template FROM prompts WHERE stage = 'humanizer' AND is_active = 1")
        .first<PromptRow>();

      if (!promptRow) {
        console.error('[humanizer] No active humanizer prompt found for draft:', draft_id);
        await db
          .prepare(`UPDATE drafts SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?`)
          .bind(JSON.stringify({ check: 'humanizer_prompt', error: 'No active humanizer prompt found' }), draft_id)
          .run();
        logEvent(env, { event: 'humanizer_fallback', stage: 'humanizer', article_id: draft_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'failure', reason: 'prompt_missing' });
        msg.ack();
        continue;
      }

      // ── Token budget check ─────────────────────────────────────────────────
      const estimatedTokens = 2000;
      try {
        await checkTokenBudget(db, estimatedTokens);
      } catch (e) {
        if (e instanceof BudgetExceededError) {
          await setHumanized(db, draft_id, draft.content);
          await dispatchToPublish(env, draft_id);
          await recordJob(db, draft_id, promptRow.id, 'fallback', 0, Date.now() - start);
          logEvent(env, { event: 'humanizer_fallback', stage: 'humanizer', article_id: draft_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'fallback', reason: 'budget_exceeded' });
          msg.ack();
          continue;
        }
        throw e;
      }

      // ── Extract locked regions ─────────────────────────────────────────────
      const { stripped, regions } = extractLockedRegions(draft.content);

      // ── Claude API call ────────────────────────────────────────────────────
      const ai = createAIClient(env);
      const userPrompt = promptRow.user_prompt_template.replace('{{content}}', stripped);

      let claudeResult: { text: string; inputTokens: number; outputTokens: number };
      try {
        claudeResult = await ai.generate({
          system: promptRow.system_prompt,
          user: userPrompt,
          model: 'claude-haiku-4-5-20251001',
          maxTokens: 8000,
          temperature,
        });
      } catch (e) {
        // Use safeErrorMessage to prevent API key or provider details leaking into logs
        console.error('[humanizer] Claude API error:', safeErrorMessage(e));
        // Fall back to original on API error
        await setHumanized(db, draft_id, draft.content);
        await dispatchToPublish(env, draft_id);
        await recordJob(db, draft_id, promptRow.id, 'fallback', 0, Date.now() - start, safeErrorMessage(e));
        logEvent(env, { event: 'humanizer_fallback', stage: 'humanizer', article_id: draft_id, tokens_used: 0, duration_ms: Date.now() - start, quality_score: 0, outcome: 'fallback', reason: 'api_error' });
        msg.ack();
        continue;
      }

      const tokensUsed = claudeResult.inputTokens + claudeResult.outputTokens;
      await incrementTokensUsed(db, tokensUsed);

      // ── Restore locked regions ─────────────────────────────────────────────
      const restored = restoreLockedRegions(claudeResult.text, regions);
      if (restored === null) {
        console.warn('[humanizer] Placeholder missing in Claude response, falling back:', draft_id);
        logEvent(env, { event: 'regression_detected', stage: 'humanizer', article_id: draft_id, tokens_used: tokensUsed, duration_ms: Date.now() - start, quality_score: 0, outcome: 'fallback', failed_gate: 'placeholder_missing' });
        logEvent(env, { event: 'humanizer_fallback', stage: 'humanizer', article_id: draft_id, tokens_used: tokensUsed, duration_ms: Date.now() - start, quality_score: 0, outcome: 'fallback', reason: 'regression' });
        await setHumanized(db, draft_id, draft.content);
        await dispatchToPublish(env, draft_id);
        await recordJob(db, draft_id, promptRow.id, 'fallback', tokensUsed, Date.now() - start, 'placeholder_missing');
        msg.ack();
        continue;
      }

      // ── Semantic regression gates ──────────────────────────────────────────
      const regressionResult = detectRegression(draft.content, restored, similarityThreshold);
      if (!regressionResult.passed) {
        console.warn('[humanizer] Regression detected:', regressionResult.failed_gate, 'for draft:', draft_id);
        logEvent(env, { event: 'regression_detected', stage: 'humanizer', article_id: draft_id, tokens_used: tokensUsed, duration_ms: Date.now() - start, quality_score: 0, outcome: 'fallback', failed_gate: regressionResult.failed_gate ?? undefined });
        logEvent(env, { event: 'humanizer_fallback', stage: 'humanizer', article_id: draft_id, tokens_used: tokensUsed, duration_ms: Date.now() - start, quality_score: 0, outcome: 'fallback', reason: 'regression' });
        await setHumanized(db, draft_id, draft.content);
        await dispatchToPublish(env, draft_id);
        await recordJob(db, draft_id, promptRow.id, 'fallback', tokensUsed, Date.now() - start, regressionResult.failed_gate ?? undefined);
        msg.ack();
        continue;
      }

      // ── Fabricated numeric check ───────────────────────────────────────────
      if (checkNewNumerics(draft.content, restored)) {
        console.warn('[humanizer] Fabricated numerics detected, falling back:', draft_id);
        logEvent(env, { event: 'regression_detected', stage: 'humanizer', article_id: draft_id, tokens_used: tokensUsed, duration_ms: Date.now() - start, quality_score: 0, outcome: 'fallback', failed_gate: 'compliance_entity' });
        logEvent(env, { event: 'humanizer_fallback', stage: 'humanizer', article_id: draft_id, tokens_used: tokensUsed, duration_ms: Date.now() - start, quality_score: 0, outcome: 'fallback', reason: 'regression' });
        await setHumanized(db, draft_id, draft.content);
        await dispatchToPublish(env, draft_id);
        await recordJob(db, draft_id, promptRow.id, 'fallback', tokensUsed, Date.now() - start, 'fabricated_numeric');
        msg.ack();
        continue;
      }

      // ── Quality score comparison ───────────────────────────────────────────
      let fm: Record<string, unknown> = {};
      try { fm = JSON.parse(draft.frontmatter_json) as Record<string, unknown>; } catch { /**/ }

      const originalScore = (() => {
        try {
          const r = JSON.parse(draft.quality_report_json ?? '{}') as { scores?: { readability?: number } };
          return r.scores?.readability ?? 0;
        } catch { return 0; }
      })();

      const humanizedReport = scoreArticle(restored, fm);
      const humanizedScore = humanizedReport.scores.readability;

      if (humanizedScore < originalScore) {
        console.warn('[humanizer] Humanized score regressed:', humanizedScore, '<', originalScore, '— falling back');
        logEvent(env, { event: 'humanizer_fallback', stage: 'humanizer', article_id: draft_id, tokens_used: tokensUsed, duration_ms: Date.now() - start, quality_score: originalScore, outcome: 'fallback', reason: 'regression' });
        await setHumanized(db, draft_id, draft.content);
        await dispatchToPublish(env, draft_id);
        await recordJob(db, draft_id, promptRow.id, 'fallback', tokensUsed, Date.now() - start, 'score_regression');
        msg.ack();
        continue;
      }

      // ── Accept humanized content ───────────────────────────────────────────
      const duration = Date.now() - start;
      await setHumanized(db, draft_id, restored);
      await dispatchToPublish(env, draft_id);
      await recordJob(db, draft_id, promptRow.id, 'humanized', tokensUsed, duration);

      logEvent(env, { event: 'humanizer_success', stage: 'humanizer', article_id: draft_id, tokens_used: tokensUsed, duration_ms: duration, quality_score: humanizedScore, outcome: 'success' });
      console.log('[humanizer] Accepted humanized content for draft:', draft_id, 'score:', humanizedScore.toFixed(1));

      msg.ack();
    }
  },
};

async function setHumanized(db: D1Database, draftId: string, content: string): Promise<void> {
  await db
    .prepare(`UPDATE drafts SET content = ?, humanized_at = datetime('now'), status = 'humanized', updated_at = datetime('now') WHERE id = ?`)
    .bind(content, draftId)
    .run();
}

async function dispatchToPublish(env: Env, draftId: string): Promise<void> {
  await env.BLOG_PUBLISH_QUEUE.send({ draft_id: draftId });
}

async function recordJob(
  db: D1Database,
  draftId: string,
  promptIdOrRef: string,
  outcome: string,
  tokensUsed: number,
  durationMs: number,
  error?: string,
): Promise<void> {
  const inputHash = await computeInputHash({ draft_id: draftId, prompt_ref: promptIdOrRef });
  const jobId = generateId();
  await db
    .prepare('INSERT OR IGNORE INTO humanizer_jobs (id, draft_id, input_hash, outcome, tokens_used, duration_ms, error) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(jobId, draftId, inputHash, outcome, tokensUsed, durationMs, error ?? null)
    .run();
}
