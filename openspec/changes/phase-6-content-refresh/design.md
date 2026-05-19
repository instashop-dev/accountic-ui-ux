## Context

The project overview (section 39) requires an intelligent content refresh system that updates stale AI-authored posts without mechanical rewriting. The daily cron already identifies posts older than 60 days and dispatches `refreshMessage` to `BLOG_PIPELINE_QUEUE` — but no consumer handles `stage: 'refresh'` messages, so they are silently acked and dropped.

The existing pipeline is a five-stage chain: topic-discovery → outline-generation → article-generation → humanizer → publisher. All stages share `BLOG_PIPELINE_QUEUE` multiplexed by the `stage` field, but only the humanizer consumer is registered in `wrangler.jsonc`. The single `wrangler.jsonc` drives the entire deployment (Astro Pages + Workers).

R2 (`BLOG_ASSETS`) and `BLOG_ANALYTICS` are already provisioned. The publisher commits MDX files to GitHub via API; the refresh worker follows the same pattern.

---

## Goals / Non-Goals

**Goals:**
- Implement `src/workers/pipeline/refresh.ts` that handles `stage: 'refresh'` messages end-to-end
- Snapshot the current post MDX to R2 before overwriting, enabling admin-triggered restore
- Route refresh traffic through a dedicated `blog-refresh` queue to prevent starvation of new-article generation on `blog-pipeline`
- Add `last_refreshed_at` and `refresh_count` to `posts`; add `refresh_jobs` audit table
- Provide an admin UI page (`/admin/refresh`) for manual trigger, stale-post list, and snapshot restore
- Track refresh telemetry in `BLOG_ANALYTICS`
- Write unit tests for the refresh worker and snapshot library

**Non-Goals:**
- AI illustration regeneration (deferred to Phase 7)
- Per-category refresh interval configuration (spec'd in overview but deferred)
- Automatic rollback on post-refresh regression detection (snapshots are manual-restore only in V1)
- Multi-post batch restore from admin UI

---

## Decisions

### Decision 1: Dedicated `blog-refresh` queue vs. routing on `BLOG_PIPELINE_QUEUE`

**Chosen**: Dedicated `blog-refresh` queue.

**Rationale**: The daily refresh scan can queue dozens of posts at once. Multiplexing them on `blog-pipeline` alongside topic-discovery and article-generation messages would compete for the same queue consumer budget (Cloudflare Queues: max 1 concurrent batch per consumer by default). A dedicated queue gives refresh its own consumer slot and allows independent `max_retries` and `max_batch_timeout` tuning. The cron sends one type of message, so stage-based routing adds no value here.

**Alternative considered**: Keep using `BLOG_PIPELINE_QUEUE` and add a `stage: 'refresh'` branch in topic-discovery worker. Rejected: would require modifying topic-discovery.ts to detect and dispatch refresh, coupling two unrelated responsibilities.

### Decision 2: Refresh strategy — regenerate vs. in-place edit

**Chosen**: Regenerate via existing pipeline (outline + article + humanizer quality gates), using the original topic/slug as the anchor.

**Rationale**: Re-running the full generation pipeline reuses all existing quality gates (`scoreArticle`, `checkRegression`, semantic similarity). An in-place edit pass would require a new prompt, new quality thresholds, and a separate testing surface. Reuse minimises new code and ensures refreshed content meets the same bar as original content.

**Alternative considered**: Single-pass "update" prompt that edits the existing MDX. Rejected: harder to test, harder to quality-gate, and produces less thorough updates.

### Decision 3: R2 snapshot key schema

**Chosen**: `snapshots/{post_id}/{iso_timestamp}.mdx`

**Rationale**: Groups all versions of a post under one prefix for easy listing; ISO timestamp sorts lexicographically so the latest snapshot is always the last key in a prefix scan. The admin restore endpoint lists keys with `BLOG_ASSETS.list({ prefix: 'snapshots/{post_id}/' })` and offers the most recent.

### Decision 4: Refresh worker wiring in `wrangler.jsonc`

**Chosen**: Add `blog-refresh` as a new `queues.consumers` entry in the existing `wrangler.jsonc`, identical to the `blog-humanize` consumer pattern.

**Rationale**: The Astro Cloudflare adapter (`@astrojs/cloudflare`) passes queue batches to the Pages Function's `queue` handler. The existing `blog-humanize` consumer proves this pattern works. Adding a second consumer entry for `blog-refresh` follows the same pattern with no architectural changes.

**Caveat**: Cloudflare Pages Functions support multiple queue consumers declared in `wrangler.jsonc`; the adapter routes by `batch.queue` name. The refresh worker entry point exports a `queue` handler that is invoked only when `batch.queue === 'blog-refresh'`.

### Decision 5: Admin restore endpoint — GitHub overwrite vs. queue re-enqueue

**Chosen**: Direct GitHub API overwrite from the admin API endpoint.

**Rationale**: Restore is an operator action that needs immediate feedback. Queuing a restore through the pipeline adds latency and requires a new message type. The publisher worker's GitHub commit logic is extracted so the admin endpoint can reuse the same `commitFile` helper without duplication.

---

## Risks / Trade-offs

**[Risk] Refresh worker regenerates content that is worse than the original** → Mitigation: run `checkRegression` against the original body (fetched from GitHub before snapshotting) after humanizer completes; reject if semantic similarity drops below threshold. Log rejection to `BLOG_ANALYTICS` and leave post status as `published` (no overwrite).

**[Risk] R2 snapshot storage grows unboundedly** → Mitigation: refresh worker deletes snapshots older than 90 days for the same `post_id` after a successful refresh. Admin restore UI shows only the two most recent snapshots.

**[Risk] `blog-refresh` queue consumer not registered in Cloudflare before deploy** → Mitigation: add `wrangler queues create blog-refresh` to the ops runbook and CI pre-deploy check (same pattern as existing queue provisioning steps).

**[Risk] Cron sends to `BLOG_REFRESH_QUEUE` but binding is missing in env** → Mitigation: cron handler already uses defensive `env.BLOG_REFRESH_QUEUE?.send(...)` pattern; add binding to `wrangler.jsonc` in the same commit as the cron change.

**[Risk] Refresh of a post that was manually edited post-publish overwrites human edits** → Mitigation: refresh worker checks `posts.source` field — only refreshes posts where `source = 'ai'`. Any manually edited post should be marked `source = 'manual'` via admin settings (out of scope for Phase 6; documented as a known limitation).

---

## Migration Plan

1. Run `wrangler queues create blog-refresh` (once, production)
2. Apply `migrations/006_refresh.sql` to production D1: `wrangler d1 execute BLOG_DB --remote --file=migrations/006_refresh.sql`
3. Deploy via `git push origin main` — GitHub Actions builds and deploys
4. Verify: trigger a test refresh from `/admin/refresh`; confirm snapshot appears in R2 and refresh job row appears in `refresh_jobs`

**Rollback:**
1. `wrangler d1 execute BLOG_DB --remote --file=migrations/006_rollback.sql`
2. Remove `blog-refresh` queue consumer entry from `wrangler.jsonc` and redeploy
3. Revert cron change to route back to `BLOG_PIPELINE_QUEUE`

---

## Open Questions

- **Refresh interval admin-configurability**: The overview spec (section 44) lists "refresh interval" as an admin-configurable setting. Phase 6 hard-codes 60 days via the cron query. Should Phase 6 also wire the existing `settings` D1 key for `refresh_interval_days`? *Decision deferred — hard-code 60 days in Phase 6; make it configurable in a future settings enhancement.*
- **Snapshot retention**: 90-day TTL chosen arbitrarily. Should this be operator-configurable? *No — keep it simple in Phase 6.*
