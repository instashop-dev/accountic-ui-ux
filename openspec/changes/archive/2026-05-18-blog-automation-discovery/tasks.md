## 1. Astro Architecture Analysis

- [x] 1.1 Read and document `astro.config.mjs`: integrations, adapter, site URL, font config
- [x] 1.2 Read and document `package.json`: all dependencies, devDependencies, and scripts
- [x] 1.3 Map the full `src/` directory tree to two levels deep
- [x] 1.4 Document the routing convention (file-based, SSG vs SSR boundaries, API routes)
- [x] 1.5 Document the middleware situation (confirm `src/middleware.ts` is absent)

## 2. Blog & Content System Analysis

- [x] 2.1 Read and document `src/content.config.ts`: full Zod schema, required vs optional fields, enum constraints
- [x] 2.2 Read and document `src/blog-meta.ts`: PILLARS and TONES enums, their values and significance
- [x] 2.3 Read and document `src/pages/blog/[...slug].astro`: `getStaticPaths()` pattern, render call
- [x] 2.4 Read and document `src/layouts/BlogPost.astro`: all features (TOC, progress bar, related posts, JSON-LD, CTA, sharing)
- [x] 2.5 Read and document `src/pages/blog/index.astro`: pillar filter, subscribe form, featured card logic
- [x] 2.6 Sample two existing blog posts and document their frontmatter patterns and content structure

## 3. Admin & Auth System Analysis

- [x] 3.1 Read and document `src/pages/login.astro`: current state, what is wired vs placeholder
- [x] 3.2 Confirm absence of `src/middleware.ts` and document implications for protected routes
- [x] 3.3 List any environment variables related to auth (check `.env.example` and `.dev.vars`)

## 4. Cloudflare Setup Analysis

- [x] 4.1 Read and document `wrangler.jsonc`: compatibility date, bindings, observability, asset config
- [x] 4.2 Read and document `src/pages/api/capture.ts`: request shape, validation, send_email usage, response format
- [x] 4.3 Confirm absence of D1, KV, R2, Queues, and Cron bindings and document implications

## 5. Deployment Pipeline Analysis

- [x] 5.1 Document the build and deploy scripts from `package.json`
- [x] 5.2 Confirm absence of `.github/workflows/` and document implications for automated publishing
- [x] 5.3 Document the full build sequence (astro build → dist/ → wrangler deploy)

## 6. Design System Analysis

- [x] 6.1 Read and document `src/styles/global.css`: all CSS custom properties (colors, spacing, shadows, radii)
- [x] 6.2 Document the tone-driven styling system: how each tone maps to gradient, chip, avatar, and border styles
- [x] 6.3 Document responsive breakpoints and utility classes (`.container`, `.btn`, `.eyebrow`, `.lede`)
- [x] 6.4 Document the typography scale and font loading strategy

## 7. Utilities & Components Analysis

- [x] 7.1 Read and document each of the five components in `src/components/`
- [x] 7.2 Read and document `src/consts.ts`
- [x] 7.3 Confirm absence of `src/lib/` and `src/utils/` directories; document recommended locations for new utilities

## 8. Integration Strategy

- [x] 8.1 Enumerate all files that MUST NOT be modified (frozen set)
- [x] 8.2 Enumerate all new directories to be created and their purposes
- [x] 8.3 Define the content contract: how generated frontmatter must satisfy the Zod schema
- [x] 8.4 Define the taxonomy contract: how the AI pipeline must respect PILLARS and TONES enums
- [x] 8.5 Identify CI/CD prerequisite for the automated publish phase

## 9. File Modification Plan

- [x] 9.1 Categorise every anticipated file change across all future phases as MODIFY, ADD, or DO NOT MODIFY
- [x] 9.2 For each MODIFY entry, document the specific addition (e.g., new binding in `wrangler.jsonc`, new script in `package.json`)
- [x] 9.3 For each ADD entry, document the new path and its role in the subsystem
- [x] 9.4 Confirm that no existing Astro page, layout, component, or style file is in the MODIFY list

## 10. Risk Analysis

- [x] 10.1 Document the auth risk: no admin route protection exists; state mitigation
- [x] 10.2 Document the no-CI/CD risk: automated publishing requires a workflow; state prerequisite
- [x] 10.3 Document the build-time risk: `getStaticPaths()` re-runs on every build; state monitoring threshold
- [x] 10.4 Document the content schema risk: generated frontmatter must pass Zod validation or build fails; state safeguard
- [x] 10.5 Document at least two additional risks identified during codebase analysis (e.g., hardcoded email recipient, no `src/lib/` convention)
- [x] 10.6 Assign severity (High/Medium/Low) to each risk

## 11. Open Questions & Document Assembly

- [x] 11.1 List unresolved questions (MDX vs MD for generation, single vs separate Worker for admin, Cloudflare account details)
- [x] 11.2 Assemble all findings into `/docs/blog-automation-analysis.md` using the structure: Executive Summary → per-area findings → Integration Strategy → File Modification Plan → Risk Analysis → Open Questions
- [x] 11.3 Verify the document path matches the deliverable specified in the proposal (`docs/blog-automation-analysis.md`)
- [x] 11.4 Confirm no files outside `docs/` and `openspec/changes/blog-automation-discovery/` were modified during discovery
