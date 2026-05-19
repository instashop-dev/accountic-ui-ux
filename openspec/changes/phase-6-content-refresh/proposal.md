## Why

The cron handler already dispatches `refreshMessage` for posts older than 60 days, but no worker handles `stage: 'refresh'` messages — they land in `blog-pipeline` and are silently dropped. Refresh jobs, R2 snapshot backups, and a rollback path are all specified as Definition-of-Done requirements in the project overview but have never been implemented. Phase 6 closes this gap.

## What Changes

- `src/workers/pipeline/refresh.ts` — new Queue consumer worker that handles `stage: 'refresh'` messages: fetches the current post from GitHub, snapshots it to R2, regenerates the article via the existing AI pipeline (outline → article → humanizer quality gates), and re-publishes over the existing MDX file
- `src/workers/pipeline/cron.ts` — updated: daily refresh cron sends to `BLOG_REFRESH_QUEUE` instead of `BLOG_PIPELINE_QUEUE` (dedicated queue prevents refresh traffic from starving new-article generation)
- `src/lib/snapshot.ts` — new library module: R2 read/write helpers for MDX snapshots keyed by `{post_id}/{timestamp}.mdx` — used by refresh worker before overwriting and by the admin restore endpoint
- `src/pages/admin/refresh.astro` — new admin page: lists posts due for refresh (last refreshed > 60 days or never), shows refresh job history, supports manual trigger and snapshot restore
- `src/pages/admin/api/refresh.ts` — new API endpoint: handles POST `/admin/api/refresh` (enqueue a manual refresh job) and POST `/admin/api/refresh/restore` (restore a post from R2 snapshot)
- `migrations/006_refresh.sql` — new additive D1 migration: adds `last_refreshed_at` (TEXT nullable) and `refresh_count` (INTEGER DEFAULT 0) columns to `posts`; adds `refresh_jobs` table for per-job audit trail
- `wrangler.jsonc` — adds `blog-refresh` queue producer + consumer binding; adds `BLOG_ASSETS` binding reference to refresh worker env
- Existing admin pages (`queue.astro`, `jobs.astro`, `analytics.astro`, `settings.astro`, `prompts.astro`) — add "Refresh" nav link (one-line additive change to each)

## Capabilities

### New Capabilities

- `content-refresh-worker`: Queue-driven Worker that regenerates stale AI-authored posts (>60 days since last refresh), backs up the current MDX to R2 before overwriting, and re-runs existing quality gates before committing the updated file to GitHub
- `refresh-snapshot`: R2-backed snapshot system that saves a timestamped copy of every post MDX before it is refreshed, enabling point-in-time restore from the admin dashboard
- `admin-refresh`: Admin page at `/admin/refresh` that surfaces posts due for refresh, shows per-post refresh history with snapshot links, and provides manual trigger and restore actions

### Modified Capabilities

- `ai-pipeline-workers`: Cron handler updated to route daily refresh scan to `BLOG_REFRESH_QUEUE` instead of `BLOG_PIPELINE_QUEUE`, preventing refresh traffic from blocking topic-discovery and article-generation messages
- `admin-nav`: Each existing admin page gains a "Refresh" link in its `<header>` nav — purely additive

## Impact

- **`src/workers/pipeline/refresh.ts`**: New file; depends on `BLOG_DB`, `BLOG_REFRESH_QUEUE`, `BLOG_ASSETS` (R2), `BLOG_ANALYTICS`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`
- **`src/workers/pipeline/cron.ts`**: Single line change — `BLOG_PIPELINE_QUEUE.send(refreshMessage(...))` → `BLOG_REFRESH_QUEUE.send(refreshMessage(...))`; requires `BLOG_REFRESH_QUEUE` binding in env
- **`src/lib/snapshot.ts`**: New file; depends only on `BLOG_ASSETS` R2 binding — no new npm packages
- **`src/pages/admin/refresh.astro`** + **`src/pages/admin/api/refresh.ts`**: New files; admin auth enforced by existing `src/middleware.ts`
- **`migrations/006_refresh.sql`**: Additive — no existing column changes; rollback file cleans up new columns and table
- **`wrangler.jsonc`**: New `blog-refresh` entry in `queues.producers` and `queues.consumers` (pattern identical to existing `blog-humanize` consumer)
- **Cloudflare Queues**: `blog-refresh` queue must be created via `wrangler queues create blog-refresh` before deploy
- **R2**: Uses existing `accountic-blog-assets` bucket (already provisioned); snapshot keys namespaced under `snapshots/{post_id}/` to avoid collision with future blog assets
- **D1**: `posts.last_refreshed_at` populated by refresh worker on each successful refresh; used by cron stale-post query and admin refresh page
- **Production runtime**: Zero impact on new-article pipeline; refresh traffic flows through a separate queue
