-- Accountic Blog Automation — Migration 009: Cascade delete on generation_jobs
-- Adds ON DELETE CASCADE to generation_jobs.post_id so that deleting a post
-- automatically removes all associated pipeline jobs.
--
-- SQLite does not support ALTER TABLE ... ADD FOREIGN KEY, so the table is
-- recreated with the constraint.
--
-- Apply (remote):  wrangler d1 execute BLOG_DB --remote --file=migrations/009_cascade_generation_jobs.sql
-- Apply (local):   wrangler d1 execute BLOG_DB --file=migrations/009_cascade_generation_jobs.sql
-- Rollback:        wrangler d1 execute BLOG_DB --remote --file=migrations/009_rollback.sql

PRAGMA foreign_keys = OFF;

-- Step 1: Create replacement table with ON DELETE CASCADE
CREATE TABLE IF NOT EXISTS generation_jobs_new (
  id            TEXT PRIMARY KEY,
  post_id       TEXT REFERENCES posts(id) ON DELETE CASCADE,
  stage         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  input_hash    TEXT,
  output_ref    TEXT,
  stage_payload TEXT,
  error         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 2: Copy existing data
INSERT INTO generation_jobs_new
  SELECT id, post_id, stage, status, input_hash, output_ref, stage_payload, error, created_at, updated_at
  FROM generation_jobs;

-- Step 3: Swap tables
DROP TABLE generation_jobs;
ALTER TABLE generation_jobs_new RENAME TO generation_jobs;

PRAGMA foreign_keys = ON;
