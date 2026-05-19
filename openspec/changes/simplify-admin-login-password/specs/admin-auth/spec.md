## MODIFIED Requirements

### Requirement: Admin login authentication
The system SHALL authenticate admin users by comparing the submitted password against the hardcoded value `accounticadmin`. No environment variable is required.

#### Scenario: Correct password accepted
- **WHEN** a user submits the admin login form with the password `accounticadmin`
- **THEN** the system SHALL set an `admin_token` cookie and redirect to `/admin/queue`

#### Scenario: Wrong password rejected
- **WHEN** a user submits the admin login form with any value other than `accounticadmin`
- **THEN** the system SHALL display an "Invalid token." error and not set a cookie

#### Scenario: Empty password rejected
- **WHEN** a user submits the admin login form with an empty password field
- **THEN** the system SHALL display an "Invalid token." error and not set a cookie

## MODIFIED Requirements

### Requirement: Admin login form label
The login form input SHALL be labelled "Password" (not "Admin token") to reflect the simplified authentication mechanism.

#### Scenario: Form renders with correct label
- **WHEN** a user navigates to `/admin/login`
- **THEN** the page SHALL display a password input labelled "Password"
