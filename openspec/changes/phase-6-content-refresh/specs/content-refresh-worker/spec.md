## ADDED Requirements

### Requirement: Refresh worker handles stage:refresh queue messages
The `refresh` Worker SHALL consume messages from the `blog-refresh` Cloudflare Queue. Each message SHALL carry a `post_id` referencing a row in `posts` with `source = 'ai'` and `status = 'published'`. The worker SHALL process one message per batch (max_batch_size: 1).

#### Scenario: Message with valid post_id is processed
- **WHEN** a `{ stage: 'refresh', post_id: '<id>' }` message arrives on `blog-refresh`
- **THEN** the worker fetches the post row from D1, proceeds through snapshot → regenerate → quality-gate → publish steps, and acks the message on success

#### Scenario: Message with missing post_id is discarded
- **WHEN** a message arrives with no `post_id` field
- **THEN** the worker logs a warning and acks the message without further processing

#### Scenario: Emergency stop is active
- **WHEN** the `emergency_stop` settings key is `'true'` in D1
- **THEN** the worker acks the message without processing and logs `[refresh] Emergency stop active`

### Requirement: Refresh worker respects source guard
The worker SHALL only refresh posts where `source = 'ai'`. Posts with `source = 'manual'` SHALL be skipped.

#### Scenario: Post has source = 'manual'
- **WHEN** the post row has `source = 'manual'`
- **THEN** the worker acks the message, logs a skip notice, and does NOT modify the post or create a snapshot

### Requirement: Refresh worker runs full regeneration pipeline
After snapshotting, the worker SHALL regenerate the article using the existing AI pipeline steps: (1) fetch the original topic/outline from D1, (2) generate a new article draft via `createAIClient`, (3) run `scoreArticle` quality gate, (4) run humanizer pass, (5) run `checkRegression` against the original body. All existing quality thresholds SHALL apply unchanged.

#### Scenario: Regenerated article passes all quality gates
- **WHEN** the new draft scores above quality thresholds and regression check passes
- **THEN** the worker calls the GitHub API to overwrite the existing MDX file, updates `posts.last_refreshed_at` and increments `posts.refresh_count`, inserts a `refresh_jobs` success row, and logs a `BLOG_ANALYTICS` event

#### Scenario: Regenerated article fails quality gate
- **WHEN** `scoreArticle` returns a score below threshold
- **THEN** the worker does NOT overwrite the GitHub file, inserts a `refresh_jobs` row with `status = 'failed'` and `failed_gate = 'quality'`, logs to `BLOG_ANALYTICS`, and acks the message (no retry)

#### Scenario: Regenerated article fails regression check
- **WHEN** `checkRegression` semantic similarity drops below threshold compared to original body
- **THEN** the worker does NOT overwrite the GitHub file, inserts a `refresh_jobs` row with `status = 'failed'` and `failed_gate = 'regression'`, logs to `BLOG_ANALYTICS`, and acks the message

### Requirement: Refresh worker updates D1 on success
On successful refresh, the worker SHALL execute an atomic D1 update: set `posts.last_refreshed_at = datetime('now')` and `posts.refresh_count = refresh_count + 1` for the refreshed post.

#### Scenario: D1 update after successful publish
- **WHEN** the GitHub commit succeeds
- **THEN** `posts.last_refreshed_at` is set and `posts.refresh_count` is incremented in the same D1 transaction as the `refresh_jobs` insert

### Requirement: Refresh worker tracks analytics
Every refresh attempt SHALL emit a structured event to `BLOG_ANALYTICS` via `src/lib/analytics.ts` with fields: `post_id`, `outcome` (success/failed/skipped), `failed_gate` (if applicable), `tokens_used`, `duration_ms`.

#### Scenario: Successful refresh analytics event
- **WHEN** a refresh completes successfully
- **THEN** `BLOG_ANALYTICS` receives an event with `blob4 = 'success'`, `blob2 = 'refresh'`, and non-zero `double1` (duration_ms)
