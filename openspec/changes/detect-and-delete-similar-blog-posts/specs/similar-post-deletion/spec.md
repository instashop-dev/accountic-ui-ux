## ADDED Requirements

### Requirement: Delete script accepts slugs to remove
`scripts/delete-similar-posts.ts` SHALL accept a `--slugs` flag with a comma-separated list of post slugs, OR a `--from-report` flag pointing to a `similar-posts-report.json` file (in which case it uses the lower-scored slug from each pair).

#### Scenario: Explicit slugs accepted
- **WHEN** `--slugs section-148-notice,gst-audit-guide` is passed
- **THEN** the script targets exactly those two slugs for deletion

#### Scenario: Report-based slug selection
- **WHEN** `--from-report similar-posts-report.json` is passed
- **THEN** the script collects the slug with the earlier `pubDate` from each pair as the deletion candidate (older post is removed)

#### Scenario: No slugs and no report exits with error
- **WHEN** neither `--slugs` nor `--from-report` is provided
- **THEN** the script exits 1 with message "Provide --slugs or --from-report"

### Requirement: Delete script defaults to dry-run
Unless `--confirm` is explicitly passed, the script SHALL print what it would do and exit without making any changes.

#### Scenario: Dry-run output
- **WHEN** `--confirm` is not passed
- **THEN** the script prints "[DRY RUN] Would delete: <slug>" for each target and exits 0 without modifying any file or D1 row

#### Scenario: Confirmation required to execute
- **WHEN** `--confirm` is passed
- **THEN** the script proceeds to delete filesystem files and D1 rows

### Requirement: Delete script removes post files from filesystem
For each confirmed slug, the script SHALL delete the corresponding `.md` or `.mdx` file from `src/content/blog/`.

#### Scenario: File deleted by slug
- **WHEN** slug `section-148-notice` is confirmed for deletion
- **THEN** `src/content/blog/section-148-notice.md` (or `.mdx`) is removed from the filesystem

#### Scenario: Missing file is warned, not fatal
- **WHEN** a slug has no matching file in `src/content/blog/`
- **THEN** the script logs a warning and continues processing remaining slugs

### Requirement: Delete script removes D1 rows in dependency order
For each confirmed slug, the script SHALL delete related rows from D1 in this order: `generation_jobs` (WHERE post_id matches), then `drafts` (WHERE post_slug matches), then `posts` (WHERE slug matches). It SHALL use `wrangler d1 execute` with `--remote` for production or `--local` for local dev based on the `--env` flag.

#### Scenario: D1 rows deleted in correct order
- **WHEN** a slug is confirmed for deletion with `--env production`
- **THEN** the script executes DELETE on `generation_jobs`, then `drafts`, then `posts` via `wrangler d1 execute --remote`

#### Scenario: Local env uses local D1
- **WHEN** `--env local` is passed (or omitted, defaulting to local)
- **THEN** `wrangler d1 execute --local` is used instead of `--remote`

#### Scenario: D1 row not found is non-fatal
- **WHEN** no row exists in `posts` for the given slug
- **THEN** the script logs a warning and continues; it does not exit with error

### Requirement: Delete script prints a completion summary
After processing all slugs, the script SHALL print how many files were deleted, how many D1 rows were removed, and how many warnings occurred.

#### Scenario: Summary on completion
- **WHEN** the script finishes with `--confirm`
- **THEN** output includes "Deleted X files, removed Y D1 rows, W warnings"
