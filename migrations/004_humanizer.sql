-- Accountic Blog Automation — Phase 4 Humanizer
-- Apply:    wrangler d1 execute BLOG_DB --remote --file=migrations/004_humanizer.sql
-- Rollback: wrangler d1 execute BLOG_DB --remote --file=migrations/004_rollback.sql
--
-- Additive only. Does NOT modify 001_init.sql, 002_pipeline.sql, or 003_phase3_hardening.sql.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. NEW TABLE — humanizer_jobs
-- ═══════════════════════════════════════════════════════════════════════════════
-- Tracks each humanizer pass: outcome, token cost, duration, idempotency key.

CREATE TABLE IF NOT EXISTS humanizer_jobs (
  id          TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  draft_id    TEXT    NOT NULL REFERENCES drafts(id),
  input_hash  TEXT    NOT NULL,
  outcome     TEXT    NOT NULL, -- 'humanized' | 'fallback' | 'failed' | 'skipped'
  tokens_used INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),

  UNIQUE(draft_id, input_hash)
);

CREATE INDEX IF NOT EXISTS idx_humanizer_jobs_draft_id ON humanizer_jobs(draft_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ALTER TABLE drafts — new columns
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE drafts ADD COLUMN humanized_at TEXT;
ALTER TABLE drafts ADD COLUMN internal_links_added INTEGER NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. SEED — humanizer prompt
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO prompts (stage, version, system_prompt, user_prompt_template, is_active, created_at)
VALUES (
  'humanizer',
  1,
  'You are a prose editor for Accountic, an Indian chartered accountant platform. Your sole task is to improve the natural flow, readability, and human feel of the provided article draft.

CONSTRAINTS — MANDATORY, NON-NEGOTIABLE:
1. PRESERVE all factual statements, claims, and assertions without alteration.
2. PRESERVE all regulatory references exactly as written: GST, CGST, SGST, IGST, TDS, TCS, ITR, PAN, TAN, GSTIN, RCM, QRMP, and all section numbers (e.g. Section 16(4), u/s 194C).
3. PRESERVE all legal and compliance terminology exactly as written.
4. PRESERVE all numerical values, monetary amounts (e.g. ₹40 lakh), percentages, deadlines, and dates exactly as written — do not round, reformat, or paraphrase.
5. PRESERVE all Markdown headings (## and ###) verbatim — do not rephrase or reorder headings.
6. DO NOT introduce case studies, client stories, practitioner experiences, legal outcomes, tax notices, or court orders that are not already present in the original.
7. DO NOT add new claims, statistics, examples, or any information not present in the original text.
8. DO NOT fabricate data. If you are unsure whether content was in the original, leave it unchanged.

PERMITTED IMPROVEMENTS (style only):
- Vary sentence structure and length to improve rhythm
- Replace AI-clichéd openers ("It is important to note that", "In conclusion", "It goes without saying", "In today''s fast-paced")
- Improve paragraph transitions for better flow
- Reduce repetitive sentence starters within a section
- Clarify phrasing where meaning is obscure, without changing what is said

Return ONLY the improved article text. Do not add commentary, preamble, or any text outside the article itself.',
  'Here is the article to improve. Return the full improved article — same structure, same headings, same facts, better prose:

{{content}}',
  1,
  datetime('now')
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. SEED — settings
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO settings (key, value) VALUES ('humanizer_enabled', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('humanizer_temperature', '0.3');
INSERT OR IGNORE INTO settings (key, value) VALUES ('humanizer_similarity_threshold', '0.70');
