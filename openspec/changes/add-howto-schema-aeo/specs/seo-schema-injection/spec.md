## MODIFIED Requirements

### Requirement: Publisher Worker injects JSON-LD schema block into MDX before GitHub commit
`src/workers/pipeline/publisher.ts` SHALL, before committing the MDX content to GitHub, check whether the content already contains a `<script type="application/ld+json">` block. If one is found, the publisher SHALL skip schema injection entirely for that article. If none is found, the publisher SHALL call `generateArticleSchema`, `generateFAQSchema`, `generateHowToSchema`, and `generateBreadcrumbSchema` from `src/lib/seo-schema.ts` and append a `<script type="application/ld+json">` block to the MDX file containing all non-null schema objects in a JSON array. The block SHALL be appended after the last line of article body content.

#### Scenario: JSON-LD block is appended to MDX before commit
- **WHEN** the publisher Worker prepares a draft for GitHub commit and the content does not already contain `<script type="application/ld+json">`
- **THEN** the committed MDX file ends with `<script type="application/ld+json">[...]</script>` containing at least the Article and Breadcrumb schemas

#### Scenario: FAQ schema included when FAQ section exists
- **WHEN** the draft content includes a `## FAQ` section with at least one Q&A pair and no existing JSON-LD block
- **THEN** the JSON-LD block includes a `FAQPage` entry alongside the Article and Breadcrumb entries

#### Scenario: FAQ schema omitted when no FAQ section
- **WHEN** the draft content has no `## FAQ` section
- **THEN** the JSON-LD block contains only the Article and Breadcrumb schemas (no `FAQPage` entry)

#### Scenario: HowTo schema included when numbered workflow exists
- **WHEN** the draft content contains a sequential numbered list of 3 or more steps and no existing JSON-LD block
- **THEN** the JSON-LD block includes a `HowTo` entry alongside Article and Breadcrumb schemas

#### Scenario: HowTo schema omitted when no numbered workflow
- **WHEN** the draft content has no sequential numbered list of 3+ items
- **THEN** the JSON-LD block contains no `HowTo` entry

#### Scenario: Publisher skips injection when schema block already present
- **WHEN** the MDX content already contains the string `<script type="application/ld+json">`
- **THEN** the publisher does not append any schema block — the content is committed unchanged

#### Scenario: Both HowTo and FAQ present in the same article
- **WHEN** the draft has both a numbered 7-step workflow and a `## FAQ` section
- **THEN** the JSON-LD block contains Article, HowTo, FAQPage, and Breadcrumb schemas — all four in the array
