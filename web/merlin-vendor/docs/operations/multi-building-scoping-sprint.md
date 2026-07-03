# Multi-building data-scoping sprint

**Status: 🟢 Asks-side shipped 2026-05-14. Other hooks (notifications, event firehose) remain org-scoped.** First wave closes the visible asks-leak across the Sidebar bell badge, Activity feed, Dashboard tiles, Chat persona, AgentDetailView. The structural plumbing (per-building agent runner fan-out + locationId surfaced on asks) is now reusable for the remaining hooks. The Meridian workspace today has 3 buildings (HQ + Distribution Center East + Health Clinic) under one org, and several hooks still surface org-wide data when they should be building-scoped — so switching buildings doesn't refresh the surface as expected.

JB flagged this 2026-05-14: _"when I switch from one building to another, events from Meridian HQ are still showing in Meridian warehouse"_ and _"alerts on the icons bar are stuck at 40."_

## TL;DR

`useMerlinAsks`, `useNotifications`, `useEventFirehose`, and several Dashboard / Operations widgets read at **org** scope. For single-building tenants (every workspace except Meridian today) that's fine. For multi-building tenants it leaks one building's activity into another building's shell.

The structural fix is **5 hours of careful work** touching ~15 files. Splitting by safe checkpoints below.

## The 4 separable PRs

### PR 1 — ✅ Done 2026-05-14: per-building tick fan-out

**Done differently from the original plan** — turned out `recordRun` / `writeAgentRun` already accepts `locationId` (param has been there since K-1). The runners already pass it through. The actual gap was that `tick.ts` always called the runners with `locationId: null`.

**Fix**: `api/agents/tick.ts` now enumerates the top-level buildings/ecosystems under each org (via the new `listActiveBuildings` helper in `_shared.ts`) and fans out one tick per agent per building. `agent_runs.location_id` now gets stamped at insert time going forward.

**Touches** (single PR):

- `api/agents/_shared.ts` — adds `listActiveBuildings(admin, orgId)` helper
- `api/agents/tick.ts` — wraps the agent loop in a buildings loop; passes `locationId: building.id` per fan-out. Falls back to `locationId: null` for orgs with no DB-side buildings (legacy demo).

**Backfill**: historical rows stay NULL. The client filter treats null `locationId` as "applies to all buildings" (so legacy asks stay visible regardless of selected building) — see PR 3.

**Cost**: ~3× Haiku call multiplier for multi-building orgs (Meridian: 9 → 27 calls per tick). Cents/day. No impact on FEB (1 ecosystem) or contractor orgs (0 buildings → falls back to single null tick).

### PR 2 — ✅ Done 2026-05-14: surface `locationId` on the ask shape

Manual two-step join (`merlin_asks` ↔ `agent_runs` are not FK-linked by design — memory: "manual two-step join"). `hydrateOnce` batches the location lookup in one `IN` query, stamps each ask's row with `location_id` before passing to `fromRow`. `fromRow` reads either the embedded `agent_runs.location_id` or an inline column.

Realtime INSERTs deliver merlin_asks columns only — no location join. The client filter treats null `locationId` as "applies to all" so realtime updates aren't filtered out; the next hydrate fills in the missing location data.

**Touches** (in the same PR as PR 1 above):

- `src/app/merlin-asks.js` — adds locationId to the client shape; batched join in hydrateOnce.

### PR 3 — 🟢 Partly done 2026-05-14: building filter on useMerlinAsks

`useMerlinAsks(buildingId)` accepts an optional building id and filters client-side via the dash-bounded prefix helper. Null locationId on the ask falls through (kept visible) so simulator + human asks aren't accidentally hidden.

**Still to do**:

- `useNotifications(orgId, buildingId)` — notifications mostly carry no location info today (proposal accepted, report sent — org-wide events); add filter only when a `payload.location_id` lands.

`useEventFirehose(orgId, buildingId)` ✅ shipped 2026-05-14 — same dash-bounded prefix helper applied to `row.location_id`. Plumbed through `MetricsWidgets.AgentDonutWidget`, `MetricsWidgets.LiveStreamWidget`, `Dashboard.FirehosePanel`, `Agentic.firehose` section. `todayCount` stays org-wide on purpose (daily activity pill = org total; building scoping only affects the listed rows).

### PR 4 — ✅ Done 2026-05-14: plumb `building.id` through consumers

All `useMerlinAsks()` call sites updated to `useMerlinAsks(building?.id)`:

- `src/app/Sidebar.jsx` — bell badge (line 46-49)
- `src/app/Activity.jsx` — Operations → Activity feed (added `building` prop; Operations.jsx passes it)
- `src/app/Dashboard.jsx` — hero copy + AgentsPanel tile (2 callsites)
- `src/app/Chat.jsx` — chat persona context
- `src/app/AgentDetailView.jsx` — per-agent ask filter (added `building` prop; App.jsx passes it)

`CallsForAction.jsx` only imports `answerAsk` (not the hook) — no change. `NotificationBell.jsx` reads from `useNotifications` which stays org-scoped for now (notifications are mostly org-events).

`MetricsWidgets.jsx` reads agent_runs directly, not asks — already covered by the building-scoped `useLatestAgentActions`.

## Verification approach

For each PR, the same smoke test:

1. Sign in as Meridian admin (`jb@adaptiv.systems`)
2. Land on HQ — note the bell count (X)
3. Building Switcher → MDE — bell count should change (probably 0 if no warehouse-specific asks yet)
4. Switch to MHC — same, distinct count
5. Switch back to HQ — count is X again
6. Repeat for incidents pool, attention cards, recent activity

The cross-tenant leak test suite (`tests/cross-tenant-leak.test.js`) should also gain a multi-building variant: verify that asks created by an HQ agent run aren't visible when MDE is the active building.

## Quick win already shipped (2026-05-14)

Bumped `MAX_CACHE` in [src/app/merlin-asks.js](src/app/merlin-asks.js) from 40 → 200 so the bell badge doesn't appear stuck at 40 in the meantime. Display still caps at `99+` so the visual is readable.

The structural sprint above remains the real fix.

## Out of scope

- **Per-building RLS on the DB side.** RLS today is org-scoped + has_location_access subtree gate. That's correct for security (a user can only see their org's rows). The multi-building issue here is **UX-side data scoping for one user who legitimately has access to all 3 buildings** — not a security leak. Don't tighten RLS for this.
- **Notifications model.** Notifications today are org-events (proposal accepted, report sent, etc.) — building-agnostic by design. Some MAY warrant per-building scoping later but that's a separate design question.
