-- Phase 6: Content Refresh System
-- Additive migration — no existing columns are modified.

ALTER TABLE posts ADD COLUMN last_refreshed_at TEXT;
ALTER TABLE posts ADD COLUMN refresh_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS refresh_jobs (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  status TEXT NOT NULL,
  failed_gate TEXT,
  tokens_used INTEGER,
  duration_ms INTEGER,
  snapshot_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_jobs_post_id ON refresh_jobs (post_id);
CREATE INDEX IF NOT EXISTS idx_refresh_jobs_created_at ON refresh_jobs (created_at);
