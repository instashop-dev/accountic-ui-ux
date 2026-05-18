### Requirement: D1 schema defines posts table
`migrations/001_init.sql` SHALL create a `posts` table with columns: `id` (TEXT PRIMARY KEY), `slug` (TEXT UNIQUE NOT NULL), `title` (TEXT NOT NULL), `description` (TEXT NOT NULL), `pillar` (TEXT NOT NULL), `tone` (TEXT NOT NULL), `author` (TEXT NOT NULL), `pub_date` (TEXT NOT NULL), `read_time` (INTEGER NOT NULL), `source` (TEXT NOT NULL DEFAULT 'human'), `status` (TEXT NOT NULL DEFAULT 'published'), `created_at` (TEXT NOT NULL DEFAULT current_timestamp), `updated_at` (TEXT NOT NULL DEFAULT current_timestamp). All CREATE statements SHALL use `IF NOT EXISTS`.

#### Scenario: posts table created idempotently
- **WHEN** `migrations/001_init.sql` is applied to a D1 database twice
- **THEN** no error is thrown on the second application

#### Scenario: source column defaults to human
- **WHEN** a row is inserted into `posts` without specifying `source`
- **THEN** the `source` column value is `'human'`

#### Scenario: slug is unique
- **WHEN** two rows with the same `slug` are inserted into `posts`
- **THEN** the second insert fails with a UNIQUE constraint violation

### Requirement: D1 schema defines generation_jobs table
`migrations/001_init.sql` SHALL create a `generation_jobs` table with columns: `id` (TEXT PRIMARY KEY), `post_id` (TEXT REFERENCES posts(id)), `stage` (TEXT NOT NULL), `status` (TEXT NOT NULL DEFAULT 'pending'), `input_hash` (TEXT), `output_ref` (TEXT), `error` (TEXT), `created_at` (TEXT NOT NULL DEFAULT current_timestamp), `updated_at` (TEXT NOT NULL DEFAULT current_timestamp).

#### Scenario: generation_jobs table created
- **WHEN** `migrations/001_init.sql` is applied
- **THEN** a `generation_jobs` table exists with a foreign key to `posts(id)`

#### Scenario: status defaults to pending
- **WHEN** a row is inserted into `generation_jobs` without specifying `status`
- **THEN** the `status` column value is `'pending'`

### Requirement: D1 schema defines settings table
`migrations/001_init.sql` SHALL create a `settings` table with columns: `key` (TEXT PRIMARY KEY), `value` (TEXT NOT NULL), `updated_at` (TEXT NOT NULL DEFAULT current_timestamp). The migration SHALL seed three default rows: `generation_enabled = 'false'`, `weekly_target = '2'`, `quality_threshold = '0.8'`.

#### Scenario: settings table seeded with defaults
- **WHEN** `migrations/001_init.sql` is applied to a fresh D1 database
- **THEN** `SELECT value FROM settings WHERE key = 'generation_enabled'` returns `'false'`

#### Scenario: settings key is primary key
- **WHEN** two rows with the same `key` are inserted into `settings`
- **THEN** the second insert fails with a PRIMARY KEY constraint violation

### Requirement: Rollback migration exists
`migrations/001_rollback.sql` SHALL contain `DROP TABLE IF EXISTS` statements for all three tables in reverse dependency order (`generation_jobs`, `posts`, `settings`).

#### Scenario: Rollback drops all tables
- **WHEN** `migrations/001_rollback.sql` is applied after `migrations/001_init.sql`
- **THEN** all three tables no longer exist in the database
