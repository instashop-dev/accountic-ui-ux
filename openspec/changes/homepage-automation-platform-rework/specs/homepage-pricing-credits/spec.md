## ADDED Requirements

### Requirement: Pricing tiers are defined by credit volume, not notice count
The three pricing tiers SHALL communicate monthly credit allocations as the primary differentiator. Features lists SHALL NOT use "notices / month" as a tier differentiator. The tiers are:
- Free: ₹0, one-time, ₹1,000 credits (no card required)
- Basic: ₹2,000/month, 2,000 credits/month
- Pro: ₹20,000/month, 60,000 credits/month

#### Scenario: Free tier communicates ₹1,000 credits
- **WHEN** a visitor reads the Free tier card
- **THEN** the features list or blurb SHALL state "₹1,000 credits" (or equivalent) and "No card required"

#### Scenario: Basic tier shows 2,000 credits/month
- **WHEN** a visitor reads the Basic tier card
- **THEN** the features list SHALL state "2,000 credits / month" as the primary entitlement, not a notice count

#### Scenario: Pro tier shows 60,000 credits/month
- **WHEN** a visitor reads the Pro tier card
- **THEN** the features list SHALL state "60,000 credits / month" as the primary entitlement, not a notice count

### Requirement: All plans include access to all 14 modules
Every tier's features list SHALL explicitly state that all modules are accessible on that plan. No tier SHALL imply that module access is gated by plan level.

#### Scenario: Free tier says all modules are accessible
- **WHEN** a visitor reads the Free tier features
- **THEN** there SHALL be a line stating "All 14 modules" or "Access to every module"

#### Scenario: Basic and Pro tiers also state all-module access
- **WHEN** a visitor reads Basic or Pro tier features
- **THEN** both SHALL include "All 14 modules" or equivalent

### Requirement: All plans support manual credit top-ups
Every tier's features list or the section explanatory note SHALL mention that manual credit top-ups are available on all plans.

#### Scenario: Top-up availability is communicated
- **WHEN** a visitor reads the pricing section
- **THEN** the phrase "manual top-up" or equivalent SHALL appear at least once — either in individual tier feature lists or in the explanatory note below the tiers

### Requirement: Pricing explanatory note clarifies the credit model
The note below the pricing tiers SHALL explain that credit consumption varies by module and document volume (since 1 credit = ₹1 but different workflows consume different amounts).

#### Scenario: Credit model note is present
- **WHEN** a visitor reads the bottom of the pricing section
- **THEN** there SHALL be a note explaining that credits are consumed at different rates per module, so visitors understand the ₹/credit relationship

### Requirement: Final CTA does not reference notices
The `<h2>` and body copy in the final CTA section SHALL NOT say "three notices free" or use notice-count framing. The primary message SHALL be "try every module" or "access the full platform" with ₹1,000 credits as the hook.

#### Scenario: CTA headline is module-agnostic
- **WHEN** a visitor reads the final CTA headline
- **THEN** it SHALL NOT contain the word "notice" or "notices"

#### Scenario: CTA body copy references ₹1,000 credits
- **WHEN** a visitor reads the CTA body copy
- **THEN** it SHALL state "₹1,000 free credits" or equivalent as the free trial value proposition
