## Why

The topic-discovery worker generates blog ideas with no awareness of what has already been written. Exact-title deduplication catches verbatim repeats but misses semantically identical topics with different wording — a near-certainty as the topic backlog grows (3 topics/day × 365 days = ~1,095 topics in a narrow 6-pillar domain). Additionally, the current dedup only queries the `topics` table, so manually-created posts in the `posts` table have no protection against being re-covered by AI generation.

## What Changes

- **New `{{coverage_brief}}` template variable** injected into the `topic-discovery` prompt at runtime, containing per-pillar topic counts (all-time) and all AI-generated topic titles from the last 90 days.
- **Prompt template updated** to use the coverage brief editorially — directing the AI to identify gaps and prioritise under-covered pillars rather than generating into the void.
- **Dedup query expanded** to union `topics.title` with `posts.title`, so manually-created posts also block AI re-coverage.
- **Graceful empty-state handling** so the first run (no existing topics) works without errors.

## Capabilities

### New Capabilities

- `topic-overlap-prevention`: Constructs a structured coverage brief from the D1 database at runtime and injects it into the topic-discovery prompt, enabling the AI to generate editorially-aware topics that fill coverage gaps rather than repeat existing content.

### Modified Capabilities

*(none — no existing spec-level behavior changes)*

## Impact

- **`src/workers/pipeline/topic-discovery.ts`** — adds two SQL queries and a `.replace()` call before the AI invocation; existing dedup logic and error handling paths unchanged.
- **`prompts` table (D1)** — `user_prompt_template` for `topic-discovery` stage updated via a new migration; the template remains admin-editable with no code change required to retune strategy.
- **`migrations/`** — one new migration to update the default prompt template and add a `{{coverage_brief}}` placeholder.
- **No new tables, queues, or external services required.**
- **Existing exact-match dedup is preserved** as a safety net (DB-level `UNIQUE` constraint + in-memory set check).
