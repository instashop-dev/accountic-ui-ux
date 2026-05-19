## 1. Create shared admin security utility

- [x] 1.1 Create `src/lib/admin-security.ts` with `ADMIN_SECURITY_HEADERS` constant (`Cache-Control: no-store`, `X-Robots-Tag: noindex`, `X-Content-Type-Options: nosniff`)
- [x] 1.2 Add `validateCsrf(request: Request, expectedOrigin: string): boolean` function to `src/lib/admin-security.ts` — checks `Origin` header first, falls back to `Referer` origin, returns `false` if neither matches
- [x] 1.3 Add `validateSlug(slug: string): boolean` function to `src/lib/admin-security.ts` — returns `true` only if slug matches `/^[a-z0-9-]+$/`

## 2. Move admin password to Cloudflare Secret

- [x] 2.1 Update `src/middleware.ts` to read `ADMIN_PASSWORD` from `context.locals.runtime.env.ADMIN_PASSWORD`; remove the `const ADMIN_PASSWORD = 'accounticadmin'` constant; throw if env value is missing
- [x] 2.2 Update `src/pages/admin/login.astro` to read `ADMIN_PASSWORD` from `Astro.locals.runtime.env.ADMIN_PASSWORD`; remove the hardcoded constant
- [x] 2.3 Add a `.dev.vars.example` file (or update existing) documenting `ADMIN_PASSWORD=your-local-dev-password` for local development

## 3. Add CSRF protection to admin POST routes

- [x] 3.1 Add CSRF check (call `validateCsrf`) at the top of `src/pages/admin/api/drafts/[id]/approve.ts` — return 403 JSON on failure
- [x] 3.2 Add CSRF check at the top of `src/pages/admin/api/drafts/[id]/reject.ts` — return 403 JSON on failure
- [x] 3.3 Add CSRF check at the top of `src/pages/admin/api/settings.ts` — return 403 JSON on failure
- [x] 3.4 Add CSRF check at the top of `src/pages/admin/api/prompts/[stage]/save.ts` — return 403 JSON on failure
- [x] 3.5 Add CSRF check at the top of `src/pages/admin/api/jobs/[id]/replay.ts` — return 403 JSON on failure
- [x] 3.6 Add CSRF check at the top of `src/pages/admin/api/refresh.ts` — return 403 JSON on failure (already has some security headers; preserve them)

## 4. Apply consistent security headers to all admin API routes

- [x] 4.1 Update `src/pages/admin/api/drafts/[id]/approve.ts` to spread `ADMIN_SECURITY_HEADERS` into all response constructors
- [x] 4.2 Update `src/pages/admin/api/drafts/[id]/reject.ts` to spread `ADMIN_SECURITY_HEADERS` into all response constructors
- [x] 4.3 Update `src/pages/admin/api/settings.ts` to spread `ADMIN_SECURITY_HEADERS` into all response constructors
- [x] 4.4 Update `src/pages/admin/api/prompts/[stage]/save.ts` to spread `ADMIN_SECURITY_HEADERS` into all response constructors
- [x] 4.5 Update `src/pages/admin/api/jobs/[id]/replay.ts` to spread `ADMIN_SECURITY_HEADERS` into all response constructors
- [x] 4.6 Verify `src/pages/admin/api/refresh.ts` and `src/pages/admin/api/analytics.ts` already use the shared constant (or update them to do so)

## 5. Add slug path-traversal guard

- [x] 5.1 In `src/workers/pipeline/publisher.ts`, call `validateSlug(draft.slug)` before constructing `src/content/blog/${draft.slug}.mdx`; log error and throw (marking job failed) if invalid
- [x] 5.2 In `src/pages/admin/api/refresh.ts`, call `validateSlug(slug)` before constructing the GitHub file path; return HTTP 400 `{"error":"Invalid slug"}` if invalid

## 6. Add input validation to prompt save endpoint

- [x] 6.1 In `src/pages/admin/api/prompts/[stage]/save.ts`, add max-length validation: reject `system_prompt` or `user_prompt_template` longer than 50,000 characters with HTTP 400

## 7. Add job-status guard to replay endpoint

- [x] 7.1 In `src/pages/admin/api/jobs/[id]/replay.ts`, check that the job's `status` field equals `'failed'` before allowing replay; return HTTP 409 `{"error":"Only failed jobs can be replayed"}` otherwise

## 8. Move hardcoded GitHub constants to env vars

- [x] 8.1 In `src/pages/admin/api/refresh.ts`, replace `const GITHUB_OWNER = 'instashop-dev'`, `GITHUB_REPO`, and `GITHUB_BRANCH` with `context.locals.runtime.env.GITHUB_OWNER ?? 'instashop-dev'` (and equivalent defaults for repo/branch)

## 9. Provision secrets and verify

- [ ] 9.1 Run `wrangler secret put ADMIN_PASSWORD` for the production Worker (outside of source code — operational step, document in PR description)
- [ ] 9.2 Verify local dev works by creating `.dev.vars` with `ADMIN_PASSWORD=<dev-password>` and running `wrangler dev`
- [x] 9.3 Run TypeScript type-check (`npx tsc --noEmit`) to confirm no type errors introduced
