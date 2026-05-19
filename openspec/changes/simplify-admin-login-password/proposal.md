## Why

The current admin login requires an `ADMIN_TOKEN` environment variable to be set and matched, which adds friction during local development and testing. Switching to a hardcoded password `accounticadmin` removes the env-var dependency and lets developers log in immediately without any setup.

## What Changes

- Remove reliance on the `ADMIN_TOKEN` env variable for authentication on `/admin/login`
- Accept the hardcoded password `accounticadmin` instead of comparing against `ADMIN_TOKEN`
- Update the form label from "Admin token" to "Password" for clarity
- Cookie name and session behavior remain unchanged

## Capabilities

### New Capabilities
<!-- None — this is a simplification of existing behavior, not a new capability -->

### Modified Capabilities
- `admin-auth`: Authentication mechanism changes from env-var token comparison to a hardcoded password check

## Impact

- `src/pages/admin/login.astro` — logic and label updated
- No API surface changes; cookie-based session behavior is unchanged
- `ADMIN_TOKEN` env var is no longer required (can be removed from `.dev.vars` / secrets)
