## MODIFIED Requirements

### Requirement: Admin header navigation includes all admin pages
The admin header nav (present on every admin page) SHALL include links to: Queue, Jobs, Analytics, Settings, and Prompts — in that order.

#### Scenario: Analytics link present on all admin pages
- **WHEN** an admin visits any of `/admin/queue`, `/admin/jobs`, `/admin/settings`, or `/admin/prompts`
- **THEN** the header nav SHALL contain an `<a href="/admin/analytics">Analytics</a>` link styled consistently with the other nav links (`color: #c7d2fe; text-decoration: none; font-size: 0.9rem`)

#### Scenario: Current page link is distinguishable
- **WHEN** an admin is on `/admin/analytics`
- **THEN** the "Analytics" nav link SHALL be visually present; no active-state styling is required (consistent with existing admin nav behavior)
