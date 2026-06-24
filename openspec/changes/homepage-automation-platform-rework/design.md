## Context

The homepage lives entirely in `src/pages/index.astro` as a self-contained Astro page with inline data arrays, markup, and `<style>` block. There is no CMS, no external data source, and no component library — everything is co-located. The rework is a content and structure change, not a technical architecture change. All decisions are therefore about copy, data shape, markup structure, and CSS layout adjustments.

Current bias points (in source order):
1. `const stats` — index 0 is notice-specific ("< 30 min · From notice PDF to filed reply")
2. `modules[0]` has `flag: 'core'` → renders with `.module-card--core` (2-column span, green gradient)
3. `noticeSteps` array (7 items) feeds the "How it works" section entirely
4. `const pricingTiers` — Basic/Pro features list uses "notices / month" as the unit
5. Hero `<h1>`, subtitle `<p>`, primary CTA `<a>`, and `hero-visual` all center on notices
6. Final CTA headline and body copy reference notices

## Goals / Non-Goals

**Goals:**
- All 14 modules presented with equal visual weight
- Hero communicates platform breadth (multiple input types → multiple output types)
- Pricing expressed in credit-volume units, not notice counts
- "20+ modules coming" signalled in the module grid
- Pain points and "how it works" applicable to accountants, accounting departments, and CA firms — not only notice filers
- Zero new dependencies, zero new routes, zero structural changes to Astro

**Non-Goals:**
- Per-module detail pages (out of scope)
- Animated or interactive hero visual (keep static mockup pattern)
- Dark mode or theme changes
- Any change to the Header, Footer, or BaseHead components
- Backend or API changes

## Decisions

**D1 — Hero visual: multi-flow mockup, not a dashboard**

Replace the single notice workflow mockup with a three-row mockup showing three simultaneous input → output pairs (notice PDF → drafted reply, bank statement → Tally vouchers, supplier invoice → GST Purchase voucher). Reuse the existing `.hv-window` / `.hv-bar` / `.hv-body` CSS structure — change the body layout from 3-column (source | arrow | reply) to a stacked 3-row grid, each row being a compact input chip + arrow + output chip.

Alternative considered: a dashboard/metrics visual showing credits used, vouchers posted, recons completed. Rejected — feels like a logged-in product screen, not a landing page hook. The current mockup pattern (browser chrome + content) is well-established in the design and should be preserved.

**D2 — Module grid: remove `core` flag entirely**

Remove `flag: 'core'` from the Notice Workflow entry and remove the `.module-card--core` CSS rule that gives it `grid-column: span 2`. All 14 cards become uniform. A 15th card ("20+ modules coming") is added as the last list item, styled with a dashed border and muted palette to signal "not yet available."

Alternative considered: grouping modules into labelled sections (Compliance, Automation, Firm Ops). Rejected for now — adds complexity (tabs or sub-headers) and risks making the grid feel smaller per section. Equal-weight flat grid with the "coming" card is sufficient for this rework.

**D3 — "How it works": replace with 3-column parallel flow**

Delete `const noticeSteps` and the `<section class="how-it-works">` step-list markup. Replace with a new section using a 3-column CSS grid, each column representing one workflow family (Compliance & Litigation, Data → Tally, Firm Operations), each with 3 steps. This keeps the section's position in the page flow and reuses existing typography/spacing tokens.

Alternative considered: keep the notice deep-dive but add two more equivalent deep-dives for other modules. Rejected — triples the section length and still signals "notice is primary."

**D4 — Pricing: swap feature list items, keep card structure**

The `.tiers` grid and card markup are unchanged. Only `const pricingTiers` data changes: plan names stay (Free, Basic, Pro, Firm), prices stay, but `features` arrays are rewritten to lead with credit volumes and "all 14 modules" rather than notice counts. The explanatory note at the bottom ("1 credit = ₹1, different modules consume different amounts") is added.

**D5 — Stats strip: replace stat[0], keep stats[1–3]**

Stat[0] ("< 30 min · From notice PDF to filed reply") is the only notice-specific stat. Replace with "90–98% · Ledger Predictor auto-classification accuracy" or "₹1,000 · Free credits to try every module" — the second is more actionable for a landing page. Stats[1–3] (14 workflows, 45 yrs, 0 hallucinations) are kept verbatim. The "14" label gets a sub-note: "with 20+ in development."

**D6 — Module chips: outcome-first copy**

The `chip` field on each module entry is rewritten to lead with the user outcome rather than the technology. No markup or CSS changes needed — only the string values in the `modules` array change.

## Risks / Trade-offs

- **Pricing copy drift**: If a separate `/pricing` page exists, it must be updated in the same PR to avoid inconsistency. → Check for `src/pages/pricing.astro` before implementing; flag if found.
- **"20+ coming" card in module grid**: The number "20+" is a forward commitment. If the roadmap changes, this needs updating. → Keep it vague ("20+ modules") rather than naming specific upcoming features.
- **Hero visual complexity**: The 3-row mockup is more complex than the current 3-column one. On mobile (≤ 680px), the current `.hv-body` collapses to single column — the new layout needs a similar collapse strategy. → Each row becomes full-width stacked on mobile.
- **Removing the notice deep-dive**: The Notice Workflow is the highest-conversion entry point (free trial hook). Removing its detailed explanation may reduce conversion for notice-focused visitors. → The module card for Notice Workflow still exists and its description is unchanged; the loss is the 7-step explainer. Acceptable trade-off given the platform framing goal.

## Open Questions

- Does a separate `/pricing` page exist? If yes, it needs a parallel update.
- What is the exact credit cost per module (e.g., how many credits does one GSTR-2B reconciliation consume)? This determines whether the pricing note should give examples. If unknown, the note stays generic: "Credit consumption varies by module and document volume."
- Should the "20+ coming" card link somewhere (a waitlist, a roadmap page)? Currently proposed to link to `#cta` (the existing email capture form). Confirm this is acceptable or if a separate waitlist flow is needed.
