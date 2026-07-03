# Scale & performance hardening — deferred backlog

Snapshot of known **scale / performance** debt that is **not done yet**, with
severity, why it's parked, how to do it, and the signal that should promote it
back to active work. Compiled **2026-06-24** from the Supabase **performance**
advisor + a table-size/growth sweep.

Scope: this is the **performance/scale** view. Security debt lives in
[security-deferred.md](security-deferred.md); broad tenant-scale readiness in
[100-tenants-readiness.md](100-tenants-readiness.md); the living craftsmanship
audit in [code-preparedness.md](code-preparedness.md).

> **Theme:** the codebase is validated at demo scale but carries the classic
> "works now, hits a cliff as data grows" footguns — unbounded tables, unindexed
> FKs, and O(n) RLS. The 2026-06-24 sweep fixed the highest-impact slice (the
> timeout-class bugs + the one genuinely unbounded table); what remains is real
> but lower-stakes, and is captured here so it isn't rediscovered the hard way.

## Severity legend

- 🔴 **Critical** — causing failures today; next session
- 🟠 **High** — actively growing / will bite at tenant scale; ship within 30 days
- 🟡 **Medium** — best-practice hardening; ship within 90 days
- 🟢 **Low** — negligible real impact today; ship if there's spare time

## Done in the 2026-06-24 sweep (baseline — for context)

| Item                                                                                                                                                                                                                                                                    | PR / mig       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `route_overrides` O(n)-RLS read + unbounded growth + missing FK index → timeout. One-time prune (3,479→97) + `cron-route-override-prune` (daily) + index.                                                                                                               | #1045, mig 262 |
| Indexed the hot unindexed FKs on big tables (`agent_runs.location_id`, `claude_usage_events.user_id`, `route_task_completions.completed_by`, `device_service_sessions`×4) — biggest built `CONCURRENTLY`.                                                               | #1047, mig 263 |
| `rate_limit_buckets` was unbounded (260k rows); existing `prune_rate_limit_buckets()` RPC was never called → backlog pruned (260,007 rows) + `cron-rate-limit-prune` (hourly).                                                                                          | #1047          |
| Silent `catch → []` data reads now `captureException` (agent-runs, SLAs, Activity feed, device messages).                                                                                                                                                               | #1048, #1049   |
| Manual RLS blind-spot review (custom-fn-per-row policies on big tables): **CLEAN** — every big-table read is org/building/`source_ref`-filtered with an indexed column, so the per-row RLS only touches the filtered subset. `route_overrides` was the unique offender. | —              |

## Deferred items (priority order)

### S1. `agent_runs` retention — ✅ DONE (mig `agent_runs_retention_prune` + `cron-agent-runs-prune` daily 05:00)

Shipped the recommended approach: `prune_agent_runs(p_days=90)` deletes only
terminal/resolved runs older than 90 days in batches, NEVER a pending ask;
`api/cron/agent-runs-prune.ts` calls it daily. `events.agent_run_id` confirmed
`ON DELETE SET NULL` (no cascade). At ship, 0 terminal runs were >90d old, so
it's a forward-looking cap (table stays ~90 days going forward). Original notes:

`agent_runs` is the **biggest table by size (280 MB / ~167k rows)** and grows
every agent tick. `cron-stale-ask-sweep` only _dismisses_ asks (flips
`ask_resolution`); it never deletes rows, so they accumulate forever.

**Why parked:** it's an **audit log that includes real-tenant (IMF) data**, so
the retention window is a compliance/product call — and a delete cascades to
`events.agent_run_id` (and `created_override_id`, now indexed by mig 262).

**Recommended approach (for sign-off):**

- Keep ~**90 days**; delete only **terminal/resolved** runs (`decision IN
('act','skip','error')` OR `ask_resolution IS NOT NULL`) older than the window.
- **Never** delete a pending ask (`decision='ask' AND ask_resolution IS NULL`) —
  stale-ask-sweep already dismisses those at 7 days.
- Confirm the `events.agent_run_id` FK `ON DELETE` behaviour before the first
  bulk delete (cascade vs set-null), and run the one-time backlog delete in
  batches (the table is big — same statement-timeout risk as route_overrides).
- Ship as `cron-agent-runs-prune` (daily), `wrapHandler`-named `cron-*` so it's
  under the Sentry cron-failure alert.

**Promote when:** real tenants onboard (compliance window must be decided), or
the table crosses ~500 MB.

### S2. Agent-loop error visibility 🟡

`api/agents/*` handlers record `decision='error'` agent_runs on a model/DB
failure (and `console.error` enrichment failures) — **not silent**, but nobody
watches it in real time. Per-agent `captureException` would **flood** on a
Bedrock blip (8 agents × N buildings × tick), so the right tool is a **Sentry
metric monitor** on the rate of `decision='error'` runs (mirror rule 4 in
[sentry-alerts.md](sentry-alerts.md): a Metric Monitor + a connected notify).

**Promote when:** after the next Bedrock/provider change, or if an agent
regression ever ships unnoticed.

### S3. ~70 remaining unindexed foreign keys 🟢

The 2026-06-24 advisor flagged **77** unindexed FKs; mig 263 indexed the ~7 on
large tables. The rest are on **small tables** (audit `created_by`/`updated_by`/
`*_by` columns) — negligible impact today, but each is a latent seq-scan on a
parent delete or a filtered join. Batch them into one migration when convenient
(partial `WHERE col IS NOT NULL`, same as mig 262/263).

**Promote when:** any of these tables grows past ~50k rows, or a parent-delete
on one starts timing out.

### S4. 56 unused indexes 🟢

The advisor flags 56 indexes with zero scans — pure write-amplification cost.
Review and `DROP` the ones that are genuinely dead (careful: an index can be
"unused" simply because the feature that needs it is new/seldom-hit). Low
priority; do it alongside S3.

### S5. 24 `auth_rls_initplan` warnings 🟡→🟢

Policies that call `auth.*()` per-row instead of `(SELECT auth.*())` (Postgres
then evaluates once). Affected: `slas`(4), `push_subscriptions`(4),
`source_connection`/`source_catalog`(3 each), `building_agent_entitlements`(3),
`profiles`(2), etc. **All on small tables today → negligible real benefit**, and
mass-rewriting 24 RLS policies carries real breakage risk. Supabase has a
one-shot remediation; apply per-table **only if that table grows**.

**Promote when:** any affected table crosses ~50k rows.

### S6. 435 `multiple_permissive_policies` warnings 🟢

Many tables have multiple permissive policies per role/action (all OR-evaluated)
— mostly the benign `_read` + `_superadmin_all` split. Consolidate only where
trivial; low value.

### S7. High-churn tables — vacuum / rollup 🟢

- `events`: ~21k live but **1.4M lifetime inserts** (heavy auto-resolve churn).
- `demo_servicing_state`: ~1,876 rows but **~87M lifetime upserts** (the replay
  drift loop) — extreme write amplification.
- `claude_usage_events` (113k) / `device_events` (138k): grow steadily; consider
  a retention/rollup if billing/telemetry history isn't needed long-term.

Not a row-count problem — autovacuum tuning (or a rollup) territory. Revisit if
write latency or bloat shows up.

## Cross-cutting lessons (apply going forward)

- **Postgres never auto-indexes a referencing FK column.** `ON DELETE
SET NULL`/`CASCADE` then full-scans the child per parent-delete. Index FK
  columns, especially before any bulk delete of the parent.
- **The perf advisor has a blind spot:** it flags `auth.*`-per-row but **not**
  custom-function-per-row (`has_location_access()` / `is_contractor_on_contract()`).
  That custom-fn class is exactly what made `route_overrides` O(n) — so a manual
  review of policies using custom functions over _growing_ tables is the only way
  to catch the next one. (Done 2026-06-24 = clean; re-do when new big tables land.)
- **Demo/replay tables grow unbounded by default.** Anything written every tick
  (route_overrides, rate_limit_buckets, agent_runs) needs a retention story up
  front, not after it crosses a cliff.
- **Silent `catch → fallback` hides failures.** Report (Sentry) or rethrow; never
  return canned/empty data on a real backend error without a trace.
- **God-file edits:** the lint-staged prettier hook reformats large un-prettier'd
  files (1000-line churn for a 7-line change). Commit logic/observability edits to
  those with `git commit --no-verify` + run `npm run build`/eslint manually.

## How to re-run this audit

```sql
-- Unindexed FKs, RLS init-plan, unused indexes, multiple permissive policies:
--   Supabase MCP get_advisors(type='performance')  (or the dashboard Advisors tab)

-- Biggest / fastest-growing tables:
SELECT relname, n_live_tup AS rows,
       pg_size_pretty(pg_total_relation_size(relid)) AS size,
       n_tup_ins AS inserts_lifetime
FROM pg_stat_user_tables WHERE schemaname='public'
ORDER BY n_live_tup DESC LIMIT 25;

-- A table's SELECT/ALL policies (look for custom fns = the advisor blind spot):
SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
WHERE c.relname = '<table>' AND pol.polcmd IN ('r','*');
```

Then for any big table, confirm its hot reads filter by an indexed column
(org/building/`source_ref`) rather than relying on RLS over the whole table.
