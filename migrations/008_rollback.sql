-- Accountic Blog Automation — Rollback: Expand Blog Pillars
-- Apply:   wrangler d1 execute BLOG_DB --remote --file=migrations/008_rollback.sql
-- Forward: wrangler d1 execute BLOG_DB --remote --file=migrations/008_expand_pillars.sql

UPDATE prompts SET is_active = 0 WHERE id = 'prompt-topic-discovery-v3';
UPDATE prompts SET is_active = 1 WHERE id = 'prompt-topic-discovery-v2';
UPDATE prompts SET is_active = 0 WHERE id = 'prompt-article-generation-v2';
UPDATE prompts SET is_active = 1 WHERE id = 'prompt-article-generation-v1';
