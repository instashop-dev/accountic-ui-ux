## ADDED Requirements

### Requirement: Pipeline worker entry point is deployable as a standalone module
`src/workers/pipeline/index.ts` SHALL be a valid Cloudflare Workers module entrypoint — it MUST NOT import any Astro or `@astrojs/cloudflare` packages, MUST compile without errors under `wrangler deploy`, and MUST export a default object compatible with the Cloudflare Workers `ExportedHandler` interface.

#### Scenario: Pipeline worker compiles independently
- **WHEN** `wrangler deploy --config wrangler.pipeline.jsonc --dry-run` is executed
- **THEN** the command exits successfully with no TypeScript or bundling errors

#### Scenario: No Astro dependencies in pipeline worker
- **WHEN** the pipeline worker bundle is inspected
- **THEN** no `astro` or `@astrojs/*` packages are included in the output

### Requirement: Missing npm scripts are present
`package.json` SHALL include the following scripts: `blog:provision` (creates all Cloudflare queues and resources via wrangler CLI), `blog:deploy` (deploys the pipeline worker via `wrangler deploy --config wrangler.pipeline.jsonc`), `blog:generate` (manually triggers a topic-discovery message by sending to `blog-pipeline` queue), `blog:refresh` (manually triggers a refresh scan via the cron handler), `db:migrate:phase5` (applies `migrations/005_test-fixtures.sql`), `db:migrate:phase6` (applies `migrations/006_refresh.sql`).

#### Scenario: blog:deploy script deploys pipeline worker
- **WHEN** `npm run blog:deploy` is executed with a valid `CLOUDFLARE_API_TOKEN`
- **THEN** `wrangler deploy --config wrangler.pipeline.jsonc` runs and the pipeline worker is deployed

#### Scenario: db:migrate:phase6 script applies the refresh migration
- **WHEN** `npm run db:migrate:phase6` is executed against a D1 database
- **THEN** `wrangler d1 execute BLOG_DB --remote --file=migrations/006_refresh.sql` runs successfully
