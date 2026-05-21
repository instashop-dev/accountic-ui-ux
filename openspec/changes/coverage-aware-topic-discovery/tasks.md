## 1. Migration — Forward

- [x] 1.1 Create `migrations/007_coverage_brief.sql` with `CREATE INDEX IF NOT EXISTS idx_topics_created_at ON topics(created_at)`
- [x] 1.2 In the same migration, set `is_active = 0` for the existing `topic-discovery` stage-1 prompt row
- [x] 1.3 In the same migration, `INSERT OR IGNORE` a new `topic-discovery` v2 prompt row (`is_active = 1`) whose `user_prompt_template` includes both `{{coverage_brief}}` and `{{count}}` placeholders, with editorial framing that instructs the AI to prioritise under-covered pillars and avoid recently-covered topics

## 2. Migration — Rollback

- [x] 2.1 Create `migrations/007_rollback.sql` that sets v1 `is_active = 1`, v2 `is_active = 0`, and drops `idx_topics_created_at`

## 3. Coverage Brief Construction (topic-discovery.ts)

- [x] 3.1 Add a SQL query to fetch per-pillar topic counts: `SELECT pillar, COUNT(*) as count FROM topics WHERE status != 'failed' GROUP BY pillar`
- [x] 3.2 Add a SQL query to fetch recent titles: `SELECT title FROM topics WHERE status != 'failed' AND created_at >= datetime('now', '-90 days') ORDER BY created_at DESC LIMIT 300`
- [x] 3.3 Build the coverage brief string from both query results — show all six PILLARS in the counts section (defaulting to 0 for any pillar with no rows) and the title list in the recency section; use an empty string if both are empty
- [x] 3.4 Add `.replace('{{coverage_brief}}', coverageBrief)` to the template injection chain (alongside the existing `{{count}}` replace)

## 4. Deduplication Hardening (topic-discovery.ts)

- [x] 4.1 Change the dedup query from `SELECT title FROM topics` to `SELECT title FROM topics UNION SELECT title FROM posts` so manually-created posts protect their title space

## 5. Unit Tests (topic-discovery.test.ts)

- [x] 5.1 Test: coverage brief is injected — verify `mockGenerate` receives a `user` prompt containing per-pillar counts and recent titles when topics exist
- [x] 5.2 Test: failed topics excluded — seed a topic with `status = 'failed'`; verify its title does NOT appear in the brief and its pillar count is 0
- [x] 5.3 Test: empty DB graceful — run with no topics seeded; verify no error is thrown and the AI call proceeds
- [x] 5.4 Test: placeholder absent — set the active prompt template to one without `{{coverage_brief}}`; verify no error and the prompt is unchanged
- [x] 5.5 Test: recency cap — seed 301 topics all within 90 days; verify the brief passed to the AI contains at most 300 titles
- [x] 5.6 Test: dedup includes posts — insert a row into `posts` with title "X"; mock AI returning a candidate with title "X"; verify the candidate is skipped and not inserted into `topics`
- [x] 5.7 Test: case-insensitive dedup across posts — post title "DPDP Compliance Checklist", candidate title "dpdp compliance checklist"; verify candidate is skipped
- [x] 5.8 Test: only-one-active-prompt invariant — after `applyFixtures`, verify `SELECT COUNT(*) FROM prompts WHERE stage = 'topic-discovery' AND is_active = 1` returns 1

## 6. Migration Tests

- [x] 6.1 Verify `idx_topics_created_at` index exists after applying `007_coverage_brief.sql` in a test database
- [x] 6.2 Verify exactly one `topic-discovery` prompt has `is_active = 1` after the migration
- [x] 6.3 Verify the active prompt's `user_prompt_template` contains both `{{coverage_brief}}` and `{{count}}` substrings
- [x] 6.4 Verify the rollback migration restores v1 as active and deactivates v2

## 7. Manual Verification

- [x] 7.1 Apply `007_coverage_brief.sql` to the remote D1 database (`wrangler d1 execute BLOG_DB --remote --file=migrations/007_coverage_brief.sql`) and confirm exactly one active `topic-discovery` prompt
- [x] 7.2 Trigger the topic-discovery worker manually and inspect logs to confirm `[topic-discovery] Inserted N new topics` with the new prompt active
- [x] 7.3 Inspect the AI call payload (via a local test run or log) to confirm `{{coverage_brief}}` was substituted with actual pillar counts and recent titles
