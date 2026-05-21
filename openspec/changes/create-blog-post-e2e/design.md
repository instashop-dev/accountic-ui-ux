## Context

The blog pipeline is queue-driven (Cloudflare Queues) and currently starts only via a scheduled cron (`0 3 * * *`). The admin UI exposes jobs and draft queue views but has no mechanism to initiate a run. Operators must wait up to 24 hours to test a pipeline change or verify deployment health.

The existing `POST /admin/api/drafts/[id]/approve` and `POST /admin/api/jobs/[id]/replay` patterns already establish the CSRF-guarded, PRG-redirect API style used throughout the admin layer.

## Goals / Non-Goals

**Goals:**
- Allow any authenticated admin to fire one `topic-discovery` message (count=1) into `BLOG_PIPELINE_QUEUE` on demand
- Respect the `generation_enabled` master switch — refuse if it is `false`
- Surface a confirmation flash and link to the jobs view so the operator can monitor progress

**Non-Goals:**
- Configurable count (always 1 for this feature — bulk generation uses the cron)
- Bypassing the `generation_enabled` setting
- Any changes to how the pipeline processes messages once enqueued

## Decisions

**1. New endpoint vs. extending settings handler**
A dedicated `POST /admin/api/generate` endpoint keeps the handler focused and makes the route clear in logs. Extending settings would couple two concerns.

**2. Location of the trigger button**
The Jobs page (`/admin/jobs`) is the right host: operators will immediately see the new job rows populate after triggering. Settings is focused on configuration, not operations.

**3. PRG redirect target**
Redirect back to `/admin/jobs` (same as replay) so a browser refresh does not re-POST. The jobs table refresh will show the newly queued job.

**4. No idempotency key on this trigger**
A manual trigger is intentionally one-shot. Double-clicks within the same second could produce two messages, but the topic-discovery worker already deduplicates topics by title against existing DB rows, so at worst two identical topics are attempted — the second will be skipped.

## Risks / Trade-offs

- **Trigger while generation_enabled = false**: mitigated by checking the setting in the endpoint and returning 409 with a clear error message shown in the UI.
- **Queue not bound**: `BLOG_PIPELINE_QUEUE` absence returns 503; the button shows the error inline rather than silently failing.
- **Accidental rapid triggering**: no rate limit added in this change (low risk for a password-protected admin panel). A future change can add per-admin rate limiting if needed.

## Migration Plan

1. Deploy new `src/pages/admin/api/generate.ts`
2. Deploy updated `src/pages/admin/jobs.astro` with trigger button
3. No database migrations, no new Cloudflare bindings
4. Rollback: revert both files; no persistent state is written by the endpoint itself
