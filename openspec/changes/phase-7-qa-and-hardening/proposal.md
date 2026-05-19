## Why

Phases 3–6 have been implemented and code-reviewed, all 167 unit tests pass, and the Astro build is clean — but the system has never been verified end-to-end in production. Two blockers make this a prerequisite before any new features: the pipeline queue-consumer workers have no deployment configuration (they exist as code but are never executed), and several admin pages have unverified behaviour (content refresh, analytics dashboard, admin login) that was never exercised in staging.

## What Changes

- `wrangler.pipeline.jsonc` — new wrangler config that deploys all six pipeline workers (cron, topic-discovery, outline-generation, article-generation, humanizer, publisher, refresh) as a single named Cloudflare Worker with queue-consumer bindings for every queue; this is the primary blocker today
- `.github/workflows/deploy.yml` — updated to deploy both the Astro worker and the pipeline worker in sequence
- `package.json` — add the missing `blog:provision`, `blog:deploy`, `blog:generate`, `blog:refresh`, `db:migrate:phase5`, `db:migrate:phase6` scripts specified in the project overview but never wired up
- `docs/ops-runbook.md` — Phase 5 / Phase 6 / Analytics deployment sections; complete the missing migration steps so the runbook reflects reality
- `docs/staging-verification-analytics.md` — mark all checklist steps as completed after staging run
- Bug fixes discovered during end-to-end staging exercise (tracked as they are found)

## Capabilities

### New Capabilities

- `pipeline-worker-deployment`: Standalone Cloudflare Worker that registers as the queue consumer for all blog automation queues (`blog-pipeline`, `blog-humanize`, `blog-publish`, `blog-refresh`); includes cron handler for scheduled triggers; deployed independently of the Astro site worker

### Modified Capabilities

- `cicd-pipeline`: Deploy job gains a second step to deploy the pipeline worker after the Astro worker; both fail the build if either step fails
- `ai-pipeline-workers`: Cron and queue handlers gain a wrangler entry point — no logic changes, just the deployment configuration that makes them runnable
- `admin-nav`: Verification pass to confirm all five admin pages include the full `Queue · Jobs · Analytics · Refresh · Settings · Prompts` nav (this was a Phase 6 deliverable marked open)

## Impact

- **New file `wrangler.pipeline.jsonc`**: Declares the pipeline Worker entry point, all queue consumer bindings, D1/R2/KV/Analytics Engine bindings, and cron trigger — mirrors the existing `wrangler.jsonc` binding set but targets the pipeline module entrypoint
- **`.github/workflows/deploy.yml`**: One additional `wrangler deploy --config wrangler.pipeline.jsonc` step in the deploy job; no changes to the Astro deploy step
- **`package.json`**: `blog:provision` (wrangler queues create), `blog:deploy` (deploy pipeline worker), `db:migrate:phase5`, `db:migrate:phase6` scripts
- **`docs/ops-runbook.md`**: Additive documentation only; no code changes
- **Production runtime**: Pipeline workers become live once deployed; they are already guarded by the `generation_enabled` D1 setting which defaults to `false`
