-- Accountic Blog Automation — Phase 3 Rollback
-- Drops Phase 3 tables in reverse dependency order.
-- Phase 2 tables (posts, generation_jobs, settings) are NOT touched.
-- Apply: wrangler d1 execute BLOG_DB --remote --file=migrations/002_rollback.sql

DROP TABLE IF EXISTS drafts;
DROP TABLE IF EXISTS outlines;
DROP TABLE IF EXISTS topics;
DROP TABLE IF EXISTS prompts;
