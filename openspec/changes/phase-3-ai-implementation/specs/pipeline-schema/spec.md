## ADDED Requirements

### Requirement: migration 002 creates the topics table
`migrations/002_pipeline.sql` SHALL create a `topics` table with columns: `id` (TEXT PRIMARY KEY), `title` (TEXT NOT NULL), `pillar` (TEXT NOT NULL), `rationale` (TEXT), `status` (TEXT NOT NULL DEFAULT 'pending'), `created_at` (TEXT NOT NULL DEFAULT current_timestamp), `updated_at` (TEXT NOT NULL DEFAULT current_timestamp). All CREATE statements SHALL use `IF NOT EXISTS`. A UNIQUE constraint SHALL be placed on `title` (case-insensitive collation via `COLLATE NOCASE`).

#### Scenario: topics table created idempotently
- **WHEN** `migrations/002_pipeline.sql` is applied twice
- **THEN** no error is thrown on the second application

#### Scenario: Duplicate title is rejected
- **WHEN** two rows with the same `title` (differing only in case) are inserted into `topics`
- **THEN** the second insert fails with a UNIQUE constraint violation

#### Scenario: status defaults to pending
- **WHEN** a row is inserted into `topics` without specifying `status`
- **THEN** the `status` column value is `'pending'`

### Requirement: migration 002 creates the outlines table
`migrations/002_pipeline.sql` SHALL create an `outlines` table with columns: `id` (TEXT PRIMARY KEY), `topic_id` (TEXT NOT NULL REFERENCES topics(id)), `outline_json` (TEXT NOT NULL), `error` (TEXT), `created_at` (TEXT NOT NULL DEFAULT current_timestamp).

#### Scenario: outlines table links to topics
- **WHEN** a row is inserted into `outlines` with a `topic_id` that does not exist in `topics`
- **THEN** the insert fails with a foreign key constraint violation

### Requirement: migration 002 creates the drafts table
`migrations/002_pipeline.sql` SHALL create a `drafts` table with columns: `id` (TEXT PRIMARY KEY), `outline_id` (TEXT NOT NULL REFERENCES outlines(id)), `slug` (TEXT NOT NULL), `content` (TEXT NOT NULL), `frontmatter_json` (TEXT NOT NULL), `status` (TEXT NOT NULL DEFAULT 'pending'), `error` (TEXT), `quality_report_json` (TEXT), `created_at` (TEXT NOT NULL DEFAULT current_timestamp), `updated_at` (TEXT NOT NULL DEFAULT current_timestamp). A UNIQUE constraint SHALL be placed on `slug`.

#### Scenario: drafts table created idempotently
- **WHEN** `migrations/002_pipeline.sql` is applied twice
- **THEN** no error is thrown on the second application

#### Scenario: slug is unique across drafts
- **WHEN** two drafts with the same `slug` are inserted
- **THEN** the second insert fails with a UNIQUE constraint violation

### Requirement: migration 002 creates the prompts table
`migrations/002_pipeline.sql` SHALL create a `prompts` table with columns: `id` (TEXT PRIMARY KEY), `stage` (TEXT NOT NULL), `version` (INTEGER NOT NULL DEFAULT 1), `system_prompt` (TEXT NOT NULL), `user_prompt_template` (TEXT NOT NULL), `is_active` (INTEGER NOT NULL DEFAULT 0), `created_at` (TEXT NOT NULL DEFAULT current_timestamp). A UNIQUE constraint SHALL be placed on `(stage, version)`. The migration SHALL seed one active default prompt row for each of the four pipeline stages (`topic-discovery`, `outline-generation`, `article-generation`, `publisher`) with `is_active = 1`.

#### Scenario: Default prompts are seeded
- **WHEN** `migrations/002_pipeline.sql` is applied to a fresh D1 database
- **THEN** `SELECT COUNT(*) FROM prompts WHERE is_active = 1` returns 4

#### Scenario: stage+version combination is unique
- **WHEN** two rows with the same `stage` and `version` are inserted into `prompts`
- **THEN** the second insert fails with a UNIQUE constraint violation

### Requirement: migration 002 rollback drops all Phase 3 tables
`migrations/002_rollback.sql` SHALL contain `DROP TABLE IF EXISTS` statements for all four Phase 3 tables in reverse dependency order: `drafts`, `outlines`, `topics`, `prompts`.

#### Scenario: Rollback drops all Phase 3 tables
- **WHEN** `migrations/002_rollback.sql` is applied after `migrations/002_pipeline.sql`
- **THEN** none of `topics`, `outlines`, `drafts`, or `prompts` exist in the database and Phase 2 tables (`posts`, `generation_jobs`, `settings`) remain intact
