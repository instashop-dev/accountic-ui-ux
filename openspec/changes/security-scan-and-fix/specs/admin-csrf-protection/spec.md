## ADDED Requirements

### Requirement: Admin POST routes validate request origin
All state-changing admin API routes (approve, reject, settings, prompts save, jobs replay, refresh) SHALL validate that the `Origin` or `Referer` header of the incoming request matches the site's own origin before processing the request body. Requests that fail this check SHALL be rejected with a 403 response.

#### Scenario: POST from same origin is accepted
- **WHEN** an authenticated admin sends a POST to any `/admin/api/*` route with an `Origin` header matching the site's own origin (e.g. `https://accountic.com`)
- **THEN** the route SHALL process the request normally

#### Scenario: POST with mismatched origin is rejected
- **WHEN** a POST arrives at any state-changing admin route with an `Origin` header from a different domain
- **THEN** the route SHALL return HTTP 403 with body `{"error":"Forbidden"}` and SHALL NOT process the request

#### Scenario: POST with no Origin but valid Referer is accepted
- **WHEN** a POST arrives with no `Origin` header but a `Referer` header whose origin matches the site's own origin
- **THEN** the route SHALL accept the request as same-origin

#### Scenario: POST with no Origin and no Referer is rejected
- **WHEN** a POST arrives with neither an `Origin` nor a `Referer` header
- **THEN** the route SHALL return HTTP 403 with body `{"error":"Forbidden"}`

### Requirement: CSRF validation utility is centralised
A shared `validateCsrf(request: Request, expectedOrigin: string): boolean` function SHALL exist in `src/lib/admin-security.ts` and be reused by all state-changing admin routes. No route SHALL implement its own ad-hoc origin check.

#### Scenario: Utility returns true for matching origin
- **WHEN** `validateCsrf` is called with a request whose `Origin` matches `expectedOrigin`
- **THEN** it SHALL return `true`

#### Scenario: Utility returns false for mismatched or missing origin
- **WHEN** `validateCsrf` is called with a request whose `Origin` does not match `expectedOrigin`, or is absent with no matching `Referer`
- **THEN** it SHALL return `false`
