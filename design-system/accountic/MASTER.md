# Accountic — Design System (MASTER)

> Adapted from **zerosettle.io** "Ethereal" design system (Dia-inspired glassmorphism).
> Refined **2026-04-24** against the live zerosettle CSS. Light mode is primary. Dark mode tokens available; dark styles not yet wired.

## Pattern
- **Style:** Ethereal / Glassmorphism (Dia-inspired)
- **Mood:** Modern, airy, soft, calmly confident. Not corporate-navy; not playful-neon.
- **Homepage sections:** Hero (centered, 100dvh, triple-radial pastel gradient + floating scroll arrow) → Outcome stats → How it works → Why showcase (large rounded pastel container with glass cards) → Pricing → Final CTA (gradient card)
- **Interior / whitepages** (legal, policy, company, contact, login, security, careers): subdued page-hero with the same triple-radial gradient at lower opacity, content column at 72ch, optional sticky TOC sidebar. **Never 100dvh** on interior pages.

## Typography

- **Font:** `Inter` (Google Fonts) — weights 300, 400, 500, 600, 700
- **No serif.** No display typeface. Everything in Inter.
- **Body:** `font-weight: 400`, `line-height: 1.6–1.65`, `letter-spacing: -0.01em` on `<body>`
- **Body measure:** max-width `480–560px` on hero/cta copy (~50–65 chars); `72ch` on long-form `.doc-body`

### Type scale (authoritative — measured from zerosettle ethereal.css)

| Role | Size | Weight | Letter-spacing | Line-height |
|------|------|--------|----------------|-------------|
| Hero H1 (`.hero-title`) | `clamp(28px, 4vw, 48px)` | 500 | `-0.04em` | 1.2 |
| Section title (`.section-title`, `.cv-heading`) | `clamp(1.75rem, 3.2vw, 2.5rem)` | **600** | **`-0.05em`** | 1.2 |
| CTA title (`.cta-title`) | `clamp(28px, 4vw, 48px)` | **300** | `-0.05em` | 1.2 |
| H3 (card titles, feature headings) | `clamp(1.125rem, 1.8vw, 1.35rem)` | 500 | `-0.02em` | 1.3 |
| Hero subtitle (`.hero-subtitle`) | `clamp(15px, 1.8vw, 18px)` | 400 | inherit | 1.6 |
| CTA description (`.cta-desc`) | `clamp(16px, 2vw, 20px)` | 400 | inherit | 1.6 |
| Body | `16px` | 400 | `-0.01em` | 1.65 |
| Eyebrow / section-label | `11px` | 500 / 600 | `0.12em–0.14em` uppercase | — |

Hero subtitle caps at `max-width: 480px` and sits `1.5rem` below the H1.

## Color tokens (light)

| Role | Hex | Variable |
|------|-----|----------|
| Background | `#f8fafc` | `--eth-bg` |
| Surface | `#ffffff` | `--eth-surface` |
| Surface alt / elevated | `#f1f5f9` | `--eth-surface-alt`, `--eth-surface-elevated` |
| Text primary | `#1e293b` | `--eth-text` |
| Text secondary | `#64748b` | `--eth-text-secondary` |
| Text muted | `#94a3b8` | `--eth-text-muted` |
| **Accent** | `#10b981` (emerald) | `--eth-accent` |
| Accent hover | `#059669` | `--eth-accent-hover` |
| Accent soft (10%) | `rgba(16, 185, 129, 0.1)` | `--eth-accent-soft` |
| Border | `#e2e8f0` | `--eth-border` |
| Border light | `#cbd5e1` | `--eth-border-light` |
| Code background | `#1e293b` | `--eth-code-bg` |

## Signature gradients

**1. Hero gradient (homepage only)** — three soft radial pastels layered over off-white, with a bottom fade-to-bg:

```css
background-image:
  linear-gradient(180deg, transparent 0%, transparent 65%, var(--eth-bg) 100%),
  radial-gradient(ellipse 70% 40% at 25% 40%, rgba(253, 230, 138, 0.5) 0%, transparent 100%),  /* warm yellow */
  radial-gradient(ellipse 60% 35% at 75% 30%, rgba(249, 168, 212, 0.4) 0%, transparent 100%),  /* pink */
  radial-gradient(ellipse 50% 35% at 50% 55%, rgba(147, 197, 253, 0.3) 0%, transparent 100%);  /* blue */
```

**2. Whitepage hero gradient (interior pages)** — same palette, ~10% lower opacity, shorter fade, less vertical real-estate:

```css
padding: 9rem 0 3rem;
background-image:
  linear-gradient(180deg, transparent 0%, transparent 55%, var(--eth-bg) 100%),
  radial-gradient(ellipse 60% 50% at 20% 30%, rgba(253, 230, 138, 0.45) 0%, transparent 100%),
  radial-gradient(ellipse 55% 45% at 85% 20%, rgba(249, 168, 212, 0.35) 0%, transparent 100%),
  radial-gradient(ellipse 50% 40% at 60% 70%, rgba(147, 197, 253, 0.3) 0%, transparent 100%);
```

**3. CTA gradient (softer, pink+blue only, no yellow)** — used on the final CTA section:

```css
background-image:
  linear-gradient(180deg, var(--eth-bg) 0%, transparent 25%, transparent 75%, var(--eth-bg) 100%),
  radial-gradient(ellipse 65% 45% at 35% 45%, rgba(249, 168, 212, 0.4) 0%, transparent 100%),
  radial-gradient(ellipse 55% 40% at 70% 55%, rgba(147, 197, 253, 0.35) 0%, transparent 100%);
```

**4. Showcase gradient (flat diagonal)** — used on the "why" showcase container and other large rounded pastel surfaces:

```css
background: linear-gradient(135deg, #dbeafe 0%, #fef3c7 40%, #fce7f3 100%);
```

## Glass effect tokens

```css
--eth-glass-bg: rgba(255, 255, 255, 0.4);           /* default glass card */
--eth-glass-bg-strong: rgba(255, 255, 255, 0.7);    /* hover / modal body */
--eth-glass-border: rgba(255, 255, 255, 0.8);
--eth-glass-blur: blur(40px);
```

Three tiers of glass:

| Tier | Background | Blur | Use |
|------|-----------|------|-----|
| Light glass | `rgba(255,255,255,0.4)` | `blur(40px)` | hero badges, sample card, secondary buttons, stat cards, "why" sub-cards |
| Nav glass | `rgba(255,255,255,0.55)` | `blur(40px) saturate(180%)` | floating nav pill only |
| Strong glass | `rgba(255,255,255,0.85)` | `blur(40px)` | modals, popovers — legibility over airiness |

Modal overlay scrim: `rgba(15, 23, 42, 0.4)` + `backdrop-filter: blur(8px)`.

## Shape

- **Card radius:** `2rem` (32px) — for content cards
- **Layout / section container radius:** `3rem` (48px) — for large pastel containers (showcase, CTA, calc-visual)
- **Pill radius:** `9999px` — nav, badges, CTA buttons, chips
- **Input radius:**
  - **Pill (`9999px`)** — email/search inputs in CTAs and newsletter
  - **Soft (`1rem`)** — form data inputs (contact form, login fields, multi-line fields)
  - **Small (`0.5rem`)** — compact chips / preset buttons inside cards
- Hard 1px borders are rare; prefer `1px solid rgba(255,255,255,0.8)` on glass or `1px solid #e2e8f0` on surfaces.

## Elevation / shadows

- `--eth-shadow-sm`: `0 8px 32px rgba(0, 0, 0, 0.06)` — default glass shadow
- `--eth-shadow`: `0 30px 60px -15px rgba(0, 0, 0, 0.05)` — large soft cards (showcase, calc-visual)
- `--eth-shadow-accent`: `0 2px 12px rgba(16, 185, 129, 0.25)` — primary button rest
- `--eth-shadow-accent-hover`: `0 4px 20px rgba(16, 185, 129, 0.35)` — primary button hover
- Nav shadow: `0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)`

All shadows are soft, spread, low-opacity — never hard drop shadows. Never `0 1px 2px`.

## Navigation

Fixed, centered glass pill — **floated from the top**, not flush.
- `max-width: 900px`, `border-radius: 9999px`
- `margin: 0.5rem auto 0` (sits below the viewport edge, not clamped)
- `background: rgba(255, 255, 255, 0.55)`, `backdrop-filter: blur(40px) saturate(180%)`
- `box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)`
- Height 56–64px, logo left, nav links center, CTA right
- Mobile-open state: pill expands to `border-radius: 1.25rem` with `min-height: 64px`, keeps the same glass

## Buttons

| Variant | Background | Text | Shadow | Border | Use |
|---------|-----------|------|--------|--------|-----|
| Primary | `#10b981` | white | `--eth-shadow-accent` (green glow) | none | Single per section; main CTA |
| Secondary | `--eth-glass-bg` + `blur(40px)` | `--eth-text` | `--eth-shadow-sm` | `--eth-glass-border` | Pair with primary; demo/docs |
| Ghost | transparent | `--eth-text-secondary` | none | none | Nav links, tertiary actions |

- Height min `44px`; `btn-sm` min `40px`
- Padding `0.75rem 1.35rem`
- Font weight 500, letter-spacing `-0.005em`, font-size 0.95rem
- Radius: `9999px` (pill) always
- Active state: `transform: translateY(1px)` — no color shift

## Section-level patterns

### Section eyebrow / label

Two variants:

1. **Uppercase letterspaced** (page-hero eyebrow) — `.eyebrow`: 11px, weight 500, letter-spacing 0.14em, uppercase, color `--eth-text-secondary` (or `--eth-accent` on `.page-hero .eyebrow`).
2. **Accent pill** (homepage sections) — `.section-label`: emerald text on `rgba(16, 185, 129, 0.1)` background, pill radius, no shadow. Used above section titles inline-block.

### Section title + subtitle

```
.section-label (accent pill or uppercase eyebrow)
.section-title  — clamp(1.75rem, 3.2vw, 2.5rem), weight 600, -0.05em
.section-subtitle — color: --eth-text-secondary, max-width ~560px, centered
```

Default section horizontal padding: `80px 1rem` (`.section-no-card`).

## Iconography

- **Lucide** stroke icons only. `stroke-width: 1.8–2.0`.
- Icons live in rounded-14px tinted containers (soft emerald `--eth-accent-soft`, or dark `var(--eth-text)` for hero emphasis).
- Never emoji as structural icons.
- Icon size tokens: `sm` 16px, `md` 20px, `lg` 24px — pick one per hierarchy layer.

## Motion

- Entrance: `ethFadeUp 600ms cubic-bezier(0.22, 1, 0.36, 1)` — gentle rise + fade
- Hover on cards/buttons: 160–220ms; `translateY(-2px)` to `-3px` + shadow step up
- Text reveal (accent wipe): `cubic-bezier(0.22, 1, 0.36, 1) 0.6–0.9s` with `clip-path: inset(0 100% 0 0)` → `0 0% 0 0`, settling to `#10b981`.
- Hero scroll arrow: 44×44 circle, `bottom: 2rem`, `rgba(255,255,255,0.7)` + `blur(8px)`, 2s bounce loop, auto-hides on scroll.
- Respect `prefers-reduced-motion`: animations and smooth scroll must be disabled.

## Forms

- **Label above input** (not placeholder-only). Label: `--eth-text-secondary`, 0.85rem, weight 500.
- **Input radius `1rem`** for data, **`9999px`** for inline CTA/newsletter inputs.
- **Focus ring:** `border-color: rgba(16, 185, 129, 0.5)` + `box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1)`.
- **Background:** `--eth-surface` on data inputs; `rgba(255,255,255,0.6)` on glass/modal inputs.
- **Helper text** below the field in `--eth-text-muted`; errors inherit accent-red (not yet tokenized — use `#dc2626` with `rgba(220,38,38,0.1)` soft bg).
- Chips / preset buttons: radius `0.5rem`, active state uses `--eth-accent-soft` bg + 40% accent border.

## Whitepage / interior page pattern (legal, policy, company, contact, security, careers, login)

These are the **most common** pages by count and deserve their own explicit rules.

### Layout

- Use `PageLayout.astro` with `eyebrow` + `heading` + `lede` props. Never 100dvh.
- `.page-hero`: `padding: 9rem 0 3rem`, whitepage gradient (above), two-column grid `1.5fr 1fr` with optional illustrated `<svg slot="visual">` (max 260×200).
- `.page-body`: `padding: var(--space-16) 0 var(--space-20)`; narrow variant uses `max-width: 780px`.

### Content column

- For long-form policy/legal: two-column `.doc` grid — `240px 1fr`, sticky `.doc-toc` at `top: 96px`, `.doc-body` at `max-width: 72ch`.
- TOC counter-style: decimal-leading-zero (`01. 02. …`) in monospace, 0.75rem.
- Section anchors: `scroll-margin-top: 96px` to clear the fixed nav.
- Body paragraphs: `line-height: 1.75`, color `--eth-text-secondary`.
- `<strong>` inside body: color `--eth-text`, weight 600 (stronger than normal bold for emphasis).

### Illustrative visuals

Whitepage heroes use a small **inline SVG mark** on the right (260×200, stroke-based, single emerald accent with 8% emerald fill) rather than a glass card or large image. Stroke width 2. Keep the palette to white surface + emerald stroke + one emerald-alpha fill — no rainbow gradients.

### Forms on whitepages

- Contact / demo request / login cards sit on `--eth-surface` inside a `.request-section` container (radius 2rem, border 1px `--eth-border`, shadow-sm, padding 2rem).
- Do **not** use the glass variant for form cards on whitepages — it competes with the already-subtle gradient.

## Anti-patterns (do NOT do)

- Serif fonts (EB Garamond, Georgia, etc.) — Inter only
- Hard navy/gold "Trust & Authority" palette — emerald is the only accent
- Sharp corners or minor radii (< 16px) on content cards — use 2rem
- Hard 1px drop shadows or offset-0 shadows — always soft, spread, low-opacity
- Filled "corporate" buttons — primary is emerald glow; no other filled variant
- Mixing filled + outline icons at the same hierarchy level
- **Pill-radius `9999px` on multi-line form fields** — use 1rem soft radius instead
- **100dvh heroes on interior/whitepages** — reserved for the homepage only
- **Full triple-radial gradient on whitepages** — use the lower-opacity whitepage variant
- **Glass cards for whitepage forms** — use plain white `.request-section` instead
- **Söhne or any non-Inter typeface for logo** — zerosettle uses Söhne; Accountic stays single-family Inter
- `.section-title` at weight 500 with `-0.03em` spacing — section titles are **600** at `-0.05em`

## Homepage section heuristics

- **Hero:** centered, `min-height: 100dvh`, triple-radial gradient, glass badge + pill nav, emerald primary CTA, glass secondary CTA. Floating 44px scroll-arrow at `bottom: 2rem`.
- **Stats band:** 3 glass cards on bg (no gradient), tabular/monospaced figures.
- **How it works:** 4 white cards with emerald step numbers, 2rem radius, `--eth-shadow-sm`.
- **Why (showcase):** large `--eth-showcase-gradient` container (radius 3rem, `--eth-shadow`) with bento of cards — one larger white/surface "hero" card + N glass cards.
- **Pricing:** 4 tiers, white cards + 1 dark slate card ("most popular") with emerald check marks + floating emerald pill badge.
- **Final CTA:** CTA-gradient full-bleed section (no card), `.cta-title` at weight **300**, single centered form (email pill + primary button).
