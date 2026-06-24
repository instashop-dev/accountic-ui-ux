## ADDED Requirements

### Requirement: Four pricing tiers are displayed
The homepage SHALL include a pricing section (`id="pricing"`) with four tier cards: Free trial (₹0), Basic (₹2,000/month), Pro (₹20,000/month), Firm (Custom) — with name, price, blurb, feature list, and CTA button.

#### Scenario: All four tiers rendered
- **WHEN** the pricing section renders
- **THEN** four tier cards are present with the correct prices ₹0, ₹2,000, ₹20,000, Custom

### Requirement: Pricing copy reflects multi-module platform context
The pricing section headline and introductory lede SHALL acknowledge that plans cover access to multiple Accountic modules, not just notice drafting. The lede SHALL clarify that the same verification standards apply across all plans.

#### Scenario: Lede references platform scope
- **WHEN** the pricing section renders
- **THEN** the introductory paragraph references the platform or multiple modules, not solely notices

### Requirement: Pro tier is visually highlighted as most popular
The Pro tier card SHALL use a dark/inverse background and display a "Most popular" badge above the card.

#### Scenario: Pro tier badge visible
- **WHEN** the pricing section renders
- **THEN** the Pro tier card has a "Most popular" badge and visually distinct background

### Requirement: Billing note about Indian payment methods is shown
Below the tier grid the page SHALL display a note confirming: GST-compliant invoicing, Razorpay (NEFT/UPI/cards), no USD billing, TDS-deductible where applicable.

#### Scenario: Billing note present
- **WHEN** the pricing section renders
- **THEN** the billing note text is visible below the tier grid
