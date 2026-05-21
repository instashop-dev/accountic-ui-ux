## ADDED Requirements

### Requirement: scoreArticle detects audience signal from slug and validates voice match
`scoreArticle()` in `src/lib/quality.ts` SHALL accept an optional third parameter `slug: string` and, when the slug contains an assessee-intent pattern (`for-assessees`, `taxpayer`, `what-to-do-when`, `guide-for-individuals`), verify that the article body contains second-person assessee voice markers. If the slug signals an assessee audience but the article body lacks assessee voice markers, `scoreArticle` SHALL add an audience mismatch error to the errors array and set `scores.audienceVoiceValid` to `false`.

#### Scenario: Assessee-intent slug with assessee-voice article passes
- **WHEN** `scoreArticle(content, frontmatter, 'section-148-notice-reply-step-by-step-guide-for-assessees')` is called and the content contains "you received", "your notice", or similar second-person possessive phrases near "notice" or "reply"
- **THEN** `scores.audienceVoiceValid` is `true` and no audience mismatch error is added

#### Scenario: Assessee-intent slug with CA-voice article fails
- **WHEN** `scoreArticle(content, frontmatter, 'section-148-guide-for-assessees')` is called and the content uses only third-person CA-instruction language ("the CA should", "the assessee must file") without second-person assessee voice
- **THEN** `scores.audienceVoiceValid` is `false` and errors includes a message containing "audience mismatch"

#### Scenario: Non-assessee slug skips audience check
- **WHEN** `scoreArticle(content, frontmatter, 'section-148-reply-template')` is called (no assessee-intent pattern in slug)
- **THEN** `scores.audienceVoiceValid` is `true` (check is skipped, not failed) and no audience error is added

#### Scenario: Missing slug argument skips audience check
- **WHEN** `scoreArticle(content, frontmatter)` is called without a slug argument
- **THEN** `scores.audienceVoiceValid` is `true` and no audience error is added (backwards-compatible)

### Requirement: QualityReport type includes audienceVoiceValid score
The `QualityReport` interface in `src/lib/quality.ts` SHALL include `audienceVoiceValid: boolean` in the `scores` object alongside the existing `readability`, `originality`, and `schemaValid` fields.

#### Scenario: QualityReport always contains audienceVoiceValid
- **WHEN** `scoreArticle()` is called with any combination of arguments
- **THEN** the returned `QualityReport.scores` object always contains an `audienceVoiceValid` boolean field

### Requirement: article-generation worker passes slug to scoreArticle
`src/workers/pipeline/article-generation.ts` SHALL pass the article slug (derived from the topic title) as the third argument to `scoreArticle()` so the audience gate is applied during automated generation, not only at manual validation time.

#### Scenario: Automated generation validates audience voice
- **WHEN** the article-generation worker calls `scoreArticle()` after generating article content
- **THEN** the call includes the slug as the third argument and a voice mismatch causes the draft to be rejected (not published to the queue)
