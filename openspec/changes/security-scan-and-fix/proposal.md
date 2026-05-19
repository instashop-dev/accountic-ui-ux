## Why

A security audit of the admin pipeline and blog automation code revealed critical vulnerabilities including a hardcoded admin password, missing CSRF protection on all state-changing admin routes, and inconsistent security headers — any of which could allow unauthorized content publication, pipeline manipulation, or account takeover. These issues need to be fixed before the site handles real production traffic.

## What Changes

- Move hardcoded `ADMIN_PASSWORD` from source code to a Cloudflare Secret (`env.ADMIN_PASSWORD`), eliminating the plaintext credential from the repository
- Add CSRF protection (Origin/Referer header validation) to all admin POST endpoints: approve, reject, settings, prompts save, jobs replay, and refresh
- Add a shared `adminSecurityHeaders` constant and apply it consistently to all admin API responses (currently only `refresh.ts` and `analytics.ts` include `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `X-Content-Type-Options: nosniff`)
- Add path traversal guard on `slug` before constructing GitHub file paths in `publisher.ts` and `refresh.ts`
- Add length and basic content validation on prompt save endpoint (`src/pages/admin/api/prompts/[stage]/save.ts`)
- Add replay validation: only allow replaying jobs with `status = 'failed'`; validate `stage_payload` structure before re-enqueueing
- Move hardcoded `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` constants to environment variables in `refresh.ts`

## Capabilities

### New Capabilities
- `admin-csrf-protection`: CSRF defense layer validating Origin/Referer headers on all state-changing admin API routes
- `admin-security-headers`: Shared security header constants applied uniformly across all admin API responses
- `slug-path-guard`: Validation that rejects slugs containing `..` or path separators before GitHub file path construction

### Modified Capabilities
- `admin-auth`: Admin authentication now reads password from `env.ADMIN_PASSWORD` (Cloudflare Secret) instead of hardcoded string; affects `src/middleware.ts` and `src/pages/admin/login.astro`

## Impact

- `src/middleware.ts` — reads `ADMIN_PASSWORD` from `Astro.locals.runtime.env`
- `src/pages/admin/login.astro` — reads password from runtime env instead of constant
- `src/pages/admin/api/approve.ts`, `reject.ts`, `settings.ts`, `prompts/[stage]/save.ts`, `jobs/[id]/replay.ts`, `refresh.ts` — CSRF check added to each
- `src/pages/admin/api/refresh.ts` — `GITHUB_OWNER/REPO/BRANCH` moved to env vars; slug path-traversal guard added
- `src/workers/pipeline/publisher.ts` — slug path-traversal guard added before file path construction
- Cloudflare Workers environment: `ADMIN_PASSWORD` secret must be provisioned via `wrangler secret put ADMIN_PASSWORD` before deployment
- No external API or schema changes; no breaking changes to the public site
