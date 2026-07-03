# Demo · Meridian HQ

**The flagship demo.** A 50-floor corporate office tower in San Francisco, run by an in-house facility manager and serviced by SparkleCo, a contracted cleaning provider. This is the workspace to open first — it carries the full Merlin experience: live agents, contractor relationships, real cleaning routes, real SLAs.

> **One-line pitch:** "Here's what a tower this size looks like when an autonomous co-worker watches every floor, every shift, every contract."

---

## What the demo represents

- **One real-estate tenant** (Meridian Holdings) managing one premium 50-floor tower at _245 Bryant St, San Francisco_. ~780,000 sqft, ~416 displays, ~3,280 sensors.
- **Five departments running in parallel** — Facilities, Cleaning, Maintenance, Security, Compliance — each with its own daily plan, SLA targets, and Merlin agent.
- **One contractor relationship.** SparkleCo delivers cleaning services across the tower under a live SLA-tracked contract. The contractor side of the loop is reachable via the SparkleCo demo (see _Contractor demo_).
- **A live agent ecosystem.** Seven Merlin agents (Cleaning, HVAC, Space, Supply, Compliance, Energy, Security) tick autonomously and post handled actions + calls-for-action.

---

## Who to log in as

All accounts use the password **`merlin2026`** unless noted.

| Email                   | Role                                      | What they see                                                                                                         |
| ----------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `jamie@meridian.com`    | Facility Manager                          | Full FM shell — My day, Operations, Reports, Insights, Innovate. The default "buyer" perspective.                     |
| `maria@meridian.com`    | Cleaning Lead                             | Today's plan: routes, restroom sweeps, supply runs, feedback flags. Crew-facing.                                      |
| `darnell@meridian.com`  | Maintenance Tech                          | HVAC drift, work orders, vendor tickets. Maintenance-facing.                                                          |
| `ivan@meridian.com`     | Security                                  | Badge events, after-hours access, patrol routes. Security-facing.                                                     |
| `robin@adaptiv.systems` | Adaptiv super-admin (also platform admin) | Sees the customer shell **plus** has access to `/platform` back-office. Use this to switch workspaces or impersonate. |

To switch buildings within Meridian (HQ ↔ Distribution Center East ↔ Health Clinic), use the **building picker** in the top-left of the topbar.

---

## What to try (suggested 10-minute tour)

1. **Sign in as Jamie.** Land on My day. Notice the "What do I need to know" eyebrow, the 1–3 attention cards (active incidents above the FM's review line), and the "Since you last checked, Merlin handled these" rows — those are real agent actions from the last few hours, not marketing copy.
2. **Open the Merlin chat sidebar** (right of the screen). Ask: _"What's the VOC situation on Floor 32?"_ The chat is grounded in the building's room directory and live SLA state — answers are specific, not vague.
3. **Click into Operations → Hypervisor.** Drill the location tree: Building → 50 floors → rooms (restrooms, conference rooms, mailroom, server room) → devices. Every leaf shows the actual device and its last-seen state.
4. **Operations → Schedules.** 23 routes seeded across the tower. Pick _"Morning restroom sweep · Low-rise (Fl 3-17)"_ — see the zones it visits, the assigned crew (Priya primary, Maria substitute), and yesterday's actuals.
5. **Operations → Contracts.** SparkleCo's live contract shows current SLA% (cleaning hygiene response, supply stockouts) + the running cost-of-contract. Click into a contract for the proposals + monthly reports loop.
6. **Innovate.** The marketplace shelf — Adaptiv first-party hardware (SDC restroom displays, PCB people counters, SLB smart loggers) and curated partner vendors mapped to specific operational problems.
7. **Sign out, sign back in as Maria.** She lands on the worker view — "My day" with restroom routes, feedback responses, NFC check-ins. Same data, very different shell, role-correct.

---

## Demo highlights to call out

- **Live Merlin chat** that knows the building's rooms, devices, SLAs, and active contracts.
- **23 cleaning routes across 50 floors** seeded with realistic team assignments.
- **Real agent activity:** Cleaning, HVAC, Space, Supply, Compliance, Energy, Security agents tick every 15 minutes. The "Merlin handled" rows on My day + Dashboard are not static.
- **The contractor intelligence loop:** SLAs → recommendations → proposals → reports → narrate → SLA-delta attribution. Reachable from both sides: Meridian (FM) sees their contractor's performance; SparkleCo (contractor) sees their portfolio. Demoable end-to-end.
- **Per-role shells.** The FM shell (Jamie), the worker shell (Maria, Darnell, Ivan), the contractor shell (Lisa @ SparkleCo), the platform-admin shell (Robin) all share the same data layer but render dramatically different surfaces.

---

## What's seeded in this demo

- 1 building (`hq`) · 50 floors · ~360 rooms (restrooms, meeting rooms, special floors)
- 208 zones · 23 routes
- ~3,700 devices (displays + sensors)
- 7 Merlin agents (Cleaning, HVAC, Space, Supply, Compliance, Energy, Security) ticking every 15 minutes
- 1 contractor contract (SparkleCo) — active, SLA-tracked, with proposals + monthly reports
- 4 SLAs (Hygiene response, Comfort, Air Quality, Supplies)

---

## Demo replay status

**On replay since 2026-05-17** (`replay_mode=true` on the Meridian org, 7-day fixture window). The Meridian org covers HQ + MDE + MHC under one tenant, so all three buildings share the same captured fixture (~14,500 runs + 5,000 asks across the org). Agent activity that lands on the My day's "Merlin handled these" panel, the Activity feed, and any per-agent decision pill is being **emitted from the captured fixture** by the replay-tick cron every minute. **No live Claude tokens are consumed for this tenant.** What you see is real-shaped activity at zero ongoing cost.

For platform admins: full operational doc at [`docs/operations/demo-replay.md`](../../operations/demo-replay.md).

---

## When to use this demo

- **Always open it first** — it's the highest-fidelity Merlin workspace.
- **Use it to anchor the "AI co-worker" narrative.** The autonomous-agent value proposition is most visible here.
- **Multi-building portfolio story** — show HQ first, then flip to Distribution Center East or Health Clinic via the picker to show portfolio expansion under one workspace.
