## Context

Two errors were found during admin panel testing:

1. **Refresh page DB error** — `D1_ERROR: no such column: last_refreshed_at`. Migration `006_refresh.sql` adds this column to `posts` and creates the `refresh_jobs` table, but it hasn't been applied to the local D1 database. The page renders but shows the error string to the user.

2. **Analytics nav link → 404** — `analytics.astro` is gated behind `ANALYTICS_ENABLED=true`. The nav link is hardcoded in every admin page (queue, jobs, settings, prompts, refresh) and always renders regardless of the gate, sending users to a 404 when the flag is unset.

## Goals / Non-Goals

**Goals:**
- Apply `006_refresh.sql` locally so Refresh page loads without error
- Enable analytics locally via `.dev.vars`
- Make the Analytics nav link conditional on `ANALYTICS_ENABLED` so it never appears when the gate is closed

**Non-Goals:**
- Extracting the nav into a shared Astro component (worthwhile refactor but separate scope)
- Fixing the analytics data queries themselves
- Any production deployment changes

## Decisions

**Read `ANALYTICS_ENABLED` in each admin page's frontmatter and pass it to the nav**

Rationale: The nav is copy-pasted across 5 admin pages with no shared component. Extracting a component is the right long-term fix but is scope-creep here. The minimal change is to add `const analyticsEnabled = cfEnv.ANALYTICS_ENABLED === 'true';` in each page's frontmatter and wrap the Analytics `<a>` tag in a conditional. This is mechanical and low-risk.

Alternative considered: Add a shared `AdminNav.astro` component. Cleaner, but touches more files and is a refactor, not a fix.

**Apply migration via wrangler CLI, not a code change**

The migration SQL already exists. The fix is a one-time `wrangler d1 migrations apply` command targeting the local database.

## Risks / Trade-offs

- **[Risk] Nav duplication means 5 files to edit** → Each edit is identical and mechanical; low error risk.
- **[Trade-off] `ANALYTICS_ENABLED` read in frontmatter requires `env` import** → All admin pages already use `env` from `cloudflare:workers`, so no new dependency.
