## ADDED Requirements

### Requirement: Hero communicates platform identity above the fold
The hero section SHALL lead with a platform-level headline positioning Accountic as an AI accounting agent for Indian CA firms — not as a single-module tool. The headline, sub-headline, and CTA pair SHALL all be visible without scrolling on a 1440px desktop viewport.

#### Scenario: Platform headline visible on load
- **WHEN** a user opens the homepage on a 1440px desktop
- **THEN** a headline referencing AI accounting automation for Indian CA firms is visible without scrolling

### Requirement: Hero includes a sub-headline naming module breadth
The sub-headline SHALL reference at least three product domains (e.g. tax notices, audit, financials) to communicate breadth before the visitor scrolls.

#### Scenario: Sub-headline references multiple domains
- **WHEN** the hero section is rendered
- **THEN** the sub-headline text references at least three distinct accounting/tax domains

### Requirement: Hero CTA pair links to modules section and email form
The hero SHALL contain a primary CTA ("Explore modules" or "See what Accountic does") scrolling to `#modules` and a secondary CTA ("Request access") linking to `#cta`.

#### Scenario: Primary CTA scrolls to modules
- **WHEN** the user clicks the primary hero CTA
- **THEN** the viewport scrolls to the modules grid section

### Requirement: Trust badge strip shows platform-level compliance signals
The hero SHALL include a badge strip with: SOC 2 Type II, DPDP-ready, India-resident data, Built by CAs, Tally-native.

#### Scenario: Five trust badges present
- **WHEN** the hero section renders
- **THEN** five trust badge items are visible below the CTA buttons
