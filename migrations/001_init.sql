-- Accountic Blog Automation — Initial Schema
-- Apply: npm run db:migrate
-- Rollback: wrangler d1 execute BLOG_DB --file=migrations/001_rollback.sql

-- ── posts ─────────────────────────────────────────────────────────────────────
-- Mirrors the Astro content collection schema (src/content.config.ts).
-- source: 'human' = manually authored, 'ai' = pipeline-generated
-- status: 'published' | 'draft' | 'archived'

CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  pillar      TEXT NOT NULL,
  tone        TEXT NOT NULL DEFAULT 'emerald',
  author      TEXT NOT NULL DEFAULT 'Accountic Team',
  pub_date    TEXT NOT NULL,
  read_time   INTEGER NOT NULL DEFAULT 5,
  source      TEXT NOT NULL DEFAULT 'human',
  status      TEXT NOT NULL DEFAULT 'published',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── generation_jobs ───────────────────────────────────────────────────────────
-- Records each pipeline run: topic → outline → article → humanise → publish.
-- stage: 'topic' | 'outline' | 'article' | 'humanize' | 'publish'
-- status: 'pending' | 'running' | 'complete' | 'failed'
-- input_hash: SHA-256 of the prompt/topic used (for deduplication)
-- output_ref: KV key or R2 object key where draft output is stored

CREATE TABLE IF NOT EXISTS generation_jobs (
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

-- ── settings ──────────────────────────────────────────────────────────────────
-- Key/value store for admin-configurable pipeline settings.
-- Keys are stable identifiers; values are always TEXT (parse at read time).

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed defaults (INSERT OR IGNORE preserves operator overrides on re-run)
INSERT OR IGNORE INTO settings (key, value) VALUES ('generation_enabled', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('weekly_target', '2');
INSERT OR IGNORE INTO settings (key, value) VALUES ('quality_threshold', '0.8');
