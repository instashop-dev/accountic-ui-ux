## ADDED Requirements

### Requirement: Internal linker finds contextually related posts from D1
`src/lib/linker.ts` SHALL export a `findInternalLinks(db: D1Database, frontmatter: { tags: string[], pillar: string }, currentSlug: string): Promise<InternalLink[]>` function that queries the D1 `posts` table for up to 5 posts where the post's `pillar` matches the article's `pillar` OR the post's `slug` contains any tag from the article's `tags` array. The function SHALL exclude the current article's own slug from results. Results SHALL be ordered by `published_at DESC` (most recent first). The function SHALL return an array of `InternalLink` objects with `{ slug: string, title: string, anchor: string }` where `anchor` is the tag or pillar term that matched.

#### Scenario: Matching posts are returned ordered by recency
- **WHEN** `findInternalLinks` is called with `pillar = 'gst'` and there are 3 posts with `pillar = 'gst'` in D1
- **THEN** up to 3 `InternalLink` objects are returned, ordered by `published_at DESC`

#### Scenario: Current article is excluded from results
- **WHEN** the current article's slug matches a row in `posts`
- **THEN** that row is excluded from the returned links

#### Scenario: No matching posts returns empty array
- **WHEN** no posts in D1 share the article's pillar or tags
- **THEN** `findInternalLinks` returns `[]` without throwing

#### Scenario: Results are capped at 5
- **WHEN** 10 posts match the query criteria
- **THEN** only 5 are returned

### Requirement: Internal linker injects links into Markdown content
`src/lib/linker.ts` SHALL export an `injectInternalLinks(content: string, links: InternalLink[]): string` function that, for each `InternalLink`, finds the first occurrence of the `anchor` term in the Markdown body text (case-insensitive, not already wrapped in a Markdown link) and wraps it as `[anchor](/blog/<slug>/)`. The function SHALL skip injection for a link if the anchor term does not appear in the content or is already part of an existing Markdown link `[...](...) `. The function SHALL not inject links inside code blocks (backtick-fenced regions) or frontmatter fences.

#### Scenario: Anchor term is injected as a link
- **WHEN** the content contains the word "GST" and a link with `anchor = 'GST'` is provided
- **THEN** the first occurrence of "GST" (not already linked) is replaced with `[GST](/blog/<slug>/)`

#### Scenario: Existing links are not double-wrapped
- **WHEN** the content already contains `[GST](/blog/some-post/)` and a link with `anchor = 'GST'` is provided
- **THEN** the existing link is not modified and no duplicate link is injected

#### Scenario: Code block content is not modified
- **WHEN** the anchor term appears inside a code fence (` ``` `)
- **THEN** the term inside the code block is not wrapped in a link

#### Scenario: Missing anchor term skips injection gracefully
- **WHEN** the content does not contain the `anchor` text
- **THEN** the content is returned unchanged for that link (no error)
