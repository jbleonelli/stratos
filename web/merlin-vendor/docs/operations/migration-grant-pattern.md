# Migration GRANT pattern (Data API access)

## TL;DR

Every new table in the `public` schema must include explicit GRANTs to `authenticated` and `service_role`. **Without them, supabase-js / PostgREST / GraphQL cannot see the table** — `select`, `insert`, `update`, `delete` will return 401 / 42501 errors.

Use [supabase/migrations/\_template.sql](../../supabase/migrations/_template.sql) as the starting point for any new migration.

## Why

Supabase announced on 2026-05-13 (per email from `team@supabase.com`) that they're removing the auto-grant of public-schema tables to the Data API roles.

| Date                 | Scope                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| **May 30, 2026**     | Default for all _new_ Supabase projects                                         |
| **October 30, 2026** | Enforced on all _existing_ projects — including Merlin (`jatenmlbczwqmdlnhjbq`) |

**Existing tables keep their current grants forever.** Only _new_ tables created after the cutover date are affected. So the only thing this changes is the migration pattern going forward — no backfill is required.

## The pattern

```sql
-- ── 3. Explicit Data API grants ─────────────────────────────────────
grant select, insert, update, delete on public.<table_name> to authenticated;
grant all                            on public.<table_name> to service_role;
-- (no grant to anon — Merlin doesn't expose anything pre-auth)
```

### Role policy for Merlin

| Role            | Scope                        | Pattern                                                                                                                                                                     |
| --------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anon`          | Pre-auth (sign-in flow only) | **Never granted.** No domain table is ever exposed pre-auth. The sign-in flow uses Supabase Auth's built-in `auth.users` table, which is in the `auth` schema not `public`. |
| `authenticated` | Logged-in users              | `select, insert, update, delete` — RLS in the same migration gates by org + location.                                                                                       |
| `service_role`  | Admin client                 | `all` — bypasses RLS. Used in `api/_lib/admin.js` for cross-org operations.                                                                                                 |

If a future table genuinely needs `anon` access (rare — would be something like a public-facing read-only page), `grant select on … to anon` is fine, but RLS policies must still gate which rows `anon` can read.

## When you need more than grants on the table

- **Sequences**: Merlin uses `uuid` primary keys (`default gen_random_uuid()`), so no sequence grants are required. If a future migration uses `serial` / `bigserial`, add `grant usage on sequence <seq> to authenticated;`.
- **Functions** (especially `SECURITY DEFINER` RPCs): `grant execute on function public.<fn>(<args>) to authenticated;`. Currently Supabase still auto-grants `execute` on public functions; this is _not_ part of the May/October 2026 change, but flag if Supabase ever rolls it back.
- **Views**: `grant select on public.<view> to authenticated;`. Also — if the view aggregates tenant-scoped data, set `security_invoker=true` on the view (see migration 113 for an example) so caller's RLS applies.

## Verifying

After applying a migration with new tables, run the Security Advisor:

```
mcp__8372c5bf-...__get_advisors with type='security'
```

— or in the dashboard, **Database → Linter → Security**. The advisor flags missing grants explicitly. PostgREST also returns a `42501` error with the exact GRANT statement to fix if a role hits an ungranted table.

## How this maps to existing Merlin patterns

Every existing migration that adds a domain table already does:

1. `create table public.foo (...)` — usually with `organization_id` FK
2. `create index foo_org_idx on public.foo (organization_id)`
3. `alter table public.foo enable row level security`
4. `create policy foo_select on public.foo for select to authenticated using (organization_id = current_user_org() or is_platform_admin())` — plus insert/update/delete policies

The grant block goes at the end. The full template is at [supabase/migrations/\_template.sql](../../supabase/migrations/_template.sql).

## Audit & cutover

No backfill is needed for the October 30, 2026 deadline (existing tables stay granted). But before that date, a quick verification pass is worthwhile:

1. List every table in `public` with `select tablename from pg_tables where schemaname='public' order by tablename;`
2. For each, check `select has_table_privilege('authenticated', 'public.<table>', 'SELECT');` returns `true`. Tables we want hidden from authenticated (e.g. internal cron-only tables — none today, but plausible in the future) should return `false`.

We'll run this audit closer to the deadline. As of 2026-05-13 every table is correctly granted (Supabase auto-grant is still in effect).
