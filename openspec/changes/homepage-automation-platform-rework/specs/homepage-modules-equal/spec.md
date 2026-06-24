## ADDED Requirements

### Requirement: All 14 module cards have equal visual weight
No module card SHALL have a `flag` property that causes it to span multiple grid columns or receive a visually distinct "core module" treatment. The `module-card--core` CSS variant SHALL be removed from the rendered output.

#### Scenario: Notice Workflow card has same size as other cards
- **WHEN** a visitor views the module grid
- **THEN** the Notice Workflow card SHALL occupy exactly one grid column, the same as every other module card

#### Scenario: No "Core module" badge is visible
- **WHEN** a visitor views the module grid
- **THEN** no card SHALL display a "Core module" or equivalent badge

### Requirement: Module chips describe outcomes, not technology
Each module card's chip text SHALL lead with a user-facing outcome (time saved, accuracy, what gets produced) rather than the underlying technology or internal architecture.

#### Scenario: Broker Ledger chip is outcome-first
- **WHEN** a visitor reads the Broker Ledger module chip
- **THEN** it SHALL communicate an outcome such as "Tradebook → Tally in minutes" rather than "FIFO engine · Tally-ready XML"

#### Scenario: GSTR-2B chip communicates time saving
- **WHEN** a visitor reads the GSTR-2B Reconciliation chip
- **THEN** it SHALL communicate a time or effort saving (e.g., "Day of spreadsheet work → minutes") rather than billing mechanics ("Pure compute · billed per row")

#### Scenario: Ledger Predictor chip leads with accuracy
- **WHEN** a visitor reads the Ledger Predictor chip
- **THEN** it SHALL lead with "90–98% accuracy" or "500 transactions classified, hands-free" rather than internal pipeline description

### Requirement: A "20+ modules coming" card appears as the last item in the module grid
A 15th list item SHALL be appended to the module grid communicating that more than 20 additional modules are in development. It SHALL be visually distinct from live module cards (dashed border, muted palette) so it is not confused with an available module.

#### Scenario: Coming-soon card is visually distinguishable
- **WHEN** a visitor scans the module grid
- **THEN** the "20+ coming" card SHALL use a dashed border or equivalent muted styling clearly different from the solid-border live module cards

#### Scenario: Coming-soon card links to the email capture CTA
- **WHEN** a visitor clicks or interacts with the "20+ coming" card
- **THEN** they SHALL be taken to or directed toward the email capture section (`#cta`) or equivalent waitlist mechanism
