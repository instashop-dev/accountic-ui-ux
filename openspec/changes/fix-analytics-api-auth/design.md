## Context

`analytics.astro` performs a server-side `fetch` to `/admin/api/analytics` to populate the dashboard. It currently forwards only the `Authorization` header:

```js
const res = await fetch(url.toString(), {
  headers: { Authorization: Astro.request.headers.get('Authorization') ?? '' },
});
```

Browser sessions authenticate via the `admin_token` cookie. The `Authorization` header is empty on normal browser visits. The middleware sees an empty bearer token AND no cookie on the internal fetch, so it falls through to `context.redirect('/admin/login')` — returning 302 HTML. The page then calls `res.json()` on that HTML and throws `Unexpected token '<'`.

The middleware's current auth logic:
```
if (token !== ADMIN_PASSWORD) {
  if (bearerToken) → 401 JSON       ← only when Authorization header was present
  else             → 302 HTML       ← catches everything else, including API routes
}
```

The `302 HTML` branch is correct for page routes but wrong for API routes. Any unauthenticated call to `/admin/api/*` silently returns HTML regardless of whether the caller is a browser or a server-side fetch.

## Goals / Non-Goals

**Goals:**
- Fix `/admin/analytics` so the internal fetch includes the `Cookie` header and authenticates correctly
- Make all `/admin/api/*` routes return `401 JSON` when unauthenticated, never `302 HTML`

**Non-Goals:**
- Changing the authentication mechanism (password stays as-is)
- Adding token rotation or session expiry
- Auditing other server-side fetch calls outside the admin panel

## Decisions

**1. Forward `Cookie` header in `analytics.astro`'s internal fetch**

The fix: pass `Cookie: Astro.request.headers.get('Cookie') ?? ''` alongside `Authorization`. This makes the internal fetch carry the same `admin_token` cookie the browser sent.

Alternative considered: Pass the cookie value as `Authorization: Bearer accounticadmin`. Works, but couples the page to knowing the password value directly. Forwarding `Cookie` is more natural and works even if the cookie value changes.

**2. Detect API routes in middleware by path prefix**

Split the unauthenticated response based on whether the route is under `/admin/api/`:

```
/admin/api/* unauthenticated → 401 JSON  (regardless of whether bearer was present)
/admin/*     unauthenticated → 302 HTML redirect
```

This eliminates the entire class of "internal fetch gets HTML instead of JSON" bugs.

Alternative considered: Check `Accept: application/json` header. Less reliable — server-side fetches don't always set `Accept`.

## Risks / Trade-offs

- **[Risk] Forwarding Cookie exposes all cookies to the internal fetch** → Acceptable: this is a same-origin server-side call within the same Cloudflare Worker; no third-party involved.
- **[Trade-off] API routes now return 401 instead of redirecting** → Any browser directly navigating to an API URL (e.g. `/admin/api/analytics`) will see a JSON error rather than a login redirect. Acceptable — those are not user-facing URLs.
