## Why

The AI blogging subsystem requires a foundational infrastructure layer before any pipeline workers or admin UI can be built: Cloudflare bindings (D1, KV, R2, Queues, Cron), a CI/CD workflow, a D1 schema, provisioning scripts, and shared TypeScript utilities that the pipeline and admin phases will import. Without this layer, subsequent phases have nowhere to store state, no way to deploy automatically, and no validated content contract enforcement.

## What Changes

- `wrangler.jsonc` — additive: new `d1_databases`, `kv_namespaces`, `r2_buckets`, `queues`, and `triggers.crons` stubs (no existing keys removed or renamed)
- `package.json` — additive: new scripts (`db:migrate`, `db:seed`, `blog:validate`, `blog:generate-types`)
- `.github/workflows/deploy.yml` — new file: GitHub Actions CI/CD (build → wrangler deploy on push to main)
- `migrations/001_init.sql` — new file: D1 schema defining `posts`, `generation_jobs`, and `settings` tables
- `scripts/provision.ts` — new file: one-time setup script for Cloudflare resources (not deployed)
- `scripts/validate-post.ts` — new file: pre-publish CLI tool that validates a post's frontmatter against the Zod schema
- `src/lib/frontmatter.ts` — new file: parse, validate, and serialize blog post frontmatter
- `src/lib/slug.ts` — new file: deterministic slug generation from post title
- `src/lib/schema-validate.ts` — new file: runtime Zod validation wrapper used by pipeline workers

No existing source files are deleted or structurally changed. `astro build` must continue to pass after every task.

## Capabilities

### New Capabilities

- `cf-bindings-config`: Cloudflare infrastructure binding declarations in `wrangler.jsonc` (D1, KV, R2, Queues, Cron stubs)
- `cicd-pipeline`: GitHub Actions workflow that builds and deploys the site on push to main
- `d1-schema`: D1 database schema (`posts`, `generation_jobs`, `settings`) with initial migration
- `post-validation`: CLI and library tooling that validates blog post frontmatter against the Zod schema before a post is committed
- `blog-lib`: Shared TypeScript utility library (`src/lib/`) providing frontmatter parsing, slug generation, and schema validation

### Modified Capabilities

<!-- None — no existing spec requirements are changing -->

## Impact

- **`wrangler.jsonc`**: Two new top-level keys added; existing `send_email`, `assets`, and `observability` keys are untouched
- **`package.json`**: Four new script entries; all existing scripts unchanged
- **New directories**: `migrations/`, `scripts/`, `src/lib/`, `.github/workflows/`
- **Astro build**: Unaffected — `src/lib/` modules are plain TypeScript, not Astro pages or content; `migrations/` and `scripts/` are outside the Astro source root
- **Cloudflare deployment**: `wrangler.jsonc` binding stubs will require manual `wrangler d1 create`, `wrangler kv:namespace create`, `wrangler r2 bucket create`, and `wrangler queues create` commands before the bindings are live; `scripts/provision.ts` automates this
- **No runtime behaviour change**: All new files are either config, documentation, scripts, or library code with no active callers in the current production path
