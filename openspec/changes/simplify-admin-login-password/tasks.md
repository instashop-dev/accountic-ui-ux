## 1. Update Admin Login Logic

- [x] 1.1 Remove the `ADMIN_TOKEN` env var read from `src/pages/admin/login.astro`
- [x] 1.2 Replace the token comparison with a hardcoded check against `accounticadmin`

## 2. Update Admin Login UI

- [x] 2.1 Change the form label from "Admin token" to "Password" in `src/pages/admin/login.astro`

## 3. Cleanup

- [x] 3.1 Remove `ADMIN_TOKEN` from `.dev.vars` / local env config if present
- [x] 3.2 Manually verify login works with password `accounticadmin` and fails with anything else
