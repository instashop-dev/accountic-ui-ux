# Blog Automation — Operator Reference

Accountic auto-generates, humanizes, and publishes AI-written blog posts through a 6-stage Cloudflare Workers pipeline. This page covers everything needed to operate it.

---

## Quick Start — Enable Auto-Blogging

1. Open **`/admin/settings`** in the browser (requires `ADMIN_PASSWORD`).
2. Toggle **Generation Enabled** → on.
3. The pipeline fires automatically: **Monday 03:00 UTC** (topic discovery) and daily from there.

Or directly via SQL:
```sql
UPDATE settings SET value = 'true' WHERE key = 'generation_enabled';
```

To trigger a batch immediately (without waiting for cron):
```bash
npm run blog:generate          # queues 3 topics now
```

---

## Settings Reference

All settings live in the `settings` table (`key TEXT PRIMARY KEY, value TEXT`). Edit via `/admin/settings` or SQL.

| Key | Default | Values | Effect |
|-----|---------|--------|--------|
| `generation_enabled` | `false` | `true`/`false` | Master on/off — cron fires only when `true` |
| `pipeline_emergency_stop` | `false` | `true`/`false` | Kill switch — all workers ack without processing |
| `auto_publish` | `false` | `true`/`false` | (Planned) skip manual approval step |
| `daily_token_cap` | `200000` | integer | Max Claude tokens per day |
| `tokens_used_today` | `0` | integer | Running total; auto-reset at 04:00 UTC daily |
| `ai_model` | `claude-sonnet-4-6` | model ID | Claude model used for generation |
| `humanizer_enabled` | `true` | `true`/`false` | Skip humanizer stage when `false` |
| `humanizer_temperature` | `0.3` | `0.0`–`1.0` | Randomness of humanizer rewrites |
| `humanizer_similarity_threshold` | `0.70` | `0.0`–`1.0` | Min similarity score to accept humanized output |
| `quality_threshold` | `0.8` | `0.0`–`1.0` | Min readability score to pass article quality gate |

---

## Pipeline Overview

Each stage runs as a Cloudflare Queue consumer. Messages flow automatically between stages.

| # | Stage | Trigger | Output |
|---|-------|---------|--------|
| 1 | **topic-discovery** | Cron Mon 03:00 UTC or `npm run blog:generate` | Topics inserted into DB |
| 2 | **outline-generation** | Auto (after topic created) | Structured JSON outline per topic |
| 3 | **article-generation** | Auto (after outline) | Full markdown draft; quality-gated |
| 4 | **humanizer** | Auto (after quality pass) | Tone-adjusted draft; awaits approval |
| 5 | **publisher** | Admin approval in `/admin/queue` | MDX file committed to GitHub `main` |
| 6 | **refresh** | Cron daily 04:00 UTC (posts > 60 days old) | Updated MDX re-committed to GitHub |

Published posts land at: `src/content/blog/{slug}.mdx`

---

## Required Secrets & Bindings

Set secrets via `wrangler secret put <KEY>` or in `.dev.vars` for local dev.

| Secret | Permission needed | Purpose |
|--------|-----------------|---------|
| `ANTHROPIC_API_KEY` | Standard (invoke) | Claude API calls for all generation stages |
| `GITHUB_TOKEN` | `contents:write` on `instashop-dev/accountic-ui-ux` | Commit MDX files to `main` branch |
| `ADMIN_PASSWORD` | — | Protects all `/admin` routes |

Cloudflare bindings (configured in `wrangler.pipeline.jsonc`):

| Binding | Type | Purpose |
|---------|------|---------|
| `BLOG_DB` | D1 (SQLite) | All pipeline state (topics, drafts, posts, settings) |
| `BLOG_KV` | KV | General cache |
| `BLOG_ASSETS` | R2 | Snapshot storage for refresh rollbacks |
| `BLOG_ANALYTICS` | Analytics Engine | Event logging (`blog-pipeline-events`) |
| `BLOG_PIPELINE_QUEUE` | Queue | Stages 1–3 |
| `BLOG_HUMANIZE_QUEUE` | Queue | Stage 4 |
| `BLOG_PUBLISH_QUEUE` | Queue | Stage 5 |
| `BLOG_REFRESH_QUEUE` | Queue | Stage 6 |

---

## CLI Commands

```bash
npm run blog:generate          # Queue 3 topics for immediate generation
npm run blog:deploy            # Deploy pipeline worker (wrangler.pipeline.jsonc)
npm run db:seed-prompts        # Seed/update Claude prompts in D1
npm run blog:validate          # Validate a published post
npm run blog:trigger-article   # Manually trigger an article by title + pillar
npm run blog:provision         # One-time: create all 4 Cloudflare queues
```

Database migrations (run once per phase):
```bash
npm run db:migrate             # Phase 1 (init)
npm run db:migrate:phase3      # Phase 3 (pipeline tables)
npm run db:migrate:phase4      # Phase 4 (humanizer)
npm run db:migrate:phase6      # Phase 6 (refresh)
```

---

## Draft Approval Workflow

Drafts do **not** auto-publish. After the humanizer stage, a human must review:

1. Go to **`/admin/queue`** — pending drafts are listed here.
2. Read the draft. Click **Approve** to publish or **Reject** to discard.
3. Approving enqueues a publish message → publisher commits the MDX to GitHub within seconds.

There is no bulk-approve UI. Each draft is reviewed individually.

---

## Safety Mechanisms

| Mechanism | Trigger | Effect |
|-----------|---------|--------|
| **Emergency stop** | `pipeline_emergency_stop = true` | All workers ack immediately, no processing |
| **Daily token budget** | `tokens_used_today ≥ daily_token_cap` | Stops enqueueing downstream work; resets at 04:00 UTC |
| **Circuit breaker** | ≥50% failure rate in last 60 min (min 5 jobs) | Halts article-generation stage |
| **Quality gate** | Readability score < `quality_threshold` or word count out of range | Draft marked `failed`, not forwarded |
| **Humanizer regression check** | Humanized output similarity < `humanizer_similarity_threshold` | Humanized content rejected |
| **Transient retry** | HTTP 429 / 529 from Claude | Retried up to 3× with backoff (2s, 4s, 8s) |
| **Refresh idempotency** | Post refreshed < 60 days ago | Skipped (not re-enqueued) |
