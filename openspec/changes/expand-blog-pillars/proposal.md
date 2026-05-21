## Why

Accountic's long-term vision is to become the AI assistant for Indian accounting professionals — covering all automations and AI agents that improve workflows for CAs and firms. The current 6 blog pillars reflect only the initial product focus (income tax notices); they leave the largest growth areas — GST automation, AI tooling, audit technology, and practice automation — entirely uncovered, ceding that authority to competitors as the product expands into those domains.

## What Changes

- **BREAKING: Remove `Firm Operations` pillar** — replaced by `CA Firm Automation`, which carries the same territory with an automation-first framing aligned to the product vision.
- **Add `AI Tools for Indian CAs` pillar** — India-specific AI agent and tool content: prompting AI for Income Tax Act research, building custom agents for Indian e-filing portals, AI workflows using AIS/TRACES/26AS data.
- **Add `GST Automation` pillar** — India-specific indirect tax automation: GSTR reconciliation, e-invoicing IRP API integration, AI for GST Show Cause Notice responses, HSN/SAC classification.
- **Add `CA Firm Automation` pillar** — Practice management automation for Indian CA firms: Tally/Zoho Books integrations, WhatsApp client communication bots, UDIN workflows, compliance calendar automation.
- **Add `Audit Technology` pillar** — AI in Indian statutory audit: SA-compliant AI tooling, CARO 2020 automation, data analytics for Indian GAAP/Ind AS audits, bank reconciliation with Indian formats.
- **Update prompt templates** — All AI generation prompts that hardcode the pillar list must be updated via a new migration so topic-discovery, outline-generation, and article-generation produce content in the new pillars.

## Capabilities

### New Capabilities

- `pillar-registry`: The canonical list of blog pillars in `src/blog-meta.ts` is extended from 6 to 9 entries; all downstream systems (content validation, blog UI filter chips, topic-discovery validation, coverage brief) derive from this single source of truth.
- `pillar-prompt-templates`: AI generation prompt templates are updated (via migration) to enumerate the new 9-pillar set so the pipeline generates and validates topics correctly.

### Modified Capabilities

*(none — no existing spec-level behavior changes; all downstream consumers of PILLARS update automatically)*

## Impact

- **`src/blog-meta.ts`** — PILLARS constant updated; `Firm Operations` removed, 4 new pillars added.
- **`src/content.config.ts` and `src/lib/schema-validate.ts`** — automatically pick up new pillars via `z.enum(PILLARS)`; no code change required.
- **`src/pages/blog/index.astro`** — filter chips render dynamically from PILLARS; new chips appear automatically.
- **`src/workers/pipeline/topic-discovery.ts`** — pillar validation uses PILLARS import; new pillars accepted automatically.
- **`migrations/008_expand_pillars.sql`** — new migration to update the active `topic-discovery` prompt (v3), `outline-generation` prompt, and `article-generation` prompt to enumerate all 9 pillars.
- **`migrations/008_rollback.sql`** — rollback migration restoring v2 prompts and 6-pillar list.
- **Existing topics/drafts** — `Firm Operations` topics already in D1 are unaffected at the DB level; they will no longer match a valid pillar in the application layer. Any pending `Firm Operations` topics should be reviewed and re-pillarted before deployment.
- **No D1 schema changes required.**
