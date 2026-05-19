# Analytics Dashboard — Production Verification Checklist

Work through these in order. Empty states (no pipeline data yet) are acceptable for most checks — the dashboard is designed to handle them gracefully.

---

## Step 1 — Pre-deploy secrets

```bash
wrangler secret put CF_API_TOKEN    # Cloudflare API token, "Account Analytics: Read" permission
wrangler secret put CF_ACCOUNT_ID   # your Cloudflare account ID

wrangler secret list
# Must include: CF_API_TOKEN, CF_ACCOUNT_ID
# ANALYTICS_ENABLED must NOT be in the list yet
```

---

## Step 2 — Deploy

```bash
git push origin main
# GitHub Actions: npm ci → astro build → wrangler deploy
```

---

## Step 3 — Pre-flip verification (routes inactive)

Confirm the dashboard is inert before going live.

```bash
# Both must return HTTP 404
curl -sI -H "Authorization: Bearer <ADMIN_TOKEN>" https://<host>/admin/analytics \
  | head -1
# → HTTP/2 404

curl -sI -H "Authorization: Bearer <ADMIN_TOKEN>" https://<host>/admin/api/analytics \
  | head -1
# → HTTP/2 404
```

---

## Step 4 — Go-live flip

```bash
wrangler secret put ANALYTICS_ENABLED
# value: true
```

---

## Step 5 — Auth gating

| Check | Command | Expected |
|-------|---------|----------|
| No token → 401 | `curl -sI https://<host>/admin/analytics` | `HTTP/2 401` |
| No token → 401 on API | `curl -sI https://<host>/admin/api/analytics` | `HTTP/2 401` |
| Valid token → 200 | `curl -sI -H "Authorization: Bearer <ADMIN_TOKEN>" https://<host>/admin/analytics` | `HTTP/2 200` |

---

## Step 6 — Security headers

```bash
curl -sI -H "Authorization: Bearer <ADMIN_TOKEN>" https://<host>/admin/analytics \
  | grep -E "(x-robots-tag|cache-control)"
# x-robots-tag: noindex
# cache-control: private, no-store

curl -sI -H "Authorization: Bearer <ADMIN_TOKEN>" https://<host>/admin/api/analytics \
  | grep -E "(x-robots-tag|cache-control)"
# x-robots-tag: noindex
# cache-control: private, no-store
```

Both headers must appear on **both** routes.

---

## Step 7 — Dashboard renders

Navigate to `/admin/analytics` in a browser with the admin token set.

| Check | Pass condition |
|-------|---------------|
| Page loads without error | No red error banner unless CF_API_TOKEN is missing |
| 4 metric cards visible | Total Events, Success Rate, Avg Tokens, Avg Quality — `0` or `—` is fine if no data yet |
| Operational Health panel visible | All 5 indicators render; "None in 7 days" / "Queue empty" / "Healthy" are correct empty states |
| Stage breakdown shows "No stage data yet" | Acceptable if pipeline has not run |
| Recent failures shows "No failures in the last 7 days." | Acceptable if pipeline has not run |

---

## Step 8 — Nav links

Open each existing admin page and confirm the header nav includes **Queue · Jobs · Analytics · Settings · Prompts**:

- [ ] `/admin/queue`
- [ ] `/admin/jobs`
- [ ] `/admin/settings`
- [ ] `/admin/prompts`

---

## Step 9 — Failure isolation

```bash
# Temporarily break the API token
wrangler secret put CF_API_TOKEN   # enter an invalid value

# Analytics page should show error banner — not a crash
curl -sI -H "Authorization: Bearer <ADMIN_TOKEN>" https://<host>/admin/analytics
# → HTTP/2 200 (page renders with error banner)

# Other admin pages must be completely unaffected
curl -sI -H "Authorization: Bearer <ADMIN_TOKEN>" https://<host>/admin/queue
# → HTTP/2 200

# Restore the correct token
wrangler secret put CF_API_TOKEN   # enter the real value
```

---

## Step 10 — CF_API_TOKEN not configured warning

```bash
# Temporarily remove the API token secret entirely
wrangler secret delete CF_API_TOKEN

curl -s -H "Authorization: Bearer <ADMIN_TOKEN>" https://<host>/admin/analytics \
  | grep "not configured"
# → page HTML should contain the warning text

# Restore
wrangler secret put CF_API_TOKEN
```

---

## Step 11 — Post-pipeline data validation

Run after the next scheduled pipeline execution (Monday 03:00 UTC cron, or trigger manually).

| Check | Pass condition |
|-------|---------------|
| Total Events > 0 | `curl ... /admin/api/analytics \| jq .total_events` returns non-zero |
| Stage breakdown populated | At least `topic-discovery` and `article-generation` rows visible |
| Last Successful Publish shows a timestamp | Operational Health indicator is green with a date |
| Quality score shows a non-zero value | Avg Quality Score card shows a decimal value |

---

## Rollback

If any Step 5–10 check fails:

```bash
# Deactivate the dashboard immediately (no redeploy needed)
wrangler secret delete ANALYTICS_ENABLED
# Routes return 404 again — pipeline and other admin pages unaffected
```

Then diagnose, fix, redeploy, and re-run from Step 3.
