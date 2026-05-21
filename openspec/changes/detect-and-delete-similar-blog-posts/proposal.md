## Why

The blog corpus has grown to hundreds of AI-generated posts across 9 pillars, and the topic-discovery pipeline only deduplicates by exact title — semantically similar articles (covering the same ground under slightly different titles) can and do accumulate over time. This erodes content quality, dilutes SEO authority, and wastes token budget regenerating near-duplicate coverage.

## What Changes

- New `scripts/detect-similar-posts.ts` script that scans all published posts in `src/content/blog/`, computes pairwise bigram-Jaccard similarity, and emits a ranked report of similar pairs above a configurable threshold.
- New `scripts/delete-similar-posts.ts` script (or `--delete` flag on the above) that removes the lower-quality post from the filesystem and its corresponding `posts` and `drafts` rows from D1, given a similarity report or explicit slug list.
- The existing `computeBigramJaccard()` utility in `src/lib/regression.ts` is reused; no new similarity algorithm is introduced.
- Topic-discovery deduplication is extended to also guard against semantically similar (not just exact-title) candidates being queued.

## Capabilities

### New Capabilities

- `corpus-similarity-scan`: Batch pairwise similarity scan across all blog posts, producing a JSON/Markdown report of pairs that exceed a threshold (default 0.55 Jaccard on bigrams of body text, excluding frontmatter).
- `similar-post-deletion`: Given a similarity report or an explicit list of slugs, delete the identified posts from the filesystem and purge their D1 records (`posts`, `drafts`, `generation_jobs`).

### Modified Capabilities

- `d1-schema`: The `posts` table deletion logic needs to cascade or handle FK references in `drafts` and `generation_jobs` correctly.

## Impact

- **Files affected**: `src/lib/regression.ts` (export `computeBigramJaccard` if not already), `src/content/blog/**`, `scripts/` (two new scripts), D1 database (row deletions).
- **APIs**: No HTTP API changes; admin-only CLI scripts.
- **Dependencies**: No new packages; reuses existing `src/lib/frontmatter.ts` and `src/lib/regression.ts`.
- **Risk**: Deletion is irreversible on filesystem unless Git history is preserved; scripts will default to dry-run mode.
