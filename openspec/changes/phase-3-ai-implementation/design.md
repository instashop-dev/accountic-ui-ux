## Context

Phase 2 delivered: Cloudflare binding stubs in `wrangler.jsonc` (D1 `BLOG_DB`, KV `BLOG_KV`, R2 `BLOG_ASSETS`, Queues `blog-pipeline`/`blog-publish`, two cron triggers), a D1 schema with `posts`, `generation_jobs`, and `settings` tables, shared libraries (`src/lib/frontmatter.ts`, `slug.ts`, `schema-validate.ts`), CI/CD via GitHub Actions, and a post-validation CLI.

Phase 3 builds the AI content generation pipeline entirely on top of those foundations. The site is an Astro 6.1 static site deployed to Cloudflare Pages/Workers. The AI pipeline runs as Cloudflare Queue consumers (separate from the static site Worker). All AI calls go through the Anthropic Claude API (claude-sonnet-4-6 as default; configurable in D1 settings). The content contract (Zod schema in `src/content.config.ts`, enum values in `src/blog-meta.ts`) is the boundary between generated content and the Astro blog — no generated content may bypass it.

**Key stakeholders / operators:** Two CAs (domain reviewers) + one IT co-founder (infra operator). The admin dashboard is the primary control surface; all generation can be paused, inspected, and replayed without touching code.

## Goals / Non-Goals

**Goals:**
- Four-stage async pipeline (topic → outline → article → publish) driven by Cloudflare Queues, fully resumable across Worker restarts
- Protected admin dashboard for draft review, job monitoring, prompt versioning, and per-setting configuration
- Content quality gate that enforces readability (>70 Flesch), originality (unique insight per article), and Zod schema compliance before any draft advances to publish
- Token budget controls (daily cap, per-call max) to prevent runaway API spend
- Idempotency across all pipeline stages so queue retries never produce duplicate posts
- Atomic admin auth: middleware ships in the same deployment as admin pages — no window of public exposure
- Additive-only D1 migration; Phase 2 schema rows are never altered

**Non-Goals:**
- Real-time streaming of generation progress to the browser (async job polling is sufficient for v1)
- Multi-tenant or per-user generation quotas (single-firm deployment)
- Image generation (illustration pipeline is out of scope for Phase 3; planned separately)
- Modifying existing Astro pages, layouts, components, or the design system
- SEO schema markup injection (separate capability)
- Programmatic changes to `src/blog-meta.ts` PILLARS or tone enums (taxonomy governance is a separate change)

## Decisions

### D1: Queue consumers read and write pipeline state directly

**Decision:** Queue consumer Workers read and write `generation_jobs` and the new `topics`, `outlines`, `drafts`, and `prompts` tables in D1 directly via the `BLOG_DB` binding.

**Rationale:** D1 is already provisioned and is the right source of truth for pipeline state. A separate KV cache layer would add complexity with no latency benefit for batch generation (which has no SLA < 10s). D1 transactions ensure no race conditions when multiple queue messages arrive for the same post.

**Alternative considered:** KV-backed state store. Rejected because KV has no atomic updates and no relational queries needed for the admin dashboard.

---

### Four discrete Queue consumer Workers (not a monolith)

**Decision:** Each pipeline stage (topic-discovery, outline-generation, article-generation, publisher) is a separate Cloudflare Worker entry point consuming its own queue.

**Rationale:** Cloudflare Workers have a 30-second CPU time limit per invocation. Article generation (multiple Claude calls) reliably exceeds this limit if done synchronously. Queue fan-out lets each stage run within budget, retry independently, and be deployed or rolled back independently. Dead-letter queues are per-stage, so a failure in article-generation does not block already-completed outlines.

**Alternative considered:** A single orchestrator Worker using Durable Objects. Rejected: Durable Objects add billing complexity and the queue fan-out model is simpler and already configured (Phase 2 created the queues).

---

### Claude API: claude-sonnet-4-6 with prompt caching

**Decision:** `src/lib/ai.ts` uses `claude-sonnet-4-6` as the default model with Anthropic prompt caching enabled on system prompts and static context blocks.

**Rationale:** Sonnet 4.6 provides the best quality/cost ratio for long-form structured writing. Prompt caching reduces token costs by ~60% for the system prompt (shared across all generation calls). The model is configurable via D1 `settings` key `ai_model` so operators can switch without a code deploy.

**Alternative considered:** GPT-4o. Rejected: Anthropic SDK is already in the project toolchain decision; claude-sonnet-4-6 has stronger instruction-following for structured YAML/Markdown output.

---

### Admin auth: Astro middleware + Bearer token (not OAuth)

**Decision:** `src/middleware.ts` uses a static Bearer token stored as a Cloudflare Workers secret (`ADMIN_TOKEN`). The middleware intercepts all requests to `/admin/*` and returns 401 if the `Authorization: Bearer <token>` header is absent or incorrect.

**Rationale:** The admin dashboard is a single-operator tool (one IT co-founder). OAuth adds significant complexity and an external identity provider dependency. A secret-backed Bearer token provides adequate security for an internal tool while shipping atomically with the admin pages.

**Alternative considered:** HTTP Basic Auth. Rejected: modern browsers and fetch clients handle Bearer tokens more cleanly; Basic Auth sends base64-encoded credentials on every request and is more error-prone.

---

### Content quality gate: block before D1 write, not before commit

**Decision:** Quality scoring (`src/lib/quality.ts`) runs inside the article-generation Worker before the draft is written to D1 `drafts` with status `ready`. Drafts that fail scoring are written with status `failed` and a structured `error` JSON payload.

**Rationale:** Failing early (before D1 write) would lose the generated content entirely, making it impossible to inspect what failed and why. Writing failed drafts to D1 enables the admin dashboard to surface them, let operators inspect the generated text, override the quality gate for specific articles, and replay with an updated prompt.

---

### Publisher Worker: GitHub commit via REST API (not `git` CLI)

**Decision:** The publisher Worker sends validated draft content to GitHub via the Contents REST API (`PUT /repos/{owner}/{repo}/contents/{path}`) using a `GITHUB_TOKEN` secret.

**Rationale:** Cloudflare Workers have no filesystem or `git` binary. The GitHub REST API is the only viable mechanism for Workers to commit files. This also provides an atomic, auditable commit per article with metadata (generation job ID, D1 draft ID) in the commit message.

**Alternative considered:** R2-backed staging + manual operator pull. Rejected: adds a manual step that defeats the automation goal; GitHub as the source of truth is already established via Phase 2 CI/CD.

---

### Idempotency: input hash on `generation_jobs`

**Decision:** Before dispatching a queue message for any stage, the orchestrator computes a deterministic hash of the stage inputs (topic text + outline ID, etc.) and writes it to `generation_jobs.input_hash`. If a message is retried and a `generation_jobs` row with the same `input_hash` and `status = 'done'` already exists, the consumer skips generation and returns the existing output reference.

**Rationale:** Cloudflare Queues guarantee at-least-once delivery. Without idempotency, retries produce duplicate articles. The `input_hash` column (added in Phase 2 schema) is the correct idempotency key; no additional infrastructure is needed.

## Risks / Trade-offs

**[Risk] Admin pages deployed before auth middleware is active** → Mitigation: `src/middleware.ts` and all files under `src/pages/admin/` are in the same task. The task will fail if `middleware.ts` is not present when admin pages are built. CI will catch this before deployment.

**[Risk] D1 is eventually consistent across regions** → Mitigation: All pipeline state reads and writes go through the primary D1 instance (Cloudflare enforces this for Workers bound to D1). Admin dashboard reads may see slight lag on geo-distributed deployments — acceptable for a batch monitoring tool.

**[Risk] Cloudflare Queue message size limit (128 KB)** → Mitigation: Queue messages carry only IDs and stage metadata. Generated content (which can be 3–8 KB) is always written to D1 first; the next-stage message carries only the `generation_jobs.id`. Content never travels through the queue itself.

**[Risk] Anthropic API rate limits during burst** → Mitigation: `src/lib/ai.ts` implements exponential backoff (3 retries, 2s/4s/8s delays). The cron trigger fires at 03:00 and 04:00 UTC (low-traffic windows). Daily token cap hard-stops generation to prevent quota exhaustion.

**[Risk] Generated content failing Zod schema validation** → Mitigation: The article-generation prompt includes explicit schema constraints and one-shot examples. `src/lib/schema-validate.ts` validates before any D1 write; failures are quarantined in `drafts` with a structured error for operator inspection and prompt tuning.

**[Risk] Publisher commits triggering CI build loops** → Mitigation: GitHub Actions workflow already exists (Phase 2). Publisher commits use a dedicated `GITHUB_TOKEN` (bot account or fine-grained PAT). CI runs only on push to `main` — publisher commits to `main` will trigger builds, which is the intended behavior (auto-publish flow).

**[Risk] `ADMIN_TOKEN` rotation requires a Worker redeploy** → Mitigation: Token rotation requires `wrangler secret put ADMIN_TOKEN` + `wrangler deploy`. This is a known operator procedure. For Phase 3 v1, this is acceptable. Session tokens or short-lived JWTs are a Phase 4 hardening item.

## Migration Plan

1. **Secrets:** Operator runs `wrangler secret put ANTHROPIC_API_KEY`, `wrangler secret put ADMIN_TOKEN`, `wrangler secret put GITHUB_TOKEN` before deploying.
2. **D1 migration:** `npm run db:migrate` applies `migrations/002_pipeline.sql` (additive; no data loss).
3. **Deploy:** `git push origin main` triggers GitHub Actions, which runs `astro build` + `wrangler deploy`. All new Workers, admin pages, and middleware deploy atomically.
4. **Enable generation:** Operator sets `generation_enabled = 'true'` in D1 settings (via admin dashboard or `wrangler d1 execute`). The cron trigger begins firing on its next scheduled window.

**Rollback:**
- Disable generation: set `generation_enabled = 'false'` in D1 settings (takes effect at next cron window).
- Full rollback: revert the commit, push to main, CI redeploys the previous build. Run `migrations/002_rollback.sql` to drop Phase 3 tables if needed.

## Open Questions

1. **Auto-publish vs. review-gate default:** Should `generation_enabled` default to `'false'` (human review required before publish) or should there be a separate `auto_publish` setting? Recommend a separate `auto_publish = 'false'` key so generation can run while auto-publish stays off during the initial review period.
2. **Draft approval workflow:** Should the admin dashboard support a multi-stage approval (CA domain review → IT sign-off → publish) or a single-click approve? Recommend single-click for v1 with the CA being the sole reviewer.
3. **`GITHUB_TOKEN` scope:** Fine-grained PAT (contents:write on target repo only) vs. classic PAT. Recommend fine-grained PAT to limit blast radius if the secret is ever leaked.
