## Context

`src/blog-meta.ts` exports `PILLARS` as a TypeScript `const` tuple — the single source of truth for all blog category names. Every consumer (content validation via `z.enum(PILLARS)`, blog filter chips, topic-discovery pillar validation, coverage brief) derives from it automatically. The only exception is the AI generation prompt templates, which hardcode the pillar list as a literal JSON array inside the DB-stored `user_prompt_template` and `system_prompt` fields.

Currently active prompts with hardcoded 6-pillar lists:
- `prompt-topic-discovery-v2` (is_active=1) — lists pillars in user_prompt_template
- `prompt-article-generation-v1` (is_active=1) — lists pillars in frontmatter output schema
- `prompt-topic-discovery-v2` system_prompt — describes "six content pillars" in narrative

`outline-generation` and `humanizer` do not hardcode pillars (they receive `{{pillar}}` as a variable) and need no prompt updates.

There are currently **0 topics or posts** in D1 with `pillar = 'Firm Operations'`, making the removal a clean break with no data migration required.

## Goals / Non-Goals

**Goals:**
- Expand `PILLARS` from 6 to 9 entries, replacing `Firm Operations` with `CA Firm Automation` and adding `AI Tools for Indian CAs`, `GST Automation`, and `Audit Technology`
- Keep `blog-meta.ts` as the single source of truth — all consumers update automatically
- Update the two affected prompt templates via a new migration so the AI generates and validates topics in all 9 pillars
- Ensure rollback is safe and complete

**Non-Goals:**
- Adding new CSS tone/colour themes — tones are per-article (AI-assigned), not per-pillar; 6 tones serve any number of pillars
- Migrating existing `Firm Operations` data — none exists
- Changing the outline-generation or humanizer prompts — they use `{{pillar}}` as a passthrough variable
- Adding pillar-specific landing pages or navigation — out of scope

## Decisions

### Decision 1 — Hard-replace `Firm Operations`, not rename

We remove `'Firm Operations'` from PILLARS and add `'CA Firm Automation'` as a distinct new string (not an in-place rename).

Alternative considered: rename by updating every occurrence of the string in the DB. Rejected — it creates a SQL migration risk and offers no benefit since D1 has 0 rows using `'Firm Operations'`.

### Decision 2 — `blog-meta.ts` change ships with code deploy (not migration)

PILLARS is a TypeScript constant consumed at build time by `z.enum(PILLARS)`. It must be updated in source alongside the code deploy. The prompt migration (008) is a separate step that can be applied before or after the deploy — graceful because the code will accept the new pillar names from `blog-meta.ts` regardless of which prompt version is active.

### Decision 3 — Topic-discovery v3 and article-generation v2 in a single migration

Both affected prompts are updated in one migration file (`008_expand_pillars.sql`). Keeping them together ensures atomic rollback — one rollback file restores both.

### Decision 4 — System prompt for topic-discovery also updated

The `system_prompt` field in topic-discovery describes "six content pillars" by name. This is the AI's framing context. Leaving it as 6 while the user_prompt_template lists 9 would create a contradiction that confuses generation. The v3 row updates both fields.

### Decision 5 — New pillar descriptions in system prompt are India-specific

Each new pillar in the system prompt is described with India-specific context (GST, GSTN, IRP, SA standards, ICAI, TRACES) so the AI generates appropriately targeted content rather than generic global accounting articles.

## Risks / Trade-offs

**`Firm Operations` topics inserted between code deploy and migration apply**
If the code deploy goes live (removing `Firm Operations` from PILLARS) before the migration runs, any `Firm Operations` topics already in D1 (currently 0) would fail content validation. The window is small and the current count is 0.
→ *Mitigation*: Apply migration 008 in the same deployment window. Deploy order: code → migration.

**AI generates content for new pillars before outline/article prompts are fully aware**
The topic-discovery v3 prompt will start generating topics for the 4 new pillars. These topics flow to outline-generation (no pillar hardcoding — safe) and article-generation v2 (updated — safe after migration). If article-generation v1 is still active when a new-pillar topic reaches it, the AI may still produce valid content (it's instructed to use the passed `{{pillar}}` value) but its frontmatter schema guidance lists only 6 valid values.
→ *Mitigation*: Apply migration 008 before or immediately after code deploy. The topic-to-article pipeline has natural latency (queue processing) that provides a buffer.

**Rollback reactivates 6-pillar prompts but code still has 9 PILLARS**
If only the migration is rolled back without reverting `blog-meta.ts`, the pipeline will accept 9 pillars in validation but the prompts will generate only 6. Topics in the 3 new pillars would stall (inserted but never outlined/articled).
→ *Mitigation*: Rollback instructions explicitly require reverting both the migration AND `blog-meta.ts` together.

## Migration Plan

**Deploy order (forward):**
1. Update `src/blog-meta.ts` — add 3 new pillars, remove `Firm Operations`
2. Deploy code (Cloudflare Worker + Astro build)
3. Apply `migrations/008_expand_pillars.sql` — deactivates v2 topic-discovery + v1 article-generation, inserts v3 and v2 respectively

**Rollback:**
1. Apply `migrations/008_rollback.sql` — restores v2 topic-discovery + v1 article-generation as active
2. Revert `src/blog-meta.ts` to 6-pillar version
3. Redeploy

## Open Questions

- Should the `Firm Operations` pillar be retained in PILLARS (as a deprecated passthrough) for a grace period to protect any future topics added between now and deploy? Current answer: No — D1 count is 0, safe to remove immediately.
- Should `Audit Technology` content wait until the audit product feature ships, or should the blog establish authority early? Current answer: Add now — content authority builds slowly and there's no harm in early blog coverage.
