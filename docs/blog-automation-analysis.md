# Accountic — Blog Automation Integration Analysis

**Phase:** Discovery (read-only)  
**Date:** 2026-05-18  
**Deliverable for:** OpenSpec change `blog-automation-discovery`  
**Status:** Approved for use as reference in all subsequent implementation phases

---

## Executive Summary

Accountic is an Astro 6.1 + Cloudflare Workers marketing and blog site for an AI-powered Income Tax notice drafting product targeting Indian Chartered Accountants. The codebase is production-stable, well-typed, and uses a consistent design system. The blog content system is fully operational (9 posts, Zod-typed schema, rich layout) and can absorb AI-generated content additively with zero structural changes to existing files.

**Safe to add, no existing file changes required:**
- New `.md` or `.mdx` files in `src/content/blog/` (served automatically)
- New directories: `src/lib/`, `src/pages/admin/`, `src/pages/api/blog/`, `src/workers/`
- New `wrangler.jsonc` bindings (D1, KV, R2, Queues, Cron — additive keys only)
- New `package.json` scripts (additive)

**Hard constraints:**
- `src/content.config.ts` Zod schema is the build-time quality gate — generated posts must satisfy it exactly
- `src/blog-meta.ts` PILLARS and TONES enums are the authoritative content taxonomy — the AI pipeline must constrain output to these values
- No CI/CD exists — automated publishing requires a GitHub Actions workflow before it can be activated
- Admin routes must ship with auth middleware from day one

---

## 1. Astro Architecture

**Source file:** `astro.config.mjs`

```js
export default defineConfig({
  site: 'https://accountic.com',
  integrations: [mdx(), sitemap()],
  fonts: [{
    provider: fontProviders.google(),
    name: 'Inter',
    cssVariable: '--font-sans',
    fallbacks: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
    weights: [300, 400, 500, 600, 700],
    styles: ['normal'],
  }],
  adapter: cloudflare(),
});
```

| Property | Value |
|---|---|
| Astro version | 6.1.9 |
| Site URL | `https://accountic.com` |
| Adapter | `@astrojs/cloudflare` (Workers runtime) |
| Integrations | `@astrojs/mdx`, `@astrojs/sitemap` |
| Font | Inter via Google Fonts, CSS variable `--font-sans` |
| MDX | Enabled — Astro components can be embedded in blog posts |
| Sitemap | Auto-generated via integration |

**Source directory tree (`src/`, 2 levels):**

```
src/
├── assets/              # Static images (blog placeholders, og-default.png)
├── blog-meta.ts         # PILLARS and TONES enum definitions
├── components/
│   ├── BaseHead.astro   # SEO/meta head (GA4, OG, canonical, Font preload)
│   ├── Footer.astro     # 4-column footer (brand, Product, Company, Legal)
│   ├── FormattedDate.astro  # <time> wrapper with en-us locale formatting
│   ├── Header.astro     # Fixed glassmorphic pill nav
│   └── HeaderLink.astro # Active-state-aware nav link
├── consts.ts            # SITE_TITLE = 'Accountic', SITE_DESCRIPTION
├── content/
│   └── blog/            # 9 markdown blog posts (*.md)
├── content.config.ts    # Content collection schema (Zod)
├── layouts/
│   ├── BlogPost.astro   # Full-featured article layout
│   └── PageLayout.astro # Generic page template
├── pages/
│   ├── api/
│   │   └── capture.ts   # POST /api/capture — email notification via send_email
│   ├── blog/
│   │   ├── index.astro  # Blog hub (pillar filter, featured card, subscribe)
│   │   └── [...slug].astro  # Dynamic article routing (SSG via getStaticPaths)
│   ├── index.astro      # Homepage
│   ├── login.astro      # Auth UI stub (no backend)
│   ├── careers.astro, contact.astro, dpa.astro, privacy.astro, security.astro, terms.astro
└── styles/
    └── global.css       # Design system tokens and utilities
```

**Routing convention:**
- File-based routing (Astro standard)
- All pages use `export const prerender = true` (default SSG) except `src/pages/api/capture.ts` which sets `export const prerender = false` (SSR, runs in Worker)
- `pages/blog/[...slug].astro` uses `getStaticPaths()` — generates one static page per blog post at build time
- `src/middleware.ts`: **absent** — no middleware layer exists

**Middleware status:** Confirmed absent. No `src/middleware.ts` file exists at the project root or inside `src/`. Any admin route protection must be implemented as new middleware before admin pages are deployed.

---

## 2. Blog & Content System

### 2.1 Content Schema

**Source file:** `src/content.config.ts`

```ts
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title:       z.string(),                           // required
      description: z.string(),                           // required
      pubDate:     z.coerce.date(),                      // required
      updatedDate: z.coerce.date().optional(),           // optional
      heroImage:   z.optional(image()),                  // optional — Astro image()
      pillar:      z.enum(PILLARS),                      // required — must be exact enum value
      author:      z.string().default('DPS & Co.'),      // optional (defaults)
      readTime:    z.number().int().positive().default(5), // optional (defaults)
      tone:        z.enum(TONES).default('emerald'),     // optional (defaults)
      featured:    z.boolean().default(false),           // optional (defaults)
    }),
});
```

**Generated post frontmatter MUST include:** `title`, `description`, `pubDate`, `pillar`  
**Generated post frontmatter MAY include:** `updatedDate`, `heroImage`, `author`, `readTime`, `tone`, `featured`  
**Build failure condition:** Any frontmatter field that is required but missing, or any `pillar`/`tone` value not in the respective enum, will cause `astro build` to fail.

### 2.2 Taxonomy Enums

**Source file:** `src/blog-meta.ts`

```ts
export const PILLARS = [
  'Income Tax Notices',
  'Faceless Assessment',
  'DPDP Compliance',
  'ICAI Ethics',
  'Case Law Notes',
  'Firm Operations',
] as const;

export const TONES = ['emerald', 'amber', 'rose', 'sky', 'violet', 'stone'] as const;
```

Each pillar maps to a filter chip on the blog index and groups related posts. Each tone drives the article hero gradient, pillar chip colour, author avatar gradient, and related-post card border. These enums are the **authoritative taxonomy** — the AI pipeline must select values only from these lists.

### 2.3 Blog Post Routing

**Source file:** `src/pages/blog/[...slug].astro`

```ts
export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.id },
    props: post,
  }));
}
const post = Astro.props;
const { Content, headings } = await render(post);
```

- Each `.md` or `.mdx` file in `src/content/blog/` automatically gets a route at `/blog/<filename-without-extension>`
- `headings` is passed to `BlogPost.astro` to populate the in-article TOC
- `getStaticPaths()` re-runs on every `astro build` — build time grows linearly with post count

### 2.4 Blog Post Layout

**Source file:** `src/layouts/BlogPost.astro`

Features confirmed present:
- **Reading progress bar** — pinned to top, scroll-tracking via inline script
- **In-article TOC** — H2-only entries, collapsible, auto-generated from `headings` prop
- **Author byline card** — initials avatar (from `author` field), author name + role (parsed at comma), pub/update dates, read time badge
- **Related posts** — 3 posts: same pillar first (sorted by date), then other pillars; excludes current post
- **Post CTA** — trial signup section at article end
- **JSON-LD schema** — `Article` + `BreadcrumbList` structured data for SEO/AEO
- **Sharing** — copy-link button + LinkedIn share button
- **Tone-driven hero** — full-bleed background gradient per `tone` value
- **OG/Twitter cards** — set via `BaseHead.astro` with `type="article"`

**Author parsing logic:**
```ts
// "CA Firstname Lastname, Role" → initials "FL", name "CA Firstname Lastname", role "Role"
// "Accountic Team" → initials "AT", role "Accountic"
function getInitials(name: string): string {
  const primary = name.replace(/^CA\s+/i, '').split(',')[0].trim();
  const parts = primary.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] || 'DC').slice(0, 2).toUpperCase();
}
const authorRole = author.includes(',') ? author.split(',').slice(1).join(',').trim() : 'Accountic';
```

### 2.5 Blog Index

**Source file:** `src/pages/blog/index.astro`

- Posts loaded via `import.meta.glob` (eager), sorted by `pubDate` descending
- `featured` field or first post (by date) becomes the featured hero card
- Pillar filter chips: client-side JavaScript, shows count per pillar, click-to-filter the post grid
- 3-column responsive grid (→ 2-col → 1-col) for non-featured posts
- Subscribe form: email capture with client-side validation, `localStorage` persistence to avoid re-prompting

### 2.6 Existing Blog Posts

**Count:** 9 posts in `src/content/blog/`

**Filenames:**
```
ai-drafted-notice-replies-failure-modes.md
ai-drafted-section-148-reply-review.md
dpdp-2023-ca-firms-checklist.md
faceless-assessment-application-of-mind.md
firm-notice-workflow.md
icai-code-of-ethics-april-2026.md
lakhmani-mewal-das-s148.md
section-143-2-scrutiny-drafting.md
section-148-reply-template.md
```

**Sample frontmatter (verified):**
```yaml
title: 'Five Failure Modes of AI-Drafted Income Tax Notice Replies'
description: 'The five recurring ways an AI-drafted Income Tax notice reply fails...'
pubDate: '2026-04-27'
updatedDate: '2026-04-27'
pillar: 'Income Tax Notices'
author: 'Accountic Team'
readTime: 9
tone: 'rose'
featured: false
```

**Content structure patterns:**
- Lead paragraph (2-3 sentences, no heading)
- Named sections as H2 headings
- Numbered/bulleted lists for checklists and sequences
- Blockquotes for pull-quotes or enumeration summaries
- Bold inline terms for key concepts
- Internal links to other site pages (e.g. `[See our DPDP posture](/dpdp)`)
- Indian tax domain vocabulary: PAN, GSTIN, CBDT, AO, Faceless Assessment, ICAI, ITR, Form 26AS

**Post date range:** 2026-04-27 – 2026-05-05 (all recent, active publication)

---

## 3. Admin & Auth System

### 3.1 Login Page State

**Source file:** `src/pages/login.astro`

The login page is a complete, production-quality UI with no backend wiring:

| Element | State |
|---|---|
| Google SSO button | UI only — `type="button"`, no handler |
| SSO button | UI only — `type="button"`, no handler |
| Email + password form | Submits to `event.preventDefault(); alert('Dashboard coming soon. Launching May 2026.')` |
| Password show/hide | Wired — inline script toggles `input.type` |
| Remember me checkbox | UI only — not persisted |
| "Forgot?" link | Points to `/reset` — route does not exist |

Trust badges displayed: SOC 2 Type II, DPDP-ready, India-resident data, Built by CAs & engineers.

### 3.2 Middleware Status

`src/middleware.ts`: **confirmed absent**. No Astro middleware is configured. All pages under `src/pages/` are publicly accessible to any visitor. This means:

- Any admin dashboard routes added to `src/pages/admin/` will be publicly accessible until middleware is added
- Auth middleware MUST be implemented and deployed atomically with any admin dashboard page

### 3.3 Environment Variables

**Source file:** `.env.example`
```
# No env vars are required by /api/capture.
# This file is kept as a placeholder in case future env vars are added.
```

**Source file:** `.dev.vars` (local development overrides)
```
SIGNUP_NOTIFY_FROM=info@accountic.in
```

No auth-related environment variables exist. No session secrets, JWT keys, or OAuth credentials are defined. The auth system is entirely future work.

---

## 4. Cloudflare Setup

### 4.1 wrangler.jsonc

```jsonc
{
  "compatibility_date": "2026-04-27",
  "compatibility_flags": ["global_fetch_strictly_public"],
  "name": "accountic-ui-ux",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS"
  },
  "observability": { "enabled": true },
  "send_email": [
    {
      "name": "SIGNUP_NOTIFY",
      "destination_address": "info@accountic.in"
    }
  ]
}
```

| Binding | Type | Purpose |
|---|---|---|
| `ASSETS` | Pages Assets | Serves `dist/` build artifacts |
| `SIGNUP_NOTIFY` | Email Routing | Forwards notification emails to `info@accountic.in` |

**Absent bindings (not yet provisioned):**
- D1 (relational database) — needed for: post metadata, generation logs, admin settings
- KV (key-value store) — needed for: prompt caching, feature flags, rate limiting
- R2 (object storage) — needed for: image assets, article backups
- Queues — needed for: pipeline stages (topic, outline, article, humanize, publish, refresh)
- Cron triggers — needed for: scheduled topic discovery, refresh cycles

### 4.2 Email API (`/api/capture`)

**Source file:** `src/pages/api/capture.ts`

```
POST /api/capture
Accepts: { email, source?, page?, name?, firm?, message? }
Validates: email regex + max 254 chars
Sends: MIME email via SIGNUP_NOTIFY.send_email binding
From: notify@accountic.in (hardcoded)
To:   info@accountic.in (hardcoded)
Reply-To: submitter's email
Returns: { ok: true } | { error: string } with appropriate HTTP status
```

This endpoint is production-stable and handles homepage CTA, contact page, and blog subscribe. It does not need modification for blog automation.

---

## 5. Deployment Pipeline

### 5.1 Build Scripts

**Source file:** `package.json`

```json
{
  "scripts": {
    "dev":            "astro dev",
    "build":          "astro build",
    "preview":        "npm run build && wrangler dev",
    "astro":          "astro",
    "generate-types": "wrangler types",
    "deploy":         "npm run build && wrangler deploy"
  }
}
```

### 5.2 CI/CD Status

`.github/workflows/`: **confirmed absent**. No GitHub Actions workflows exist. Deployment is entirely manual:

```
npm run deploy
  └── astro build   → generates dist/
  └── wrangler deploy → publishes to Cloudflare Pages/Workers
```

**Implication for blog automation:** The automated publish phase cannot be activated until a GitHub Actions workflow is in place. The workflow must at minimum: checkout the repo, run `npm ci`, run `npm run build`, run `wrangler deploy` with a Cloudflare API token secret. This is a **hard prerequisite** for Phase 4 (Astro Integration / automated publishing).

### 5.3 Dependencies

```json
{
  "dependencies": {
    "@astrojs/cloudflare": "^13.2.1",
    "@astrojs/mdx":        "^5.0.4",
    "@astrojs/rss":        "^4.0.18",
    "@astrojs/sitemap":    "^3.7.2",
    "astro":               "^6.1.9",
    "sharp":               "^0.34.3"
  },
  "devDependencies": {
    "wrangler": "^4.85.0"
  },
  "overrides": { "vite": "^7" }
}
```

Note: `@astrojs/rss` is installed but not yet used — it is available for a future RSS feed endpoint.

---

## 6. Design System

**Source file:** `src/styles/global.css`

### 6.1 CSS Custom Properties

**Surfaces:**
```css
--eth-bg: #f8fafc
--eth-surface: #ffffff
--eth-surface-alt: #f1f5f9
--eth-surface-elevated: #f1f5f9
```

**Text:**
```css
--eth-text: #1e293b
--eth-text-secondary: #64748b
--eth-text-muted: #94a3b8
```

**Accent (Emerald):**
```css
--eth-accent: #10b981
--eth-accent-hover: #059669
--eth-accent-soft: rgba(16, 185, 129, 0.12)
```

**Borders:**
```css
--eth-border: #e2e8f0
--eth-border-light: #cbd5e1
```

**Glass system:**
```css
--eth-glass-bg: rgba(255, 255, 255, 0.4)
--eth-glass-bg-strong: rgba(255, 255, 255, 0.7)
--eth-glass-border: rgba(255, 255, 255, 0.8)
--eth-glass-blur: blur(40px)
--eth-nav-glass: rgba(255, 255, 255, 0.55)
--eth-nav-glass-border: rgba(255, 255, 255, 0.7)
--eth-nav-glass-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)
```

**Shape:**
```css
--eth-card-radius: 2rem
--eth-layout-radius: 3rem
--eth-pill-radius: 9999px
```

**Shadows:**
```css
--eth-shadow: 0 30px 60px -15px rgba(0,0,0,0.05)
--eth-shadow-sm: 0 8px 32px rgba(0,0,0,0.06)
--eth-shadow-accent: 0 2px 12px rgba(16,185,129,0.25)
--eth-shadow-accent-hover: 0 4px 20px rgba(16,185,129,0.35)
```

**Spacing scale:**
```css
--space-1: 0.25rem   --space-4: 1rem    --space-12: 3rem
--space-2: 0.5rem    --space-6: 1.5rem  --space-16: 4rem
--space-3: 0.75rem   --space-8: 2rem    --space-20: 5rem
                                         --space-24: 6rem
```

**Layout:**
```css
--container: 1080px
--container-narrow: 880px
```

**Hero gradient:**
```css
--eth-hero-gradient:
  linear-gradient(180deg, transparent 0%, transparent 65%, var(--eth-bg) 100%),
  radial-gradient(ellipse 70% 40% at 25% 40%, rgba(253,230,138,0.5) 0%, transparent 100%),
  radial-gradient(ellipse 60% 35% at 75% 30%, rgba(249,168,212,0.4) 0%, transparent 100%),
  radial-gradient(ellipse 50% 35% at 50% 55%, rgba(147,197,253,0.3) 0%, transparent 100%);
```

### 6.2 Tone-Driven Styling

Each of the 6 tone values in `src/blog-meta.ts` drives article-level visual theming inside `BlogPost.astro`. The mapping applies: hero section background gradient, pillar chip background + text colour, author avatar gradient, related-post card top border gradient, and H2 section background tint. These styles are defined in `BlogPost.astro`'s `<style>` block (not in `global.css`). The admin dashboard and any new pages must use the token system from `global.css` and should not attempt to replicate BlogPost's tone logic outside of article rendering.

### 6.3 Responsive Breakpoints & Utility Classes

**Breakpoints:**
- `900px` — footer grid collapses to 2-column
- `860px` — nav links hidden (mobile nav)
- `640px` — container padding reduces to `--space-4`
- `560px` — auth page padding reduces; footer goes single-column
- `520px` — nav secondary link hidden

**Utility classes (global scope):**
```
.container          max-width: 1080px, auto margin, 32px padding
.eyebrow            uppercase label, 11px, letter-spacing 0.14em
.section-label      emerald pill above section headings
.btn                base button (pill, 44px min-height, 220ms transitions)
.btn-primary        emerald fill
.btn-secondary      glass fill
.btn-ghost          transparent, text-secondary
.btn-sm             padding 0.5rem 1rem, 40px min-height
.glass              glass card (backdrop-filter, white rgba border)
.sr-only            screen-reader only
.reveal             ethFadeUp entrance animation (600ms)
.highlight-green    gradient text clip (emerald accent)
.doc / .doc-toc     legal/policy two-column layout with sticky TOC
```

### 6.4 Typography

**Font:** Inter (Google Fonts), CSS variable `--font-sans`, preloaded via Astro Font API  
**Fallbacks:** `system-ui`, `-apple-system`, `Segoe UI`, `sans-serif`  
**Body:** 16px, line-height 1.6, letter-spacing -0.01em, `-webkit-font-smoothing: antialiased`

**Heading scale (responsive clamp):**
| Heading | Size range | Weight | Letter-spacing |
|---|---|---|---|
| h1 | 28px – 48px | 500 | -0.04em |
| h2 | 28px – 40px | 600 | -0.05em |
| h3 | 18px – 21.6px | 500 | -0.02em |
| h4 | 16px | 500 | — |

**Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables all animations and transitions globally.

---

## 7. Utilities & Components

### 7.1 Components (all 5)

| Component | Purpose | Key props |
|---|---|---|
| `BaseHead.astro` | HTML `<head>`: GA4 (G-GTWV7T54VV), OG/Twitter, canonical URL, Font preload, sitemap link | `title`, `description`, `image?`, `type?` |
| `Header.astro` | Fixed glassmorphic pill nav; hardcoded links: How it works, Why Accountic, Pricing, Founders | none |
| `Footer.astro` | 4-column footer: brand + tagline, Product links, Company links, Legal links; copyright | none |
| `FormattedDate.astro` | Wraps a `Date` in `<time>` with `en-us` locale (e.g. "Apr 27, 2026") | `date: Date` |
| `HeaderLink.astro` | Active-state-aware `<a>` — adds `.active` class + underline when current route matches href | All `HTMLAttributes<'a'>` |

**Note:** `HeaderLink.astro` is not used by the current nav (`Header.astro` uses plain `<a>` tags). It exists for potential future use.

### 7.2 Constants

**Source file:** `src/consts.ts`
```ts
export const SITE_TITLE = 'Accountic';
export const SITE_DESCRIPTION = 'Accounting software that runs itself.';
```

Used by: `BaseHead.astro` (title composition), `Header.astro` (brand label), `Footer.astro` (copyright), `login.astro` (page title), `BlogPost.astro` (JSON-LD publisher name).

### 7.3 Utility Directories

- `src/lib/`: **absent** — does not exist
- `src/utils/`: **absent** — does not exist

**Recommended convention for new utilities:** Create `src/lib/` as the canonical location for all new shared utility modules introduced by the blog automation subsystem (e.g., `src/lib/frontmatter.ts`, `src/lib/slug.ts`, `src/lib/schema-validate.ts`). This avoids polluting `src/` root and establishes a clear import path (`../../lib/frontmatter`).

---

## 8. Integration Strategy

### 8.1 Frozen Files (MUST NOT Modify)

These files are production-stable and relied upon by the live site. No phase of the blog automation implementation may modify them:

| File | Reason frozen |
|---|---|
| `src/content.config.ts` | Schema contract — any change risks breaking existing posts and build |
| `src/blog-meta.ts` | Taxonomy contract — enums drive entire visual system; changes require coordinated update across all styled references |
| `src/layouts/BlogPost.astro` | Production article layout — used by all 9 existing posts; no regressions acceptable |
| `src/layouts/PageLayout.astro` | Generic page template — stable, no blog automation need |
| `src/styles/global.css` | Design system tokens — shared across all pages; breaking change risk is high |
| `src/components/BaseHead.astro` | Global SEO/meta; GA4 is live |
| `src/components/Header.astro` | Fixed nav; hardcoded links are intentional |
| `src/components/Footer.astro` | Footer links are intentional |
| `src/components/FormattedDate.astro` | Stable utility; no change needed |
| `src/pages/api/capture.ts` | Production email endpoint; used by homepage, contact, blog subscribe |
| `src/pages/blog/index.astro` | Production blog hub; pillar filter and subscribe form are live |
| `src/pages/blog/[...slug].astro` | Article routing; SSG paths drive all post URLs |
| `src/consts.ts` | Site constants; SITE_TITLE used everywhere |

### 8.2 New Directories to Create

| Directory | Phase | Purpose |
|---|---|---|
| `src/lib/` | Infrastructure | Shared utilities: frontmatter validation, slug generation, schema helpers |
| `src/pages/admin/` | Admin Dashboard | Protected admin pages: articles list, settings, queue monitor |
| `src/pages/api/blog/` | Astro Integration | New API endpoints for admin actions (publish, reject, regenerate) |
| `src/workers/` | Infrastructure | Cloudflare Worker scripts for pipeline stages |
| `migrations/` | Infrastructure | D1 SQL migration files |
| `scripts/` | Infrastructure | Provisioning and seeding scripts (not deployed) |
| `.github/workflows/` | Astro Integration | GitHub Actions CI/CD workflows |

### 8.3 Content Contract

The AI pipeline MUST produce frontmatter that satisfies the Zod schema in `src/content.config.ts`. The following rules apply to every generated post:

**Required fields (build fails without these):**
```
title:       non-empty string
description: non-empty string
pubDate:     ISO 8601 date string (z.coerce.date() accepts "YYYY-MM-DD")
pillar:      one of exactly: 'Income Tax Notices' | 'Faceless Assessment' | 'DPDP Compliance' | 'ICAI Ethics' | 'Case Law Notes' | 'Firm Operations'
```

**Recommended defaults for generated posts:**
```
author:   'Accountic Team'            (matches existing posts)
readTime: computed from word count    (words / 200, rounded up, min 1)
tone:     selected by pipeline        (must be one of the 6 TONES values)
featured: false                       (never auto-set a generated post as featured)
```

**Safeguard pattern:** The pipeline should validate frontmatter against the schema before writing the `.md` file. A pre-commit validation step or a `scripts/validate-post.ts` utility should reject any post that would fail `astro build`.

### 8.4 Taxonomy Contract

The AI pipeline MUST select a `pillar` value and a `tone` value from the enum sets defined in `src/blog-meta.ts`:

```ts
PILLARS: ['Income Tax Notices', 'Faceless Assessment', 'DPDP Compliance', 'ICAI Ethics', 'Case Law Notes', 'Firm Operations']
TONES:   ['emerald', 'amber', 'rose', 'sky', 'violet', 'stone']
```

- **Pillar selection** should be driven by the article topic. The pipeline may use an LLM classification step or keyword matching against the pillar list.
- **Tone selection** may be random, round-robin, or topic-driven. The visual system accepts any tone; consistency within a pillar is preferred but not required.
- **New pillars or tones:** Adding a new value to either enum requires a coordinated change to `src/blog-meta.ts` and a review of every downstream reference in `BlogPost.astro`. This must be a separate, reviewed change — not part of automated generation.

### 8.5 CI/CD Prerequisite

A GitHub Actions workflow at `.github/workflows/deploy.yml` is a **hard prerequisite** for the automated publishing phase. Minimum required workflow:

```yaml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run build
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

This workflow MUST be in place and tested before any automated commit-and-publish pipeline is activated.

---

## 9. File Modification Plan

### MODIFY (existing files — additive changes only)

| File | Planned change | Phase |
|---|---|---|
| `wrangler.jsonc` | Add `d1_databases`, `kv_namespaces`, `r2_buckets`, `queues`, `triggers.crons` sections | Infrastructure |
| `package.json` | Add scripts: `db:migrate`, `db:seed`, `blog:validate`, `blog:publish` | Infrastructure |

### ADD (new files — zero existing files touched)

| Path | Purpose | Phase |
|---|---|---|
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD for build + deploy | Astro Integration |
| `migrations/001_init.sql` | D1 schema: `posts`, `generation_jobs`, `settings` tables | Infrastructure |
| `scripts/provision.ts` | One-time setup script for D1/KV/R2/Queues | Infrastructure |
| `scripts/validate-post.ts` | Pre-publish frontmatter validation against Zod schema | Infrastructure |
| `src/lib/frontmatter.ts` | Shared helpers: parse, validate, serialize post frontmatter | Infrastructure |
| `src/lib/slug.ts` | Slug generation from title (kebab-case, max 60 chars) | Infrastructure |
| `src/lib/schema-validate.ts` | Runtime Zod validation wrapper for pipeline use | Infrastructure |
| `src/workers/topic-discovery.ts` | Cloudflare Worker: discovers high-value topic gaps | AI Pipeline |
| `src/workers/outline-gen.ts` | Cloudflare Worker: generates structured article outline | AI Pipeline |
| `src/workers/article-gen.ts` | Cloudflare Worker: generates full article from outline | AI Pipeline |
| `src/workers/humanizer.ts` | Cloudflare Worker: humanization and quality scoring pass | AI Pipeline |
| `src/workers/publisher.ts` | Cloudflare Worker: commits `.md` file to repo, triggers deploy | AI Pipeline |
| `src/workers/refresher.ts` | Cloudflare Worker: detects stale posts and queues refresh | AI Pipeline |
| `src/pages/admin/index.astro` | Admin dashboard home (protected) | Admin Dashboard |
| `src/pages/admin/articles.astro` | Article review queue (protected) | Admin Dashboard |
| `src/pages/admin/settings.astro` | Pipeline configuration UI (protected) | Admin Dashboard |
| `src/pages/api/blog/publish.ts` | API: approve and publish a draft article | Admin Dashboard |
| `src/pages/api/blog/reject.ts` | API: reject a draft and remove from queue | Admin Dashboard |
| `src/middleware.ts` | Astro middleware: auth guard for `/admin/*` routes | Admin Dashboard |
| `src/content/blog/*.md` | AI-generated blog posts (added by Publisher worker) | AI Pipeline |

### DO NOT MODIFY

Everything in the frozen set from Section 8.1 above, plus:
- `src/pages/index.astro` (homepage)
- `src/pages/login.astro` (auth UI stub — auth backend is separate work)
- All legal pages (`dpa.astro`, `privacy.astro`, `terms.astro`, `security.astro`, `careers.astro`, `contact.astro`)
- `astro.config.mjs` (no integration changes needed for blog automation)
- `tsconfig.json`

### 9.4 Verification

No existing Astro page, layout, component, or style file appears in the MODIFY list above. The only existing files being modified are `wrangler.jsonc` and `package.json`, both receiving only additive JSON/script entries.

---

## 10. Risk Analysis

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Unprotected admin routes** — no `src/middleware.ts` exists; any `/admin/*` route added before auth middleware is deployed is publicly accessible | **High** | Auth middleware (`src/middleware.ts`) MUST be committed in the same PR as the first admin page. Never merge admin routes without accompanying middleware. |
| R2 | **No CI/CD pipeline** — automated publishing requires a GitHub Actions workflow; without it, published posts require manual `npm run deploy` | **High** | Create `.github/workflows/deploy.yml` as the first task of the Astro Integration phase. Gate all automated publishing behind workflow existence check. |
| R3 | **Build-time scaling** — `getStaticPaths()` in `pages/blog/[...slug].astro` re-runs on every build; build time grows linearly with post count | **Medium** | Monitor build time. Flag if build exceeds 3 minutes (approximately 200 posts). Consider Astro incremental builds or on-demand SSR for the blog at that threshold. |
| R4 | **Frontmatter schema failure** — any generated post with missing required fields or invalid enum values causes `astro build` to fail and blocks deployment for all site visitors | **High** | Implement `scripts/validate-post.ts` that runs Zod validation before any post is committed. Pipeline must validate before writing. CI build serves as final safety net. |
| R5 | **Hardcoded email addresses** — `NOTIFY_FROM` and `NOTIFY_TO` in `src/pages/api/capture.ts` are hardcoded strings; if the team migrates email infrastructure, these require a code change | **Low** | Flag for Infrastructure phase: move these to `wrangler.jsonc` environment variable bindings rather than source constants. Not blocking for blog automation. |
| R6 | **No `src/lib/` convention** — no shared utility directory exists; without a convention, new helpers may proliferate in inconsistent locations and create import path confusion | **Medium** | Establish `src/lib/` as the canonical utility directory in the first Infrastructure PR. Document the convention in a `src/lib/README.md`. |
| R7 | **MDX vs MD generation format** — the AI pipeline must choose whether to generate `.md` (plain Markdown) or `.mdx` (allows embedded Astro components); MDX adds generation complexity | **Medium** | Decision deferred to AI Pipeline phase. Default to `.md` for initial implementation; introduce `.mdx` only when a specific embedded component use case is justified. |

---

## 11. Open Questions

| # | Question | Resolving Phase |
|---|---|---|
| OQ1 | **MDX vs MD format for generated posts** — `.md` is simpler; `.mdx` enables embedded Astro CTA components mid-article. Which should the pipeline generate? | AI Pipeline |
| OQ2 | **Admin Worker topology** — should the admin dashboard API routes share the existing Cloudflare Worker entrypoint (via Astro SSR) or run as a dedicated Worker? Dedicated isolates blast radius but adds operational overhead. | Infrastructure |
| OQ3 | **Cloudflare account credentials** — what is the Cloudflare account ID and project name for provisioning D1, KV, R2, and Queues? Required before `scripts/provision.ts` can run. | Infrastructure |
| OQ4 | **Auth mechanism for admin routes** — the login page UI exists but no backend auth is implemented. Will this use Cloudflare Access, a JWT-based system, or a simple shared secret for v1? | Admin Dashboard |
| OQ5 | **GitHub API credentials for publisher Worker** — the Publisher worker must commit `.md` files to the repository to trigger deployment. A GitHub App or PAT with `contents:write` scope is required. Where are these stored (KV secret, Cloudflare secret)? | AI Pipeline |
| OQ6 | **Post review workflow** — will all AI-generated posts require human approval before publishing, or will high-confidence posts auto-publish? This affects the admin dashboard scope and queue design. | Admin Dashboard |

---

*Discovery complete. All findings are verified against production source files. No production files were modified during this analysis. Ready for Infrastructure phase upon approval.*
