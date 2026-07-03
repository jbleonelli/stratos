# Hospital

**Tagline:** 2-wing medical center · 50 zones · 10 crew · tight infection-control SLAs
**Icon:** warn
**Vertical:** Healthcare

## Story

A mid-sized regional medical center. Two buildings connected by a skybridge: the Main Tower (patient rooms, outpatient, admin) and the Trauma Wing (ER, operating rooms, ICU). Both under one hospital ecosystem. Operations are 24/7. **Riverside Regional Medical Center** owns + self-manages the campus. Three specialized contractors handle the operational load: **MedClean Specialty** for healthcare-grade EVS, **Cardinal Biomed Services** for clinical equipment maintenance, and **Vigilance Hospital Security** for armed + certified security. These are vertical-specific firms — not generic cleaning or security — and the SLAs reflect it.

This is the **compliance + SLA-driven** scenario. Every high-risk zone has a tight SLA threshold. Merlin's value here is **prioritization under pressure** — when a trauma comes in and ER hygiene clock starts ticking, Merlin reshuffles the queue.

## What Merlin demonstrates

The **"trauma-driven reshuffle"** narrative. A Code Trauma fires at 14:15. ER Bay 3 turnover SLA is 20 minutes. At 14:35 the bay must be ready for the next patient. Merlin sees the clinical event, pulls EVS from their scheduled patient room turn, dispatches to ER Bay 3, bumps the patient room turn by 40 minutes. The room coordinator gets notified, the SLA holds, no human oversight required — because autonomy on EVS is `full-auto` and the playbook is trained.

The demo shows:

- Route overrides from today: multiple `merlin` sources for ER cascading reshuffles
- SLA at-risk rollup on Trauma Wing showing 1 active risk that Merlin defused
- An incident feed dominated by auto-handled rows

Second narrative: **regulatory audit trail**. Every cleaning, every turnover, every override — recorded in `incident_actions` + `route_overrides`. Pull the Audit view on any zone + show the continuous history.

## Structure

```
Riverside Regional Medical Center (ecosystem, root · self-managed)
├── Main Tower (building)
└── Trauma Wing (building)
```

## Organizations (4)

| ID                | Name                              | Kind          | Role in scenario                                         |
| ----------------- | --------------------------------- | ------------- | -------------------------------------------------------- |
| `riverside-rmc`   | Riverside Regional Medical Center | `real_estate` | Owner + self-manager. Rosa's org.                        |
| `medclean`        | MedClean Specialty                | `contractor`  | Healthcare-grade EVS. Patricia, Samuel, Tomás work here. |
| `cardinal-biomed` | Cardinal Biomed Services          | `contractor`  | Biomedical equipment maintenance. Vera's org.            |
| `vigilance-sec`   | Vigilance Hospital Security       | `contractor`  | Armed + certified security. Xavier's org.                |

## Contracts (3)

| #   | Name                                           | Manager       | Contractor      | Service       | Monthly  | Covers                   | SLA summary                                                                                                                                     |
| --- | ---------------------------------------------- | ------------- | --------------- | ------------- | -------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | EVS for patient care + trauma                  | Riverside RMC | MedClean        | `cleaning`    | $180,000 | Main Tower + Trauma Wing | `er_bay_turnover_min: 20`, `or_turnover_min: 40`, `patient_room_turnover_min: 30`, `icu_turnover_min: 25`, `infection_control_protocol: strict` |
| 2   | Biomedical equipment maintenance               | Riverside RMC | Cardinal Biomed | `maintenance` | $95,000  | Main Tower + Trauma Wing | `emergency_response_min: 15`, `preventive_quarterly: true`, `on_call_24x7: true`                                                                |
| 3   | Hospital security + clinical area restrictions | Riverside RMC | Vigilance       | `security`    | $42,000  | Main Tower + Trauma Wing | `patrol_coverage: 24/7`, `armed_response: certified`, `clinical_restriction_enforcement: true`                                                  |

## Ecosystem

| Field       | Value                             |
| ----------- | --------------------------------- |
| ID          | `riverside-rmc`                   |
| Name        | Riverside Regional Medical Center |
| Address     | 1200 Hospital Dr · Portland, OR   |
| Kind        | ecosystem                         |
| Latitude    | 45.5152                           |
| Longitude   | -122.6784                         |
| Branches    | 2                                 |
| Owner org   | Riverside RMC                     |
| Manager org | Riverside RMC (self-managed)      |
| Custom      | true                              |

## Buildings (2)

| ID            | Name        | Kind     | Floors | Sqft    | Occupancy | Peak                | Lat     | Lng       |
| ------------- | ----------- | -------- | ------ | ------- | --------- | ------------------- | ------- | --------- |
| `rrmc-main`   | Main Tower  | building | 10     | 320,000 | 0.82      | 0.95                | 45.5153 | -122.6786 |
| `rrmc-trauma` | Trauma Wing | building | 4      | 120,000 | 0.78      | 0.99 (event-driven) | 45.5151 | -122.6780 |

## Zones (~50 total)

### Main Tower (`rrmc-main`) — ~32 zones

**Floor 1 — Lobby / Admissions**

- **Main Lobby** (lobby, `M-F1-LB`)
- **Admissions Desk** (reception, `M-F1-AD`)
- **Family Waiting** (other, `M-F1-FW`)
- **Public Women's Restroom** (restroom, `M-F1-WR`)
- **Public Men's Restroom** (restroom, `M-F1-MR`)
- **Cafeteria** (kitchen, `M-F1-CF`)
- **Gift Shop** (other, `M-F1-GS`)

**Floor 2 — Outpatient / Imaging**

- **Outpatient Reception** (reception, `M-F2-OP`)
- **Imaging Suite A** (utility, `M-F2-IM-A`) — 15-min SLA on turnover
- **Imaging Suite B** (utility, `M-F2-IM-B`) — 15-min SLA
- **Lab Draw Station** (utility, `M-F2-LB`) — 20-min SLA
- **Staff Lounge** (pantry, `M-F2-SL`)

**Floors 3–7 — Patient rooms (condensed)**

- **Nurses' Station — F3 / F4 / F5 / F6 / F7** (reception, one per floor)
- **Patient Room Pod A — F3 / F4 / F5 / F6 / F7** (other) — 30-min turnover SLA each
- **Patient Room Pod B — F3 / F4 / F5 / F6 / F7** (other) — 30-min turnover SLA each
- **Soiled Utility — F3 / F4 / F5 / F6 / F7** (utility, `M-FX-SU`)

(For the seed we model 5 floors × 4 zones = 20 zones in patient-care levels.)

**Floor 8 — ICU**

- **ICU Bay 1–4** (other, `M-F8-ICU-1..4`) — 25-min turnover SLA
- **ICU Nurses' Station** (reception)
- **ICU Soiled Utility** (utility)

**Floor 9 — Admin / Executive**

- **Admin Offices** (office)
- **Medical Records** (office) — no cleaning SLA but restricted access

**Floor 10 — Mechanical**

- **Rooftop Mechanical** (utility)

### Trauma Wing (`rrmc-trauma`) — ~18 zones

**Floor 1 — Emergency Department**

- **ED Reception** (reception, `T-F1-RC`)
- **ED Triage** (other, `T-F1-TR`) — 10-min refresh SLA
- **ER Bay 1 / 2 / 3 / 4 / 5 / 6** (other, `T-F1-ER-1..6`) — **20-min turnover SLA**, the tightest in the whole demo
- **Trauma Bay 1 / 2** (other, `T-F1-TB-1..2`) — 20-min turnover SLA
- **Ambulance Dock** (utility, `T-F1-AD`)

**Floor 2 — Operating Rooms**

- **OR Suite 1 / 2 / 3** (utility, `T-F2-OR-1..3`) — **40-min turnover SLA**, deep clean protocol
- **OR Scrub Station** (utility, `T-F2-SC`)
- **Post-Op Recovery** (other, `T-F2-PO`) — 25-min SLA

**Floor 3 — Support**

- **Central Sterile** (utility, `T-F3-CS`)
- **Storage / Supplies** (storage, `T-F3-SS`)

**Floor 4 — Mechanical**

- **Mechanical Penthouse** (utility)

## Merlin user accounts (7)

Hospital has the richest per-role diversity because the trauma narrative spans multiple departments. Seven accounts cover the scenario's decision points: a director at Riverside, a contractor manager at MedClean, and workers distributed across all three contractors.

| username        | name            | profile role  | at org          | org role | bio                                                                                                                                                          |
| --------------- | --------------- | ------------- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rosa-rrmc`     | Rosa Chen       | `facility`    | Riverside RMC   | admin    | Director of Environmental Services at Riverside. Approves overrides that cross wings, reviews SLA compliance daily. Persona = **facility_manager**.          |
| `aaliyah-rrmc`  | Aaliyah Brown   | `facility`    | MedClean        | admin    | Runs MedClean Specialty. One big contract covers the entire hospital — trauma reshuffles are existential for her business. Persona = **contractor_manager**. |
| `patricia-rrmc` | Patricia Okafor | `cleaning`    | MedClean        | member   | EVS lead, Main Tower. Patient rooms + ICU. Persona = **worker**.                                                                                             |
| `samuel-rrmc`   | Samuel Egan     | `cleaning`    | MedClean        | member   | EVS lead, ER turnover. The most reactive role — sees Merlin's trauma reshuffles from the inside. Persona = **worker**.                                       |
| `tomas-rrmc`    | Tomás Reyes     | `cleaning`    | MedClean        | member   | EVS lead, OR suite turnover. 40-min SLA workflow. Persona = **worker**.                                                                                      |
| `vera-rrmc`     | Vera Lindgren   | `maintenance` | Cardinal Biomed | member   | Biomedical engineer. Persona = **worker**. Shows maintenance-role-at-contractor view.                                                                        |
| `xavier-rrmc`   | Xavier Colón    | `security`    | Vigilance       | member   | Hospital security lead. Persona = **worker**.                                                                                                                |

## Team roster (10 crew, split across 3 contractor orgs)

### MedClean Specialty (6 crew)

| Name            | Role                | Initials | Primary Location | Schedule            |
| --------------- | ------------------- | -------- | ---------------- | ------------------- |
| Patricia Okafor | EVS Lead            | PO       | Main Tower       | Mon–Fri 06:00–14:00 |
| Quincy Walters  | EVS · patient rooms | QW       | Main Tower       | Mon–Sun 06:00–14:00 |
| Rita Kowalski   | EVS · overnight     | RK       | Main Tower       | Sun–Thu 22:00–06:00 |
| Samuel Egan     | EVS · ER turnover   | SE       | Trauma Wing      | Mon–Sun 07:00–15:00 |
| Tomás Reyes     | EVS · OR turnover   | TR       | Trauma Wing      | Mon–Fri 06:00–14:00 |
| Uma Patel       | EVS · evening ER    | UP       | Trauma Wing      | Mon–Sun 15:00–23:00 |

### Cardinal Biomed Services (2 crew)

| Name          | Role           | Initials | Schedule            |
| ------------- | -------------- | -------- | ------------------- |
| Vera Lindgren | Biomedical eng | VL       | Mon–Fri 07:00–15:00 |
| Will Ngoyi    | Facilities eng | WN       | Mon–Fri 07:00–15:00 |

### Vigilance Hospital Security (2 crew)

| Name         | Role             | Initials | Schedule            |
| ------------ | ---------------- | -------- | ------------------- |
| Xavier Colón | Security Lead    | XC       | Mon–Fri 06:00–14:00 |
| Yasmin Bahri | Evening security | YB       | Mon–Sun 14:00–22:00 |

## Routes (6)

Routes 1–5 attach to contract #1 (MedClean EVS). Route 6 attaches to contract #3 (Vigilance security). Cardinal Biomed generates maintenance asks + overrides but no recurring routes in this scenario.

| #   | Name                               | Scope         | Contract     | Service       | Cadence | Start      | Duration  | SLA        | Primary  |
| --- | ---------------------------------- | ------------- | ------------ | ------------- | ------- | ---------- | --------- | ---------- | -------- |
| 1   | Main Tower morning sweep           | Main Tower    | #1 MedClean  | surface_clean | daily   | 06:00      | 240 min   | 30 min     | Patricia |
| 2   | Patient room turnover — continuous | Main Tower    | #1 MedClean  | deep_clean    | daily   | 07:30      | ongoing   | 30 min     | Quincy   |
| 3   | Overnight patient-care audit       | Main Tower    | #1 MedClean  | inspection    | daily   | 22:30      | 180 min   | —          | Rita     |
| 4   | ER bay turnover — on-demand        | Trauma Wing   | #1 MedClean  | deep_clean    | daily   | continuous | per-event | **20 min** | Samuel   |
| 5   | OR suite turnover                  | Trauma Wing   | #1 MedClean  | deep_clean    | daily   | 06:00      | scheduled | **40 min** | Tomás    |
| 6   | Campus security rounds             | Riverside RMC | #3 Vigilance | patrol        | daily   | 14:00      | 180 min   | —          | Yasmin   |

Routes 2 + 4 are "on-demand" in spirit — they're scheduled daily but Merlin pulls them ahead or delays based on clinical events. The seed captures them as daily cadences with aggressive SLA thresholds so the rollup "N at risk" count moves when reality moves.

## Assignments

- **Route 1** → Patricia (primary), Quincy (sub)
- **Route 2** → Quincy (primary), Patricia (sub)
- **Route 3** → Rita (primary)
- **Route 4** → Samuel (primary), Uma (sub for evenings)
- **Route 5** → Tomás (primary)
- **Route 6** → Yasmin (primary), Xavier (sub for weekday days)

## Seeded history (last 7 days)

### Route overrides (~18 — this scenario is the most override-heavy)

- **Today, 14:15** — _(Active)_ Merlin reroute on Route 4: "ER Bay 3 turnover — Code Trauma inbound. SLA 20m. EVS dispatched, patient room turn bumped +40m." `merlin`, `extra`. _(Headline narrative.)_
- **Today, 14:35** — Merlin follow-up on Route 2: "Patient Room F5-A turn delayed +40m to accommodate ER. Family notified." `merlin`, `note`.
- **Today, 07:45** — Merlin on Route 5: "OR Suite 2 turnover accelerated — surgical case ahead of schedule." `merlin`, `extra`.
- **Yesterday, 23:10** — Merlin on Route 3: "ICU Bay 2 audit pulled early — occupancy sensor anomaly cleared as false." `merlin`, `note`.
- **Yesterday, 14:40** — Merlin on Route 4: "ER Bay 1 turnover — SLA met with 3m buffer." `merlin`, `note`.
- **Yesterday, 08:20** — Human on Route 5: "OR 3 biohazard spill — Tomás requested extra supplies." `human`, `extra`.
- **2 days ago, 16:30** — Merlin on Route 6: "Ambulance dock door held open 6m — auto-closed, Yasmin notified async." `merlin`, `note`.
- **3 days ago, 11:15** — Merlin on Route 2: "Patient Room F4-B early turn — discharge confirmed." `merlin`, `extra`.
- **4 days ago, 14:00** — Merlin on Route 4: "ER mass-casualty pre-position — reshuffled schedule -1hr." `merlin`, `extra`. (Looked scary, ended up being a drill.)
- ...plus ~9 more similar micro-reshuffles.

### Incident actions (~30)

Heavy on `Auto` pills. A few human approvals on the more aggressive reshuffles. One escalation last week: "Floor 6 HVAC drift — isolation protocol — Vera to review Mon AM."

## Agentic config

- Autonomy policy: `full-auto` for EVS (clinical SLA takes precedence), `approve-critical` for everything else
- Proactive pings: `normal`
- Approval confidence threshold: 70%
- Persona: `professional`

## What loading this demo feels like

1. Demo seeds 4 orgs + 3 contracts + the ecosystem + 2 buildings + ~50 zones + 6 routes + 10 team_members + rich override history. Loader lands as owner of **Riverside RMC** (the self-manager org).
2. Dashboard: dense activity feed, mostly `Auto`-handled events. The Code Trauma row is at the top with the cascading Merlin reroutes as replies.
3. Admin → Locations: `2 buildings · 50 zones · 6 routes · 5 today · 4 overrides · 2 at risk · 12 actions`. Trauma Wing alone: `1 building · 18 zones · 3 routes · 3 today · 3 overrides · 1 at risk`.
4. User menu shows sign-in-as Aaliyah → contractor_manager shell at MedClean. One giant contract ($180k/mo, 5 SLA terms including 20-min ER bay turnover). This is the scenario's most visceral "SLA = livelihood" moment for the contractor view.
5. Sign-in-as Samuel → worker shell showing Route 4 (ER bay turnover) with its 20-min SLA pill.

This is the scenario for healthcare buyers, regulated verticals, and any pitch where audit trail + SLA compliance is the spine of the buyer's job.
