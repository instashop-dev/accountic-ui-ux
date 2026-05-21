## ADDED Requirements

### Requirement: Inject a pre-researched topic directly into the pipeline
The system SHALL provide a one-shot script that sends a single `stage: 'outline'` message to the `blog-pipeline` queue for a caller-supplied topic, bypassing the topic-discovery worker. This enables a controlled first run with a known high-value topic.

#### Scenario: Trigger article generation for a specific topic
- **WHEN** `npm run blog:trigger-article -- --title "..." --pillar "..."` is executed with a valid title and pillar
- **THEN** one message is enqueued to `blog-pipeline` with `stage: 'outline'` and the supplied topic metadata

#### Scenario: Missing required arguments
- **WHEN** the script is executed without `--title` or without `--pillar`
- **THEN** the script prints usage instructions to stderr and exits non-zero without enqueuing anything

#### Scenario: Topic persisted to D1 before enqueue
- **WHEN** the trigger script enqueues a topic
- **THEN** a corresponding row is inserted into the D1 `topics` table with `status = 'queued'` before the queue message is sent

### Requirement: Topic selection is research-backed
Before running the trigger script, an operator SHALL select the topic based on explicit keyword research criteria: search volume proxy (Google Trends or GSC data), absence of an existing post covering the same query, and alignment with one of the defined content pillars.

#### Scenario: Topic selection documented in runbook
- **WHEN** the first-article runbook is followed
- **THEN** it includes a topic selection section with the chosen title, target keyword, pillar, and rationale documented

### Requirement: Pipeline progress is observable after trigger
After the trigger script runs, an operator SHALL be able to monitor pipeline progress through the admin dashboard without any additional tooling.

#### Scenario: Draft appears in admin queue
- **WHEN** the pipeline completes outline → article → humanizer stages
- **THEN** the draft is visible in `/admin/queue` with status `humanized` and ready for human review

#### Scenario: Generation job visible in jobs page
- **WHEN** any pipeline stage completes or fails
- **THEN** a corresponding row appears in `/admin/jobs` with stage name, status, and timestamp
