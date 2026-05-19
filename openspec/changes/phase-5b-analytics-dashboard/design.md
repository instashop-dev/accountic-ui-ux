## Context

Phase 4 introduced `src/lib/analytics.ts`, a thin wrapper that writes structured pipeline events to Cloudflare Analytics Engine (`BLOG_ANALYTICS` → dataset `blog-pipeline-events`). Each event has six blobs (event, stage, article_id, outcome, reason, failed_gate) and three doubles (tokens_used, duration_ms, quality_score). The admin dashboard currently has four pages (Queue, Jobs, Settings, Prompts) — all Astro SSR pages hitting D1 directly, styled with inline system-ui CSS, using the same `#1e1b4b` indigo header nav pattern.

There is no current way for operators to read back the Analytics Engine data. The Cloudflare Analytics Engine exposes a SQL API at `https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql` (Bearer auth via `CF_API_TOKEN`).

## Goals / Non-Goals

**Goals:**
- Add `/admin/analytics` page showing 7-day pipeline health: total articles generated, outcome breakdown, per-stage failure rates, avg token usage, avg quality score
- Add a thin JSON API endpoint at `/admin/api/analytics` that queries the Analytics Engine SQL API server-side and returns structured data to the Astro page
- Add "Analytics" nav link to all four existing admin pages
- Match the existing admin UI pattern exactly (same header, same inline CSS style, same system-ui font)

**Non-Goals:**
- Real-time or streaming metrics (polling, WebSockets)
- Time-range selectors or user-configurable filters
- Charts or visualizations beyond summary cards and a table
- Custom dashboards, per-article drill-down, or alert configuration
- Exposing Analytics Engine data publicly (dashboard is admin-only, behind middleware auth)

## Decisions

### Decision 1: Server-side query via REST SQL API (not GraphQL)

Analytics Engine exposes both a SQL API and a GraphQL API. The SQL API (`POST /analytics_engine/sql`) is simpler — it accepts a plain SQL string and returns JSON rows — and aligns with D1 familiarity. The GraphQL API requires a separate schema and is better suited for complex aggregations across multiple datasets.

**Chosen:** SQL API with `fetch()` inside an Astro API endpoint.

### Decision 2: `/admin/api/analytics` JSON endpoint, not inline Astro frontmatter fetch

Existing admin pages query D1 inline in the Astro frontmatter. Analytics Engine queries require an outbound `fetch()` to `api.cloudflare.com`, which is a different failure mode (network timeout, auth failure). Isolating this in a dedicated API endpoint makes error handling explicit and allows the Astro page to show a graceful degraded state if the endpoint fails, without coupling the page SSR to external API availability.

**Chosen:** Separate `src/pages/admin/api/analytics.ts` endpoint.

### Decision 3: Secrets via Wrangler secrets, not hardcoded env vars

`CF_API_TOKEN` and `CF_ACCOUNT_ID` are required to call the Analytics Engine SQL API. These must be provisioned as Wrangler secrets (`wrangler secret put CF_API_TOKEN`, `wrangler secret put CF_ACCOUNT_ID`) — they are not environment variables in `wrangler.jsonc` because that would expose them in source control. The ops runbook must document this provisioning step.

**Chosen:** Wrangler secrets, documented in ops runbook.

### Decision 4: 7-day fixed window, no pagination

The dashboard is an operator health overview, not a reporting tool. A fixed 7-day window with aggregate metrics (totals, averages, breakdowns) gives operators the signal they need without scope creep. No pagination or time-range selectors in this phase.

**Chosen:** Fixed 7-day window using `WHERE timestamp > NOW() - INTERVAL '7' DAY`.

## Risks / Trade-offs

**[Risk] Analytics Engine SQL API availability / latency** → `analytics.astro` renders a loading skeleton and the API endpoint returns a 200 with `{error: string}` payload on failure; the Astro page displays a banner rather than a broken page.

**[Risk] `CF_API_TOKEN` not yet provisioned** → Dashboard shows a clear "Analytics Engine not configured — run `wrangler secret put CF_API_TOKEN` and `wrangler secret put CF_ACCOUNT_ID`" message when either secret is absent.

**[Risk] Analytics Engine data lag (~1 min)** → Documented in UI as "data refreshes approximately every minute" — no real-time expectation set.

**[Risk] Query cost** → Analytics Engine SQL queries are billed per query but are cheap; the dashboard page is admin-only and not auto-refreshed, so query volume is negligible.

**[Trade-off] No client-side refresh** → Operators must reload the page to see updated metrics. Acceptable for an operator health page; avoids adding JavaScript complexity inconsistent with the rest of the admin.

**[Risk] Analytics dashboard accidentally exposed publicly** → All `/admin/analytics` and `/admin/api/analytics` routes MUST be covered by the existing admin auth middleware. Additionally, the Astro page SHALL set `X-Robots-Tag: noindex` and `Cache-Control: private, no-store` response headers to prevent indexing and CDN caching of sensitive data.

**[Risk] Sensitive prompts or generated payloads exposed in analytics** → The `reason` and `failed_gate` fields stored in Analytics Engine blobs are operator-written gate names and short reason strings, not raw prompts or article content. The dashboard MUST display only these structured fields. Any `reason` value exceeding 500 characters SHALL be truncated with an ellipsis in the UI. Stack traces and raw prompt text MUST NOT be stored in Analytics Engine events (enforced by the `logEvent` contract in `src/lib/analytics.ts` — callers pass typed `PipelineEvent` fields, not free-form strings).

**[Risk] Analytics Engine queries timeout on larger datasets** → All outbound fetch calls to the Analytics Engine SQL API MUST set an `AbortSignal` with a 10-second timeout. If the signal fires, the endpoint returns `{ error: "Analytics Engine query timed out" }` rather than hanging the request. This is especially important given the Cloudflare Workers 30-second wall-clock limit.

**[Risk] Analytics subsystem failure impacts admin operations** → The analytics page and API endpoint are entirely independent routes. They share no code path with Queue, Jobs, Settings, or Prompts pages. A crash or 500 in `/admin/analytics` MUST NOT propagate to any other admin page. The dashboard's `fetch('/admin/api/analytics')` call in `analytics.astro` is wrapped in a try/catch so even a Worker-level failure degrades to an error banner, not an unhandled exception.

**[Risk] Large telemetry datasets degrade responsiveness over time** → All Analytics Engine queries use a fixed 7-day window (`WHERE timestamp > NOW() - INTERVAL '7' DAY`). Summary queries are fully aggregated (no row scans returned to the client). The recent-failures table is `LIMIT 20`. If detailed per-event logs are added in a future phase, they MUST be paginated server-side.

## Migration Plan

1. Provision secrets on Cloudflare: `wrangler secret put CF_API_TOKEN`, `wrangler secret put CF_ACCOUNT_ID`
2. Deploy new `analytics.astro` and `api/analytics.ts` files
3. Deploy updated nav in all four admin pages
4. Verify `/admin/analytics` renders summary cards with real data

**Rollback:** Delete `src/pages/admin/analytics.astro` and `src/pages/admin/api/analytics.ts`; revert nav changes in the four admin pages. No D1 or wrangler.jsonc changes to revert.

## Open Questions

- Does `CF_API_TOKEN` already exist as a Wrangler secret on the Cloudflare account, or does it need to be created? (Ops must verify before deploy.)
- Should the 7-day window be configurable via `settings` table in a future phase? (Out of scope for 5b.)
