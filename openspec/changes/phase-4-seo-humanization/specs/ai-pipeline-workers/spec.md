## MODIFIED Requirements

### Requirement: Article-generation Worker produces full drafts and runs the quality gate
`src/workers/pipeline/article-generation.ts` SHALL export a Cloudflare Queue handler that reads an `outline_id`, fetches the outline and parent topic from D1, calls the Claude API to produce a full article in MDX format (with valid YAML frontmatter satisfying `src/lib/schema-validate.ts`), runs the quality gate via `src/lib/quality.ts`, and writes the result to a `drafts` D1 row with `status = 'ready'` (quality passed) or `status = 'failed'` (quality failed, with `error` JSON). It SHALL also write an idempotency record to `generation_jobs` using the outline's `input_hash`. On successful draft creation (`status = 'ready'`), the Worker SHALL dispatch a message to the `blog-humanize` queue with `{ "draft_id": "<id>" }` so that the humanizer runs before admin review. The Worker SHALL NOT dispatch directly to `blog-publish`. The Worker SHALL call `logEvent` from `src/lib/analytics.ts` for generation start, success (quality pass), quality failure, and idempotency-skip outcomes.

#### Scenario: Draft passes quality gate, dispatched to humanize queue
- **WHEN** Claude produces a valid MDX article that passes all quality checks
- **THEN** a `drafts` row is created with `status = 'ready'`, valid frontmatter, `generation_jobs` records updated to `status = 'done'`, and a message is dispatched to `blog-humanize` with `{ "draft_id": "<id>" }`

#### Scenario: Draft fails Zod validation and is quarantined
- **WHEN** Claude produces an article with a missing required frontmatter field
- **THEN** the `drafts` row is created with `status = 'failed'` and `error` contains the Zod validation error array as JSON

#### Scenario: Draft fails readability and is quarantined
- **WHEN** the quality gate returns a readability score below 70
- **THEN** the `drafts` row is created with `status = 'failed'` and `error` contains `{ "check": "readability", "score": <actual>, "threshold": 70 }`

#### Scenario: Idempotent retry skips re-generation
- **WHEN** the Worker receives a queue message for an `outline_id` that already has a `generation_jobs` row with `status = 'done'` and matching `input_hash`
- **THEN** the Worker returns without calling Claude and without creating a duplicate `drafts` row

#### Scenario: Failed draft is not dispatched to humanize queue
- **WHEN** the quality gate fails and `drafts.status` is set to `'failed'`
- **THEN** no message is dispatched to `blog-humanize`

### Requirement: Publisher Worker commits approved drafts to GitHub and updates D1
`src/workers/pipeline/publisher.ts` SHALL export a Cloudflare Queue handler that reads a `draft_id`, fetches the draft from D1 where `status = 'approved'` (set by the admin approval endpoint), constructs the target file path (`src/content/blog/<slug>.mdx`), injects internal links via `src/lib/linker.ts` into the draft content, generates and appends a JSON-LD schema block via `src/lib/seo-schema.ts`, commits the assembled file content to GitHub via the Contents REST API using `GITHUB_TOKEN`, and updates the `drafts` row to `status = 'published'` and the `posts` D1 table with a new row sourced as `'ai'`. If the GitHub API returns a non-2xx response, the Worker SHALL set `drafts.status = 'publish_failed'` and store the GitHub error body in `drafts.error`. The Worker SHALL call `logEvent` from `src/lib/analytics.ts` for publish start, success, and failure outcomes.

The `status = 'approved'` check is unchanged from Phase 3. The `approve.ts` admin endpoint sets `status = 'approved'` and dispatches to `blog-publish`; the publisher reads that status. No changes to `approve.ts` are required by Phase 4.

#### Scenario: Approved humanized draft with internal links and schema is committed to GitHub
- **WHEN** the publisher Worker receives a `draft_id` with `status = 'approved'`
- **THEN** the draft content (with injected internal links and appended JSON-LD block) is committed to `src/content/blog/<slug>.mdx` on the `main` branch and `drafts.status` is updated to `'published'`

#### Scenario: Draft with wrong status is rejected
- **WHEN** the publisher Worker receives a `draft_id` for a draft with `status != 'approved'`
- **THEN** the Worker logs the unexpected status and returns without committing to GitHub

#### Scenario: GitHub API error is recorded
- **WHEN** the GitHub Contents API returns a 422 (file already exists at the slug)
- **THEN** `drafts.status` is set to `'publish_failed'` and `drafts.error` contains the GitHub API response body

#### Scenario: Post row is created in D1 after publish
- **WHEN** the publisher Worker successfully commits to GitHub
- **THEN** a new row is inserted into `posts` with `source = 'ai'` and `status = 'published'`

#### Scenario: Internal links are injected before commit
- **WHEN** the publisher assembles the final MDX content
- **THEN** `findInternalLinks` and `injectInternalLinks` from `src/lib/linker.ts` are called before the GitHub API request, and `drafts.internal_links_added` is updated with the count

#### Scenario: JSON-LD schema block is appended before commit
- **WHEN** the publisher assembles the final MDX content
- **THEN** a `<script type="application/ld+json">` block from `src/lib/seo-schema.ts` is appended to the MDX body before the GitHub API request
