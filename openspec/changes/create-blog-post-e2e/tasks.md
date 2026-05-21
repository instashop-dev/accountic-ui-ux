## 1. Generate Endpoint

- [x] 1.1 Create `src/pages/admin/api/generate.ts` exporting a `POST` APIRoute
- [x] 1.2 Add CSRF origin validation using `validateCsrf` from `admin-security`
- [x] 1.3 Check `BLOG_DB` and `BLOG_PIPELINE_QUEUE` bindings — return 503 if absent
- [x] 1.4 Query `settings` table for `generation_enabled`; return 409 JSON if not `'true'`
- [x] 1.5 Call `BLOG_PIPELINE_QUEUE.send(topicDiscoveryMessage(1))` and redirect 303 to `/admin/jobs`
- [x] 1.6 Apply `ADMIN_SECURITY_HEADERS` to all non-redirect responses

## 2. Jobs Page UI

- [x] 2.1 Add a `<form method="POST" action="/admin/api/generate">` with a "Generate 1 Post" submit button above the jobs table in `src/pages/admin/jobs.astro`
- [x] 2.2 Style the button consistently with existing admin action buttons

## 3. Verification

- [ ] 3.1 Deploy to staging and click "Generate 1 Post" — confirm a `topic-discovery` job row appears in `/admin/jobs`
- [ ] 3.2 Wait for the pipeline to progress through outline → article → humanizer stages and confirm a draft appears in `/admin/queue`
- [ ] 3.3 Approve the draft from `/admin/queue` and confirm a `publisher` job appears and completes
- [ ] 3.4 Confirm the published post appears on the live site
