# University campus

**Tagline:** 6-building campus · 130 zones · 15 crew · ecosystem-wide routes
**Icon:** map
**Vertical:** Higher education / multi-building campus

## Story

A mid-sized urban university. Six academic and residential buildings clustered around a central quad in Cambridge, MA. **Lakewood University Properties** is the legal owner (an endowment-linked real-estate entity); day-to-day operations are run by **Lakewood University Facilities**, a separate internal division. Facilities holds three contracts — cleaning, maintenance, security — all with external firms. Mix of 24/7 operations (residence hall, library) and weekday-only (academic buildings).

This is the scenario where **owner ≠ manager** is most visible. Buildings carry `owner_org_id = Lakewood Properties` and `manager_org_id = Lakewood Facilities`. On a demo-prospect pitch this is the slide where you say "this is how a real institutional owner delegates day-to-day."

This scenario **exercises the location tree** — ecosystem rollups, cross-building routes, subtree rollups, the map view — more than any other.

## What Merlin demonstrates

The **ecosystem rollup**: at 08:30 the campus Admin lands on Admin → Locations and sees the rollup on "Lakewood University": `6 buildings · 130 zones · 10 routes · 7 today · 2 overrides · 3 at risk · 4 actions`. Drill into Residence Hall A and the numbers scope down. Drill into "Main Library" and see that last night's restroom count on Floor 2 has been flagged already for a pull-ahead.

The second moment is the **campus-wide patrol**: the evening security patrol route scopes to the ecosystem, not a building. Route 9 in the table below. Looking at Today's plan from the university view, you see one route visiting every building's perimeter — a story that's impossible without ecosystem-scoped routes.

## Structure

```
Lakewood University (ecosystem, root · manager = Lakewood Facilities, owner = Lakewood Properties)
├── Main Library (building)
├── Science Center (building)
├── Humanities Hall (building)
├── Student Union (building)
├── Athletic Center (building)
└── Residence Hall A (building)
```

Every building inherits owner + manager from the root.

## Organizations (5)

| ID                    | Name                           | Kind          | Role in scenario                                                 |
| --------------------- | ------------------------------ | ------------- | ---------------------------------------------------------------- |
| `lakewood-props`      | Lakewood University Properties | `real_estate` | Owner of every campus building. No day-to-day operator.          |
| `lakewood-facilities` | Lakewood University Facilities | `real_estate` | Manages every campus building on Properties' behalf. Alex's org. |
| `campus-clean`        | Campus Clean Co                | `contractor`  | Cleaning across all 6 buildings.                                 |
| `ne-hvac`             | NE HVAC Services               | `contractor`  | Maintenance + HVAC across all 6 buildings.                       |
| `granite-security`    | Granite Security Services      | `contractor`  | Security + overnight patrols across campus.                      |

The owner org (Properties) has no personas in this demo — it's a pure owner record. The loader lands as owner of **Lakewood Facilities**, the manager org.

## Contracts (3)

| #   | Name                               | Manager             | Contractor       | Service    | Monthly  | Covers          | SLA summary                                                                    |
| --- | ---------------------------------- | ------------------- | ---------------- | ---------- | -------- | --------------- | ------------------------------------------------------------------------------ |
| 1   | Campus cleaning program            | Lakewood Facilities | Campus Clean     | `cleaning` | $120,000 | all 6 buildings | `max_response_min: 30`, `lab_specialty_crew: true`, `overnight_res_hall: true` |
| 2   | Campus HVAC + mechanical           | Lakewood Facilities | NE HVAC          | `hvac`     | $55,000  | all 6 buildings | `max_response_min: 90`, `preventive_monthly: true`, `lab_air_priority: true`   |
| 3   | Campus security + overnight patrol | Lakewood Facilities | Granite Security | `security` | $38,000  | all 6 buildings | `patrol_coverage: 24/7`, `res_hall_night_check: hourly`                        |

## Ecosystem

| Field       | Value                          |
| ----------- | ------------------------------ |
| ID          | `lakewood-u`                   |
| Name        | Lakewood University            |
| Address     | Cambridge, MA · 6 buildings    |
| Kind        | ecosystem                      |
| Latitude    | 42.3770                        |
| Longitude   | -71.1167                       |
| Branches    | 6                              |
| Owner org   | Lakewood University Properties |
| Manager org | Lakewood University Facilities |
| Custom      | true                           |

## Buildings (6)

All children of `lakewood-u`. Approximate coords are clustered around the ecosystem coord so the map view shows a plausible campus.

| ID              | Name             | Kind     | Floors | Sqft    | Occupancy      | Peak | Lat     | Lng      |
| --------------- | ---------------- | -------- | ------ | ------- | -------------- | ---- | ------- | -------- |
| `lw-library`    | Main Library     | building | 5      | 120,000 | 0.85 (daytime) | 0.95 | 42.3775 | -71.1172 |
| `lw-science`    | Science Center   | building | 6      | 180,000 | 0.55           | 0.78 | 42.3765 | -71.1162 |
| `lw-humanities` | Humanities Hall  | building | 4      | 95,000  | 0.62           | 0.80 | 42.3782 | -71.1180 |
| `lw-union`      | Student Union    | building | 3      | 110,000 | 0.75           | 0.92 | 42.3770 | -71.1155 |
| `lw-athletic`   | Athletic Center  | building | 2      | 85,000  | 0.45           | 0.70 | 42.3760 | -71.1175 |
| `lw-res-a`      | Residence Hall A | building | 7      | 140,000 | 0.90 (evening) | 0.98 | 42.3785 | -71.1148 |

## Zones (~130 total)

Condensed per building — most floors get a standard restroom pair + a specialty zone. Key specialty zones called out explicitly.

### Main Library (`lw-library`) — ~25 zones

Floors 1–5, each with Women's + Men's restrooms. Plus:

- **Reading Room West / East** (office, F1/F2)
- **Special Collections** (office, F4) — air-quality-sensitive
- **24/7 Study Lounge** (office, F1)
- **Café** (kitchen, F1)

### Science Center (`lw-science`) — ~30 zones

Floors 1–6 with standard restroom pairs. Plus:

- **Wet Lab A / B / C** (utility, F2–F4) — specialty zones with stricter SLAs
- **Dry Lab** (office, F3)
- **Lecture Hall 100** (other, F1)
- **Greenhouse** (other, F6)

### Humanities Hall (`lw-humanities`) — ~18 zones

Restroom pairs floors 1–4. Plus:

- **Seminar Rooms x4** (conference, F2/F3)
- **Faculty Lounge** (pantry, F4)

### Student Union (`lw-union`) — ~20 zones

- **Food Court** (kitchen, F1) — high-churn, daily deep clean
- **Coffee Bar** (kitchen, F1)
- **Multipurpose Hall** (other, F2)
- **Game Room** (other, F3)
- Restroom pairs F1–F3

### Athletic Center (`lw-athletic`) — ~12 zones

- **Men's Locker Room** (utility, F1) — SLA-heavy zone
- **Women's Locker Room** (utility, F1)
- **Pool Deck** (utility, F1)
- **Weight Room** (other, F1)
- **Court A / B** (other, F1)
- **Training Rooms** (other, F2)

### Residence Hall A (`lw-res-a`) — ~25 zones

- Restroom clusters per floor (F2–F6): each floor has 1 Women's + 1 Men's shared bathroom, so ~10 zones
- **Common Lounges x5** (other, one per residential floor)
- **Laundry Room** (utility, F1)
- **Mail Room** (reception, F1)
- **RA Office** (reception, F1)

## Merlin user accounts (7)

Seven logins cover the decision points: the FM director, three building-level cleaning leads, a maintenance lead, a security lead, and one contractor manager to show the contractor-manager shell at campus scale.

| username          | name         | profile role  | at org              | org role | bio                                                                                                                                                                     |
| ----------------- | ------------ | ------------- | ------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alex-lakewood`   | Alex Vasquez | `facility`    | Lakewood Facilities | admin    | Director of Campus Facilities. Oversees all 6 buildings. Persona = **facility_manager**.                                                                                |
| `maya-lakewood`   | Maya Delgado | `facility`    | Campus Clean        | admin    | Runs Campus Clean Co (the cleaning contractor). Sees one contract covering 6 buildings — the biggest single contract in the scenario. Persona = **contractor_manager**. |
| `aisha-lakewood`  | Aisha Karim  | `cleaning`    | Campus Clean        | member   | Library EVS lead, dispatched by Campus Clean. Persona = **worker**.                                                                                                     |
| `ethan-lakewood`  | Ethan Foster | `cleaning`    | Campus Clean        | member   | Student Union lead — food court lunch turnover. Persona = **worker**.                                                                                                   |
| `hamid-lakewood`  | Hamid Kazemi | `cleaning`    | Campus Clean        | member   | Residence Hall lead. 24/7 ops. Persona = **worker**.                                                                                                                    |
| `jonas-lakewood`  | Jonas Weber  | `maintenance` | NE HVAC             | member   | Campus HVAC lead. Mobile across 6 buildings. Persona = **worker**.                                                                                                      |
| `nathan-lakewood` | Nathan Kim   | `security`    | Granite Security    | member   | Evening patrol lead — ecosystem-scoped patrol route. Persona = **worker**.                                                                                              |

## Team roster (15 crew, split across 3 contractor orgs)

All crew work for one of the three contractor orgs. No in-house operational staff — Lakewood Facilities is pure management, everything delegated to contractors.

### Campus Clean Co (9 crew)

| Name           | Role                  | Initials | Primary Building | Schedule            |
| -------------- | --------------------- | -------- | ---------------- | ------------------- |
| Aisha Karim    | Lead — Library        | AK       | Main Library     | Mon–Fri 06:00–14:00 |
| Ben Torres     | Library evening       | BT       | Main Library     | Mon–Fri 14:00–22:00 |
| Chen Wei       | Lead — Science        | CW       | Science Center   | Mon–Fri 06:00–14:00 |
| Daria Volkov   | Lead — Humanities     | DV       | Humanities Hall  | Mon–Fri 06:00–14:00 |
| Ethan Foster   | Lead — Student Union  | EF       | Student Union    | Mon–Sun 06:00–14:00 |
| Felix Ng       | Student Union evening | FN       | Student Union    | Mon–Sun 14:00–22:00 |
| Gina Alvarez   | Lead — Athletic       | GA       | Athletic Center  | Mon–Sat 06:00–14:00 |
| Hamid Kazemi   | Lead — Res Hall       | HK       | Residence Hall A | Mon–Sun 06:00–14:00 |
| Ingrid Larsson | Res Hall overnight    | IL       | Residence Hall A | Sun–Thu 22:00–06:00 |

### NE HVAC Services (3 crew)

| Name        | Role        | Initials | Schedule                |
| ----------- | ----------- | -------- | ----------------------- |
| Jonas Weber | HVAC Lead   | JW       | Mon–Fri 07:00–15:00     |
| Kira Osei   | Electrician | KO       | Mon/Wed/Fri 07:00–15:00 |
| Luca Rossi  | Plumber     | LR       | Tue/Thu 07:00–15:00     |

### Granite Security Services (3 crew)

| Name         | Role             | Initials | Schedule            |
| ------------ | ---------------- | -------- | ------------------- |
| Maya Delgado | Lead — Day       | MD       | Mon–Fri 06:00–14:00 |
| Nathan Kim   | Lead — Evening   | NK       | Mon–Sun 14:00–22:00 |
| Oliver Brent | Overnight patrol | OB       | Sun–Thu 22:00–06:00 |

## Routes (10)

Routes 1–8 attach to contract #1 (Campus Clean). Routes 9–10 attach to contract #3 (Granite Security). Contract #2 (NE HVAC) has no recurring routes — maintenance is dispatched on-demand.

### Per-building cleaning routes (7)

| #   | Name                            | Scope            | Contract        | Service       | Cadence  | Start | Duration | SLA    | Primary |
| --- | ------------------------------- | ---------------- | --------------- | ------------- | -------- | ----- | -------- | ------ | ------- |
| 1   | Library morning sweep           | Main Library     | #1 Campus Clean | surface_clean | daily    | 06:00 | 180 min  | 20 min | Aisha   |
| 2   | Science labs pre-class          | Science Center   | #1 Campus Clean | deep_clean    | weekdays | 07:00 | 120 min  | 15 min | Chen    |
| 3   | Humanities sweep                | Humanities Hall  | #1 Campus Clean | surface_clean | weekdays | 06:30 | 90 min   | —      | Daria   |
| 4   | Union food court lunch turnover | Student Union    | #1 Campus Clean | deep_clean    | daily    | 13:00 | 60 min   | 20 min | Ethan   |
| 5   | Athletic locker refresh         | Athletic Center  | #1 Campus Clean | deep_clean    | daily    | 08:00 | 90 min   | 30 min | Gina    |
| 6   | Res Hall A morning              | Residence Hall A | #1 Campus Clean | surface_clean | daily    | 06:00 | 150 min  | —      | Hamid   |
| 7   | Res Hall A overnight check      | Residence Hall A | #1 Campus Clean | inspection    | daily    | 23:00 | 60 min   | —      | Ingrid  |

### Campus-wide routes (3)

| #   | Name                      | Scope               | Contract        | Service    | Cadence  | Start | Duration | SLA | Primary         |
| --- | ------------------------- | ------------------- | --------------- | ---------- | -------- | ----- | -------- | --- | --------------- |
| 8   | Campus bin sweep          | Lakewood University | #1 Campus Clean | empty_bins | weekdays | 15:00 | 180 min  | —   | Chen (rotating) |
| 9   | Campus patrol — evening   | Lakewood University | #3 Granite      | patrol     | daily    | 18:00 | 120 min  | —   | Nathan          |
| 10  | Campus patrol — overnight | Lakewood University | #3 Granite      | patrol     | daily    | 23:00 | 180 min  | —   | Oliver          |

Routes 8–10 scope to the ecosystem — zones from every descendant building. This is the Phase 10f feature in its most natural habitat.

## Assignments

Every route's primary is listed above. Substitutes are pulled from same-building peers:

- Aisha ↔ Ben (Library)
- Ethan ↔ Felix (Union)
- Hamid ↔ Ingrid (Residence Hall)
- Cross-team: Chen subs for Daria on Route 3 when Daria is out; Gina subs for Chen on Route 2 when needed
- Security rotations: Maya subs for Nathan evening; Oliver covers his own slot with no sub (escalate to campus facilities)

## Seeded history (last 7 days)

### Route overrides (~12)

- **Today, 07:30** — _(Active)_ Merlin reroute on Route 2: "Wet Lab B air quality 35% below baseline — pulled forward, Chen's crew dispatched." `merlin`, `extra`.
- **Yesterday, 13:15** — Merlin reroute on Route 4: "Food Court traffic +22% post-event — added back-of-house to scope." `merlin`, `extra`.
- **Yesterday, 18:45** — Human override on Route 9: "Patrol skipped Science Center back door — gate locked during alumni event." `human`, `note`.
- **2 days ago, 08:00** — Human override on Route 5: "Pool deck chemical treatment — rescheduled 1h later." `human`, `note`.
- **3 days ago, 22:45** — Merlin reroute on Route 10: "Camera obstructed Garage Lv 2 — Oliver dispatched early." `merlin`, `extra`.
- **4 days ago, 06:15** — Human override on Route 6: "Hamid out — Ingrid covering morning + her overnight." `human`, `reassign`.
- **5 days ago, 13:30** — Merlin reroute on Route 4: "Spill detected near coffee bar — added to lunch turnover scope." `merlin`, `extra`.
- Plus ~5 notes scattered across the week.

### Incident actions (~20)

Mix of approvals + auto-handles. Key moments:

- Yesterday's Merlin escalation on the Wet Lab B air quality getting the human approve ping at 07:25
- Campus patrol flagging 3 after-hours badge anomalies last week, all reviewed + dismissed
- Food Court lunch-rush reroute approved 4 times this week (Merlin pattern-matching)

## Agentic config

- Autonomy policy: `approve-critical` (same as Company HQ — labs + SLA zones need a human pulse)
- Proactive pings: `normal`
- Approval confidence threshold: 75%
- Persona: `warm`

## What loading this demo feels like

1. Demo seeds 5 orgs + 3 contracts + the ecosystem + 6 buildings + ~130 zones + 10 routes + 15 team_members + history. Loader lands as owner of **Lakewood Facilities** (the manager org, not the property owner — correct choice).
2. Admin → Locations shows the tree: 6 buildings indented under the ecosystem, rollup counts adding up right. Each building card shows `Owner: Lakewood Properties · Manager: Lakewood Facilities` (new Track G info).
3. Map view toggle: 6 pins clustered around Cambridge.
4. Schedules → Today's plan: routes from every building + the 3 campus-wide. Route 2 (Science labs) has the Merlin-reroute pill active.
5. User menu: **Lakewood University Facilities (demo)** with DEMO pill + **Persona: Facility Manager**.
6. Sign-in-as options include Maya (contractor_manager at Campus Clean) — clicking her shows **one big contract covering 6 buildings**, which is the scenario's strongest contractor-manager-view moment.

This is the scenario to lead with for buyers with portfolios, multi-site ops, campus-sized facilities, or any institution where owner ≠ manager.
