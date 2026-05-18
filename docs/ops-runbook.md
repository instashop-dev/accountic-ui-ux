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

### Rollback

1. Disable generation: set `generation_enabled = 'false'` in D1 settings
2. Revert the commit and push to main (CI redeploys previous build)
3. Optionally drop Phase 3 tables: `wrangler d1 execute BLOG_DB --remote --file=migrations/002_rollback.sql`

### Admin Dashboard Paths

| Path | Purpose |
|---|---|
| `/admin/queue` | Review AI-generated drafts (Approve / Reject) |
| `/admin/jobs` | Monitor generation jobs, replay failed ones |
| `/admin/settings` | Configure pipeline settings |
| `/admin/prompts` | View and edit versioned generation prompts |

All paths require `Authorization: Bearer <ADMIN_TOKEN>` header.
