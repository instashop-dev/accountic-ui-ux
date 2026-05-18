-- Accountic Blog Automation — Phase 3 Hardening
-- Apply:    wrangler d1 execute BLOG_DB --remote --file=migrations/003_phase3_hardening.sql
-- Rollback: wrangler d1 execute BLOG_DB --remote --file=migrations/003_rollback.sql
--
-- Additive only. Does NOT modify 001_init.sql or 002_pipeline.sql.
-- All ALTER TABLE ADD COLUMN statements are safe to run on a live database.
-- All CREATE INDEX statements are idempotent (IF NOT EXISTS).

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. INDEXES — generation_jobs
-- ═══════════════════════════════════════════════════════════════════════════════

-- Supports JOIN to posts and foreign-key lookups
CREATE INDEX IF NOT EXISTS idx_generation_jobs_post_id
  ON generation_jobs(post_id);

-- Supports per-stage queue queries in workers (e.g. "fetch all outline jobs")
CREATE INDEX IF NOT EXISTS idx_generation_jobs_stage
  ON generation_jobs(stage);

-- Supports admin dashboard status filters (pending / running / failed / done)
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status
  ON generation_jobs(status);

-- Supports chronological listing and time-range cleanup queries
CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at
  ON generation_jobs(created_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. INDEXES — posts
-- ═══════════════════════════════════════════════════════════════════════════════
-- Note: posts.slug is covered by the UNIQUE constraint's implicit index — no
-- explicit idx_posts_slug needed.

-- Supports admin and pipeline status filters ('published', 'draft', 'archived')
CREATE INDEX IF NOT EXISTS idx_posts_status
  ON posts(status);

-- Supports refresh scan (ORDER BY pub_date, stale-content detection)
CREATE INDEX IF NOT EXISTS idx_posts_pub_date
  ON posts(pub_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. DEDUPLICATION CONSTRAINT — generation_jobs
-- ═══════════════════════════════════════════════════════════════════════════════
-- Prevents two jobs for the same (stage, input_hash) pair from being inserted
-- concurrently. The pipeline workers rely on this as a secondary idempotency
-- guard alongside the application-level check in article-generation.ts.
--
-- IMPORTANT: input_hash can be NULL (pre-hash stages). The UNIQUE constraint
-- in SQLite treats each NULL as distinct, so NULL rows are never blocked.

CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_jobs_dedup
  ON generation_jobs(stage, input_hash)
  WHERE input_hash IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. RETRY METADATA — generation_jobs
-- ═══════════════════════════════════════════════════════════════════════════════

-- Tracks how many times a job has been retried (Cloudflare Queue retries + manual replays)
ALTER TABLE generation_jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;

-- ISO-8601 timestamp of the most recent retry attempt; NULL on first attempt
ALTER TABLE generation_jobs ADD COLUMN last_retry_at TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. PROVIDER / MODEL / PROMPT METADATA — generation_jobs
-- ═══════════════════════════════════════════════════════════════════════════════
-- Captures which model, provider, and prompt version produced each output.
-- Essential for A/B evaluation, cost attribution, and prompt regression tracing.

-- e.g. 'claude-sonnet-4-6', 'claude-opus-4-7'
ALTER TABLE generation_jobs ADD COLUMN model TEXT;

-- e.g. 'anthropic' — reserved for future multi-provider support
ALTER TABLE generation_jobs ADD COLUMN provider TEXT;

-- Matches prompts.version for the stage prompt used in this run
ALTER TABLE generation_jobs ADD COLUMN prompt_version INTEGER;

-- ── stage_payload safety note ─────────────────────────────────────────────────
-- NOTE: stage_payload (added in 001_init.sql) is intended ONLY for lightweight
-- intermediate metadata (e.g. { "outline_id": "…", "topic_id": "…" }).
-- Large AI outputs (article drafts, full outlines) MUST be written to D1 tables
-- (outlines, drafts) or R2/KV and referenced via output_ref.
-- Storing full article text in stage_payload will cause D1 row-size pressure and
-- will degrade write performance on the generation_jobs table.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. PUBLISH TRACEABILITY — posts
-- ═══════════════════════════════════════════════════════════════════════════════

-- SHA of the GitHub commit that introduced this post. Enables exact rollback:
-- `git revert <sha>` removes the post without a search. NULL for human-authored posts.
ALTER TABLE posts ADD COLUMN published_commit_sha TEXT;

-- Incremented by the refresh worker each time a post is substantively updated.
-- Allows consumers (admin dashboard, analytics) to detect stale cached versions.
-- Starts at 1 for all existing rows (DEFAULT applies on ALTER TABLE ADD COLUMN).
ALTER TABLE posts ADD COLUMN content_version INTEGER NOT NULL DEFAULT 1;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. SETTINGS — fix daily_target naming
-- ═══════════════════════════════════════════════════════════════════════════════
-- 001_init.sql seeded `weekly_target = '2'`, which is misleading.
-- The pipeline targets 2 articles/day, not 2 articles/week.
-- We introduce `daily_target = '2'` as the canonical key and preserve
-- `weekly_target` (renamed semantics: now stores the derived weekly total = 14)
-- for any tooling that may already reference it.

INSERT OR IGNORE INTO settings (key, value) VALUES ('daily_target', '2');

-- Recalculate weekly_target to its correct derived value (daily_target × 7).
-- Uses INSERT OR IGNORE + UPDATE pattern to be safe on re-run.
UPDATE settings
  SET value      = '14',
      updated_at = datetime('now')
  WHERE key = 'weekly_target'
    AND value = '2';
-- Guard: if operator already set a custom weekly_target, leave it untouched.
-- The canonical schedule target is now `daily_target`.
