## ADDED Requirements

### Requirement: Analysis document covers all seven discovery areas
The system SHALL produce a document at `docs/blog-automation-analysis.md` that contains verified findings for each of the following areas: Astro architecture, blog/content system, admin/auth system, Cloudflare setup, deployment pipeline, design system, and existing utilities/components. Each area MUST be sourced directly from reading production source files — no assumptions or placeholders.

#### Scenario: All seven areas present
- **WHEN** the analysis document is opened
- **THEN** it contains a named section for each of: Astro Architecture, Blog & Content System, Admin & Auth System, Cloudflare Setup, Deployment Pipeline, Design System, and Utilities & Components

#### Scenario: Findings are source-verified
- **WHEN** any finding references a file, schema field, binding name, or configuration value
- **THEN** that value can be confirmed by reading the referenced file at the stated path

### Requirement: Analysis document includes an integration strategy
The document SHALL include an Integration Strategy section that prescribes which files may be modified, which must remain frozen, and what new namespaces must be created for the AI blogging subsystem.

#### Scenario: Frozen files enumerated
- **WHEN** the Integration Strategy section is read
- **THEN** it explicitly lists files that MUST NOT be modified during subsequent implementation phases

#### Scenario: New namespaces enumerated
- **WHEN** the Integration Strategy section is read
- **THEN** it lists each new directory or namespace that will be created (e.g., `src/lib/`, `src/pages/admin/`, `src/workers/`) with a one-line description of its purpose

### Requirement: Analysis document includes a file modification plan
The document SHALL include a File Modification Plan section that categorises every anticipated file change as MODIFY, ADD, or DO NOT MODIFY with a brief reason for each entry.

#### Scenario: Every anticipated production file change categorised
- **WHEN** the File Modification Plan section is read
- **THEN** every file expected to change across all implementation phases has a row with its path, action (MODIFY/ADD/DO NOT MODIFY), and a one-line reason

### Requirement: Analysis document includes a risk analysis
The document SHALL include a Risk Analysis section listing at least five identified integration risks, each with a stated mitigation strategy or escalation path.

#### Scenario: Risks enumerated with mitigations
- **WHEN** the Risk Analysis section is read
- **THEN** each risk entry has: a risk statement, a severity indicator (High/Medium/Low), and a mitigation or escalation path

#### Scenario: Auth risk explicitly called out
- **WHEN** the Risk Analysis section is read
- **THEN** it includes a risk entry covering the absence of admin route authentication and states that admin routes MUST NOT be merged without accompanying auth middleware

### Requirement: Analysis document records open questions
The document SHALL include an Open Questions section listing unresolved technical decisions that must be answered before or during subsequent implementation phases.

#### Scenario: Open questions listed
- **WHEN** the Open Questions section is read
- **THEN** it contains at least two open questions, each with a note on which implementation phase must resolve it

### Requirement: No production files are modified during discovery
The system SHALL NOT modify, create, or delete any file outside of `docs/` and `openspec/changes/blog-automation-discovery/` during the discovery phase.

#### Scenario: Source tree unchanged after discovery
- **WHEN** `git diff --name-only HEAD` is run after the discovery change is committed
- **THEN** no paths beginning with `src/`, `public/`, `astro.config.mjs`, `wrangler.jsonc`, or `package.json` appear in the diff
