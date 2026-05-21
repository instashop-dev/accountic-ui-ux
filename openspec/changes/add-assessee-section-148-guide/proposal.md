## Why

The automated blog pipeline has published three Section 148 articles, all written for CAs — but the highest-volume search query in this cluster ("how to reply to a section 148 notice step by step") targets assessees (taxpayers), not practitioners. That slot is unoccupied and is currently serving competitor pages. Additionally, the pipeline's quality gate (`scoreArticle`) has no audience-alignment check, so a CA-voiced article could be published to an assessee-intent slug without any flag.

## What Changes

- New blog article: `src/content/blog/section-148-notice-reply-step-by-step-guide-for-assessees.mdx` — assessee-facing, step-by-step workflow (7 steps), FAQ schema block, internal links to existing cluster articles
- New pipeline quality rule: audience signal validation — if a slug contains `for-assessees`, `guide-for`, or `taxpayer`, the article must contain second-person assessee language (`"you received"`, `"your notice"`) rather than third-person CA-instruction voice; fails `scoreArticle` if violated
- Generation prompt amendment: the topic-discovery and article-generation workers must carry an `audience` metadata field (`ca` | `assessee` | `general`) that drives article voice and FAQ question framing

## Capabilities

### New Capabilities

- `assessee-article-content`: The article itself — `section-148-notice-reply-step-by-step-guide-for-assessees.mdx` with correct frontmatter, 7-step numbered workflow, rupee example, FAQ section (5+ Q&A pairs), and `<script type="application/ld+json">` schema block (Article + FAQPage + Breadcrumb)
- `audience-quality-gate`: New check in `src/lib/quality.ts` `scoreArticle()` — detects audience signal in slug/frontmatter and validates article voice matches; blocks publish if CA-voice article has assessee-intent slug

### Modified Capabilities

- `post-validation`: `scoreArticle` gains a fourth check (`audienceVoiceValid`) alongside the existing three (readability, originality, schemaValid); the `QualityReport` type adds `audienceVoiceValid: boolean` to `scores`

## Impact

- **New file**: `src/content/blog/section-148-notice-reply-step-by-step-guide-for-assessees.mdx`
- **Modified**: `src/lib/quality.ts` — `scoreArticle()`, `QualityReport` interface
- **Modified**: `src/workers/pipeline/article-generation.ts` — topic payload gains `audience` field
- **No schema migration required** — `src/content.config.ts` frontmatter schema already accepts the fields used
- **No new npm packages** — pure TypeScript additions
