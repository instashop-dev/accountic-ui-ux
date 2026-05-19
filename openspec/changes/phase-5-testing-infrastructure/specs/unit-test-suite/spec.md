## ADDED Requirements

### Requirement: Vitest configuration at project root
A `vitest.config.ts` file SHALL exist at the project root, configuring `@cloudflare/vitest-pool-workers` as the test pool, setting `include` to `src/**/*.test.ts`, and enabling `@vitest/coverage-v8` with a branch coverage threshold of ≥80% applied to `src/lib/**`.

#### Scenario: Vitest config uses Workers pool
- **WHEN** `npm test` is run
- **THEN** Vitest loads `vitest.config.ts` and executes tests in a Miniflare-backed Workers-compatible environment

#### Scenario: Coverage threshold enforced on src/lib
- **WHEN** `npm run test:coverage` is run
- **THEN** Vitest fails if branch coverage on any file under `src/lib/` falls below 80%

### Requirement: regression.ts unit tests
`src/lib/regression.test.ts` SHALL test every exported function (`computeBigramJaccard`, `extractHeadings`, `extractComplianceEntities`, `checkNewNumerics`, `detectRegression`) with at least one positive and one negative scenario per gate.

#### Scenario: Identical strings score 1.0
- **WHEN** `computeBigramJaccard` is called with two identical non-empty strings
- **THEN** it returns `1`

#### Scenario: Completely different strings score 0
- **WHEN** `computeBigramJaccard` is called with two strings sharing no bigrams
- **THEN** it returns `0`

#### Scenario: Similarity gate triggers below threshold
- **WHEN** `detectRegression` is called with a humanized string whose Jaccard similarity to the original is below `threshold`
- **THEN** it returns `{ passed: false, failed_gate: 'similarity' }`

#### Scenario: Heading gate triggers on missing heading
- **WHEN** `detectRegression` is called with a humanized string that is missing a `##` heading present in the original, but similarity is above threshold
- **THEN** it returns `{ passed: false, failed_gate: 'heading' }`

#### Scenario: Compliance entity gate triggers on missing GST keyword
- **WHEN** `detectRegression` is called with a humanized string that omits `GST` (present in original), similarity and headings are intact
- **THEN** it returns `{ passed: false, failed_gate: 'compliance_entity' }`

#### Scenario: checkNewNumerics detects fabricated figure
- **WHEN** `checkNewNumerics` is called with a humanized string containing `₹5,00,000` not present in the original
- **THEN** it returns `true`

#### Scenario: detectRegression passes clean humanization
- **WHEN** `detectRegression` is called with a humanized string that passes all three gates
- **THEN** it returns `{ passed: true, failed_gate: null }`

### Requirement: humanizer-regions.ts unit tests
`src/lib/humanizer-regions.test.ts` SHALL test `extractLockedRegions` and `restoreLockedRegions` covering zero regions, one region, multiple regions, malformed lock tags, and missing-placeholder restoration failure.

#### Scenario: No lock tags returns content unchanged
- **WHEN** `extractLockedRegions` is called on content with no `HUMANIZER_LOCK_START` tags
- **THEN** `stripped` equals the original content and `regions` is empty

#### Scenario: Single locked region is replaced with placeholder
- **WHEN** `extractLockedRegions` is called with one locked region
- **THEN** `stripped` contains `__LOCKED_REGION_0__` and `regions[0]` contains the full lock tag pair and its content

#### Scenario: Restore returns null if placeholder missing
- **WHEN** `restoreLockedRegions` is called with content that is missing `__LOCKED_REGION_0__`
- **THEN** it returns `null`

#### Scenario: Round-trip extract then restore is lossless
- **WHEN** `extractLockedRegions` output is passed to `restoreLockedRegions`
- **THEN** the final string equals the original input exactly

### Requirement: seo-schema.ts unit tests
`src/lib/seo-schema.test.ts` SHALL test `generateArticleSchema`, `generateFAQSchema`, `generateBreadcrumbSchema`, and `buildSchemaScriptBlock` covering valid inputs, missing frontmatter fields, no FAQ section, FAQ cap at 10 pairs, and invalid JSON-LD guard.

#### Scenario: Article schema contains required JSON-LD fields
- **WHEN** `generateArticleSchema` is called with a complete frontmatter object
- **THEN** the parsed JSON contains `@type: 'Article'`, `headline`, `datePublished`, `author.name`, and a `url` with the correct slug

#### Scenario: generateFAQSchema returns null for content without FAQ heading
- **WHEN** `generateFAQSchema` is called with content that has no `## FAQ` or `## Frequently Asked Questions` heading
- **THEN** it returns `null`

#### Scenario: FAQ schema caps at 10 Q&A pairs
- **WHEN** `generateFAQSchema` is called with a FAQ section containing 12 question/answer pairs
- **THEN** the resulting `mainEntity` array has exactly 10 entries

#### Scenario: Breadcrumb schema has three ListItem positions
- **WHEN** `generateBreadcrumbSchema` is called with pillar, slug, and title
- **THEN** the parsed JSON `itemListElement` has exactly 3 entries with positions 1, 2, 3

### Requirement: linker.ts unit tests
`src/lib/linker.test.ts` SHALL test `injectInternalLinks` as a pure function (no D1 dependency) covering empty links, code-fence skipping, already-linked anchor skipping, and single injection per anchor.

#### Scenario: Empty links list returns content unchanged
- **WHEN** `injectInternalLinks` is called with an empty links array
- **THEN** the returned content equals the input exactly

#### Scenario: Anchor inside code fence is not linked
- **WHEN** `injectInternalLinks` is called with content where the anchor term appears only inside a fenced code block
- **THEN** the code block content is not modified

#### Scenario: Already-linked anchor is not double-linked
- **WHEN** `injectInternalLinks` is called with content where the anchor term is already wrapped as a Markdown link
- **THEN** no second link is injected

#### Scenario: First unlinked occurrence is wrapped as Markdown link
- **WHEN** `injectInternalLinks` is called with content containing an unlinked anchor term
- **THEN** the first occurrence is replaced with `[anchor](/blog/<slug>/)`

### Requirement: quality.ts, frontmatter.ts, slug.ts unit tests
Each of these pure-function modules SHALL have a co-located `*.test.ts` file covering at least their primary success path and one invalid-input path.

#### Scenario: scoreArticle returns a number between 0 and 1
- **WHEN** `scoreArticle` is called with valid article Markdown content
- **THEN** it returns a numeric value in the range [0, 1]

#### Scenario: parseFrontmatter throws on invalid YAML
- **WHEN** `parseFrontmatter` is called with content containing malformed YAML front matter
- **THEN** it throws a validation error

#### Scenario: toSlug produces lowercase kebab output
- **WHEN** `toSlug` is called with a mixed-case title containing spaces and special characters
- **THEN** it returns a lowercase, hyphenated slug with no special characters
