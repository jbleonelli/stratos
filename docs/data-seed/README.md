# Seed data (dev / demo / test)

**Status:** 🟠 Plan · 2026-07-02

Fresh environments are populated with **deterministic synthetic seed data** so
development, demos, and E2E runs start from a known, realistic state. This is
generated data — it is not imported from any external system.

---

## Rules

- **Non-production only.** Dev, demo, and test environments. Never seeded into a
  real customer environment.
- **Deterministic.** Fixed UUIDs and stable values so tests can assert against
  known rows (the claim-bridge proof in [`../../db/proof/`](../../db/proof/) is
  the pattern: `seed.sql` + `fixtures.mjs`).
- **Idempotent.** Re-running into a throwaway environment is safe.

---

## What gets seeded

| Target | Contents |
| --- | --- |
| Aurora (`public`) | orgs, locations, user_location_grants, devices, sample `asks` / events |
| Cognito user pool | one user per persona, custom attributes (`organization_id`, `platform_role`) |
| S3 | a few sample blobs (ticket photos, branding) where a flow needs them |

Personas cover the tenancy matrix: an org-wide admin, a location-scoped worker, a
second-org admin (for cross-tenant negative tests), and a platform admin.

---

## Sequence

1. **Apply schema** → `db/V1_baseline.sql` + `db/helpers/` to a clean database.
2. **Seed Aurora** — insert orgs, locations, grants, devices, and sample
   activity with fixed UUIDs.
3. **Seed Cognito** — create persona users; set `organization_id` /
   `platform_role` custom attributes.
4. **Seed S3** — upload any sample blobs referenced by seeded rows.
5. **Verify** — row-count checks + the acceptance spot-checks (one login per
   persona, one cross-tenant negative check).

---

## Out of scope

- Any import, sync, CDC, or dependency on an external/legacy system.
- Production or real customer data.
