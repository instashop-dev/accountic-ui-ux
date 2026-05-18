## ADDED Requirements

### Requirement: quality.ts exports a scoreArticle function returning a structured quality report
`src/lib/quality.ts` SHALL export a `scoreArticle(content: string, frontmatter: Record<string, unknown>): QualityReport` function. `QualityReport` SHALL be `{ passed: boolean; scores: { readability: number; originality: boolean; schemaValid: boolean }; errors: string[] }`. `passed` SHALL be `true` only when all three checks pass their thresholds. The function SHALL NOT import from `astro:*` namespaces.

#### Scenario: All checks pass returns passed: true
- **WHEN** `scoreArticle` is called with a well-written article and valid frontmatter
- **THEN** it returns `{ passed: true, scores: { readability: <≥70>, originality: true, schemaValid: true }, errors: [] }`

#### Scenario: Failed check returns passed: false with error message
- **WHEN** `scoreArticle` is called with an article scoring 55 on readability
- **THEN** it returns `{ passed: false, scores: { readability: 55, ... }, errors: ["Readability score 55 is below threshold 70"] }`

### Requirement: quality.ts enforces Flesch Reading Ease ≥ 70
The `scoreArticle` function SHALL compute a Flesch Reading Ease score for the article body (excluding YAML frontmatter and code blocks) and require a score ≥ 70. The score SHALL be computed using the standard formula: `206.835 - 1.015 × (words/sentences) - 84.6 × (syllables/words)`.

#### Scenario: High-readability article passes
- **WHEN** the article body produces a Flesch score of 78
- **THEN** `scores.readability` is 78 and the readability check does not add an error

#### Scenario: Low-readability article fails
- **WHEN** the article body produces a Flesch score of 62
- **THEN** `scores.readability` is 62 and `errors` includes a readability error message

#### Scenario: Code blocks are excluded from readability scoring
- **WHEN** the article contains a long fenced code block
- **THEN** the code block text is stripped before computing the Flesch score

### Requirement: quality.ts enforces originality — at least one unique insight marker
The `scoreArticle` function SHALL check that the article body contains at least one of the following originality markers: a numbered or bulleted practical workflow step sequence (≥ 3 steps), an explicit comparison table (markdown table with ≥ 3 rows), a concrete implementation example with realistic Indian tax values (PAN, assessment year, section reference), or a named case study or practitioner scenario. If none of these markers are detected, `scores.originality` SHALL be `false` and an error message SHALL be added.

#### Scenario: Article with numbered workflow passes originality
- **WHEN** the article body contains a numbered list with 4 or more items describing a CA workflow
- **THEN** `scores.originality` is `true`

#### Scenario: Generic article without markers fails originality
- **WHEN** the article body contains only prose paragraphs with no workflow steps, tables, examples, or case studies
- **THEN** `scores.originality` is `false` and `errors` includes an originality error message

### Requirement: quality.ts delegates schema validation to src/lib/schema-validate.ts
The `scoreArticle` function SHALL call `validatePostFrontmatter(frontmatter)` from `src/lib/schema-validate.ts` to determine `scores.schemaValid`. If validation fails, all Zod error strings SHALL be appended to `errors`.

#### Scenario: Valid frontmatter passes schema check
- **WHEN** `scoreArticle` is called with frontmatter that satisfies the Zod schema
- **THEN** `scores.schemaValid` is `true` and no schema errors are added

#### Scenario: Invalid frontmatter fails schema check
- **WHEN** `scoreArticle` is called with frontmatter missing the `pillar` field
- **THEN** `scores.schemaValid` is `false` and `errors` includes the Zod error for the missing `pillar`
