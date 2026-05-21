-- Rollback for 010_better_article_generation.sql
-- Apply: wrangler d1 execute BLOG_DB --remote --file=migrations/010_rollback.sql

UPDATE prompts SET is_active = 0 WHERE id = 'prompt-article-generation-v3';
UPDATE prompts SET is_active = 1 WHERE id = 'prompt-article-generation-v2';

UPDATE prompts SET is_active = 0 WHERE id = 'prompt-outline-generation-v2';
UPDATE prompts SET is_active = 1 WHERE id = 'prompt-outline-generation-v1';
