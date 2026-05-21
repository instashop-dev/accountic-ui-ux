## Context

Phases 3–7 delivered a fully deployed five-stage AI pipeline (topic-discovery → outline-generation → article-generation → humanizer → publisher) on Cloudflare Workers, with D1 for state, Queues for message passing, and an admin dashboard for review. The pipeline has never been run in production: the D1 `prompts` table is empty (workers will ack-and-skip without active prompts), no topics exist in `topics`, and tasks 8.4/8.5 were skipped because there were no AI-generated posts to test against.

The existing `src/lib/queue.ts` already exports typed message constructors (`outlineMessage(topic_id)`, etc.). The `src/blog-meta.ts` defines the six content pillars. The pipeline entry point (`src/workers/pipeline/index.ts`) routes messages by queue name and `stage` field.

This design covers the minimum work to get one article from research → D1 draft → admin approval → published MDX.

## Goals / Non-Goals

**Goals:**
- Seed all five pipeline-stage prompts into D1 `prompts` table in one idempotent operation
- Insert one pre-researched topic into D1 `topics` and enqueue an `outline-generation` message to start the pipeline
- Document the end-to-end operator workflow (seed → trigger → review → approve → verify)
- Keep the publisher worker's GitHub commit path as the publication mechanism (no workaround)

**Non-Goals:**
- Automating topic research (topic-discovery worker is not run for this change)
- Generating more than one article
- Modifying any existing pipeline worker logic
- Setting up Google Search Console or post-publish SEO tracking (future phase)

## Decisions

### Decision 1: Skip topic-discovery, inject at outline stage

**Choice:** `scripts/trigger-article.ts` sends an `outline-generation` message directly, inserting the topic into D1 first.

**Rationale:** Topic-discovery makes multiple Claude calls to brainstorm candidates, then ranks them — adding cost and latency for no benefit when we already know the target keyword. The outline-generation worker only needs a `topic_id` that resolves to a row in `topics`; we can synthesise that row directly.

**Alternative considered:** Run topic-discovery with a count of 1 and hope it picks the right topic. Rejected: non-deterministic and wasteful.

---

### Decision 2: Prompts seeded via a `wrangler d1 execute`-compatible TypeScript script

**Choice:** `scripts/seed-prompts.ts` uses the Wrangler D1 HTTP API (same pattern as `scripts/provision.ts`) — no new runtime dependency.

**Rationale:** The project already uses `wrangler d1 execute --remote` for migrations and `scripts/provision.ts` for D1 setup. Keeping the same pattern means no new auth surface and the script runs in CI if needed.

**Alternative considered:** A SQL migration file (`migrations/007_seed-prompts.sql`). Rejected: prompt content is long prose, hard to escape in raw SQL, and prompts will be iterated via the admin dashboard going forward — seeding via script is cleaner.

---

### Decision 3: Topic selection — "Section 148 Notice Reply: Step-by-Step Guide for Assessees"

**Rationale:**
- Section 148 (income escaping assessment) is one of the highest-anxiety notice types for assessees and CAs
- An existing post `section-148-reply-template.md` exists but is a template, not a guide — the pipeline article can target the informational "how to respond" query
- Pillar: `Income Tax Notices` — aligns with the primary traffic pillar
- No existing Accountic post covers the step-by-step procedural angle for Section 148

---

### Decision 4: Publisher commits MDX to GitHub via the existing publisher worker

**Choice:** Rely on the publisher worker's existing GitHub commit mechanism. If it fails (e.g. GitHub token not set), the draft remains `humanized` in the admin queue and can be exported manually.

**Rationale:** Avoids adding a manual MDX copy step that would bypass quality gates and frontmatter validation already built into the publisher.

**Risk fallback:** If the publisher worker's GitHub integration is not yet configured, the operator can copy the draft content from the admin queue UI and commit it manually — documented in the runbook.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Prompt quality produces a low-scoring draft (quality gate rejects it) | Runbook documents how to manually approve from admin queue; quality threshold can be lowered via D1 `settings` key `quality_threshold` |
| Daily token budget hit mid-pipeline | Set `daily_token_cap` high enough for one full run (~15k tokens); check budget in admin settings before triggering |
| Publisher GitHub token not configured | Documented fallback: copy draft from admin queue, commit manually |
| Humanizer strips domain-specific terms (e.g. "u/s 148") | Humanizer prompt includes an instruction to preserve Indian tax law citations — seeded in `seed-prompts.ts` |
| `wrangler queues send` CLI not available in all environments | `trigger-article.ts` uses the Wrangler API directly; can also trigger via the admin "manual generate" endpoint if wired |

## Migration Plan

1. Run `npm run db:seed-prompts` — seeds `prompts` table (safe to re-run)
2. Verify prompts visible at `/admin/settings` → Prompts tab
3. Run `npm run blog:trigger-article` with chosen title/pillar — inserts topic row, enqueues outline message
4. Monitor `/admin/jobs` for stage progression (outline → article → humanizer)
5. Review draft at `/admin/queue`, check quality score, approve
6. Publisher worker picks up approved draft, commits MDX to GitHub
7. CI build triggers, new article appears on live blog
8. Verify: check URL, JSON-LD schema, internal links

**Rollback:** If the published article needs to be removed, delete the MDX file via a direct git revert and redeploy. The D1 draft row can be set to `status = 'rejected'` via admin queue.

## Open Questions

- Is the GitHub token (`GITHUB_TOKEN` / `GH_TOKEN`) already set as a Wrangler secret in the pipeline worker? The publisher worker needs it to commit MDX. Needs confirmation before step 6 above.
- What quality score threshold is currently set in D1 `settings`? If it's above 0.7, a first-run article may not pass without prompt tuning.
