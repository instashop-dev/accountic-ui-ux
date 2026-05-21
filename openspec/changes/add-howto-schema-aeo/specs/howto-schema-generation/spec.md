## ADDED Requirements

### Requirement: seo-schema module generates HowTo JSON-LD from numbered workflow
`src/lib/seo-schema.ts` SHALL export a `generateHowToSchema(content: string, title: string, description: string): string | null` function that scans the article body for a sequential numbered list of 3 or more items (matching the pattern `^\s*\d+\.\s+.+` on consecutive lines with incrementing numbers), extracts each item as a `HowToStep`, and returns a valid `HowTo` JSON-LD string. The function SHALL return `null` if fewer than 3 sequential steps are found. Each `HowToStep` object SHALL include `@type: "HowToStep"`, `name` (first 60 characters of the step text, stripped of leading number and markdown bold markers), and `text` (full step text, stripped of leading `N. `).

#### Scenario: Article with 7-step workflow returns HowTo JSON-LD
- **WHEN** `generateHowToSchema(content, title, description)` is called on an article containing a numbered list from 1 to 7
- **THEN** it returns a non-null JSON string with `@type: "HowTo"`, `name` equal to the article title, `description` equal to the article description, and a `step` array with 7 `HowToStep` entries

#### Scenario: Article with fewer than 3 steps returns null
- **WHEN** `generateHowToSchema` is called on content containing a 2-item numbered list
- **THEN** it returns `null`

#### Scenario: Article with no numbered list returns null
- **WHEN** `generateHowToSchema` is called on content with no numbered list items
- **THEN** it returns `null`

#### Scenario: Non-sequential numbering does not qualify
- **WHEN** content contains numbered items `1.`, `1.`, `2.` (duplicate numbers, non-sequential)
- **THEN** `generateHowToSchema` returns `null` because no consecutive sequence of 3+ is found

#### Scenario: Step name is truncated to 60 characters
- **WHEN** a step text is longer than 60 characters
- **THEN** the `HowToStep.name` field contains at most 60 characters

#### Scenario: Markdown bold markers stripped from step name
- **WHEN** a step text is `**Obtain your recorded reasons** — request them formally`
- **THEN** `HowToStep.name` is `Obtain your recorded reasons — request them formally` (no asterisks), truncated to 60 chars

#### Scenario: Returned JSON-LD is valid JSON
- **WHEN** `generateHowToSchema` returns a non-null value
- **THEN** `JSON.parse()` on the returned string does not throw
