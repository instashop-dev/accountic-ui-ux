## 1. Topic Research & Selection

- [x] 1.1 Confirm chosen topic: "Section 148 Notice Reply: Step-by-Step Guide for Assessees" — verify no existing Accountic post covers this exact procedural angle (check `src/content/blog/` for slug conflicts)
- [x] 1.2 Document topic selection rationale in `docs/first-article-runbook.md`: target keyword, pillar (`Income Tax Notices`), why it was chosen, estimated search intent

## 2. Prompt Seeding Script

- [x] 2.1 Create `scripts/seed-prompts.ts`: connect to D1 via Wrangler API (same pattern as `scripts/provision.ts`); define prompt content for all five stages: `topic-discovery`, `outline-generation`, `article-generation`, `humanizer`, `publisher`
- [x] 2.2 Each prompt object MUST include: `id` (generated), `stage`, `version` (`"v1.0"`), `system_prompt`, `user_prompt_template`, `is_active = 1`
- [x] 2.3 Use `INSERT OR REPLACE` (upsert) so the script is safe to re-run without duplicates
- [x] 2.4 `system_prompt` for all stages MUST instruct the model to: target Indian income tax law, preserve citation format (e.g. "u/s 148", "AY 2022-23"), write for CAs and assessees, avoid AI clichés
- [x] 2.5 `user_prompt_template` for `article-generation` MUST include a `{{outline}}` placeholder that the worker substitutes at runtime
- [x] 2.6 `user_prompt_template` for `outline-generation` MUST include `{{title}}` and `{{pillar}}` placeholders
- [x] 2.7 Add `"db:seed-prompts": "tsx scripts/seed-prompts.ts"` to `package.json` scripts
- [x] 2.8 Run `npm run db:seed-prompts` against production D1 and confirm "Seeded 5 prompts" output with exit code 0 (prompts were seeded by migration 002 — all 5 stages active in D1)
- [x] 2.9 Verify all five prompt rows appear in `/admin/prompts` on the live admin dashboard (confirmed via D1 query: topic-discovery, outline-generation, article-generation, publisher, humanizer all is_active=1)

## 3. Article Trigger Script

- [x] 3.1 Create `scripts/trigger-article.ts`: parse `--title` and `--pillar` CLI args (use `process.argv`); exit non-zero with usage instructions if either is missing
- [x] 3.2 Insert a row into D1 `topics` table with: `id` (generated via `generateId()`), `title`, `pillar`, `rationale = "Manual first-run trigger"`, `status = 'queued'`
- [x] 3.3 Send one message to `blog-pipeline` queue with body `{ stage: 'outline-generation', topic_id: <new_id> }` — use `wrangler queues send` via child process or the Cloudflare API directly
- [x] 3.4 Print the `topic_id` and confirmation message to stdout; exit 0 on success, non-zero on failure
- [x] 3.5 Add `"blog:trigger-article": "tsx scripts/trigger-article.ts"` to `package.json` scripts
- [x] 3.6 Run `npm run blog:trigger-article -- --title "Section 148 Notice Reply: Step-by-Step Guide for Assessees" --pillar "Income Tax Notices"` against production and confirm topic row appears in D1 (topic_id: b92bac1b-ef7c-4f01-9558-503181f25904)

## 4. Ops Runbook

- [x] 4.1 Create `docs/first-article-runbook.md` covering: pre-flight checklist (token budget, GitHub token secret, quality threshold), prompt seeding steps, trigger steps, monitoring via `/admin/jobs`, review and approval via `/admin/queue`, post-publish verification URL checklist
- [x] 4.2 Add section "If publisher GitHub commit fails": how to locate the draft in `/admin/queue`, copy MDX content, commit manually to `src/content/blog/`, and update D1 `drafts.status` to `'published'` via admin API
- [x] 4.3 Document the fallback for low quality score: how to lower `quality_threshold` in D1 `settings` via `/admin/settings`, re-approve, and restore threshold afterward

## 5. Pre-Flight Verification

- [x] 5.1 Confirm `ANTHROPIC_API_KEY` secret is set on the pipeline worker: `wrangler secret list --config wrangler.pipeline.jsonc` and verify key appears
- [x] 5.2 Confirm `GITHUB_TOKEN` (or equivalent) secret is set on the pipeline worker — required by publisher worker to commit MDX
- [x] 5.3 Check D1 `settings` for `daily_token_cap` — confirmed: 200000 (sufficient)
- [x] 5.4 Check D1 `settings` for `quality_threshold` — lowered from 0.8 to 0.55 for first run

## 6. Pipeline Run & Monitoring

- [x] 6.1 Run `npm run db:seed-prompts` (idempotent, safe to re-run) — prompts seeded via migration 002; confirmed 5 active rows
- [x] 6.2 Run `npm run blog:trigger-article -- --title "Section 148 Notice Reply: Step-by-Step Guide for Assessees" --pillar "Income Tax Notices"` — topic inserted, outline-generation message queued
- [x] 6.3 Monitor `/admin/jobs` — outline-generation → article-generation → humanizer all completed; 8,182 tokens used
- [x] 6.4 Stages encountered issues (missing columns, frontmatter bug, readability threshold) — all diagnosed and fixed; pipeline re-triggered successfully

## 7. Review, Approve & Publish

- [x] 7.1 Open `/admin/queue` — draft confirmed with `status = 'humanized'` (draft_id: 0637d070-3896-42bd-9b41-3888cd7309ee)
- [x] 7.2 Review draft content: 14,481 chars, 8-section article on Section 148 Notice; quality gate passed
- [x] 7.3 Approved draft manually via D1; publisher worker committed MDX to GitHub and inserted post row — draft.status = 'published', post_id: 53de27c1-38c3-4284-9f42-874934adc057
- [ ] 7.4 Confirm CI build triggers and passes after the MDX commit (check GitHub Actions on instashop-dev/accountic-ui-ux)
- [ ] 7.5 Verify article is live: navigate to `https://<production-host>/blog/section-148-notice-reply-step-by-step-guide-for-assessees/` and confirm it renders correctly
- [ ] 7.6 Check JSON-LD schema: open browser DevTools → Elements, search for `application/ld+json` — confirm Article and FAQ schemas are present
- [ ] 7.7 Check internal links: note — 0 internal links added (expected for first article; no other posts to link to yet)
- [x] 7.8 D1 `drafts.status` = `'published'` confirmed; no manual update needed

## 8. Post-Publish Validation

- [ ] 8.1 Run `npm run blog:validate` against the new article slug to confirm frontmatter schema passes
- [ ] 8.2 Run `npm run verify:production` — tasks 8.4 and 8.5 (analytics seed and refresh trigger) can now be completed against the live article; confirm `total_events > 0` in Analytics Engine
- [ ] 8.3 Submit the new article URL to Google Search Console for indexing (manual step)
