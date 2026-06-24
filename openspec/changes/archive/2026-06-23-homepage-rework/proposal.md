## Why

The current homepage positions Accountic as a single-purpose IT notice drafting tool, but the product is a full AI accounting agent platform for Indian CAs and finance teams — with 8 distinct automation modules covering tax notices, audit vouching, GST reconciliation, broker ledger, balance sheet generation, TDS compliance, bank-statement classification, and invoice digitisation. The homepage must be completely reworked to communicate this breadth, establish the platform-level value proposition, and let each module speak for itself.

## What Changes

- **Full rewrite** of `src/pages/index.astro` — new structure, new sections, new copy
- New hero: platform-level positioning ("Your AI accounting agent for Indian CA firms") rather than a single-notice promise
- New modules showcase section: 8 cards covering every module with icon, name, one-line summary, and key capability
- Replace the IT-notice-only comparison card with a broader "Why Accountic vs generic tools" differentiators section
- Retain the email-capture CTA section (logic unchanged)
- Retain pricing section (data unchanged, may simplify presentation)
- Remove sections that were IT-notice-specific: outcome "30-minute" card, 8-stage pipeline visualisation
- Keep all existing design tokens, glass/card aesthetic, Header/Footer/BaseHead components

## Capabilities

### New Capabilities

- `homepage-platform-hero`: Platform-level hero — "AI accounting agent for Indian CA firms", 3-4 proof-point badges, CTA pair, supporting tagline
- `homepage-modules-grid`: 8-module showcase grid — one card per module (Notice Workflow, Broker Ledger, Vouching, Balance Sheet Builder, TDS Reconciliation, Ledger Predictor, Tally OCR, Book RAG) with icon + name + one-line description + highlight capability
- `homepage-differentiators`: Why Accountic section — 4-5 platform-level trust claims (zero-hallucination, India-resident data, built by CAs, Tally-native, DPDP/SOC 2)
- `homepage-pricing`: Pricing section — same tier data, updated to reflect per-axis billing (seats, notices, broker runs, predictor runs)
- `homepage-cta`: Email-capture section — identical form logic, updated copy to reflect full platform access

### Modified Capabilities

## Impact

- `src/pages/index.astro`: full rewrite (single file, all sections inline)
- No changes to components, shared styles, consts, or other pages
- No API or build-system changes
