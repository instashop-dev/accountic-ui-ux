## ADDED Requirements

### Requirement: Differentiators section shows platform-level trust pillars
The homepage SHALL include a "Why Accountic" section with 5 differentiator cards covering platform-level trust claims — not module-specific features.

The five pillars SHALL be:
1. **Tally-native** — Every module posts directly to TallyPrime; no middleware, no re-keying
2. **Zero hallucination** — Deterministic-first pipelines; LLM used only at margins; every output traceable
3. **India-resident data** — Processed and stored inside India; DPDP-compliant; DPAs available for firm customers
4. **Built by CA firms** — Co-developed with a 45-year Direct & Indirect Tax practice; every workflow calibrated by practitioners
5. **SOC 2 certified** — Infrastructure certified by a SOC 2 Type II technology partner

#### Scenario: Five differentiator cards rendered
- **WHEN** the differentiators section is rendered
- **THEN** five cards are present, each addressing one of the five pillars above

### Requirement: Differentiator hero card spans wider than peers
The first differentiator card (Tally-native or Zero hallucination) SHALL span a wider column than the remaining four to create visual hierarchy, matching the `cv-hero` pattern used in the existing design.

#### Scenario: First card is wider
- **WHEN** the differentiators section renders on ≥900px viewport
- **THEN** the first card spans more columns than each of the other four

### Requirement: Each differentiator card has an icon and supporting paragraph
Each differentiator card SHALL contain: a 44px icon container with the design system's accent-soft background, an `<h3>` title, and a `<p>` description of 1–2 sentences.

#### Scenario: Card structure complete
- **WHEN** any differentiator card renders
- **THEN** it contains an icon container, heading, and description paragraph
