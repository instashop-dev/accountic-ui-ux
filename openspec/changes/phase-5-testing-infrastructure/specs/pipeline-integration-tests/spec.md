## ADDED Requirements

### Requirement: Test fixture migration for D1
`migrations/005_test-fixtures.sql` SHALL exist and seed the `posts`, `drafts`, `prompts`, `settings`, and `topics` tables with deterministic rows sufficient for all worker integration tests. The file SHALL begin with `-- TEST FIXTURES ONLY — DO NOT RUN IN PRODUCTION` and MUST NOT be referenced in any `package.json` db:migrate script.

#### Scenario: Fixture file has production warning comment
- **WHEN** `migrations/005_test-fixtures.sql` is read
- **THEN** the first line is `-- TEST FIXTURES ONLY — DO NOT RUN IN PRODUCTION`

#### Scenario: Fixture seeds are not in package.json migrate scripts
- **WHEN** `package.json` is inspected
- **THEN** no `db:migrate` script references `005_test-fixtures.sql`

### Requirement: Humanizer worker integration tests
`src/workers/pipeline/humanizer.test.ts` SHALL test the queue handler using an in-process Miniflare D1, a stub Queue, a stub AnalyticsEngineDataset, and a stub `ANTHROPIC_API_KEY`. Tests MUST cover: humanizer disabled bypass, status != 'ready' early exit, idempotency guard, missing prompt → status='failed', successful humanization → status='humanized', regression detected → fallback to original.

#### Scenario: Humanizer disabled → draft advanced without Claude call
- **WHEN** `humanizer_enabled = 'false'` is set in D1 settings and a message with a valid `draft_id` is processed
- **THEN** the draft `status` is set to `'humanized'` without a Claude API call and the publish queue `send` stub is called once

#### Scenario: Draft not in 'ready' status is skipped
- **WHEN** a humanizer message is processed for a draft with `status = 'approved'`
- **THEN** the draft status is unchanged and no queue dispatch occurs

#### Scenario: Idempotency — already 'humanized' draft is a no-op
- **WHEN** a humanizer message is processed for a draft already at `status = 'humanized'`
- **THEN** D1 is not updated and no queue dispatch occurs

#### Scenario: Missing prompt → draft set to 'failed'
- **WHEN** no `humanizer` stage prompt exists in D1 `prompts` table and a valid 'ready' draft is processed
- **THEN** the draft `status` is set to `'failed'` and no publish queue dispatch occurs

### Requirement: Article generation worker integration tests
`src/workers/pipeline/article-generation.test.ts` SHALL test: successful generation dispatches to `blog-humanize` queue (not `blog-publish`), quality gate failure sets `status = 'failed'`, idempotency skip for non-pending outlines, and token budget exceeded skips generation.

#### Scenario: Successful generation dispatches to humanize queue
- **WHEN** article generation processes a valid outline and the generated content passes quality scoring
- **THEN** the draft is inserted with `status = 'ready'` and the `BLOG_HUMANIZE_QUEUE.send` stub is called with `{ draft_id }`

#### Scenario: Quality gate failure sets draft to 'failed'
- **WHEN** article generation produces content that scores below the quality threshold
- **THEN** the draft `status` is set to `'failed'` and no queue dispatch occurs

### Requirement: Publisher worker integration tests
`src/workers/pipeline/publisher.test.ts` SHALL test: internal links are injected before MDX commit, SEO schema block is appended to MDX content, GitHub API call is made with correct file path, and non-approved draft is skipped.

#### Scenario: Publisher skips non-approved draft
- **WHEN** a publisher message is processed for a draft with `status = 'humanized'` (not 'approved')
- **THEN** no GitHub API call is made and `status` remains unchanged

#### Scenario: Internal links injected before commit
- **WHEN** a publisher message is processed for an approved draft with related posts in D1
- **THEN** the MDX content passed to the GitHub stub contains Markdown inline links

#### Scenario: SEO schema block appended to MDX
- **WHEN** a publisher message is processed for an approved draft
- **THEN** the MDX content passed to the GitHub stub contains `<script type="application/ld+json">`

### Requirement: Topic discovery and outline generation worker smoke tests
`src/workers/pipeline/topic-discovery.test.ts` and `src/workers/pipeline/outline-generation.test.ts` SHALL include at minimum: a smoke test that the handler does not throw on a valid message with a seeded D1 state, and a test that a duplicate input hash does not insert a duplicate row.

#### Scenario: Topic discovery smoke test completes without error
- **WHEN** the topic discovery cron handler is invoked with a seeded D1 (settings, topics table empty)
- **THEN** it completes without throwing and at least one topic row is inserted (or generation is skipped if token budget is zero)

#### Scenario: Duplicate input hash is idempotent
- **WHEN** the same topic discovery or outline generation message is processed twice
- **THEN** no duplicate row is inserted in the respective D1 table
