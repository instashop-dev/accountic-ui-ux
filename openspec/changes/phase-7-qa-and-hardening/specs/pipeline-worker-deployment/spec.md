## ADDED Requirements

### Requirement: Pipeline worker entry point dispatches to stage handlers
`src/workers/pipeline/index.ts` SHALL export a default object with a `queue` handler and a `scheduled` handler. The `queue` handler SHALL inspect `batch.queue` and delegate to the appropriate per-stage worker handler. The `scheduled` handler SHALL delegate to the cron handler in `src/workers/pipeline/cron.ts`.

#### Scenario: Queue dispatcher routes blog-pipeline messages
- **WHEN** a message arrives on the `blog-pipeline` queue
- **THEN** the dispatcher calls the topic-discovery or outline-generation handler depending on the message's `stage` field

#### Scenario: Queue dispatcher routes blog-humanize messages
- **WHEN** a message arrives on the `blog-humanize` queue
- **THEN** the dispatcher calls the humanizer handler

#### Scenario: Queue dispatcher routes blog-publish messages
- **WHEN** a message arrives on the `blog-publish` queue
- **THEN** the dispatcher calls the publisher handler

#### Scenario: Queue dispatcher routes blog-refresh messages
- **WHEN** a message arrives on the `blog-refresh` queue
- **THEN** the dispatcher calls the refresh handler

#### Scenario: Scheduled event delegates to cron handler
- **WHEN** a cron trigger fires
- **THEN** the dispatcher calls the cron `scheduled` handler with the event and env

### Requirement: Pipeline worker has a dedicated wrangler configuration
`wrangler.pipeline.jsonc` SHALL declare a Cloudflare Worker named `accountic-blog-pipeline` with `src/workers/pipeline/index.ts` as its `main` entrypoint. It SHALL declare queue consumer bindings for all four queues (`blog-pipeline`, `blog-humanize`, `blog-publish`, `blog-refresh`) and all required resource bindings (`BLOG_DB`, `BLOG_KV`, `BLOG_ASSETS`, `BLOG_ANALYTICS`, `BLOG_PIPELINE_QUEUE`, `BLOG_HUMANIZE_QUEUE`, `BLOG_PUBLISH_QUEUE`, `BLOG_REFRESH_QUEUE`). It SHALL declare the cron triggers (`0 3 * * 1`, `0 4 * * *`) that were previously in `wrangler.jsonc`.

#### Scenario: Wrangler can deploy the pipeline worker
- **WHEN** `wrangler deploy --config wrangler.pipeline.jsonc` is run
- **THEN** the Worker is deployed to Cloudflare without errors

#### Scenario: Queue consumers are registered for all queues
- **WHEN** the pipeline worker is deployed
- **THEN** the Cloudflare Queues dashboard shows a consumer registered for `blog-pipeline`, `blog-humanize`, `blog-publish`, and `blog-refresh`

#### Scenario: Cron triggers are registered for the pipeline worker
- **WHEN** the pipeline worker is deployed
- **THEN** the Cloudflare Workers dashboard shows the Monday 03:00 UTC and daily 04:00 UTC cron triggers attached to `accountic-blog-pipeline`

### Requirement: Astro worker no longer declares cron triggers
`wrangler.jsonc` SHALL NOT contain a `triggers.crons` block after this change. Cron triggers belong exclusively to the pipeline worker.

#### Scenario: Astro worker builds and deploys without cron config
- **WHEN** `wrangler deploy --config wrangler.jsonc` is run after removing the triggers block
- **THEN** the Astro site deploys successfully with no warnings about undefined handlers
