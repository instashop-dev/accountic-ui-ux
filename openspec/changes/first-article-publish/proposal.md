## Why

The AI pipeline (Phases 3–7) is fully deployed but has never produced a real article — D1 has no pipeline-generated posts, prompts are unseeded, and tasks 8.4/8.5 were skipped for this exact reason. Publishing one article end-to-end validates every stage of the pipeline in production, surfaces any integration gaps, and gives the blog its first AI-assisted piece of content on a high-intent Indian tax notice query.

## What Changes

- `scripts/seed-prompts.ts` — new one-shot script: inserts active prompts for all five pipeline stages (topic-discovery, outline-generation, article-generation, humanizer, publisher) into D1 `prompts` table; safe to re-run (upserts on `stage`)
- `scripts/trigger-article.ts` — new one-shot script: sends a single `stage: 'outline'` message directly to `blog-pipeline` queue for a pre-researched topic slug, bypassing topic-discovery for speed and control on the first run
- `docs/first-article-runbook.md` — new doc: step-by-step operator guide covering prompt seeding, topic selection rationale, queue trigger, admin queue review, approval, and post-publish verification checklist
- No existing source files modified — all changes are additive scripts and docs

## Capabilities

### New Capabilities

- `prompt-seeding`: One-shot D1 prompt seeder for all five pipeline stages — ensures workers have active prompts before any generation run
- `manual-topic-trigger`: Script to inject a specific pre-researched topic directly into the pipeline at the outline stage, bypassing topic-discovery for controlled first-run

### Modified Capabilities

- (none — no existing spec-level requirements change)

## Impact

- **D1 database:** `prompts` table gains five rows (one per stage); `topics` table gains one row for the seeded topic; `outlines`, `drafts`, `generation_jobs` rows created as pipeline executes
- **Cloudflare Queues:** `blog-pipeline` queue receives one message; downstream queues (`blog-humanize`, `blog-publish`) receive messages as pipeline progresses
- **Admin dashboard:** Draft appears in `/admin/queue` for human review and approval before publisher runs
- **Blog content:** One new MDX file committed to `src/content/blog/` via publisher worker (or manually from draft if publisher GitHub integration is not yet wired)
- **Anthropic API:** Estimated 4–6 Claude calls (outline, article, humanizer × 2 passes, quality check); within daily token budget
- **Dependencies:** No new npm packages
