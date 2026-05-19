## 1. Secrets & Pre-flight

- [x] 1.1 Verify `CF_API_TOKEN` and `CF_ACCOUNT_ID` are provisioned as Wrangler secrets (`wrangler secret list`); document in `docs/ops-runbook.md` if missing
- [x] 1.2 Confirm Analytics Engine dataset `blog-pipeline-events` has data by running a manual SQL query via `wrangler analytics engine sql "SELECT count() FROM blog-pipeline-events LIMIT 1"`

## 2. Analytics JSON API Endpoint

- [x] 2.1 Create `src/pages/admin/api/analytics.ts` — Cloudflare Pages Function (GET handler) that reads `CF_API_TOKEN` and `CF_ACCOUNT_ID` from env
- [x] 2.2 Implement missing-secrets guard: return `{ error: "Analytics Engine not configured" }` if either secret is absent
- [x] 2.3 Implement the summary query: `SELECT count(), countIf(blob4='success'), countIf(blob4='failure'), countIf(blob4='skipped'), countIf(blob4='fallback'), avg(double1), avg(double2), avg(double3) FROM blog-pipeline-events WHERE timestamp > NOW() - INTERVAL '7' DAY`
- [x] 2.4 Implement the per-stage breakdown query: `SELECT blob2, count(), countIf(blob4='failure') FROM blog-pipeline-events WHERE timestamp > NOW() - INTERVAL '7' DAY GROUP BY blob2`
- [x] 2.5 Implement the recent-failures query: `SELECT blob3, blob2, blob6, blob5, toDateTime(timestamp) FROM blog-pipeline-events WHERE blob4='failure' AND timestamp > NOW() - INTERVAL '7' DAY ORDER BY timestamp DESC LIMIT 20`
- [x] 2.6 Wrap all Analytics Engine fetch calls with `AbortSignal.timeout(10_000)`; return `{ error: "Analytics Engine query timed out" }` on abort
- [x] 2.7 Set `X-Robots-Tag: noindex` and `Cache-Control: private, no-store` on every response from `/admin/api/analytics` (including error responses)
- [x] 2.8 Map query results to the typed response shape defined in the spec; wrap any fetch or parse error in `{ error: string }` (always return HTTP 200)
- [x] 2.9 Add operational health queries: (a) last successful publish timestamp via `SELECT max(timestamp) FROM blog-pipeline-events WHERE blob2='publisher' AND blob4='success'`; (b) 24h vs 7d token avg for spike detection; (c) recent publisher outcome sequence for failure streak detection; (d) fallback cluster count within rolling 1-hour windows
- [x] 2.10 Include operational health fields in the response shape: `last_publish_ts`, `fallback_spike`, `token_spike`, `publish_failure_streak`, `queue_backlog_age_mins`

## 3. Analytics Dashboard Page

- [x] 3.1 Create `src/pages/admin/analytics.astro` with `export const prerender = false`
- [x] 3.2 Fetch `/admin/api/analytics` in the Astro frontmatter using `fetch()` inside a try/catch; handle both the success shape and `{ error }` shape without propagating exceptions to the Workers runtime
- [x] 3.3 Render the page header nav (Queue | Jobs | Analytics | Settings | Prompts) matching the existing indigo header pattern
- [x] 3.4 Render four summary metric cards: Total Events (7d), Success Rate (%), Avg Tokens Used, Avg Quality Score — show "—" for each if data is unavailable
- [x] 3.5 Render the per-stage breakdown table (Stage | Total | Failures | Failure Rate) with inline color coding for failure rates > 20%
- [x] 3.6 Render the Recent Failures table (Article ID | Stage | Failed Gate | Reason | Timestamp) or "No failures in the last 7 days" message; truncate `reason` values at 500 characters with ellipsis
- [x] 3.7 Render the missing-secrets/error banner when `data.error` is set — styled consistent with existing `.error` class in other admin pages
- [x] 3.8 Render the Operational Health panel with five indicators: Last Successful Publish, Queue Backlog Age, Fallback Spike (warning if detected), Token Spike (warning if 24h avg > 2× 7d baseline), Publish Failure Streak (red if ≥3 consecutive failures)

## 4. Nav Updates to Existing Admin Pages

- [x] 4.1 Add `<a href="/admin/analytics">Analytics</a>` to the header nav in `src/pages/admin/queue.astro` (after "Jobs", before "Settings")
- [x] 4.2 Add `<a href="/admin/analytics">Analytics</a>` to the header nav in `src/pages/admin/jobs.astro`
- [x] 4.3 Add `<a href="/admin/analytics">Analytics</a>` to the header nav in `src/pages/admin/settings.astro`
- [x] 4.4 Add `<a href="/admin/analytics">Analytics</a>` to the header nav in `src/pages/admin/prompts.astro`

## 5. Security & Resilience Hardening

- [x] 5.1 Confirm `/admin/analytics` and `/admin/api/analytics` are covered by `src/middleware.ts` admin auth check — trace the middleware route matching logic to verify no bypass
- [x] 5.2 Verify `X-Robots-Tag: noindex` and `Cache-Control: private, no-store` are present on `/admin/analytics` page responses and `/admin/api/analytics` JSON responses (check via `curl -I` or browser DevTools)
- [x] 5.3 Confirm `reason` values longer than 500 chars are truncated in the Recent Failures table — test with a synthetic long string in a fixture event
- [x] 5.4 Confirm that killing the Analytics Engine fetch (e.g. invalid token) shows an error banner on the analytics page but does NOT affect `/admin/queue` or any other admin page loaded in the same session

## 6. Verification

- [ ] 6.1 Deploy to Cloudflare Workers (`npm run deploy` or `wrangler deploy`) and navigate to `/admin/analytics` — confirm metric cards and Operational Health panel render with real data
- [ ] 6.2 Temporarily unset `CF_API_TOKEN` secret and reload — confirm the warning banner appears and no broken UI
- [ ] 6.3 Verify the "Analytics" nav link appears and is functional on all four existing admin pages
- [ ] 6.4 Confirm no regressions on Queue, Jobs, Settings, and Prompts pages
- [ ] 6.5 Confirm Operational Health panel shows "Last successful publish" with a real timestamp, and all five indicators render without error
<!-- Tasks 6.x require a live Cloudflare deployment with CF_API_TOKEN + CF_ACCOUNT_ID secrets provisioned -->
