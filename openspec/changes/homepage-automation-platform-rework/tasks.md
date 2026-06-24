## 1. Pre-flight Check

- [x] 1.1 Check whether `src/pages/pricing.astro` exists — if it does, note it needs a parallel pricing copy update
- [x] 1.2 Confirm the credit cost per module is documented (or decide the pricing note stays generic)

## 2. Hero Section

- [x] 2.1 Rewrite `<h1>` — broaden from "Indian CA firms" to "Indian accounting practice" or "Indian CAs and accounting teams"
- [x] 2.2 Rewrite hero subtitle — lead with automation-across-workflows framing, mention Tally integration, remove notice-first ordering
- [x] 2.3 Change primary CTA label from "Get 3 notices free" to credit-based copy (e.g., "Start free — ₹1,000 credits")
- [x] 2.4 Replace hero visual markup: change `.hv-body` from 3-column (source | arrow | reply) to 3-row grid, each row showing one input → output pair (notice PDF → reply, bank statement → Tally vouchers, supplier invoice → GST Purchase voucher)
- [x] 2.5 Update `.hv-bar` tab label from "Notice Workflow · s.143(3) scrutiny" to a platform-level label (e.g., "Accountic · Automation Platform")
- [x] 2.6 Update `.hv-foot` stats — keep "0 hallucinations" and "All data stays in India"; replace "24 min · ready for letterhead" with a cross-module trust signal
- [x] 2.7 Add CSS for 3-row hero visual layout; ensure mobile collapse (each row full-width stacked at ≤ 680px)

## 3. Stats Strip

- [x] 3.1 Replace stat[0] ("< 30 min · From notice PDF to filed reply") with a platform-wide stat (e.g., "₹1,000 · Free credits to try every module" or "90–98% · Ledger Predictor classification accuracy")
- [x] 3.2 Update stat[1] label from "Workflows on one platform" to "Live workflows · 20+ in development" (or update the value to "14 live")

## 4. Problem Section

- [x] 4.1 Rewrite `painPoints[0]` title and description — broaden from "Every notice starts from a blank page" to a module-agnostic framing (e.g., "Every compliance task starts from scratch")
- [x] 4.2 Update `problem-bridge` paragraph — add "Twenty more in development" or equivalent forward-looking phrase after the fourteen-workflows mention

## 5. Module Grid

- [x] 5.1 Remove `flag: 'core'` from the Notice Workflow entry in the `modules` array
- [x] 5.2 Remove `.module-card--core` CSS rule (the `grid-column: span 2` rule and its green-gradient background)
- [x] 5.3 Remove `.module-flag` CSS rule and the `{m.flag === 'core' && <span class="module-flag">Core module</span>}` render condition
- [x] 5.4 Rewrite all `chip` values in the `modules` array to be outcome-first (see design.md D6 for per-module examples)
- [x] 5.5 Append a 15th list item to the module grid: "20+ modules coming" card with dashed border, muted palette, and link to `#cta`
- [x] 5.6 Add CSS for the coming-soon card variant (dashed border, reduced opacity icon, muted chip)
- [x] 5.7 Update modules section `<h2>` from "Fourteen modules. One platform." to reflect both live count and coming signal (e.g., "14 modules live. 20+ more coming.")

## 6. "How It Works" Section

- [x] 6.1 Delete `const noticeSteps` array
- [x] 6.2 Replace the `<section class="how-it-works">` markup with a 3-column layout section
- [x] 6.3 Add three workflow family columns: "Compliance & Litigation" (Notice, Appeal, Book Q&A), "Data → Tally" (Ledger Predictor, Tally OCR, GSTR-2B), "Firm Operations" (Debtor Follow-up, Sales Bills, TDS Reconciliation)
- [x] 6.4 Each column: family heading + 3 steps (upload/input → Accountic processes → output to Tally or export)
- [x] 6.5 Rewrite section `<h2>` to be platform-level (no "notice", "PDF", or "30 minutes")
- [x] 6.6 Add CSS for the 3-column how-it-works layout; collapse to single column on mobile (≤ 800px)
- [x] 6.7 Remove `.hiw-*` CSS rules that are no longer used after the markup replacement

## 7. Pricing Section

- [x] 7.1 Update `pricingTiers[0]` (Free): blurb to "₹1,000 credits. No card required."; features to ["₹1,000 free credits", "All 14 modules", "Manual top-up available", "Full citation verification", "Email support"]
- [x] 7.2 Update `pricingTiers[1]` (Basic): blurb to "For solo practitioners."; features to ["2,000 credits / month", "All 14 modules", "Manual top-up available", "Soft quota — no mid-month cutoff", "GST invoice with your GSTIN"]
- [x] 7.3 Update `pricingTiers[2]` (Pro): blurb to "For high-volume CAs and firms."; features to ["60,000 credits / month", "All 14 modules", "Manual top-up available", "Priority support", "Bulk historical upload"]
- [x] 7.4 Update `pricing-note` paragraph — add explanation of credit model: "1 credit = ₹1. Credit consumption varies by module and document volume. Manual top-ups available on all plans at any time."
- [x] 7.5 Update pricing section `<h2>` if it references notices — ensure it stays module-agnostic

## 8. Final CTA Section

- [x] 8.1 Rewrite CTA `<h2>` from "Start with three notices free." to "Start free. Try every module."
- [x] 8.2 Rewrite CTA body copy — replace notice framing with "₹1,000 free credits — no card required. Access all 14 modules." framing
- [x] 8.3 Verify `data-source="homepage-cta"` and form submission logic are unchanged (no functional changes needed)

## 9. Verification

- [x] 9.1 Run `npm run build` (or equivalent) and confirm zero build errors
- [x] 9.2 Start dev server and visually verify hero visual renders correctly on desktop and mobile
- [x] 9.3 Confirm module grid shows 15 equal-width cards (14 live + 1 coming-soon) with no double-width card
- [x] 9.4 Confirm "How it works" shows 3 columns on desktop, single column on mobile
- [x] 9.5 Confirm pricing tiers show credit volumes, not notice counts
- [x] 9.6 Confirm CTA section contains no reference to "notices"
- [x] 9.7 If `/pricing` page exists, verify its copy is consistent with the new credit-based model
