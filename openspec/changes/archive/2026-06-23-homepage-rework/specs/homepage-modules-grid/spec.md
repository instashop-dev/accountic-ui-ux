## ADDED Requirements

### Requirement: Modules section shows all 8 product modules
The homepage SHALL include a modules section (`id="modules"`) displaying exactly 8 module cards, one per Accountic module: Notice Workflow, Broker Ledger, Vouching, Balance Sheet Builder, TDS Reconciliation, Ledger Predictor, Tally OCR, Book RAG.

#### Scenario: All 8 module cards rendered
- **WHEN** the modules section is rendered
- **THEN** 8 cards are present, each with a unique module name matching the list above

### Requirement: Each module card shows icon, name, description, and highlight chip
Each module card SHALL contain: a recognisable icon, the module name, a one-line description of what it does, and a small highlight chip conveying the key capability or differentiator.

#### Scenario: Card structure complete
- **WHEN** any individual module card is rendered
- **THEN** it contains an icon element, a heading with the module name, a description paragraph, and a chip/badge element

### Requirement: Module cards are arranged in a responsive grid
The 8 module cards SHALL be laid out in a 4-column grid on ≥1024px viewports, 2-column on 520px–1023px, and 1-column below 520px.

#### Scenario: 4-column grid on desktop
- **WHEN** the modules section is rendered at ≥1024px viewport width
- **THEN** the module cards are arranged in 4 columns

#### Scenario: Single-column on mobile
- **WHEN** the modules section is rendered at <520px viewport width
- **THEN** each module card occupies the full row width

### Requirement: Module cards have hover interaction
Each module card SHALL lift slightly on hover (translateY -2px to -4px) with an elevated box shadow, consistent with the existing card hover pattern in the design system.

#### Scenario: Card lifts on hover
- **WHEN** the user hovers over a module card
- **THEN** the card visually elevates with a shadow increase

### Requirement: Notice Workflow card includes the 30-minute claim
The Notice Workflow module card highlight chip SHALL reference the ≤30-minute drafting time to retain the key conversion signal for IT-notice visitors.

#### Scenario: 30-minute chip on Notice Workflow card
- **WHEN** the Notice Workflow card is rendered
- **THEN** the highlight chip or description references "30 minutes" or "under 30 min"
