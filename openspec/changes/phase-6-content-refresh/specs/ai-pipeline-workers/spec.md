## MODIFIED Requirements

### Requirement: Cron routes refresh messages to dedicated queue
The daily refresh cron handler (cron expression `0 4 * * *` in `src/workers/pipeline/cron.ts`) SHALL send refresh messages to `BLOG_REFRESH_QUEUE` instead of `BLOG_PIPELINE_QUEUE`. The `Env` interface in `cron.ts` SHALL be updated to include `BLOG_REFRESH_QUEUE: Queue`.

#### Scenario: Daily cron fires and stale posts exist
- **WHEN** the `0 4 * * *` cron fires and D1 contains posts where `updated_at < now - 60 days` and `source = 'ai'`
- **THEN** the cron sends one `{ stage: 'refresh', post_id }` message to `BLOG_REFRESH_QUEUE` per stale post (not to `BLOG_PIPELINE_QUEUE`)

#### Scenario: Daily cron fires and no stale posts exist
- **WHEN** the `0 4 * * *` cron fires and all AI posts have been refreshed recently
- **THEN** no messages are enqueued and the cron logs `[cron] 0 refresh messages dispatched`

#### Scenario: BLOG_REFRESH_QUEUE binding is absent
- **WHEN** the `BLOG_REFRESH_QUEUE` binding is not available in the env (misconfigured deploy)
- **THEN** the cron logs a warning and skips the refresh dispatch without throwing
