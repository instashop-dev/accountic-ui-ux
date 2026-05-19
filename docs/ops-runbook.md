# Accountic Blog Automation — Ops Runbook

## Phase 3 AI Implementation — Pre-Deploy Checklist

### Required Cloudflare Workers Secrets

Before deploying Phase 3, provision the following secrets in Cloudflare. Each command prompts for the value interactively.

```bash
# Anthropic API key (create at console.anthropic.com → API Keys)
wrangler secret put ANTHROPIC_API_KEY

# Admin dashboard Bearer token (generate a strong random string, e.g. openssl rand -hex 32)
wrangler secret put ADMIN_TOKEN

# GitHub fine-grained PAT — scope: Contents (Read and write) on this repo only
# Create at github.com → Settings → Developer settings → Fine-grained personal access tokens
wrangler secret put GITHUB_TOKEN
```

### D1 Migration

Apply Phase 3 schema additions (additive — no data loss):

```bash
# Remote (production)
wrangler d1 execute BLOG_DB --remote --file=migrations/002_pipeline.sql

# Local preview
wrangler d1 execute BLOG_DB --file=migrations/002_pipeline.sql
```

To roll back Phase 3 tables only:

```bash
wrangler d1 execute BLOG_DB --remote --file=migrations/002_rollback.sql
```

### Deploy

```bash
git push origin main
# GitHub Actions handles: npm ci → astro build → wrangler deploy
```

### Enable Generation

After confirming the deployment is healthy, enable the pipeline via the admin dashboard at `/admin/settings`, or via CLI:

```bash
wrangler d1 execute BLOG_DB --remote --command="UPDATE settings SET value='true' WHERE key='generation_enabled'"
```

Keep `auto_publish` set to `'false'` (default) during the initial review period. Drafts will queue in `/admin/queue` for CA review before being published.

### Settings Reference

| D1 key | Default | Description |
|---|---|---|
| `generation_enabled` | `false` | Master switch — set `true` to start the pipeline |
| `auto_publish` | `false` | Auto-publish approved drafts without manual review |
| `weekly_target` | `2` | Target articles per week |
| `quality_threshold` | `0.8` | Minimum quality score (0–1) |
| `daily_token_cap` | `200000` | Max Anthropic tokens per UTC day |
| `tokens_used_today` | `0` | Reset daily by cron |
| `ai_model` | `claude-sonnet-4-6` | Claude model ID (changeable without code deploy) |
| `humanizer_enabled` | `true` | Enable/disable the humanization pass (Phase 4) |
| `humanizer_temperature` | `0.3` | Claude temperature for humanizer (clamped 0.2–0.4) |
| `humanizer_similarity_threshold` | `0.70` | Minimum Jaccard bigram similarity for regression gate |

### Phase 4 — Humanizer Notes

**Protected content regions:** To lock content from humanizer edits, wrap it in:
```
<!-- HUMANIZER_LOCK_START -->
...content to preserve exactly...
<!-- HUMANIZER_LOCK_END -->
```
The humanizer will never modify text inside these regions.

**In-flight `'ready'` drafts:** Any drafts with `status = 'ready'` created before Phase 4 was deployed will bypass humanization — they go directly through the admin approval flow (approve → `blog-publish` → publisher). This is expected behaviour. If you want these drafts humanized, reject them and allow the pipeline to regenerate them under Phase 4.

**Fallback behaviour:** If the humanizer detects a semantic regression (similarity gate, heading gate, compliance entity gate, or fabricated numerics), it falls back to the original AI-generated content automatically. The draft still advances to `status = 'humanized'` and appears in the admin queue for review. Check Analytics Engine (`blog-pipeline-events`) for `regression_detected` events to monitor fallback rate.

**Phase 4 D1 migration:**
```bash
npm run db:migrate:phase4        # remote (production)
npm run db:migrate:phase4:local  # local preview
npm run db:rollback:phase4       # rollback (drops humanizer_jobs, removes columns)
```

### Rollback

1. Disable generation: set `generation_enabled = 'false'` in D1 settings
2. Revert the commit and push to main (CI redeploys previous build)
3. Optionally drop Phase 3 tables: `wrangler d1 execute BLOG_DB --remote --file=migrations/002_rollback.sql`

### Phase 5b — Analytics Dashboard

**Required secrets** (provision before deploying Phase 5b):

```bash
# Cloudflare API token — must have "Account Analytics: Read" permission
# Create at dash.cloudflare.com → My Profile → API Tokens
wrangler secret put CF_API_TOKEN

# Your Cloudflare account ID — visible in the dashboard URL or via:
# curl https://api.cloudflare.com/client/v4/accounts -H "Authorization: Bearer <token>"
wrangler secret put CF_ACCOUNT_ID
```

Verify secrets are present after provisioning:

```bash
wrangler secret list
# Should include: CF_API_TOKEN, CF_ACCOUNT_ID
```

Verify Analytics Engine dataset has data (run after at least one pipeline execution):

```bash
wrangler analytics engine sql "SELECT count() FROM blog-pipeline-events LIMIT 1"
```

**Staging gate:** The analytics dashboard is inactive by default (`ANALYTICS_ENABLED` unset). Routes return 404 until this secret is explicitly set to `true`. Do NOT set `ANALYTICS_ENABLED` on production until the staging verification checklist passes — see `docs/staging-verification-analytics.md`.

**Synthetic seed events (staging only):**

```bash
# Writes 22 deterministic test events to Analytics Engine for dashboard verification.
# Requires STAGING_SEED_TOKEN secret — never provision this on production.
wrangler secret put STAGING_SEED_TOKEN   # staging only

curl -X POST https://<staging-host>/admin/api/analytics-seed \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "X-Seed-Token: <STAGING_SEED_TOKEN>"
# Wait 60–90 seconds for AE ingestion lag, then verify at /admin/analytics
```

**Production rollout:** After all staging checks pass, set `ANALYTICS_ENABLED=true` on the production Worker. Never set `STAGING_SEED_TOKEN` on production.

**Rollback:** Delete `src/pages/admin/analytics.astro`, `src/pages/admin/api/analytics.ts`, and `src/pages/admin/api/analytics-seed.ts`; revert the nav `<a href="/admin/analytics">` additions in `queue.astro`, `jobs.astro`, `settings.astro`, `prompts.astro`. Remove `ANALYTICS_ENABLED` secret from production. No D1 changes, no wrangler.jsonc changes.

### Phase 5 — Testing Infrastructure Notes

**Test-only migration:** `migrations/005_test-fixtures.sql` seeds deterministic data for Vitest integration tests. **Never run it against production D1.** It is intentionally excluded from all `package.json` db:migrate scripts. Running it in production would insert dummy topics, outlines, and drafts that would be picked up by the live pipeline.

**Pre-release validation:** Before any release that modifies article generation prompts or MDX output format, run:
```bash
npm run test:build   # runs npm test && npx astro build in sequence
```
This confirms test fixtures don't break the Astro content layer and all pipeline unit/integration tests pass before the Astro bundle is produced.

**Running the test suite:**
```bash
npm test                  # all unit + integration tests (vitest run)
npm run test:coverage     # same + Istanbul branch coverage report (threshold: 80%)
```

### Admin Dashboard Paths

| Path | Purpose |
|---|---|
| `/admin/queue` | Review AI-generated drafts (Approve / Reject) |
| `/admin/jobs` | Monitor generation jobs, replay failed ones |
| `/admin/settings` | Configure pipeline settings |
| `/admin/prompts` | View and edit versioned generation prompts |
| `/admin/analytics` | Pipeline health dashboard (Analytics Engine + D1) |

All paths require `Authorization: Bearer <ADMIN_TOKEN>` header.
