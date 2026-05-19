## ADDED Requirements

### Requirement: Humanizer Worker operates in style-preserving mode only
The humanizer system prompt (stored in D1 `prompts` with `stage = 'humanizer'`) SHALL include an explicit, non-negotiable constraint block. The humanizer Claude call MUST:
- Preserve all factual statements, claims, and assertions verbatim or with trivial wording variations that do not alter meaning
- Preserve all regulatory references (GST, TDS, ITR, TCS, RCM, QRMP, CGST, SGST, IGST, section numbers, notice codes) exactly as written
- Preserve all legal and compliance terminology exactly as written
- Preserve all numerical values (percentages, monetary amounts, dates, deadlines, thresholds) exactly as written
- Preserve all Markdown heading text (`##`, `###`) verbatim or with at most cosmetic punctuation changes
- NOT introduce new case studies, client stories, statistics, legal outcomes, notices, orders, or experiences not present in the original article
- NOT add new examples or claims not present in the original article
- ONLY improve: prose rhythm, sentence variety, transition quality, avoidance of AI-clichéd phrases, readability

The style-preserving constraint SHALL be part of the system prompt structure, not an inline instruction, and SHALL appear as a clearly delimited "CONSTRAINTS" section.

#### Scenario: Regulatory reference is preserved verbatim
- **WHEN** the original article contains "Section 16(4) of the CGST Act"
- **THEN** the humanized output also contains "Section 16(4) of the CGST Act" without modification

#### Scenario: Numerical value is preserved exactly
- **WHEN** the original article contains "₹40 lakh aggregate turnover threshold"
- **THEN** the humanized output contains the same amount without rounding, paraphrasing, or reformatting

#### Scenario: Humanizer does not introduce new case studies
- **WHEN** the original article contains no case study
- **THEN** the humanized output also contains no case study

#### Scenario: Prose rhythm improvements are permitted
- **WHEN** the original article contains three consecutive sentences starting with "You should"
- **THEN** the humanized output may vary the sentence openers without changing the underlying advice

### Requirement: Humanizer uses low-temperature Claude settings
The humanizer Worker SHALL call Claude with `temperature: 0.3` by default. The temperature SHALL be read from the D1 settings key `humanizer_temperature` (float) on each invocation; if absent, it defaults to `0.3`. The value SHALL be clamped to the range 0.2–0.4 before use — values outside this range SHALL be clamped, not rejected.

#### Scenario: Default temperature is used when setting absent
- **WHEN** no `humanizer_temperature` row exists in D1 settings
- **THEN** the Claude call uses `temperature: 0.3`

#### Scenario: Operator-configured temperature within range is used
- **WHEN** `humanizer_temperature = '0.2'` is set in D1 settings
- **THEN** the Claude call uses `temperature: 0.2`

#### Scenario: Out-of-range temperature is clamped
- **WHEN** `humanizer_temperature = '0.8'` is set in D1 settings
- **THEN** the Claude call uses `temperature: 0.4` (clamped to maximum)

### Requirement: Protected content regions are skipped by the humanizer
Before calling Claude, the humanizer Worker SHALL extract all content between `<!-- HUMANIZER_LOCK_START -->` and `<!-- HUMANIZER_LOCK_END -->` HTML comment pairs from the draft content, replace each region with a stable placeholder (`__LOCKED_REGION_0__`, `__LOCKED_REGION_1__`, etc.), send the substituted content to Claude, then re-insert the original locked content by replacing placeholders in Claude's response before writing back to D1. If a placeholder is missing from Claude's response, the Worker SHALL fall back to the original content and log a `regression_detected` event with `failed_gate: 'placeholder_missing'`.

#### Scenario: Locked region is excluded from Claude input
- **WHEN** the draft contains `<!-- HUMANIZER_LOCK_START -->` ... `<!-- HUMANIZER_LOCK_END -->` wrapping a compliance table
- **THEN** the text inside the locked region is replaced with `__LOCKED_REGION_0__` before being sent to Claude

#### Scenario: Locked region is restored after humanization
- **WHEN** Claude returns a response containing `__LOCKED_REGION_0__`
- **THEN** the placeholder is replaced with the original locked content before `drafts.content` is updated

#### Scenario: Missing placeholder triggers fallback
- **WHEN** Claude's response does not contain `__LOCKED_REGION_0__` (placeholder was omitted)
- **THEN** the Worker falls back to original content, sets `drafts.status = 'humanized'` with original text, and logs `regression_detected` with `failed_gate: 'placeholder_missing'`

#### Scenario: Multiple locked regions are handled independently
- **WHEN** the draft contains two locked regions
- **THEN** placeholders `__LOCKED_REGION_0__` and `__LOCKED_REGION_1__` are used, and both are restored independently in the response

### Requirement: Semantic regression detection runs before accepting humanized output
After receiving Claude's response (with locked regions restored), the humanizer Worker SHALL run three gates in order before accepting the humanized content:

**Gate 1 — Similarity:** Compute Jaccard similarity on word bigrams between original and humanized text (after stripping Markdown syntax and HTML comments). If similarity < the `humanizer_similarity_threshold` D1 setting (default `0.70`), reject with `failed_gate: 'similarity'`.

**Gate 2 — Heading structure:** Extract all Markdown headings (`##` and `###`) from both original and humanized text. If any heading present in the original is absent from the humanized output (exact match after trimming), reject with `failed_gate: 'heading'`.

**Gate 3 — Compliance entity:** Extract compliance keywords (`GST`, `TDS`, `ITR`, `PAN`, `TAN`, `GSTIN`, `CGST`, `SGST`, `IGST`, `TCS`, `RCM`, `QRMP`) and section-number patterns (`[Ss]ection\s+\d+[A-Z]?`, `u/s\s+\d+`) and all numeric values (integers and decimals, with currency symbols and comma-separators stripped for normalisation) from the original. If any extracted compliance keyword or normalised numeric value is absent from the humanized text, reject with `failed_gate: 'compliance_entity'`.

On rejection from any gate, the Worker SHALL fall back to original content, set `drafts.status = 'humanized'` using original text, log a `regression_detected` event to Analytics Engine with the `failed_gate` value, and proceed to dispatch to `blog-publish`.

#### Scenario: Similarity gate rejects excessive rewrite
- **WHEN** the humanized bigram Jaccard similarity to the original is 0.55 (below 0.70 threshold)
- **THEN** the Worker falls back to original content and logs `regression_detected` with `failed_gate: 'similarity'`

#### Scenario: Heading gate rejects removed heading
- **WHEN** the original has `## GST Registration Process` and the humanized text does not
- **THEN** the Worker falls back and logs `regression_detected` with `failed_gate: 'heading'`

#### Scenario: Compliance entity gate rejects altered numeric
- **WHEN** the original has "₹1,00,000" and the humanized text has "₹2,00,000"
- **THEN** the compliance entity gate detects the original numeric is missing (after normalisation: `100000` absent) and falls back

#### Scenario: All three gates pass and humanized content is accepted
- **WHEN** similarity ≥ 0.70, all headings present, all compliance entities present
- **THEN** `drafts.content` is updated with humanized text and `drafts.status = 'humanized'`

#### Scenario: Similarity threshold is configurable
- **WHEN** `humanizer_similarity_threshold = '0.60'` is set in D1 settings
- **THEN** the similarity gate uses 0.60 as the rejection threshold

### Requirement: Humanizer Worker consumes `blog-humanize` queue and processes drafts
`src/workers/pipeline/humanizer.ts` SHALL export a Cloudflare Queue handler that reads a `draft_id` from each queue message, fetches the corresponding draft from D1 (`status = 'ready'`), applies protected region extraction, calls the Claude API (claude-haiku-4-5, low temperature), runs semantic regression detection gates, and writes the result back to the `drafts` row with `status = 'humanized'`. The Worker SHALL dispatch `{ "draft_id": "<id>" }` to the `blog-publish` queue on completion (whether using humanized or original fallback content). It SHALL write a row to `humanizer_jobs` recording the outcome.

#### Scenario: Draft with wrong status is skipped
- **WHEN** the humanizer Worker receives a `draft_id` for a draft with `status != 'ready'`
- **THEN** the Worker logs the unexpected status and returns without modifying D1 or calling Claude

#### Scenario: Token budget exceeded falls back to original content
- **WHEN** `checkTokenBudget` returns false before the Claude call
- **THEN** the Worker sets `drafts.status = 'humanized'` using the original content, logs `humanizer_fallback` with `reason: 'budget_exceeded'`, and dispatches to `blog-publish`

#### Scenario: Idempotent retry skips re-humanization
- **WHEN** the humanizer Worker receives a `draft_id` for a draft already at `status = 'humanized'`
- **THEN** the Worker returns without making another Claude call or modifying D1

### Requirement: Humanizer reads active `humanizer` stage prompt from D1
The humanizer Worker SHALL fetch the active prompt for `stage = 'humanizer'` from the D1 `prompts` table before each Claude call. If no active prompt exists, the Worker SHALL log an error, set `drafts.status = 'failed'` with `error = '{ "check": "humanizer_prompt", "error": "No active humanizer prompt found" }'`, and NOT dispatch to `blog-publish`.

#### Scenario: Active humanizer prompt is used
- **WHEN** a row exists in `prompts` with `stage = 'humanizer'` and `is_active = 1`
- **THEN** that prompt text is passed as the system block to the Claude API call

#### Scenario: Missing humanizer prompt fails gracefully
- **WHEN** no row exists in `prompts` with `stage = 'humanizer'` and `is_active = 1`
- **THEN** the draft status is set to `'failed'` with a structured error, no Claude call is made, and no message is dispatched to `blog-publish`

### Requirement: Humanizer emits structured Analytics Engine events
The humanizer Worker SHALL call `logEvent` from `src/lib/analytics.ts` for every outcome:
- `humanizer_success`: humanized content accepted after all three gates pass
- `humanizer_fallback`: original content retained; SHALL include `reason` field (`'regression' | 'budget_exceeded' | 'disabled' | 'prompt_missing'`)
- `regression_detected`: SHALL include `failed_gate` field (`'similarity' | 'heading' | 'compliance_entity' | 'placeholder_missing'`) — this event fires alongside `humanizer_fallback` when fallback is caused by a regression gate failure
- `humanizer_skipped`: draft status was not `'ready'`; no processing performed

#### Scenario: Regression event includes gate identifier
- **WHEN** the heading gate causes a fallback
- **THEN** a `regression_detected` event is logged with `failed_gate: 'heading'` and a `humanizer_fallback` event is logged with `reason: 'regression'`

#### Scenario: Success event is logged on accepted humanization
- **WHEN** all three gates pass and humanized content is written to D1
- **THEN** a `humanizer_success` event is logged with `tokens_used`, `duration_ms`, and `quality_score` (post-humanization Flesch score)

### Requirement: Humanizer can be disabled via D1 settings
The humanizer Worker SHALL read the D1 settings key `humanizer_enabled` on startup. If the value is not `'true'`, the Worker SHALL retain original content, set `drafts.status = 'humanized'`, log `humanizer_fallback` with `reason: 'disabled'`, and dispatch to `blog-publish` without calling Claude.

#### Scenario: Humanizer disabled skips Claude call
- **WHEN** D1 settings `humanizer_enabled = 'false'` and the Worker receives a draft
- **THEN** the draft is dispatched to `blog-publish` using original content without a Claude call

### Requirement: Humanizer never fabricates domain content
The humanizer system prompt SHALL include an explicit prohibition clause that the Claude model must not: fabricate case studies, client stories, statistics, legal outcomes, tax notices, tax orders, or practitioner experiences. The semantic regression detection gates (compliance entity + similarity) serve as the programmatic enforcement layer for this requirement. If the compliance entity gate detects new numeric entities in the humanized output that were NOT in the original (i.e., fabricated figures), the Worker SHALL reject the humanization.

#### Scenario: Fabricated statistic triggers compliance gate rejection
- **WHEN** the humanized output contains a numeric value (e.g., "82%") not present in the original
- **THEN** the compliance entity gate detects the original does not contain "82" and the humanization is rejected (fallback to original)

#### Scenario: Fabricated case study triggers similarity gate rejection
- **WHEN** the humanized output introduces a multi-sentence case study not in the original, reducing similarity below threshold
- **THEN** the similarity gate rejects and the Worker falls back to original content
