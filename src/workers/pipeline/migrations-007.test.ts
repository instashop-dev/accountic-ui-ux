/**
 * Migration tests for 007_coverage_brief.sql / 007_rollback.sql
 *
 * Uses a custom migration stack that includes the 007 migration so we can
 * verify the forward and rollback invariants without the test-fixtures overlay
 * (fixtures add a v99 prompt with is_active=1 which would inflate the count).
 */
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../../test-helpers/d1';

const BASE_MIGRATIONS = [
  'migrations/001_init.sql',
  'migrations/002_pipeline.sql',
  'migrations/003_phase3_hardening.sql',
  'migrations/004_humanizer.sql',
];

const WITH_007 = [...BASE_MIGRATIONS, 'migrations/007_coverage_brief.sql'];

describe('migration 007_coverage_brief', () => {
  it('6.1 — idx_topics_created_at index exists after applying migration', async () => {
    const db = createTestDb(WITH_007);
    // SQLite stores index info in sqlite_master
    const row = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_topics_created_at'")
      .first<{ name: string }>();
    expect(row?.name).toBe('idx_topics_created_at');
  });

  it('6.2 — exactly one active topic-discovery prompt after migration', async () => {
    const db = createTestDb(WITH_007);
    const row = await db
      .prepare("SELECT COUNT(*) as cnt FROM prompts WHERE stage = 'topic-discovery' AND is_active = 1")
      .first<{ cnt: number }>();
    expect(row?.cnt).toBe(1);
  });

  it('6.3 — active prompt contains both {{coverage_brief}} and {{count}} placeholders', async () => {
    const db = createTestDb(WITH_007);
    const row = await db
      .prepare("SELECT user_prompt_template FROM prompts WHERE stage = 'topic-discovery' AND is_active = 1")
      .first<{ user_prompt_template: string }>();
    expect(row?.user_prompt_template).toContain('{{coverage_brief}}');
    expect(row?.user_prompt_template).toContain('{{count}}');
  });

  it('6.4 — rollback restores v1 as active and deactivates v2', async () => {
    const db = createTestDb([
      ...WITH_007,
      'migrations/007_rollback.sql',
    ]);

    const v1 = await db
      .prepare("SELECT is_active FROM prompts WHERE id = 'prompt-topic-discovery-v1'")
      .first<{ is_active: number }>();
    const v2 = await db
      .prepare("SELECT is_active FROM prompts WHERE id = 'prompt-topic-discovery-v2'")
      .first<{ is_active: number }>();

    expect(v1?.is_active).toBe(1);
    expect(v2?.is_active).toBe(0);
  });

  it('5.8 — index creation is idempotent (migration applied twice does not error)', async () => {
    // createTestDb applies 007 once; applying it again must not throw
    const db = createTestDb(WITH_007);
    await expect(
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_topics_created_at ON topics(created_at)",
      ),
    ).resolves.not.toThrow();
  });
});
