## 1. D1 Schema — Phase 4 Migration

- [x] 1.1 Create `migrations/003_humanizer.sql` with `humanizer_jobs` table (IF NOT EXISTS, UNIQUE on `draft_id + input_hash`, columns: `id`, `draft_id`, `input_hash`, `outcome`, `tokens_used`, `duration_ms`, `error`, `created_at`)
- [x] 1.2 Add `ALTER TABLE drafts ADD COLUMN humanized_at TEXT` to `migrations/003_humanizer.sql`
- [x] 1.3 Add `ALTER TABLE drafts ADD COLUMN internal_links_added INTEGER DEFAULT 0` to `migrations/003_humanizer.sql`
- [x] 1.4 Insert default humanizer prompt (INSERT OR IGNORE) into `prompts` table within `migrations/003_humanizer.sql`; prompt MUST include explicit CONSTRAINTS section forbidding fabrication and requiring style-preserving mode only
- [x] 1.5 Insert `humanizer_enabled = 'true'` settings row (INSERT OR IGNORE) within `migrations/003_humanizer.sql`
- [x] 1.6 Insert `humanizer_temperature = '0.3'` settings row (INSERT OR IGNORE) within `migrations/003_humanizer.sql`
- [x] 1.7 Insert `humanizer_similarity_threshold = '0.70'` settings row (INSERT OR IGNORE) within `migrations/003_humanizer.sql`
- [x] 1.8 Create `migrations/003_rollback.sql` dropping `humanizer_jobs`, removing the two new `drafts` columns, and deleting humanizer prompts and settings keys
- [x] 1.9 Run `npm run db:migrate` locally to verify all Phase 4 schema changes apply cleanly on top of Phase 2/3 migrations

## 2. Shared Library — Analytics Engine

- [x] 2.1 Create `src/lib/analytics.ts` exporting `PipelineEvent` type with fields: `event`, `stage`, `article_id`, `tokens_used`, `duration_ms`, `quality_score`, `outcome`, and optional `reason` and `failed_gate` string fields
- [x] 2.2 Implement `logEvent(env, event)` in `analytics.ts` writing to `env.BLOG_ANALYTICS` Analytics Engine dataset
- [x] 2.3 Wrap `env.BLOG_ANALYTICS` access in a try/catch no-op so `logEvent` never throws when binding is absent (local dev support)

## 3. Shared Library — Internal Linker

- [x] 3.1 Create `src/lib/linker.ts` exporting `InternalLink` type with fields `{ slug, title, anchor }`
- [x] 3.2 Implement `findInternalLinks(db, frontmatter, currentSlug)` querying D1 `posts` by `pillar` match or tag overlap, excluding current slug, capped at 5, ordered by `published_at DESC`
- [x] 3.3 Implement `injectInternalLinks(content, links)` wrapping first unlinked occurrence of each anchor term as a Markdown link, skipping code fences and already-linked terms

## 4. Shared Library — SEO Schema

- [x] 4.1 Create `src/lib/seo-schema.ts` exporting `generateArticleSchema(frontmatter)` returning valid Article JSON-LD string
- [x] 4.2 Implement `generateFAQSchema(content)` extracting Q&A pairs from `## FAQ` / `## Frequently Asked Questions` sections only (exact heading match), returning `FAQPage` JSON-LD or `null`, capped at 10 pairs
- [x] 4.3 Implement `generateBreadcrumbSchema(pillar, slug, title)` returning a three-level `BreadcrumbList` JSON-LD string

## 5. Shared Library — Protected Region Extractor

- [x] 5.1 Create `src/lib/humanizer-regions.ts` exporting `extractLockedRegions(content: string): { stripped: string, regions: string[] }` that finds all `<!-- HUMANIZER_LOCK_START -->` ... `<!-- HUMANIZER_LOCK_END -->` pairs and replaces each with `__LOCKED_REGION_N__` placeholders
- [x] 5.2 Export `restoreLockedRegions(content: string, regions: string[]): string | null` that substitutes placeholders back with original content; returns `null` if any placeholder is missing from `content`

## 6. Shared Library — Semantic Regression Detector

- [x] 6.1 Create `src/lib/regression.ts` exporting `RegressionResult` type: `{ passed: boolean, failed_gate: 'similarity' | 'heading' | 'compliance_entity' | 'placeholder_missing' | null }`
- [x] 6.2 Implement `computeBigramJaccard(a: string, b: string): number` — strip Markdown syntax, compute word bigrams for each string, return Jaccard similarity (intersection / union)
- [x] 6.3 Implement `extractHeadings(content: string): string[]` — extract all `##` and `###` heading text, trimmed
- [x] 6.4 Implement `extractComplianceEntities(content: string): Set<string>` — extract GST, TDS, ITR, PAN, TAN, GSTIN, CGST, SGST, IGST, TCS, RCM, QRMP keywords; section-number patterns (`[Ss]ection\s+\d+[A-Z]?`, `u/s\s+\d+`); and all numeric values (strip commas, currency symbols like ₹ before collecting)
- [x] 6.5 Implement `checkNewNumerics(original: string, humanized: string): boolean` — detect numeric values in humanized text that were NOT in original (fabricated figures); returns `true` if fabricated numerics found
- [x] 6.6 Implement `detectRegression(original: string, humanized: string, threshold: number): RegressionResult` — runs all three gates in order; returns first failure or `{ passed: true, failed_gate: null }`

## 7. Pipeline Worker — Humanizer

- [x] 7.1 Create `src/workers/pipeline/humanizer.ts` exporting a Cloudflare Queue handler
- [x] 7.2 Implement D1 settings reads on startup: `humanizer_enabled`, `humanizer_temperature` (clamp 0.2–0.4, default 0.3), `humanizer_similarity_threshold` (default 0.70)
- [x] 7.3 Implement `humanizer_enabled != 'true'` bypass: retain original content, set `drafts.status = 'humanized'`, log `humanizer_fallback` with `reason: 'disabled'`, dispatch to `blog-publish`, return
- [x] 7.4 Implement `status != 'ready'` early-exit guard: log `humanizer_skipped` event and return without modifying D1
- [x] 7.5 Implement idempotency check: if draft already at `status = 'humanized'`, return without processing
- [x] 7.6 Fetch active `humanizer` stage prompt from D1 `prompts`; if absent, set `drafts.status = 'failed'` with structured error, log event, return without dispatching to `blog-publish`
- [x] 7.7 Call `checkTokenBudget` before Claude call; if budget exceeded, retain original, set `drafts.status = 'humanized'`, log `humanizer_fallback` with `reason: 'budget_exceeded'`, dispatch to `blog-publish`, return
- [x] 7.8 Call `extractLockedRegions` from `src/lib/humanizer-regions.ts` to strip protected regions before sending to Claude
- [x] 7.9 Call Claude API (claude-haiku-4-5) with the humanizer prompt as system block, `temperature` from settings, stripped content as user turn
- [x] 7.10 Call `restoreLockedRegions` on Claude's response; if `null` (placeholder missing), log `regression_detected` with `failed_gate: 'placeholder_missing'` and fall back to original content
- [x] 7.11 Run `detectRegression` from `src/lib/regression.ts` on original vs. restored humanized content; if failed, log `regression_detected` with specific `failed_gate`, fall back to original
- [x] 7.12 Check for fabricated numerics using `checkNewNumerics`; if found, treat as `compliance_entity` gate failure (fall back, log regression)
- [x] 7.13 Run `scoreArticle` on accepted humanized content; if lower than original score, fall back to original (log `humanizer_fallback` with `reason: 'regression'`)
- [x] 7.14 Update `drafts.content`, `drafts.humanized_at` (ISO 8601), and `drafts.status = 'humanized'` in D1
- [x] 7.15 Insert row into `humanizer_jobs` with `draft_id`, `input_hash` (hash of `draft_id + prompt_version`), `outcome`, `tokens_used`, `duration_ms`
- [x] 7.16 Dispatch `{ "draft_id": "<id>" }` to `blog-publish` queue on any completion path where `status = 'humanized'` (success or fallback); never dispatch if `status = 'failed'`
- [x] 7.17 Log `humanizer_success` event with `tokens_used`, `duration_ms`, `quality_score` (post-humanization Flesch score) on accepted humanization
- [x] 7.18 Confirm the humanizer system prompt seed (1.4) includes explicit CONSTRAINTS: no fabrication of case studies / statistics / legal outcomes / notices / experiences; preserve regulatory references; preserve numerical values; style edits only

## 8. Modify Pipeline Worker — Article Generation

- [x] 8.1 In `src/workers/pipeline/article-generation.ts`, change the post-quality-pass dispatch from `blog-publish` queue to `blog-humanize` queue
- [x] 8.2 Verify failed drafts (`status = 'failed'`) do NOT dispatch to `blog-humanize`
- [x] 8.3 Add `logEvent` calls: `article_generation_start` (start), `article_generated` with `tokens_used` + `quality_score` (success), `article_generation_failed` (quality gate fail), `article_generation_skipped` (idempotency skip)

## 9. Modify Pipeline Worker — Publisher

- [x] 9.1 In `src/workers/pipeline/publisher.ts`, confirm the existing `status = 'approved'` check is preserved (no change to the status value being checked — publisher still expects `'approved'`)
- [x] 9.2 Before constructing MDX content, call `findInternalLinks` from `src/lib/linker.ts` and `injectInternalLinks` on the draft body; update `drafts.internal_links_added` with the count returned
- [x] 9.3 After internal link injection, append `<script type="application/ld+json">[...]</script>` block using all three schema generators from `src/lib/seo-schema.ts`
- [x] 9.4 Add `logEvent` calls: `article_publish_start`, `article_published` (success), `article_publish_failed` (GitHub error)

## 10. wrangler.jsonc — Queue and Analytics Engine Bindings

- [x] 10.1 Add `blog-humanize` queue producer binding to `src/workers/pipeline/article-generation.ts` Worker entry point
- [x] 10.2 Add `blog-humanize` queue consumer binding pointing to `src/workers/pipeline/humanizer.ts`
- [x] 10.3 Add `analytics_engine_datasets` binding named `BLOG_ANALYTICS` with dataset `blog-pipeline-events` available to all pipeline Worker entry points
- [x] 10.4 Verify all existing `wrangler.jsonc` keys (`ASSETS`, `SIGNUP_NOTIFY`, `observability`, `compatibility_date`, Phase 3 queue bindings, cron triggers) are unchanged

## 11. Admin Dashboard — Queue Page Update

- [x] 11.1 In `src/pages/admin/queue.astro`, add `'humanized'` to the status badge colour map with a distinct teal/cyan colour (e.g., `#0891b2`)
- [x] 11.2 Update the Approve/Reject button display condition to show for both `status = 'ready'` AND `status = 'humanized'` drafts (additive — `'ready'` button display unchanged for in-flight Phase 3 drafts)
- [x] 11.3 Add `humanized_at` column to the draft list table, displaying the ISO timestamp or "Pending" if null

## 12. Validation and Build Verification

- [x] 12.1 Run `npx astro build` and confirm it completes with no errors
- [x] 12.2 Run `npx wrangler deploy --dry-run` to confirm the updated worker manifest (including `blog-humanize` consumer and `BLOG_ANALYTICS` binding) is valid
- [x] 12.3 Push to `main` and confirm GitHub Actions CI completes successfully (build + deploy both green)
- [x] 12.4 In Cloudflare dashboard, confirm `blog-humanize` queue exists and `BLOG_ANALYTICS` dataset appears under Analytics Engine after next pipeline run
- [x] 12.5 Verify ops runbook (`docs/ops-runbook.md`) is updated with: Phase 4 D1 settings keys (`humanizer_enabled`, `humanizer_temperature`, `humanizer_similarity_threshold`), the protected region comment syntax, and the note about in-flight `'ready'` drafts bypassing humanization
