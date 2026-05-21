-- Accountic Blog Automation — Rollback Migration 009
-- Restores generation_jobs without ON DELETE CASCADE on post_id.
--
-- Apply: wrangler d1 execute BLOG_DB --remote --file=migrations/009_rollback.sql

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS generation_jobs_old (
  id            TEXT PRIMARY KEY,
  post_id       TEXT REFERENCES posts(id),
  stage         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  input_hash    TEXT,
  output_ref    TEXT,
  stage_payload TEXT,
  error         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO generation_jobs_old
  SELECT id, post_id, stage, status, input_hash, output_ref, stage_payload, error, created_at, updated_at
  FROM generation_jobs;

DROP TABLE generation_jobs;
ALTER TABLE generation_jobs_old RENAME TO generation_jobs;

PRAGMA foreign_keys = ON;
