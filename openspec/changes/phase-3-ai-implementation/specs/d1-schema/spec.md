## MODIFIED Requirements

### Requirement: D1 schema defines generation_jobs table
`migrations/001_init.sql` SHALL create a `generation_jobs` table with columns: `id` (TEXT PRIMARY KEY), `post_id` (TEXT REFERENCES posts(id)), `stage` (TEXT NOT NULL), `status` (TEXT NOT NULL DEFAULT 'pending'), `input_hash` (TEXT), `output_ref` (TEXT), `stage_payload` (TEXT), `error` (TEXT), `created_at` (TEXT NOT NULL DEFAULT current_timestamp), `updated_at` (TEXT NOT NULL DEFAULT current_timestamp). The new `stage_payload` column (TEXT, nullable) stores per-stage structured JSON without breaking existing rows.

#### Scenario: generation_jobs table created
- **WHEN** `migrations/001_init.sql` is applied
- **THEN** a `generation_jobs` table exists with a foreign key to `posts(id)`

#### Scenario: status defaults to pending
- **WHEN** a row is inserted into `generation_jobs` without specifying `status`
- **THEN** the `status` column value is `'pending'`

#### Scenario: stage_payload column is nullable
- **WHEN** a row is inserted into `generation_jobs` without specifying `stage_payload`
- **THEN** the insert succeeds and `stage_payload` is NULL
