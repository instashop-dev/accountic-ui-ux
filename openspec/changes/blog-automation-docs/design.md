## Context

The blog automation pipeline is fully implemented across six stages (topic-discovery → outline-generation → article-generation → humanizer → publisher → refresh), but has no operational documentation. Admins must read source code to perform basic tasks like enabling the pipeline, approving drafts, or diagnosing failures. This creates unnecessary friction and risk.

## Goals / Non-Goals

**Goals:**
- Produce a single `BLOG_AUTOMATION.md` at the repo root that fits on one printed page.
- Cover all tasks an admin needs to operate the pipeline: enabling, configuring, approving, monitoring, and emergency-stopping.
- Remain accurate to the current implementation (no aspirational features).

**Non-Goals:**
- Not an architecture deep-dive or developer reference — those belong in code comments.
- Not a runbook for infrastructure setup (Cloudflare, secrets) — link to existing README.
- Not documentation of future planned features (auto-publish toggle, etc.).

## Decisions

**Decision 1: Single Markdown file at repo root**
- One file is discoverable, printable, and paste-able into Notion/Slack without tooling.
- Alternatives considered: `/docs/` folder (adds navigation friction), admin dashboard inline help (requires deploy to update).

**Decision 2: Structured with quick-start at top, details below**
- Admins who "just want to turn it on" should not scroll past pipeline internals.
- Structure: Quick Start → Settings Reference → Pipeline Overview → CLI Commands → Safety.

**Decision 3: Tables for settings, code blocks for commands**
- Scannable at a glance; reduces prose needed per setting.

## Risks / Trade-offs

- [Documentation drift] → Mitigate by keeping the doc minimal (fewer facts = fewer stale facts). Settings table references DB keys, not UI labels, so it remains valid even if UI changes.
- [Accuracy] → All settings, env vars, and commands verified against current source code during this change.
