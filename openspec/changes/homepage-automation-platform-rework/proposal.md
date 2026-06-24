## Why

The current homepage frames Accountic as a notice-reply tool with 13 accessories — the hero visual, stats strip, "how it works" section, pricing units, and CTA all center on the Notice Workflow, causing visitors who are accountants, accounting departments, or CA firms focused on reconciliation and reporting to bounce without recognising the platform's full breadth. With 14 live modules spanning compliance, data automation, and firm operations — and 20+ more in development — the homepage needs to communicate that Accountic is an automation platform, not a single-feature product.

## What Changes

- **Hero headline** broadened from "Indian CA firms" to "Indian accounting practice" (covers individual CAs, CA firms, and in-house accounting divisions)
- **Hero subtitle** rewritten to lead with automation-across-workflows framing, not notice-specific copy
- **Hero visual** replaced: notice mockup → multi-input/multi-output platform flow showing three simultaneous workflows (notice, bank statement, supplier invoice → respective Tally/reply outputs)
- **Stats strip** reworked: "< 30 min · notice PDF to reply" replaced with a broader platform stat; "14 workflows" updated to reflect "20+ coming"
- **Pain points** made module-agnostic: pain point 1 rewritten from notice-specific to general compliance-from-scratch framing
- **Module grid** equalised: Notice Workflow loses `core` flag and 2-column span; all 14 modules get equal weight
- **Module chips** rewritten from tech-descriptive to outcome-descriptive (e.g. "FIFO engine · Tally-ready XML" → "Tradebook → Tally in minutes")
- **"How it works" section** replaced: 7-step notice deep-dive → 3-column parallel flow covering Compliance & Litigation, Data → Tally Automation, and Firm Operations families
- **"20+ modules coming" card** added as 15th item in module grid (dashed border, muted palette, waitlist CTA)
- **Pricing** reworked from notice-count units to credit-volume units: Free (₹1,000 credits), Basic (₹2,000/mo · 2,000 credits), Pro (₹20,000/mo · 60,000 credits); all plans include all modules and manual top-up
- **Final CTA** broadened: "Start with three notices free" → "Start free. Try every module." with ₹1,000 credits framing

## Capabilities

### New Capabilities

- `homepage-hero-platform`: Broadened hero section — headline, subtitle, trust badges, and multi-workflow visual
- `homepage-stats-platform`: Stats strip with platform-wide metrics (not notice-specific)
- `homepage-pain-points-platform`: Module-agnostic pain point cards + updated bridge paragraph
- `homepage-modules-equal`: Equalised module grid with outcome chips and "20+ coming" card
- `homepage-how-it-works-platform`: Three-column parallel workflow explainer replacing notice-only deep-dive
- `homepage-pricing-credits`: Credit-volume pricing tiers replacing notice-count tiers

### Modified Capabilities

_(none — this is a content rework of a single file; no existing spec-level capabilities are changing)_

## Impact

- `src/pages/index.astro` — all changes are confined to this single file (data arrays, markup, and inline styles)
- No API changes, no new routes, no dependency changes
- Pricing copy change must be consistent with any existing pricing page or docs (verify if `/pricing` page exists separately)
