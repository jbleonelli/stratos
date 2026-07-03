# Demo · Hemisphere Center

**The event-driven demo.** A 70,000-seat multi-purpose arena in Brooklyn that compresses operations into 4-hour windows of ~100× steady-state activity. Where Meridian shows what an AI co-worker does for a tower running 24/7, Hemisphere shows what it does when the venue goes from quiet to packed and back, twice a week. Built 2026-05-20.

> **One-line pitch:** "Same Merlin platform, completely different operating tempo — watch agents reason about crowd flow, concession demand, and incident coordination during a live basketball game playing out in front of you."

---

## What the demo represents

- **One real-estate tenant** (Hemisphere Athletics, slug `hemisphere-center`) managing one venue — Hemisphere Center, 1,200,000 sqft, 7 floors, ~70k capacity for football / ~20k for basketball.
- **Event-driven operations.** Game-day shifts compress 8-12h of ops into a 4-hour window: parking fills T-3h before tipoff, ingress peaks T-1h to T-30m, Q1 starts at T0, halftime spikes restrooms + concessions, Q4 → egress → cleanup. Everything else is recovery.
- **A three-agent triangle, all stadium-flavored.** CrowdFlow (gates + density), ConcessionDemand (POS queues + sales), IncidentChoreography (coordinates the other two when patterns converge). All real Claude Haiku, no replay.
- **A game-clock-aware simulator** that drives device telemetry in real time against the actual current event. Turnstile counts ramp during ingress, concession sales climb through Q1-Q2, restroom occupancy peaks at halftime, gates open during egress.

This is the highest-temporal-resolution demo in Merlin. Meridian / FEB show breadth; Hemisphere shows what happens when an autonomous co-worker has to keep up with a real-time spike.

---

## Who to log in as

All accounts use the password **`merlin2026`** unless noted.

| Email                   | Role                        | What they see                                                                              |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| `jb@adaptiv.systems`    | Owner + Adaptiv super-admin | Full workspace (My day, Operations, Reports, Insights, Innovate) + `/platform` back-office |
| `robin@adaptiv.systems` | Adaptiv super-admin         | Same as JB. Use for switching between Hemisphere and other workspaces                      |

(Customer-side personas — Venue Director, Ops Manager, Concessions Manager, Security Lead — are not seeded yet. Phase 6 work if/when it ships.)

To switch into Hemisphere, use the workspace picker in the top-left.

---

## The three agents

| Agent                    | Watches                                                                                                                  | Triggers an `ask` when                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CrowdFlow**            | Turnstile counts (4 gates × 4 turnstiles), crowd-flow cameras (8 quadrant cams), restroom occupancy sensors (7 clusters) | Quadrant density > 90% sustained, gate ingress imbalance during peak-ingress, restroom > 90% with wait time                                                       |
| **ConcessionDemand**     | Food-POS terminals (16 across 8 stands)                                                                                  | Queue > 12 sustained, adjacent stand imbalance (one stand 3× the neighbor), stockout risk (sales pace × remaining_min > $2k), slow pace mid-game                  |
| **IncidentChoreography** | The other two agents' decisions + open asks                                                                              | A single zone appears in ≥2 asks from different agents (zone convergence), ≥4 open asks accumulating (ask backlog), high-priority ask uncovered > 10 min (orphan) |

All three are stadium-gated: they emit a clean `skip` row for non-stadium tenants instead of polluting their activity feeds.

The agents run on the shared `/api/agents/tick` cron (every 15 min for Hemisphere, configurable per-org via `merlin_config.tick_settings`). They use Claude Haiku via `runHeartbeatAgent` in `api/agents/_shared.ts` — same machinery as Cleaning, HVAC, etc.

---

## Event lifecycle (basketball calibration)

The simulator's `phaseOf()` function maps "minutes since tipoff" to one of 13 phases. Each phase carries four 0..1 factors (crowd / concession / restroom / gateRate) + an HVAC load delta. The simulator runs every minute and rewrites every device's `telemetry` to match.

| Phase        | T window        | crowd | concession | restroom | gate ingress |
| ------------ | --------------- | ----- | ---------- | -------- | ------------ |
| pre-game     | T-3h to T-1h    | 0.10  | 0.10       | 0.05     | 0.05         |
| peak-ingress | T-1h to T-30m   | 0.55  | 0.55       | 0.50     | **1.00**     |
| ingress-tail | T-30m to T-15m  | 0.80  | 0.50       | 0.45     | 0.55         |
| pre-tipoff   | T-15m to T0     | 0.92  | 0.35       | 0.40     | 0.20         |
| Q1           | T0 to T+12m     | 0.95  | 0.30       | 0.25     | 0.05         |
| break q1-q2  | T+12m to T+15m  | 0.95  | 0.60       | 0.55     | —            |
| Q2           | T+15m to T+27m  | 0.95  | 0.30       | 0.25     | —            |
| **halftime** | T+27m to T+42m  | 0.90  | **1.00**   | **0.95** | —            |
| Q3           | T+42m to T+54m  | 0.93  | 0.30       | 0.30     | —            |
| break q3-q4  | T+54m to T+57m  | 0.93  | 0.55       | 0.50     | —            |
| Q4           | T+57m to T+72m  | 0.90  | 0.40       | 0.35     | —            |
| egress       | T+72m to T+90m  | 0.45  | 0.20       | 0.60     | —            |
| cleanup      | T+90m to T+150m | 0.05  | 0.05       | 0.10     | —            |

Source: `api/cron/stadium-event-tick.ts`. Adjust the table or add sport-specific calibrations there — non-basketball sports (football, hockey, soccer, concerts) currently map onto the basketball table via `duration_min` scaling.

---

## What to try (suggested 10-minute tour)

1. **Sign in as JB.** Workspace picker → Hemisphere Center → My day.
2. **Live event banner at the top.** Dark broadcast-style strip showing LIVE status, scoreboard, 5 KPI cards (ingress, peak density, longest queue, busiest restroom, total concession sales), and the latest 3 agent decisions.
3. **The heatmap below it.** Top-down stadium plan, 12 quadrant cells (4 cardinal × 3 decks) colored by camera density, gate badges with per-minute ingress rates, concession badges with queue length, restroom badges with occupancy %. Field in the center shows live score + game clock.
4. **Click any zone.** A detail panel opens below the SVG with the devices wired in that zone (with telemetry fields surfaced) + recent agent decisions affecting that location. Click ✕ to close, or click a different zone to switch.
5. **Schedule card at the bottom.** Lists upcoming + recent events in a ±7d window. Click a row to expand for capacity, duration, metadata, and the event id (useful for back-office SQL).
6. **Wait 15 minutes during a live event.** A fresh `agent_runs` row lands from each of the three agents. During halftime, expect CrowdFlow to fire `dispatch_overflow_attendants` for the busiest restroom; ConcessionDemand to fire `redirect_traffic` for the longest queue; IncidentChoreography to fire `dispatch_coordinator` if both agents flag the same zone.
7. **Switch to `/platform` (Robin/JB only).** Hemisphere appears in `/platform/tenants` with the amber **DEMO** badge.

---

## Running a fresh demo session

Stadium demos work best when there's an active or imminent event. To set one up:

```sql
-- Schedule a "tipoff in 30 min" basketball game so the audience sees
-- pre-game ramp → tipoff → game-clock → halftime over a 90-min demo
-- window. Adjust starts_at as desired.
insert into public.stadium_events
  (organization_id, building_id, name, sport, starts_at,
   duration_min, attendance_target, status, metadata)
values
  ('5ad11ce5-7e57-4dec-9000-7e57ad11ce55'::uuid,
   'hemisphere-stadium',
   '<Home Team> vs. <Away Team>',
   'basketball',
   now() + interval '30 minutes',
   150,        -- 2.5h event window
   18000,      -- arena basketball capacity
   'scheduled',
   '{"broadcast":"ESPN","demo":true}'::jsonb);
```

The `stadium-event-tick` cron picks it up within a minute, the StadiumLiveBoard banner appears in the customer app showing T-30min countdown, and telemetry starts ramping per the phase model.

For an instant-halftime demo (skip the wait), set `starts_at = now() - interval '33 minutes'` so the first cron tick computes tMin=33 → halftime phase → restroom 0.95 + concession 1.00. The next agents/tick (within 15 min) should produce an `ask` from at least one stadium agent.

---

## What's seeded in this demo

- **1 ecosystem** (`hemisphere`) → **1 building** (`hemisphere-stadium`, variant=`stadium`, 1.2M sqft, 7 floors)
- **10 floors** (field, lower-bowl, mid-deck, upper-deck, suites, press-box, two concourses, loading-dock, parking-lot)
- **49 zones** (4 gates, 16 quadrants, 8 concessions, 7 restrooms, 8 suites, 4 parking lots, 2 loading bays)
- **57 devices** (16 turnstiles, 16 food-POS, 8 cameras, 7 restroom-occupancy sensors, 4 HVAC controllers, 4 gate-control panels, 2 scoreboards)
- **3 stadium agents** (CrowdFlow, ConcessionDemand, IncidentChoreography) ticking every 15 minutes
- **Game-clock simulator** (`/api/cron/stadium-event-tick`) ticking every minute
- **Events table** (`public.stadium_events`, migration 158) — RLS-gated, realtime-published

---

## Architecture cheat-sheet

| Layer                                   | File                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| Seed                                    | `scripts/seed-hemisphere-center.sql`                                                 |
| Events schema                           | `supabase/migrations/158_stadium_events.sql`                                         |
| Simulator cron                          | `api/cron/stadium-event-tick.ts` + `vercel.json` (every-minute schedule)             |
| CrowdFlow agent                         | `api/agents/crowd-flow.ts`                                                           |
| ConcessionDemand agent                  | `api/agents/concession-demand.ts`                                                    |
| IncidentChoreography agent              | `api/agents/incident-choreography.ts`                                                |
| Customer surface: live banner           | `src/app/StadiumLiveBoard.jsx`                                                       |
| Customer surface: heatmap + zone drawer | `src/app/StadiumHeatmap.jsx`                                                         |
| Customer surface: schedule card         | `src/app/StadiumSchedule.jsx`                                                        |
| My day integration                      | `src/app/My day.jsx` (three `<Stadium*>` mounts, conditional on `variant='stadium'`) |

`devices.kind` is a closed CHECK enum, so stadium-specific roles (turnstile, food-pos, scoreboard) live in `telemetry.subtype`. All three agents and all three customer surfaces branch on subtype.

---

## What's NOT included (Phase 6+ candidates)

- **Stadium-specific roles** — no Venue Director / Ops Manager / Concessions Manager personas yet
- **Contractor side** — cleaning + security at a stadium are typically contracted; no contractor org wired yet
- **Per-event SLAs** — no SLAs scoped per event (e.g. "98% of attendees ingress within 30 min of doors")
- **Floor-plan editor** — the SVG layout is hand-coded for Hemisphere only; no per-tenant customization yet
- **Mobile responsiveness** — the heatmap SVG renders at fixed 760px width; phones get a scrollbar
- **Non-basketball calibrations** — football/concert phases scale from the basketball table via `duration_min`; not yet validated for accuracy
- **Multi-event same-night** — the simulator finds the first active event in the window; consecutive events on the same day work, simultaneous events on the same building do not

---

## Memory pointer

Build narrative: [session-2026-05-20-stadium-demo](../../../memory/) (handoff to be written) covers the 17-PR sprint that built this (PRs #501-#517 plus diagnostic chain). Each phase corresponds to a numbered Phase 1-5 task in the session.

When to use this demo: open it **second**, after Meridian. Meridian anchors the AI-co-worker narrative; Hemisphere shows what changes when the operational tempo goes from steady to spiky.
