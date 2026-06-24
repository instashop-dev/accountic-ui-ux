## 1. Scaffold and frontmatter

- [x] 1.1 Open `src/pages/index.astro` — keep all imports (BaseHead, Footer, Header, SITE_TITLE) and replace the data arrays with: `modules` (8 items with id, name, icon, description, chip) and `pricingTiers` (4 items, unchanged data)
- [x] 1.2 Update `metaTitle` and `metaDescription` to reflect the platform (AI accounting agent for Indian CA firms)
- [x] 1.3 Retain the HTML shell: `<BaseHead>`, `<Header>`, `<main id="main">`, `<Footer>`, and the inline `<script is:inline>` email-capture JS unchanged

## 2. Hero section

- [x] 2.1 Write the `.hero` section with a launch badge, platform-level `<h1>` headline ("Your AI accounting agent — built for Indian CA firms" or equivalent), and a sub-headline naming at least three product domains
- [x] 2.2 Write CTA pair: primary → `#modules` ("Explore modules"), secondary → `#cta` ("Request access")
- [x] 2.3 Write the trust badge strip with 5 items: SOC 2 Type II, DPDP-ready, India-resident data, Built by CAs, Tally-native — each with icon
- [x] 2.4 Write hero CSS: all `.hero`, `.hero-inner`, `.hero-badge`, `.hero-title`, `.hero-subtitle`, `.hero-cta`, `.trust-badges` rules (can reuse from current file verbatim, adjust badge count)

## 3. Modules grid section

- [x] 3.1 Write the `#modules` section with a `<section-label>`, `<h2>` ("Eight modules. One platform."), and a brief lede
- [x] 3.2 Render 8 module cards via `modules.map()` — each card: 44px icon container, `<h3>` module name, `<p>` one-line description, `<span>` highlight chip
- [x] 3.3 Module data to embed in frontmatter array:
  - Notice Workflow — "Draft IT notice replies grounded in verified case law" — chip: "< 30 min · zero hallucination"
  - Broker Ledger — "Convert broker tradebooks to Tally journal vouchers via FIFO" — chip: "Equity · ETF · F&O · Commodity"
  - Vouching — "Match Tally entries against source documents; render audit verdicts" — chip: "SA 230-compliant"
  - Balance Sheet Builder — "Turn trial balances into Schedule III financials" — chip: "Company · LLP · HUF · Trust"
  - TDS Reconciliation — "Audit TDS compliance per vendor, per bill, per FY" — chip: "Statutory section rules"
  - Ledger Predictor — "Classify bank transactions to Tally ledgers; push vouchers" — chip: "90–98% accuracy"
  - Tally OCR — "Extract supplier invoices and push Purchase vouchers into TallyPrime" — chip: "Azure DI + vision"
  - Book RAG — "Q&A on IT Act 1961 & 2025 with grounded, citation-first answers" — chip: "Refusal-anchored"
- [x] 3.4 Write modules grid CSS: `.modules-section`, `.modules-grid` (4-col → 2-col → 1-col), `.module-card`, `.module-icon`, `.module-chip` — use existing card/glass patterns

## 4. Differentiators section

- [x] 4.1 Write the "Why Accountic" section with a 5-card showcase grid using the existing `.cv-showcase` / `.cv-card` / `.glass-card` / `.cv-hero` patterns
- [x] 4.2 Cards in order: (1) Tally-native [hero card, span 4], (2) Zero hallucination, (3) India-resident / DPDP, (4) Built by CAs, (5) SOC 2 certified
- [x] 4.3 Each non-hero card spans 2 columns (existing `.cv-card:not(.cv-hero) { grid-column: span 2 }` pattern)
- [x] 4.4 Reuse all existing `.cv-showcase`, `.cv-card`, `.cv-hero`, `.card-icon`, `.glass-card` CSS rules verbatim — no changes needed

## 5. Pricing section

- [x] 5.1 Write `#pricing` section with updated lede referencing platform access (not only notices)
- [x] 5.2 Render 4 tier cards via `pricingTiers.map()` — identical data, identical markup to current file
- [x] 5.3 Retain Pro tier `featured` class, "Most popular" badge, and dark background
- [x] 5.4 Keep billing note below the grid
- [x] 5.5 Reuse all existing `.pricing`, `.tiers`, `.tier`, `.tier-badge`, `.tier-features` CSS rules verbatim

## 6. CTA section

- [x] 6.1 Write `#cta` section — update eyebrow and headline copy to reference full platform access (e.g. "Get early access to the full platform")
- [x] 6.2 Keep form markup verbatim: `data-capture`, `data-capture-form`, form state + thank-you state
- [x] 6.3 Keep `<script is:inline>` email-capture JS byte-for-byte unchanged
- [x] 6.4 Reuse all existing `.cta-section`, `.cta-card`, `.cta-form`, `.cta-thanks-*` CSS rules verbatim

## 7. CSS cleanup and global styles

- [x] 7.1 Remove all CSS rules that had selectors only used in removed sections: `.outcome-*`, `.verify-*`, `.pipeline`, `.pipeline-*`, `.q-card`, `.q-*`, `.quality-*`, `.steps`, `.step`, `.step-*`, `.hc-*`, `.hero-card`
- [x] 7.2 Keep all CSS rules reused in new sections: `.hero`, `.trust-badges`, `.section`, `.section-head`, `.lede`, `.glass`, `.glass-card`, `.cv-showcase`, `.cv-card`, `.cv-hero`, `.card-icon`, `.btn`, `.tiers`, `.tier`, `.cta-*`
- [x] 7.3 Verify all responsive breakpoints (`@media`) still have matching elements

## 8. Verification

- [x] 8.1 Run `npm run build` (or `astro build`) — confirm zero build errors
- [x] 8.2 Start dev server; visually verify hero, modules grid (all 8 cards), differentiators (5 cards), pricing (4 tiers), and CTA each render correctly
- [x] 8.3 Submit a test email in the CTA form — confirm thank-you state appears and `localStorage` entry is written
- [x] 8.4 Check mobile layout at 375px — confirm sections stack single-column without overflow
- [x] 8.5 Verify anchor links: hero primary CTA scrolls to `#modules`, hero secondary CTA scrolls to `#cta`
