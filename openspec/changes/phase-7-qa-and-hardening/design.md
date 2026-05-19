## Context

The Accountic blog automation system spans two runtime boundaries:

1. **Astro Worker** (`wrangler.jsonc`) — the Cloudflare Worker that serves the website and admin UI. Built by `@astrojs/cloudflare` and deployed via `npm run build && wrangler deploy`. It owns the cron triggers defined in `wrangler.jsonc`.

2. **Pipeline Workers** (`src/workers/pipeline/*.ts`) — six independent queue-consumer workers (topic-discovery, outline-generation, article-generation, humanizer, publisher, refresh) plus a cron handler. These exist as well-tested TypeScript modules but have **no wrangler configuration and no deployment path**. The queue consumer bindings were removed from `wrangler.jsonc` in an earlier commit because `@astrojs/cloudflare`'s entry point does not export a `queue` handler. As a result, queue messages are produced but never consumed — the entire pipeline is dead in production.

Secondary gaps: missing npm run scripts (`blog:provision`, `blog:deploy`, `blog:generate`, `blog:refresh`), migration scripts for phases 5 and 6, and documentation gaps in the ops runbook.

## Goals / Non-Goals

**Goals:**
- Deploy the pipeline workers so queue messages are actually consumed in production
- Wire the cron handler so scheduled topics/refreshes execute
- Add the missing ops scripts that the project overview requires
- Verify every admin page and nav link works end-to-end in staging
- Work through and close the open verification tasks from Phase 6

**Non-Goals:**
- Logic changes to any pipeline worker (pure deployment configuration, not feature work)
- New admin features beyond confirming existing ones work
- Refactoring the worker architecture into microservices

## Decisions

### D1: Single pipeline worker entry point rather than one worker per queue

**Decision:** Create `src/workers/pipeline/index.ts` as a single dispatcher entry that exports both `scheduled` and `queue` handlers. The `queue` handler inspects `batch.queue` and delegates to the appropriate per-stage handler.

**Why:** Cloudflare allows one Worker to consume multiple queues. A single deployment is simpler to operate, has one set of bindings to manage, and reduces the surface area of `wrangler.pipeline.jsonc`. It also mirrors the existing code organisation where all pipeline workers share the same `Env` interface shape.

**Alternative considered:** One `wrangler.*.jsonc` per worker. Rejected — five separate deploy steps, five sets of secrets to manage, and no architectural benefit at this traffic volume.

### D2: Separate `wrangler.pipeline.jsonc`, not an additional entrypoint in `wrangler.jsonc`

**Decision:** The pipeline worker is declared in its own `wrangler.pipeline.jsonc` with a distinct `name` (`accountic-blog-pipeline`).

**Why:** `wrangler.jsonc` targets the Astro entrypoint and must not change its `main` field. Cloudflare Workers does not support multiple `main` entrypoints in a single config. Separate configs are the documented pattern for deploying a companion worker alongside an Astro site.

**Alternative considered:** Using Cloudflare Workers Service Bindings to proxy from the Astro worker to a pipeline worker. Rejected — unnecessary complexity for a fire-and-forget queue system.

### D3: Queue dispatcher pattern in `index.ts`

**Decision:** `src/workers/pipeline/index.ts` imports and calls each worker's `queue` handler function directly (not re-exporting the full module `default`). The dispatcher maps `batch.queue` → handler.

**Why:** Each existing worker file exports `export default { queue(...) }`. The dispatcher unwraps that and calls `.queue(batch, env)` directly, keeping all existing worker files unchanged and testable in isolation.

### D4: Cron triggers stay in `wrangler.jsonc` (Astro worker), not the pipeline worker

**Decision:** Remove the `triggers.crons` block from `wrangler.jsonc` and re-declare it in `wrangler.pipeline.jsonc`, since `cron.ts` needs `BLOG_DB` and `BLOG_PIPELINE_QUEUE` bindings that are only available in the pipeline worker.

**Why:** The Astro Worker has no `scheduled` export. Moving crons to the pipeline worker matches its binding set and keeps both workers coherent.

### D5: Production verification before enabling generation

**Decision:** Phase 7 implementation includes a production verification step *before* setting `generation_enabled = true`. All admin and pipeline surfaces are verified in the disabled state first.

**Why:** No content must be generated until the end-to-end path (enqueue → consume → publish) is confirmed working. The D1 master switch (`generation_enabled`) provides the safety gate — the pipeline workers can be live and queue-connected without generating any articles until the switch is flipped.

## Risks / Trade-offs

- **[Risk] Pipeline worker deploy fails while Astro worker succeeds** → The website stays up. Queue consumers go offline. CI is written so both deploy steps are required for the workflow to pass; partial deploy fails the build. To recover, re-run the deploy workflow.
- **[Risk] Cron migration (move triggers from Astro worker to pipeline worker)** → During the deploy window between the two `wrangler deploy` calls, crons will briefly be unregistered. This is acceptable — the cron window (Monday 03:00 UTC, daily 04:00 UTC) is narrow and missing one cycle causes no data loss. Mitigation: deploy during off-hours.
- **[Risk] Staging verification finds a bug in a queue worker** → The fix is applied, tests are updated, and the deploy is re-run. `generation_enabled` remains `false` until verification passes.
- **[Trade-off] Single pipeline worker vs per-stage workers** → A single worker means all queue types share one CPU time budget and deployment unit. At this traffic level (2 articles/day) this is not a concern. Can be split later if needed.

## Migration Plan

1. Add `wrangler.pipeline.jsonc` and `src/workers/pipeline/index.ts` locally; verify `wrangler deploy --config wrangler.pipeline.jsonc --dry-run` passes.
2. Update `.github/workflows/deploy.yml` to add the second deploy step.
3. Remove `triggers.crons` from `wrangler.jsonc`; add to `wrangler.pipeline.jsonc`.
4. Push to main → CI deploys Astro worker first, then pipeline worker.
5. Confirm both workers appear in the Cloudflare dashboard (`accountic-ui-ux` and `accountic-blog-pipeline`).
6. Verify queue consumers are registered for all four queues in the Cloudflare Queues dashboard.
7. Run the analytics dashboard staging verification checklist.
8. Manually trigger a refresh from `/admin/refresh` to exercise the end-to-end refresh path.
9. Once all checks pass, enable generation: `wrangler d1 execute BLOG_DB --remote --command="UPDATE settings SET value='true' WHERE key='generation_enabled'"`.

**Rollback:** Delete the `accountic-blog-pipeline` Worker via `wrangler delete --config wrangler.pipeline.jsonc`. Queue messages accumulate in the queue (they don't drop) until the worker is redeployed. The Astro site is unaffected.

## Open Questions

- None — all architectural decisions are resolved above.
