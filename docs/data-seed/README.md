# One-time data seed (Merlin → Stratos)

**Status:** 🟠 Plan · 2026-07-02

Stratos is independent of Merlin. Merlin data is imported **once** at bootstrap
to give Stratos a realistic starting state, then the cord is cut. **No sync, no
CDC, no ongoing link.**

---

## Rules

- Runs **once**, manually, at bootstrap (and re-runnable only into throwaway dev
  environments).
- **Read-only** against Merlin — never writes back.
- After launch, Merlin and Stratos diverge; there is no reconciliation.

---

## Sources → targets

| Source (Merlin) | Target (Stratos) | Method | Notes |
| --- | --- | --- | --- |
| Postgres `public` schema | Aurora | `pg_dump` (data-only) → transform → `COPY`/restore | Schema comes from `db/V1_baseline.sql`, not the dump |
| `auth.users` | Cognito user pool | Export → CSV → `cognito-idp` bulk import | Force password reset on first login; map ids |
| Storage buckets | S3 | Enumerate → download → `PutObject` | Through the storage API, byte-identical |
| Stripe references | (kept in Stripe) | Carry `stripe_customer_id` etc. in the data | Payments stay in Stripe; no migration |

---

## Sequence

1. **Snapshot schema** → `db/V1_baseline.sql` (structure + RPCs + RLS), applied
   to Aurora first. This is the greenfield baseline, not Merlin's migration
   history.
2. **Export Merlin data** (`pg_dump --data-only --no-owner`), scrub any
   Supabase-internal artifacts.
3. **Transform** — remap identity references to Cognito `sub`s; drop
   Supabase-auth-specific columns; keep `organization_id` scoping intact.
4. **Load into Aurora**, RLS temporarily deferred via service role, then verify
   row counts + a tenant-isolation spot check.
5. **Users → Cognito** — bulk import; set custom attributes (`organization_id`,
   `platform_role`).
6. **Blobs → S3** — copy per object; verify checksums.
7. **Verify** — run the parity spot-checks (row counts, one login per persona,
   one cross-tenant negative check).
8. **Sever** — revoke Merlin read credentials; record the import as done.

---

## Identity remapping (the fiddly part)

Merlin user ids (GoTrue UUIDs) → Cognito `sub`s. Build a mapping table during
Cognito import and rewrite all `*_by`, `created_by`, `owner_id`-style FKs during
the transform step. Verify no orphaned references before load.

## Out of scope

- Continuous replication, CDC, dual-write, or any live Merlin dependency.
- Stripe data migration (references travel with the row; Stripe is the source of
  truth for billing).
