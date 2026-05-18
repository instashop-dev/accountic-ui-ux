## Context

Accountic is an Astro 6.1 + Cloudflare Workers site serving Indian Chartered Accountants. The blog system is fully operational: 9 posts, a Zod-typed content collection schema, a feature-rich `BlogPost.astro` layout (TOC, reading progress, related posts, JSON-LD, tone-driven gradients), and a pillar/tone classification system defined in `src/blog-meta.ts`. No admin backend, no database, and no CI/CD exist yet. Deployment is manual (`npm run deploy`). This design phase is **read-only**: its sole deliverable is `/docs/blog-automation-analysis.md`.

## Goals / Non-Goals

**Goals:**

- Produce a verified, codebase-grounded integration strategy document for the AI blogging subsystem
- Identify every file that must be modified, added, or kept frozen across all future implementation phases
- Surface integration risks before any infrastructure or code is written
- Validate that the existing content schema, design system, and Cloudflare bindings can absorb the subsystem additively

**Non-Goals:**

- Creating any Cloudflare infrastructure (D1, KV, R2, Queues, Cron triggers)
- Writing or modifying any Astro source files
- Designing the AI pipeline (topic discovery, outline, article generation, humanization)
- Designing the admin dashboard UI or auth middleware
- Implementing or testing anything

## Decisions

**D1 — Single deliverable is a markdown analysis document, not an OpenSpec spec file**

The discovery output is a human-readable reference document consumed by the development team and subsequent OpenSpec phases. A spec file would impose schema constraints on analysis prose; a markdown doc in `/docs/` is more legible and is the format established by the existing `docs/blog-automation/` directory.

*Alternative considered:* Writing the analysis directly into the OpenSpec spec for `blog-automation-analysis`. Rejected because analysis prose (tables, lists, risk registers) does not map cleanly to a behaviour spec, and conflating the two would make future specs harder to reason about.

**D2 — Additive integration only; existing production files are frozen**

The codebase exploration confirmed that `src/content.config.ts`, `src/layouts/BlogPost.astro`, `src/styles/global.css`, and `src/components/` are production-stable and relied upon by the live site. Any modification risks layout regressions or schema build failures. All new code goes into isolated namespaces (`src/pages/admin/`, `src/pages/api/blog/`, `src/lib/`, `src/workers/`) that do not import from the frozen set in ways that could cause circular dependencies or schema drift.

*Alternative considered:* Extending `src/content.config.ts` to add new optional fields for automation metadata. Deferred to the Astro Integration phase once the pipeline contract is stable.

**D3 — No CI/CD created during discovery**

GitHub Actions are not present. The discovery document will flag this as a prerequisite for the publish automation phase (Phase 4) and recommend a minimal workflow (`build → wrangler deploy`) be added before automated publishing is enabled. Adding it now would be premature and outside scope.

**D4 — Frontmatter schema is the content contract**

The Zod schema in `src/content.config.ts` enforces every generated post's frontmatter at build time. The AI pipeline must emit frontmatter that satisfies this schema exactly (required: `title`, `description`, `pubDate`, `pillar`, `tone`; optional: `updatedDate`, `heroImage`, `author`, `readTime`, `featured`). Any generated post that fails schema validation will cause `astro build` to fail and block deployment — making schema compliance the natural quality gate.

**D5 — Tone and pillar enums in `src/blog-meta.ts` are the authoritative taxonomy**

The 6 pillars and 6 tones defined there drive the entire visual system (gradient colours, chip styles, related-post grouping). The AI pipeline must constrain its output to these enums. New pillars or tones may only be added by modifying `blog-meta.ts` in a dedicated, reviewed change.

## Risks / Trade-offs

**[R1] No CI/CD means automated publishing requires a manual trigger or a separate Cloudflare Worker commit step** → Mitigation: Document as a hard prerequisite in the analysis; Phase 4 (Astro Integration) must include a GitHub Actions workflow before the publish pipeline is activated.

**[R2] `getStaticPaths()` in `pages/blog/[...slug].astro` re-runs on every build; a large corpus increases build time** → Mitigation: Monitor build time as post count grows; consider incremental builds or partial hydration if build exceeds 3 minutes. Flag in analysis.

**[R3] The login page exists as UI-only stub with no backend auth; any admin routes added before auth is implemented are publicly accessible** → Mitigation: Admin routes must be protected by middleware from day one of the admin dashboard phase (Phase 5). Discovery analysis must document this risk explicitly and call out that no admin routes should be merged without accompanying auth middleware.

**[R4] Cloudflare `send_email` binding (`SIGNUP_NOTIFY`) hardcodes the destination address in `wrangler.jsonc`** → No mitigation needed for discovery; flag in analysis for the Infrastructure phase to use environment-bound configuration instead.

**[R5] No existing `src/lib/` or `src/utils/` directory; new shared utilities have no established home** → Mitigation: Recommend `src/lib/` as the canonical location in the analysis document; subsequent phases follow this convention.

## Migration Plan

This change requires no migration. The deliverable is a new documentation file. Rollback is `git revert` of the single commit that adds `/docs/blog-automation-analysis.md`.

## Open Questions

- **OQ1:** Should the AI pipeline write MDX files (`.mdx`) or plain Markdown (`.md`)? Both are accepted by the content collection loader. MDX enables embedded Astro components (e.g., CTA islands) but adds generation complexity. Decision deferred to the AI Pipeline phase.
- **OQ2:** Will the admin dashboard share the existing Cloudflare Worker entrypoint or run as a separate Worker? Architecture decision deferred to the Infrastructure phase.
- **OQ3:** Is there an existing Cloudflare project/account name for R2 and D1 provisioning? Needed before Infrastructure phase begins.
