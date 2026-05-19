## 1. Pipeline Worker Entry Point

- [x] 1.1 Create `src/workers/pipeline/index.ts`: export a default object with `scheduled` and `queue` handlers; the `scheduled` handler delegates to `cron.ts`'s `scheduled` function; the `queue` handler maps `batch.queue` to the appropriate worker handler (`blog-pipeline` → topic-discovery/outline-generation, `blog-humanize` → humanizer, `blog-publish` → publisher, `blog-refresh` → refresh)
- [x] 1.2 Verify `src/workers/pipeline/index.ts` compiles cleanly: run `npx tsc --noEmit` and confirm no errors in the new file or its imports
- [x] 1.3 Add a unit test `src/workers/pipeline/index.test.ts` that stubs each sub-handler and confirms the dispatcher routes a `blog-pipeline` message, a `blog-humanize` message, a `blog-publish` message, and a `blog-refresh` message to the correct handler; confirm a `scheduled` event delegates to the cron handler

## 2. Wrangler Pipeline Configuration

- [x] 2.1 Create `wrangler.pipeline.jsonc`: set `name = "accountic-blog-pipeline"`, `main = "src/workers/pipeline/index.ts"`, `compatibility_date` matching `wrangler.jsonc`; add D1, KV, R2, Analytics Engine, and all four queue producer bindings (copying IDs/names from `wrangler.jsonc`); add four queue consumer entries for `blog-pipeline`, `blog-humanize`, `blog-publish`, `blog-refresh`; add `triggers.crons` with `"0 3 * * 1"` and `"0 4 * * *"`
- [x] 2.2 Remove the `triggers.crons` block from `wrangler.jsonc` (crons now live in the pipeline worker)
- [x] 2.3 Run `wrangler deploy --config wrangler.pipeline.jsonc --dry-run` and confirm it exits 0 with no errors

## 3. CI/CD Update

- [x] 3.1 Update `.github/workflows/deploy.yml`: after the existing `npx wrangler deploy` step, add a second step `npx wrangler deploy --config wrangler.pipeline.jsonc` with the same `CLOUDFLARE_API_TOKEN` env var; update the comment block at the top to note both workers
- [x] 3.2 Confirm the deploy job still has `needs: [test]` so tests must pass before any deploy step runs

## 4. Missing npm Scripts

- [x] 4.1 Add `"blog:deploy": "wrangler deploy --config wrangler.pipeline.jsonc"` to `package.json`
- [x] 4.2 Add `"blog:provision": "wrangler queues create blog-pipeline && ..."` to `package.json`
- [x] 4.3 Add `"blog:generate": "wrangler queues send blog-pipeline --message-body ..."` to `package.json`
- [x] 4.4 Add `"blog:refresh"` note to ops-runbook (manual step — no npm script equivalent for refresh scan trigger)
- [x] 4.5 Add `"db:migrate:phase5"` — skipped: migrations/005 is test-fixtures only, not a production migration; documented in runbook instead
- [x] 4.6 Add `"db:migrate:phase6"` and `"db:rollback:phase6"` to `package.json`

## 5. Ops Runbook Updates

- [x] 5.1 Add "Phase 6 Deployment" section to `docs/ops-runbook.md` covering: `wrangler queues create blog-refresh`, apply `migrations/006_refresh.sql`, and deploy pipeline worker via `npm run blog:deploy`
- [x] 5.2 Add "Pipeline Worker" section to `docs/ops-runbook.md` explaining the two-worker architecture, how to check both are deployed, and how to roll back the pipeline worker
- [x] 5.3 Add "Admin Login" section to `docs/ops-runbook.md` documenting the cookie-based auth flow, how `ADMIN_TOKEN` is used, and the `/admin/login` / `/admin/logout` routes

## 6. Admin Nav Verification & Fixes

- [x] 6.1 Audit each of the six admin pages (`queue.astro`, `jobs.astro`, `analytics.astro`, `refresh.astro`, `settings.astro`, `prompts.astro`) and confirm the header nav contains all six links: Queue, Jobs, Analytics, Refresh, Settings, Prompts — fix any missing links
- [x] 6.2 Confirm `/admin/login` redirects to `/admin/queue` after successful authentication (review `login.astro` redirect logic and fix if it points elsewhere)
- [x] 6.3 Confirm `src/middleware.ts` protects all `/admin/*` routes except `/admin/login` and `/admin/logout` — add any missing exclusions

## 7. Build & Test Verification

- [x] 7.1 Run `npm test` and confirm all tests pass including the new dispatcher test from task 1.3
- [x] 7.2 Run `npm run build` and confirm the Astro build completes without TypeScript errors
- [x] 7.3 Run `wrangler deploy --config wrangler.pipeline.jsonc --dry-run` to confirm the pipeline worker bundles cleanly after all changes

## 8. Production Deployment & Verification

- [ ] 8.1 Push to `main` and confirm both `wrangler deploy` steps in CI pass; verify `accountic-blog-pipeline` Worker appears in the Cloudflare dashboard
- [ ] 8.2 Verify in the Cloudflare Queues dashboard that all four queues show a consumer registered
- [ ] 8.3 Work through all 11 steps of `docs/staging-verification-analytics.md` against production — provision `CF_API_TOKEN` and `CF_ACCOUNT_ID` secrets, flip `ANALYTICS_ENABLED`, verify auth gating, security headers, dashboard render, and nav links
- [ ] 8.4 Seed analytics test data on production: `POST /admin/api/analytics-seed` with `STAGING_SEED_TOKEN`; wait 90 seconds; confirm the analytics dashboard shows populated metrics
- [ ] 8.5 Manually trigger a content refresh from `/admin/refresh` on production; confirm a `refresh_jobs` row is inserted in D1 and the post's `last_refreshed_at` is updated
- [ ] 8.6 Confirm no regressions on Queue, Jobs, Settings, and Prompts pages after all changes
- [ ] 8.7 Remove `STAGING_SEED_TOKEN` secret after verification: `wrangler secret delete STAGING_SEED_TOKEN`
