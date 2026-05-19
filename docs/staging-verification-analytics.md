# Analytics Dashboard — Staging Verification Checklist

Complete all checks below before enabling production rollout.
Production rollout = setting `ANALYTICS_ENABLED=true` on the production Worker.

---

## Pre-Verification Setup

```bash
# 1. Deploy to staging environment
wrangler deploy --env staging   # or push to staging branch

# 2. Provision all required secrets on the STAGING Worker
wrangler secret put ANALYTICS_ENABLED    # value: true
wrangler secret put CF_API_TOKEN         # value: token with "Account Analytics: Read"
wrangler secret put CF_ACCOUNT_ID        # value: your Cloudflare account ID
wrangler secret put STAGING_SEED_TOKEN   # value: any strong random string

# 3. Verify secrets are present
wrangler secret list --env staging
# Expected: ADMIN_TOKEN, ANTHROPIC_API_KEY, GITHUB_TOKEN,
#           ANALYTICS_ENABLED, CF_API_TOKEN, CF_ACCOUNT_ID, STAGING_SEED_TOKEN

# 4. Write synthetic seed events
curl -X POST https://<staging-host>/admin/api/analytics-seed \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "X-Seed-Token: <STAGING_SEED_TOKEN>"
# Expected response: { "written": 22, "total": 22, "scenarios_seeded": [...] }

# 5. Wait 60–90 seconds for Analytics Engine ingestion lag, then run checks below
```

---

## A. Auth Gating

| # | Check | Command / Action | Pass Condition |
|---|-------|-----------------|----------------|
| A1 | Analytics page blocked without token | `curl -s https://<staging-host>/admin/analytics` | HTTP 401, body `{"error":"Unauthorized"}` |
| A2 | Analytics API blocked without token | `curl -s https://<staging-host>/admin/api/analytics` | HTTP 401, body `{"error":"Unauthorized"}` |
| A3 | Seed endpoint blocked without token | `curl -s -X POST https://<staging-host>/admin/api/analytics-seed` | HTTP 401 |
| A4 | Seed endpoint blocked with wrong seed token | `curl -X POST ... -H "Authorization: Bearer <ADMIN_TOKEN>" -H "X-Seed-Token: wrong"` | HTTP 401, body `{"error":"Invalid seed token"}` |
| A5 | Analytics page accessible with valid token | `curl -s -H "Authorization: Bearer <ADMIN_TOKEN>" https://<staging-host>/admin/analytics` | HTTP 200, HTML body |
| A6 | Analytics API accessible with valid token | `curl -s -H "Authorization: Bearer <ADMIN_TOKEN>" https://<staging-host>/admin/api/analytics` | HTTP 200, JSON body with `total_events` |

---

## B. Staging Gate (Production Isolation)

| # | Check | Action | Pass Condition |
|---|-------|--------|----------------|
| B1 | Routes return 404 when `ANALYTICS_ENABLED` unset | Temporarily remove secret on a test deploy; curl both routes with valid token | Both routes return HTTP 404 `Not Found` |
| B2 | Seed endpoint returns 404 when `STAGING_SEED_TOKEN` unset | Remove `STAGING_SEED_TOKEN` from staging; POST to seed endpoint with valid tokens | HTTP 404 |
| B3 | Production Worker does not have `ANALYTICS_ENABLED` set | `wrangler secret list --env production` | `ANALYTICS_ENABLED` is **absent** from the list |

---

## C. Indexing and Caching Protection

| # | Check | Command | Pass Condition |
|---|-------|---------|----------------|
| C1 | `X-Robots-Tag` HTTP header on analytics page | `curl -sI -H "Authorization: Bearer <ADMIN_TOKEN>" https://<staging-host>/admin/analytics` | Response includes `x-robots-tag: noindex` |
| C2 | `Cache-Control` HTTP header on analytics page | Same as C1 | Response includes `cache-control: private, no-store` |
| C3 | `X-Robots-Tag` on API endpoint | `curl -sI -H "Authorization: Bearer <ADMIN_TOKEN>" https://<staging-host>/admin/api/analytics` | Response includes `x-robots-tag: noindex` |
| C4 | `Cache-Control` on API endpoint | Same as C3 | Response includes `cache-control: private, no-store` |
| C5 | `X-Robots-Tag` on error response (no secrets) | Temporarily unset `CF_API_TOKEN`; curl API endpoint | Error JSON response still includes `x-robots-tag: noindex` |
| C6 | HTML meta robots tag present | Inspect `/admin/analytics` page source | `<meta name="robots" content="noindex,nofollow">` in `<head>` |

---

## D. Telemetry Ingestion

Prerequisite: seed events written and 60s lag elapsed.

| # | Check | Action | Pass Condition |
|---|-------|--------|----------------|
| D1 | Seed events visible in dataset | `wrangler analytics engine sql "SELECT count() FROM blog-pipeline-events WHERE blob3 LIKE 'seed-%'"` | Count ≥ 22 |
| D2 | API returns non-zero total_events | `curl ... /admin/api/analytics \| jq .total_events` | `>= 22` |
| D3 | Success events counted correctly | `jq .success_count` on API response | `>= 10` (from 2 full runs × 5 stages) |
| D4 | Failure events counted correctly | `jq .failure_count` on API response | `>= 5` (quality, regression, publisher ×3) |
| D5 | Fallback events counted correctly | `jq .fallback_count` on API response | `>= 3` |
| D6 | Skipped events counted correctly | `jq .skipped_count` on API response | `>= 1` |
| D7 | Stage breakdown populated | `jq '.by_stage \| length'` on API response | `>= 4` (topic-discovery, outline-generation, article-generation, humanizer, publisher) |

---

## E. Dashboard Rendering

| # | Check | Action | Pass Condition |
|---|-------|--------|----------------|
| E1 | All 4 metric cards render with values | Browser: `/admin/analytics` | Total Events, Success Rate, Avg Tokens, Avg Quality all show non-"—" values |
| E2 | Operational Health panel renders all 5 indicators | Browser: `/admin/analytics` | Last Successful Publish, Queue Backlog Age, Fallback Spike, Token Usage, Publish Failure Streak all visible |
| E3 | Stage breakdown table shows ≥4 rows | Browser: `/admin/analytics` | Table is present and not empty |
| E4 | Recent failures table shows seed failures | Browser: `/admin/analytics` | Rows for `seed-bbb0` article IDs visible |
| E5 | Article IDs truncated to 8 chars | Browser: failures table | IDs show as `seed-aaa` (8 chars), not full string |
| E6 | Nav shows all 5 links on Queue page | Browser: `/admin/queue` | Header includes: Queue · Jobs · Analytics · Settings · Prompts |
| E7 | Nav shows all 5 links on Jobs page | Browser: `/admin/jobs` | Same as E6 |
| E8 | Nav shows all 5 links on Settings page | Browser: `/admin/settings` | Same as E6 |
| E9 | Nav shows all 5 links on Prompts page | Browser: `/admin/prompts` | Same as E6 |
| E10 | Analytics nav link is active/highlighted on analytics page | Browser: `/admin/analytics` | "Analytics" nav link has `class="active"` applied (bold/white text) |

---

## F. Synthetic Event Validation

| # | Check | Expected Value in Dashboard | Pass Condition |
|---|-------|-----------------------------|----------------|
| F1 | Last Successful Publish shows recent timestamp | Operational Health panel | "Last successful publish" shows today's date (seed event was just written) |
| F2 | Fallback spike detected | Operational Health panel | Indicator shows **warn** state: "Detected — 3 in 1h" |
| F3 | Token spike detected | Operational Health panel | Indicator shows **warn** state (seed-ddd events are ~3× normal avg) |
| F4 | Publish failure streak = 3 | Operational Health panel | Indicator shows **crit** state: "3 consecutive failures" |
| F5 | Recent failures table has `quality_score` gate entry | Failures table | Row with `failed_gate = quality_score`, article `seed-bbb0` |
| F6 | Recent failures table has `semantic_regression` gate entry | Failures table | Row with `failed_gate = semantic_regression` |
| F7 | Recent failures table has `github_push` gate entry | Failures table | Row with `failed_gate = github_push` |
| F8 | Oversized reason is truncated at 500 chars with ellipsis | Failures table | `seed-fff00001` row reason ends in `…` and is ≤ 501 display chars |

---

## G. Prompt / Secret / Payload Redaction

| # | Check | Action | Pass Condition |
|---|-------|--------|----------------|
| G1 | No prompt text in any API response field | `curl .../admin/api/analytics \| jq` and inspect all string fields | No field contains more than 500 chars of free-form text |
| G2 | No API key patterns in response | Grep response for long alphanumeric strings (32+ chars) matching key patterns | No matches outside of `article_id` field |
| G3 | `reason` fields contain only gate-name/short-description format | Inspect `recent_failures[].reason` in API response | All values are short operator-written strings, not stack traces or raw content |
| G4 | `failed_gate` field contains only enum-like names | Inspect `recent_failures[].failed_gate` | Values are identifiers like `quality_score`, `semantic_regression`, `github_push` |
| G5 | Oversized reason truncated at API level (not just UI) | `curl .../admin/api/analytics \| jq '.recent_failures[] \| select(.article_id == "seed-fff0") \| .reason \| length'` | Returns `≤ 501` (500 chars + `…`) |
| G6 | Seed endpoint does not echo secrets in response | Inspect seed endpoint POST response body | No `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `ADMIN_TOKEN`, or `STAGING_SEED_TOKEN` values in response |

---

## H. Timeout Handling

| # | Check | Action | Pass Condition |
|---|-------|--------|----------------|
| H1 | Invalid `CF_API_TOKEN` returns graceful error | Set `CF_API_TOKEN` to an invalid value; curl API | HTTP 200, `{"error": "Analytics query failed: Analytics Engine error 403: ..."}` — NOT a 5xx |
| H2 | Error displayed on dashboard page, other pages unaffected | With invalid token, load `/admin/analytics` then `/admin/queue` | Analytics shows error banner; Queue page loads normally |
| H3 | Timeout error message is correct format | Simulate timeout (swap AE URL to a slow endpoint if possible) | Response contains `"Analytics Engine query timed out"` |

---

## I. Empty State Rendering

| # | Check | Action | Pass Condition |
|---|-------|--------|----------------|
| I1 | Dashboard renders empty state when no data in window | Query against a fresh dataset with no events in 7 days | Page renders without JS errors; metric cards show `0` or `—`; tables show "No data" / "No failures" messages |
| I2 | No successful publish shows warn indicator | Fresh dataset with no publisher success events | Operational Health "Last Successful Publish" shows **warn** amber state: "None in 7 days" |
| I3 | No failures shows correct empty message | Dataset with only success events | Recent Failures section shows "No failures in the last 7 days." |

---

## J. Failure Isolation

| # | Check | Action | Pass Condition |
|---|-------|--------|----------------|
| J1 | Queue page unaffected when analytics API fails | Set `CF_API_TOKEN` to invalid; load `/admin/queue` | Queue page loads and shows drafts normally — no analytics error bleeds through |
| J2 | Jobs page unaffected | Same as J1; load `/admin/jobs` | Jobs page loads normally |
| J3 | Settings page unaffected | Same as J1; load `/admin/settings` | Settings page loads normally |
| J4 | Analytics page error is contained to banner | Load `/admin/analytics` with invalid `CF_API_TOKEN` | Error banner visible, rest of page structure intact (nav, title, subtitle rendered) |
| J5 | Analytics 404 (no `ANALYTICS_ENABLED`) does not render blank page on other routes | Remove `ANALYTICS_ENABLED`; navigate between all admin pages | Queue/Jobs/Settings/Prompts all render normally |

---

## Production Rollout Gate

**All sections A–J must pass before proceeding.**

```bash
# Only run this after all checks above pass:
wrangler secret put ANALYTICS_ENABLED --env production
# value: true

# Do NOT provision STAGING_SEED_TOKEN on production.
# Do NOT run the seed endpoint against production.
```

Post-rollout smoke test (production):
```bash
curl -sI -H "Authorization: Bearer <PROD_ADMIN_TOKEN>" \
  https://<production-host>/admin/analytics \
  | grep -E "(x-robots-tag|cache-control|HTTP/)"
# Expected:
#   HTTP/2 200
#   x-robots-tag: noindex
#   cache-control: private, no-store
```
