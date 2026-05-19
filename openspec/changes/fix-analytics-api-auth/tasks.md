## 1. Fix Middleware — API Routes Return 401 JSON

- [x] 1.1 In `src/middleware.ts`, add a check for `/admin/api/` path prefix in the unauthenticated branch — return `401 JSON` instead of `302` redirect for all API routes

## 2. Fix Analytics Page — Forward Cookie on Internal Fetch

- [x] 2.1 In `src/pages/admin/analytics.astro`, add `Cookie: Astro.request.headers.get('Cookie') ?? ''` to the headers of the internal `fetch('/admin/api/analytics', ...)` call

## 3. Verify

- [x] 3.1 Visit `/admin/analytics` while logged in — confirm dashboard loads without JSON parse error
- [x] 3.2 Confirm `/admin/api/analytics` returns `401 JSON` when called without auth (e.g. via `fetch('/admin/api/analytics')` in the browser console while logged out)
- [x] 3.3 Confirm unauthenticated visit to `/admin/queue` still redirects to `/admin/login`
