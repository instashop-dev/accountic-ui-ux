## Context

The production codebase is Astro 6.1 on Cloudflare Workers with a single active binding (`SIGNUP_NOTIFY` send_email) and no database, KV, R2, or queue infrastructure. Deployment is manual (`npm run deploy`). The blog content system is SSG-only: posts are static `.md` files in `src/content/blog/`, validated at build time by a Zod schema that enforces `title`, `description`, `pubDate`, and `pillar` as required fields, and constrains `pillar` and `tone` to closed enum values.

This phase wires up the infrastructure scaffolding that all subsequent phases (AI Pipeline, Admin Dashboard, Astro Integration) depend on. No AI pipeline workers or admin routes are created here — only the config, schema, scripts, and library code they will import.

## Goals / Non-Goals

**Goals:**

- Declare all required Cloudflare bindings in `wrangler.jsonc` so that subsequent phases can reference them by name without a config change
- Establish the D1 schema as the single source of truth for post metadata, generation job state, and admin settings
- Create a GitHub Actions workflow so that `git push` to main triggers a production deploy (CI/CD prerequisite for automated publishing)
- Create `src/lib/` as the canonical shared utility directory, with frontmatter parsing, slug generation, and Zod validation helpers that pipeline workers will import
- Create CLI scripts for one-time provisioning and pre-publish frontmatter validation
- Produce zero production regressions: `astro build` must pass after every task

**Non-Goals:**

- Actually provisioning live Cloudflare resources (D1, KV, R2, Queues) — `scripts/provision.ts` guides the operator but does not run automatically
- Creating any Cloudflare Worker scripts (`src/workers/`) — that is Phase 3 (AI Pipeline)
- Creating any admin UI or middleware (`src/pages/admin/`, `src/middleware.ts`) — that is Phase 5 (Admin Dashboard)
- Seeding the D1 database with data
- Modifying any frozen files from the discovery analysis

## Decisions

**D1 — Three-table D1 schema: `posts`, `generation_jobs`, `settings`**

`posts` tracks every blog post the system is aware of (both human-written and AI-generated) with metadata mirroring the Zod schema fields plus pipeline status. `generation_jobs` records each pipeline run with its stage, status, input prompt, and output reference. `settings` is a key/value table for admin-configurable values (pillar weights, generation cadence, quality thresholds). Separate tables rather than a single wide table keeps concerns isolated and makes queries cheaper as rows grow.

*Alternative considered:* A single `blog_content` table with a JSONB-style `metadata` column. Rejected because D1 does not support `jsonb` operators and querying inside a text column is expensive and unindexed.

**D2 — KV for prompt caching and feature flags; R2 for image assets and article backups**

KV's low-latency reads make it the right store for pipeline settings that are read on every generation job (e.g. active pillar weights, API key references) and for caching LLM prompt fragments. R2 handles binary objects (generated illustrations, MDX asset backups) that are too large for KV values and would bloat D1.

*Alternative considered:* Storing all settings in D1 `settings` table. Acceptable for low-frequency reads, but KV provides sub-millisecond reads without a SQL round-trip, which matters for Workers that run on tight CPU time budgets.

**D3 — Two Queues: `blog-pipeline` (generation stages) and `blog-publish` (commit + deploy)**

Separating the generation queue from the publish queue allows independent retry policies. Generation failures (LLM timeout, content quality gate failure) should retry with backoff but not trigger a deploy attempt. Publish failures (GitHub API error, deploy timeout) should retry independently.

*Alternative considered:* Single queue with a `stage` field. Simpler operationally but conflates retry logic and makes dead-letter queue analysis harder.

**D4 — Cron: two triggers (`0 3 * * 1` weekly topic discovery, `0 4 * * *` daily refresh scan)**

Topic discovery runs once per week (Monday 03:00 UTC) to avoid redundant API calls. Refresh scanning runs daily (04:00 UTC) to detect posts older than a configurable threshold that need a content update. Both are off-peak to avoid contention with user traffic.

*Alternative considered:* On-demand triggers via admin UI only. Rejected because manual-only scheduling defeats the automation goal; cron triggers are additive and can be disabled without code changes.

**D5 — `src/lib/` as shared utility directory; plain TypeScript modules with no Astro imports**

All `src/lib/` modules are pure TypeScript with no `astro:*` imports. This ensures they can be imported by both Astro pages (SSR context) and Cloudflare Workers (non-Astro context) without bundler conflicts. The Zod import is sourced from the same `astro/zod` re-export used by `src/content.config.ts` to guarantee schema consistency.

*Alternative considered:* Duplicating the Zod schema in `src/lib/schema-validate.ts` rather than importing from `src/content.config.ts`. Rejected because two copies of the schema will drift. A single import from `src/content.config.ts` ensures the lib and the build-time gate are always in sync.

**D6 — GitHub Actions uses `wrangler deploy` with `CLOUDFLARE_API_TOKEN` secret; no Pages integration**

The project uses `wrangler deploy` (not Cloudflare Pages Git integration) as established by `package.json`. Keeping the same deploy command in CI avoids introducing a second deployment path and keeps the workflow simple. The API token is stored as a GitHub Actions secret.

*Alternative considered:* Cloudflare Pages Git integration (automatic deploy on push). This would work but bypasses `npm run build` customisation and couples the deploy to Cloudflare's build infrastructure rather than the local `wrangler.jsonc` config. Rejected for consistency.

## Risks / Trade-offs

**[R1] `wrangler.jsonc` binding stubs without provisioned resources cause Worker startup errors in production** → Mitigation: Binding stubs with placeholder `database_id`, `namespace_id`, and `bucket_name` values will be flagged by `wrangler deploy` if the resources don't exist. The `scripts/provision.ts` output prints the real IDs to fill in. Operator must run provision before pushing the wrangler changes to production. Add a `# TODO: fill in after provision` comment to each stub.

**[R2] GitHub Actions `wrangler deploy` will fail if `CLOUDFLARE_API_TOKEN` secret is not configured in the repository** → Mitigation: Workflow includes a clear comment block listing required secrets. Initial CI run is expected to fail until the secret is set; this is acceptable and documented in the provision script output.

**[R3] Importing the Zod schema from `src/content.config.ts` in `src/lib/schema-validate.ts` creates a cross-module dependency that could break if the content config is ever refactored** → Mitigation: The content config exports `PILLARS`, `TONES`, and the collection types. Only the exported enums and the `z` schema are imported — not the `defineCollection` call. This is a stable, intentional export surface. Document the dependency in `src/lib/schema-validate.ts`.

**[R4] D1 migrations are irreversible in production without a rollback migration** → Mitigation: `migrations/001_init.sql` uses `CREATE TABLE IF NOT EXISTS` and no destructive DDL. Adding a `migrations/001_rollback.sql` with `DROP TABLE IF EXISTS` for operator use covers the rollback case.

**[R5] Cron trigger syntax in `wrangler.jsonc` requires the Worker `main` entrypoint to handle `scheduled` events, which the current `@astrojs/cloudflare` entrypoint does not** → Mitigation: Cron triggers are declared in `wrangler.jsonc` now but the handler will be wired in Phase 3 (AI Pipeline) when the Worker scripts are created. The stubs will be ignored by the current entrypoint without errors.

## Migration Plan

1. Operator runs `scripts/provision.ts` locally to create D1, KV, R2, and Queue resources; copies real IDs into `wrangler.jsonc`
2. Operator adds `CLOUDFLARE_API_TOKEN` to GitHub repository secrets
3. Commit all changes to main → GitHub Actions workflow fires and deploys
4. Operator runs `npm run db:migrate` to apply `migrations/001_init.sql` to the provisioned D1 database

**Rollback:** Revert `wrangler.jsonc` and `package.json` via `git revert`. D1, KV, R2, and Queue resources remain in Cloudflare but are unreferenced — delete manually via dashboard or CLI. GitHub Actions workflow file can be deleted to stop automated deploys.

## Open Questions

- **OQ1:** What Cloudflare account ID should `scripts/provision.ts` target? Required for `wrangler d1 create` etc. — must be provided by the operator before running provision.
- **OQ2:** Should the D1 `posts` table include a `source` column (`'human' | 'ai'`) from day one, or is that added in the AI Pipeline phase when the distinction matters? Adding it now is cheap; omitting it avoids premature schema decisions. Decision: add it now with `DEFAULT 'human'` so existing manual posts can be back-filled without a migration.
