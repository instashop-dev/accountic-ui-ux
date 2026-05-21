## ADDED Requirements

### Requirement: POST /admin/api/generate enqueues a single topic-discovery message
`src/pages/admin/api/generate.ts` SHALL export a `POST` APIRoute that validates the CSRF origin header, checks that `generation_enabled = 'true'` in the `settings` table, then calls `BLOG_PIPELINE_QUEUE.send(topicDiscoveryMessage(1))` and redirects to `/admin/jobs` with HTTP 303. It SHALL respond with HTTP 409 when `generation_enabled` is not `'true'`, HTTP 403 when CSRF validation fails, and HTTP 503 when `BLOG_PIPELINE_QUEUE` or `BLOG_DB` bindings are absent.

#### Scenario: Successful trigger enqueues message and redirects
- **WHEN** an authenticated admin POSTs to `/admin/api/generate` with a valid CSRF origin and `generation_enabled = 'true'`
- **THEN** a `{ stage: 'topic-discovery', count: 1 }` message is sent to `BLOG_PIPELINE_QUEUE` and the response is a 303 redirect to `/admin/jobs`

#### Scenario: Trigger blocked when generation disabled
- **WHEN** an admin POSTs to `/admin/api/generate` and `generation_enabled` is `'false'` in the settings table
- **THEN** the endpoint returns HTTP 409 with JSON `{ error: 'Generation is disabled. Enable it in Settings first.' }`

#### Scenario: Trigger blocked on CSRF failure
- **WHEN** a POST is made to `/admin/api/generate` without a matching `Origin` header
- **THEN** the endpoint returns HTTP 403 with JSON `{ error: 'Forbidden' }`

#### Scenario: Trigger returns 503 when queue binding absent
- **WHEN** an admin POSTs to `/admin/api/generate` but `BLOG_PIPELINE_QUEUE` is not bound in the environment
- **THEN** the endpoint returns HTTP 503 with JSON `{ error: 'Pipeline queue not available' }`

### Requirement: Jobs page renders a "Generate 1 Post" trigger button
`src/pages/admin/jobs.astro` SHALL render a `<form method="POST" action="/admin/api/generate">` containing a submit button labelled "Generate 1 Post" above the jobs table. On a non-2xx response from the endpoint, the page SHALL display an inline error message. The form SHALL use the same security headers pattern as other admin pages.

#### Scenario: Button visible on jobs page
- **WHEN** an admin loads `/admin/jobs`
- **THEN** a button with the text "Generate 1 Post" is present in the page HTML

#### Scenario: Button submission triggers pipeline and redirects
- **WHEN** the admin clicks "Generate 1 Post" and `generation_enabled = 'true'`
- **THEN** the browser is redirected to `/admin/jobs` and at least one new job row with `stage = 'topic-discovery'` appears in the table within 30 seconds
