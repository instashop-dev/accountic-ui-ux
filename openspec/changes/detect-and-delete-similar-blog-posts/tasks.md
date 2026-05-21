## 1. Export Similarity Utility

- [x] 1.1 Export `computeBigramJaccard()` from `src/lib/regression.ts` (add named export if currently not exported)
- [x] 1.2 Verify `parseFrontmatter()` in `src/lib/frontmatter.ts` returns both `data` and `content` (body text); adjust if needed

## 2. Detect Similar Posts Script

- [x] 2.1 Create `scripts/detect-similar-posts.ts` — glob `src/content/blog/**/*.{md,mdx}`, parse each file with `parseFrontmatter`, extract body text
- [x] 2.2 Implement pairwise Jaccard loop: compare every unique post pair, collect pairs with score ≥ threshold
- [x] 2.3 Add `--threshold` flag (default `0.55`) and `--verbose` flag
- [x] 2.4 Sort results by score descending
- [x] 2.5 Write `similar-posts-report.md` with one section per pair (slug A, slug B, score, titles, pub dates)
- [x] 2.6 Write `similar-posts-report.json` with machine-readable array (`slugA`, `slugB`, `score`, `titleA`, `titleB`, `pubDateA`, `pubDateB`)
- [x] 2.7 Print "No similar pairs found above threshold X.XX" and exit 0 when nothing is found
- [x] 2.8 Add `detect-similar-posts` script entry to `package.json`

## 3. Delete Similar Posts Script

- [x] 3.1 Create `scripts/delete-similar-posts.ts` — accept `--slugs` (comma-separated) and `--from-report` (path to JSON) flags
- [x] 3.2 Implement `--from-report` mode: parse JSON, select older-pubDate slug from each pair as deletion candidate
- [x] 3.3 Implement dry-run mode (default when `--confirm` is absent): print "[DRY RUN] Would delete: <slug>" per target, then exit 0
- [x] 3.4 Implement filesystem deletion: resolve `.md` or `.mdx` path under `src/content/blog/`, unlink file, warn if not found
- [x] 3.5 Implement D1 deletion order: `generation_jobs` (by `post_id`) → `drafts` (by `post_slug`) → `posts` (by `slug`) using `wrangler d1 execute`
- [x] 3.6 Add `--env` flag: `production` uses `--remote`, anything else (default `local`) uses `--local`
- [x] 3.7 Print completion summary: "Deleted X files, removed Y D1 rows, W warnings"
- [x] 3.8 Add `delete-similar-posts` script entry to `package.json`

## 4. D1 Schema Migration

- [x] 4.1 Create `migrations/009_cascade_generation_jobs.sql` — recreates `generation_jobs` with `ON DELETE CASCADE` on `post_id` FK (SQLite doesn't support ALTER COLUMN)
- [x] 4.2 Update `migrations/001_rollback.sql` if needed to drop tables in correct order (`generation_jobs` before `posts`)
- [x] 4.3 Update `openspec/specs/d1-schema/spec.md` to reflect the cascade delete requirement (already written in change spec)

## 5. Verification

- [x] 5.1 Run `npx tsx scripts/detect-similar-posts.ts` against the live blog corpus and verify report output is correct
- [x] 5.2 Run `npx tsx scripts/delete-similar-posts.ts --slugs <test-slug> --dry-run` and confirm dry-run output without file changes
- [x] 5.3 Run `npx tsx scripts/detect-similar-posts.ts --threshold 0.3` to confirm threshold flag works
- [x] 5.4 Run `npx tsx scripts/validate-post.ts` on remaining posts after a test deletion to confirm no breakage
