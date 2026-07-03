# Facility Management "Master Dashboard KPI" — analysis & Merlin scoping

**Status:** scoping input (not a spec yet). Source: a reference image JB likes ("Facility Management Master Dashboard KPI", prepared by Farid Elazry, dated 15 May 2025, currency in MAD). We use it as **inspiration** for the next Merlin build — primarily the _KPI taxonomy_ and the _executive command-center_ framing, adapted to Merlin's own (flat, brand) design language.

---

## 1. What the image is

A **single-screen executive "command center"** for a building/portfolio FM: every operational, financial, reliability, energy, safety, and experience KPI on one page, each shown as **target vs. actual with a status signal** (green/amber/red + ✓ + trend arrow). It reads as a **point-in-time snapshot** — a timestamped, whole-building status reviewed at a glance. (We build it as a **live on-screen cockpit only — no PDF/export.** The image's "Prepared by / dated" byline is just a static-template artifact; Merlin's equivalent is a lightweight live "updated {time}" header.)

Three things make it work, and they're what JB responded to:

1. **One glance = whole-building health.** ~70 KPIs, grouped, no scrolling.
2. **Every number has a target + a verdict.** Nothing is a bare figure; it's "97.2% vs ≥95% ✓ ↑".
3. **It spans domains FMs actually report on** — not just service health, but money (CAPEX/OPEX), reliability (MTTR/MTBF), safety (HSE), and experience.

It is **owner / FM-facing** (the building operator's cockpit). Merlin serves both owners and contractors, so we don't ship one dashboard for everyone — we build a **role-differentiated** cockpit (FM vs. contractor), detailed in §6.

---

## 2. Visual / structural anatomy

| Region       | Pattern                                                                                                              | What to borrow                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Title bar    | Big title + KPI-family tags (SLA · SOP · MTTR · MTBF · CAPEX · OPEX) + timestamp                                     | A **live snapshot feel** — a clear title + an "updated {time}" stamp (on-screen, not exported) |
| Left rail    | "Executive Summary" — the ~11 headline numbers repeated from the panels                                              | A **TL;DR column** that lifts the few numbers an exec cares about                              |
| Top row      | 6 **radial gauges** (SLA, MTTR, MTBF, Asset Avail, Service Avail, Occupant Sat)                                      | Target-vs-actual gauge with pass/fail check                                                    |
| Mid grids    | Tables: **SOP compliance**, **MTTR by equipment**, **MTBF by equipment**; **CAPEX** + **OPEX** financial tables      | Per-asset / per-line / per-category breakdowns with **bars + variance**                        |
| Right column | **Incident donut** (severity mix + open/closed), **Energy KPI**, **Health & Safety KPI**                             | Composition donut; compact KPI lists with trend arrows                                         |
| Lower band   | **Maintenance KPI** (radial mini-gauges + counts), **Customer Experience**, **Asset Management**, **Smart Building** | Themed KPI strips                                                                              |

**Design semantics:** green = on/above target, amber = watch, red = breach; ✓ badges; ↑/↓ trend arrows; progress bars for "actual vs. target"; a donut for severity composition; colored panel headers to group families. (The image's heavy skeuomorphic 3D gauges are NOT the part to copy — Merlin's flat brand style should express the same information.)

---

## 3. Full KPI inventory (extracted from the image)

### Headline gauges

SLA Compliance **97.2%** (≥95%) · MTTR **1.9 h** (<2 h) · MTBF **245 d** (≥180 d) · Asset Availability **99.1%** (≥95%) · Service Availability **98.7%** (≥99%) · Occupant Satisfaction **94%** (≥90%).

### Incident summary

Total **24** — Critical 2 (8%), Major 5 (21%), Minor 10 (42%), Low 7 (29%); **Open 7 / Closed 17**.

### SOP compliance (activity · frequency · compliance · status)

HVAC Inspection (Monthly 100%) · Fire Alarm Testing (Weekly 98%) · Generator Testing (Weekly 100%) · UPS Inspection (Monthly 97%) · Chiller Maintenance (Quarterly 96%) · Cleaning SOP (Daily 99%) · Water Tank Cleaning (Quarterly 100%) · Emergency Drill (Semi-Annual 100%) · Thermography Inspection (Quarterly 95% ⚠) · BMS Verification (Monthly 98%).

### MTTR by equipment (target → actual)

HVAC Chiller <4 h → 2.8 h · Generator <2 h → 1.4 h · UPS <1 h → 42 min · Fire Alarm Panel <30 min → 20 min · Escalator <6 h → 4.5 h · Elevator <4 h → 3.1 h · Lighting <1 h → 35 min · Plumbing <2 h → 1.2 h.

### MTBF by equipment (target → actual)

HVAC Chiller 180 → 220 d · UPS 250 → 310 d · Generator 200 → 240 d · Fire Pump 300 → 360 d · Escalator 120 → 145 d · Elevator 150 → 170 d · BMS Server 365 → 420 d.

### Energy KPI

Energy Reduction −18% · HVAC Saving −22% · LED Saving −35% · Water Reduction −12% · CO₂ Reduction 620 t/yr · PUE 1.45 · Renewable Contribution 14%.

### CAPEX dashboard (FY budget · actual · variance · % spent) — total 80 M MAD

HVAC Upgrade, Electrical Infra, Fire Protection (**over budget 103.6%**), Smart Building/BMS, LED Retrofit (14.6% spent), Roof/Façade, Elevators/Escalators, Parking, Security. **Total 55.4 M spent (69.3%), −24.6 M variance.** → category budget tracking with over/under flags.

### OPEX dashboard (monthly · annual · % of total) — total 32.5 M MAD/yr

Electricity (49.85%), Security, Cleaning, HVAC Maint, Water, Waste, Elevator Maint, Landscaping, Pest Control. → recurring-cost composition.

### Maintenance KPI

Preventive Compliance 98% · Corrective Closure 93% · Reactive Ratio 22% · Planned Ratio 78% · Work Orders Closed 4,850 · Open 210 · Critical 12 · Backlog 2.3 weeks.

### Health & Safety (HSE) KPI

Lost-Time Injury **0** · Safety Compliance 100% · Fire Drill Compliance 100% · Evacuation Time 6 min · PPE Compliance 99% · Near-Miss Reporting 94% · HSE Audit Score 96%.

### Customer Experience KPI

Occupant Satisfaction 94% · Complaint Resolution 96% · Service Quality Index 92% · Tenant Retention 97% · Visitor Satisfaction 91%.

### Asset Management KPI

Asset Availability 99.1% · Reliability 97% · Utilization 88% · Equipment Downtime 1.2% · Lifecycle Compliance 95% · Replacement Index 82%.

### Smart Building KPI

BMS Availability 99.8% · IoT Sensor Accuracy 97% · Smart Lighting Automation 95% · HVAC Automation Efficiency 93% · Remote Monitoring Coverage 100%.

---

## 4. KPI families → Merlin gap analysis

Legend: ✅ exists today · 🟡 partial / derivable from existing data · 🔴 not modeled.

| KPI family                                                                              | Merlin today                                                                                              | Gap                                                                                                        |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **SLA compliance**                                                                      | ✅ `useSlaPerformance`, servicing adherence, `contracts.penalties`, Scorecard                             | Owner-side "SLA gauge vs target" view is thin; mostly contractor-framed                                    |
| **Incident summary (severity mix, open/closed)**                                        | 🟡 `events` + `tickets` + `agent_escalations` carry severity/resolved                                     | No **severity donut + open/closed rollup** widget                                                          |
| **SOP compliance (activity·frequency·%)**                                               | 🟡 Servicing is a real Schedules-backed program (routes, cadences, completions); Quality = FM inspections | No explicit **"SOP register"** (named recurring activities × frequency × compliance %)                     |
| **MTTR (mean time to repair) by equipment**                                             | 🔴 — tickets/work orders aren't timed open→close per asset                                                | **New reliability layer**: repair-duration tracking per device/asset                                       |
| **MTBF (mean time between failures) by equipment**                                      | 🔴 — no failure-interval tracking                                                                         | **New reliability layer**: failure events + interval per asset                                             |
| **Asset availability / reliability / utilization / downtime / lifecycle / replacement** | 🟡 Devices (832 @ Meridian), Hypervisor ASSETS, `useAssetTrackingRuns`; status/last_seen                  | Availability/uptime exists in spirit; **reliability/utilization/lifecycle/replacement-index** not computed |
| **CAPEX (budget·actual·variance)**                                                      | 🔴 — no building capital-budget model                                                                     | **New owner-finance module** (project budgets, spend, variance)                                            |
| **OPEX (recurring cost categories)**                                                    | 🟡 contractor Savings has cost basis; `contracts.monthly_value`                                           | No **owner OPEX budget/category** model (electricity, cleaning, security, …)                               |
| **Energy KPI (reduction %, HVAC/LED, water, CO₂, PUE, renewables)**                     | 🟡 Savings energy opportunities; Sensing (air/temp/humidity/noise now real)                               | No formal **energy-reduction / PUE / renewable** panel; needs energy/baseline data                         |
| **Maintenance KPI (preventive/corrective/reactive/planned, WO counts, backlog)**        | 🟡 Servicing + Schedules + Tickets cover pieces                                                           | No **work-order ratio + backlog** rollup                                                                   |
| **Health & Safety (HSE) KPI**                                                           | 🔴 — not modeled                                                                                          | **New compliance domain** (LTI, drills, PPE, near-miss, audit score)                                       |
| **Customer Experience KPI**                                                             | 🟡 satisfaction appears in places                                                                         | No consolidated **CX panel** (complaint resolution, tenant retention, visitor sat)                         |
| **Smart Building KPI**                                                                  | 🟡 devices/sensors/sensing/BMS signals                                                                    | BMS availability / sensor accuracy / automation efficiency not surfaced as KPIs                            |
| **Executive cockpit (single-screen)**                                                   | ✅ Metrics widget dashboard (composable); REPORT pillar for narratives                                    | No **curated, role-differentiated executive KPI cockpit** (on-screen)                                      |

**Read:** Merlin already has the _plumbing_ for ~half of this (SLA, servicing, incidents, devices, sensing). The genuinely **new, high-value** territory is: **MTTR/MTBF reliability**, **CAPEX/OPEX finance**, **Maintenance work-order ratios**, **HSE compliance**, and a formal **Energy KPI** panel — plus the unifying piece: a **curated, role-differentiated executive "Master KPI" cockpit (on-screen, FM + contractor).**

---

## 5. The core opportunity

Merlin's `Metrics` page is a **user-composable widget dashboard** (good for self-serve). This image is the opposite and complementary: a **curated, opinionated, whole-building executive cockpit** with a fixed, comprehensive KPI taxonomy. Merlin should add that as a first-class **on-screen** surface — a live cockpit, **not** a PDF/exported report. (The REPORT pillar still exists for narrative deliverables; the cockpit is a different thing — an always-live status screen.)

Crucially, Merlin's edge over a static template is that **every number is live and groundable** — each KPI tile can deep-link to its source surface, open a chat ("why is Fire Protection over budget?"), or trigger an action. The template is a dead snapshot; Merlin's cockpit is one you can interrogate and act on, in real time.

And because Merlin serves two audiences, the cockpit is **role-differentiated**: the same framework renders an **FM/owner** command center and a **contractor** cockpit, each scoped to what that role owns and can see (§6).

---

## 6. FM cockpit vs. contractor cockpit

Both roles get the same cockpit **framework** (curated tiles, target-vs-actual, deep-links, ask-Merlin), but **different KPI families and different data scope**. Guiding principle:

> The **FM/owner** sees the **whole building, across all vendors, including the owner's money and the building's liability.** The **contractor** sees **only their contracted scope, their own economics, and how the client rates them.**

| Family                                                    | FM / Owner cockpit (e.g. Meridian)                                             | Contractor cockpit (e.g. Apex)                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| SLA / service availability                                | All lines + all vendors, building-wide                                         | Only their lines _(have: Scorecard / ANTICIPATE)_                                                            |
| Incidents                                                 | All severities, whole building, open/closed                                    | Only incidents in their scope                                                                                |
| SOP compliance                                            | Full SOP register (every activity)                                             | Only the SOPs they own                                                                                       |
| MTTR / MTBF                                               | All building equipment                                                         | Only equipment they maintain                                                                                 |
| Maintenance ratios / work orders                          | All WOs across vendors + backlog                                               | Their WOs / their backlog                                                                                    |
| Asset mgmt (avail/reliability/util/lifecycle/replacement) | Full asset fleet                                                               | Assets in their contract                                                                                     |
| **CAPEX / OPEX**                                          | **Owner's budgets** — capital projects + recurring spend (they hold the money) | **NOT** the owner's budget → their own **cost-to-serve / margin / penalties at risk** _(have: Savings)_      |
| Energy (reduction / PUE / renewables)                     | Whole-building energy + sustainability                                         | Only energy they drive (e.g. an HVAC vendor's HVAC savings)                                                  |
| Health & Safety (HSE)                                     | Building safety + owner liability (drills, evacuation, audits)                 | Their **crew's** record (their LTI, PPE, near-miss)                                                          |
| Customer Experience                                       | Occupant/tenant satisfaction, tenant retention, visitor sat                    | How the **client rates them**: service quality, complaint resolution, inspection pass-rate _(have: Quality)_ |
| Smart building                                            | BMS / IoT across the building                                                  | Devices in their scope                                                                                       |

**Net:**

- **FM cockpit** = the big new build — the whole-building command center incl. the new finance + reliability + HSE layers. This is what the image literally is.
- **Contractor cockpit** = largely an **assembly + light extension of what already exists** (Scorecard adherence, Savings economics, Quality pass-rate, contractor ANTICIPATE/penalties), recomposed into the same cockpit shape, plus their slice of the new reliability/maintenance KPIs.
- A few families are **FM-only** (owner CAPEX/OPEX, whole-building energy/PUE, tenant retention, building HSE liability); a few are **contractor-flavored** (margin not budget; crew safety not building safety; "how my client rates me" not "how my tenants rate me"); most are **shared-but-scoped** (same KPI, viewer-contained data).

**Containment is already solved.** This is the exact pattern Merlin enforces today: the FM (`real_estate` org) sees its own data; a contractor sees only its contracted lines/assets via the viewer-scoped RPCs (`servicing_rollup_for_viewer`, `building_sensor_readings`, the penalty ledger's dual contractor/manager scoping, the contained device RLS). The cockpit just consumes those same scoped sources per role.

---

## 7. Proposed scope (phased)

**Phase 1 — Cockpit from data we already have (no new schema), both roles.**
A curated "Master KPI" cockpit (a new **MONITOR** surface) assembling the families Merlin can already populate: SLA/service availability, servicing/SOP compliance (from routes + cadences + completions), incident severity mix + open/closed (from `events`/`tickets`), maintenance work-order counts (from servicing/tickets), device/asset availability + smart-building signals (from `devices`/sensing), and the Energy panel (from sensing + savings). Each tile = value + target + status + trend, deep-linking to its surface. Ship the **FM** layout and the **contractor** layout together (the contractor one mostly recomposes existing Scorecard/Savings/Quality data). On-screen only, $0 new modeling.

**Phase 2 — The new reliability AND finance layers (both — equally important, not either/or).**

- **Reliability:** time work orders/tickets open→close per asset → **MTTR**; log failure events per asset → **MTBF**; derive availability/downtime. (New tables + a replay drift loop for demo orgs, mirroring how servicing/penalties were made "real".) FM sees all equipment; contractor sees their maintained equipment.
- **Finance:** an owner **CAPEX/OPEX budget** model (categories, budget, actual, variance) → the two financial tables. (New tables; seed Meridian FY budgets.) **FM-only** for budgets; the contractor's finance tile stays their margin/cost-to-serve (existing Savings), not the owner's books.

**Phase 3 — HSE + Customer Experience.**
Health & Safety register (LTI, drills, PPE, near-miss, audit score) and a consolidated CX panel. FM = building safety + tenant/occupant experience; contractor = crew safety + client-rating. Mostly new, lighter data; "completeness" polish for the demo.

Sequence rationale: Phase 1 is assembly of existing signals (fast, high demo impact, $0) and immediately gives both roles a cockpit. Phase 2 adds the differentiated depth — reliability _and_ money — that turns it from "pretty dashboard" into "the FM's actual cockpit." Phase 3 rounds out coverage.

---

## 8. Design takeaways (borrow the information, adapt the look)

**Borrow:** (1) target-vs-actual on _every_ tile with a green/amber/red verdict + trend; (2) the KPI **taxonomy/grouping** (families as panels); (3) the **executive-summary TL;DR** column; (4) per-asset/per-category **breakdown tables** with bars + variance; (5) the **incident composition donut**; (6) a light **live "updated {time}" header** (the snapshot feel — but live, not an exported artifact).

**Adapt, don't copy:** skip the skeuomorphic 3D gauges, glossy bevels, and clip-art building/plant imagery — render the same information in Merlin's flat brand system (the existing gauges, sparklines, pills, `RadialGauge`/`MultiTrendChart` from the contractor Now/Briefing work, brand color semantics). Density is the goal, but Merlin should achieve it cleanly, not ornately. **On-screen only — no PDF/export.**

**Two audiences, one framework:** build the cockpit as a single component that renders the **FM/owner** layout and the **contractor** layout from role-scoped data (§6) — not two separate dashboards.

---

## 9. Open questions for JB

Decided: **on-screen only (no PDF)**; **Phase 2 = both reliability + finance**; **role-differentiated (FM + contractor)**.

Still open:

1. **Curated vs. composable:** a fixed, opinionated cockpit layout, or seed it as a preset "Executive" layout inside the existing Metrics widget system (so it's also editable)? (Recommendation: fixed/curated — the value is the opinionated whole.)
2. **Finance realism:** seed Meridian FY CAPEX/OPEX budgets (demo, DB-backed) now vs. wait for a real tenant with budget data? (Recommendation: seed — same bar as servicing/penalties.)
3. **Scope of "real":** which families must be live/groundable vs. acceptable as demo-seeded-but-DB-backed (the bar we set for servicing/penalties/sensing).
4. **FM home:** the FM cockpit as a new MONITOR tab (e.g. "KPI" / "Cockpit") — does it replace or sit beside the existing Metrics tab? The contractor cockpit can extend the existing contractor Scorecard or be its own tab.

> Image is reference only; nothing here is committed scope until we pick Phase 1's home (FM + contractor) and confirm the curated-vs-composable call.
