import { describe, it, expect } from 'vitest';
import { createTestDb, applyFixtures } from '../test-helpers/d1';
import { checkEmergencyStop, checkCircuitBreaker, budgetAllowsEnqueue, EmergencyStopError, CircuitBreakerError } from './safety';
import { generateId } from './queue';

// ── checkEmergencyStop ────────────────────────────────────────────────────────

describe('checkEmergencyStop', () => {
  it('does not throw when pipeline_emergency_stop is false', async () => {
    const db = createTestDb();
    applyFixtures(db); // seeds pipeline_emergency_stop = 'false'
    await expect(checkEmergencyStop(db)).resolves.not.toThrow();
  });

  it('throws EmergencyStopError when pipeline_emergency_stop is true', async () => {
    const db = createTestDb();
    applyFixtures(db);
    await db.prepare("UPDATE settings SET value = 'true' WHERE key = 'pipeline_emergency_stop'").run();
    await expect(checkEmergencyStop(db)).rejects.toThrow(EmergencyStopError);
  });

  it('does not throw when setting is absent (defaults to off)', async () => {
    const db = createTestDb();
    applyFixtures(db);
    await db.prepare("DELETE FROM settings WHERE key = 'pipeline_emergency_stop'").run();
    await expect(checkEmergencyStop(db)).resolves.not.toThrow();
  });
});

// ── checkCircuitBreaker ───────────────────────────────────────────────────────

describe('checkCircuitBreaker', () => {
  async function insertJob(db: D1Database, stage: string, status: string) {
    const id = await generateId();
    await db
      .prepare("INSERT INTO generation_jobs (id, stage, status, input_hash, stage_payload) VALUES (?, ?, ?, ?, '{}')")
      .bind(id, stage, status, id)
      .run();
  }

  it('does not throw when fewer than 5 jobs in window', async () => {
    const db = createTestDb();
    applyFixtures(db);
    // Insert 4 failed jobs — below the minimum to trigger breaker
    for (let i = 0; i < 4; i++) await insertJob(db, 'article-generation', 'failed');
    await expect(checkCircuitBreaker(db, 'article-generation')).resolves.not.toThrow();
  });

  it('does not throw when failure rate is below threshold', async () => {
    const db = createTestDb();
    applyFixtures(db);
    // 5 jobs, 2 failed = 40% — below 50% threshold
    for (let i = 0; i < 3; i++) await insertJob(db, 'article-generation', 'done');
    for (let i = 0; i < 2; i++) await insertJob(db, 'article-generation', 'failed');
    await expect(checkCircuitBreaker(db, 'article-generation')).resolves.not.toThrow();
  });

  it('throws CircuitBreakerError when ≥5 jobs and ≥50% failed', async () => {
    const db = createTestDb();
    applyFixtures(db);
    // 5 jobs, 5 failed = 100%
    for (let i = 0; i < 5; i++) await insertJob(db, 'article-generation', 'failed');
    await expect(checkCircuitBreaker(db, 'article-generation')).rejects.toThrow(CircuitBreakerError);
  });

  it('is scoped to stage — humanizer failures do not trip article-generation breaker', async () => {
    const db = createTestDb();
    applyFixtures(db);
    for (let i = 0; i < 10; i++) await insertJob(db, 'humanizer', 'failed');
    await expect(checkCircuitBreaker(db, 'article-generation')).resolves.not.toThrow();
  });
});

// ── budgetAllowsEnqueue ───────────────────────────────────────────────────────

describe('budgetAllowsEnqueue', () => {
  it('returns true when tokens are available', async () => {
    const db = createTestDb();
    applyFixtures(db); // daily_token_cap=200000, tokens_used_today=0
    const allowed = await budgetAllowsEnqueue(db, 1500, 'outline-generation');
    expect(allowed).toBe(true);
  });

  it('returns false when budget is exhausted', async () => {
    const db = createTestDb();
    applyFixtures(db);
    await db.prepare("UPDATE settings SET value = '199999' WHERE key = 'tokens_used_today'").run();
    const allowed = await budgetAllowsEnqueue(db, 1500, 'outline-generation');
    expect(allowed).toBe(false);
  });
});
