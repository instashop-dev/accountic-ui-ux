## ADDED Requirements

### Requirement: Assessee-facing Section 148 article exists at the canonical slug
`src/content/blog/section-148-notice-reply-step-by-step-guide-for-assessees.mdx` SHALL exist with valid frontmatter matching the `src/content.config.ts` schema, including: `title`, `description`, `pubDate`, `pillar: 'Income Tax Notices'`, `author`, `readTime`, `tone`, and `featured`.

#### Scenario: Article file exists with valid frontmatter
- **WHEN** `npm run blog:validate src/content/blog/section-148-notice-reply-step-by-step-guide-for-assessees.mdx` is run
- **THEN** the script exits with code 0 and prints a success message

### Requirement: Article contains a 7-step numbered workflow
The article body SHALL contain a numbered list of exactly 7 sequential steps (1 through 7) that describe the assessee's process for replying to a Section 148 notice, written in second-person voice ("you", "your").

#### Scenario: Numbered workflow is present and sequential
- **WHEN** the article content is passed to `scoreArticle()`
- **THEN** `scores.originality` is `true` and `hasNumberedWorkflow` resolves via the 7-step list

#### Scenario: Steps are in second-person assessee voice
- **WHEN** the article text is reviewed
- **THEN** each step uses "you" or "your" in reference to the assessee's actions (e.g., "Obtain your recorded reasons", "Reconcile your bank statements")

### Requirement: Article contains a rupee-figure Indian tax example
The article body SHALL include at least one concrete rupee amount (₹) tied to a Section 148 assessment year example that satisfies the `hasIndianTaxExample()` check in `src/lib/quality.ts`.

#### Scenario: Indian tax example passes quality gate
- **WHEN** the article content is passed to `scoreArticle()`
- **THEN** `scores.originality` is `true` and the rupee figure + section reference pattern is matched

### Requirement: Article contains a FAQ section with at least 5 question-answer pairs
The article body SHALL contain a `## FAQ` heading followed by at least 5 `### Question` / paragraph-answer pairs, written in first-person assessee voice (e.g., "What happens if I don't reply?", "Can I file a reply after 30 days?").

#### Scenario: FAQ section is present with sufficient pairs
- **WHEN** `generateFAQSchema(content)` from `src/lib/seo-schema.ts` is called on the article
- **THEN** it returns a non-null JSON string with `@type: "FAQPage"` and at least 5 `mainEntity` entries

#### Scenario: FAQ questions use assessee first-person voice
- **WHEN** the FAQ section headings are reviewed
- **THEN** questions are phrased from the assessee's perspective ("What happens if I...", "Can I...", "Do I need...") not third-person CA-instruction voice

### Requirement: Article includes an inline JSON-LD schema block
The article SHALL end with a `<script type="application/ld+json">` block containing a JSON array with at minimum an Article schema and a FAQPage schema, consistent with the format defined in `src/lib/seo-schema.ts`.

#### Scenario: JSON-LD block is present and valid JSON
- **WHEN** the article file is read and the `<script type="application/ld+json">` block is extracted
- **THEN** the block contains valid JSON with both `@type: "Article"` and `@type: "FAQPage"` entries

### Requirement: Article links to at least three existing cluster articles
The article body SHALL contain inline Markdown links to at least three of the following existing articles: `section-148-reply-template`, `ai-drafted-section-148-reply-review`, `lakhmani-mewal-das-s148`.

#### Scenario: Internal cluster links are present
- **WHEN** the article Markdown is reviewed
- **THEN** at least three `/blog/<slug>` internal links are found pointing to existing s.148 cluster articles
