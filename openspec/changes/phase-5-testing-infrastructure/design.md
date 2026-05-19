## Context

Five pipeline stages (topic-discovery → outline-generation → article-generation → humanizer → publisher) and eleven shared library modules have shipped with zero automated test coverage. The critical safety layer — three-gate semantic regression detection in `src/lib/regression.ts`, protected-region extraction in `src/lib/humanizer-regions.ts`, compliance entity checks, and SEO schema generation — has never been verified in isolation. A bug in any gate silently passes bad content to CAs or blocks legitimate humanizations.

The project is Astro 6 on Cloudflare Workers. Test files must be able to import Workers-compatible TypeScript (D1Database, Queue, AnalyticsEngineDataset types) without a full Cloudflare runtime, which requires a dedicated test environment adapter.

**Constraints:** No new runtime dependencies. No changes to production source files. Test files co-located with source. The existing CI workflow (`deploy.yml`) must gate deploys on tests passing.

## Goals / Non-Goals

**Goals:**

- Unit test every exported function in `src/lib/` with deterministic, side-effect-free inputs
- Integration test all five pipeline workers using D1 in-process mocks and stub Queue/Analytics Engine objects
- Enforce a coverage threshold (≥80% branch coverage on `src/lib/`) via `vitest --coverage`
- Gate CI deploys: `deploy` job must not run if `test` job fails
- Provide `npm test` as the canonical test command for local runs

**Non-Goals:**

- End-to-end tests against live Cloudflare infrastructure (requires provisioned D1/Queues; deferred)
- Load or performance testing
- Testing Astro routes or admin UI components (separate phase)
- Browser-based tests (no DOM needed for Worker code)
- 100% line coverage (diminishing returns on pipeline branching for error paths that require Cloudflare runtime APIs)

## Decisions

### D1 — Vitest with `@cloudflare/vitest-pool-workers` as the test runner

**Decision:** Use Vitest with the official `@cloudflare/vitest-pool-workers` pool to run tests in a Workers-compatible environment. All Worker typings (`D1Database`, `Queue`, `AnalyticsEngineDataset`) are available without mocking the global namespace.

**Rationale:** The alternative — Jest with `ts-jest` and manual mock globals — requires hand-rolling every Cloudflare API type and silently diverges from the actual Worker runtime. `vitest-pool-workers` executes tests in a Miniflare-backed sandbox, so D1 `prepare().bind().all()` calls work with real SQLite in-process. This eliminates an entire class of "tests pass, prod breaks" risk.

**Alternative considered:** Jest + jsdom. Rejected: jsdom is a browser environment, not a Worker environment. Cloudflare-specific globals don't exist in jsdom without per-test shims.

---

### D2 — Unit tests for `src/lib/` are pure (no D1 dependency where possible)

**Decision:** Library modules that don't touch D1 (`regression.ts`, `humanizer-regions.ts`, `seo-schema.ts`, `quality.ts`, `slug.ts`, `frontmatter.ts`) are tested as pure functions: string/object in, string/object out. Only `linker.ts` and `analytics.ts` require a D1/AnalyticsEngine stub.

**Rationale:** Pure function tests are fast (< 1ms each), deterministic, and require no setup/teardown. Isolating D1-dependent tests to a single module (`linker.ts`) keeps the suite fast and makes failures easy to attribute. The `@cloudflare/vitest-pool-workers` sandbox is used for Worker integration tests and D1-dependent lib tests only.

---

### D3 — Pipeline worker integration tests use Miniflare D1 in-process (not a real remote D1)

**Decision:** Worker integration tests (`src/workers/pipeline/*.test.ts`) use the Miniflare-backed in-process D1 provided by `vitest-pool-workers`. A test fixture migration (`migrations/005_test-fixtures.sql`) seeds a known state before each test suite.

**Rationale:** Remote D1 requires a provisioned database and network access, making tests non-reproducible in CI. Miniflare's D1 is SQLite-backed, runs in-process, and supports the full D1 API surface used by the Workers (prepare/bind/all/run/first). The fixture migration is a separate file (`005_test-fixtures.sql`) that is never referenced in `package.json` db:migrate scripts, so it cannot be accidentally applied to production.

**Alternative considered:** Mocking `env.BLOG_DB` with a hand-rolled object. Rejected: a mock that returns pre-canned results doesn't catch SQL query errors (wrong column names, missing bindings) which is precisely the class of bug most likely to regress.

---

### D4 — Queue and Analytics Engine are stubbed as simple in-memory objects

**Decision:** `env.BLOG_PIPELINE_QUEUE`, `env.BLOG_HUMANIZE_QUEUE`, `env.BLOG_PUBLISH_QUEUE`, and `env.BLOG_ANALYTICS` are stubbed with minimal TypeScript objects that record calls (e.g., `send` pushes to an array; `writeDataPoint` pushes to an array). Tests assert on what was dispatched, not on execution of downstream workers.

**Rationale:** Queues are async delivery mechanisms. Testing that `article-generation` calls `queue.send({ draft_id })` with the correct payload is the meaningful assertion — what `humanizer` does with that message is tested in `humanizer.test.ts`. Separating these avoids testing multiple units in a single test.

---

### D5 — Coverage threshold: ≥80% branch on `src/lib/`, no threshold on Workers

**Decision:** `vitest --coverage` enforces ≥80% branch coverage on `src/lib/` only. No coverage threshold is applied to `src/workers/pipeline/` worker files.

**Rationale:** Library modules contain the deterministic gate logic that must be correct. Worker files contain Cloudflare-specific control flow (queue message handlers, cron invocations) where 100% branch coverage would require simulating Worker lifecycle events that are better covered by integration tests. The 80% branch threshold catches unexercised gate paths (e.g., the `entitiesMissing` fast-paths in `regression.ts`) without requiring exhaustive coverage of error paths that depend on D1 failures.

---

### D6 — CI: `test` job added before `deploy` in `deploy.yml`

**Decision:** The existing GitHub Actions workflow gains a `test` job (`runs-on: ubuntu-latest`, steps: `npm ci`, `npm test`) and the `deploy` job gains `needs: [test]`. No other changes to the workflow.

**Rationale:** This is the minimal change to gate deployments on test results. The existing workflow already handles secrets and Wrangler auth — the `test` job needs no additional secrets and runs in a clean `ubuntu-latest` environment with only Node.js and npm.

## Risks / Trade-offs

**[Risk] `@cloudflare/vitest-pool-workers` adds a devDependency that ties test infrastructure to Cloudflare's release cadence** → Mitigation: Pin the version in `package.json` and update only when `wrangler` itself is updated (they share the same Miniflare version). The existing `wrangler` version in `devDependencies` is the canary for compatibility.

**[Risk] Miniflare D1 behaviour diverges from remote D1 on edge cases (e.g., WAL mode, concurrent writes)** → Mitigation: Worker tests assert only on query correctness (correct SQL, correct params), not on D1 concurrency behaviour. Any production D1 divergence manifests as a runtime error, not a silent wrong answer.

**[Risk] `005_test-fixtures.sql` is applied to production by operator error** → Mitigation: The file is named with a `test-fixtures` suffix (not `005_init.sql`), is excluded from all `package.json` db:migrate scripts, and includes a leading comment `-- TEST FIXTURES ONLY — DO NOT RUN IN PRODUCTION`. The ops runbook is updated to note this.

**[Risk] Slow CI caused by Miniflare sandbox startup overhead** → Mitigation: `vitest-pool-workers` reuses a single Miniflare instance per run (not per test). Expected total CI test time is < 60s for the current suite size.

**[Risk] Test coverage threshold blocks PRs with legitimate new untested code** → Mitigation: The 80% threshold applies to `src/lib/` only. New library code must ship with tests. Worker files have no threshold. Threshold can be adjusted in `vitest.config.ts` without a design change.

**[Risk] AI-generated MDX breaks Astro production builds** → Mitigation: Every generated article must pass isolated Astro content validation and a full production build check before publish. Publisher integration tests assert that generated MDX passes `validatePostFrontmatter`. A post-publish Astro build step is recommended in the ops runbook as a deploy sanity check.

**[Risk] Duplicate queue deliveries generate duplicate publishes or duplicate content rows** → Mitigation: Integration tests explicitly cover replay safety across all five workers: processing the same `input_hash` twice must produce no duplicate D1 rows and no duplicate GitHub API calls. Publisher idempotency (same `draft_id` processed twice after first successful publish) must be a no-op.

**[Risk] AI provider or model output drift causes flaky tests** → Mitigation: Worker integration tests stub the Anthropic API — no live LLM calls in CI. Any test capturing generated prose uses snapshot tests that normalise timestamps, UUIDs, and volatile IDs before comparison, and validates semantic structure (required fields, correct types, known section headings) rather than exact prose.

**[Risk] Secrets accidentally logged during test or worker failures** → Mitigation: A structured logger wrapper must redact `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `ADMIN_TOKEN`, and any `env.*` value matching a known secret key pattern before writing to output. Integration tests assert that simulated failure log output does not contain the stub API key value.

**[Risk] Humanizer alters compliance meaning despite style-only intent** → Mitigation: A dedicated semantic preservation test group is required. Tests must cover: (a) numerical values — no digit changes; (b) compliance terminology — all COMPLIANCE_KEYWORDS preserved verbatim; (c) regulatory references — all `Section N` and `u/s N` patterns present in original appear in humanized output; (d) statutory language — named acts (Income Tax Act, GST Act, CGST Act) not paraphrased or removed. Tests run against `detectRegression` with known-good and known-bad humanizer outputs. Golden article fixtures covering GST/compliance-heavy content are strongly recommended as the primary regression corpus for this gate.

**[Risk] Queue retries exceed configured token budget** → Mitigation: Integration tests must assert hard-stop behaviour: when `tokens_used_today` in D1 meets or exceeds `daily_token_cap`, every worker that calls `checkTokenBudget` must exit without a Claude API call, must not dispatch to the next queue stage, and must log the correct `budget_exceeded` event. This covers article-generation, outline-generation, topic-discovery, and humanizer workers.

## Migration Plan

1. Install devDependencies (`vitest`, `@cloudflare/vitest-pool-workers`, `@vitest/coverage-v8`) — no production impact.
2. Create `vitest.config.ts` at project root.
3. Add `005_test-fixtures.sql` fixture migration.
4. Write lib unit tests (`src/lib/*.test.ts`) — eight files.
5. Write worker integration tests (`src/workers/pipeline/*.test.ts`) — five files.
6. Add `test`, `test:watch`, `test:coverage` scripts to `package.json`.
7. Extend `.github/workflows/deploy.yml` with `test` job and `needs: [test]` on `deploy`.
8. Run `npm test` locally — confirm all tests pass and coverage threshold is met.
9. Push to `main`; confirm CI `test` job is green before `deploy` proceeds.

**Rollback:** Revert the commit. CI reverts to the previous workflow without a `test` job. No production state is changed; no D1 migrations are involved in rollback.

## Open Questions

1. **Coverage threshold:** Is 80% branch coverage on `src/lib/` the right starting threshold, or should it be higher given the compliance-critical nature of `regression.ts` and `humanizer-regions.ts`? (Recommendation: start at 80%, raise to 90% after the first CI cycle confirms no false positives.)
2. **`analytics.ts` test scope:** `logEvent` in `analytics.ts` wraps `env.BLOG_ANALYTICS.writeDataPoint` in a try/catch no-op. Should the test verify that `writeDataPoint` is called with the correct payload (meaningful assertion), or only that it doesn't throw (trivial assertion)? (Recommendation: assert on `writeDataPoint` call payload.)
3. **Fixture isolation:** Should the test fixture migration run once per test file (module scope) or once per test (function scope)? (Recommendation: module scope — recreating the SQLite database per-test would be too slow for D1-heavy worker tests.)
