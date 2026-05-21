/**
 * Migration tests for 008_expand_pillars.sql / 008_rollback.sql
 *
 * Uses a custom migration stack without test-fixtures (fixtures add a v99 prompt
 * with is_active=1 which would inflate active-prompt counts).
 */
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../../test-helpers/d1';

const BASE_MIGRATIONS = [
  'migrations/001_init.sql',
  'migrations/002_pipeline.sql',
  'migrations/003_phase3_hardening.sql',
  'migrations/004_humanizer.sql',
  'migrations/007_coverage_brief.sql',
];

const WITH_008 = [...BASE_MIGRATIONS, 'migrations/008_expand_pillars.sql'];
const WITH_008_ROLLBACK = [...WITH_008, 'migrations/008_rollback.sql'];

const NEW_PILLARS = ['CA Firm Automation', 'AI Tools for Indian CAs', 'GST Automation', 'Audit Technology'];

describe('migration 008_expand_pillars', () => {
  it('6.1 — exactly 1 active topic-discovery prompt after migration', async () => {
    const db = createTestDb(WITH_008);
    const row = await db
      .prepare("SELECT COUNT(*) as cnt FROM prompts WHERE stage = 'topic-discovery' AND is_active = 1")
      .first<{ cnt: number }>();
    expect(row?.cnt).toBe(1);
  });

  it('6.2 — active topic-discovery prompt contains all 4 new pillar names', async () => {
    const db = createTestDb(WITH_008);
    const row = await db
      .prepare("SELECT user_prompt_template FROM prompts WHERE stage = 'topic-discovery' AND is_active = 1")
      .first<{ user_prompt_template: string }>();
    for (const pillar of NEW_PILLARS) {
      expect(row?.user_prompt_template).toContain(pillar);
    }
  });

  it('6.3 — active topic-discovery prompt does NOT contain "Firm Operations"', async () => {
    const db = createTestDb(WITH_008);
    const row = await db
      .prepare("SELECT user_prompt_template, system_prompt FROM prompts WHERE stage = 'topic-discovery' AND is_active = 1")
      .first<{ user_prompt_template: string; system_prompt: string }>();
    expect(row?.user_prompt_template).not.toContain('Firm Operations');
    expect(row?.system_prompt).not.toContain('Firm Operations');
  });

  it('6.4 — active topic-discovery prompt retains {{coverage_brief}} and {{count}} placeholders', async () => {
    const db = createTestDb(WITH_008);
    const row = await db
      .prepare("SELECT user_prompt_template FROM prompts WHERE stage = 'topic-discovery' AND is_active = 1")
      .first<{ user_prompt_template: string }>();
    expect(row?.user_prompt_template).toContain('{{coverage_brief}}');
    expect(row?.user_prompt_template).toContain('{{count}}');
  });

  it('6.5 — exactly 1 active article-generation prompt after migration', async () => {
    const db = createTestDb(WITH_008);
    const row = await db
      .prepare("SELECT COUNT(*) as cnt FROM prompts WHERE stage = 'article-generation' AND is_active = 1")
      .first<{ cnt: number }>();
    expect(row?.cnt).toBe(1);
  });

  it('6.6 — active article-generation prompt contains all 4 new pillar names', async () => {
    const db = createTestDb(WITH_008);
    const row = await db
      .prepare("SELECT system_prompt FROM prompts WHERE stage = 'article-generation' AND is_active = 1")
      .first<{ system_prompt: string }>();
    for (const pillar of NEW_PILLARS) {
      expect(row?.system_prompt).toContain(pillar);
    }
  });

  it('6.7 — rollback: topic-discovery v2 is active, v3 is inactive', async () => {
    const db = createTestDb(WITH_008_ROLLBACK);
    const v2 = await db
      .prepare("SELECT is_active FROM prompts WHERE id = 'prompt-topic-discovery-v2'")
      .first<{ is_active: number }>();
    const v3 = await db
      .prepare("SELECT is_active FROM prompts WHERE id = 'prompt-topic-discovery-v3'")
      .first<{ is_active: number }>();
    expect(v2?.is_active).toBe(1);
    expect(v3?.is_active).toBe(0);
  });

  it('6.8 — rollback: article-generation v1 is active, v2 is inactive', async () => {
    const db = createTestDb(WITH_008_ROLLBACK);
    const v1 = await db
      .prepare("SELECT is_active FROM prompts WHERE id = 'prompt-article-generation-v1'")
      .first<{ is_active: number }>();
    const v2 = await db
      .prepare("SELECT is_active FROM prompts WHERE id = 'prompt-article-generation-v2'")
      .first<{ is_active: number }>();
    expect(v1?.is_active).toBe(1);
    expect(v2?.is_active).toBe(0);
  });
});
