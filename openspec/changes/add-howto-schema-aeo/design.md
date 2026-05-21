## Context

`src/lib/seo-schema.ts` currently exports three functions: `generateArticleSchema`, `generateFAQSchema`, and `generateBreadcrumbSchema`. The publisher worker calls all three and appends the non-null results as a JSON array in a `<script type="application/ld+json">` block at the end of each published MDX file.

The quality library (`src/lib/quality.ts`) already contains `hasNumberedWorkflow(text)` — a function that detects 3+ sequential numbered list items in article body text. HowTo JSON-LD schema requires exactly this pattern: a `name` (the overall task), and a `step` array where each entry has `name` (the step heading) and `text` (the step description). The structural extraction logic for HowTo maps directly onto what `hasNumberedWorkflow` already parses.

The double-injection risk: the assessee guide article (`add-assessee-section-148-guide`) will be committed with an inline `<script type="application/ld+json">` block. When Phase 4's publisher processes *other* articles, it will not touch this one — but if the article were ever re-processed (e.g., a re-publish from admin UI), the publisher would naively append a second schema block. A one-line string check before the append prevents this permanently.

## Goals / Non-Goals

**Goals:**
- Add `generateHowToSchema()` to `seo-schema.ts` that produces valid `HowTo` JSON-LD from numbered step workflows
- Wire it into the publisher alongside the existing three schema calls
- Add a pre-append guard in the publisher to skip injection if a schema block already exists

**Non-Goals:**
- Modifying `hasNumberedWorkflow()` in `quality.ts` — the HowTo extractor in `seo-schema.ts` implements its own step-parsing logic independently (different output contract)
- Generating `HowToStep` `image` or `url` fields — out of scope; plain text steps are sufficient for rich result eligibility
- Detecting HowTo in manually-authored articles already committed — the guard protects them passively by skipping injection

## Decisions

### D1 — HowTo extraction is implemented inline in `seo-schema.ts`, not by calling `quality.ts`

**Decision:** `generateHowToSchema` parses the numbered list independently rather than reusing `hasNumberedWorkflow` from `quality.ts`.

**Rationale:** `hasNumberedWorkflow` returns a boolean. `generateHowToSchema` needs the actual step text — it must parse the list items to extract `name` and `text` per step. Reusing the boolean from `quality.ts` would still require a second parse. One targeted parse in `seo-schema.ts` is cleaner than a cross-module dependency for a 20-line function.

**Alternative considered:** Export a `extractNumberedSteps(text): string[]` function from `quality.ts` and call it from `seo-schema.ts`. Rejected — it would add a `quality.ts` → `seo-schema.ts` dependency direction that doesn't exist today, and `quality.ts` is a scoring module, not a parsing utility.

---

### D2 — Step `name` is the first 60 characters of the step text; `text` is the full step line

**Decision:** Each `HowToStep` uses the first 60 characters of the numbered item text as `name` and the complete text (stripped of the leading `N. `) as `text`.

**Rationale:** Google's HowTo spec requires `name` (short label) and optionally `text` (full description). The numbered list format in Accountic articles is `1. **Verb phrase** — detail sentence`. The first 60 chars captures the bolded verb phrase cleanly for most steps. No separate heading extraction is needed.

**Alternative considered:** Extract the bolded text inside `**...**` as the step name. More precise, but requires a regex that breaks on steps without bold formatting. The 60-char truncation is format-agnostic and works for all numbered list styles.

---

### D3 — Publisher double-injection guard is a string contains-check, not DOM parsing

**Decision:** Before appending the JSON-LD block, the publisher checks `content.includes('<script type="application/ld+json">')` and skips the append if true.

**Rationale:** The publisher operates on raw MDX strings, not parsed HTML. A simple `includes()` check is O(n) and zero-dependency. There is no case in the current pipeline where a legitimate article would have a JSON-LD script tag that is *not* the schema block — MDX articles don't embed arbitrary scripts.

**Alternative considered:** Check for the closing `</script>` tag position relative to end-of-file. More brittle — the closing tag appears in code blocks too. `includes()` on the opening tag is sufficient.

---

### D4 — HowTo schema requires a minimum of 3 steps to return non-null

**Decision:** `generateHowToSchema` returns `null` if fewer than 3 steps are detected, matching the `hasNumberedWorkflow` threshold in `quality.ts`.

**Rationale:** Google's HowTo rich result guidelines de-prioritise very short step lists. A 1- or 2-step "workflow" is likely a numbered list used for emphasis, not a procedural guide. Consistent with the quality gate's existing floor.

## Risks / Trade-offs

- **Numbered lists used for non-procedural content** (e.g., "3 reasons why...") could be mis-classified as HowTo steps → The threshold of 3 steps and the presence of sequential numbering (1, 2, 3... not 1, 1, 1) reduces false positives; but it's not zero. Mitigation: Google ignores HowTo schema it doesn't recognise as procedural — there is no penalty for including it on non-procedural content, only a missed opportunity.
- **Step text quality depends on article generation quality** — if the AI-generated workflow steps are vague, the HowTo schema will be vague → This is a content quality concern, not a schema concern. The humanizer pass (Phase 4) addresses prose quality independently.

## Open Questions

- Should `generateHowToSchema` also accept an optional `image` URL for the `HowTo` object (e.g., the article's OG image from frontmatter)? Likely yes for future richness, but out of scope for this change.
- Does the `HowTo` schema require `totalTime` or `estimatedCost`? No — both are optional per schema.org and Google's documentation. Omitting them is valid.
