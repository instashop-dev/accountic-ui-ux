## 1. Fix Refresh Page — Apply Missing Migration

- [x] 1.1 Run `npx wrangler d1 migrations apply BLOG_DB --local` to apply `006_refresh.sql` locally
- [x] 1.2 Verify `/admin/refresh` loads without the `last_refreshed_at` DB error

## 2. Enable Analytics Locally

- [x] 2.1 Add `ANALYTICS_ENABLED=true` to `.dev.vars`
- [x] 2.2 Verify `/admin/analytics` returns 200 (not 404) after restart

## 3. Conditional Analytics Nav Link

- [x] 3.1 In `src/pages/admin/queue.astro` — read `ANALYTICS_ENABLED` from env and conditionally render the Analytics nav link
- [x] 3.2 In `src/pages/admin/jobs.astro` — same conditional nav change
- [x] 3.3 In `src/pages/admin/settings.astro` — same conditional nav change
- [x] 3.4 In `src/pages/admin/prompts.astro` — same conditional nav change
- [x] 3.5 In `src/pages/admin/refresh.astro` — same conditional nav change

## 4. Verify

- [x] 4.1 Confirm Analytics link appears in nav when `ANALYTICS_ENABLED=true`
- [x] 4.2 Confirm Analytics link is absent in nav when `ANALYTICS_ENABLED` is unset (remove from `.dev.vars` temporarily to test, then restore)
