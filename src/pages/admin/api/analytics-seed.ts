import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

// Staging-only endpoint. Writes a deterministic batch of synthetic Analytics Engine
// events so the dashboard can be verified without waiting for real pipeline traffic.
//
// Protected by STAGING_SEED_TOKEN — a separate secret that MUST NOT be provisioned
// in production. If STAGING_SEED_TOKEN is absent, this endpoint returns 404.
//
// Usage:
//   curl -X POST https://<staging-host>/admin/api/analytics-seed \
//     -H "Authorization: Bearer <ADMIN_TOKEN>" \
//     -H "X-Seed-Token: <STAGING_SEED_TOKEN>"

interface SeedEnv {
  ANALYTICS_ENABLED?: string;
  STAGING_SEED_TOKEN?: string;
  BLOG_ANALYTICS?: AnalyticsEngineDataset;
}

// One synthetic event written to Analytics Engine.
// Mirrors the PipelineEvent shape from src/lib/analytics.ts exactly.
interface SeedEvent {
  event: string;
  stage: string;
  article_id: string;
  outcome: 'success' | 'failure' | 'skipped' | 'fallback';
  reason: string;
  failed_gate: string;
  tokens_used: number;
  duration_ms: number;
  quality_score: number;
}

function write(ae: AnalyticsEngineDataset, e: SeedEvent): void {
  ae.writeDataPoint({
    blobs: [e.event, e.stage, e.article_id, e.outcome, e.reason, e.failed_gate],
    doubles: [e.tokens_used, e.duration_ms, e.quality_score],
    indexes: [e.article_id],
  });
}

// Deterministic seed corpus — covers every dashboard scenario.
// IDs use the prefix "seed-" so they are identifiable in the failure table.
const SEED_EVENTS: SeedEvent[] = [
  // --- Normal pipeline run (all stages succeed) ---
  { event: 'pipeline_stage', stage: 'topic-discovery',    article_id: 'seed-aaa00001', outcome: 'success',  reason: '', failed_gate: '', tokens_used: 312,  duration_ms: 820,  quality_score: 0 },
  { event: 'pipeline_stage', stage: 'outline-generation', article_id: 'seed-aaa00001', outcome: 'success',  reason: '', failed_gate: '', tokens_used: 890,  duration_ms: 1540, quality_score: 0 },
  { event: 'pipeline_stage', stage: 'article-generation', article_id: 'seed-aaa00001', outcome: 'success',  reason: '', failed_gate: '', tokens_used: 4200, duration_ms: 8300, quality_score: 0.84 },
  { event: 'pipeline_stage', stage: 'humanizer',          article_id: 'seed-aaa00001', outcome: 'success',  reason: '', failed_gate: '', tokens_used: 1800, duration_ms: 3100, quality_score: 0.88 },
  { event: 'pipeline_stage', stage: 'publisher',          article_id: 'seed-aaa00001', outcome: 'success',  reason: '', failed_gate: '', tokens_used: 0,    duration_ms: 420,  quality_score: 0 },

  // --- Second successful run ---
  { event: 'pipeline_stage', stage: 'topic-discovery',    article_id: 'seed-aaa00002', outcome: 'success',  reason: '', failed_gate: '', tokens_used: 290,  duration_ms: 710,  quality_score: 0 },
  { event: 'pipeline_stage', stage: 'outline-generation', article_id: 'seed-aaa00002', outcome: 'success',  reason: '', failed_gate: '', tokens_used: 940,  duration_ms: 1620, quality_score: 0 },
  { event: 'pipeline_stage', stage: 'article-generation', article_id: 'seed-aaa00002', outcome: 'success',  reason: '', failed_gate: '', tokens_used: 3900, duration_ms: 7800, quality_score: 0.81 },
  { event: 'pipeline_stage', stage: 'humanizer',          article_id: 'seed-aaa00002', outcome: 'success',  reason: '', failed_gate: '', tokens_used: 1600, duration_ms: 2900, quality_score: 0.86 },
  { event: 'pipeline_stage', stage: 'publisher',          article_id: 'seed-aaa00002', outcome: 'success',  reason: '', failed_gate: '', tokens_used: 0,    duration_ms: 390,  quality_score: 0 },

  // --- Quality gate failure (article-generation) ---
  { event: 'pipeline_stage', stage: 'article-generation', article_id: 'seed-bbb00001', outcome: 'failure',
    reason: 'quality score 0.61 below threshold 0.80', failed_gate: 'quality_score', tokens_used: 4100, duration_ms: 8100, quality_score: 0.61 },

  // --- Semantic regression failure (humanizer) ---
  { event: 'pipeline_stage', stage: 'humanizer', article_id: 'seed-bbb00002', outcome: 'failure',
    reason: 'Jaccard similarity 0.52 below threshold 0.70', failed_gate: 'semantic_regression', tokens_used: 1750, duration_ms: 3200, quality_score: 0.82 },

  // --- Publisher failure (GitHub API error) ---
  { event: 'pipeline_stage', stage: 'publisher', article_id: 'seed-bbb00003', outcome: 'failure',
    reason: 'GitHub API returned 422: file already exists at path', failed_gate: 'github_push', tokens_used: 0, duration_ms: 1200, quality_score: 0 },

  // --- Publisher failure streak (3 consecutive) — triggers crit indicator ---
  { event: 'pipeline_stage', stage: 'publisher', article_id: 'seed-bbb00004', outcome: 'failure',
    reason: 'GitHub API 503 Service Unavailable', failed_gate: 'github_push', tokens_used: 0, duration_ms: 5100, quality_score: 0 },
  { event: 'pipeline_stage', stage: 'publisher', article_id: 'seed-bbb00005', outcome: 'failure',
    reason: 'GitHub API 503 Service Unavailable', failed_gate: 'github_push', tokens_used: 0, duration_ms: 5200, quality_score: 0 },

  // --- Humanizer fallbacks (3 in the same hour) — triggers fallback spike ---
  { event: 'pipeline_stage', stage: 'humanizer', article_id: 'seed-ccc00001', outcome: 'fallback',
    reason: 'heading count mismatch after humanization', failed_gate: 'heading_gate', tokens_used: 1600, duration_ms: 2800, quality_score: 0.79 },
  { event: 'pipeline_stage', stage: 'humanizer', article_id: 'seed-ccc00002', outcome: 'fallback',
    reason: 'compliance entity removed during humanization', failed_gate: 'compliance_gate', tokens_used: 1700, duration_ms: 2900, quality_score: 0.77 },
  { event: 'pipeline_stage', stage: 'humanizer', article_id: 'seed-ccc00003', outcome: 'fallback',
    reason: 'fabricated numeric detected in humanized output', failed_gate: 'numerics_gate', tokens_used: 1550, duration_ms: 2750, quality_score: 0.80 },

  // --- High-token events (24h spike simulation — written after baseline) ---
  { event: 'pipeline_stage', stage: 'article-generation', article_id: 'seed-ddd00001', outcome: 'success',
    reason: '', failed_gate: '', tokens_used: 12000, duration_ms: 22000, quality_score: 0.85 },
  { event: 'pipeline_stage', stage: 'article-generation', article_id: 'seed-ddd00002', outcome: 'success',
    reason: '', failed_gate: '', tokens_used: 11500, duration_ms: 21000, quality_score: 0.83 },

  // --- Skipped event (daily cap reached) ---
  { event: 'pipeline_stage', stage: 'topic-discovery', article_id: 'seed-eee00001', outcome: 'skipped',
    reason: 'daily token cap reached', failed_gate: '', tokens_used: 0, duration_ms: 5, quality_score: 0 },

  // --- Long reason string (tests 500-char truncation in dashboard) ---
  { event: 'pipeline_stage', stage: 'article-generation', article_id: 'seed-fff00001', outcome: 'failure',
    failed_gate: 'quality_score',
    reason: 'quality score 0.55 below threshold 0.80 — ' + 'x'.repeat(520),
    tokens_used: 3800, duration_ms: 7600, quality_score: 0.55 },
];

export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as SeedEnv;

  // Double gate: requires both ANALYTICS_ENABLED and STAGING_SEED_TOKEN
  const seedToken = cfEnv.STAGING_SEED_TOKEN;
  if (!seedToken || cfEnv.ANALYTICS_ENABLED !== 'true') {
    return new Response('Not Found', { status: 404 });
  }

  // Validate seed token from request header
  const providedToken = request.headers.get('X-Seed-Token') ?? '';
  if (providedToken !== seedToken) {
    return new Response(JSON.stringify({ error: 'Invalid seed token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const ae = cfEnv.BLOG_ANALYTICS;
  if (!ae) {
    return new Response(JSON.stringify({ error: 'BLOG_ANALYTICS binding not available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  let written = 0;
  const errors: string[] = [];

  for (const event of SEED_EVENTS) {
    try {
      write(ae, event);
      written++;
    } catch (err) {
      errors.push(`${event.article_id}/${event.stage}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return new Response(
    JSON.stringify({
      written,
      total: SEED_EVENTS.length,
      errors: errors.length > 0 ? errors : undefined,
      note: 'Analytics Engine has ~1 minute ingestion lag. Wait before querying the dashboard.',
      scenarios_seeded: [
        '2 full successful pipeline runs (all 5 stages)',
        '3 failure events across article-generation, humanizer, publisher',
        '3 consecutive publisher failures → publish_failure_streak crit indicator',
        '3 humanizer fallbacks in same hour → fallback_spike warn indicator',
        '2 high-token events → token_spike warn indicator (vs 7d baseline)',
        '1 skipped event (daily cap)',
        '1 oversized reason string → truncation verification',
      ],
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
};
