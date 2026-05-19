## Why

Two visible errors surfaced during admin panel testing: the Refresh page crashes with a D1 schema error because migration `006_refresh.sql` hasn't been applied locally, and the Analytics nav link leads to a 404 because the page is gated behind an env flag that isn't set. Both make the admin panel look broken and block testing.

## What Changes

- Apply migration `006_refresh.sql` to the local D1 database to add `last_refreshed_at` and `refresh_count` columns to `posts` and create the `refresh_jobs` table
- Add `ANALYTICS_ENABLED=true` to `.dev.vars` so the Analytics page is accessible during local testing
- Hide the Analytics nav link conditionally when `ANALYTICS_ENABLED` is not set, so the link never leads to a 404 in any environment

## Capabilities

### New Capabilities

### Modified Capabilities
- `admin-analytics-gate`: The analytics nav link now reflects the gate state — hidden when disabled, visible when enabled

## Impact

- `migrations/006_refresh.sql` — needs to be applied locally via wrangler
- `.dev.vars` — add `ANALYTICS_ENABLED=true`
- Admin nav (shared across all admin `.astro` pages) — conditionally render the Analytics link
