## ADDED Requirements

### Requirement: Seed pipeline prompts into D1
The system SHALL provide a one-shot script that inserts active prompts for all five pipeline stages (topic-discovery, outline-generation, article-generation, humanizer, publisher) into the D1 `prompts` table. The script MUST use upsert semantics so it is safe to re-run without creating duplicate rows.

#### Scenario: First-time seed on empty prompts table
- **WHEN** the `prompts` table has no rows and `npm run db:seed-prompts` is executed
- **THEN** exactly five rows are inserted, one per stage, each with `is_active = 1`

#### Scenario: Re-run on already-seeded table
- **WHEN** `npm run db:seed-prompts` is executed a second time
- **THEN** existing rows are updated (upserted) and no duplicate rows are created

#### Scenario: Prompt content is domain-appropriate
- **WHEN** the seeded prompts are used by the topic-discovery worker
- **THEN** the system prompt instructs the model to focus on Indian income tax notices, relevant sections (143, 148, 263, 271, etc.), and the target audience of CAs and assessees

### Requirement: Prompt content is versioned and auditable
The seeded prompts SHALL each carry a `version` string (e.g. `"v1.0"`) so that future prompt edits can be tracked distinctly from the initial seed.

#### Scenario: Version field present after seed
- **WHEN** the seed script runs successfully
- **THEN** each row in `prompts` has a non-null, non-empty `version` value

### Requirement: Seed script reports outcome
The script SHALL print a summary to stdout indicating how many rows were inserted or updated, and SHALL exit with code 0 on success and non-zero on failure.

#### Scenario: Successful seed exits cleanly
- **WHEN** the seed completes without error
- **THEN** stdout includes a line like "Seeded 5 prompts" and the process exits 0

#### Scenario: D1 connection failure
- **WHEN** the D1 binding is unavailable or credentials are missing
- **THEN** the script prints an error message to stderr and exits non-zero
