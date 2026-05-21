## Context

The `topic-discovery` worker is the entry point of the blog automation pipeline. Every other pipeline stage (outline-generation, article-generation, humanizer) injects rich, structured context into its prompt via the existing `.replace('{{variable}}', value)` pattern. Topic discovery is the only stage that sends a single `{{count}}` variable — the AI generates ideas with zero awareness of what already exists.

At 3 topics/day the `topics` table accumulates ~1,095 rows/year across only 6 content pillars. Without coverage awareness the AI will increasingly generate semantically duplicate topics that pass the current exact-title dedup check.

Additionally, the dedup set is built exclusively from `topics.title`, leaving `posts.title` (manually-created content) unprotected.

## Goals / Non-Goals

**Goals:**
- Inject a compact, structured coverage brief into the topic-discovery prompt so the AI self-directs toward gaps
- Cover pillar balance (all-time counts) and semantic recency (90-day title window) in a single brief that stays small forever
- Expand the dedup union to include `posts.title` so manual posts protect their topic space
- Preserve exact-match dedup as a DB-level safety net — nothing removed, only augmented
- Keep the prompt template in the DB and admin-editable; code only injects raw data, strategy lives in the template

**Non-Goals:**
- Semantic similarity via embeddings or vector search
- Tracking human-rejected drafts as a negative signal (follow-on)
- Making the 90-day window a configurable admin setting (can be added later)
- Schema changes to the `topics` or `posts` tables

## Decisions

### Decision 1 — Two-section brief: counts + recency titles

The brief has two distinct sections serving different purposes:

```
Per-pillar topic counts (all-time, non-failed):
- Income Tax Notices: 47
- Faceless Assessment: 23
- DPDP Compliance: 6        ← AI sees gap
- ICAI Ethics: 11
- Case Law Notes: 19
- Firm Operations: 8

Recently covered topics (last 90 days):
- "Section 148 Reassessment Response Guide"
- "DPDP Act Compliance Checklist for CA Firms"
- ... (~270 titles at steady state)
```

**Counts** signal pillar saturation regardless of recency — a pillar with 50 all-time topics and none in the past 90 days is still more explored than one with 6. **Titles** give the AI semantic recency context to avoid near-twins within the rolling window.

Alternative considered: titles only (no counts). Rejected — the AI cannot infer relative pillar saturation from a list of recent titles alone, especially for a pillar that was heavily covered early but not recently.

### Decision 2 — 90-day time-based window (not count-based)

`WHERE created_at >= datetime('now', '-90 days')` is preferred over `ORDER BY created_at DESC LIMIT N` because:

- **Natural semantics**: "don't repeat topics from the last quarter" is easier to reason about and tune than a magic count
- **Self-calibrates**: if the cron cadence ever increases, the window naturally covers more titles without config change
- **Explicit budget**: at 3/day this yields ≤ 270 titles (~4K tokens) — well within budget

A hard cap of 300 titles (`LIMIT 300` on the recency query) is added as a safety net for manual pipeline triggers that could inflate the count.

### Decision 3 — Graceful degradation when `{{coverage_brief}}` is absent

The `.replace('{{coverage_brief}}', brief)` call is a no-op if the placeholder is absent from the active template. This means:

- Deploying the new code before running the migration is safe — the brief is built but discarded, old behavior preserved
- An admin who creates a custom prompt without the placeholder won't break the pipeline

### Decision 4 — Prompt template update via migration (new version, not UPDATE)

A new migration inserts a `topic-discovery` v2 prompt row with `is_active = 1` and sets the v1 row to `is_active = 0`. This is reversible via rollback migration without touching application code. Version history is preserved in the DB.

Alternative considered: UPDATE the existing row in place. Rejected — loses version history and makes rollback harder.

### Decision 5 — Dedup union with `posts` table

```sql
SELECT title FROM topics
UNION
SELECT title FROM posts
```

`UNION` (not `UNION ALL`) deduplicates any overlap between the two tables automatically. No schema change needed. The extra query is negligible on D1 at this data volume.

### Decision 6 — Exclude `status = 'failed'` topics from coverage brief

Failed topics never produced content, so they should not "occupy" topic space in the coverage map. Including them would cause the AI to avoid topic areas that were never actually published, gradually shrinking the addressable space for no benefit.

### Decision 7 — Index on `topics.created_at`

The 90-day recency query runs a range filter on `created_at`. Without an index, this is a full table scan. At ~1,000 rows this is fine for D1, but adding a migration-level index future-proofs the query. Added in the same migration as the prompt update.

## Risks / Trade-offs

**Prompt injection via topic titles**
Topic titles injected into the brief are AI-generated in prior runs, not user-supplied. The risk of adversarial injection is low. The system prompt's domain framing (CA-focused, Indian tax) provides a strong anchor.
→ *Mitigation*: Brief is rendered inside a clearly delimited section header. System prompt framing is maintained.

**Brief size spike from manual pipeline triggers**
If an operator manually triggers topic discovery many times in a day, the 90-day window could contain a burst. With the `LIMIT 300` cap, the brief is bounded at ~300 titles regardless.
→ *Mitigation*: `LIMIT 300` on the recency query.

**Admin changes prompt template, removes `{{coverage_brief}}`**
If an admin overwrites the template without the placeholder, the coverage brief is silently dropped and the old blind-generation behavior returns.
→ *Mitigation*: The admin prompts UI should document that `{{coverage_brief}}` is a supported variable. This is a documentation concern, not a code concern.

**Topics that were published but later deleted from GitHub**
If a post is deleted from the repo but remains in the `posts` table, it still occupies dedup space. This is existing behavior — not introduced by this change.

## Migration Plan

**Deploy order (forward):**
1. Deploy new `topic-discovery.ts` (adds brief injection + posts union in dedup)
2. Apply `migrations/007_coverage_brief.sql`:
   - Adds index on `topics.created_at`
   - Inserts `topic-discovery` v2 prompt with `{{coverage_brief}}`
   - Sets v1 `is_active = 0`

Step 1 before step 2 is safe: `.replace('{{coverage_brief}}', ...)` on a template without the placeholder is a no-op.

**Rollback:**
1. Apply `migrations/007_rollback.sql`: sets v1 `is_active = 1`, sets v2 `is_active = 0`, drops index
2. Revert `topic-discovery.ts` (or leave in place — graceful degradation means it still works with v1 template)

## Open Questions

- Should the coverage brief window (90 days) eventually become a `settings` row so operators can tune it without a code deploy? Current decision: hardcode it; add to settings if operators request it.
- Should the admin prompts UI explicitly list `{{coverage_brief}}` and `{{count}}` as supported variables with descriptions? Flagging for UX follow-on.
