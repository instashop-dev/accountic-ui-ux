## Why

Accountic needs to publish high-quality, SEO-optimised blog content consistently without manual authoring overhead. Before any AI blogging infrastructure is built, the team needs a verified, codebase-grounded integration strategy so that implementation phases stay additive and safe — this discovery change produces exactly that artifact.

## What Changes

- Introduces a new analysis document at `/docs/blog-automation-analysis.md` that records the verified state of the existing Astro + Cloudflare architecture and prescribes a safe integration path for the AI blogging subsystem
- No production source files are modified; no infrastructure is created; no workers are added
- The document becomes the mandatory reference for all subsequent implementation phases (infrastructure, AI pipeline, Astro integration, admin dashboard)

## Capabilities

### New Capabilities

- `blog-automation-analysis`: Discovery analysis covering Astro architecture, blog content system, admin/auth stub, Cloudflare setup, deployment pipeline, design system, and existing utilities — together with an integration strategy, file modification plan, and risk analysis

### Modified Capabilities

<!-- None — no existing specs exist and no production requirements are changing -->

## Impact

- **Files written:** `docs/blog-automation-analysis.md` (new, documentation only)
- **Files read (analysis input):** `astro.config.mjs`, `wrangler.jsonc`, `package.json`, `src/content.config.ts`, `src/blog-meta.ts`, `src/styles/global.css`, `src/pages/blog/`, `src/layouts/BlogPost.astro`, `src/pages/api/capture.ts`, `src/pages/login.astro`
- **Production code:** zero modifications
- **Dependencies:** none added or removed
- **APIs/bindings:** unchanged
- **Deployment pipeline:** unchanged
