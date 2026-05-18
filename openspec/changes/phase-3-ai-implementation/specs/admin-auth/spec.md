## ADDED Requirements

### Requirement: Astro middleware enforces Bearer token auth on all /admin/* routes
`src/middleware.ts` SHALL export an Astro `onRequest` middleware function that intercepts every request whose pathname starts with `/admin/`. For each such request it SHALL read the `Authorization` header, extract the Bearer token, compare it to the `ADMIN_TOKEN` Cloudflare Workers secret (available as `context.locals.runtime.env.ADMIN_TOKEN`), and return a `Response` with status 401 and body `{ "error": "Unauthorized" }` if the token is absent or does not match. Requests to paths not starting with `/admin/` SHALL pass through unmodified.

#### Scenario: Valid token grants access
- **WHEN** a request to `/admin/queue` includes `Authorization: Bearer <correct-token>`
- **THEN** the middleware calls `next()` and the admin page renders

#### Scenario: Missing auth header returns 401
- **WHEN** a request to `/admin/queue` has no `Authorization` header
- **THEN** the middleware returns HTTP 401 with JSON body `{ "error": "Unauthorized" }`

#### Scenario: Wrong token returns 401
- **WHEN** a request to `/admin/queue` includes `Authorization: Bearer wrong-token`
- **THEN** the middleware returns HTTP 401 with JSON body `{ "error": "Unauthorized" }`

#### Scenario: Non-admin routes are not gated
- **WHEN** a request to `/blog/` or `/` is received
- **THEN** the middleware does not check the Authorization header and calls `next()` immediately

#### Scenario: 401 response is not cached
- **WHEN** the middleware returns a 401 response
- **THEN** the response includes `Cache-Control: no-store` to prevent CDN caching of auth failures

### Requirement: Middleware ships atomically with admin pages in the same deployment
`src/middleware.ts` SHALL exist in the repository before any file under `src/pages/admin/` is committed. The CI build (`npm run build`) SHALL fail if any `/admin/*` route exists without `src/middleware.ts` present.

#### Scenario: Admin pages without middleware fail CI
- **WHEN** `src/pages/admin/index.astro` exists and `src/middleware.ts` does not
- **THEN** the Astro build exits with a non-zero code (enforced via a pre-build check script)

#### Scenario: Admin pages with middleware succeed CI
- **WHEN** both `src/middleware.ts` and `src/pages/admin/index.astro` exist
- **THEN** the Astro build completes successfully
