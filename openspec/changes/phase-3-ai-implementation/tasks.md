## 1. Secrets and Pre-flight

- [x] 1.1 Document required secrets in README or ops runbook: `ANTHROPIC_API_KEY`, `ADMIN_TOKEN`, `GITHUB_TOKEN`
- [x] 1.2 Run `wrangler secret put ANTHROPIC_API_KEY` to store Anthropic key in Cloudflare
- [x] 1.3 Run `wrangler secret put ADMIN_TOKEN` to store admin Bearer token in Cloudflare
- [x] 1.4 Run `wrangler secret put GITHUB_TOKEN` to store fine-grained GitHub PAT (contents:write scope) in Cloudflare

## 2. D1 Schema — Phase 3 Migration

- [x] 2.1 Create `migrations/002_pipeline.sql` with `topics`, `outlines`, `drafts`, and `prompts` tables (IF NOT EXISTS, all foreign keys, UNIQUE constraints per spec)
- [x] 2.2 Add UNIQUE COLLATE NOCASE constraint on `topics.title`
- [x] 2.3 Seed default active prompts for all four stages in `migrations/002_pipeline.sql`
- [x] 2.4 Create `migrations/002_rollback.sql` dropping all four Phase 3 tables in reverse dependency order
- [x] 2.5 Amend `migrations/001_init.sql` to add the `stage_payload TEXT` nullable column to `generation_jobs`
- [ ] 2.6 Run `npm run db:migrate` locally against the D1 preview database and verify all tables exist

## 3. Shared Library — Claude API Client

- [x] 3.1 Add `@anthropic-ai/sdk` to `package.json` dependencies and run `npm install`
- [x] 3.2 Create `src/lib/ai.ts` exporting `createAIClient(env)` with `generate(params)` method (claude-sonnet-4-6 default, prompt caching on system block)
- [x] 3.3 Implement exponential backoff retry in `ai.ts` (3 retries, 2s/4s/8s, retries on 429/529 only)
- [x] 3.4 Implement `checkTokenBudget(db, tokensRequested)` in `ai.ts` reading `daily_token_cap` and `tokens_used_today` from D1 settings
- [x] 3.5 Add `daily_token_cap` and `tokens_used_today` seed rows to `migrations/002_pipeline.sql` settings inserts (or `001_init.sql` addendum)

## 4. Shared Library — Content Quality

- [x] 4.1 Create `src/lib/quality.ts` exporting `scoreArticle(content, frontmatter): QualityReport`
- [x] 4.2 Implement Flesch Reading Ease scoring in `quality.ts` (strip frontmatter fences and code blocks before scoring, threshold ≥ 70)
- [x] 4.3 Implement originality marker detection in `quality.ts` (numbered workflow ≥ 3 steps, markdown table ≥ 3 rows, concrete Indian tax example, or named case study)
- [x] 4.4 Wire Zod schema validation into `scoreArticle` via `src/lib/schema-validate.ts`
- [x] 4.5 Ensure `quality.ts` exports the `QualityReport` type and does not import from `astro:*`

## 5. Shared Library — Queue Helpers

- [x] 5.1 Create `src/lib/queue.ts` exporting typed queue message constructors for all pipeline stages (`topicDiscoveryMessage`, `outlineMessage`, `articleMessage`, `publishMessage`, `refreshMessage`)
- [x] 5.2 Implement `computeInputHash(stageInputs: object): string` in `queue.ts` using a deterministic JSON stringify + SHA-256 (crypto.subtle) for idempotency keys

## 6. Admin Auth Middleware

- [x] 6.1 Create `src/middleware.ts` exporting Astro `onRequest` that checks `Authorization: Bearer` for all `/admin/*` routes
- [x] 6.2 Return `Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' } })` on auth failure
- [x] 6.3 Add a pre-build check script (or Astro integration hook) that fails the build if any `src/pages/admin/` file exists without `src/middleware.ts`

## 7. Admin Dashboard — Pages and API Routes

- [x] 7.1 Create `src/pages/admin/index.astro` redirecting to `/admin/queue`
- [x] 7.2 Create `src/pages/admin/queue.astro` rendering draft list with Approve/Reject buttons (server-rendered, reads D1)
- [x] 7.3 Create `src/pages/admin/api/drafts/[id]/approve.ts` API route (POST) — updates draft status to `'approved'` and dispatches publish queue message
- [x] 7.4 Create `src/pages/admin/api/drafts/[id]/reject.ts` API route (POST) — updates draft status to `'rejected'`
- [x] 7.5 Create `src/pages/admin/jobs.astro` rendering 100 most recent `generation_jobs` rows with Replay button for failed rows
- [x] 7.6 Create `src/pages/admin/api/jobs/[id]/replay.ts` API route (POST) — re-queues the original job input
- [x] 7.7 Create `src/pages/admin/settings.astro` with form inputs for all configurable D1 settings keys
- [x] 7.8 Create `src/pages/admin/api/settings.ts` API route (POST) — bulk-updates D1 settings rows from form body
- [x] 7.9 Create `src/pages/admin/prompts.astro` rendering prompts grouped by stage with inline edit form
- [x] 7.10 Create `src/pages/admin/api/prompts/[stage]/save.ts` API route (POST) — creates new prompt version and deactivates previous active row

## 8. Pipeline Workers — Topic Discovery

- [x] 8.1 Create `src/workers/pipeline/topic-discovery.ts` exporting a Cloudflare Queue handler
- [x] 8.2 Implement Claude call in topic-discovery worker using `createAIClient`, fetching topics with `stage = 'topic-discovery'` active prompt from D1
- [x] 8.3 Implement deduplication: query `topics` table for existing titles before inserting (case-insensitive COLLATE NOCASE)
- [x] 8.4 Validate returned pillar values against PILLARS enum from `src/blog-meta.ts`; log and skip invalid values
- [x] 8.5 Cap topic insertion at 10 per worker invocation

## 9. Pipeline Workers — Outline Generation

- [x] 9.1 Create `src/workers/pipeline/outline-generation.ts` exporting a Cloudflare Queue handler
- [x] 9.2 Implement topic fetch and status update (`outlining` before call, `outlined` on success, `failed` on error)
- [x] 9.3 Implement Claude call using `createAIClient` with the active `outline-generation` prompt
- [x] 9.4 Write structured outline JSON to `outlines` table linked to `topic_id`
- [x] 9.5 Handle missing `topic_id` gracefully (log and return without throwing)

## 10. Pipeline Workers — Article Generation

- [x] 10.1 Create `src/workers/pipeline/article-generation.ts` exporting a Cloudflare Queue handler
- [x] 10.2 Compute `input_hash` from `{ outline_id, prompt_version }` using `computeInputHash` from `src/lib/queue.ts`
- [x] 10.3 Implement idempotency check: skip generation if `generation_jobs` row with matching `input_hash` and `status = 'done'` exists
- [x] 10.4 Call `checkTokenBudget` before the Claude API call; skip and log if budget exceeded
- [x] 10.5 Implement Claude call using the active `article-generation` prompt; parse output as MDX with YAML frontmatter
- [x] 10.6 Run `scoreArticle` from `src/lib/quality.ts`; write to `drafts` with `status = 'ready'` (pass) or `status = 'failed'` with structured `error` JSON (fail)
- [x] 10.7 Update `tokens_used_today` in D1 settings after a successful Claude call
- [x] 10.8 Write `generation_jobs` row with `input_hash`, `status`, and `output_ref` (draft ID)

## 11. Pipeline Workers — Publisher

- [x] 11.1 Create `src/workers/pipeline/publisher.ts` exporting a Cloudflare Queue handler
- [x] 11.2 Fetch approved draft from D1; validate `status = 'approved'` before proceeding
- [x] 11.3 Construct target path `src/content/blog/<slug>.mdx` and commit via GitHub Contents REST API (`PUT /repos/{owner}/{repo}/contents/{path}`)
- [x] 11.4 Include generation metadata in commit message: `[ai-gen] <title> | draft_id=<id> | job_id=<id>`
- [x] 11.5 On GitHub 2xx response: update `drafts.status = 'published'`; insert new row into `posts` with `source = 'ai'`
- [x] 11.6 On GitHub non-2xx response: set `drafts.status = 'publish_failed'` and store response body in `drafts.error`

## 12. Cron Handler

- [x] 12.1 Create `src/workers/pipeline/cron.ts` exporting a Cloudflare `scheduled` handler
- [x] 12.2 Read `generation_enabled` from D1 settings; return early if not `'true'`
- [x] 12.3 On `"0 3 * * 1"` cron: dispatch one `topicDiscoveryMessage` to `blog-pipeline` queue
- [x] 12.4 On `"0 4 * * *"` cron: query `posts` for rows where `updated_at < (now - 60 days)`; dispatch one `refreshMessage` per stale post

## 13. wrangler.jsonc — Queue Consumer Wiring

- [x] 13.1 Add `queues.consumers` entries to `wrangler.jsonc` for `blog-pipeline` (pointing to `src/workers/pipeline/outline-generation.ts`) and `blog-publish` (pointing to `src/workers/pipeline/publisher.ts`)
- [x] 13.2 Add the cron handler entry point under `triggers.crons` wiring `src/workers/pipeline/cron.ts`
- [x] 13.3 Verify all existing `wrangler.jsonc` keys (`ASSETS`, `SIGNUP_NOTIFY`, `observability`, `compatibility_date`) are unchanged

## 14. Validation and Build Verification

- [x] 14.1 Run `npx astro build` and confirm it completes with no errors
- [x] 14.2 Run `npm run blog:validate` against a sample AI-generated MDX draft to confirm the validation CLI works end-to-end
- [x] 14.3 Run `npx wrangler deploy --dry-run` to confirm the worker manifest is valid before pushing to production
- [ ] 14.4 Push to `main` and confirm GitHub Actions CI completes successfully (build + deploy steps both green)
- [ ] 14.5 Enable generation via admin dashboard (`generation_enabled = 'true'`, `auto_publish = 'false'`) and verify the next cron window dispatches a topic-discovery message visible in the Cloudflare dashboard Queue metrics
