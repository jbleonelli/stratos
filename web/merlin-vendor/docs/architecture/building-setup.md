# Building Setup — capturing the data that feeds Merlin

**Status:** ✅ Shipped (Phases 1–4) · **Owner:** JB · **Last updated:** 2026-05-30

> **Delivered** — Admin → Setup is live in production.
>
> - Phase 1 (#823): per-building `setup_progress` (mig 170) + `set_building_setup` RPC, the Setup hub checklist + readiness ring, `setup-data.js`.
> - Phases 2–4 (#824): contract PDF extraction (`api/extract.ts` + mig 171 + `ContractSetupPanel`), workforce Excel import (mig 172 + `WorkforceSetupPanel`), and the coverage/consumables/suppliers/SOP list panels (mig 173 + `ListSetupPanel`).
>
> Remaining: end-to-end prod smoke test of the PDF extract→review→save flow (needs a real contract PDF + login). The sections below are the original PRD, kept for context.

> Source brief: _"Merlin architecture — Adaptiv Systems"_ (8-page module spec). This PRD scopes
> the **setup** subset of that brief: the Admin flow that captures, per building, the structured
> data Merlin grounds its answers and agent decisions on. The runtime modules in the brief
> (autonomous dispatch, live SLA scoring, activity log) _consume_ this data and are out of scope
> here — see [Out of scope](#out-of-scope).

---

## 1. Problem & goal

Today, creating a building (`createBuilding()` in `custom-locations.js`) captures almost nothing —
name, address, floors, sqft, a couple of counts. Everything Merlin needs to be useful for that
building (contracts, SLAs, workforce, coverage rules, consumables, SOPs, agent config) is either
entered ad-hoc across scattered surfaces or not captured at all. The result: Merlin can't ground
answers for a freshly-created building, and operators don't know what's missing.

**Goal:** a guided, resumable **Setup** section under Admin, scoped to a building, that captures the
full Merlin data foundation — favouring _document upload + AI extraction_ over manual transcription —
and surfaces a **readiness** signal so operators (and Merlin) know what's still missing.

**Non-goal:** rebuilding the runtime operational modules. Setup fills the foundation; the existing
runtime surfaces (Activity, Hypervisor, agents) consume it.

---

## 2. Design principles

1. **A resumable hub, not one giant form.** A checklist of sections, fillable in any order, with
   per-section completeness. Backed by per-building setup state (new — see §4.1). Mirrors the proven
   org-level `setup_progress` pattern (mig 162) but scoped to a `location_id`.

2. **Document-first ingestion is the hero.** The brief repeats it on nearly every page: _upload the
   contract PDF / workforce Excel / SOP docs → Merlin parses into structured fields, no manual
   transcription, every field traceable to its source._ Manual entry is the fallback, not the default.
   See §6.

3. **Readiness as a first-class signal.** Each building gets a "Merlin readiness" score
   (`N/total sections complete`). It drives the setup UX _and_ lets Merlin answer honestly
   ("I don't have the cleaning contract for this building yet") — the same surface-grounding
   principle as the chat-context fix (PR #821).

4. **Reuse the existing data model; build only the gaps.** ~70% of the brief's entities already have
   tables. Wire them into the hub; add new structure only where it's genuinely missing (§5).

---

## 3. Where it lives

- New **Setup** section in `Admin.jsx`'s sub-nav (current sections: Organization · Users · Locations ·
  SLAs · Agents · Import · …). Setup sits **after Locations** and is **building-scoped**: pick a
  building, see its setup hub.
- Entry points: (a) Admin → Setup; (b) a CTA on building creation ("Set up this building for Merlin");
  (c) the per-building readiness chip wherever a building is shown (My Day, Hypervisor header).
- Aligns with the existing org-level [`new-tenant-onboarding.md`](./new-tenant-onboarding.md) flow:
  org onboarding (WelcomeModal / GetStartedCard) gets you a workspace + first building + first agent;
  **this** is the deeper, per-building data capture that follows.

---

## 4. Data model

### 4.1 Per-building setup state (NEW)

No per-building setup tracking exists today (`setup_progress` is org-level only). Two options:

- **(A) New `merlin_config` section `'setup'` with `location_id`.** Reuses the existing config plumbing
  (`set_merlin_config` RPC, per-building scoping from mig 138) — but mig 138's CHECK only allows
  `location_id` on `'merlin'`/`'agents'`. Would need a CHECK migration to add `'setup'`.
- **(B) New column `locations.setup_progress jsonb`.** Co-located with the building row; simplest read
  (already loading the location). No new RLS surface.

**Recommendation: (B)** — a `jsonb` on `locations`, shaped per section:

```jsonc
{
  "profile": { "done": true, "updated_at": "…" },
  "spatial": { "done": true, "zones": 14 },
  "devices": { "done": false, "count": 0 },
  "contracts": { "done": false, "count": 0, "extracted": 0 },
  "workforce": { "done": false, "count": 0, "compliant": 0 },
  "coverage": { "done": false },
  "consumables": { "done": false },
  "suppliers": { "done": false },
  "knowledge": { "done": false, "docs": 0 },
  "agents": { "done": true },
}
```

`readiness = doneCount / applicableSections` (some sections are vertical-dependent — a warehouse may
not need restroom consumables; gate by `organizations.setup_progress.vertical_picked`).

### 4.2 Entity mapping — reuse / extend / build

| Setup section               | Backing table(s)                                       | Status   | Work                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile**                 | `locations`                                            | ✓ exists | Extend `createBuilding()` to capture vertical, hours of operation, occupancy profile                                                                                                              |
| **Spatial / zones**         | `locations` (floor/zone/room rows), `building_zones`   | ✓ exists | Wire Hypervisor tree + CSV/floorplan import into the hub                                                                                                                                          |
| **Devices / sensors**       | `devices`, `location_devices`                          | ✓ exists | Reuse Admin → Import (CSV) + zone binding                                                                                                                                                         |
| **Contracts + SLAs**        | `contracts`, `contract_locations`, `slas`              | ⚠ extend | `contracts` lacks **auto-renewal, notice period, rate card (structured), penalty terms, amendment log**. Add columns/jsonb. SLA terms (response/completion/penalty) → `slas.config` or new cols.  |
| **Workforce**               | `team_members`                                         | ⚠ extend | Lacks **contractor firm, trade, certifications (+expiry), onboarding gates, employment status, assigned sites**. Add a `worker_certifications` table + fields, or a `team_members.profile jsonb`. |
| **Coverage rules**          | — (relates to `routes`, `route_zones`)                 | ✗ new    | Per-site/shift minimums ("2 guards at all times", "4 cleaners day / 2 night"). New `coverage_rules` table (or `merlin_config`).                                                                   |
| **Consumables / stock**     | — (`inventory_devices` is _hardware_, not consumables) | ✗ new    | New `consumables` + `stock_levels` tables: item, min threshold, reorder level, supplier, contract price, expiry, COSHH flag.                                                                      |
| **Suppliers / procurement** | `marketplace_vendors` (partial)                        | ⚠ extend | Supplier catalogue + contracted pricing per trade. Possibly reuse marketplace vendors.                                                                                                            |
| **Knowledge / SOPs**        | —                                                      | ✗ new    | New `sop_documents` table: doc, version, role/trade scope, approval. The one fully greenfield module.                                                                                             |
| **Agent config**            | `merlin_config` (`merlin`/`agents`)                    | ✓ exists | Reuse Agentic per-building override UI.                                                                                                                                                           |

---

## 5. The Setup hub UX

```
Admin → Setup → [Building: Meridian HQ ▾]          Merlin readiness ● 6/10

┌──────────────────────────────────────────────────────────┐
│ ✓ Building profile        Office · 50 floors · 24/7       │
│ ✓ Spatial model           14 zones across 50 floors       │
│ ✓ Devices & sensors       312 devices bound               │
│ ◐ Contracts & SLAs        2 contracts · 1 needs SLA terms  │  ← upload PDF
│ ○ Workforce               not loaded                       │  ← upload Excel
│ ○ Coverage rules          —                                │
│ ○ Consumables             —                                │
│ ○ Suppliers               —                                │
│ ○ Knowledge / SOPs        0 documents                      │  ← upload docs
│ ✓ Merlin agents           cleaning, hvac, security on      │
└──────────────────────────────────────────────────────────┘
```

- Each row → a focused panel reusing the existing create/edit surface for that entity.
- States: `done` ✓ · `partial` ◐ · `empty` ○. Upload-capable sections show an upload affordance.
- Readiness chip is the same component surfaced elsewhere (building header, My Day).

---

## 6. Document-first ingestion (the hero)

The flow for any uploadable section (contracts, workforce, SOPs, consumable catalogues):

```
Upload PDF/Excel
   → extraction endpoint (api/extract.ts) — Claude with FORCED structured tool output
   → returns { fields, sourceSpans, confidence } per record
   → human-review screen: "Here's what Merlin extracted — confirm / correct"
   → write to the real tables (contracts/slas/team_members/…)
   → each field keeps a pointer to its source clause/cell (traceability)
```

- **Reuse, don't reinvent:** the extraction endpoint mirrors `api/chat.ts` (Anthropic SDK, streaming,
  usage attribution via `claude_usage_events`, role gating). The novelty is _forced_ tool output with a
  per-entity schema (contract → `{name, trade, sites, start, end, autoRenew, noticePeriod, rateCard[],
slaTerms[], penalties[]}`), same pattern as the `create_custom_chart` tool already in `api/chat.ts`.
- **Human-in-the-loop is mandatory** — extraction proposes, the operator confirms before it becomes
  ground truth. Matches the brief's "every extracted field is traceable to its source clause."
- **Fallback:** manual form entry for every section, always available.
- **PDF/Excel parsing:** PDFs via the existing serverless approach (note: `pdf-lib`, not pdfkit — see
  email/PDF stack memory); spreadsheets via a light XLSX parser server-side.

---

## 7. How captured data feeds Merlin

This is the payoff — each section, once captured, becomes grounding:

- **Chat context** — the building block in `api/chat.ts` (`buildingSummary`) gains contract/SLA/
  workforce/SOP summaries, so Merlin answers "which contracts expire in 60 days?" from real data.
- **Agent decisions** — coverage rules, SLA thresholds, and consumable thresholds become the guardrails
  the agents score against (the brief's "Merlin scores live operations against contractual commitments").
- **Readiness honesty** — empty sections let Merlin say "I don't have that for this building yet"
  instead of fabricating (ties to the surface-grounding fix, PR #821).

---

## 8. Phasing

- **Phase 1 — Shell + readiness.** `locations.setup_progress` (mig), the Setup hub checklist, readiness
  score + chip, wired to _existing_ flows (profile, spatial, devices, agents). Low risk; the skeleton
  everything slots into.
- **Phase 2 — Contracts + SLA PDF extraction.** Extend `contracts`; build `api/extract.ts` + review
  screen. Highest "feed Merlin" payoff.
- **Phase 3 — Workforce Excel import** + certifications/onboarding gates (`worker_certifications`).
- **Phase 4 — The gaps:** coverage rules, consumables/stock, suppliers, and the net-new Knowledge/SOP
  module.

Each phase ships independently and raises the readiness ceiling.

---

## 9. Open decisions

1. **Setup state location:** `locations.setup_progress jsonb` (recommended) vs a `merlin_config 'setup'`
   section (needs a CHECK migration).
2. **Contract field extensions:** dedicated columns vs widen `contracts.sla_summary`/`terms` jsonb.
3. **Workforce certifications:** new `worker_certifications` table vs `team_members.profile jsonb`.
4. **Extraction model:** Haiku (cheap, may need review more often) vs Sonnet (pricier, higher-fidelity
   structured extraction). Likely Sonnet for extraction, given accuracy matters and volume is low.
5. **Vertical-conditional sections:** which sections are required per `vertical_picked` (office vs
   warehouse vs stadium vs healthcare) so readiness isn't penalised for N/A sections.

---

## Out of scope

The brief's **runtime** modules — autonomous daily dispatch, live SLA breach scoring, the incident/
activity log, shift-planner rota generation, real-time replenishment — are _consumers_ of this data,
not setup. They have their own surfaces (Activity, Hypervisor, agents) and roadmap. Folding them into
"building setup" would balloon the feature; this PRD deliberately stops at the foundation.
