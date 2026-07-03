# Bank network

**Tagline:** 24-branch regional bank · 150 zones · 12 crew · map-view primary
**Icon:** map
**Vertical:** Retail financial · distributed operations

## Story

A regional bank in Ohio and western Pennsylvania. Twenty-four branches spread across two states — small to mid-sized storefronts in strip malls, downtown corners, suburban plazas. The buildings are owned by **Heartland Real Estate Holdings** (the bank's captive real-estate arm) and managed by **Heartland Bank Facilities** (a separate corporate division with 3 regional facility managers). Three contractors handle the operational load — cleaning, maintenance, security — each with one multi-location contract covering all 24 branches.

The scale plus the dispersed workforce plus the vendor relationships make this **the map-view scenario**. A manager opens Merlin, switches to the map, and sees every branch at a glance — green/yellow/red — without having to click into a tree.

## What Merlin demonstrates

The **vendor coordination** narrative. Maple Cleaning's scheduled 06:00 sweep at Branch #14 (Toledo Downtown) didn't happen — the crew didn't check in by 06:30. Merlin raises a `vendor_no_show` ask at 06:35 with a suggested action: "Call Maple dispatch OR reassign to nearby Branch #11 crew (ETA +40m, acceptable per contract)." Manager approves the reassignment. Branch #14 gets cleaned 40 minutes late; Maple's contract compliance is logged for the quarterly review.

Second moment: the **map as primary nav**. Opening Admin → Locations lands on the map by default. A cluster of 24 pins across OH/western PA. Click a pin → branch-specific rollup. This is the scenario where the map view is not a polish feature — it's the primary interaction model.

## Structure

```
Heartland Regional Bank (ecosystem, root)
├── OH-Cleveland-01 ... OH-Cleveland-05
├── OH-Columbus-01 ... OH-Columbus-04
├── OH-Cincinnati-01 ... OH-Cincinnati-03
├── OH-Dayton-01, OH-Toledo-01, OH-Toledo-02
├── OH-Akron-01, OH-Youngstown-01
├── PA-Pittsburgh-01 ... PA-Pittsburgh-03
├── PA-Erie-01
└── PA-Scranton-01
```

24 branches flat under the ecosystem. No sub-ecosystems per city — the tree is deliberately shallow because regional management is matrix-based, not hierarchical.

## Organizations (5)

| ID                     | Name                           | Kind          | Role in scenario                                          |
| ---------------------- | ------------------------------ | ------------- | --------------------------------------------------------- |
| `heartland-re`         | Heartland Real Estate Holdings | `real_estate` | Owner of all 24 branches. Corporate real-estate arm.      |
| `heartland-facilities` | Heartland Bank Facilities      | `real_estate` | Manages all 24 branches. Regional FMs work here.          |
| `maple-cleaning`       | Maple Cleaning Services        | `contractor`  | Holds one multi-branch cleaning contract covering all 24. |
| `reliable-mech`        | Reliable Mechanical            | `contractor`  | Mobile maintenance across all branches.                   |
| `cardinal-sec`         | Cardinal Security              | `contractor`  | Evening + overnight security patrols.                     |

## Contracts (3)

Each contract covers all 24 branches — the bank network's distinctive shape. This is the scenario's most striking "one contract, many locations" view.

| #   | Name                                | Manager              | Contractor          | Service       | Monthly  | Covers          | SLA summary                                                                                 |
| --- | ----------------------------------- | -------------------- | ------------------- | ------------- | -------- | --------------- | ------------------------------------------------------------------------------------------- |
| 1   | Branch cleaning program · OH + PA   | Heartland Facilities | Maple Cleaning      | `cleaning`    | $120,000 | all 24 branches | `morning_window: 06:00-10:30`, `max_vendor_no_show_per_month: 2`, `weekend_coverage: light` |
| 2   | Multi-branch HVAC + maintenance     | Heartland Facilities | Reliable Mechanical | `maintenance` | $45,000  | all 24 branches | `max_response_min: 120`, `preventive_quarterly: true`, `rural_surcharge_applied: true`      |
| 3   | Evening + overnight branch security | Heartland Facilities | Cardinal Security   | `security`    | $60,000  | all 24 branches | `patrol_coverage: 17:00-01:00`, `atm_vestibule_priority: true`                              |

## Ecosystem

| Field       | Value                           |
| ----------- | ------------------------------- |
| ID          | `heartland-bank`                |
| Name        | Heartland Regional Bank         |
| Address     | Ohio + western PA · 24 branches |
| Kind        | ecosystem                       |
| Variant     | finance                         |
| Latitude    | 41.0793 (mid-Ohio)              |
| Longitude   | -81.5191                        |
| Branches    | 24                              |
| Displays    | 168 (7 per branch avg)          |
| Sensors     | 480 (20 per branch avg)         |
| Owner org   | Heartland Real Estate Holdings  |
| Manager org | Heartland Bank Facilities       |
| Custom      | true                            |

## Buildings (24 branches)

All children of `heartland-bank`. Each is ~2,500 sqft, 1 floor (with vault in basement), ~7 displays, ~20 sensors.

Representative sample — the seed generates all 24 from the same template with city-specific addresses + coords:

| ID          | Name                     | Address                              | Lat     | Lng      |
| ----------- | ------------------------ | ------------------------------------ | ------- | -------- |
| `hb-cle-01` | Cleveland Downtown       | 100 Euclid Ave · Cleveland, OH       | 41.4993 | -81.6944 |
| `hb-cle-02` | Cleveland West Side      | 4700 Detroit Rd · Cleveland, OH      | 41.4838 | -81.7566 |
| `hb-cle-03` | Cleveland Heights        | 2300 Lee Rd · Cleveland Heights, OH  | 41.5063 | -81.5762 |
| `hb-cle-04` | Cleveland East           | 5400 Mayfield Rd · Lyndhurst, OH     | 41.5195 | -81.4872 |
| `hb-cle-05` | Cleveland South          | 4500 Broadway Ave · Cleveland, OH    | 41.4570 | -81.6500 |
| `hb-col-01` | Columbus High St         | 1200 N High St · Columbus, OH        | 39.9915 | -83.0030 |
| `hb-col-02` | Columbus Short North     | 800 N High St · Columbus, OH         | 39.9820 | -83.0026 |
| `hb-col-03` | Columbus OSU             | 1750 Neil Ave · Columbus, OH         | 39.9990 | -83.0120 |
| `hb-col-04` | Columbus Worthington     | 6800 N High St · Worthington, OH     | 40.0960 | -83.0135 |
| `hb-cin-01` | Cincinnati OTR           | 1300 Vine St · Cincinnati, OH        | 39.1136 | -84.5170 |
| `hb-cin-02` | Cincinnati Hyde Park     | 2700 Erie Ave · Cincinnati, OH       | 39.1340 | -84.4400 |
| `hb-cin-03` | Cincinnati Kenwood       | 7875 Montgomery Rd · Cincinnati, OH  | 39.1970 | -84.3660 |
| `hb-dyt-01` | Dayton Main              | 110 N Main St · Dayton, OH           | 39.7589 | -84.1916 |
| `hb-tol-01` | Toledo Downtown          | 420 Madison Ave · Toledo, OH         | 41.6528 | -83.5379 |
| `hb-tol-02` | Toledo Suburban          | 5500 Monroe St · Toledo, OH          | 41.6820 | -83.6480 |
| `hb-akr-01` | Akron Highland Sq        | 800 W Market St · Akron, OH          | 41.0814 | -81.5435 |
| `hb-ynt-01` | Youngstown Federal Plaza | 20 Federal Plaza · Youngstown, OH    | 41.0998 | -80.6495 |
| `hb-pit-01` | Pittsburgh Downtown      | 600 Grant St · Pittsburgh, PA        | 40.4406 | -79.9959 |
| `hb-pit-02` | Pittsburgh Shadyside     | 5500 Walnut St · Pittsburgh, PA      | 40.4530 | -79.9320 |
| `hb-pit-03` | Pittsburgh South Hills   | 1300 Bower Hill Rd · Pittsburgh, PA  | 40.3930 | -80.0800 |
| `hb-eri-01` | Erie Peach Street        | 600 State St · Erie, PA              | 42.1292 | -80.0851 |
| `hb-scr-01` | Scranton Courthouse Sq   | 100 N Washington Ave · Scranton, PA  | 41.4090 | -75.6624 |
| `hb-col-05` | Columbus Hilliard        | 3800 Main St · Hilliard, OH          | 40.0340 | -83.1590 |
| `hb-cle-06` | Cleveland Strongsville   | 17700 Royalton Rd · Strongsville, OH | 41.3130 | -81.8340 |

All 24 get the same template — 2,500 sqft, 1 floor, ~7 zones (see below).

## Zones (~7 per branch × 24 ≈ 150 total)

Per-branch template:

- **Main Lobby** (lobby)
- **Teller Line** (other)
- **Customer Service Desk** (reception)
- **Break Room** (kitchen)
- **Restroom** (restroom)
- **Vault** (storage) — access-restricted, cleaned monthly not daily
- **ATM Vestibule** (lobby)

Total ~168 zones but seed condenses to 7 × 24 = 168 (Vault is included but excluded from daily routes).

## Merlin user accounts (5)

Five logins cover the scenario: two regional FMs at Heartland Facilities, one contractor manager at Maple (the scenario's vendor-coordination headline), one worker at Maple, and one at Cardinal Security.

| username             | name             | profile role | at org               | org role | bio                                                                                                                                          |
| -------------------- | ---------------- | ------------ | -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `adrienne-heartland` | Adrienne Morales | `facility`   | Heartland Facilities | admin    | Regional FM, OH Central. 5 branches. Primary Merlin operator. Map view every morning. Persona = **facility_manager**.                        |
| `brandon-heartland`  | Brandon Hughes   | `facility`   | Heartland Facilities | member   | Regional FM, OH East. 7 branches. Second regional manager's view. Persona = **facility_manager**.                                            |
| `rhea-heartland`     | Rhea Patel       | `facility`   | Maple Cleaning       | admin    | Maple Cleaning's account manager for the Heartland contract — $120k/mo, 24 locations, her biggest account. Persona = **contractor_manager**. |
| `daniel-heartland`   | Daniel Park      | `cleaning`   | Maple Cleaning       | member   | Maple crew lead, OH East circuit. Visits 5 branches every morning. Persona = **worker**.                                                     |
| `kamal-heartland`    | Kamal Hussain    | `security`   | Cardinal Security    | member   | Cardinal patrol lead, OH East evenings. Persona = **worker**.                                                                                |

## Team roster (12 crew, split across 4 orgs)

### Heartland Bank Facilities (3 crew, in-house managers)

| Name             | Role                     | Initials | Region                                    | Schedule            |
| ---------------- | ------------------------ | -------- | ----------------------------------------- | ------------------- |
| Adrienne Morales | Regional FM — OH Central | AM       | Columbus + Dayton                         | Mon–Fri 08:00–17:00 |
| Brandon Hughes   | Regional FM — OH East    | BH       | Cleveland + Akron + Youngstown            | Mon–Fri 08:00–17:00 |
| Caroline Reid    | Regional FM — OH SW + PA | CR       | Cincinnati + Pittsburgh + Erie + Scranton | Mon–Fri 08:00–17:00 |

### Maple Cleaning Services (5 crew)

| Name           | Role              | Initials | Branches Covered                            | Schedule                              |
| -------------- | ----------------- | -------- | ------------------------------------------- | ------------------------------------- |
| Daniel Park    | OH East crew lead | DP       | Cleveland (5 branches) + Akron + Youngstown | Mon–Sat 05:30–10:30 (branch rotation) |
| Elena Suarez   | OH Central crew   | ES       | Columbus (4) + Dayton                       | Mon–Sat 05:30–10:30                   |
| Fatou Diop     | OH SW crew        | FD       | Cincinnati (3) + Columbus-05                | Mon–Sat 05:30–10:30                   |
| Grant Lee      | PA crew lead      | GL       | Pittsburgh (3) + Erie + Scranton            | Mon–Sat 05:30–10:30                   |
| Henrique Alves | Toledo crew       | HA       | Toledo (2)                                  | Mon–Sat 05:30–10:30                   |

### Reliable Mechanical (2 crew)

| Name            | Role                     | Initials | Schedule            |
| --------------- | ------------------------ | -------- | ------------------- |
| Irina Kowalski  | HVAC + Plumbing (mobile) | IK       | Mon–Fri 08:00–17:00 |
| Jordan Matthews | Electrical + IT (mobile) | JM       | Tue/Thu 08:00–17:00 |

### Cardinal Security (2 crew)

| Name          | Role                     | Initials | Schedule            |
| ------------- | ------------------------ | -------- | ------------------- |
| Kamal Hussain | Patrol — OH East         | KH       | Mon–Sun 17:00–01:00 |
| Lena Müller   | Patrol — OH Central + PA | LM       | Mon–Sun 17:00–01:00 |

Total: 12 people handling 24 branches via route rotation + mobile dispatch.

## Routes (8)

Every route is ecosystem-scoped. Routes 1-5 under contract #1 (Maple cleaning), route 6 under contract #2 (Reliable maintenance), routes 7-8 under contract #3 (Cardinal security).

| #   | Name                                    | Scope     | Contract    | Service       | Cadence  | Start | Duration | SLA | Primary  |
| --- | --------------------------------------- | --------- | ----------- | ------------- | -------- | ----- | -------- | --- | -------- |
| 1   | OH East morning cleaning circuit        | Heartland | #1 Maple    | surface_clean | weekdays | 05:30 | 300 min  | —   | Daniel   |
| 2   | OH Central morning cleaning circuit     | Heartland | #1 Maple    | surface_clean | weekdays | 05:30 | 300 min  | —   | Elena    |
| 3   | OH SW morning cleaning circuit          | Heartland | #1 Maple    | surface_clean | weekdays | 05:30 | 240 min  | —   | Fatou    |
| 4   | PA morning cleaning circuit             | Heartland | #1 Maple    | surface_clean | weekdays | 05:30 | 300 min  | —   | Grant    |
| 5   | Toledo morning cleaning circuit         | Heartland | #1 Maple    | surface_clean | weekdays | 05:30 | 120 min  | —   | Henrique |
| 6   | HVAC preventive rotation                | Heartland | #2 Reliable | inspection    | weekdays | 09:00 | 480 min  | —   | Irina    |
| 7   | OH East evening security patrol         | Heartland | #3 Cardinal | patrol        | daily    | 17:00 | 360 min  | —   | Kamal    |
| 8   | OH Central + PA evening security patrol | Heartland | #3 Cardinal | patrol        | daily    | 17:00 | 360 min  | —   | Lena     |

Each cleaning circuit visits ~5 branches sequentially — the route's zones span 5 different building_zones rows across 5 different location_ids under the ecosystem.

## Seeded history (last 7 days)

### Route overrides (~15)

- **Today, 06:35** — _(Active)_ Merlin ask on Route 1: "Maple Toledo crew (Route 5) no-show at Branch #14 Toledo Downtown. Reassigning to Route 1 spare capacity: Daniel can swing through after Cleveland-05. ETA +40m. Within contract." `merlin`, `extra`. _(Headline narrative.)_
- **Today, 05:45** — Merlin on Route 2: "Branch hb-col-01 (High St) HVAC alert — Irina notified for 09:00 visit." `merlin`, `note`.
- **Yesterday, 17:30** — Human override on Route 7: "Kamal starting late — Brandon approved flex 30m." `human`, `note`.
- **2 days ago, 06:00** — Merlin on Route 4: "Pittsburgh Shadyside sensor offline — flagged for Irina, branch cleaning proceeded normally." `merlin`, `note`.
- **3 days ago, 05:30** — Merlin on Route 1: "Akron branch teller counter spill reported via display — added to Daniel's circuit." `merlin`, `extra`.
- **4 days ago, 17:00** — Merlin on Route 8: "Scranton branch ATM vestibule occupied by loiterer — Lena rerouted through Erie first." `merlin`, `reassign`.
- ...plus 9 more per-branch micro-events.

### Incident actions (~25)

Distributed across all 24 branches. Mostly auto-handled (sensor anomalies, lighting overrides, HVAC drifts). A few human approvals on the more visible vendor coordination moments. One escalation from last week: "Branch #22 (Erie) had a 2-hour overnight badge anomaly — Brandon to review with Cardinal Security Mon AM."

## Agentic config

- Autonomy policy: `approve-critical` (vendor coordination needs a human pulse)
- Proactive pings: `normal`
- Approval confidence threshold: 75%
- Persona: `concise` (managers are busy, regional)

## What loading this demo feels like

1. Demo seeds 5 orgs + 3 contracts + the ecosystem + 24 branches + ~150 zones + 8 routes + 12 team_members + history. Loader lands as owner of **Heartland Bank Facilities** (the manager).
2. Admin → Locations **defaults to the map view** (this is the one scenario where map-first is the natural choice — `scenario.defaultView = 'map'` is set on the scenario spec).
3. Map shows 24 pins clustered in Ohio + western PA. Zoom-out shows the footprint, zoom-in shows the cities.
4. Rollup on the ecosystem: `24 buildings · 150 zones · 8 routes · 5 today · 2 overrides · 0 at risk · 4 actions`.
5. Sign-in-as Rhea → contractor_manager shell at Maple Cleaning. One card: **Branch cleaning program · OH + PA · 24 locations · $120k/mo**. List of all 24 covered locations in the detail modal — the richest contract-locations list of any scenario.
6. Click a pin on the map → branch-specific data.
7. Switcher shows **Heartland Bank Facilities (demo)** with DEMO pill.

This is the scenario for retail finance, multi-location retail, franchise operations, chain restaurant ops, any pitch where the customer has many small locations + vendor coordination + wide geography.

---

## Implementation notes

A few things this scenario needs that other scenarios don't:

1. **Default map view per scenario** — the current `view` state on Admin → Locations defaults to `tree`. For bank-network we want it to remember per-scenario. Small UI addition: `scenario.defaultView = 'map'`. Wire it through when the demo is active.
2. **Sampled, not literal 578** — the existing static `nybank` (First Empire Bank) demo had a branches field of 578 but no real rows. This scenario actualizes 24, which is enough to feel plausible without blowing up the seed.
3. **Branch template generation** — the seed uses a loop to create the 24 buildings from the table above, applying the shared zone template. ~3 buildings per 30 lines of seed code.
