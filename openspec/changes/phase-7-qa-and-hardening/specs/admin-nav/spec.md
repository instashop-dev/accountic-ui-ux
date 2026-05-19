## ADDED Requirements

### Requirement: All admin pages include the full navigation set
Every admin page (`queue.astro`, `jobs.astro`, `analytics.astro`, `refresh.astro`, `settings.astro`, `prompts.astro`) SHALL render a header navigation that includes links to all six sections: Queue, Jobs, Analytics, Refresh, Settings, and Prompts. The active page link SHALL be visually distinct from inactive links (matching the indigo header pattern used throughout the admin UI).

#### Scenario: Queue page renders full nav
- **WHEN** an authenticated user visits `/admin/queue`
- **THEN** the header contains links to Queue, Jobs, Analytics, Refresh, Settings, and Prompts

#### Scenario: Jobs page renders full nav
- **WHEN** an authenticated user visits `/admin/jobs`
- **THEN** the header contains links to Queue, Jobs, Analytics, Refresh, Settings, and Prompts

#### Scenario: Analytics page renders full nav
- **WHEN** an authenticated user visits `/admin/analytics`
- **THEN** the header contains links to Queue, Jobs, Analytics, Refresh, Settings, and Prompts

#### Scenario: Refresh page renders full nav
- **WHEN** an authenticated user visits `/admin/refresh`
- **THEN** the header contains links to Queue, Jobs, Analytics, Refresh, Settings, and Prompts

#### Scenario: Settings page renders full nav
- **WHEN** an authenticated user visits `/admin/settings`
- **THEN** the header contains links to Queue, Jobs, Analytics, Refresh, Settings, and Prompts

#### Scenario: Prompts page renders full nav
- **WHEN** an authenticated user visits `/admin/prompts`
- **THEN** the header contains links to Queue, Jobs, Analytics, Refresh, Settings, and Prompts

### Requirement: Admin login redirects to queue on success
The admin login page (`/admin/login`) SHALL redirect authenticated users to `/admin/queue` after a successful cookie-based login. Unauthenticated requests to any `/admin/*` route SHALL be redirected to `/admin/login`.

#### Scenario: Login with correct credentials redirects to queue
- **WHEN** a user submits the login form with a valid `ADMIN_TOKEN`
- **THEN** the response sets a session cookie and redirects to `/admin/queue`

#### Scenario: Unauthenticated access to admin page redirects to login
- **WHEN** a user visits `/admin/queue` without a valid session cookie
- **THEN** the response redirects to `/admin/login`
