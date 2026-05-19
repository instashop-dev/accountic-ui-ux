## ADDED Requirements

### Requirement: D1 migration 003 creates humanizer_jobs table
`migrations/003_humanizer.sql` SHALL create a `humanizer_jobs` table (IF NOT EXISTS) with columns: `id` (TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))), `draft_id` (TEXT NOT NULL REFERENCES drafts(id)), `input_hash` (TEXT NOT NULL), `outcome` (TEXT NOT NULL — one of `'humanized' | 'fallback' | 'failed' | 'skipped'`), `tokens_used` (INTEGER DEFAULT 0), `duration_ms` (INTEGER DEFAULT 0), `error` (TEXT), `created_at` (TEXT NOT NULL DEFAULT current_timestamp). A UNIQUE constraint SHALL be placed on `(draft_id, input_hash)` to enforce idempotency.

#### Scenario: humanizer_jobs table is created by migration
- **WHEN** `migrations/003_humanizer.sql` is applied
- **THEN** a `humanizer_jobs` table exists with all specified columns and a UNIQUE constraint on `(draft_id, input_hash)`

#### Scenario: Duplicate humanizer job is rejected by UNIQUE constraint
- **WHEN** a second row is inserted into `humanizer_jobs` with the same `draft_id` and `input_hash`
- **THEN** the insert fails with a UNIQUE constraint violation

### Requirement: D1 migration 003 adds columns to drafts table
`migrations/003_humanizer.sql` SHALL execute `ALTER TABLE drafts ADD COLUMN humanized_at TEXT` and `ALTER TABLE drafts ADD COLUMN internal_links_added INTEGER DEFAULT 0` (both nullable, additive). These columns SHALL be populated by the humanizer Worker: `humanized_at` with the ISO 8601 timestamp of humanization completion; `internal_links_added` with the count of internal links injected.

#### Scenario: humanized_at column is nullable after migration
- **WHEN** `migrations/003_humanizer.sql` is applied and an existing `drafts` row is read
- **THEN** `humanized_at` is NULL for all pre-existing rows

#### Scenario: internal_links_added defaults to 0
- **WHEN** a new row is inserted into `drafts` without specifying `internal_links_added`
- **THEN** `internal_links_added` is 0

### Requirement: D1 migration 003 inserts default humanizer prompt and settings
`migrations/003_humanizer.sql` SHALL insert a default active prompt for `stage = 'humanizer'` into the `prompts` table (INSERT OR IGNORE). It SHALL also insert default D1 settings rows (INSERT OR IGNORE) for key `humanizer_enabled` with value `'true'`.

#### Scenario: Default humanizer prompt is inserted
- **WHEN** `migrations/003_humanizer.sql` is applied
- **THEN** a row exists in `prompts` with `stage = 'humanizer'` and `is_active = 1`

#### Scenario: humanizer_enabled setting is inserted
- **WHEN** `migrations/003_humanizer.sql` is applied
- **THEN** a row exists in `settings` with `key = 'humanizer_enabled'` and `value = 'true'`

### Requirement: D1 migration 003 includes a rollback script
`migrations/003_rollback.sql` SHALL: drop `humanizer_jobs` table, execute `ALTER TABLE drafts DROP COLUMN humanized_at` and `ALTER TABLE drafts DROP COLUMN internal_links_added`, and delete prompts where `stage = 'humanizer'`. It SHALL NOT drop or modify any Phase 2 or Phase 3 tables.

#### Scenario: Rollback script removes Phase 4 schema additions
- **WHEN** `migrations/003_rollback.sql` is applied after `migrations/003_humanizer.sql`
- **THEN** `humanizer_jobs` table does not exist, `drafts` table does not have `humanized_at` or `internal_links_added` columns, and no `prompts` rows with `stage = 'humanizer'` exist

## MODIFIED Requirements

### Requirement: D1 schema defines generation_jobs table
`migrations/001_init.sql` SHALL create a `generation_jobs` table with columns: `id` (TEXT PRIMARY KEY), `post_id` (TEXT REFERENCES posts(id)), `stage` (TEXT NOT NULL), `status` (TEXT NOT NULL DEFAULT 'pending'), `input_hash` (TEXT), `output_ref` (TEXT), `stage_payload` (TEXT), `error` (TEXT), `created_at` (TEXT NOT NULL DEFAULT current_timestamp), `updated_at` (TEXT NOT NULL DEFAULT current_timestamp). The `stage_payload` column (TEXT, nullable) stores per-stage structured JSON without breaking existing rows. This requirement is unchanged from Phase 3.

#### Scenario: generation_jobs table created
- **WHEN** `migrations/001_init.sql` is applied
- **THEN** a `generation_jobs` table exists with a foreign key to `posts(id)`

#### Scenario: status defaults to pending
- **WHEN** a row is inserted into `generation_jobs` without specifying `status`
- **THEN** the `status` column value is `'pending'`

#### Scenario: stage_payload column is nullable
- **WHEN** a row is inserted into `generation_jobs` without specifying `stage_payload`
- **THEN** the insert succeeds and `stage_payload` is NULL
