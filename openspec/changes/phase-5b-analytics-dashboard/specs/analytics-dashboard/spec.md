## ADDED Requirements

### Requirement: Analytics dashboard page exists at /admin/analytics
The system SHALL serve an SSR Astro page at `/admin/analytics` that displays a 7-day pipeline health summary sourced from the Cloudflare Analytics Engine dataset `blog-pipeline-events`.

#### Scenario: Page loads with data
- **WHEN** an admin navigates to `/admin/analytics` and `CF_API_TOKEN` and `CF_ACCOUNT_ID` secrets are present and Analytics Engine has data
- **THEN** the page SHALL render a header nav (matching other admin pages), a summary section with four metric cards (total events, success rate, avg token usage, avg quality score), a per-stage failure table, and a recent-failures table

#### Scenario: Page loads without secrets configured
- **WHEN** an admin navigates to `/admin/analytics` and either `CF_API_TOKEN` or `CF_ACCOUNT_ID` is absent
- **THEN** the page SHALL render a visible warning banner reading "Analytics Engine not configured — set CF_API_TOKEN and CF_ACCOUNT_ID as Wrangler secrets" and no metric cards or tables

#### Scenario: Analytics Engine API call fails
- **WHEN** the `/admin/api/analytics` endpoint receives a non-2xx response or network error from the Analytics Engine SQL API
- **THEN** the page SHALL render an error banner with the failure reason and SHALL NOT show partial or stale metric data

### Requirement: Analytics JSON API endpoint returns structured pipeline metrics
The system SHALL expose a GET endpoint at `/admin/api/analytics` that queries the Analytics Engine SQL API with a fixed 7-day window and returns a JSON object with aggregated pipeline metrics.

#### Scenario: Successful query
- **WHEN** `CF_API_TOKEN` and `CF_ACCOUNT_ID` are set and the Analytics Engine responds successfully
- **THEN** the endpoint SHALL return HTTP 200 with `Content-Type: application/json` and a body matching:
  ```json
  {
    "total_events": number,
    "success_count": number,
    "failure_count": number,
    "skipped_count": number,
    "fallback_count": number,
    "avg_tokens_used": number,
    "avg_duration_ms": number,
    "avg_quality_score": number,
    "by_stage": [{ "stage": string, "total": number, "failures": number }],
    "recent_failures": [{ "article_id": string, "stage": string, "failed_gate": string, "reason": string, "ts": string }]
  }
  ```

#### Scenario: Missing secrets
- **WHEN** `CF_API_TOKEN` or `CF_ACCOUNT_ID` is not set in the Worker environment
- **THEN** the endpoint SHALL return HTTP 200 with `{ "error": "Analytics Engine not configured" }`

#### Scenario: Analytics Engine API error
- **WHEN** the Cloudflare Analytics Engine SQL API returns a non-2xx status
- **THEN** the endpoint SHALL return HTTP 200 with `{ "error": "<descriptive message>" }` — the endpoint itself MUST NOT return 5xx to avoid breaking the Astro page render

### Requirement: Dashboard metrics cover a fixed 7-day window
The analytics dashboard and API endpoint SHALL query data from the last 7 days only (using `WHERE timestamp > NOW() - INTERVAL '7' DAY`). No user-configurable date range is provided.

#### Scenario: Data is scoped to 7 days
- **WHEN** the Analytics Engine dataset contains events older than 7 days
- **THEN** those events SHALL NOT appear in any metric card, stage breakdown, or recent-failures table on the dashboard

### Requirement: Recent failures table shows actionable detail
The dashboard SHALL render a "Recent Failures" table (max 20 rows, ordered by timestamp descending) showing: article_id (truncated to 8 chars), stage, failed_gate, reason, and timestamp.

#### Scenario: Failures present
- **WHEN** the 7-day window contains pipeline events with `outcome = 'failure'`
- **THEN** the recent-failures table SHALL display them with article_id, stage, failed_gate, reason, and timestamp columns

#### Scenario: No failures
- **WHEN** the 7-day window contains no failure events
- **THEN** the recent-failures table area SHALL display "No failures in the last 7 days" instead of an empty table

### Requirement: Dashboard routes enforce admin auth and set security headers
The `/admin/analytics` page and `/admin/api/analytics` endpoint MUST be protected by the existing admin auth middleware. Both routes SHALL set `X-Robots-Tag: noindex` and `Cache-Control: private, no-store` response headers on every response.

#### Scenario: Unauthenticated access attempt
- **WHEN** a request reaches `/admin/analytics` or `/admin/api/analytics` without a valid admin session
- **THEN** the middleware SHALL redirect to the admin login page (consistent with all other `/admin/*` routes) and no analytics data SHALL be returned

#### Scenario: Response headers are always set
- **WHEN** any response is returned from `/admin/analytics` or `/admin/api/analytics` — including error states
- **THEN** the response SHALL include `X-Robots-Tag: noindex` and `Cache-Control: private, no-store` headers

### Requirement: Dashboard redacts sensitive content
The dashboard MUST display only structured, pre-defined fields from Analytics Engine events (`event`, `stage`, `article_id`, `outcome`, `reason`, `failed_gate`). Raw prompts, API keys, stack traces, and generated article text SHALL NOT be rendered.

#### Scenario: Reason field exceeds display limit
- **WHEN** a `reason` value in the recent-failures table exceeds 500 characters
- **THEN** the UI SHALL truncate it to 500 characters and append an ellipsis; the full value SHALL NOT be rendered in any tooltip or hidden element

#### Scenario: No free-form content in events
- **WHEN** `logEvent` is called anywhere in the pipeline
- **THEN** callers SHALL only pass typed `PipelineEvent` fields — passing raw prompt text, article body, or stack traces as `reason` or `failed_gate` values is a contract violation enforced by TypeScript types

### Requirement: Analytics API enforces query timeouts
All outbound fetch calls from `/admin/api/analytics` to the Cloudflare Analytics Engine SQL API MUST use an `AbortSignal` with a 10-second timeout.

#### Scenario: Analytics Engine query exceeds timeout
- **WHEN** the Analytics Engine SQL API does not respond within 10 seconds
- **THEN** the endpoint SHALL abort the request and return `{ "error": "Analytics Engine query timed out" }` with HTTP 200

#### Scenario: Query completes within timeout
- **WHEN** the Analytics Engine SQL API responds within 10 seconds
- **THEN** the endpoint SHALL process the response normally and return structured metrics

### Requirement: Analytics subsystem fails independently
The analytics dashboard and API endpoint MUST NOT share any code path with Queue, Jobs, Settings, or Prompts pages. A failure in analytics MUST NOT degrade or block any other admin workflow.

#### Scenario: Analytics API throws an unhandled error
- **WHEN** `/admin/api/analytics` throws an unhandled exception
- **THEN** the error MUST be caught within that route's handler; the response SHALL be `{ "error": "..." }` with HTTP 200; no other admin page SHALL be affected

#### Scenario: Analytics page fetch fails
- **WHEN** `analytics.astro` cannot reach `/admin/api/analytics`
- **THEN** the page SHALL render an error banner and complete its SSR render normally, with no exception propagation to the Cloudflare Workers runtime

### Requirement: Operational health panel surfaces key pipeline signals
The dashboard SHALL render an "Operational Health" panel with five indicators derived from Analytics Engine queries over the 7-day window.

#### Scenario: Last successful publish is recent
- **WHEN** the dataset contains at least one event with `outcome = 'success'` and `stage = 'publisher'` in the last 7 days
- **THEN** the panel SHALL display the timestamp of the most recent such event as "Last successful publish: <timestamp>"

#### Scenario: No successful publish in 7 days
- **WHEN** no `outcome = 'success'` + `stage = 'publisher'` events exist in the 7-day window
- **THEN** the panel SHALL display "Last successful publish: none in 7 days" in a warning color

#### Scenario: Fallback spike detected
- **WHEN** 3 or more events with `outcome = 'fallback'` occurred within any 1-hour window in the last 7 days
- **THEN** the panel SHALL display a "Fallback spike detected" warning with the time of the most recent cluster

#### Scenario: No fallback spike
- **WHEN** fewer than 3 fallback events occurred in any 1-hour window in the last 7 days
- **THEN** the panel SHALL display "Fallback rate: normal"

#### Scenario: Token spike detected
- **WHEN** the average `tokens_used` in the most recent 24-hour window exceeds twice the 7-day rolling average
- **THEN** the panel SHALL display a "Token spike detected" warning showing the current 24h avg vs the 7-day baseline

#### Scenario: No token spike
- **WHEN** the 24-hour token average is within 2× of the 7-day baseline
- **THEN** the panel SHALL display "Token usage: normal"

#### Scenario: Publish failure streak detected
- **WHEN** the most recent 3 or more consecutive `stage = 'publisher'` events all have `outcome = 'failure'`
- **THEN** the panel SHALL display "Publish failure streak: <N> consecutive failures" in a red warning state

#### Scenario: No publish failure streak
- **WHEN** fewer than 3 consecutive publisher failures exist at the tail of the dataset
- **THEN** the panel SHALL display "Publish: healthy"
