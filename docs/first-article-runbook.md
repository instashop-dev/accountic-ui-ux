# First Article Runbook — End-to-End Pipeline Run

This runbook walks through publishing the first AI-generated article on the Accountic blog.
Follow steps in order. Each step has a verification checkpoint.

---

## Topic Selection

**Chosen topic:** Section 148 Notice Reply: Step-by-Step Guide for Assessees

| Field | Value |
|-------|-------|
| Target keyword | "how to reply to Section 148 notice" |
| Content pillar | Income Tax Notices |
| Target audience | Indian assessees and CAs receiving u/s 148 reassessment notices |
| Search intent | Informational — procedural "how to respond" query |
| Rationale | Section 148 (income escaping assessment) is one of the highest-anxiety notice types. The existing `section-148-reply-template.md` is a template only — this article targets the step-by-step procedural angle, which no existing post covers. High-intent query with clear CA and assessee audience. |
| Slug | `section-148-notice-reply-step-by-step-guide` |
| Slug conflict check | ✓ No conflict with existing `src/content/blog/` files |

---

## Pre-Flight Checklist

Complete all checks before running any pipeline commands.

### 1. Verify Wrangler secrets on the pipeline worker

```bash
npx wrangler secret list --config wrangler.pipeline.jsonc
```

Confirm these secrets are present:

- [ ] `ANTHROPIC_API_KEY` — required by all AI pipeline stages
- [ ] `GITHUB_TOKEN` — required by the publisher worker to commit MDX to GitHub
- [ ] `ADMIN_TOKEN` — required for admin dashboard access

If `GITHUB_TOKEN` is missing, skip to **"If publisher GitHub commit fails"** below before proceeding.

### 2. Check daily token budget

```bash
npx wrangler d1 execute BLOG_DB --remote \
  --command "SELECT value FROM settings WHERE key='daily_token_cap'"
```

The value must be at least `50000` for one full pipeline run. If lower or missing, set it:

```bash
npx wrangler d1 execute BLOG_DB --remote \
  --command "INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_token_cap', '100000')"
```

### 3. Check quality threshold

```bash
npx wrangler d1 execute BLOG_DB --remote \
  --command "SELECT value FROM settings WHERE key='quality_threshold'"
```

Note the value. If above `0.65`, the first-run article may fail the quality gate on an untested prompt set.
See **"If quality score is too low"** below for the fallback.

### 4. Check emergency stop is off

```bash
npx wrangler d1 execute BLOG_DB --remote \
  --command "SELECT value FROM settings WHERE key='emergency_stop'"
```

Value must be `'false'` or the key must not exist. If `'true'`, reset it:

```bash
npx wrangler d1 execute BLOG_DB --remote \
  --command "INSERT OR REPLACE INTO settings (key, value) VALUES ('emergency_stop', 'false')"
```

---

## Step 1 — Seed Pipeline Prompts

Seeds all four AI pipeline stages (topic-discovery, outline-generation, article-generation, humanizer)
with production-quality prompts. Safe to re-run (upserts on ID).

**Required env vars:** `CF_API_TOKEN`, `CF_ACCOUNT_ID`

```bash
CF_API_TOKEN=<your_token> CF_ACCOUNT_ID=<your_account_id> npm run db:seed-prompts
```

Expected output:
```
📝 Accountic — D1 Prompt Seeder
──────────────────────────────────────────────────────────────
  Seeding [topic-discovery] (v1.0)... ✓
  Seeding [outline-generation] (v1.0)... ✓
  Seeding [article-generation] (v1.0)... ✓
  Seeding [humanizer] (v1.0)... ✓
──────────────────────────────────────────────────────────────

✓ Seeded 4 prompts successfully.
```

**Checkpoint:** Open `/admin/prompts` on the live dashboard. Confirm four rows appear with `is_active = 1`.

---

## Step 2 — Trigger the Article

Inserts the topic into D1 and sends one `outline-generation` message to start the pipeline.

**Required env vars:** `CF_API_TOKEN`, `CF_ACCOUNT_ID`

```bash
CF_API_TOKEN=<your_token> CF_ACCOUNT_ID=<your_account_id> \
  npm run blog:trigger-article -- \
    --title "Section 148 Notice Reply: Step-by-Step Guide for Assessees" \
    --pillar "Income Tax Notices"
```

Expected output:
```
🚀 Accountic — Manual Article Trigger
────────────────────────────────────────────────────────────
Title  : Section 148 Notice Reply: Step-by-Step Guide for Assessees
Pillar : Income Tax Notices

Step 1/2 — Inserting topic into D1...
  ✓ Topic inserted: <uuid>

Step 2/2 — Enqueuing outline-generation message...
  ✓ Message sent to blog-pipeline queue

────────────────────────────────────────────────────────────
✓ Article trigger complete

  topic_id : <uuid>
  title    : Section 148 Notice Reply: Step-by-Step Guide for Assessees
  pillar   : Income Tax Notices
```

Save the `topic_id` from the output — useful for debugging if any stage fails.

**Checkpoint:**
```bash
npx wrangler d1 execute BLOG_DB --remote \
  --command "SELECT id, title, status FROM topics ORDER BY created_at DESC LIMIT 1"
```
The topic should appear with `status = 'queued'` (the outline worker will update it to `'outlining'`).

---

## Step 3 — Monitor Pipeline Progress

Open `/admin/jobs` and watch for job rows to appear. The pipeline runs asynchronously through
Cloudflare Queues — each stage typically completes within 2–5 minutes.

Expected sequence:

| Stage | Status progression |
|-------|-------------------|
| `outline-generation` | `pending` → `completed` |
| `article-generation` | `pending` → `completed` |
| `humanizer` | `pending` → `completed` |

Total expected time: ~10–15 minutes end-to-end.

**If a stage shows `failed`:**
1. Open the job row in `/admin/jobs` and read the `error` column
2. Common causes:
   - `No active prompt found` → re-run `npm run db:seed-prompts`
   - `Token budget exceeded` → increase `daily_token_cap` (Step Pre-Flight #2)
   - `AI call failed` → check `ANTHROPIC_API_KEY` secret is set
3. Re-trigger from the failed stage:
   ```bash
   # Re-trigger outline (if outline-generation failed)
   npx wrangler queues send blog-pipeline \
     --message-body '{"stage":"outline-generation","topic_id":"<topic_id>"}'

   # Re-trigger article (if article-generation failed — use outline_id from D1)
   npx wrangler queues send blog-pipeline \
     --message-body '{"stage":"article-generation","outline_id":"<outline_id>"}'

   # Re-trigger humanizer (if humanizer failed — use draft_id from D1)
   npx wrangler queues send blog-humanize \
     --message-body '{"stage":"humanizer","draft_id":"<draft_id>"}'
   ```

---

## Step 4 — Review and Approve

1. Open `/admin/queue`
2. Find the draft with title "Section 148 Notice Reply: Step-by-Step Guide for Assessees"
3. Verify `status = 'humanized'`
4. Review the draft content for:
   - [ ] Indian tax law accuracy — verify all statutory references (u/s 148, AY year, CBDT circulars)
   - [ ] Citation format — must use `u/s 148`, not "Section 148" or "sec. 148" inconsistently
   - [ ] Internal links — 3–5 `<!-- INTERNAL_LINK: ... -->` comments should be present (linker worker injects these)
   - [ ] FAQ section — should have 3–5 practical questions with concise answers
   - [ ] Quality score — check the quality report; must meet the `quality_threshold` in settings
5. Click **Approve** — the publisher worker picks it up and commits the MDX file to GitHub

---

## Step 5 — Verify Publication

Once approved, the publisher worker:
1. Validates the frontmatter schema
2. Injects JSON-LD schema blocks (Article, FAQ, Breadcrumb)
3. Commits the MDX file to `src/content/blog/section-148-notice-reply-step-by-step-guide.mdx`
4. Updates D1 `drafts.status` to `'published'`

CI builds automatically on the commit. Allow 3–5 minutes for deployment.

**Verification checklist:**
- [ ] Article live at `https://<production-host>/blog/section-148-notice-reply-step-by-step-guide/`
- [ ] JSON-LD present: DevTools → Elements → search `application/ld+json`; confirm Article and FAQ schemas
- [ ] Internal links: at least 3 links to other Accountic posts in the article body
- [ ] `/admin/queue` shows draft no longer in pending state (status = `published`)

```bash
# Validate frontmatter schema
npm run blog:validate -- section-148-notice-reply-step-by-step-guide

# Full production verification (completes previously-skipped tasks 8.4 and 8.5)
PRODUCTION_HOST=https://... ADMIN_TOKEN=... CF_API_TOKEN=... CF_ACCOUNT_ID=... \
  npm run verify:production
```

---

## Step 6 — Submit to Google Search Console

1. Open [Google Search Console](https://search.google.com/search-console) for the Accountic property
2. Use the URL Inspection tool → paste the article URL
3. Click **Request Indexing**

---

## Fallbacks

### If publisher GitHub commit fails

The publisher worker requires `GITHUB_TOKEN` to commit MDX to the repo. If the commit fails:

1. Open `/admin/queue` → find the draft → click to view full content
2. Copy the MDX content from the draft body
3. Create the file manually:
   ```
   src/content/blog/section-148-notice-reply-step-by-step-guide.mdx
   ```
4. Commit and push to `main` — CI builds automatically
5. Update D1 to mark the draft published:
   ```bash
   npx wrangler d1 execute BLOG_DB --remote \
     --command "UPDATE drafts SET status='published', updated_at=datetime('now') WHERE slug='section-148-notice-reply-step-by-step-guide'"
   ```

### If quality score is too low

If the draft fails the quality gate (score below `quality_threshold`):

1. Note the current threshold:
   ```bash
   npx wrangler d1 execute BLOG_DB --remote \
     --command "SELECT value FROM settings WHERE key='quality_threshold'"
   ```
2. Temporarily lower it in `/admin/settings` (or via D1 command):
   ```bash
   npx wrangler d1 execute BLOG_DB --remote \
     --command "INSERT OR REPLACE INTO settings (key, value) VALUES ('quality_threshold', '0.50')"
   ```
3. Re-approve the draft in `/admin/queue`
4. After publishing, restore the threshold:
   ```bash
   npx wrangler d1 execute BLOG_DB --remote \
     --command "INSERT OR REPLACE INTO settings (key, value) VALUES ('quality_threshold', '<original_value>')"
   ```
5. For future runs, improve the prompts via `/admin/prompts` and re-run `npm run db:seed-prompts`

### If the humanizer strips tax citations

If the published article has incorrect citation formatting (e.g. "Section 148" instead of "u/s 148"):
1. Open `/admin/prompts` → humanizer stage → edit the system prompt
2. Add an explicit example of the citation format to the PRESERVE section
3. Re-seed: `npm run db:seed-prompts`
4. For the current article: edit the MDX file directly and push a fix commit
