## ADDED Requirements

### Requirement: PILLARS contains exactly 9 India-specific entries
`src/blog-meta.ts` SHALL export a `PILLARS` const tuple containing exactly these 9 string values in order:
`'Income Tax Notices'`, `'Faceless Assessment'`, `'DPDP Compliance'`, `'ICAI Ethics'`, `'Case Law Notes'`, `'CA Firm Automation'`, `'AI Tools for Indian CAs'`, `'GST Automation'`, `'Audit Technology'`.
The value `'Firm Operations'` SHALL NOT appear in PILLARS.

#### Scenario: New pillars accepted by content validation
- **WHEN** a blog post frontmatter specifies `pillar: "AI Tools for Indian CAs"`
- **THEN** `z.enum(PILLARS)` validation passes without error

#### Scenario: Firm Operations rejected by content validation
- **WHEN** a blog post frontmatter specifies `pillar: "Firm Operations"`
- **THEN** `z.enum(PILLARS)` validation fails with an enum error

#### Scenario: All 9 pillars accepted
- **WHEN** each of the 9 pillar values is used as a post frontmatter `pillar` field
- **THEN** all 9 pass `z.enum(PILLARS)` validation

#### Scenario: Blog filter chips render for all 9 pillars
- **WHEN** the blog index page renders with posts spanning multiple pillars
- **THEN** a filter chip is rendered for each of the 9 PILLARS values

### Requirement: Topic-discovery pillar validation accepts all 9 pillars
The topic-discovery worker SHALL accept AI-generated topic candidates whose `pillar` field matches any of the 9 PILLARS values and SHALL reject any candidate whose `pillar` field does not match (including `'Firm Operations'`).

#### Scenario: New pillar topic accepted
- **WHEN** the AI returns a candidate with `pillar: "GST Automation"`
- **THEN** the candidate passes pillar validation and is eligible for insertion into the topics table

#### Scenario: Removed pillar topic rejected
- **WHEN** the AI returns a candidate with `pillar: "Firm Operations"`
- **THEN** the candidate is skipped with a warning log and NOT inserted into topics

#### Scenario: Coverage brief shows all 9 pillars
- **WHEN** `buildCoverageBrief` is called after `blog-meta.ts` is updated
- **THEN** the counts section contains a line for each of the 9 PILLARS, defaulting to 0 for pillars with no topics

## REMOVED Requirements

### Requirement: PILLARS includes Firm Operations
**Reason**: Replaced by `CA Firm Automation`, which carries the same content territory with an automation-first framing aligned to Accountic's AI product vision.
**Migration**: Any existing topics or posts with `pillar = 'Firm Operations'` in D1 must be manually updated to `'CA Firm Automation'` before or during deployment. (Current D1 count is 0 — no data migration required at time of writing.)
