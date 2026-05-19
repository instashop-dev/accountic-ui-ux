## ADDED Requirements

### Requirement: SEO schema module generates Article JSON-LD from frontmatter
`src/lib/seo-schema.ts` SHALL export a `generateArticleSchema(frontmatter: { title: string, description: string, pubDate: string, author: string, slug: string }): string` function that returns a JSON string representing a valid `Article` schema (`@type: "Article"`) with fields: `headline` (title), `description`, `datePublished` (pubDate in ISO 8601), `author` (`@type: "Person"`, `name`: author value), and `url` (`https://accountic.in/blog/<slug>/`). The returned string SHALL be valid JSON.

#### Scenario: Article schema is generated correctly
- **WHEN** `generateArticleSchema` is called with a valid frontmatter object
- **THEN** the returned string is valid JSON containing `@context`, `@type: "Article"`, `headline`, `datePublished`, `author`, and `url` fields

#### Scenario: Special characters in title are safely encoded
- **WHEN** the article title contains a double-quote character
- **THEN** the JSON string is still valid (characters are properly escaped)

### Requirement: SEO schema module generates FAQ JSON-LD from article content
`src/lib/seo-schema.ts` SHALL export a `generateFAQSchema(content: string): string | null` function that extracts question-answer pairs from a `## Frequently Asked Questions` or `## FAQ` heading section in the Markdown content. Each Q&A pair SHALL be identified by a `### ` subheading (the question) followed by paragraph text (the answer). The function SHALL return a valid `FAQPage` JSON-LD string if at least one Q&A pair is found, or `null` if no FAQ section exists. The function SHALL extract at most 10 FAQ pairs.

#### Scenario: FAQ section is extracted and returned as JSON-LD
- **WHEN** content contains `## FAQ` with 3 `### Question` / paragraph answer pairs
- **THEN** `generateFAQSchema` returns a JSON string with `@type: "FAQPage"` and 3 `mainEntity` entries

#### Scenario: No FAQ section returns null
- **WHEN** content does not contain a `## FAQ` or `## Frequently Asked Questions` heading
- **THEN** `generateFAQSchema` returns `null`

#### Scenario: FAQ extraction is capped at 10 pairs
- **WHEN** the content contains 15 question-answer pairs under the FAQ heading
- **THEN** only the first 10 are included in the JSON-LD output

### Requirement: SEO schema module generates Breadcrumb JSON-LD
`src/lib/seo-schema.ts` SHALL export a `generateBreadcrumbSchema(pillar: string, slug: string, title: string): string` function that returns a valid `BreadcrumbList` JSON-LD string with three list items: Home (`/`), the pillar category (`/blog/?pillar=<pillar>`), and the article (`/blog/<slug>/`).

#### Scenario: Breadcrumb schema is generated with three levels
- **WHEN** `generateBreadcrumbSchema` is called with valid inputs
- **THEN** the returned string is valid JSON with `@type: "BreadcrumbList"` and 3 `itemListElement` entries in order

### Requirement: Publisher Worker injects JSON-LD schema block into MDX before GitHub commit
`src/workers/pipeline/publisher.ts` SHALL, before committing the MDX content to GitHub, call `generateArticleSchema`, `generateFAQSchema`, and `generateBreadcrumbSchema` from `src/lib/seo-schema.ts` and append a `<script type="application/ld+json">` block to the MDX file containing all non-null schema objects in a JSON array. The block SHALL be appended after the last line of article body content.

#### Scenario: JSON-LD block is appended to MDX before commit
- **WHEN** the publisher Worker prepares a draft for GitHub commit
- **THEN** the committed MDX file ends with `<script type="application/ld+json">[...]</script>` containing at least the Article and Breadcrumb schemas

#### Scenario: FAQ schema included when FAQ section exists
- **WHEN** the draft content includes a `## FAQ` section with at least one Q&A pair
- **THEN** the JSON-LD block includes a `FAQPage` entry alongside the Article and Breadcrumb entries

#### Scenario: FAQ schema omitted when no FAQ section
- **WHEN** the draft content has no `## FAQ` section
- **THEN** the JSON-LD block contains only the Article and Breadcrumb schemas (no `FAQPage` entry)
