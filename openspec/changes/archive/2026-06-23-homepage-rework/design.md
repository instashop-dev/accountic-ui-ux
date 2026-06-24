## Context

The existing `src/pages/index.astro` (~1,900 lines) frames Accountic as an IT-notice drafting tool. The product is actually an 8-module AI accounting platform for Indian CAs. The homepage must pivot to a platform-first presentation while keeping the Astro component shell, CSS design tokens (`--eth-*`), and email-capture infrastructure unchanged. This is a full content and structural rewrite of one file.

## Goals / Non-Goals

**Goals:**
- Lead with platform identity: AI agent for Indian CA accounting automation
- Surface all 8 modules in one scannable section so a new visitor immediately understands breadth
- Establish 4–5 platform trust pillars (zero hallucination, Tally-native, India-resident, built by CAs, DPDP/SOC 2)
- Keep email-capture CTA and pricing functionally identical
- Maintain the existing glassmorphism/card visual language

**Non-Goals:**
- Individual deep-dive pages per module (those are separate routes, not homepage scope)
- Changing pricing data or billing logic
- Modifying shared components (Header, Footer, BaseHead)
- Adding JS animations or scroll effects
- Dark mode / theme changes

## Decisions

**Decision: Platform hero, not notice hero**
The headline must make "AI accounting agent for Indian CA firms" the primary claim. The sub-headline can mention the breadth: tax notices, audit, reconciliation, financials. This is a bigger tent than the old "30-minute notice reply" hook.

**Decision: 8-module grid as the centrepiece section**
Rather than describing the workflow of one module, show all 8 modules as cards. Each card: icon + module name + one-line description + one highlighted capability (e.g. "Zero hallucination · verified citations" for Notice Workflow, "FIFO engine · Tally-ready XML" for Broker Ledger). This is the most information-dense, skim-friendly way to communicate breadth.

Module list and one-liners (authoritative from repo docs):
1. **Notice Workflow** — Draft IT notice replies (142(1), 143(3), 148A) grounded in verified case law. _Highlight: 8-stage verification, zero hallucination_
2. **Broker Ledger** — Convert broker tradebooks to Tally journal vouchers via FIFO matching. _Highlight: Equity, ETF, F&O, commodity trades_
3. **Vouching** — Match Tally entries against source documents; render audit verdicts. _Highlight: SA 230-compliant working papers_
4. **Balance Sheet Builder** — Turn trial balances into Schedule III financials (BS, P&L, Cash Flow). _Highlight: Company, LLP, Partnership, HUF — all entity types_
5. **TDS Reconciliation** — Audit TDS compliance per vendor, per bill, per FY. _Highlight: Statutory section rates + party exemption engine_
6. **Ledger Predictor** — Classify bank-statement transactions to Tally ledgers; push vouchers. _Highlight: 10-stage cascade + Claude review → 90–98% accuracy_
7. **Tally OCR** — Extract supplier invoices and push Purchase vouchers into TallyPrime. _Highlight: Azure DI + vision, GST-split extraction_
8. **Book RAG** — Q&A on IT Act 1961 & 2025 with grounded, citation-first answers. _Highlight: Hybrid retrieval, refusal-anchored_

**Decision: Differentiators section replaces the old "Why Accountic" cards**
The old why-section was IT-notice-scoped. The new version covers platform-level differentiation: (1) Tally-native across all modules, (2) zero hallucination — deterministic-first, LLM only at margins, (3) India-resident data processing + DPDP posture, (4) built by CA firms — 45 years D&I Tax practice, (5) SOC 2 certified tech partner. Five cards in a 3+2 grid.

**Decision: Single-file rewrite, no new components**
Same rationale as before — avoid componentisation churn; keep the diff reviewable in one pass.

**Decision: Remove 30-minute stat and 8-stage pipeline**
These were specific to IT notices. Replace with module grid which conveys depth better for a multi-module platform.

## Risks / Trade-offs

- **Risk**: Showing 8 modules may overwhelm rather than convert → Mitigation: cards are compact (icon + name + 1 line + 1 chip), section has a clear heading and is scannable in 10 seconds.
- **Risk**: Removing the specific "30-minute" claim reduces conversion for IT-notice-first visitors → Mitigation: Notice Workflow card retains the time claim as a chip; hero sub-headline can still mention it.
- **Risk**: Pricing section says "notices" but the platform has per-axis billing → Mitigation: note in pricing copy that plans cover multiple modules; link to `/pricing` or `/contact` for details.

## Open Questions

- Should the hero include a product screenshot or continue with the glass sample-reply card? (Current proposal: replace card with a module-grid mini-preview or keep abstract.)
- Does the pilot launch date ("May 2026") still apply or should it be removed now that the product has more modules?
