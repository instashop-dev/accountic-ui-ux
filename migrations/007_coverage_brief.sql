-- Accountic Blog Automation — Coverage-Aware Topic Discovery
-- Apply:   wrangler d1 execute BLOG_DB --remote --file=migrations/007_coverage_brief.sql
-- Rollback: wrangler d1 execute BLOG_DB --remote --file=migrations/007_rollback.sql

-- ── index: 90-day recency window query ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_topics_created_at ON topics(created_at);

-- ── deactivate topic-discovery prompt v1 ─────────────────────────────────────
UPDATE prompts SET is_active = 0 WHERE id = 'prompt-topic-discovery-v1';

-- ── insert topic-discovery prompt v2 (coverage-aware) ────────────────────────
INSERT OR IGNORE INTO prompts (id, stage, version, system_prompt, user_prompt_template, is_active) VALUES (
  'prompt-topic-discovery-v2',
  'topic-discovery',
  2,
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
  'Current content coverage across Accountic''s six pillars:

{{coverage_brief}}

Generate exactly {{count}} NEW blog topic ideas that fill meaningful gaps in the coverage above. Prioritise pillars with lower topic counts. Each topic must complement — not duplicate — what already exists.

Return a JSON array only, no prose.

Each item must have:
- "title": SEO-optimised title (under 70 chars)
- "pillar": exactly one of ["Income Tax Notices","Faceless Assessment","DPDP Compliance","ICAI Ethics","Case Law Notes","Firm Operations"]
- "rationale": one sentence on why a CA would search for this right now

Return ONLY valid JSON. Example format:
[{"title":"...","pillar":"...","rationale":"..."}]',
  1
);
