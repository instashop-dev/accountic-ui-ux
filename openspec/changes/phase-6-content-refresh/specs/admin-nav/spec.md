## MODIFIED Requirements

### Requirement: Admin nav includes Refresh link
Each existing admin page (`queue.astro`, `jobs.astro`, `analytics.astro`, `settings.astro`, `prompts.astro`) SHALL include an `<a href="/admin/refresh">Refresh</a>` link in its `<header>` navigation, positioned after the "Analytics" link and before "Settings". The `refresh.astro` page itself SHALL include the same full nav with "Refresh" marked active.

#### Scenario: Admin user visits any existing admin page
- **WHEN** an authenticated admin loads `/admin/queue`, `/admin/jobs`, `/admin/analytics`, `/admin/settings`, or `/admin/prompts`
- **THEN** the header nav contains a "Refresh" link pointing to `/admin/refresh`

#### Scenario: Admin user visits refresh page
- **WHEN** an authenticated admin loads `/admin/refresh`
- **THEN** the header nav renders with "Refresh" in the active/highlighted state consistent with the indigo header pattern used by other admin pages
