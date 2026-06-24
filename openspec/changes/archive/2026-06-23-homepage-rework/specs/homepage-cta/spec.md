## ADDED Requirements

### Requirement: Email-capture CTA form is present
The homepage SHALL include a final CTA section (`id="cta"`) with an email input and "Request access" submit button for the pilot cohort sign-up.

#### Scenario: Form renders with email input
- **WHEN** the CTA section renders
- **THEN** an `<input type="email">` and a "Request access" submit button are visible

### Requirement: CTA copy reflects full platform access
The CTA headline and description SHALL reference access to the full Accountic platform — not just notice drafting — to match the reworked platform positioning.

#### Scenario: CTA copy mentions platform
- **WHEN** the CTA section renders
- **THEN** the headline or body copy references the platform or multiple modules, not only notice drafting

### Requirement: Invalid email shows inline error
The CTA form SHALL display an inline error ("Please enter a valid work email.") when a non-email value is submitted, without page navigation.

#### Scenario: Inline error on bad email
- **WHEN** the user submits the form with an invalid email
- **THEN** the error message is shown and the page does not navigate

### Requirement: Successful submission shows thank-you state
After a valid email is submitted the form SHALL be hidden and replaced by a thank-you panel confirming receipt and next steps.

#### Scenario: Thank-you state replaces form
- **WHEN** the user submits a valid email
- **THEN** the form is hidden and the thank-you panel displays the submitted email

### Requirement: Successful capture is stored in localStorage
Each successful submission SHALL be persisted to `localStorage` under `accountic:captures` as `{ email, source, at }`.

#### Scenario: LocalStorage entry written on submit
- **WHEN** the user successfully submits their email
- **THEN** `localStorage.getItem("accountic:captures")` contains an entry with the email
