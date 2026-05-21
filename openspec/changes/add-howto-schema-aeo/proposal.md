## Why

The `add-assessee-section-148-guide` change specifies a 7-step numbered workflow in the article body — exactly the content pattern Google uses to display **HowTo rich results** in search. However, `src/lib/seo-schema.ts` (Phase 4) only generates Article, FAQ, and Breadcrumb JSON-LD; it has no HowTo schema. Without HowTo JSON-LD, a procedural step-by-step article publishes with generic Article schema and misses the richest SERP feature available to it. Additionally, the Phase 4 publisher has no guard against double-injecting a JSON-LD block into an MDX file that already contains one inline (a risk flagged in the assessee guide design doc) — this needs a one-line fix before Phase 4 deploys.

## What Changes

- `src/lib/seo-schema.ts` — new export `generateHowToSchema(content: string, title: string, description: string): string | null` that extracts numbered step lists from article Markdown and returns a valid `HowTo` JSON-LD string, or `null` if no numbered workflow is detected
- `src/workers/pipeline/publisher.ts` — publisher injection logic gains two updates: (a) calls `generateHowToSchema` and includes the result in the JSON-LD block when non-null, and (b) checks whether the MDX content already contains a `<script type="application/ld+json">` block before appending, skipping injection if one is found

## Capabilities

### New Capabilities

- `howto-schema-generation`: `seo-schema.ts` gains `generateHowToSchema()` — detects a numbered step workflow (3+ sequential items), extracts each step's heading/first-sentence as `name`/`text`, and returns a valid `HowTo` JSON-LD object. Returns `null` if no qualifying workflow is found.

### Modified Capabilities

- `seo-schema-injection`: Publisher worker is updated to (a) include HowTo schema in the JSON-LD block for articles that have a numbered workflow, and (b) skip appending the schema block entirely if an existing `<script type="application/ld+json">` block is already present in the MDX content.

## Impact

- **`src/lib/seo-schema.ts`**: One new exported function, no changes to existing exports
- **`src/workers/pipeline/publisher.ts`**: Two additive changes to the schema injection block — one new function call, one pre-append guard
- **No frontmatter schema changes** — HowTo is inferred from body content, not frontmatter
- **No new npm packages**
- **Backwards-compatible**: Articles without a numbered workflow get unchanged Article + FAQ + Breadcrumb output; articles with a workflow get HowTo added to the array
