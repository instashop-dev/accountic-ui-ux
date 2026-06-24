## ADDED Requirements

### Requirement: Stats strip does not reference a single module's metric
The first stat in the stats strip SHALL NOT be "< 30 min · From notice PDF to filed reply" or any metric that applies only to the Notice Workflow. It SHALL be replaced with a stat that applies to the platform broadly (e.g., accuracy, free credit offer, or a cross-module time-saving claim).

#### Scenario: First stat is module-agnostic
- **WHEN** a visitor reads the stats strip
- **THEN** stat[0] SHALL describe a platform-wide value (accuracy, credits, or broad time savings) rather than notice-specific throughput

### Requirement: Module count stat signals platform growth
The stat that currently reads "14 · Workflows on one platform" SHALL be updated or supplemented to signal that more modules are in development.

#### Scenario: Module count communicates growth trajectory
- **WHEN** a visitor reads the module count stat
- **THEN** the label SHALL include a forward-looking signal such as "with 20+ in development" or the stat value itself SHALL reference the broader pipeline (e.g., "14 live · 20+ coming")
