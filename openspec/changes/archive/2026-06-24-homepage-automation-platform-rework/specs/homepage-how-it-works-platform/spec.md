## ADDED Requirements

### Requirement: "How it works" section covers three workflow families, not one module
The "How it works" section SHALL present three parallel workflow families — Compliance & Litigation, Data → Tally Automation, and Firm Operations — each with a short step sequence. The existing 7-step Notice Workflow deep-dive SHALL be removed.

#### Scenario: Section shows three columns
- **WHEN** a visitor reads the "How it works" section
- **THEN** there SHALL be exactly three columns or panels, one per workflow family, rendered side-by-side on desktop

#### Scenario: Each column has a family label
- **WHEN** a visitor reads any column in the section
- **THEN** the column SHALL have a heading identifying the workflow family (e.g., "Compliance & Litigation", "Data → Tally", "Firm Operations")

#### Scenario: No single module is singled out for a 7-step deep-dive
- **WHEN** a visitor reads the "How it works" section
- **THEN** no individual module SHALL have more than 3–4 steps described, and no module SHALL be the sole subject of the section

### Requirement: Each workflow family column shows 3 representative steps
Each of the three family columns SHALL show 3 steps that represent the general pattern for that family — upload/input, Accountic processes, output to Tally or export — using module examples drawn from that family.

#### Scenario: Compliance column references notice or appeal examples
- **WHEN** a visitor reads the Compliance & Litigation column
- **THEN** it SHALL reference uploading a compliance document (notice, tradebook, or invoice), AI-assisted drafting or retrieval, and exporting to letterhead or Tally

#### Scenario: Data → Tally column references reconciliation or classification
- **WHEN** a visitor reads the Data → Tally column
- **THEN** it SHALL reference uploading a bank statement, CSV, or invoice, automated classification or matching, and posting vouchers to TallyPrime

#### Scenario: Firm Operations column references AR or billing examples
- **WHEN** a visitor reads the Firm Operations column
- **THEN** it SHALL reference syncing debtor balances or creating sales bills, automated scoring or GST compliance, and sending emails or posting to Tally

### Requirement: Section heading is platform-level, not module-level
The section `<h2>` SHALL describe the general automation pattern across the platform, not reference the Notice Workflow or any single module by name.

#### Scenario: Section heading does not mention "notice" or "PDF"
- **WHEN** a visitor reads the "How it works" section heading
- **THEN** the `<h2>` SHALL NOT contain the words "notice", "PDF", or "30 minutes" (or any other single-module metric)
