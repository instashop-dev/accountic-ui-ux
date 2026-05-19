## Why

The Analytics admin page shows `Error: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. The page makes a server-side fetch to `/admin/api/analytics` but only forwards the `Authorization` header — browser auth uses a cookie, so the internal fetch arrives unauthenticated. The middleware responds with a `302` HTML redirect to the login page, which the page then tries to parse as JSON.

## What Changes

- In `src/pages/admin/analytics.astro`: forward the `Cookie` header alongside `Authorization` in the internal server-side fetch, so the request authenticates via the existing `admin_token` cookie
- In `src/middleware.ts`: API routes (`/admin/api/*`) should always return `401 JSON` when unauthenticated — never a `302` HTML redirect. This makes auth failures on API routes immediately obvious as JSON errors rather than silent HTML parse failures

## Capabilities

### New Capabilities

### Modified Capabilities
- `admin-api-auth`: API routes under `/admin/api/*` now respond with `401 JSON` when unauthenticated (instead of `302` redirect), matching what an API client expects

## Impact

- `src/pages/admin/analytics.astro` — add `Cookie` header to internal fetch
- `src/middleware.ts` — split auth failure response: HTML redirect for page routes, JSON 401 for API routes
