## Why

Phases 3 and 4 delivered a five-stage AI pipeline (topic → outline → article → humanizer → publisher) with multiple safety gates (quality scoring, semantic regression detection, compliance entity checks) and no automated test coverage. Any change to `src/lib/` or `src/workers/pipeline/` carries invisible regression risk — the gates are the critical safety layer for a CA-regulated audience, and they have never been verified in isolation.

## What Changes

- `vitest.config.ts` — new file: Vitest configuration with Cloudflare Workers environment (`@cloudflare/vitest-pool-workers`) for Worker-compatible test execution
- `src/lib/*.test.ts` — new unit test files for every shared library module: `regression.ts`, `humanizer-regions.ts`, `linker.ts`, `seo-schema.ts`, `quality.ts`, `frontmatter.ts`, `slug.ts`, `analytics.ts`
- `src/workers/pipeline/*.test.ts` — new integration test files for the five pipeline workers, using D1 in-process mocks
- `migrations/005_test-fixtures.sql` — new test fixture migration (never run in production): seeds `posts`, `drafts`, `prompts`, and `settings` rows for deterministic test execution
- `package.json` — new scripts: `test`, `test:watch`, `test:coverage`
- `.github/workflows/deploy.yml` — extend existing CI workflow with a `test` job that runs before `deploy`

No production source files are modified. All test files are co-located with source. No new runtime dependencies.

## Capabilities

### New Capabilities

- `unit-test-suite`: Vitest-based unit tests for all `src/lib/` modules — covers gate logic, schema generation, content extraction, and regression detection
- `pipeline-integration-tests`: Integration tests for all five pipeline workers using D1 in-process mocks and stub Queue/Analytics Engine objects
- `ci-test-gate`: CI/CD test job that blocks deployment if any test fails

### Modified Capabilities

- `cicd-pipeline`: Existing GitHub Actions deploy workflow gains a `test` job (runs `npm test`) that the `deploy` job depends on — no changes to deploy logic itself

## Impact

- **`package.json`**: Three new scripts (`test`, `test:watch`, `test:coverage`); new devDependency `vitest` and `@cloudflare/vitest-pool-workers`
- **`vitest.config.ts`**: New file at project root; configures Workers-compatible test environment, coverage thresholds, and test file glob patterns
- **`.github/workflows/deploy.yml`**: Additive `test` job added; `deploy` job gains `needs: [test]`
- **`src/lib/`**: Eight new `*.test.ts` files, co-located with source — no changes to source files
- **`src/workers/pipeline/`**: Five new `*.test.ts` files, co-located with source — no changes to source files
- **`migrations/005_test-fixtures.sql`**: New file; never executed by `npm run db:migrate` (test-only, excluded by naming convention)
- **Production runtime**: Zero impact — test files are not bundled by Wrangler and are excluded from Astro build
