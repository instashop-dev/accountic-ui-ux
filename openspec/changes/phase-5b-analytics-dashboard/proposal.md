## Why

Phase 4 wired `BLOG_ANALYTICS` (Cloudflare Analytics Engine) into every pipeline stage, but operators have no way to read that data back — the admin has Queue, Jobs, Settings, and Prompts pages, but nothing that shows pipeline health, failure rates, token spend, or quality trends. Without a dashboard, the telemetry is write-only and useless for diagnosing problems or controlling cost.

## What Changes

- `src/pages/admin/analytics.astro` — new admin page: queries the Cloudflare Analytics Engine SQL API and renders summary metrics (pipeline throughput, outcome breakdown, avg token usage, avg quality score, stage failure rates, recent failures) plus operational health indicators (last successful publish, queue backlog age, fallback spike, token spike, publish failure streak)
- `src/pages/admin/api/analytics.ts` — new JSON API endpoint that performs the Analytics Engine SQL queries server-side and returns structured data; enforces a 10-second query timeout; decouples data fetching from the Astro page render; returns `X-Robots-Tag: noindex` and `Cache-Control: private, no-store` headers
- All existing admin pages gain an "Analytics" nav link to the new page — one-line additive change to each header

No new npm packages, no D1 schema changes, no changes to pipeline workers or lib modules.

## Capabilities

### New Capabilities

- `analytics-dashboard`: Admin page at `/admin/analytics` that surfaces pipeline health metrics from the `BLOG_ANALYTICS` Analytics Engine dataset — shows 7-day throughput, outcome distribution (success / failure / skipped / fallback), per-stage failure rates, avg token usage, avg quality score, a table of recent failures with their `failed_gate` and `reason` fields, and an operational health panel covering last successful publish timestamp, queue backlog age, fallback spike detection (≥3 fallbacks in 1 hour), token spike detection (avg tokens > 2× 7-day baseline), and publish failure streak (consecutive publish failures)

### Modified Capabilities

- `admin-nav`: Each existing admin page (`queue.astro`, `jobs.astro`, `settings.astro`, `prompts.astro`) gains an "Analytics" link in its `<header>` nav — purely additive, no behavior change

## Impact

- **`src/pages/admin/analytics.astro`**: New file; server-renders the dashboard shell and fetches data from `/admin/api/analytics`
- **`src/pages/admin/api/analytics.ts`**: New file; Cloudflare Pages Function that calls the Analytics Engine SQL API (`https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql`) using `CF_API_TOKEN` and `CF_ACCOUNT_ID` secrets already present in `wrangler.jsonc` env
- **`src/pages/admin/queue.astro`, `jobs.astro`, `settings.astro`, `prompts.astro`**: One `<a href="/admin/analytics">Analytics</a>` added to each header nav
- **Cloudflare Analytics Engine**: Read-only SQL queries against `BLOG_ANALYTICS` dataset — no writes, no schema changes
- **Secrets**: Requires `CF_API_TOKEN` (with Analytics Engine read permission) and `CF_ACCOUNT_ID` to be set as Cloudflare Workers secrets — may need to be provisioned if not already present
- **Production runtime**: New SSR page and API endpoint; no impact on pipeline workers or blog content generation
