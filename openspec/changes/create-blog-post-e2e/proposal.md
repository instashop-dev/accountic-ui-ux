## Why

The blog automation pipeline can only be triggered by a scheduled cron (daily at 03:00 UTC), making it impossible to manually kick off a single post and trace it through every stage without waiting for the next scheduled run. A manual trigger is needed to verify the full pipeline works end-to-end on demand.

## What Changes

- Add a `POST /admin/api/generate` endpoint that enqueues a single `topic-discovery` message (count=1) to `BLOG_PIPELINE_QUEUE`, guarded by CSRF validation and a check that `generation_enabled = 'true'`
- Add a "Generate 1 Post" button to `/admin/jobs` that POSTs to this endpoint and redirects back, so operators can watch the job flow in real time

## Capabilities

### New Capabilities
- `admin-pipeline-trigger`: Admin endpoint + UI control to manually fire one topic-discovery→outline→article→humanizer→publisher run, producing a single draft ready for approval

### Modified Capabilities
<!-- none -->

## Impact

- New file: `src/pages/admin/api/generate.ts`
- Modified file: `src/pages/admin/jobs.astro` (add trigger button + success/error flash)
- No schema changes; no new bindings required — `BLOG_PIPELINE_QUEUE` is already bound in `wrangler.jsonc`
