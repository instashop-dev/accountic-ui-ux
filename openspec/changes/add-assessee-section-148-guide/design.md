## Context

The pipeline currently publishes all articles through the same quality gate (`scoreArticle` in `src/lib/quality.ts`) with three checks: Flesch readability ≥ 20, originality marker presence, and frontmatter schema validity. The gate is audience-blind — it cannot detect when an article written for CAs is being published to a slug that signals a taxpayer audience.

The s.148 content cluster has three live CA-facing articles. The assessee-facing article (`section-148-notice-reply-step-by-step-guide-for-assessees.mdx`) is the highest-search-volume slot in the cluster and is not covered. The article can be written directly (not pipeline-generated) and published as a static MDX file with hand-crafted JSON-LD schema, bypassing the generation queue entirely — this is appropriate because it is a one-time content creation task, not a repeating pipeline event.

The audience quality gate is a separate, independent concern: a pipeline code change that prevents future voice/audience mismatches for any slug.

## Goals / Non-Goals

**Goals:**
- Publish the missing assessee-facing article with AEO-ready structure (7-step workflow, 5 FAQ pairs, JSON-LD schema block)
- Add an audience-voice check to `scoreArticle` that catches CA-voice articles published to assessee-intent slugs
- Add an `audience` field to the article generation worker's topic payload so future automated articles carry the correct voice signal

**Non-Goals:**
- Retroactively re-voice the three existing CA-facing s.148 articles
- Full AI Overview testing or GSC coverage measurement (observability is Phase 4's domain)
- Rewriting the generation prompt templates for all existing topics
- Adding a `description` audience field to `src/content.config.ts` (the existing schema already supports this via custom frontmatter)

## Decisions

### D1 — Write the article directly, not through the generation queue

**Decision:** The assessee article is written as a hand-crafted MDX file and committed directly to `src/content/blog/`, bypassing the pipeline.

**Rationale:** The pipeline is designed for repeating, high-volume content generation. A one-off authoritative cluster piece benefits from precise control over voice, citation accuracy, and FAQ question framing — qualities that are harder to guarantee from a single generation pass. The quality gate still validates the output before it merges.

**Alternative considered:** Run a prompted generation pass via the article-generation worker. Rejected because: (a) the worker is queue-driven and requires admin UI triggering, (b) the humanizer pass (Phase 4) is not yet deployed, meaning the output would need manual re-voicing anyway, (c) this article contains citations that must be individually verified (Lakhmani, 148A framework) — citation integrity is a Check 2 item from `ai-drafted-section-148-reply-review.md`.

---

### D2 — Audience detection by slug convention, not frontmatter field

**Decision:** The audience quality gate in `scoreArticle` infers audience from slug conventions (`for-assessees`, `taxpayer-guide`, `what-to-do-when`) rather than requiring a new frontmatter `audience:` field.

**Rationale:** Frontmatter fields require a `src/content.config.ts` schema change, a migration rationale, and updates to all existing articles (or optional-field handling). Slug convention inference is additive and zero-friction for existing content — no existing articles are re-flagged.

**Alternative considered:** Add `audience: 'ca' | 'assessee' | 'general'` to frontmatter schema. Would be cleaner long-term but introduces schema churn now and is out of scope for a content gap fix. Deferred to a future schema evolution.

---

### D3 — JSON-LD schema block written inline in MDX, not injected by publisher

**Decision:** The JSON-LD `<script type="application/ld+json">` block is written directly in the MDX file rather than relying on the Phase 4 publisher injection.

**Rationale:** Phase 4 (`seo-schema-injection`) is not yet implemented. Waiting for Phase 4 would block this article. Writing it inline is consistent with the Phase 4 contract (the publisher spec says it appends after the last body line — inline placement achieves the same outcome for a manually-authored file).

**Risk:** When Phase 4 deploys, the publisher may append a second schema block to this file if it doesn't detect the existing inline block. Mitigation: Phase 4's publisher spec should check for an existing `<script type="application/ld+json">` block before appending — add this as a spec requirement in the `seo-schema-injection` spec.

---

### D4 — Voice detection uses positive assessee-language pattern, not negative CA-language pattern

**Decision:** The audience gate checks for the *presence* of assessee voice markers (`"you received"`, `"your notice"`, `"your reply"`, second-person `you` density) rather than *absence* of CA-instruction markers.

**Rationale:** False-positive rate is lower with positive pattern matching. CA-instruction articles legitimately use second-person in some contexts ("you should cite..."); assessee-voice articles reliably use possessive second-person around the notice itself. The gate should fail loudly only on clear mismatches, not borderline cases.

## Risks / Trade-offs

- **Slug-convention inference is brittle** → If a future article uses a different assessee-signal pattern (e.g., `how-to-reply-to-148`), the gate won't catch it. Mitigation: document the slug convention in a `CONTENT_GUIDE.md` or equivalent.
- **Inline JSON-LD double-injection risk** (see D3 above) → Mitigation: Phase 4 publisher must check before appending.
- **Citation staleness** → The s.148 framework has been amended multiple times. The article cites the Finance Act 2021 amendments and the 148A procedure; these must be reverified against the current CBDT position before publish.

## Open Questions

- Should the `audience` metadata field be added to the article-generation worker's topic payload now (a 2-line change) even though the generation prompt templates don't yet use it? Leaning yes — it costs nothing and sets up Phase 5.
- Does the `post-validation` spec in `openspec/specs/post-validation/` need a formal delta spec, or is a direct code addition to `quality.ts` sufficient given the spec already permits extension?
