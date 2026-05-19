export type PipelineOutcome = 'success' | 'failure' | 'skipped' | 'fallback';

export interface PipelineEvent {
  event: string;
  stage: string;
  article_id: string;
  tokens_used: number;
  duration_ms: number;
  quality_score: number;
  outcome: PipelineOutcome;
  reason?: string;
  failed_gate?: string;
}

interface AnalyticsEnv {
  BLOG_ANALYTICS?: AnalyticsEngineDataset;
}

export function logEvent(env: AnalyticsEnv, event: PipelineEvent): void {
  try {
    if (!env.BLOG_ANALYTICS) return;
    env.BLOG_ANALYTICS.writeDataPoint({
      blobs: [
        event.event,
        event.stage,
        event.article_id,
        event.outcome,
        event.reason ?? '',
        event.failed_gate ?? '',
      ],
      doubles: [
        event.tokens_used,
        event.duration_ms,
        event.quality_score,
      ],
      indexes: [event.article_id],
    });
  } catch {
    // silently no-op — telemetry must never break the pipeline
  }
}
