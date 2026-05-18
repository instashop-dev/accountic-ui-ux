-- Accountic Blog Automation — Phase 3 Hardening Rollback
-- Apply: wrangler d1 execute BLOG_DB --remote --file=migrations/003_rollback.sql
--
-- Reverses 003_phase3_hardening.sql.
-- Column drops require SQLite 3.35+ (supported in Cloudflare D1 as of 2023).
-- Index drops are always safe.
-- Settings rollback restores original weekly_target value and removes daily_target.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Drop indexes — generation_jobs
-- ═══════════════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_generation_jobs_dedup;
DROP INDEX IF EXISTS idx_generation_jobs_created_at;
DROP INDEX IF EXISTS idx_generation_jobs_status;
DROP INDEX IF EXISTS idx_generation_jobs_stage;
DROP INDEX IF EXISTS idx_generation_jobs_post_id;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Drop indexes — posts
-- ═══════════════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_posts_pub_date;
DROP INDEX IF EXISTS idx_posts_status;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Drop columns — generation_jobs
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE generation_jobs DROP COLUMN IF EXISTS prompt_version;
ALTER TABLE generation_jobs DROP COLUMN IF EXISTS provider;
ALTER TABLE generation_jobs DROP COLUMN IF EXISTS model;
ALTER TABLE generation_jobs DROP COLUMN IF EXISTS last_retry_at;
ALTER TABLE generation_jobs DROP COLUMN IF EXISTS retry_count;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Drop columns — posts
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE posts DROP COLUMN IF EXISTS content_version;
ALTER TABLE posts DROP COLUMN IF EXISTS published_commit_sha;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Settings rollback
-- ═══════════════════════════════════════════════════════════════════════════════

DELETE FROM settings WHERE key = 'daily_target';

-- Restore weekly_target to its original seeded value (2)
UPDATE settings
  SET value      = '2',
      updated_at = datetime('now')
  WHERE key = 'weekly_target';
