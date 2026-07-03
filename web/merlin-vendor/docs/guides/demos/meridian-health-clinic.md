# Demo · Meridian Health Clinic

**The portfolio-expansion demo (healthcare edition).** A 92,000 sqft outpatient + surgical clinic at 200 Longwood Ave, Boston (the medical district), operated by the same Meridian team. Same workspace, same agents, same contractor relationship — but the SLAs become **safety-critical** and the pitch shifts from "ops software" to "patient-safety infrastructure."

> **One-line pitch:** "Your office tower buys Merlin for convenience. Your clinic buys Merlin because terminal cleaning between procedures is a reportable event if it slips."

---

## What the demo represents

- **Same Meridian Holdings org** as the HQ tower + Distribution Center. The clinic is a third building in the same workspace.
- **3 floors** with different functions on each:
  - **Ground · Outpatient** — Reception, waiting room, imaging, lab, pharmacy, 3 exam rooms, restrooms
  - **Patient Care** — 8 ward rooms, nurse station, med storage, soiled/clean utility
  - **Surgical** — 4 ORs, Pre-op, PACU (recovery), sterile processing, scrub station
- **Different agents, different stakes.** Pharmacy-Temperature monitors the pharmacy + med-room fridges. Cleaning agent now tracks EPA-listed terminal-clean compliance, not just office tidying.
- **4 hospital-specific SLAs** — OR turnaround < 25 min, terminal clean 100% of discharges, pressure cascade ≥ 2.5 Pa, hand hygiene ≥ 80%. Each carries an operational owner (EVS lead, Facilities lead, Infection control lead).

---

## Who to log in as

Same Meridian accounts as the HQ demo — one workspace, three buildings. Password **`merlin2026`** unless noted.

| Email                  | Role             | What changes for this building                                                                                                                                    |
| ---------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jamie@meridian.com`   | Facility Manager | My day shows clinic incidents (pressure cascade reversal, terminal clean overdue, pharmacy drift). Eyebrow reads "Meridian Health Clinic · clinic · 92,000 sqft". |
| `maria@meridian.com`   | Cleaning Lead    | EVS routes — ward bed turnover, terminal-clean OR rotation, sterile-zone end-of-day. Not office sweeps.                                                           |
| `darnell@meridian.com` | Maintenance Tech | HVAC pressure cascade compliance, sterile-processing equipment.                                                                                                   |
| `ivan@meridian.com`    | Security         | Badge events for the sterile zone + pharmacy controlled doors.                                                                                                    |

**To switch into the clinic**, sign in as any Meridian user and pick _Meridian Health Clinic_ from the building dropdown.

---

## What to try (suggested 7-minute tour)

1. **Sign in as Jamie. Flip the BuildingSwitcher** to _Meridian Health Clinic_. The My day eyebrow updates to _"clinic · 92,000 sqft"_.
2. **Read the attention cards.** Critical: _Pressure cascade reversal — OR 02 (sustained 14 min)_. High: _Terminal clean overdue — Ward Room 03 (+18 min over spec)_. High: _Pharmacy refrigerator drift — main pharmacy (4 °C → 6.8 °C)_. These are infection-control + cold-chain incidents, not office-tower noise.
3. **"Merlin handled these"** rows: USP 800 pharmacy log queued for sign-off, surgical-floor nighttime setback proposal, sterile-processing badge escalation. Each one would have required a human chase 15 years ago; the agents handle them in seconds.
4. **Operations → Hypervisor.** 3 floors → 32 specific rooms — ward rooms, ORs, sterile processing, pharmacy with refrigerator + freezer + lab incubators. 30 devices including 8 SLBs (2 in pharmacy, 3 in lab, 1 sterile humidity, 2 OR humidity + pressure).
5. **Operations → Schedules.** 4 EVS routes: pre-shift opening, ward bed turnover, terminal-clean OR rotation (SLA-critical), sterile-zone end-of-day. Diego runs the surgical routes; Priya runs the morning open.
6. **Operations → SLAs.** 4 hospital-specific SLAs alongside Meridian's existing four. Each shows its target + owner role (EVS lead, Facilities lead, Infection control lead).
7. **Innovate.** New shelf at the top: _"Built for clinics + hospitals"_ — 10 healthcare vendor cards. Diversey (EVS chemistry), Xenex (UV-C terminal disinfection), Steris (sterile processing), Hillrom (smart beds + nurse call), Camfil (HEPA filtration).
8. **Ask Merlin in chat:** _"How are we doing on terminal cleans this week?"_ or _"Is OR 02 safe to use right now?"_

---

## Demo highlights to call out

- **Safety-critical SLAs.** Terminal clean 100% (Joint Commission), pressure cascade ≥ 2.5 Pa (infection control), hand hygiene ≥ 80% (Joint Commission floor). When Merlin watches these, it's not convenience — it's patient safety.
- **Pharmacy-Temperature agent.** First healthcare-vertical agent. Watches pharmacy + med-room SLB probes with a tighter 15-min stale threshold (vs 20 min for ambient cold-chain). Asks for stock holds when readings drift — pharma-grade tolerance is narrower than ambient.
- **OR-aware My day.** The attention card _"Pressure cascade reversal — OR 02"_ would block the next case from being scheduled in a real OR — Merlin paused OR 02 turnover automatically.
- **Healthcare vendor catalog.** 10 real companies mapped to specific clinical workflows. Each card explains exactly how its events flow into Merlin's CTA pipeline.
- **Cross-domain agents.** The same Cleaning agent that runs HQ's restroom routes runs MHC's terminal-clean rotations — different cadence, different chemistry, same engine.

---

## What's seeded in this demo

- 1 building (`mhc`) · 3 floors · 32 rooms (ward rooms, ORs, sterile processing, pharmacy, lab, exam rooms)
- 18 zones · 4 EVS routes
- 30 devices: 3 e-ink restroom displays · 6 people counters · 8 smart loggers (pharmacy fridge + freezer, med fridge, 2 lab incubators, sterile humidity, 2 OR humidity + pressure) · 4 leak sensors · 4 cameras · 3 HID badge readers · 2 air quality sensors
- Pharmacy-Temperature agent active on pharmacy + med-room zones
- 10 healthcare-tagged vendor cards in Innovate
- 4 hospital-specific SLAs (OR turnaround, terminal clean, pressure cascade, hand hygiene)
- 6 pre-seeded "Merlin handled" agent actions

---

## Demo replay status

**On replay since 2026-05-17** — MHC is a building under the Meridian org, which carries `replay_mode=true` org-wide. The captured fixture (~14,500 runs + 5,000 asks total across HQ + MDE + MHC) re-emits via the replay-tick cron every minute. Pharmacy-Temperature agent activity you see on the My day or Activity feed is part of that fixture. **No live Claude tokens are consumed** — important given that MHC's clinical SLAs would otherwise mean elevated agent tick volume.

See [`docs/operations/demo-replay.md`](../../operations/demo-replay.md) for the operational flow.

---

## When to use this demo

- **For health-system audiences.** Director of Facilities, COO, infection-control leadership.
- **After Meridian HQ**, to elevate the stakes. The same demo that felt convenient in an office tower feels essential here.
- **For C-suite buyers** who care about reportable events, Joint Commission readiness, and operational risk reduction.
