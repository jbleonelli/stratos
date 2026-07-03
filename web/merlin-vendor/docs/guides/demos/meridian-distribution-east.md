# Demo · Meridian Distribution Center East

**The portfolio-expansion demo (warehouse edition).** A 240,000 sqft distribution center in Allentown PA, operated by the same Meridian team that runs the HQ tower. Same workspace, same agents, same contractor relationship — different building shape, different problems.

> **One-line pitch:** "Your office tower lights up Merlin. Now flip a building over and watch the same software cover your distribution centers — without buying anything new."

---

## What the demo represents

- **Same Meridian Holdings org** as the HQ tower. The distribution center is a second building in the same workspace, not a separate Merlin install.
- **A 2-level warehouse** — 15 aisles per floor, 2 loading docks, cold storage, breakroom, shipping office, manager's office, restrooms.
- **A different agent palette.** Cold-chain monitoring on the SLB temperature probes, dock-door safety on the loading bays, sweep schedules optimized for warehouse foot traffic — not office floors.
- **The vertical-recommended Innovate shelf.** When you switch to this building, the Innovate marketplace surfaces _warehouse-relevant_ vendor cards at the top: Crown WIM (forklift telemetry), Locus Robotics (collaborative picking), Rite-Hite (dock safety), Cooler Concepts (cold-chain monitoring).

---

## Who to log in as

Same Meridian accounts as the HQ demo — all under one workspace. Password **`merlin2026`** unless noted.

| Email                  | Role             | What changes for this building                                                                                                                                           |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `jamie@meridian.com`   | Facility Manager | My day shows warehouse incidents (cold storage drift, trailer creep, forklift impact). The eyebrow reads "Meridian Distribution Center East · warehouse · 240,000 sqft". |
| `maria@meridian.com`   | Cleaning Lead    | Aisle sweep routes + dock cleaning instead of restroom routes.                                                                                                           |
| `darnell@meridian.com` | Maintenance Tech | Loading-dock equipment, cold-storage compressors, racking integrity.                                                                                                     |
| `ivan@meridian.com`    | Security         | Dock badge events, after-hours dock-held-open alerts.                                                                                                                    |

**To switch into the warehouse view**, sign in as any Meridian user and pick _Meridian Distribution Center East_ from the building dropdown in the topbar.

---

## What to try (suggested 7-minute tour)

1. **Sign in as Jamie. Flip the BuildingSwitcher** to _Meridian Distribution Center East_. Notice My day’s eyebrow updates to read _"warehouse · 240,000 sqft"_ — the same Merlin shell, instantly building-aware.
2. **Read the attention cards.** Critical: _Cold storage temp drift — Bay A_. High: _Trailer creep flagged — Loading Dock A_. _Forklift impact event — Aisle 09_. These are warehouse-specific, not office incidents.
3. **Open Operations → Hypervisor.** Drill into the 2 floors (Ground · Mezzanine). 30 aisle rooms + 11 special rooms (loading docks, cold storage, breakroom). 30 devices distributed across them — including 2 SLB probes in cold storage.
4. **Operations → Schedules.** 4 routes optimized for warehouse cadence: dock + cold storage daily check, restroom + breakroom morning, aisle sweep Ground + Mezzanine.
5. **Operations → Devices.** Filter to cold storage. 2 SLB probes report temperature + humidity to the Cold-Chain agent.
6. **Innovate.** New shelf at the top: _"Recommended for Meridian Distribution Center East"_ — 10 warehouse-specific vendor cards. Click into Rite-Hite or Cooler Concepts for the integration pitch.
7. **Ask Merlin in chat:** _"What's happening on the loading docks today?"_ The reply is grounded in the docks' actual zones + recent alerts.

---

## Demo highlights to call out

- **Same workspace, different shape.** Flipping the building switcher is the entire UX of expansion — no second install, no separate login.
- **Cold-Chain agent.** First warehouse-vertical agent. Watches the cold-storage SLB probes for stale readings or sustained drift, asks for a tech dispatch when patterns warrant.
- **Variant-aware Innovate shelf.** The marketplace surfaces vertical-relevant vendors _because_ the building carries `variant='warehouse'`. The same shelf shows healthcare vendors when you flip to the Health Clinic.
- **Kind-aware My day eyebrow.** "Meridian Distribution Center East · warehouse · 240,000 sqft" instead of generic "Meridian Distribution Center East." Small touch, big legibility win for portfolio operators.

---

## What's seeded in this demo

- 1 building (`mde`) · 2 floors · 30 aisle rooms · 11 special rooms
- 16 zones · 4 cleaning routes
- 30 devices: 3 e-ink restroom displays · 6 people counters · 6 smart loggers (incl. 2 in cold storage) · 4 leak sensors · 4 cameras · 4 HID badge readers · 3 air quality sensors
- Cold-Chain agent active on the cold-storage zone
- 10 warehouse-tagged vendor cards in Innovate
- 6 pre-seeded "Merlin handled" agent actions (cold storage compressor nudge, forklift battery reorder, aisle setback proposal, HACCP audit log, dock-B escalation, manager-office release)

---

## Demo replay status

**On replay since 2026-05-17** — MDE is a building under the Meridian org, which carries `replay_mode=true` org-wide. The captured fixture (~14,500 runs + 5,000 asks total across HQ + MDE + MHC) re-emits via the replay-tick cron every minute. Cold-Chain agent activity you see on the My day or Activity feed is part of that fixture. **No live Claude tokens are consumed.**

See [`docs/operations/demo-replay.md`](../../operations/demo-replay.md) for the operational flow.

---

## When to use this demo

- **After Meridian HQ**, to show portfolio expansion. The narrative is _"we already cover your office floors — same software, no new install, also covers your distribution centers."_
- **For CFO/COO audiences** — the value proposition is _one platform across the portfolio, not one per asset type._
