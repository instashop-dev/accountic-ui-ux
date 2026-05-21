## Why

Blog automation is fully operational but has no user-facing documentation, making it impossible for non-engineers to enable, configure, or monitor the pipeline without reading source code. A concise 1-page reference is needed so admins can operate the system confidently.

## What Changes

- Add a `BLOG_AUTOMATION.md` reference document at the repo root covering: enabling the pipeline, key settings, the 6-stage flow, CLI commands, required secrets, and safety mechanisms.
- No code changes — documentation only.

## Capabilities

### New Capabilities

- `blog-automation-docs`: A single, self-contained Markdown reference page that documents the blog automation pipeline end-to-end — how to enable auto-blogging, configure settings, approve drafts, and understand safety mechanisms.

### Modified Capabilities

<!-- None — this is a documentation-only addition. -->

## Impact

- **Audience**: Admins, future team members, and any stakeholder who operates or audits the pipeline.
- **Affected files**: `BLOG_AUTOMATION.md` (new file at repo root).
- **No runtime impact**: Documentation only; no code, no schema, no migrations.
