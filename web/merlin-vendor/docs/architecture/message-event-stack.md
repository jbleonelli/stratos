# Message & Event Stack

> **🟡 Legacy (pre-unification).** This doc maps the _three-store_ world that
> preceded the unified `events` table. The coherence gaps it describes were
> closed by [events-pipeline.md](events-pipeline.md) (shipped 2026-05-27,
> migrations 165–168): the canonical read path is now `events` via
> `useEventsForBuilding` + `resolveEvent`, with `useMerlinAsks` as an adapter.
> Keep this for the per-agent action-table detail and the history of _why_
> unification happened — not as a description of current data flow.

Where events live, which hook reads them, which surface displays them, and the
coherence gaps to close.

The customer app surfaces feel parallel ("My day", "Hypervisor", "Activity",
"Merlin chat") but they read from three independent stores. This doc maps the
actual sources so adding a new surface — or unifying existing ones — is a
mechanical exercise instead of a hunt.

---

## Stores (where messages physically live)

| Store                       | Where                                                                                                                                                                          | What it is                                                                                                                                     | Persistence                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **`agent_runs`**            | Supabase table                                                                                                                                                                 | One row per agent tick. `decision` ∈ `act` / `ask` / `skip` / `error`. Carries reason, confidence, action_payload, ask_resolution.             | ✅ persisted                      |
| **`merlin_asks`**           | Supabase table (legacy)                                                                                                                                                        | Older ask layer. Now mostly historical — `agent_runs.ask_resolution` covers the same shape on newer rows. Activity's "calls" still reads this. | ✅ persisted                      |
| **`incidents`**             | In-memory, `src/app/simulator.js`                                                                                                                                              | Random events generated client-side from a pool of templates ("Water leak", "VOC spike", …). Have `priority`, `params.fl`, `_spawnedAt`.       | ❌ in-memory only — die on reload |
| **Per-agent action tables** | Supabase: `route_overrides`, `agent_setpoint_changes`, `agent_supply_orders`, `agent_booking_releases`, `agent_setback_proposals`, `agent_audit_evidence`, `agent_escalations` | What an agent _wrote_ when it acted. Audit trail of side-effects.                                                                              | ✅ persisted                      |

---

## Hooks (how surfaces read them)

All hooks live in `src/app/agent-runs.js` unless noted.

| Hook                                                      | Reads from                   | Returns                                                                                                      |
| --------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `usePendingAsksByLocation(orgId, buildingId)`             | `agent_runs`                 | All `decision='ask'` rows with no resolution, scoped to building. `Map<location_id, Map<agent_id, asks[]>>`. |
| `useLiveAgentRuns(orgId, buildingId, recencyMinutes=5)`   | `agent_runs` in-memory cache | Last N min, decision IN (`act`, `ask`). Ticks every 30s to age rows out.                                     |
| `useRecentResolvedAgentRuns(orgId, buildingId, limit=10)` | `agent_runs`                 | Rows with `decision='ask' AND ask_resolution IS NOT NULL`.                                                   |
| `useLatestAgentActions(orgId, buildingId)`                | Per-agent action tables      | Most recent persisted action per agent (the audit row).                                                      |
| `useAllAsksByLocation(orgId, buildingId)`                 | `agent_runs`                 | Pending + resolved together. Used by the Hypervisor activity panel.                                          |
| `useAgentRuntimeStats(orgId)`                             | `agent_runs`                 | "Actions today" counter + last-fired timestamp per agent (Dashboard → Agents tile).                          |
| `useMerlinAsks(buildingId)` (`src/app/merlin-asks.js`)    | `merlin_asks`                | Legacy calls awaiting Approve/Hold.                                                                          |
| `useAppData() → incidents` (`src/app/simulator.js`)       | `simulator.js`               | The randomly-generated event stream + chat suggestions.                                                      |

---

## What each surface displays

| Surface                                     | Source(s)                                                                               | Notes                                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **My day** — "3 things need your attention" | `usePendingAsksByLocation` → top 3                                                      | Real agent asks.                                                                                                    |
| **My day** — "Merlin handled these"         | `useLatestAgentActions` ⊕ `useRecentResolvedAgentRuns`                                  | Two streams merged, sorted by recency.                                                                              |
| **My day** — 3D viewer CTAs                 | Same top 3 from `usePendingAsksByLocation`                                              | Mirrors the attention list spatially.                                                                               |
| **Hypervisor 3D · MERLIN**                  | `usePendingAsksByLocation` ⊕ simulator `incidents` (PR #735 bridge)                     | The bridge I added so the canvas reflects Activity.                                                                 |
| **Hypervisor 3D · AGENTS · Live**           | `useLiveAgentRuns`                                                                      | Last 5 min, every decision except skip/error.                                                                       |
| **Hypervisor 3D · AGENTS · Resolved**       | `useRecentResolvedAgentRuns` (limit 60)                                                 |                                                                                                                     |
| **Hypervisor 3D · AGENTS · Pending**        | `usePendingAsksByLocation` flat                                                         | Same source as Merlin mode, no 3-card cap.                                                                          |
| **Hypervisor 3D · SLAs / Sensing**          | (placeholders, not wired)                                                               |                                                                                                                     |
| **Activity page**                           | `useMerlinAsks` ⊕ `incidents`                                                           | Doesn't yet read `agent_runs` directly. **This is the coherence gap.**                                              |
| **Merlin chat — Activity tab**              | Auto-generated seed + resolutions + simulator suggestions (all tagged `meta: { kind }`) | Routed by `isActivity()` in `Chat.jsx`: `m.from === 'merlin' && !!m.meta`.                                          |
| **Merlin chat — Chat tab**                  | User-started threads (no `meta`) + Merlin replies inside those threads.                 | Real conversations only.                                                                                            |
| **MessageDrawer**                           | Whatever payload was passed via `openMessage({ type, id, payload })`                    | Phase 1: `type='agent_run'` only. Renders Reason, Decision, Action, Runtime, Timestamps, raw inputs/action_payload. |

---

## How an event flows end-to-end

1. **An agent runs** (cron tick or manual fire from `/api/agents/*`).
2. Agent writes a row to **`agent_runs`** with a `decision`:
   - `decision='act'` → agent also writes to its per-agent action table
     (e.g. `route_overrides`, `agent_setpoint_changes`). `action_payload`
     captures what it did. `ask_resolution` stays null forever (acted, not
     asked).
   - `decision='ask'` → the row sits waiting for human Approve / Hold.
     `merlin_asks` may also get a row written for legacy UI paths.
   - `decision='skip'` → heartbeat row, no downstream side-effects.
   - `decision='error'` → agent crashed; carries `decision_reason`.
3. **Realtime** broadcasts the INSERT. Every `usePendingAsksByLocation` /
   `useLiveAgentRuns` / `useRecentResolvedAgentRuns` hook subscribed in the
   tab receives it and updates.
4. The surfaces (My day attention list, Hypervisor canvas cards, Activity
   feed) re-render with the new row included.
5. User clicks **Approve** or **Hold** on a CTA card. `resolvePendingAgentAsk`
   writes `ask_resolution` + `ask_resolved_at` back to the agent_runs row.
   Realtime UPDATE fires.
6. The "Merlin handled these" card on My day picks up the resolution via
   `useRecentResolvedAgentRuns` and shows it.

**Simulator incidents short-circuit this whole flow**: they're spawned
in-memory in the browser, never touch the agent pipeline. That's why the
Activity feed shows "Water leak" rows that don't appear in any agent_runs
query.

---

## Conceptually, who owns what

- **An agent** owns its own slice of the world (HVAC, security, cleaning,
  …). It writes `agent_runs` rows and may act autonomously when `decision='act'`.
- **Merlin** is the chat layer + the "handled / inbox" framing on top of
  those agent_runs. It does not generate its own events; it surfaces theirs.
  The Activity tab of the Merlin chat is essentially "things you might want
  to know about, summarized."
- **The simulator** is a parallel demo stream that exists so a fresh-loaded
  page has motion without waiting for real agents to fire. Production tenants
  with real cron-driven agents won't need it.

---

## The coherence gaps (and what closing them looks like)

### Gap 1 — Activity reads a different ask table than Hypervisor

Activity: `useMerlinAsks` (table `merlin_asks`) + `incidents` (simulator).
Hypervisor: `usePendingAsksByLocation` (table `agent_runs`) + `incidents`.

Fix: migrate `Activity.jsx`'s call source from `merlin_asks` to `agent_runs`
via `usePendingAsksByLocation`. Then both pillar surfaces pull from one source.

### Gap 2 — Simulator incidents aren't agent_runs

Right now incidents from `simulator.js` live only in-memory. They show on
Activity and (via PR #735) on Hypervisor too, but they're not in any DB
table and they don't have resolution timestamps, so the replay slider can't
correctly hide events that were resolved at time `T`.

Fix: have the simulator write incidents into `agent_runs` (with
`decision='ask'` or `decision='act'` as appropriate, and an `agent_id` like
`'simulator'`). Surfaces stop caring whether a row came from a real agent or
the sim. Drop the special-case incident array.

### Gap 3 — `merlin_asks` is duplicated state with `agent_runs.ask_resolution`

Migration 034 added `ask_resolution` directly on `agent_runs`. The legacy
`merlin_asks` table is still written by some agents for compat, but the
canonical resolution state now lives on `agent_runs`. Old surfaces (Activity
calls) read merlin_asks; new surfaces (Hypervisor CTAs) read agent_runs.

Fix: stop writing `merlin_asks` rows in agent code; rewrite `useMerlinAsks` to
read `agent_runs` filtered to `decision='ask' AND ask_resolution IS NULL`.
Eventually drop the table.

### Gap 4 — MessageDrawer only specializes `agent_run`

Activity rows (incidents, merlin_asks) currently route to legacy detail views
or open the chat with a seeded query. Once they're all `agent_run` rows
(gaps 2 + 3), MessageDrawer's existing `AgentRunBody` handles them
uniformly — no per-type drawer branches needed.

---

## Quick rule of thumb when adding a surface

1. **Is the data already in `agent_runs`?** Use a hook from `agent-runs.js`.
2. **Is it a chat-style message?** Tag with `meta: { kind: '...' }` to route
   to the Activity tab; leave `meta` off for true conversation.
3. **Does the surface need richer detail than the card fits?** Open
   `MessageDrawer` via `openMessage({ type, id, payload })` instead of
   inventing a new modal.
4. **Avoid adding to the simulator** for anything that should persist —
   wire a real cron-fired agent and write to `agent_runs` instead.
