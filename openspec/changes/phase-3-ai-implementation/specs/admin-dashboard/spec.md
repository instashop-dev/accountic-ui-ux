## ADDED Requirements

### Requirement: Admin queue page lists drafts with review actions
`src/pages/admin/queue.astro` SHALL render a list of all `drafts` rows with `status IN ('ready', 'failed', 'approved', 'published', 'publish_failed')`, ordered by `created_at DESC`, showing: slug, pillar, status badge, quality score summary, and created date. Each `status = 'ready'` draft SHALL have an Approve button (POST to `/admin/api/drafts/[id]/approve`) and a Reject button (POST to `/admin/api/drafts/[id]/reject`). The page SHALL be server-rendered (no static generation) to always reflect current D1 state.

#### Scenario: Ready drafts show approve and reject buttons
- **WHEN** a user visits `/admin/queue` and there is one draft with `status = 'ready'`
- **THEN** the page renders one row with both an Approve and a Reject button

#### Scenario: Published drafts show status only
- **WHEN** a user visits `/admin/queue` and there is one draft with `status = 'published'`
- **THEN** the page renders a `published` badge with no action buttons

#### Scenario: Approve action updates draft status
- **WHEN** the Approve button is clicked for a `status = 'ready'` draft
- **THEN** a POST is sent to `/admin/api/drafts/[id]/approve`, the draft `status` is updated to `'approved'`, and a publish queue message is dispatched

### Requirement: Admin jobs page displays generation job history
`src/pages/admin/jobs.astro` SHALL render a table of all `generation_jobs` rows ordered by `created_at DESC`, limited to the most recent 100 rows, showing: job ID (truncated), `stage`, `status`, `created_at`, and an error preview for failed rows. Failed rows SHALL have a Replay button (POST to `/admin/api/jobs/[id]/replay`) that re-queues the original job message.

#### Scenario: Failed job shows replay button
- **WHEN** a `generation_jobs` row has `status = 'failed'`
- **THEN** the jobs page renders a Replay button for that row

#### Scenario: Replay dispatches a new queue message
- **WHEN** the Replay button is clicked for a failed job
- **THEN** a new queue message is dispatched to the appropriate `blog-pipeline` stage queue with the original job's input payload

### Requirement: Admin settings page reads and writes D1 settings
`src/pages/admin/settings.astro` SHALL render a form with inputs for: `generation_enabled` (toggle), `weekly_target` (number), `quality_threshold` (decimal), `daily_token_cap` (number), `auto_publish` (toggle), `ai_model` (text). Form submission SHALL POST to `/admin/api/settings` which updates the corresponding D1 `settings` rows. The page SHALL show the current values from D1 on load.

#### Scenario: Settings page shows current values
- **WHEN** D1 `settings` has `generation_enabled = 'true'` and `weekly_target = '4'`
- **THEN** the page renders the toggle in the enabled state and the weekly target input shows `4`

#### Scenario: Settings form submission persists changes
- **WHEN** the operator changes `weekly_target` to `6` and submits the form
- **THEN** the D1 `settings` row for `weekly_target` is updated to `'6'`

### Requirement: Admin prompts page supports viewing and editing versioned prompts
`src/pages/admin/prompts.astro` SHALL render a list of all `prompts` rows grouped by `stage`, showing `version`, `is_active` status, and truncated `system_prompt` preview. Each row SHALL have an Edit button that opens an inline form for editing `system_prompt` and `user_prompt_template`. Saving an edited prompt SHALL create a new row with `version = (max_version + 1)` and `is_active = 1`, and set the previous active row for that stage to `is_active = 0`.

#### Scenario: Editing a prompt creates a new version
- **WHEN** the operator edits the `article-generation` prompt and saves
- **THEN** a new `prompts` row is created with `version` incremented by 1 and `is_active = 1`

#### Scenario: Previous active prompt is deactivated
- **WHEN** a new prompt version is saved for a given stage
- **THEN** the previous `is_active = 1` row for that stage is updated to `is_active = 0`
