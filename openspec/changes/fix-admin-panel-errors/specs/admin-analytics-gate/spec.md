## MODIFIED Requirements

### Requirement: Analytics nav link visibility
The admin navigation SHALL only render the Analytics link when `ANALYTICS_ENABLED=true` is set in the environment. When the flag is absent or set to any other value, the link SHALL be omitted from the nav entirely.

#### Scenario: Analytics link shown when enabled
- **WHEN** `ANALYTICS_ENABLED=true` is set in the environment
- **THEN** the admin nav SHALL include a link to `/admin/analytics`

#### Scenario: Analytics link hidden when disabled
- **WHEN** `ANALYTICS_ENABLED` is not set or is not `'true'`
- **THEN** the admin nav SHALL NOT render a link to `/admin/analytics`

#### Scenario: No dead link to analytics
- **WHEN** `ANALYTICS_ENABLED` is not set
- **THEN** navigating to `/admin/analytics` SHALL return 404 AND no nav link SHALL be visible to reach it
