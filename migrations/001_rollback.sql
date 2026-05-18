-- Accountic Blog Automation — Rollback Migration 001
-- WARNING: This drops all blog automation tables and their data.
-- Apply: wrangler d1 execute BLOG_DB --file=migrations/001_rollback.sql

-- Drop in reverse dependency order (FK child before parent)
DROP TABLE IF EXISTS generation_jobs;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS settings;
