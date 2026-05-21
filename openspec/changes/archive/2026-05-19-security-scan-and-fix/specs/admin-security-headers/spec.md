## ADDED Requirements

### Requirement: All admin API responses include consistent security headers
Every response from any `/admin/api/*` route SHALL include the following HTTP headers:
- `Cache-Control: no-store`
- `X-Robots-Tag: noindex`
- `X-Content-Type-Options: nosniff`

These headers SHALL be applied via a shared `ADMIN_SECURITY_HEADERS` constant exported from `src/lib/admin-security.ts`.

#### Scenario: Successful admin API response includes security headers
- **WHEN** an authenticated admin makes a request to any `/admin/api/*` route and receives a 2xx response
- **THEN** the response SHALL include `Cache-Control: no-store`, `X-Robots-Tag: noindex`, and `X-Content-Type-Options: nosniff` headers

#### Scenario: Error response from admin API also includes security headers
- **WHEN** an admin API route returns a 4xx or 5xx error response
- **THEN** the response SHALL still include the security headers

### Requirement: Security headers are defined in a single shared location
A `ADMIN_SECURITY_HEADERS` constant SHALL be exported from `src/lib/admin-security.ts` as a plain object. No route SHALL define its own local copy of these header values.

#### Scenario: Shared constant is used by approve route
- **WHEN** `src/pages/admin/api/drafts/[id]/approve.ts` constructs its response
- **THEN** it SHALL spread `ADMIN_SECURITY_HEADERS` into the response headers

#### Scenario: Shared constant is used by reject route
- **WHEN** `src/pages/admin/api/drafts/[id]/reject.ts` constructs its response
- **THEN** it SHALL spread `ADMIN_SECURITY_HEADERS` into the response headers

#### Scenario: Shared constant is used by settings route
- **WHEN** `src/pages/admin/api/settings.ts` constructs its response
- **THEN** it SHALL spread `ADMIN_SECURITY_HEADERS` into the response headers

#### Scenario: Shared constant is used by prompts save route
- **WHEN** `src/pages/admin/api/prompts/[stage]/save.ts` constructs its response
- **THEN** it SHALL spread `ADMIN_SECURITY_HEADERS` into the response headers

#### Scenario: Shared constant is used by jobs replay route
- **WHEN** `src/pages/admin/api/jobs/[id]/replay.ts` constructs its response
- **THEN** it SHALL spread `ADMIN_SECURITY_HEADERS` into the response headers
