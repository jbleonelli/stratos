# Claim-bridge proof

**Status:** 🟢 Green · retires the project's single biggest risk.

The SPA never talks to the database directly — every read/write goes through an
AppSync/Lambda resolver. This proves that tenant isolation still holds when a
**Lambda resolver injects the caller's Cognito claims by hand** to drive RLS,
rather than relying on a PostgREST-style automatic JWT→RLS injection.

Answer, demonstrated here: **yes**, in both enforcement layers.

## What it shows

Two layers of defense, both exercised (see
[`../../docs/architecture/authorization-and-claim-bridge.md`](../../docs/architecture/authorization-and-claim-bridge.md)):

1. **App layer (primary, mandated)** — `assertOrgAccess()` blocks an explicit
   cross-tenant request before the DB is touched.
2. **Database backstop** — even when the app-layer check is skipped or a
   resolver injects a malicious `WHERE`, RLS returns **zero** foreign rows.

The suite runs both modes:

| Mode | App layer | RLS | Proves |
| --- | --- | --- | --- |
| Production shape | on | on | correct rows for each persona |
| Backstop | **bypassed** | on | a resolver bug still can't leak |

## How it works

- **Real Postgres** via [PGlite](https://pglite.dev) (Postgres compiled to WASM)
  — RLS, roles, `SET LOCAL`, `plpgsql` all behave like RDS/Aurora. No Docker.
- The bridge (`claim-bridge.mjs`) does what a resolver does per request:
  ```
  BEGIN;
  SET LOCAL ROLE stratos_resolver;              -- no BYPASSRLS → RLS enforced
  SET LOCAL request.jwt.claims = '{...}';        -- the Cognito claim bridge
  <query>;
  COMMIT;
  ```
  Querying as a **non-privileged role** is what makes this a real test: a
  superuser or the table owner would silently bypass every policy.
- Helpers under [`../helpers/001_authz.sql`](../helpers/001_authz.sql)
  (`current_user_org()`, `is_platform_admin()`, `has_location_access()`) read the
  injected claims.

## Run

```bash
npm install
npm test
```

## Files

| File | Role |
| --- | --- |
| `../helpers/001_authz.sql` | claim-reading RLS helpers |
| `schema.sql` | minimal org-scoped tables + RLS + resolver role |
| `seed.sql` | two orgs, users, grants, asks, devices (fixed UUIDs) |
| `fixtures.mjs` | the same identities + Cognito-style personas for the tests |
| `claim-bridge.mjs` | `withClaims()` tx wrapper + `assertOrgAccess()` app check |
| `leak.test.mjs` | the cross-tenant leak suite (both modes) |

## Scope / fidelity notes

- Flat location model (a full hierarchy would walk a subtree); isolation
  semantics under test are identical.
- `has_location_access` is `plpgsql` so its body validates at run time — this lets
  the helper file load before the domain tables exist. Same logic either way.
- The bridge logic lives here for a self-contained proof; it moves to `api/` when
  the real AppSync resolvers are built (build sequence step 3).
