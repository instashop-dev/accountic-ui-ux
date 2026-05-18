## ADDED Requirements

### Requirement: Topic-discovery Worker consumes `blog-pipeline` queue and writes topics to D1
`src/workers/pipeline/topic-discovery.ts` SHALL export a Cloudflare Queue handler that reads messages from the `blog-pipeline` queue, calls the Claude API to generate a list of high-value CA-relevant blog topics, deduplicates against existing `topics` rows in D1, and inserts new topics with `status = 'pending'`. Each topic SHALL store a `title`, `pillar` (matching `src/blog-meta.ts` PILLARS enum), and a `rationale` (one sentence on why the topic is valuable). The handler SHALL process at most 10 topics per invocation.

#### Scenario: New unique topics are inserted
- **WHEN** the topic-discovery Worker runs and Claude returns 5 topics not already in the `topics` table
- **THEN** all 5 rows are inserted into `topics` with `status = 'pending'`

#### Scenario: Duplicate topics are skipped
- **WHEN** Claude returns a topic whose title matches an existing row (case-insensitive) in `topics`
- **THEN** the duplicate is not inserted and no error is thrown

#### Scenario: Invalid pillar is rejected
- **WHEN** Claude returns a topic with a `pillar` value not in the PILLARS enum
- **THEN** the topic is not inserted and the error is logged to the Worker console with the invalid value

### Requirement: Outline-generation Worker consumes topic IDs and writes outlines to D1
`src/workers/pipeline/outline-generation.ts` SHALL export a Cloudflare Queue handler that reads a `topic_id` from each queue message, fetches the corresponding topic from D1, calls the Claude API to produce a structured article outline (H2 sections with one-line descriptions), and writes the outline JSON to a `outlines` D1 row linked to the topic. The topic's status SHALL be updated to `'outlining'` before the Claude call and to `'outlined'` on success or `'failed'` on error.

#### Scenario: Outline is written for a valid topic
- **WHEN** the outline-generation Worker receives a `topic_id` that exists in D1 with `status = 'pending'`
- **THEN** an `outlines` row is created with the structured outline JSON and the topic's `status` is updated to `'outlined'`

#### Scenario: Missing topic is handled gracefully
- **WHEN** the outline-generation Worker receives a `topic_id` that does not exist in D1
- **THEN** the Worker logs the missing ID and returns without throwing, preventing queue poison-message retry loops

#### Scenario: Claude error sets topic status to failed
- **WHEN** the Claude API returns an error during outline generation
- **THEN** the topic `status` is set to `'failed'` and the error message is stored in the `outlines` row `error` column

### Requirement: Article-generation Worker produces full drafts and runs the quality gate
`src/workers/pipeline/article-generation.ts` SHALL export a Cloudflare Queue handler that reads an `outline_id`, fetches the outline and parent topic from D1, calls the Claude API to produce a full article in MDX format (with valid YAML frontmatter satisfying `src/lib/schema-validate.ts`), runs the quality gate via `src/lib/quality.ts`, and writes the result to a `drafts` D1 row with `status = 'ready'` (quality passed) or `status = 'failed'` (quality failed, with `error` JSON). It SHALL also write an idempotency record to `generation_jobs` using the outline's `input_hash`.

#### Scenario: Draft passes quality gate and is marked ready
- **WHEN** Claude produces a valid MDX article that passes all quality checks
- **THEN** a `drafts` row is created with `status = 'ready'`, valid frontmatter, and `generation_jobs` records updated to `status = 'done'`

#### Scenario: Draft fails Zod validation and is quarantined
- **WHEN** Claude produces an article with a missing required frontmatter field
- **THEN** the `drafts` row is created with `status = 'failed'` and `error` contains the Zod validation error array as JSON

#### Scenario: Draft fails readability and is quarantined
- **WHEN** the quality gate returns a readability score below 70
- **THEN** the `drafts` row is created with `status = 'failed'` and `error` contains `{ "check": "readability", "score": <actual>, "threshold": 70 }`

#### Scenario: Idempotent retry skips re-generation
- **WHEN** the Worker receives a queue message for an `outline_id` that already has a `generation_jobs` row with `status = 'done'` and matching `input_hash`
- **THEN** the Worker returns without calling Claude and without creating a duplicate `drafts` row

### Requirement: Publisher Worker commits approved drafts to GitHub and updates D1
`src/workers/pipeline/publisher.ts` SHALL export a Cloudflare Queue handler that reads a `draft_id`, fetches the approved draft from D1, constructs the target file path (`src/content/blog/<slug>.mdx`), commits the file content to GitHub via the Contents REST API using `GITHUB_TOKEN`, and updates the `drafts` row to `status = 'published'` and the `posts` D1 table with a new row sourced as `'ai'`. If the GitHub API returns a non-2xx response, the Worker SHALL set `drafts.status = 'publish_failed'` and store the GitHub error body.

#### Scenario: Approved draft is committed to GitHub
- **WHEN** the publisher Worker receives a `draft_id` with `status = 'approved'`
- **THEN** the draft content is committed to `src/content/blog/<slug>.mdx` on the `main` branch and the `drafts` row is updated to `status = 'published'`

#### Scenario: GitHub API error is recorded
- **WHEN** the GitHub Contents API returns a 422 (file already exists at the slug)
- **THEN** `drafts.status` is set to `'publish_failed'` and `drafts.error` contains the GitHub API response body

#### Scenario: Post row is created in D1 after publish
- **WHEN** the publisher Worker successfully commits to GitHub
- **THEN** a new row is inserted into `posts` with `source = 'ai'` and `status = 'published'`

### Requirement: Cron trigger handler dispatches topic-discovery and refresh queue messages
`src/workers/pipeline/cron.ts` SHALL export a Cloudflare `scheduled` handler that dispatches a topic-discovery message to `blog-pipeline` on the `"0 3 * * 1"` cron schedule (weekly) and dispatches refresh-scan messages for all `posts` rows where `updated_at` is older than 60 days on the `"0 4 * * *"` schedule (daily). It SHALL read `generation_enabled` from D1 settings and exit early (no messages dispatched) if the value is not `'true'`.

#### Scenario: Weekly cron dispatches topic-discovery
- **WHEN** the `"0 3 * * 1"` cron fires and `generation_enabled = 'true'`
- **THEN** one message is sent to the `blog-pipeline` queue with `{ "stage": "topic-discovery" }`

#### Scenario: Cron is a no-op when generation disabled
- **WHEN** the cron handler fires and `generation_enabled = 'false'`
- **THEN** no messages are dispatched to any queue

#### Scenario: Daily refresh dispatches messages for stale posts
- **WHEN** the `"0 4 * * *"` cron fires and there are 3 posts with `updated_at` older than 60 days
- **THEN** 3 messages are dispatched to `blog-pipeline` with `{ "stage": "refresh", "post_id": "<id>" }`
