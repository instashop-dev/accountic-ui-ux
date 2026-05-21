-- Rollback for migrations/007_coverage_brief.sql
-- Apply: wrangler d1 execute BLOG_DB --remote --file=migrations/007_rollback.sql

UPDATE prompts SET is_active = 0 WHERE id = 'prompt-topic-discovery-v2';
UPDATE prompts SET is_active = 1 WHERE id = 'prompt-topic-discovery-v1';
DROP INDEX IF EXISTS idx_topics_created_at;
