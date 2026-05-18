-- Accountic Blog Automation — Phase 3 Pipeline Schema
-- Apply: wrangler d1 execute BLOG_DB --remote --file=migrations/002_pipeline.sql
-- Rollback: wrangler d1 execute BLOG_DB --remote --file=migrations/002_rollback.sql
-- Additive: Phase 2 tables (posts, generation_jobs, settings) are not modified.

-- ── topics ────────────────────────────────────────────────────────────────────
-- Topic backlog discovered by the topic-discovery worker.
-- status: 'pending' | 'outlining' | 'outlined' | 'failed'

CREATE TABLE IF NOT EXISTS topics (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL COLLATE NOCASE,
  pillar     TEXT NOT NULL,
  rationale  TEXT,
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (title COLLATE NOCASE)
);

-- ── outlines ──────────────────────────────────────────────────────────────────
-- Structured article outlines produced from topics.

CREATE TABLE IF NOT EXISTS outlines (
  id           TEXT PRIMARY KEY,
  topic_id     TEXT NOT NULL REFERENCES topics(id),
  outline_json TEXT NOT NULL,
  error        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── drafts ────────────────────────────────────────────────────────────────────
-- Full article drafts generated from outlines.
-- status: 'pending' | 'ready' | 'failed' | 'approved' | 'rejected' | 'published' | 'publish_failed'

CREATE TABLE IF NOT EXISTS drafts (
  id                  TEXT PRIMARY KEY,
  outline_id          TEXT NOT NULL REFERENCES outlines(id),
  slug                TEXT NOT NULL UNIQUE,
  content             TEXT NOT NULL,
  frontmatter_json    TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  error               TEXT,
  quality_report_json TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── prompts ───────────────────────────────────────────────────────────────────
-- Versioned generation prompts, editable via admin dashboard.
-- stage: 'topic-discovery' | 'outline-generation' | 'article-generation' | 'publisher'
-- Only one prompt per stage should have is_active = 1.

CREATE TABLE IF NOT EXISTS prompts (
  id                   TEXT PRIMARY KEY,
  stage                TEXT NOT NULL,
  version              INTEGER NOT NULL DEFAULT 1,
  system_prompt        TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  is_active            INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (stage, version)
);

-- ── settings additions ────────────────────────────────────────────────────────
-- Phase 3 adds daily token budget tracking and model config.
-- INSERT OR IGNORE preserves any operator overrides on re-run.

INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_publish',      'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('daily_token_cap',   '200000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('tokens_used_today', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_model',          'claude-sonnet-4-6');

-- ── seed default prompts ──────────────────────────────────────────────────────

INSERT OR IGNORE INTO prompts (id, stage, version, system_prompt, user_prompt_template, is_active) VALUES (
  'prompt-topic-discovery-v1',
  'topic-discovery',
  1,
  'You are a senior content strategist for Accountic, an AI-powered platform that helps Indian Chartered Accountants respond to Income Tax notices. Your goal is to identify high-value blog topics that address real CA workflow pain points.

Accountic''s content pillars:
- Income Tax Notices (139(9), 142(1), 143(2), 148, 245)
- Faceless Assessment
- DPDP Compliance
- ICAI Ethics
- Case Law Notes
- Firm Operations

Every topic must:
1. Address a specific, high-intent question a CA would search for
2. Demonstrate operational depth (not textbook theory)
3. Be answerable with at least one unique workflow, comparison, or implementation example
4. Align with one of the six content pillars above',
  'Generate exactly {{count}} blog topic ideas for Accountic''s CA-focused blog. Return a JSON array only, no prose.

Each item must have:
- "title": SEO-optimised title (under 70 chars)
- "pillar": exactly one of ["Income Tax Notices","Faceless Assessment","DPDP Compliance","ICAI Ethics","Case Law Notes","Firm Operations"]
- "rationale": one sentence on why a CA would search for this right now

Return ONLY valid JSON. Example format:
[{"title":"...","pillar":"...","rationale":"..."}]',
  1
);

INSERT OR IGNORE INTO prompts (id, stage, version, system_prompt, user_prompt_template, is_active) VALUES (
  'prompt-outline-generation-v1',
  'outline-generation',
  1,
  'You are a senior content architect for Accountic, a CA-focused Indian tax notice platform. Create detailed article outlines that will guide article generation. Each outline must include practical sections a working CA will find immediately useful.',
  'Create a detailed article outline for this blog topic:

Title: {{title}}
Pillar: {{pillar}}
Rationale: {{rationale}}

Return a JSON object only:
{
  "title": "final article title",
  "description": "meta description (under 160 chars)",
  "sections": [
    {"heading": "H2 section title", "summary": "one sentence on what this section covers", "key_points": ["point 1", "point 2"]}
  ],
  "tone": "one of: emerald|amber|rose|sky|violet|stone",
  "estimated_read_time": <integer minutes>
}

Return ONLY valid JSON.',
  1
);

INSERT OR IGNORE INTO prompts (id, stage, version, system_prompt, user_prompt_template, is_active) VALUES (
  'prompt-article-generation-v1',
  'article-generation',
  1,
  'You are a senior content writer for Accountic, writing for Indian Chartered Accountants. Every article must:

1. Sound like it was written by a practising CA partner with 15+ years of experience
2. Include at least one of: numbered workflow (3+ steps), comparison table (3+ rows), concrete example with PAN/AY/section references, or a named case scenario
3. Avoid generic textbook explanations — focus on what a CA actually needs to do
4. Use plain English with correct Indian tax terminology
5. Be structured for web reading: short paragraphs, active voice, specific advice

Frontmatter requirements (YAML, strict):
- title: string (required)
- description: string, under 160 chars (required)
- pubDate: ISO date YYYY-MM-DD (required)
- pillar: exactly one of ["Income Tax Notices","Faceless Assessment","DPDP Compliance","ICAI Ethics","Case Law Notes","Firm Operations"] (required)
- author: "Accountic Team" (required, always this value)
- readTime: integer (required)
- tone: one of ["emerald","amber","rose","sky","violet","stone"] (required)
- featured: false (required)',
  'Write a complete MDX blog article using this outline:

{{outline_json}}

Requirements:
- Start with valid YAML frontmatter between --- fences
- Write all sections from the outline
- Include at least one practical workflow, table, or concrete example with Indian tax context
- Keep paragraphs to 3-4 sentences maximum
- End with a clear next-step or action item for the CA
- Target {{read_time}} minutes reading time

Return the complete MDX file content starting with ---',
  1
);

INSERT OR IGNORE INTO prompts (id, stage, version, system_prompt, user_prompt_template, is_active) VALUES (
  'prompt-publisher-v1',
  'publisher',
  1,
  'Publisher stage — no Claude call needed. This prompt is a placeholder for the publisher worker configuration.',
  'N/A',
  1
);
