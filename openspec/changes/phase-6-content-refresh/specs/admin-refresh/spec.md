## ADDED Requirements

### Requirement: Admin refresh page lists stale posts
`/admin/refresh` SHALL display a table of AI-authored posts (`source = 'ai'`) where `last_refreshed_at IS NULL OR last_refreshed_at < datetime('now', '-60 days')`, sorted by oldest refresh first. Each row SHALL show: post title, slug, publish date, last refreshed date (or "Never"), refresh count, and a "Trigger Refresh" button.

#### Scenario: Page loads with stale posts
- **WHEN** an authenticated admin navigates to `/admin/refresh`
- **THEN** the page renders a table of posts due for refresh with accurate staleness data from D1

#### Scenario: No posts are stale
- **WHEN** all AI posts have been refreshed within 60 days
- **THEN** the page renders an empty state: "No posts due for refresh"

### Requirement: Admin refresh page shows recent refresh job history
The page SHALL include a "Recent Refresh Jobs" section showing the last 20 rows from `refresh_jobs`, ordered by `created_at` descending, with columns: post slug, started_at, status (success/failed/skipped), failed_gate (if any), duration_ms.

#### Scenario: Recent refresh jobs exist
- **WHEN** the page loads and refresh_jobs table has rows
- **THEN** the recent jobs table renders with correct status badges (green for success, red for failed)

### Requirement: Manual refresh trigger via POST
`POST /admin/api/refresh` with body `{ post_id: string }` SHALL enqueue a `{ stage: 'refresh', post_id }` message to `BLOG_REFRESH_QUEUE` and return `{ queued: true }`. The endpoint SHALL validate that the post exists in D1 and has `source = 'ai'`; return `{ error: "Not found" }` (HTTP 200) otherwise. The endpoint SHALL enforce admin auth via the existing middleware.

#### Scenario: Valid post_id triggers refresh
- **WHEN** an authenticated admin POSTs `{ post_id: '<valid-ai-post-id>' }` to `/admin/api/refresh`
- **THEN** the endpoint enqueues a refresh message and returns `{ queued: true }`

#### Scenario: Non-AI post triggers error
- **WHEN** the POSTed post_id belongs to a post with `source = 'manual'`
- **THEN** the endpoint returns `{ error: "Only AI-authored posts can be refreshed" }`

### Requirement: Snapshot restore via POST
`POST /admin/api/refresh/restore` with body `{ post_id: string, snapshot_key: string }` SHALL: (1) load the snapshot from R2, (2) commit the MDX to GitHub overwriting the current file, (3) return `{ restored: true, commit_sha: string }`. On R2 miss or GitHub failure, return `{ error: string }`.

#### Scenario: Successful restore from snapshot
- **WHEN** an admin POSTs a valid `post_id` and `snapshot_key`
- **THEN** the snapshot MDX is committed to GitHub and `{ restored: true, commit_sha }` is returned

#### Scenario: Snapshot key does not exist in R2
- **WHEN** the specified snapshot_key has no corresponding R2 object
- **THEN** the endpoint returns `{ error: "Snapshot not found" }`

### Requirement: Refresh page displays snapshots for each post
Each row in the stale-posts table SHALL include a "Snapshots" indicator showing the count of available R2 snapshots for that post. Clicking opens a modal listing up to 5 snapshots with their timestamps and "Restore" buttons.

#### Scenario: Post has snapshots available
- **WHEN** a stale post row has snapshots in R2
- **THEN** a snapshot count badge is visible and the modal shows timestamped restore options

### Requirement: Refresh page is covered by admin auth middleware
`/admin/refresh` and `/admin/api/refresh` SHALL be protected by `src/middleware.ts` — unauthenticated requests receive HTTP 401.

#### Scenario: Unauthenticated access attempt
- **WHEN** a request hits `/admin/refresh` without a valid `Authorization: Bearer <ADMIN_TOKEN>` header
- **THEN** the middleware returns HTTP 401 before the page handler executes
