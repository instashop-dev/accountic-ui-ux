# Spec: slug-path-guard

Slug validation before GitHub file path construction — prevents path traversal and malformed slug values from reaching the GitHub API.

## Requirements

### Requirement: Slug values are validated before file path construction
Before constructing a GitHub file path from a post slug, the system SHALL validate that the slug matches the pattern `/^[a-z0-9-]+$/`. Any slug that contains path separators (`/`), parent-directory sequences (`..`), or characters outside lowercase alphanumeric and hyphens SHALL be rejected.

This guard SHALL be applied in both:
- `src/workers/pipeline/publisher.ts` (before building `src/content/blog/<slug>.mdx`)
- `src/pages/admin/api/refresh.ts` (before building the same path for snapshot/GitHub operations)

#### Scenario: Valid slug passes guard
- **WHEN** a slug value of `my-blog-post-2026` is passed through the path guard
- **THEN** file path construction SHALL proceed normally

#### Scenario: Slug with path traversal sequence is rejected
- **WHEN** a slug value of `../../.env` is encountered before file path construction
- **THEN** the operation SHALL halt and log an error; no GitHub API call SHALL be made

#### Scenario: Slug with forward slash is rejected
- **WHEN** a slug value of `subdir/post` is encountered before file path construction
- **THEN** the operation SHALL halt and log an error

#### Scenario: Slug with uppercase letters is rejected
- **WHEN** a slug value of `My-Post` is encountered
- **THEN** the operation SHALL halt and log an error (slugs MUST be lowercase)

### Requirement: Slug guard failure is logged and surfaces as a pipeline error
When the path guard rejects a slug, the rejection SHALL be logged with the offending slug value (not the full constructed path), and the calling operation SHALL propagate an error that marks the associated job as failed in D1.

#### Scenario: Publisher logs and fails job on bad slug
- **WHEN** `publisher.ts` encounters an invalid slug
- **THEN** it SHALL log `Invalid slug rejected: <slug>` and throw an error that the job runner records as a failure

#### Scenario: Refresh route returns 400 on bad slug
- **WHEN** `refresh.ts` encounters an invalid slug during a manual refresh
- **THEN** it SHALL return HTTP 400 with body `{"error":"Invalid slug"}` and SHALL NOT call the GitHub API
