# Design — Accountic (Cobalt)

Locked design system for the Accountic marketing site. Future design work reads
this file first; every page defers to it. `src/styles/tokens.css` is the machine
source of truth for tokens; this file is the human spec. Amend intentionally.

Built with Hallmark. Powered by Together AI.

## System
- **Genre** · modern-minimal (Stripe / Linear / Vercel school)
- **Macrostructure** · Workbench (homepage); interior pages use `PageLayout` hero + content
- **Theme** · Cobalt — cool engineered near-white paper, one electric-cobalt signal, hairline structure, one dark graphite band per page
- **Axes** · paper-band: cool-light · display: grotesk-sans · accent: electric-cobalt
- **Nav** · N13 — flush bordered bar + working ⌘K command palette (opens on click and ⌘K/Ctrl+K)
- **Footer** · Ft5 — closing statement + hairline link columns + meta

## Principles
1. **Hairlines, not shadows.** Structure comes from 1px rules. No glassmorphism, no drop shadows (the ⌘K modal is the only floating layer).
2. **One cobalt signal, < 5% of any viewport.** Accent is for the primary button, a key check, the eyebrow tick, focus rings, active/hover states — never a flood. Everything else is ink-on-paper.
3. **One dark beat per page.** A single full-bleed graphite band gives a light → dark → light rhythm.
4. **Honest content.** Real metrics only; no invented stats, testimonials, or logos. No re-drawn browser/OS chrome — diagrammatic panels, not fake screenshots.
5. **Roman display always.** Headings never italic; emphasis is weight or accent colour.

## Tokens (canonical — `src/styles/tokens.css`)
```css
:root {
  /* Surfaces — cool near-white, never #fff */
  --color-paper:   oklch(98.5% 0.004 250);
  --color-paper-2: oklch(96% 0.005 251);
  --color-paper-3: oklch(94.4% 0.006 252);

  /* Ink — cool charcoal, never #000 (all ≥4.5:1 on paper) */
  --color-ink:   oklch(24% 0.02 258);    /* headings   */
  --color-ink-2: oklch(34% 0.018 257);   /* body       */
  --color-ink-3: oklch(48% 0.016 256);   /* secondary  */
  --color-ink-4: oklch(56% 0.014 256);   /* mono labels/meta */

  /* Cobalt signal — accent for UI (rings/icons/ticks); accent-2 for text + button fill; accent-3 hover */
  --color-accent:     oklch(58% 0.20 256);
  --color-accent-2:   oklch(52% 0.205 256);
  --color-accent-3:   oklch(46% 0.19 256);
  --color-accent-soft: oklch(93% 0.05 256);
  --color-accent-ink:  oklch(99% 0.005 250);

  /* The one dark band + dark-surface text */
  --color-graphite:  oklch(22% 0.016 260);
  --color-on-dark:   oklch(93% 0.008 255);
  --color-on-dark-2: oklch(74% 0.014 256);

  /* Hairlines + accessible control borders (≥3:1, WCAG 1.4.11) */
  --color-rule:           oklch(90% 0.006 255);
  --color-rule-2:         oklch(84% 0.008 255);
  --color-rule-dark:      oklch(33% 0.012 260);
  --color-border-control: oklch(64% 0.012 256);

  --color-focus:       oklch(58% 0.20 256);
  --color-danger:      oklch(55% 0.17 25);
  --color-danger-soft: oklch(94% 0.03 25);

  /* Fonts — supplied by the Astro Fonts API (astro.config.mjs) */
  --font-display: "Space Grotesk", system-ui, sans-serif;  /* headings, 600 */
  --font-sans:    "Inter", system-ui, sans-serif;          /* body, 400/500 */
  --font-mono:    "JetBrains Mono", ui-monospace, monospace; /* labels, data, code */

  /* Type scale: --text-2xs 11px · xs 12 · sm2 14 · body 15 · base 16 · lg 18
     · xl 20 · 2xl 24 · 3xl/4xl/5xl fluid clamps (H2/H1/hero) */
  /* Tracking: --tracking-tight -0.03em (display) · -snug -0.02em (headings)
     · -label 0.08em / -label-lg 0.1em (uppercase mono) */
  /* Spacing: 4-pt named scale --space-3xs … --space-5xl. Section rhythm is
     fluid: clamp(3.5rem, 8vw, --space-4xl). */

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-1: 150ms; --dur-2: 250ms; --dur-3: 400ms; --dur-4: 600ms;

  /* Radii — drawn with a ruler: 2xs 2 · xs 4 · sm 6 (controls) · md 8
     · lg 10 (cards/panels) · xl 14 · pill (chips/dots only) */
  --wrap: 1120px;  --wrap-narrow: 760px;
}
```

## Typography
- **Display/headings** · Space Grotesk 600, roman. H1 `--text-4xl` (hero opts to `--text-5xl`), H2 `--text-3xl`, tracking baked into size (`--tracking-tight` at display, `--tracking-snug` mid). `text-wrap: balance` on all headings.
- **Body** · Inter 400/500. Reading copy in cards/tables is `--text-body` (15px); ledes `--text-lg`/`--text-xl`. `text-wrap: pretty`. Measure capped 48–72ch.
- **Mono** · JetBrains Mono for eyebrows, labels, meta, data figures, code — UPPERCASE with `--tracking-label`, coloured `--color-ink-4`. Mono never inherits the body's negative tracking (`letter-spacing: 0`). Eyebrows carry a 6px cobalt tick (`--radius-2xs`).

## Components
- **Buttons** · Primary = solid `--color-accent-2` fill (hover `--color-accent-3`), `--color-accent-ink` text, 6px radius, ≥44px. Secondary = transparent + `--color-border-control` outline, hover cobalt. Display font, single line.
- **Inputs** · `--color-border-control` 1px, 6px radius, paper fill; focus = cobalt ring (`box-shadow: 0 0 0 3px var(--color-accent-soft)` + accent border). Never pill-radius on data fields.
- **Cards / panels** · Paper (or paper-2), 1px `--color-rule` (`--rule-2` for emphasis), 10px radius, no shadow. Hover = border-colour shift.
- **Nav (N13)** · Flush, `--color-paper` at 93% + blur, 1px bottom rule. Wordmark + 2–3 links · ⌘K search pill (`--border-control`) · one solid button. The ⌘K palette is a real, focus-trapped, keyboard-navigable modal with a fade/scale open.
- **Footer (Ft5)** · Statement line (Space Grotesk) + accent close phrase, hairline link columns (mono labels), meta row.

## Motion stance
Composed and sparse. Primitives: `IntersectionObserver` reveal (fade + 10px rise, `--dur-4`/`--ease-out`), one-shot hero type-in, stat counter-tick, ⌘K open/close, cobalt underline-grow on nav/links. Never animate layout properties. `prefers-reduced-motion` collapses all of it to instant/visible (global catch-all + JS guards). `@media (scripting: none)` keeps reveal content visible.

## Per-page patterns
- **Homepage** — hero (title-left / instrument-panel-right) · stat strip · problem · **graphite "how it works" band** · 14-module tabular spec sheet · why (cobalt-tinted lead + hairline cells) · platform grid · pricing (Pro = cobalt) · FAQ (`<details>`) · CTA form · footer.
- **Interior (`PageLayout`)** — paper hero + hairline, mono eyebrow + tick, Space Grotesk H1, cobalt lede; body on the `--space-*` rhythm.
- **Legal (`.doc*` in global.css)** — sticky hairline TOC (mono numerals), 72ch body, mono meta.
- **Blog** — hairline post cards, mono meta/tags; article template with mono TOC + reading progress.
- **SVG illustrations** — colour routed through CSS tokens (`currentColor` + accent/ink), never hardcoded hex.

## Guardrails (slop test)
No glassmorphism · no gradient text · no italic headings · no re-drawn OS/browser chrome · no invented metrics/testimonials · locked tokens only (no inline hex/oklch in components) · mobile verified at 320/375/414/768 with `overflow-x: clip`, `minmax(0,1fr)` image grids, single-line clickable text, ≥44px targets.

## Exports
`src/styles/tokens.css` is the source of truth. For Tailwind v4 `@theme`, DTCG
`tokens.json`, or shadcn/ui CSS variables, ask *"extend design.md with Tailwind
exports"* (or the format you want) and they will be appended here.
