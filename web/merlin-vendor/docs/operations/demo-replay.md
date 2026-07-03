# Demo replay

**Status:** 🟢 Canonical — Meridian HQ flipped on 2026-05-17 (PR #403, migration 136). The RPC has since been extended: it now also emits into `public.events` (migration 169) and self-manages a calm steady-state (migrations 174–177). See **[Evolution since migration 136](#evolution-since-migration-136)** below — the core capture/replay mechanics described here are unchanged, but the emit shape and ask volume are not.

## Why

Demo orgs (Meridian, FEB, IMF, SparkleCo) were paying for real Claude tokens at every tick. With 4 demo orgs × ~11 agents × 3 buildings × 15-minute cadence on Haiku 4.5, this was the dominant line item on the Anthropic bill — a single 1-min-tick misconfiguration on Meridian cost ~$28 in 24h.

None of those orgs need fresh AI decisions. The same patterns play out every day. So we capture one real loop of activity and replay it forever.

## What it does

- Snapshots an org's last N days of `agent_runs` + `merlin_asks` into a separate `demo_fixtures` schema.
- Fan-emits those rows into the live `public.agent_runs` / `public.merlin_asks` tables at the captured cadence, on a 1-minute cron.
- The live agent tick + signal seeder both skip orgs flagged `replay_mode=true`, so no Claude API call ever fires for them.

To the UI the org looks alive — fresh runs show up in Activity, fresh asks land in the inbox, charts update — but every byte was captured weeks ago.

## Evolution since migration 136

The capture/replay foundation below is unchanged, but two things the original migration 136 didn't do have since been bolted on. If you debug replay-mode orgs, read these first:

- **Emits `public.events` too (migration 169, `demo_replay_emit_tick_events`).** After the [events pipeline](../architecture/events-pipeline.md) made `events` the canonical signal layer, the replay tick was cut over to also fan-emit events — not just `agent_runs` + `merlin_asks`. The cutover initially _skipped_ this, which silently broke Meridian's My Day for ~3 days until migration 169 landed. Any change to `writeAgentRun`'s event shape MUST be mirrored here — replay orgs bypass `writeAgentRun` entirely. See `replay_vs_live_emit_parity`.
- **Self-managed steady-state (migrations 174–177).** Left alone, a replay org accumulates hundreds of stale pending asks. The tick now keeps a calm, balanced CTA backlog:
  - **174 — auto-resolve + hard cap.** Asks older than ~30 min are auto-approved; total pending is capped (~10) so the inbox doesn't pile up.
  - **175 — balance-aware per-agent cap.** Each agent is capped (~4 pending) so one chatty agent can't dominate the inbox.
  - **176 — minimum floor.** Tops the backlog back up when auto-resolution would otherwise drain it to empty, so the demo never looks dead.
  - **177 — variant guard.** Keeps building-variant-specific asks (cold-chain on warehouses, pharmacy-temp on clinics) emitting only where they belong.

  Net effect on a demo: instead of "130 pending CTAs," Meridian holds a handful of fresh-looking asks that resolve and refill on their own. You'll see the auto-resolutions land in the Activity tab.

## Architecture

```
                   ┌──────────────────────────────────┐
                   │   public.organizations           │
                   │     replay_mode  bool            │
                   │     replay_started_at  ts        │
                   │     replay_last_tick_at  ts      │
                   │     replay_window_days  int      │
                   │     replay_source_org_id  uuid   │
                   └──────────┬───────────────────────┘
                              │
       ┌──────────────────────┴──────────────────────┐
       │                                             │
       ▼                                             ▼
┌──────────────────────┐                  ┌──────────────────────┐
│  api/agents/tick     │                  │  api/agents/         │
│  (live, every min)   │                  │   replay-tick        │
│                      │                  │  (replay, every min) │
│  listActiveOrgs()    │                  │                      │
│  filters replay=T    │                  │  rpc(demo_replay_    │
│                      │                  │      emit_tick, org) │
└──────────────────────┘                  └──────────┬───────────┘
                                                     │
                                  ┌──────────────────┴──────────────────┐
                                  │ public.demo_replay_emit_tick(org)   │
                                  │                                     │
                                  │  1. TTL-prune replayed rows >6h old │
                                  │  2. Compute (prev, curr] from       │
                                  │     (now - started) % window_sec    │
                                  │  3. Copy fixture rows in that slice │
                                  │     to public tables with new IDs   │
                                  │  4. Stamp replay_last_tick_at = now │
                                  └─────────────────┬───────────────────┘
                                                    │
                                                    ▼
                              ┌──────────────────────────────────────────┐
                              │  demo_fixtures.agent_runs   (captured)   │
                              │  demo_fixtures.merlin_asks  (captured)   │
                              │   keyed by source_org_id + t_offset_sec  │
                              └──────────────────────────────────────────┘
```

### Capture

`public.demo_capture_org(p_org_id, p_days)` — SECURITY DEFINER, callable from service_role only. Snapshots the last N days into the fixture schema:

- Anchor: `now() − interval 'p_days days'` (NOT `date_trunc('day', …)` — see gotcha #2).
- For each row in `agent_runs` and `merlin_asks` with `created_at` in `[anchor, now()]`, copies it into `demo_fixtures.*` with `t_offset_sec = extract(epoch from (row.created_at − anchor))`.
- DELETE-then-INSERT, so re-running on the same org just refreshes the fixture in place.

### Replay loop math

`public.demo_replay_emit_tick(p_org_id)`:

1. Reads `replay_started_at`, `replay_last_tick_at`, `window_sec = replay_window_days × 86400`.
2. Computes `prev_sec = (last_tick − started) % window_sec` and `curr_sec = (now − started) % window_sec`.
3. **Normal case** (`curr_sec ≥ prev_sec`): emit fixture rows where `t_offset_sec ∈ (prev_sec, curr_sec]`.
4. **Wrap case** (`curr_sec < prev_sec`): emit fixture rows where `t_offset_sec ∈ (prev_sec, window_sec) ∪ [0, curr_sec]`.
5. For each emitted run: insert into `public.agent_runs` with a fresh UUID, today's `created_at`, `cost_usd = 0`, `tokens_in = tokens_out = 0`. Keep the captured `agent_id`, `location_id`, `decision`, `model`, `inputs`, `action_payload`.
6. For each captured ask whose `source_run_id` mapped to a just-emitted run: insert into `public.merlin_asks` with id `'agent-' || new_run_uuid`, the new `agent_run_id`, today's `created_at`.
7. Update `replay_last_tick_at = now()`.

### TTL prune

Before step 1 above (when `replay_started_at` is not NULL), the RPC also deletes:

- `merlin_asks` rows in the org where `id LIKE 'agent-%' AND created_at < now() − 6h`.
- `agent_runs` rows in the org where `cost_usd = 0 AND created_at < now() − 6h`.

Without this, every 7-day loop adds another ~14k runs + 5k asks and the demo inbox becomes unusable. The identification convention — `agent-%` for replayed asks, `cost_usd = 0` for replayed runs — relies on `pushAgentAsk` always using that id prefix and `logClaudeUsage` always stamping real cost on live ticks.

## How to use it

### Flip a new demo org onto replay

1. Make sure the org has at least a few days of representative live activity. If it doesn't (e.g. brand-new FEB clone), the fixture will be thin — let it tick live for a week first.

2. **Capture** the fixture (replace UUID + day count):

   ```sql
   select * from public.demo_capture_org(
     '<org-uuid>'::uuid,
     7  -- days
   );
   -- returns (runs_captured, asks_captured)
   ```

3. **Thin out** the captured runs. The default capture keeps `decision = 'skip'` rows, which are heartbeat noise with no visual interest. Drop them and the asks that hang off them:

   ```sql
   delete from demo_fixtures.agent_runs
     where source_org_id = '<org-uuid>' and decision = 'skip';

   delete from demo_fixtures.merlin_asks a
     where a.source_org_id = '<org-uuid>'
       and not exists (
         select 1 from demo_fixtures.agent_runs r
         where r.source_org_id = a.source_org_id
           and r.source_run_id  = a.source_run_id
       );
   ```

4. **Flip the flag**, leaving the bookkeeping columns NULL so the very first replay tick anchors itself cleanly:

   ```sql
   update public.organizations
     set replay_mode         = true,
         replay_window_days  = 7,
         replay_started_at   = null,
         replay_last_tick_at = null
     where id = '<org-uuid>';
   ```

5. **Wait one to two minutes** for the Vercel cron to fire. The first tick is a no-op anchor (stamps `replay_started_at` + `replay_last_tick_at`, emits nothing). The second tick onwards emits the captured slice.

6. **Verify** new rows are landing:

   ```sql
   select count(*) filter (where cost_usd > 0) as live,
          count(*) filter (where cost_usd = 0) as replayed,
          max(case when cost_usd > 0 then created_at end) as last_live,
          max(case when cost_usd = 0 then created_at end) as last_replayed
   from public.agent_runs
   where organization_id = '<org-uuid>'
     and created_at > now() - interval '10 minutes';
   ```

   Healthy state: `live = 0`, `replayed > 0`, `last_replayed` within the last 60-90 seconds. If `live > 0`, the org isn't being filtered out — see troubleshooting below.

### Unflip an org back to live

Just clear the flag. Existing replayed rows stay in the public tables (they'll age out within 6h via the TTL prune from any still-replaying org, or you can delete them manually if you want a clean slate).

```sql
update public.organizations
  set replay_mode         = false,
      replay_started_at   = null,
      replay_last_tick_at = null
  where id = '<org-uuid>';

-- Optional: wipe leftover replayed rows immediately.
delete from public.merlin_asks
  where organization_id = '<org-uuid>' and id like 'agent-%';
delete from public.agent_runs
  where organization_id = '<org-uuid>' and cost_usd = 0;
```

The org will resume live ticking on the next minute.

### Re-capture after new agents ship

When a new agent type ships, the existing fixture won't have any rows for it — that agent will look dead on replay orgs until you re-capture. The workflow:

1. **Unflip** the org temporarily so it ticks live again (or just live-tick the org alongside replay for a stretch by running the agent manually via `/api/agents/tick` POST).
2. **Let it run** for at least a full day (24h) so the new agent has produced both `decision='ask'` and any structured ask payloads worth seeing.
3. **Re-capture** with `demo_capture_org` — this overwrites the prior fixture (DELETE-then-INSERT internally).
4. **Re-thin** (skips, dangling asks) and **re-flip**.

For a quicker iteration, run only the new agent against the demo org for a few hours: `POST /api/agents/tick` with `{ agentId: 'new-agent', orgId: '<org>' }`, then capture. The skip-decision filter will drop everything that's not the new agent's interesting output.

### Use one org's fixture for another org

The `replay_source_org_id` column lets a target org replay a different org's captured fixture. Useful for "FEB should look as busy as Meridian":

```sql
update public.organizations
  set replay_mode = true,
      replay_source_org_id = '<meridian-uuid>'
  where id = '<feb-uuid>';
```

**Caveat:** `location_id` on emitted runs will reference Meridian's buildings, not FEB's. The UI will silently filter them out of any per-building view. For cross-org replay to be visually clean, you'd need a per-target `location_id` remap table — deferred until we actually need it.

## Cost model

Per replay-mode org, the cost is the SQL itself:

- 1 RPC call per minute = 1,440 calls/day per org.
- Each call: a few small SELECTs against the indexed `demo_fixtures.*` tables (~ms latency), 1-2 small INSERTs into `public.*`, 1 DELETE for TTL prune.
- No Anthropic API call. No `claude_usage_events` row.

For Meridian's 14.5k-run fixture, the per-replay-tick emit averages ~1-3 rows. Negligible DB load.

## Gotchas

1. **Anchor must be `now() − N days`, not `date_trunc('day', now()) − N days`.** The latter overshoots — rows captured "today" land at `t_offset_sec > window_sec` and can never replay because `curr_sec` never reaches them mod `window_sec`. Fixed in migration 136b.

2. **FK cascade requires an index.** `merlin_asks` is referenced by `agent_runs.created_ask_id` ON DELETE SET NULL. Deleting ~5k stale asks per loop without an index sequential-scans `agent_runs` per deletion → statement timeout. Migration 136d adds `agent_runs_created_ask_id_idx` (partial, NOT NULL only). Same pattern applies to any future batch delete on a parent table.

3. **`replay_mode` filter uses `.or('replay_mode.is.null,replay_mode.eq.false')`.** Defensive against any pre-migration rows where the column is NULL — those are treated as live. Direct `.eq('replay_mode', false)` would silently drop NULL-column rows from the live tick.

4. **Replayed-row identification is by convention.** Replayed asks all have `id LIKE 'agent-%'` (matching `pushAgentAsk`'s convention); replayed runs all have `cost_usd = 0` (live ticks always log non-zero via `logClaudeUsage`). If either convention ever changes, the TTL prune will either spare too much (rows pile up) or delete too much (live data eaten). Both are tested via the smoke flow above.

5. **`seed-events` (device telemetry) still fires for replay orgs.** Only the AI-spending crons skip — fresh telemetry charts are cheap and visually useful. If you want a fully frozen demo, also filter `replay_mode` in `api/devices/seed-events.ts`.

6. **Chat still costs real tokens.** `/api/chat` is interactive and per-user; we accept the small spend rather than canning answers. A prospect asking 5 questions per demo session is ~$0.05.

7. **`demo_fixtures` schema is invisible to PostgREST / supabase-js by default.** All access is via the SECURITY DEFINER RPCs in `public`. Don't try to `supabase.from('demo_fixtures.agent_runs')` — it'll silently fail or 404.

## Files

| Path                                      | What it does                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `supabase/migrations/136_demo_replay.sql` | All schema + RPCs in one migration.                                        |
| `api/agents/replay-tick.ts`               | Thin per-org fan-out around `demo_replay_emit_tick()`. Cron'd `* * * * *`. |
| `api/agents/_shared.ts` `listActiveOrgs`  | Filters `replay_mode=true` so the live tick skips them.                    |
| `api/agents/seed-signal.ts`               | Same filter, so we don't seed signals replayed agents can't react to.      |
| `vercel.json`                             | The two `* * * * *` cron entries (live tick + replay tick).                |

## Known follow-ups

- **UI toggle in `/platform`.** Today flipping an org on/off is SQL only. A super-admin-only toggle on `/platform/tenants/<id>` would be nice — three controls: capture, replay-mode on/off, re-capture.
- **Per-org capture wizard.** A platform-side flow that runs `demo_capture_org` + thinning + flag flip from one button click.
- **Location remap for cross-org replay.** Required if we want FEB to replay Meridian's fixture without showing Meridian building names.
- **Re-capture after new agent ships.** Currently manual; could be automated via a `demo_recapture_all_replay_orgs()` RPC triggered when `data.js` AGENTS list changes.
- **`agent_runs` retention strategy.** The TTL prune handles replay rows but live rows keep growing. Time-based partitioning + cold-storage offload is deferred (see [100-tenants-readiness.md](100-tenants-readiness.md)).
