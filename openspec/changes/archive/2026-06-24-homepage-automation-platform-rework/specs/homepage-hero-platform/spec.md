## ADDED Requirements

### Requirement: Hero headline addresses all three audience types
The hero `<h1>` SHALL use language that speaks to individual CAs, CA firms, and in-house accounting divisions — not only CA firms. The phrase "Indian CA firms" SHALL be replaced with broader copy such as "Indian accounting practice" or "Indian CAs and accounting teams."

#### Scenario: Accounting department visitor reads the headline
- **WHEN** a visitor who runs an in-house accounting division lands on the homepage
- **THEN** the `<h1>` SHALL NOT contain the phrase "CA firms" as the sole audience identifier

#### Scenario: Headline still communicates India-first positioning
- **WHEN** any visitor reads the hero headline
- **THEN** the word "Indian" or "India" SHALL appear in the `<h1>` to signal the product is built for the Indian market

### Requirement: Hero subtitle leads with automation breadth, not notice specifics
The hero subtitle SHALL describe automation across multiple workflow types (compliance, reconciliation, reporting) before or instead of naming any single module. The phrase "IT notice replies" SHALL NOT appear as the first or only example in the subtitle.

#### Scenario: Subtitle communicates platform breadth
- **WHEN** a visitor reads the hero subtitle
- **THEN** it SHALL reference at least two distinct workflow families (e.g., compliance work AND reconciliation AND reporting, or similar groupings)

#### Scenario: Subtitle mentions Tally integration
- **WHEN** a visitor reads the hero subtitle
- **THEN** it SHALL mention that outputs post directly into TallyPrime or Tally, establishing the Tally-native value proposition above the fold

### Requirement: Primary CTA references credits, not notices
The primary hero CTA SHALL reference the free credit offer ("₹1,000 free credits" or "Start free") rather than "Get 3 notices free" or any notice-specific framing.

#### Scenario: CTA copy does not mention notices
- **WHEN** a visitor sees the primary hero CTA button
- **THEN** the button label SHALL NOT contain the word "notice" or "notices"

#### Scenario: CTA communicates the free credit amount
- **WHEN** a visitor sees the primary hero CTA
- **THEN** the label or surrounding copy SHALL reference ₹1,000 free credits or equivalent free-trial framing

### Requirement: Hero visual shows multiple simultaneous workflow types
The hero visual (`hero-visual` section) SHALL depict at least three distinct input types being processed simultaneously or in parallel — not a single workflow in sequential steps. The three input types SHALL include: a compliance document (e.g., notice PDF), a financial data file (e.g., bank statement), and a transactional document (e.g., supplier invoice).

#### Scenario: Visual shows three input → output pairs
- **WHEN** a visitor views the hero visual
- **THEN** it SHALL show three rows or panels, each with a distinct input type and a corresponding output (e.g., drafted reply, Tally vouchers, GST Purchase voucher)

#### Scenario: Visual footer retains trust signals
- **WHEN** a visitor views the hero visual footer
- **THEN** it SHALL show "0 hallucinations" and "All data stays in India" (or equivalent) as trust signals
