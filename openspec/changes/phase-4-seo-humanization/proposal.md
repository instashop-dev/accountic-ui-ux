## Why

Phase 3 delivered the core AI generation pipeline and admin dashboard, but three critical quality layers were explicitly deferred: a humanization pass to eliminate robotic prose, SEO structured data injection to capture AI Overviews and featured snippets, and Analytics Engine observability to give operators visibility into pipeline health and cost. Without these, the system publishes content that may pass quality scoring but still reads as AI-generated, lacks the schema signals Google needs for rich results, and offers no telemetry for diagnosing failures or controlling spend.

## What Changes

- `src/workers/pipeline/humanizer.ts` — new Queue consumer worker inserted between article-generation and publisher; runs a dedicated Claude pass to improve readability, vary sentence structure, strip AI clichés, and add internal links
- `src/lib/linker.ts` — new library module: queries existing D1 `posts` table to find 3–5 contextually relevant internal links, injecting them into article Markdown before the humanizer commit
- `src/lib/seo-schema.ts` — new library module: generates FAQ schema, Article schema, and Breadcrumb schema JSON-LD blocks from article frontmatter and content, injected as an MDX component at publish time
- `src/lib/analytics.ts` — new library module: thin wrapper around Cloudflare Analytics Engine (`BLOG_ANALYTICS` binding) for structured event logging (generation start/end, token usage, quality scores, publish outcome)
- `migrations/003_humanizer.sql` — new additive D1 migration: adds `humanizer_jobs` table and `humanized_at`/`internal_links_added` columns to `drafts`; adds `humanize` queue binding reference
- `wrangler.jsonc` — adds `blog-humanize` queue producer/consumer binding and `BLOG_ANALYTICS` Analytics Engine binding
- All four existing pipeline workers (`topic-discovery`, `outline-generation`, `article-generation`, `publisher`) gain Analytics Engine event calls via `src/lib/analytics.ts` — no behavior changes, additive instrumentation only

No existing Astro routes, layouts, components, design system files, or Phase 2/3 migration files are modified.

## Capabilities

### New Capabilities

- `humanizer-worker`: Queue-driven Worker that runs a dedicated Claude humanization pass on approved drafts — improves readability, varies sentence structure, removes AI clichés, and validates the post still passes `scoreArticle` after humanization
- `internal-linker`: Library module that queries D1 `posts` for contextually related posts and injects 3–5 Markdown inline links into the draft body before humanization completes
- `seo-schema-injection`: Library module that generates valid FAQ, Article, and Breadcrumb JSON-LD from article frontmatter; injected as a `<script type="application/ld+json">` block in the MDX file at publish time
- `analytics-engine`: Thin wrapper around Cloudflare Analytics Engine for structured pipeline telemetry — tracks generation duration, token usage, quality scores, humanizer pass results, and publish outcomes per article

### Modified Capabilities

- `ai-pipeline-workers`: Article-generation worker now dispatches to the new `blog-humanize` queue (instead of directly to `blog-publish`) after a draft passes quality scoring; publisher worker now reads from D1 `drafts` where `status = 'humanized'` (previously `'approved'`)
- `d1-schema`: `drafts` table gains `humanized_at` (TEXT nullable) and `internal_links_added` (INTEGER DEFAULT 0) columns; new `humanizer_jobs` table tracks humanizer pass state

## Impact

- **Cloudflare Workers runtime:** One new Queue consumer (`blog-humanize` → `src/workers/pipeline/humanizer.ts`); existing pipeline workers gain `BLOG_ANALYTICS` binding calls
- **Cloudflare Queues:** `blog-humanize` queue added between `blog-pipeline` (article-generation output) and `blog-publish` (publisher input) — changes the pipeline flow from 4-stage to 5-stage
- **`wrangler.jsonc`:** Two new bindings: `queues.consumers` entry for `blog-humanize`, and `analytics_engine_datasets` entry for `BLOG_ANALYTICS`
- **D1 database:** `migrations/003_humanizer.sql` is additive; Phase 2/3 rows unaffected
- **Admin dashboard:** Publisher worker status filter changes from `status = 'approved'` to `status = 'humanized'`; admin queue page will show humanizer status column (additive UI change to `src/pages/admin/queue.astro`)
- **Anthropic API:** Humanizer worker makes an additional Claude call per article (claude-haiku-4-5 to minimize cost); daily token budget applies
- **SEO contract:** Generated MDX files will include a `<script>` JSON-LD block — no changes to `src/content.config.ts` schema required (injected as raw HTML via MDX)
- **Dependencies:** No new npm packages; `@anthropic-ai/sdk` already installed (Phase 3)
