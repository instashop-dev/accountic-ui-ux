# Spec: admin-api-auth

Admin API authentication behaviour — how routes under `/admin/api/*` respond to unauthenticated requests, and how server-side page fetches to those routes authenticate.

## Requirements

### Requirement: Admin API routes return JSON on auth failure
Routes under `/admin/api/*` SHALL return a `401` JSON response when a request is unauthenticated, regardless of whether an `Authorization` header was present. They SHALL NOT issue a `302` redirect to the login page.

#### Scenario: Unauthenticated API request returns 401 JSON
- **WHEN** a request reaches any `/admin/api/*` route without a valid auth token or cookie
- **THEN** the middleware SHALL respond with HTTP 401 and body `{"error":"Unauthorized"}` with `Content-Type: application/json`

#### Scenario: Unauthenticated page request still redirects
- **WHEN** a request reaches any `/admin/*` page route (not under `/admin/api/`) without a valid auth token or cookie
- **THEN** the middleware SHALL redirect to `/admin/login`

### Requirement: Analytics page forwards Cookie on internal fetch
The analytics admin page SHALL forward the `Cookie` header from the incoming browser request when making its internal server-side fetch to `/admin/api/analytics`, so the API call authenticates via the existing session cookie.

#### Scenario: Analytics page loads data when logged in via cookie
- **WHEN** a logged-in user (authenticated via `admin_token` cookie) visits `/admin/analytics`
- **THEN** the page SHALL successfully fetch data from `/admin/api/analytics` and render without a JSON parse error

#### Scenario: Analytics page shows data error when API fails for other reasons
- **WHEN** the `/admin/api/analytics` API returns an error payload (e.g. Analytics Engine not configured)
- **THEN** the page SHALL render the error message from the JSON response, not a parse error
