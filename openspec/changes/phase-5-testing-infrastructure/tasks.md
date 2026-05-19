## 1. Dev Dependencies and Vitest Configuration

- [x] 1.1 Add `"vitest": "^2.0.0"`, `"@cloudflare/vitest-pool-workers": "^0.5.0"`, and `"@vitest/coverage-v8": "^2.0.0"` to `devDependencies` in `package.json`
- [x] 1.2 Add `"test": "vitest run"`, `"test:watch": "vitest"`, and `"test:coverage": "vitest run --coverage"` scripts to `package.json`
- [x] 1.3 Run `npm install` to lock the new devDependencies in `package-lock.json`
- [x] 1.4 Create `vitest.config.ts` at project root: configure `pool: '@cloudflare/vitest-pool-workers'`, `include: ['src/**/*.test.ts']`, and `coverage` with `provider: 'v8'`, `include: ['src/lib/**']`, `branches: 80`
- [x] 1.5 Run `npm test` with no test files present and confirm Vitest starts without configuration errors (zero tests, exit 0)

## 2. Test Fixture Migration

- [x] 2.1 Create `migrations/005_test-fixtures.sql` with leading comment `-- TEST FIXTURES ONLY — DO NOT RUN IN PRODUCTION`
- [x] 2.2 Add `INSERT OR IGNORE INTO settings` rows for `generation_enabled = 'true'`, `humanizer_enabled = 'true'`, `humanizer_temperature = '0.3'`, `humanizer_similarity_threshold = '0.70'`, `daily_token_cap = '200000'`, `tokens_used_today = '0'`, `quality_threshold = '0.8'`
- [x] 2.3 Add `INSERT OR IGNORE INTO prompts` rows: one `stage = 'article'` prompt and one `stage = 'humanizer'` prompt with minimal but valid content
- [x] 2.4 Add `INSERT OR IGNORE INTO posts` rows: at least 3 posts with distinct `slug`, `title`, `pillar`, `pub_date` values for internal linker tests
- [x] 2.5 Add `INSERT OR IGNORE INTO topics` row with `status = 'pending'` for topic discovery tests
- [x] 2.6 Add `INSERT OR IGNORE INTO outlines` row linked to a topic for article generation tests
- [x] 2.7 Add `INSERT OR IGNORE INTO drafts` rows: one at `status = 'ready'`, one at `status = 'approved'`, one at `status = 'humanized'`
- [x] 2.8 Verify `package.json` `db:migrate` scripts do NOT reference `005_test-fixtures.sql`

## 3. Unit Tests — regression.ts

- [x] 3.1 Create `src/lib/regression.test.ts` importing from `./regression`
- [x] 3.2 Test `computeBigramJaccard`: identical strings → `1`, completely different → `0`, both empty → `1`, one empty → `0`
- [x] 3.3 Test `extractHeadings`: mixed `##`/`###`/`####` content; verify only `##` and `###` are returned, trimmed, in order
- [x] 3.4 Test `extractComplianceEntities`: string containing `GST`, `Section 80C`, `₹1,00,000` → all three appear in result set; numeric normalisation strips commas and `₹`
- [x] 3.5 Test `checkNewNumerics`: humanized adds `₹5,00,000` not in original → `true`; no new numerics → `false`
- [x] 3.6 Test `detectRegression` similarity gate: humanized shares <70% Jaccard → `{ passed: false, failed_gate: 'similarity' }`
- [x] 3.7 Test `detectRegression` heading gate: similarity passes but `## Key Steps` missing from humanized → `{ passed: false, failed_gate: 'heading' }`
- [x] 3.8 Test `detectRegression` compliance entity gate: similarity and headings pass but `TDS` removed → `{ passed: false, failed_gate: 'compliance_entity' }`
- [x] 3.9 Test `detectRegression` clean pass: all gates pass → `{ passed: true, failed_gate: null }`
- [x] 3.10 Run `npm test` and confirm all regression tests pass

## 4. Unit Tests — humanizer-regions.ts

- [x] 4.1 Create `src/lib/humanizer-regions.test.ts` importing from `./humanizer-regions`
- [x] 4.2 Test `extractLockedRegions` with no lock tags: `stripped` equals input, `regions` is `[]`
- [x] 4.3 Test `extractLockedRegions` with one lock region: `stripped` contains `__LOCKED_REGION_0__` at correct position; `regions[0]` contains full tag pair and content
- [x] 4.4 Test `extractLockedRegions` with two lock regions: `regions.length === 2`, placeholders are sequential
- [x] 4.5 Test `extractLockedRegions` with unclosed `LOCK_START` (no `LOCK_END`): remainder left untouched, no region extracted
- [x] 4.6 Test `restoreLockedRegions` happy path: placeholder substituted back to original locked content
- [x] 4.7 Test `restoreLockedRegions` returns `null` when placeholder `__LOCKED_REGION_0__` is absent from content
- [x] 4.8 Test round-trip: `restoreLockedRegions(extractLockedRegions(input).stripped, regions)` equals original input
- [x] 4.9 Run `npm test` and confirm all humanizer-regions tests pass

## 5. Unit Tests — seo-schema.ts

- [x] 5.1 Create `src/lib/seo-schema.test.ts` importing from `./seo-schema`
- [x] 5.2 Test `generateArticleSchema` with complete frontmatter: parsed JSON has `@type: 'Article'`, `headline`, `datePublished`, `author.name`, `url` containing slug
- [x] 5.3 Test `generateArticleSchema` with missing `title` and `slug`: defaults applied gracefully, JSON remains valid
- [x] 5.4 Test `generateFAQSchema` with no FAQ heading: returns `null`
- [x] 5.5 Test `generateFAQSchema` with `## FAQ` heading and 3 Q&A pairs (`### question` + paragraph): returns valid JSON with 3 `mainEntity` entries
- [x] 5.6 Test `generateFAQSchema` with 12 Q&A pairs: `mainEntity` capped at 10
- [x] 5.7 Test `generateFAQSchema` ignores `## Unrelated Heading` — only triggers on exact `## FAQ` or `## Frequently Asked Questions`
- [x] 5.8 Test `generateBreadcrumbSchema`: parsed JSON `itemListElement` has exactly 3 entries, positions 1/2/3, pillar is capitalised in position 2
- [x] 5.9 Test `buildSchemaScriptBlock`: returned string contains `<script type="application/ld+json">` and is non-empty
- [x] 5.10 Run `npm test` and confirm all seo-schema tests pass

## 6. Unit Tests — linker.ts, quality.ts, frontmatter.ts, slug.ts, analytics.ts

- [x] 6.1 Create `src/lib/linker.test.ts`: test `injectInternalLinks` with empty links (no-op), anchor in code fence (skipped), already-linked anchor (not double-linked), first unlinked occurrence wrapped as `[anchor](/blog/<slug>/)`
- [x] 6.2 Create `src/lib/quality.test.ts`: test `scoreArticle` with readable content containing a numbered workflow → `passed: true`; test with dense unreadable content → `passed: false` with readability error
- [x] 6.3 Create `src/lib/frontmatter.test.ts`: test `parseFrontmatter` with valid YAML block → returns object with expected fields; test with malformed YAML → throws
- [x] 6.4 Create `src/lib/slug.test.ts`: test `toSlug` with mixed-case title with spaces → lowercase kebab; test with special characters → stripped or replaced
- [x] 6.5 Create `src/lib/analytics.test.ts`: test `logEvent` with a stub `BLOG_ANALYTICS` object; verify `writeDataPoint` is called with the correct `blobs` and `doubles` arrays; test `logEvent` with no binding present → no-throw
- [x] 6.6 Run `npm test` and confirm all lib unit tests pass
- [x] 6.7 Run `npm run test:coverage` and confirm branch coverage on `src/lib/` is ≥80%

## 7. Pipeline Worker Integration Tests — Humanizer

- [x] 7.1 Create `src/workers/pipeline/humanizer.test.ts` with Miniflare D1 loaded from `migrations/` in sequence (001 through 004) plus `005_test-fixtures.sql`
- [x] 7.2 Create stub Queue object (records `send` calls in array) and stub `BLOG_ANALYTICS` object (records `writeDataPoint` calls)
- [x] 7.3 Test humanizer disabled bypass: set `humanizer_enabled = 'false'` in D1, process a 'ready' draft → `status = 'humanized'`, no Claude call, publish queue `send` called once with `{ draft_id }`
- [x] 7.4 Test status guard: process a draft with `status = 'approved'` → status unchanged, no queue dispatch
- [x] 7.5 Test idempotency: process a draft already at `status = 'humanized'` → no D1 update, no queue dispatch
- [x] 7.6 Test missing prompt: delete humanizer prompt from D1, process 'ready' draft → `status = 'failed'`, no queue dispatch
- [x] 7.7 Run `npm test` and confirm humanizer integration tests pass

## 8. Pipeline Worker Integration Tests — Article Generation

- [x] 8.1 Create `src/workers/pipeline/article-generation.test.ts` with same D1 setup as task 7.1
- [x] 8.2 Stub Anthropic API call: intercept `createAIClient` or inject a stub that returns valid article Markdown with originality markers
- [x] 8.3 Test successful generation: process a valid outline message → draft inserted at `status = 'ready'`, `BLOG_HUMANIZE_QUEUE.send` called with `{ draft_id }`, `BLOG_PUBLISH_QUEUE` NOT called
- [x] 8.4 Test quality gate failure: stub returns content that scores below threshold → draft `status = 'failed'`, no queue dispatch
- [x] 8.5 Test idempotency: process the same outline `input_hash` twice → second call is a no-op (no duplicate draft)
- [x] 8.6 Run `npm test` and confirm article generation integration tests pass

## 9. Pipeline Worker Integration Tests — Publisher

- [x] 9.1 Create `src/workers/pipeline/publisher.test.ts` with D1 setup and a GitHub API stub (records `PUT` call payload)
- [x] 9.2 Test non-approved draft skip: process a message for a `status = 'humanized'` draft → no GitHub API call
- [x] 9.3 Test internal links injected: process an approved draft with 2 matching posts in D1 → MDX content in GitHub stub call contains `[...](/blog/.../)` links
- [x] 9.4 Test SEO schema block appended: GitHub stub call body contains `<script type="application/ld+json">`
- [x] 9.5 Run `npm test` and confirm publisher integration tests pass

## 10. Pipeline Worker Smoke Tests — Topic Discovery and Outline Generation

- [x] 10.1 Create `src/workers/pipeline/topic-discovery.test.ts`: smoke test that handler completes without error on seeded D1 (asserts no throw; does not assert Claude call since API is stubbed to return empty)
- [x] 10.2 Test topic discovery idempotency: same `input_hash` processed twice → no duplicate `topics` row
- [x] 10.3 Create `src/workers/pipeline/outline-generation.test.ts`: smoke test that handler completes without error on a seeded 'pending' topic
- [x] 10.4 Test outline generation idempotency: same outline `input_hash` processed twice → no duplicate `outlines` row
- [x] 10.5 Run `npm test` and confirm all worker tests pass as a full suite

## 11. CI/CD Integration

- [x] 11.1 In `.github/workflows/deploy.yml`, add a `test` job: `runs-on: ubuntu-latest`, steps: `actions/checkout@v4`, `actions/setup-node@v4` (node 22), `npm ci`, `npm test`
- [x] 11.2 Add `needs: [test]` to the existing `deploy` job in `.github/workflows/deploy.yml`
- [x] 11.3 Verify no additional secrets are required by the `test` job (it must run with zero `secrets.*` references)
- [ ] 11.4 Push to a feature branch and confirm GitHub Actions runs `test` before `deploy`, and that `deploy` is skipped if `test` fails

## 12. Final Verification

- [x] 12.1 Run `npm test` — confirm all tests pass (zero failures)
- [x] 12.2 Run `npm run test:coverage` — confirm branch coverage on `src/lib/` is ≥80% with report output
- [x] 12.3 Run `npx astro build` — confirm build still passes with no test files bundled
- [x] 12.4 Run `npx wrangler deploy --dry-run` — confirm Worker manifests unchanged (no test files included)
- [x] 12.5 Verify `migrations/005_test-fixtures.sql` has the `-- TEST FIXTURES ONLY` leading comment and is absent from all `package.json` db:migrate script values
- [x] 12.6 Update `docs/ops-runbook.md`: add note that `migrations/005_test-fixtures.sql` is test-only and must never be run against production D1

## 13. Golden Article Fixtures — GST/Compliance Corpus

- [ ] 13.1 Create `src/test-fixtures/articles/gst-itc-claim.md` — a realistic GST article containing: GSTIN references, Section 16/17 ITC provisions, `₹` rupee figures, CGST/SGST/IGST split amounts, a Markdown table with at least 3 rows, an FAQ section with 3 Q&A pairs, and `## FAQ` heading
- [ ] 13.2 Create `src/test-fixtures/articles/tds-194c-contractor.md` — a TDS article containing: Section 194C references, PAN format (`ABCDE1234F`), TAN references, deductee/deductor terminology, numerical threshold values (`₹30,000` single, `₹1,00,000` aggregate), and a numbered 3-step workflow
- [ ] 13.3 Create `src/test-fixtures/articles/itr-filing-ay.md` — an ITR article containing: Assessment Year pattern (`AY 2024-25`), Section 139 / Section 234 references, penalty figures, `u/s 143(1)` notice code pattern, and a practitioner case study
- [ ] 13.4 Add a `src/test-fixtures/articles/index.ts` barrel that exports all three fixture strings as named constants (`GST_ITC_ARTICLE`, `TDS_194C_ARTICLE`, `ITR_FILING_ARTICLE`)
- [ ] 13.5 Use the golden fixtures as inputs in `regression.test.ts` semantic preservation tests: for each fixture, run `detectRegression(fixture, fixture, 0.70)` → must pass all gates (self-comparison baseline)
- [ ] 13.6 Use the golden fixtures as inputs in `humanizer-regions.test.ts`: verify round-trip losslessness on compliance-heavy content containing lock tags
- [ ] 13.7 Use `GST_ITC_ARTICLE` in `seo-schema.test.ts` to assert `generateFAQSchema` extracts the FAQ section correctly and `buildSchemaScriptBlock` produces a valid JSON-LD block for a real article shape

## 14. Semantic Preservation Tests — Humanizer Compliance Gates

- [ ] 14.1 In `src/lib/regression.test.ts`, add a dedicated `describe('semantic preservation')` block using the golden article fixtures from task 13
- [ ] 14.2 Test: `detectRegression(GST_ITC_ARTICLE, minimalRestyled, 0.70)` passes all gates — where `minimalRestyled` is the fixture with cosmetic prose changes only (no entity/numeric/heading changes)
- [ ] 14.3 Test: numerical value preservation — construct a humanized variant with one `₹` amount changed (e.g., `₹30,000` → `₹35,000`); assert `detectRegression` returns `failed_gate: 'compliance_entity'`
- [ ] 14.4 Test: compliance terminology preservation — remove `CGST` from a humanized variant of `GST_ITC_ARTICLE`; assert `failed_gate: 'compliance_entity'`
- [ ] 14.5 Test: regulatory reference preservation — remove `Section 194C` from a humanized variant of `TDS_194C_ARTICLE`; assert `failed_gate: 'compliance_entity'`
- [ ] 14.6 Test: statutory language — replace `Income Tax Act` with a paraphrase in `ITR_FILING_ARTICLE` humanized variant; assert `checkNewNumerics` returns `false` (not a numeric issue) and that `entitiesMissing` would catch it (covered by compliance entity gate)
- [ ] 14.7 Run `npm test` and confirm all semantic preservation tests pass

## 15. Replay Safety and Idempotency Tests

- [ ] 15.1 In `src/workers/pipeline/topic-discovery.test.ts`, add test: process same cron invocation twice (same D1 state, same week) → no duplicate `topics` rows by `input_hash`
- [ ] 15.2 In `src/workers/pipeline/outline-generation.test.ts`, add test: process same topic message twice → no duplicate `outlines` rows by `input_hash`
- [ ] 15.3 In `src/workers/pipeline/article-generation.test.ts`, add test: process same outline message twice → no duplicate `drafts` rows; `BLOG_HUMANIZE_QUEUE.send` called exactly once total
- [ ] 15.4 In `src/workers/pipeline/humanizer.test.ts`, add test: process same draft message twice (first call succeeds, sets `status = 'humanized'`) → second call is a no-op; `BLOG_PUBLISH_QUEUE.send` called exactly once total
- [ ] 15.5 In `src/workers/pipeline/publisher.test.ts`, add test: process same approved draft message twice → GitHub API stub called exactly once; `status` not altered on second call
- [ ] 15.6 Run `npm test` and confirm all replay-safety tests pass

## 16. Token Budget Enforcement Tests

- [ ] 16.1 In `src/workers/pipeline/article-generation.test.ts`, add test: set `tokens_used_today = daily_token_cap` in D1 fixtures → handler exits without calling Anthropic stub, no `drafts` row inserted, no queue dispatch
- [ ] 16.2 In `src/workers/pipeline/outline-generation.test.ts`, add test: token budget exhausted → no outline inserted, no queue dispatch
- [ ] 16.3 In `src/workers/pipeline/topic-discovery.test.ts`, add test: token budget exhausted → no topics inserted
- [ ] 16.4 In `src/workers/pipeline/humanizer.test.ts`, add test: token budget exhausted → draft advanced to `'humanized'` via fallback (original content kept), `BLOG_PUBLISH_QUEUE.send` called, `logEvent` stub records `budget_exceeded` reason
- [ ] 16.5 Run `npm test` and confirm all token budget enforcement tests pass

## 17. Secret Redaction and MDX Build Validation Tests

- [ ] 17.1 Audit all worker files for `console.error`/`console.log` calls that include `error` or `e` (caught exception) arguments — confirm none interpolate `env.ANTHROPIC_API_KEY`, `env.GITHUB_TOKEN`, or `env.ADMIN_TOKEN` directly
- [ ] 17.2 In worker integration tests, assert that the `console.error` stub output for a simulated Claude API failure does not contain the string value of the stub API key (`'test-anthropic-key'` or equivalent)
- [ ] 17.3 In `src/workers/pipeline/publisher.test.ts`, add test: the MDX string constructed before the GitHub API call is parsed by `validatePostFrontmatter` — assert it returns `{ success: true }` for a well-formed approved draft
- [ ] 17.4 Add a `npm run test:build` script to `package.json`: runs `npm test && npx astro build` in sequence — use this locally before shipping to confirm generated test fixtures don't break the Astro content layer
- [ ] 17.5 Update `docs/ops-runbook.md`: note that `npm run test:build` should be run before any release that modifies article generation prompts or MDX output format
