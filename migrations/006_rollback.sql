-- Phase 6 rollback — removes refresh_jobs table and new posts columns.
-- SQLite does not support DROP COLUMN before 3.35; wrangler D1 supports it.

DROP INDEX IF EXISTS idx_refresh_jobs_created_at;
DROP INDEX IF EXISTS idx_refresh_jobs_post_id;
DROP TABLE IF EXISTS refresh_jobs;

ALTER TABLE posts DROP COLUMN IF EXISTS refresh_count;
ALTER TABLE posts DROP COLUMN IF EXISTS last_refreshed_at;
