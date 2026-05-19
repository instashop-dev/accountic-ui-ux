import { BudgetExceededError, checkTokenBudget } from './ai';

export class EmergencyStopError extends Error {
  constructor() {
    super('Pipeline emergency stop is active');
    this.name = 'EmergencyStopError';
  }
}

export class CircuitBreakerError extends Error {
  constructor(public readonly stage: string, public readonly failureRate: number) {
    super(`Circuit breaker open: stage=${stage} failure_rate=${failureRate.toFixed(0)}%`);
    this.name = 'CircuitBreakerError';
  }
}

// Reads `pipeline_emergency_stop` from settings. Throws EmergencyStopError if 'true'.
// All pipeline workers call this at the start of each message so the admin can halt
// the entire pipeline without a code deploy.
export async function checkEmergencyStop(db: D1Database): Promise<void> {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind('pipeline_emergency_stop')
    .first<{ value: string }>();
  if (row?.value === 'true') throw new EmergencyStopError();
}

// Checks the recent failure rate in `generation_jobs` for a given stage.
// Throws CircuitBreakerError when ≥5 jobs in the window and ≥50% have failed.
// Use this for AI-heavy stages (article-generation, humanizer) where a prompt
// or API outage can produce a spike of failures that should halt further work.
export async function checkCircuitBreaker(
  db: D1Database,
  stage: string,
  windowMinutes = 60,
  maxFailureRate = 0.5,
): Promise<void> {
  const since = `-${windowMinutes} minutes`;
  const [totalRow, failedRow] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM generation_jobs
         WHERE stage = ? AND created_at > datetime('now', ?)`,
      )
      .bind(stage, since)
      .first<{ count: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM generation_jobs
         WHERE stage = ? AND status = 'failed' AND created_at > datetime('now', ?)`,
      )
      .bind(stage, since)
      .first<{ count: number }>(),
  ]);

  const total = totalRow?.count ?? 0;
  const failed = failedRow?.count ?? 0;

  if (total >= 5 && failed / total >= maxFailureRate) {
    throw new CircuitBreakerError(stage, (failed / total) * 100);
  }
}

// Checks the token budget for a downstream stage before enqueuing its work item.
// Returns false (and logs a warning) if budget is too low; returns true if safe to enqueue.
// Callers should skip the send() call when this returns false.
export async function budgetAllowsEnqueue(
  db: D1Database,
  estimatedTokens: number,
  downstreamStage: string,
): Promise<boolean> {
  try {
    await checkTokenBudget(db, estimatedTokens);
    return true;
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      console.warn(
        `[pipeline] Token budget too low to enqueue ${downstreamStage} work — skipping dispatch`,
      );
      return false;
    }
    throw e;
  }
}
