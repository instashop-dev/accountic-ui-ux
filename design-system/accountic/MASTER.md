# Accountic — Design System (MASTER)

> Adapted from **zerosettle.io** "Ethereal" design system (Dia-inspired glassmorphism).
> Light mode is primary. Dark mode tokens available; dark styles not yet wired.

## Pattern
- **Style:** Ethereal / Glassmorphism (Dia-inspired)
- **Mood:** Modern, airy, soft, calmly confident. Not corporate-navy; not playful-neon.
- **Sections per page:** Hero (centered, 100vh, triple-radial pastel gradient) → Outcome stats → How it works → Why showcase (large rounded pastel container with glass cards) → Pricing → Final CTA (gradient card)

## Typography
- **Font:** `Inter` (Google Fonts) — weights 300, 400, 500, 600, 700
- **No serif.** No display typeface. Everything in Inter.
- **Headings:** `font-weight: 500`, `letter-spacing: -0.03em` to `-0.04em`, `line-height: 1.1–1.2`
- **Body:** `font-weight: 400`, `line-height: 1.6–1.65`
- **Hero H1:** `clamp(2.2rem, 5.2vw, 4.2rem)`, letter-spacing `-0.04em`
- **Body max width:** `480–560px` — line measure ~50–65 chars

## Color tokens (light)

| Role | Hex | Variable |
|------|-----|----------|
| Background | `#f8fafc` | `--eth-bg` |
| Surface | `#ffffff` | `--eth-surface` |
| Surface alt | `#f1f5f9` | `--eth-surface-alt` |
| Text primary | `#1e293b` | `--eth-text` |
| Text secondary | `#64748b` | `--eth-text-secondary` |
| Text muted | `#94a3b8` | `--eth-text-muted` |
| **Accent** | `#10b981` (emerald) | `--eth-accent` |
| Accent hover | `#059669` | `--eth-accent-hover` |
| Border | `#e2e8f0` | `--eth-border` |
| Border light | `#cbd5e1` | `--eth-border-light` |

## Signature: the hero gradient

Three soft radial pastels layered over the off-white background — warm yellow, pink, and blue — then a subtle fade-to-bg at the bottom. This is the single most distinctive visual element.

```css
background-image:
  linear-gradient(180deg, transparent 0%, transparent 65%, var(--eth-bg) 100%),
  radial-gradient(ellipse 70% 40% at 25% 40%, rgba(253, 230, 138, 0.5) 0%, transparent 100%),
  radial-gradient(ellipse 60% 35% at 75% 30%, rgba(249, 168, 212, 0.4) 0%, transparent 100%),
  radial-gradient(ellipse 50% 35% at 50% 55%, rgba(147, 197, 253, 0.3) 0%, transparent 100%);
```

Also used on the final CTA card (softer variant). The "why" showcase uses the lighter flat gradient `linear-gradient(135deg, #dbeafe 0%, #fef3c7 40%, #fce7f3 100%)`.

## Glass effect tokens

```css
--eth-glass-bg: rgba(255, 255, 255, 0.4);
--eth-glass-bg-strong: rgba(255, 255, 255, 0.7);
--eth-glass-border: rgba(255, 255, 255, 0.8);
--eth-glass-blur: blur(40px);
```

Apply glass to: hero badges, hero sample-reply card, secondary CTA buttons, navigation pill, stat cards, "why" card variants.

## Shape

- **Card radius:** `2rem` (32px) — VERY rounded
- **Layout/section container radius:** `3rem` (48px)
- **Pills (nav, badges, CTAs):** `9999px`
- **Inputs:** `9999px` pill

## Elevation / shadows

- `--eth-shadow-sm`: `0 8px 32px rgba(0, 0, 0, 0.06)` — default glass shadow
- `--eth-shadow`: `0 30px 60px -15px rgba(0, 0, 0, 0.05)` — large soft cards
- `--eth-shadow-accent`: `0 2px 12px rgba(16, 185, 129, 0.25)` — primary button
- `--eth-shadow-accent-hover`: `0 4px 20px rgba(16, 185, 129, 0.35)`

All shadows are soft, spread, low-opacity — never hard drop shadows.

## Navigation

Fixed, centered glass pill.
- `max-width: 900px`, `border-radius: 9999px`
- `background: rgba(255, 255, 255, 0.55)`, `backdrop-filter: blur(40px) saturate(180%)`
- `box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)`
- Height 56px, logo left, nav center, CTA right

## Buttons

- **Primary:** emerald background `#10b981`, white text, soft green glow shadow, pill radius
- **Secondary:** glass (`rgba(255,255,255,0.4)` bg, `blur(40px)`, white-ish border), dark text
- **Ghost:** transparent, secondary text color, surface-alt on hover
- Height min `44px`; `btn-sm` min `40px`
- Font weight 500, letter-spacing `-0.005em`

## Iconography

- **Lucide** stroke icons only. `stroke-width: 1.8–2.0`.
- Icons live in rounded-14px tinted containers (soft emerald `--eth-accent-soft`, or dark `var(--eth-text)` for hero emphasis).
- Never emoji.

## Motion

- Entrance: `ethFadeUp 600ms cubic-bezier(0.22, 1, 0.36, 1)` — gentle rise + fade
- Hover: 160–220ms; `translateY(-2px)` to `-3px` + shadow step up
- Respect `prefers-reduced-motion`

## Anti-patterns (do NOT do)

- Serif fonts (EB Garamond, Georgia, etc.) — Inter only
- Hard navy/gold "Trust & Authority" palette — replaced with emerald accent
- Sharp corners or minor radii (< 16px) on content cards — use 2rem
- Hard 1px shadows or drop shadows — always soft, spread
- Filled "corporate" buttons — use emerald glow or glass
- Icon+stroke mixing filled + outline at the same hierarchy level

## Section heuristics

- **Hero:** centered, min-height 100dvh, triple-radial gradient, glass badge + pill nav, emerald primary CTA, glass secondary CTA, floating glass sample card at bottom
- **Stats band:** 3 glass cards on bg (no gradient), tabular numbers
- **How it works:** 4 white cards with emerald step numbers, 2rem radius, soft shadow
- **Why (showcase):** large `--eth-showcase-gradient` container with bento of cards — one larger white/surface "hero" card + 4 glass cards
- **Pricing:** 4 tiers, white cards + 1 dark slate card ("most popular") with emerald check marks + floating emerald pill badge
- **Final CTA:** pastel-gradient rounded container, single centered form (email + primary button)
