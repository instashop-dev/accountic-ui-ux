-- Accountic Blog Automation — Phase 4 Humanizer Rollback
-- Apply: wrangler d1 execute BLOG_DB --remote --file=migrations/004_rollback.sql
--
-- Reverses 004_humanizer.sql. Does NOT touch Phase 2/3 tables.

DROP INDEX IF EXISTS idx_humanizer_jobs_draft_id;
DROP TABLE IF EXISTS humanizer_jobs;

ALTER TABLE drafts DROP COLUMN IF EXISTS internal_links_added;
ALTER TABLE drafts DROP COLUMN IF EXISTS humanized_at;

DELETE FROM prompts WHERE stage = 'humanizer';
DELETE FROM settings WHERE key IN ('humanizer_enabled', 'humanizer_temperature', 'humanizer_similarity_threshold');
