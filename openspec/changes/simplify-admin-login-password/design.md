## Context

The admin login page at `/admin/login` currently reads `ADMIN_TOKEN` from the Cloudflare Workers environment and compares it against the submitted form value. This works in production but requires every developer to have `ADMIN_TOKEN` set in their `.dev.vars` before they can access the admin panel during local testing.

## Goals / Non-Goals

**Goals:**
- Replace the env-var token check with a hardcoded password `accounticadmin`
- Eliminate the `ADMIN_TOKEN` env dependency for local development
- Update the form label to reflect that it's a password, not a token

**Non-Goals:**
- Improving security — this change intentionally trades security for testability
- Changing the cookie name, session duration, or any downstream middleware
- Adding multi-user or role-based access

## Decisions

**Hardcode the password directly in the Astro page**

Rationale: The admin panel is an internal tool with no public user accounts. The env-var mechanism was only needed because there was no other secret — now the "secret" is the fixed string `accounticadmin`. Inlining it is the simplest approach and avoids any env-var management overhead during testing.

Alternative considered: Keep env-var fallback with `accounticadmin` as the default. Rejected — a fallback would silently break if someone still sets `ADMIN_TOKEN`, causing confusion.

## Risks / Trade-offs

- **[Risk] Weaker security in production** → This password is visible in source code. Acceptable only while the admin panel is internal and not handling sensitive production actions. Flag for revisiting before any production hardening pass.
- **[Trade-off] No per-environment password variation** → All environments share the same password. Acceptable for a testing aid; not a concern until multi-env secret rotation is needed.
