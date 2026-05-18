## Why

Phase 2 delivered the infrastructure layer (Cloudflare bindings, D1 schema, CI/CD pipeline, shared library utilities) that Phase 3 now builds on. The AI pipeline workers, admin dashboard, and content quality system are the core product value: without them the blog remains manually authored, the content library cannot scale to dominate high-intent Indian tax notice queries, and the competitive moat promised at launch cannot compound.

## What Changes

- `src/workers/pipeline/` — new directory: four Cloudflare Queue consumer workers (topic-discovery, outline-generation, article-generation, publisher) plus a cron trigger handler
- `src/workers/admin/` — new directory: Cloudflare Worker serving the admin dashboard API (article queue, job management, settings, prompt versioning)
- `src/pages/admin/` — new directory: Astro pages for the admin UI (review queue, generation logs, settings, prompt editor) — gated behind middleware auth
- `src/middleware.ts` — new file: Cloudflare-compatible Astro middleware enforcing token-based auth on all `/admin/*` routes; ships atomically with admin pages
- `src/lib/ai.ts` — new file: thin Claude API wrapper with prompt caching, token budget controls, and retry logic
- `src/lib/quality.ts` — new file: content scoring functions (readability, originality, practicality) used by workers to gate publication
- `src/lib/queue.ts` — new file: typed queue message constructors and idempotency helpers for all pipeline stages
- `scripts/seed-topics.ts` — new file: one-time seed of initial topic backlog into D1 (used for launch ramp-up)
- `migrations/002_pipeline.sql` — new file: additive D1 tables for `topics`, `outlines`, `drafts`, and `prompts`; no changes to Phase 2 tables

No existing Astro routes, layouts, components, or design system files are modified. `astro build` and `wrangler deploy` must continue to pass after every task.

## Capabilities

### New Capabilities

- `ai-pipeline-workers`: Queue-driven Cloudflare Workers implementing the four-stage generation pipeline (topic → outline → article → publish) with idempotency, retry, and dead-letter handling
- `admin-dashboard`: Protected admin UI (Astro pages + Worker API) for reviewing drafts, monitoring jobs, managing settings, and editing versioned prompts
- `admin-auth`: Astro middleware enforcing token-based authentication on all `/admin/*` routes; ships atomically with admin pages to prevent public exposure
- `content-quality`: Scoring and gating library (`src/lib/quality.ts`) that enforces readability, originality, and practicality thresholds before any draft advances to publication
- `claude-api-client`: Thin wrapper around the Anthropic SDK (`src/lib/ai.ts`) with prompt caching, daily token budget controls, exponential backoff retry, and structured output parsing
- `pipeline-schema`: Additive D1 migration (`migrations/002_pipeline.sql`) adding `topics`, `outlines`, `drafts`, and `prompts` tables to support full pipeline state tracking

### Modified Capabilities

- `d1-schema`: `generation_jobs` table gains a `stage_payload` (TEXT) column to store per-stage structured data without breaking existing rows or foreign keys

## Impact

- **Cloudflare Workers runtime:** Four new Queue consumers and one cron handler are added; all run in isolated Workers without touching the existing static-site Worker
- **Astro build:** New `/admin/*` pages require `src/middleware.ts` to exist before building; middleware ships in the same task batch
- **`wrangler.jsonc`:** Queue consumer bindings (`blog-pipeline`, `blog-publish`) are upgraded from producer-only stubs to include `consumers` entries pointing to the new worker entry points
- **D1 database:** `migrations/002_pipeline.sql` is additive; `migrations/001_init.sql` rows are unaffected
- **Anthropic API:** `src/lib/ai.ts` requires `ANTHROPIC_API_KEY` added as a Cloudflare Workers secret (`wrangler secret put ANTHROPIC_API_KEY`)
- **Admin auth:** Requires `ADMIN_TOKEN` secret (`wrangler secret put ADMIN_TOKEN`) before admin routes are safe to deploy
- **Content contract:** All generated posts must pass `src/lib/schema-validate.ts` before the publisher worker commits them; invalid drafts are quarantined in D1 with status `failed` and a structured error payload
- **Daily token budget:** Configurable via D1 `settings` key `daily_token_cap` (default `200000`); the Claude client hard-stops generation if the cap is reached
