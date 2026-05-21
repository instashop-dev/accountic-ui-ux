## 1. Pre-flight Check

- [x] 1.1 Query remote D1 to confirm zero topics and posts with `pillar = 'Firm Operations'`: `SELECT COUNT(*) FROM topics WHERE pillar = 'Firm Operations'` and `SELECT COUNT(*) FROM posts WHERE pillar = 'Firm Operations'` — if non-zero, manually update those rows to `'CA Firm Automation'` before proceeding

## 2. Update Pillar Registry (blog-meta.ts)

- [x] 2.1 In `src/blog-meta.ts`, replace `'Firm Operations'` with `'CA Firm Automation'` in the `PILLARS` const array
- [x] 2.2 Add `'AI Tools for Indian CAs'` to the PILLARS array
- [x] 2.3 Add `'GST Automation'` to the PILLARS array
- [x] 2.4 Add `'Audit Technology'` to the PILLARS array
- [x] 2.5 Verify the final PILLARS array has exactly 9 entries and `'Firm Operations'` is absent

## 3. Migration — Forward (008_expand_pillars.sql)

- [x] 3.1 Create `migrations/008_expand_pillars.sql` — set `is_active = 0` for `prompt-topic-discovery-v2`
- [x] 3.2 In the same migration, `INSERT OR IGNORE` `prompt-topic-discovery-v3` (`is_active = 1`) with system_prompt listing all 9 India-specific pillars (replacing the "six content pillars" narrative) and user_prompt_template listing all 9 in the JSON pillar enum, retaining `{{coverage_brief}}` and `{{count}}` placeholders
- [x] 3.3 In the same migration, set `is_active = 0` for `prompt-article-generation-v1`
- [x] 3.4 In the same migration, `INSERT OR IGNORE` `prompt-article-generation-v2` (`is_active = 1`) with the same system_prompt and user_prompt_template as v1 except the frontmatter `pillar` enum is expanded to all 9 values and `"Firm Operations"` is removed

## 4. Migration — Rollback (008_rollback.sql)

- [x] 4.1 Create `migrations/008_rollback.sql` that sets `prompt-topic-discovery-v3` `is_active = 0`, `prompt-topic-discovery-v2` `is_active = 1`, `prompt-article-generation-v2` `is_active = 0`, `prompt-article-generation-v1` `is_active = 1`

## 5. Unit Tests — Pillar Registry

- [x] 5.1 Test: `PILLARS` has exactly 9 entries
- [x] 5.2 Test: `'Firm Operations'` is NOT in `PILLARS`
- [x] 5.3 Test: all 4 new values (`'AI Tools for Indian CAs'`, `'GST Automation'`, `'CA Firm Automation'`, `'Audit Technology'`) ARE in `PILLARS`
- [x] 5.4 Test (topic-discovery worker): candidate with `pillar: 'GST Automation'` passes pillar validation and is inserted
- [x] 5.5 Test (topic-discovery worker): candidate with `pillar: 'Firm Operations'` is skipped with a warning
- [x] 5.6 Test (buildCoverageBrief): brief contains a line for each of the 9 PILLARS when pillarCounts is empty (all default to 0)

## 6. Migration Tests (migrations-008.test.ts)

- [x] 6.1 After applying `008_expand_pillars.sql`: exactly 1 active `topic-discovery` prompt
- [x] 6.2 After applying `008_expand_pillars.sql`: active topic-discovery prompt contains all 4 new pillar names
- [x] 6.3 After applying `008_expand_pillars.sql`: active topic-discovery prompt does NOT contain `"Firm Operations"`
- [x] 6.4 After applying `008_expand_pillars.sql`: active topic-discovery prompt retains `{{coverage_brief}}` and `{{count}}`
- [x] 6.5 After applying `008_expand_pillars.sql`: exactly 1 active `article-generation` prompt
- [x] 6.6 After applying `008_expand_pillars.sql`: active article-generation prompt contains all 4 new pillar names
- [x] 6.7 After applying `008_rollback.sql`: topic-discovery v2 is active, v3 is inactive
- [x] 6.8 After applying `008_rollback.sql`: article-generation v1 is active, v2 is inactive

## 7. Manual Verification

- [x] 7.1 Apply `migrations/008_expand_pillars.sql` to remote D1: `wrangler d1 execute BLOG_DB --remote --file=migrations/008_expand_pillars.sql`
- [x] 7.2 Confirm DB state: `SELECT stage, id, version, is_active FROM prompts WHERE stage IN ('topic-discovery','article-generation') ORDER BY stage, version` — verify v3 and v2 are active respectively
- [x] 7.3 Trigger a topic-discovery run (`npm run blog:generate -- --count 3`) and verify at least one new topic is generated in a new pillar (`GST Automation`, `CA Firm Automation`, `AI Tools for Indian CAs`, or `Audit Technology`)
