## Context

`CLAUDE.md` is the project-level instruction file loaded into every conversation in this repo. It currently has 12 rules covering coding discipline, token budgets, and workflow conventions. The `ui-ux-pro-max` skill is a registered skill in this Claude Code environment that provides structured, expert-level UI/UX guidance — covering layout, typography, visual hierarchy, accessibility, responsive design, and component design patterns. Without an explicit rule it is invoked inconsistently.

## Goals / Non-Goals

**Goals:**
- Add a single, unambiguous rule to CLAUDE.md that triggers `ui-ux-pro-max` skill invocation for all UI/UX work
- Define "UI/UX work" clearly enough that Claude can self-classify without ambiguity

**Non-Goals:**
- Changing any existing rules
- Adding rules for other skills
- Modifying any source code or component files

## Decisions

**Decision: Add as Rule 13, appended to the end of CLAUDE.md**
Appending avoids renumbering existing rules, which are referenced by number in conversations and memory. Rule 13 is a natural extension of the existing rule set.

**Decision: Define trigger conditions explicitly, not as "whenever you feel it applies"**
Vague skill rules lead to rationalisation ("this is just a simple style fix"). The rule should list concrete trigger signals: touching `.astro`/`.css`/`.scss` files, implementing layouts, writing component HTML, making spacing or typography decisions, working on responsive breakpoints, accessibility attributes, or any task described with UX/design language.

**Decision: Invoke BEFORE starting work, not after**
Consistent with the `using-superpowers` skill contract: skill check comes before any response or action.

## Risks / Trade-offs

- **Risk**: Rule is too broad and invokes the skill on trivial one-line CSS fixes → Mitigation: rule wording scopes to "design decisions" not "all file touches"; mechanical fixes (typo, variable rename) are excluded.
- **Risk**: Token overhead from skill invocation on every UI task → Accepted trade-off; the quality improvement justifies it for a UI-focused repo.
