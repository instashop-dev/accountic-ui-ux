import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { ADMIN_SECURITY_HEADERS } from '../../../lib/admin-security';

export const prerender = false;

const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  ...ADMIN_SECURITY_HEADERS,
};

function errResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 200,
    headers: SECURITY_HEADERS,
  });
}

interface AeRow {
  [key: string]: string | number | null;
}

interface AeResult {
  data: AeRow[];
}

async function aeQuery(sql: string, token: string, accountId: string): Promise<AeRow[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
      body: sql,
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Analytics Engine error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as AeResult;
  return json.data ?? [];
}

export interface AnalyticsData {
  total_events: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  fallback_count: number;
  avg_tokens_used: number;
  avg_duration_ms: number;
  avg_quality_score: number;
  by_stage: { stage: string; total: number; failures: number }[];
  recent_failures: { article_id: string; stage: string; failed_gate: string; reason: string; ts: string }[];
  last_publish_ts: string | null;
  fallback_spike: { detected: boolean; max_hourly: number; hour: string | null };
  token_spike: { detected: boolean; avg_24h: number; avg_7d: number };
  publish_failure_streak: number;
  queue_backlog_age_mins: number | null;
}

export const GET: APIRoute = async () => {
  try {
    const cfEnv = env as unknown as {
      ANALYTICS_ENABLED?: string;
      CF_API_TOKEN?: string;
      CF_ACCOUNT_ID?: string;
      BLOG_DB?: D1Database;
    };

    // Staging gate: inactive unless ANALYTICS_ENABLED='true'
    if (cfEnv.ANALYTICS_ENABLED !== 'true') {
      return new Response('Not Found', { status: 404 });
    }

    const token = cfEnv.CF_API_TOKEN;
    const accountId = cfEnv.CF_ACCOUNT_ID;

    if (!token || !accountId) {
      return errResponse('Analytics Engine not configured — set CF_API_TOKEN and CF_ACCOUNT_ID as Wrangler secrets');
    }

    const ae = (sql: string) => aeQuery(sql, token, accountId);
    const W7 = `timestamp > NOW() - INTERVAL '7' DAY`;
    const W1 = `timestamp > NOW() - INTERVAL '1' DAY`;

    const [
      summaryRows,
      stageRows,
      failureRows,
      lastPublishRows,
      tokens7dRows,
      tokens24hRows,
      fallbackHourRows,
      streakRows,
    ] = await Promise.all([
      ae(`SELECT
            count() AS total,
            countIf(blob4='success') AS success_count,
            countIf(blob4='failure') AS failure_count,
            countIf(blob4='skipped') AS skipped_count,
            countIf(blob4='fallback') AS fallback_count,
            avg(double1) AS avg_tokens,
            avg(double2) AS avg_duration,
            avg(double3) AS avg_quality
          FROM "blog-pipeline-events"
          WHERE ${W7}`),
      ae(`SELECT
            blob2 AS stage,
            count() AS total,
            countIf(blob4='failure') AS failures
          FROM "blog-pipeline-events"
          WHERE ${W7}
          GROUP BY blob2
          ORDER BY total DESC`),
      ae(`SELECT
            blob3 AS article_id,
            blob2 AS stage,
            blob6 AS failed_gate,
            blob5 AS reason,
            timestamp AS ts
          FROM "blog-pipeline-events"
          WHERE blob4='failure' AND ${W7}
          ORDER BY ts DESC
          LIMIT 20`),
      ae(`SELECT
            max(timestamp) AS last_ts
          FROM "blog-pipeline-events"
          WHERE blob2='publisher' AND blob4='success' AND ${W7}`),
      ae(`SELECT avg(double1) AS avg_tokens FROM "blog-pipeline-events" WHERE ${W7}`),
      ae(`SELECT avg(double1) AS avg_tokens FROM "blog-pipeline-events" WHERE ${W1}`),
      ae(`SELECT
            toStartOfHour(timestamp) AS hour,
            count() AS cnt
          FROM "blog-pipeline-events"
          WHERE blob4='fallback' AND ${W7}
          GROUP BY hour
          ORDER BY cnt DESC
          LIMIT 1`),
      ae(`SELECT blob4 AS outcome, timestamp
          FROM "blog-pipeline-events"
          WHERE blob2='publisher' AND ${W7}
          ORDER BY timestamp DESC
          LIMIT 10`),
    ]);

    // Summary metrics
    const s = summaryRows[0] ?? {};
    const total = Number(s.total ?? 0);
    const successCount = Number(s.success_count ?? 0);
    const failureCount = Number(s.failure_count ?? 0);
    const skippedCount = Number(s.skipped_count ?? 0);
    const fallbackCount = Number(s.fallback_count ?? 0);
    const avgTokens = Number(s.avg_tokens ?? 0);
    const avgDuration = Number(s.avg_duration ?? 0);
    const avgQuality = Number(s.avg_quality ?? 0);

    // Per-stage breakdown
    const byStage = stageRows.map((r) => ({
      stage: String(r.stage ?? ''),
      total: Number(r.total ?? 0),
      failures: Number(r.failures ?? 0),
    }));

    // Recent failures — truncate reason at 500 chars
    const recentFailures = failureRows.map((r) => {
      const reason = String(r.reason ?? '');
      return {
        article_id: String(r.article_id ?? '').slice(0, 8),
        stage: String(r.stage ?? ''),
        failed_gate: String(r.failed_gate ?? ''),
        reason: reason.length > 500 ? reason.slice(0, 500) + '…' : reason,
        ts: String(r.ts ?? ''),
      };
    });

    // Last successful publish
    const lastPublishTs = lastPublishRows[0]?.last_ts
      ? String(lastPublishRows[0].last_ts)
      : null;

    // Token spike detection
    const avg7d = Number(tokens7dRows[0]?.avg_tokens ?? 0);
    const avg24h = Number(tokens24hRows[0]?.avg_tokens ?? 0);
    const tokenSpike = {
      detected: avg7d > 0 && avg24h > avg7d * 2,
      avg_24h: Math.round(avg24h),
      avg_7d: Math.round(avg7d),
    };

    // Fallback spike detection (≥3 in any 1-hour window)
    const maxHourly = Number(fallbackHourRows[0]?.cnt ?? 0);
    const fallbackSpike = {
      detected: maxHourly >= 3,
      max_hourly: maxHourly,
      hour: fallbackHourRows[0]?.hour ? String(fallbackHourRows[0].hour) : null,
    };

    // Publish failure streak (consecutive failures at tail)
    let streak = 0;
    for (const row of streakRows) {
      if (row.outcome === 'failure') {
        streak++;
      } else {
        break;
      }
    }

    // Queue backlog age from D1 (oldest unprocessed draft)
    let queueBacklogAgeMins: number | null = null;
    const db = cfEnv.BLOG_DB;
    if (db) {
      try {
        const result = await db
          .prepare(
            `SELECT min(created_at) AS oldest FROM drafts WHERE status IN ('ready','humanized')`,
          )
          .first<{ oldest: string | null }>();
        if (result?.oldest) {
          const ageMs = Date.now() - new Date(result.oldest).getTime();
          queueBacklogAgeMins = Math.round(ageMs / 60_000);
        }
      } catch {
        // D1 failure is non-fatal for analytics
      }
    }

    const data: AnalyticsData = {
      total_events: total,
      success_count: successCount,
      failure_count: failureCount,
      skipped_count: skippedCount,
      fallback_count: fallbackCount,
      avg_tokens_used: Math.round(avgTokens),
      avg_duration_ms: Math.round(avgDuration),
      avg_quality_score: Number(avgQuality.toFixed(3)),
      by_stage: byStage,
      recent_failures: recentFailures,
      last_publish_ts: lastPublishTs,
      fallback_spike: fallbackSpike,
      token_spike: tokenSpike,
      publish_failure_streak: streak,
      queue_backlog_age_mins: queueBacklogAgeMins,
    };

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: SECURITY_HEADERS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.includes('timed out') || (err instanceof Error && err.name === 'TimeoutError');
    return errResponse(isTimeout ? 'Analytics Engine query timed out' : `Analytics query failed: ${message}`);
  }
};
