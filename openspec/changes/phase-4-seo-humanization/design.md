## Context

Phase 3 delivered a four-stage async pipeline (topic → outline → article → publish) driven by Cloudflare Queues, an admin dashboard, and a content quality gate. The pipeline publishes articles that pass Flesch Reading Ease ≥ 70 and originality checks, but the quality gate operates on raw AI output — articles can pass scoring while still containing AI-typical patterns (generic intros, repetitive hedging phrases, flat sentence rhythm). The overview spec (§27) requires a dedicated humanization pass; the publisher competes with the Google AI Overviews surface without FAQ/Article/Breadcrumb schema (§28–29); and there is no structured telemetry, so operators cannot see token spend, failure rates, or quality trends (§45).

**Corrected Phase 4 pipeline flow:**

```
[Phase 3] article-generation → 'ready' → blog-publish queue → publisher → 'published'

[Phase 4] article-generation → 'ready' → blog-humanize queue → humanizer → 'humanized'
                             → Admin reviews → 'approved' → blog-publish queue
                             → publisher → 'published'
```

The humanizer runs **before** admin review. CAs approve the humanized draft — not the raw AI output. This preserves the existing `approve.ts` → `publisher.ts` contract (`status = 'approved'`).

**Conflict audit results (conducted before design was finalized):**

| File | Line | Current value | Change required |
|---|---|---|---|
| `src/workers/pipeline/publisher.ts` | 54 | `status !== 'approved'` | None — publisher keeps checking `'approved'` |
| `src/pages/admin/api/drafts/[id]/approve.ts` | 36 | `UPDATE ... status = 'approved'` + dispatches to `BLOG_PUBLISH_QUEUE` | None — approve endpoint unchanged |
| `src/pages/admin/queue.astro` | 42 | Badge color map | Additive: add `'humanized'` badge color |
| `src/pages/admin/queue.astro` | 133 | Approve/Reject buttons shown for `status = 'ready'` | Additive: also show for `status = 'humanized'` |

No TypeScript enums exist for status values — all checks are string comparisons. No centralized `DraftStatus` type. No undocumented usage of `'approved'` found.

**Key stakeholders / operators:** Two CAs (domain reviewers) + one IT co-founder (infra operator). The humanizer is transparent to CAs — they review the humanized draft, which must be factually and legally identical to the raw AI output. Any divergence is a regression and must be caught before the approved draft is committed.

**Constraints:** All Workers stay within Cloudflare CPU limits (30s). No new npm packages. Additive D1 migrations only. No changes to `src/content.config.ts` or `src/blog-meta.ts`. The humanizer operates in style-preserving mode only — it is not a semantic rewrite engine.

## Goals / Non-Goals

**Goals:**
- Five-stage pipeline with humanizer between article-generation and admin review, fully resumable across Worker restarts
- Style-preserving humanization only: improve prose rhythm, vary sentence structure, strip AI clichés — without altering factual content, regulatory references, legal terminology, numerical values, or introducing new claims
- Protected content regions (`<!-- HUMANIZER_LOCK_START -->` / `<!-- HUMANIZER_LOCK_END -->`) skipped entirely by the humanizer
- Semantic regression detection before accepting any humanized output: similarity gate, heading structure check, compliance keyword/numeric entity preservation check
- Internal linker embedded in the publisher pass: 3–5 contextual Markdown inline links per article drawn from existing D1 `posts`
- SEO structured data: valid FAQ, Article, and Breadcrumb JSON-LD injected into the MDX file at publish time
- Analytics Engine telemetry across all five pipeline stages: generation events, token usage, quality scores, humanizer outcomes (including regression failures and fallback rate)
- Additive D1 migration with `humanizer_jobs` table and two new columns on `drafts`
- Admin queue page shows `'humanized'` drafts with Approve/Reject buttons (additive change — existing `'ready'` display unchanged)
- Low-temperature Claude calls for the humanizer (0.2–0.4 range) to minimize stochastic variation

**Non-Goals:**
- Image/illustration generation (planned separately)
- RBAC / session tokens for admin auth (separate hardening item)
- R2 snapshot backups (separate design)
- Multilingual generation
- Real-time browser streaming of humanizer progress
- Semantic similarity search for internal linking (simple keyword matching is sufficient for v1)
- Modifying existing Astro pages, layouts, or design system files beyond the additive admin queue column
- Testing infrastructure (separate phase)
- Semantic rewriting: the humanizer MUST NOT change meaning, add information, or alter domain-specific content

## Decisions

### Humanizer uses claude-haiku-4-5 at temperature 0.2–0.4 (deterministic, style-preserving)

**Decision:** `src/workers/pipeline/humanizer.ts` calls Claude Haiku 4.5 with `temperature: 0.3` (default) for the humanization pass. The system prompt explicitly constrains the model to style-preserving edits only.

**Rationale:** The humanizer is a prose editor, not a content generator. Low temperature (0.2–0.4) minimizes stochastic variation and reduces the risk of the model introducing unsolicited content. Haiku at low temperature produces consistent, conservative edits. Temperature is configurable via D1 settings key `humanizer_temperature` (float, 0.2–0.4) so operators can tune without a code deploy.

**Alternative considered:** Sonnet 4.6 at temperature 0. Rejected: temperature 0 with Sonnet 4.6 is more expensive and still capable of introducing new content when prompted poorly. Haiku at 0.3 is cheaper and the explicit prompt constraint is the primary guardrail — not the model.

---

### Humanizer operates in style-preserving mode with explicit fabrication prohibition

**Decision:** The humanizer system prompt (stored in D1 `prompts` with `stage = 'humanizer'`) SHALL include an explicit, non-negotiable constraint block prohibiting: fabrication of case studies, client stories, statistics, legal outcomes, notices, orders, or experiences; alteration of regulatory references or compliance terminology; modification of numerical values; addition of new claims or examples not present in the original.

**Rationale:** Accountic publishes content to practising CAs and their clients. Fabricated legal or tax information is a professional liability risk. The constraint must be explicit and structurally reinforced (not just implied) so that even with prompt drift or model variation the guardrail holds. Semantic regression detection (see below) provides a second layer of defence.

**Alternative considered:** Post-generation diff review by the admin. Rejected: this defeats the automation goal and puts domain liability on non-technical CAs reviewing diffs.

---

### Protected content regions skipped by string extraction before Claude call

**Decision:** Before calling Claude, the humanizer Worker extracts all content between `<!-- HUMANIZER_LOCK_START -->` and `<!-- HUMANIZER_LOCK_END -->` comment pairs, replaces each with a stable placeholder (`__LOCKED_REGION_0__`, `__LOCKED_REGION_1__`, etc.), sends the substituted content to Claude, then re-inserts the original locked content by replacing placeholders after the Claude response.

**Rationale:** Sending locked regions to Claude with an instruction to "skip them" is unreliable — the model may paraphrase or omit content even with explicit instructions. String extraction + placeholder substitution is deterministic and guarantees locked regions are never modified, regardless of model behaviour or prompt phrasing.

**Alternative considered:** Trust the system prompt to preserve locked regions. Rejected: non-deterministic; the model cannot be guaranteed to faithfully reproduce arbitrary HTML comments verbatim.

---

### Semantic regression detection: three-gate check before accepting humanized output

**Decision:** After receiving Claude's humanized output, the humanizer Worker runs three gates in sequence before accepting the revision:

1. **Similarity gate:** Compute Jaccard similarity on word n-grams (bigrams) between original and humanized text. If similarity < 0.70, reject (too much has changed).
2. **Heading structure gate:** Extract all Markdown headings (`##`, `###`) from both texts. If any heading is missing or materially reworded (edit distance > 10% of heading length), reject.
3. **Compliance entity gate:** Extract a defined set of compliance keywords (GST, TDS, ITR, PAN, TAN, GSTIN, CGST, SGST, IGST, section numbers matching `[Ss]ection\s+\d+[A-Z]?`, notice/order codes matching `u/s\s+\d+`) and all numeric values (integers and decimals) from the original. If any compliance keyword or numeric entity is absent from the humanized text, reject.

On rejection, the Worker falls back to original content, logs a `regression_detected` event to Analytics Engine with the specific gate that failed (`similarity | heading | compliance_entity`), and proceeds with the original draft.

**Rationale:** A pure quality score comparison (Flesch Reading Ease) cannot detect semantic drift — a text can score well while having materially different meaning. The three-gate approach catches the most dangerous failure modes (excessive rewrite, structural changes, loss of legal/numeric precision) without requiring a full NLP pipeline that would exceed the Worker's CPU budget.

**Alternative considered:** Cosine similarity on TF-IDF vectors. Rejected: requires building a term-frequency index at runtime, which is too memory-intensive for a Worker invocation.

---

### Humanizer uses D1 full-text keyword matching for internal links (publisher handles linking)

**Decision:** Internal link injection is performed by the **publisher** Worker (not the humanizer). This cleanly separates responsibilities: the humanizer handles prose quality, the publisher handles publication-time assembly (links + schema + commit).

**Rationale:** Internal links should be injected into the final, approved content — not the pre-approval draft. If a CA rejects a draft after humanization and it is regenerated, the internal link set would be stale. Publisher-time injection ensures links are always computed against the final approved content.

---

### Analytics Engine: structured telemetry with regression-specific events

**Decision:** `src/lib/analytics.ts` emits named events. Phase 4 adds the following humanizer-specific events to the existing schema: `humanizer_regression_detected` (includes `failed_gate` field: `'similarity' | 'heading' | 'compliance_entity'`), `humanizer_fallback` (reason: `'regression' | 'budget_exceeded' | 'disabled' | 'prompt_missing'`), `humanizer_success`. Fallback rate is derivable from the ratio of `humanizer_fallback` to `humanizer_success` events per time window in the Analytics Engine explorer.

---

### Admin queue: show `'humanized'` drafts with Approve/Reject buttons

**Decision:** `src/pages/admin/queue.astro` is updated to show Approve/Reject buttons for drafts with `status = 'humanized'` (in addition to the existing `status = 'ready'` display). The `'humanized'` status gets a distinct badge colour (teal/cyan). Existing `'ready'` drafts (which predate Phase 4) continue to show their buttons unchanged — they will flow through `approve.ts` → `blog-publish` without a humanization step (pre-Phase-4 behaviour preserved for any in-flight drafts).

**Rationale:** CAs should review the humanized draft, not the raw AI output. This is the primary purpose of the humanizer — the admin is the last human checkpoint before content goes live. The `'ready'` fallback preserves compatibility with any drafts that entered the queue before Phase 4 was deployed.

## Risks / Trade-offs

**[Risk] Compliance entity gate produces false positives on reformatted numerics** → Mitigation: The numeric entity extractor normalises values (strips commas, currency symbols) before comparison. "₹1,00,000" and "100000" are treated as equivalent.

**[Risk] Similarity gate rejects good humanizations of heavily restructured articles** → Mitigation: The 0.70 threshold is configurable via D1 settings key `humanizer_similarity_threshold` (float, 0.50–0.95). Operators can relax it if legitimate humanizations are being rejected at an unacceptable rate.

**[Risk] Placeholder substitution fails if Claude modifies the placeholder text** → Mitigation: Placeholders use a format (`__LOCKED_REGION_N__`) that is highly unlikely to be paraphrased. If a placeholder is missing from Claude's response, the Worker falls back to original content and logs `placeholder_missing` as the regression reason.

**[Risk] Humanizer doubles Claude call cost per article** → Mitigation: Haiku at low temperature is ~10× cheaper than Sonnet. Daily token budget applies. `humanizer_enabled = 'false'` provides an operator escape hatch.

**[Risk] Existing `status = 'ready'` drafts from Phase 3 are not humanized before publish** → Mitigation: These drafts retain their existing flow (admin approves → `blog-publish`). The admin queue shows both `'ready'` and `'humanized'` drafts with Approve/Reject buttons. No data migration required. Operators are notified in the ops runbook.

**[Risk] `BLOG_ANALYTICS` binding absent in `wrangler dev`** → Mitigation: `logEvent` silently no-ops when binding is undefined. Local development proceeds without telemetry.

**[Risk] Humanizer prompt injection via article content** → Mitigation: The humanizer sends article content as a `user` message turn, not injected into the system prompt. System prompt is fetched from D1 (operator-controlled) and is structurally separate from article content passed to Claude.

## Migration Plan

1. **D1 migration:** Run `npm run db:migrate` to apply `migrations/003_humanizer.sql` (additive columns + `humanizer_jobs` table + seed prompt/settings). No UPDATE of existing `'approved'` or `'ready'` rows — they continue through the Phase 3 flow until consumed.
2. **`wrangler.jsonc` update:** Add `blog-humanize` queue consumer binding and `BLOG_ANALYTICS` dataset binding.
3. **Deploy:** `git push origin main` triggers GitHub Actions. All new Workers, updated bindings, and admin queue page changes deploy atomically.
4. **Verify:** Confirm `blog-humanize` queue exists in Cloudflare dashboard. Confirm `BLOG_ANALYTICS` dataset receives events on next cron window.
5. **Enable:** `generation_enabled` stays `'true'`. The next article entering article-generation after deploy will flow through the full 5-stage pipeline automatically.

**Rollback:**
- Set `generation_enabled = 'false'` to pause new generation.
- Revert the commit and push to main. CI redeploys the Phase 3 build.
- Any `'humanized'` drafts in D1 can be manually set back to `'ready'` via `wrangler d1 execute` if needed.
- Run `migrations/003_rollback.sql` only if the schema additions must be removed.

## Open Questions

1. **`humanizer_similarity_threshold` default:** 0.70 is recommended as a conservative starting point. Should the IT co-founder review and confirm this before deploy, or accept as the default with the understanding it can be relaxed in D1 settings without a redeploy?
2. **Compliance entity keyword list:** The current list covers the most common Indian tax/accounting identifiers. Should the CAs review and extend this list before Phase 4 is deployed (e.g., to add specific notice codes, TCS, RCM, QRMP)?
3. **`'ready'` drafts in admin queue:** After Phase 4 deploys, existing `'ready'` drafts in the queue will bypass humanization. Should there be a one-time manual review checkpoint before approving these, or is the existing quality gate sufficient?
