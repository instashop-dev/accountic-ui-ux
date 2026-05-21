## ADDED Requirements

### Requirement: Coverage brief is injected into topic-discovery prompt
The topic-discovery worker SHALL build a structured coverage brief from the D1 database and inject it into the active `topic-discovery` prompt template via the `{{coverage_brief}}` placeholder before making the AI call. The brief SHALL contain two sections: (1) per-pillar topic counts (all-time, excluding failed topics), and (2) a list of topic titles created within the last 90 days (excluding failed topics), ordered most-recent first.

#### Scenario: Coverage brief contains per-pillar counts
- **WHEN** the topic-discovery worker processes a message AND topics exist across multiple pillars
- **THEN** the injected brief includes a line for each pillar showing its non-failed topic count

#### Scenario: Coverage brief contains recent titles
- **WHEN** topics exist with `created_at` within the last 90 days AND `status != 'failed'`
- **THEN** the injected brief includes those titles ordered by `created_at DESC`

#### Scenario: Failed topics excluded from coverage brief
- **WHEN** topics exist with `status = 'failed'`
- **THEN** those topics do NOT appear in either the pillar counts or the recent titles section of the brief

#### Scenario: Coverage brief is empty on first run
- **WHEN** the `topics` table contains no rows
- **THEN** the brief shows a count of 0 for all six pillars and an empty recency section, and the worker proceeds without error

#### Scenario: Graceful degradation when placeholder absent
- **WHEN** the active prompt template does NOT contain the string `{{coverage_brief}}`
- **THEN** the `.replace()` call is a no-op, no error is thrown, and the worker proceeds using the unmodified template

### Requirement: Recent titles are capped at 300 entries
The recency query SHALL apply `LIMIT 300` so that the coverage brief cannot grow unbounded regardless of how many times the pipeline has been manually triggered.

#### Scenario: Brief is capped when 90-day window exceeds 300 topics
- **WHEN** more than 300 non-failed topics were created in the last 90 days
- **THEN** the brief includes exactly the 300 most-recent titles and no more

#### Scenario: Brief is not truncated when window is under cap
- **WHEN** fewer than 300 non-failed topics exist within the last 90 days
- **THEN** all matching titles appear in the brief

### Requirement: Deduplication checks both topics and posts tables
The topic-discovery worker SHALL build the dedup title set from a `UNION` of `topics.title` and `posts.title` (both lowercased). A generated candidate whose title (lowercased) matches any title in this combined set SHALL be skipped and not inserted.

#### Scenario: Candidate matches an existing topic title
- **WHEN** the AI returns a candidate title that exactly matches (case-insensitive) a title already in the `topics` table
- **THEN** the candidate is skipped and not inserted into `topics`

#### Scenario: Candidate matches a manually-created post title
- **WHEN** a post exists in the `posts` table with title "X" (any source)
- **AND** the AI returns a candidate with the same title "X" (case-insensitive)
- **THEN** the candidate is skipped and not inserted into `topics`

#### Scenario: Candidate with unique title is accepted
- **WHEN** the AI returns a candidate title that does not match any title in `topics` or `posts`
- **THEN** the candidate is inserted into `topics` and proceeds through the pipeline

#### Scenario: Case-insensitive match is enforced across both tables
- **WHEN** a post exists with title "DPDP Compliance Checklist" AND the AI generates "dpdp compliance checklist"
- **THEN** the candidate is skipped

### Requirement: Database index exists on topics.created_at
A migration SHALL add an index on `topics(created_at)` to support efficient range queries used by the coverage brief recency window.

#### Scenario: Index is created by migration
- **WHEN** `migrations/007_coverage_brief.sql` is applied
- **THEN** an index named `idx_topics_created_at` exists on the `topics` table's `created_at` column

#### Scenario: Index creation is idempotent
- **WHEN** `migrations/007_coverage_brief.sql` is applied twice
- **THEN** no error is thrown on the second application (uses `CREATE INDEX IF NOT EXISTS`)

### Requirement: Topic-discovery prompt v2 is seeded with coverage brief template
A migration SHALL insert a new active prompt row for the `topic-discovery` stage (version 2) whose `user_prompt_template` contains both `{{coverage_brief}}` and `{{count}}` placeholders, and SHALL set the version 1 row `is_active = 0`.

#### Scenario: Only one active prompt exists per stage after migration
- **WHEN** `migrations/007_coverage_brief.sql` is applied
- **THEN** `SELECT COUNT(*) FROM prompts WHERE stage = 'topic-discovery' AND is_active = 1` returns exactly 1

#### Scenario: New active prompt contains both placeholders
- **WHEN** `migrations/007_coverage_brief.sql` is applied
- **THEN** the active `topic-discovery` prompt's `user_prompt_template` contains the substring `{{coverage_brief}}` AND the substring `{{count}}`

#### Scenario: Rollback restores v1 as active
- **WHEN** `migrations/007_rollback.sql` is applied after `migrations/007_coverage_brief.sql`
- **THEN** the version 1 `topic-discovery` prompt has `is_active = 1` AND the version 2 row has `is_active = 0`
