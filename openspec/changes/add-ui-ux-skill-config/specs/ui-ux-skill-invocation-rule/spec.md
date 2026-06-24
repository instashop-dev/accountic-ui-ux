## ADDED Requirements

### Requirement: CLAUDE.md contains a rule mandating ui-ux-pro-max skill invocation
`CLAUDE.md` SHALL contain a rule (Rule 13) that directs Claude to invoke the `ui-ux-pro-max` skill before beginning any task that involves UI, UX, layout, visual design, component structure, styling, typography, responsive behaviour, or accessibility in this project.

#### Scenario: Rule 13 present in CLAUDE.md
- **WHEN** `CLAUDE.md` is read
- **THEN** a Rule 13 section exists and references `ui-ux-pro-max` skill invocation

### Requirement: Rule defines explicit trigger conditions
The rule SHALL list at least the following trigger conditions so invocation is unambiguous:
- Implementing or modifying page layouts or section structures
- Writing or editing CSS / styling (beyond single mechanical property fixes)
- Making typography, spacing, colour, or visual-hierarchy decisions
- Building or refactoring UI components (`.astro`, `.tsx`, `.vue`, etc.)
- Implementing responsive breakpoints
- Adding or modifying accessibility attributes (`aria-*`, roles, focus management)
- Any task described with design language ("redesign", "rework", "make it look like", "improve the UI")

#### Scenario: Trigger conditions enumerated
- **WHEN** Rule 13 is read
- **THEN** the rule body contains explicit trigger conditions covering at least layout, styling, typography, components, responsive, and accessibility

### Requirement: Rule specifies invocation timing
The rule SHALL state that the skill MUST be invoked BEFORE starting the task — not after drafting a response.

#### Scenario: Invocation timing is before, not after
- **WHEN** Rule 13 is read
- **THEN** the rule contains language indicating the skill is invoked prior to beginning work
