## 1. Infrastructure & Schema

- [x] 1.1 Create `wrangler queues create blog-refresh` command in `docs/ops-runbook.md` and add `blog-refresh` producer + consumer bindings to `wrangler.jsonc` (pattern identical to existing `blog-humanize` consumer: `max_batch_size: 1`, `max_batch_timeout: 30`, `max_retries: 3`)
- [x] 1.2 Create `migrations/006_refresh.sql`: add `last_refreshed_at TEXT` and `refresh_count INTEGER NOT NULL DEFAULT 0` columns to `posts`; create `refresh_jobs` table (`id TEXT PRIMARY KEY`, `post_id TEXT NOT NULL`, `status TEXT NOT NULL`, `failed_gate TEXT`, `tokens_used INTEGER`, `duration_ms INTEGER`, `created_at TEXT DEFAULT datetime('now')`) with index on `post_id`
- [x] 1.3 Create `migrations/006_rollback.sql`: drop `refresh_jobs` table and new `posts` columns
- [x] 1.4 Document migration steps and queue provisioning in `docs/ops-runbook.md` under a new "Phase 6 Deployment" section

## 2. Snapshot Library

- [x] 2.1 Create `src/lib/snapshot.ts` with `saveSnapshot(r2, postId, mdxContent)` — writes to `snapshots/{postId}/{isoTimestamp}.mdx` and returns the R2 key
- [x] 2.2 Add `listSnapshots(r2, postId)` to `src/lib/snapshot.ts` — lists keys under `snapshots/{postId}/` prefix, returns array sorted descending by key (most recent first)
- [x] 2.3 Add `loadSnapshot(r2, key)` to `src/lib/snapshot.ts` — reads and returns MDX content string, or `null` if key does not exist
- [x] 2.4 Add `pruneSnapshots(r2, postId, keepCount = 5)` to `src/lib/snapshot.ts` — deletes all but the most recent `keepCount` snapshots for a post
- [x] 2.5 Create `src/lib/snapshot.test.ts` with unit tests for all four functions using R2 stub objects

## 3. Refresh Queue Type

- [x] 3.1 Add `RefreshMessage` type (`{ stage: 'refresh'; post_id: string }`) to `src/lib/queue.ts` if not already defined; verify `refreshMessage(postId)` factory function exists and returns the correct shape

## 4. Cron Handler Update

- [x] 4.1 Update `src/workers/pipeline/cron.ts`: add `BLOG_REFRESH_QUEUE: Queue` to `Env` interface
- [x] 4.2 Change the daily refresh dispatch in `cron.ts` from `env.BLOG_PIPELINE_QUEUE.send(refreshMessage(post.id))` to `env.BLOG_REFRESH_QUEUE?.send(refreshMessage(post.id))` with a fallback warning log if the binding is absent

## 5. Refresh Worker

- [x] 5.1 Create `src/workers/pipeline/refresh.ts` with `Env` interface including `BLOG_DB`, `BLOG_REFRESH_QUEUE`, `BLOG_ASSETS`, `BLOG_ANALYTICS`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`
- [x] 5.2 Implement emergency-stop check at worker entry (reuse `checkEmergencyStop` from `src/lib/safety.ts`) — ack and skip if active
- [x] 5.3 Implement source guard: fetch post from D1 by `post_id`; ack and skip if `source !== 'ai'` or post not found
- [x] 5.4 Implement pre-refresh snapshot: fetch current MDX from GitHub API for the post's slug path, call `saveSnapshot`, store the R2 key in a local variable for the `refresh_jobs` insert
- [x] 5.5 Implement regeneration: fetch the post's original `outline_id` from `drafts` table, run `createAIClient(env).generate(...)` with the existing article prompt, producing a new draft body
- [x] 5.6 Run `scoreArticle` on the new draft body; on failure insert a `refresh_jobs` row with `status = 'failed'`, `failed_gate = 'quality'`, log to `BLOG_ANALYTICS`, and ack without overwriting
- [x] 5.7 Run humanizer pass (reuse `humanizeContent` logic from `src/workers/pipeline/humanizer.ts`); validate score post-humanization
- [x] 5.8 Run `checkRegression` (from `src/lib/regression.ts`) comparing new body to original GitHub content; on failure insert `refresh_jobs` with `failed_gate = 'regression'`, log, ack
- [x] 5.9 On all gates passing: commit updated MDX to GitHub via the same `commitFile` helper used in `publisher.ts`; update `posts.last_refreshed_at = datetime('now')` and increment `posts.refresh_count`; insert `refresh_jobs` success row; call `pruneSnapshots`; log success to `BLOG_ANALYTICS`
- [x] 5.10 Wrap the entire worker body in try/catch; on unhandled error insert a `refresh_jobs` failure row and log to `BLOG_ANALYTICS` before rethrowing (so Cloudflare Queues can retry)

## 6. Admin API Endpoint

- [x] 6.1 Create `src/pages/admin/api/refresh.ts` with a GET handler stub (returns method-not-allowed) and a POST handler
- [x] 6.2 Implement POST `/admin/api/refresh`: parse `post_id` from request body, validate post exists with `source = 'ai'` in D1, enqueue to `BLOG_REFRESH_QUEUE`, return `{ queued: true }`; return `{ error: string }` for invalid inputs
- [x] 6.3 Add `POST /admin/api/refresh/restore` route in the same file: parse `{ post_id, snapshot_key }`, call `loadSnapshot`, commit MDX to GitHub, return `{ restored: true, commit_sha }` or `{ error }` on failure
- [x] 6.4 Verify both endpoints are covered by `src/middleware.ts` admin auth (trace route matching to confirm no bypass)

## 7. Admin Refresh Page

- [x] 7.1 Create `src/pages/admin/refresh.astro` with `export const prerender = false`
- [x] 7.2 Query D1 in frontmatter for stale posts: `SELECT id, slug, title, published_at, last_refreshed_at, refresh_count FROM posts WHERE source = 'ai' AND status = 'published' AND (last_refreshed_at IS NULL OR last_refreshed_at < datetime('now', '-60 days')) ORDER BY COALESCE(last_refreshed_at, published_at) ASC LIMIT 50`
- [x] 7.3 Query D1 for recent refresh jobs: `SELECT rj.post_id, p.slug, rj.status, rj.failed_gate, rj.duration_ms, rj.created_at FROM refresh_jobs rj JOIN posts p ON p.id = rj.post_id ORDER BY rj.created_at DESC LIMIT 20`
- [x] 7.4 Render page header nav (Queue | Jobs | Analytics | Refresh | Settings | Prompts) matching the existing indigo header pattern; mark "Refresh" as active
- [x] 7.5 Render stale-posts table with columns: Title, Slug, Published, Last Refreshed (or "Never"), Refresh Count, Trigger button; show empty state "No posts due for refresh" when list is empty
- [x] 7.6 Render Recent Refresh Jobs table with status badges (green/red) and truncated duration display
- [x] 7.7 Add client-side JS for the "Trigger Refresh" button: POST to `/admin/api/refresh`, show inline success/error feedback per row without full page reload
- [x] 7.8 Add snapshot count display per stale-post row by calling `listSnapshots` in frontmatter for each post (limit to 5 most recent); render a "Restore" modal/section showing timestamped options

## 8. Nav Updates to Existing Admin Pages

- [x] 8.1 Add `<a href="/admin/refresh">Refresh</a>` to the header nav in `src/pages/admin/queue.astro` (after "Analytics", before "Settings")
- [x] 8.2 Add `<a href="/admin/refresh">Refresh</a>` to the header nav in `src/pages/admin/jobs.astro`
- [x] 8.3 Add `<a href="/admin/refresh">Refresh</a>` to the header nav in `src/pages/admin/analytics.astro`
- [x] 8.4 Add `<a href="/admin/refresh">Refresh</a>` to the header nav in `src/pages/admin/settings.astro`
- [x] 8.5 Add `<a href="/admin/refresh">Refresh</a>` to the header nav in `src/pages/admin/prompts.astro`

## 9. Tests

- [x] 9.1 Create `src/workers/pipeline/refresh.test.ts`: test emergency-stop skip, source-guard skip, quality-gate failure path, regression-gate failure path, and success path (GitHub commit + D1 update + pruneSnapshots called)
- [x] 9.2 Extend `src/lib/snapshot.test.ts` (from task 2.5) to cover prune behaviour with >keepCount snapshots
- [x] 9.3 Run `npm test` and confirm all new and existing tests pass

## 10. Verification

- [x] 10.1 Apply `migrations/006_refresh.sql` to local D1 (`wrangler d1 execute BLOG_DB --file=migrations/006_refresh.sql`) and confirm schema changes land without error
- [x] 10.2 Run `npm run build` and confirm no TypeScript errors in new files
- [ ] 10.3 Manually trigger a refresh via `/admin/refresh` against a staging post; confirm snapshot appears in R2 under `snapshots/{post_id}/`, `refresh_jobs` row is inserted, and `posts.last_refreshed_at` is updated
- [ ] 10.4 Confirm "Refresh" nav link appears on all five existing admin pages
- [ ] 10.5 Confirm no regressions on Queue, Jobs, Analytics, Settings, and Prompts pages
- [x] 10.6 Add Phase 6 migration and queue-provisioning steps to `docs/ops-runbook.md`
