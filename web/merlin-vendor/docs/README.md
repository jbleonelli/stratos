# Merlin documentation index

Every doc lives under `docs/`, sorted into four top-level buckets by how you'd use it:

- **[architecture/](architecture/)** — how the system is designed. Data models, RLS, cross-cutting concerns, roadmaps.
- **[guides/](guides/)** — how to do X in Merlin. Onboarding, persona walkthroughs, task playbooks.
- **[integrations/](integrations/)** — external-facing API contracts (device firmware, web service webhooks).
- **[reference/](reference/)** — canonical lookups. Enums, fixtures, the Meridian fleet inventory, deferred-items catalog.
- **[operations/](operations/)** — what to run when X happens. Runbooks, rollout plans, production readiness.

Each subfolder has its own `README.md` with a one-line description per doc. The full picture is below.

**Status badges** used throughout:

- 🟢 **Canonical** — kept in sync with code; trust as source of truth.
- 🟡 **Roadmap** — in-flight work; status sections inside the doc track what's done.
- 🔵 **Reference** — frozen factual snapshot. Changes only when reality changes.
- 🟠 **Proposed / Aspirational** — design template or future plan; specific code refs inside may be stale.
- 📦 **Living archive** — kept current but read-only (e.g. deferred items catalog).

---

## 🚀 Start here

Three entry points, depending on who you are:

| Reader                                      | Read this first                                                                                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New Adaptiv employee, first time logging in | [guides/getting-started.md](guides/getting-started.md)                                                                                                    |
| Engineer joining the project                | [architecture/building-ops-model.md](architecture/building-ops-model.md) + [architecture/contractor-self-serve.md](architecture/contractor-self-serve.md) |
| Customer / contractor demo prep             | [guides/user-guide.md](guides/user-guide.md) + [guides/contractor.md](guides/contractor.md)                                                               |

---

## 🏗️ [architecture/](architecture/)

How Merlin's system is designed. Engineering-facing.

| Doc                                                                              | What it covers                                                                                                                                                                                                                                                                                                                                                    | Status             |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| [architecture/README.md](architecture/README.md)                                 | Subfolder index.                                                                                                                                                                                                                                                                                                                                                  | —                  |
| [architecture/building-ops-model.md](architecture/building-ops-model.md)         | The multi-org schema: org kinds, owner vs manager locations, contracts as first-class, route_tasks, contract-scoped RLS. Migration history (Tracks G-1 through G-4) + open questions.                                                                                                                                                                             | 🟢 Canonical       |
| [architecture/contractor-self-serve.md](architecture/contractor-self-serve.md)   | The dual-path contractor model: manager-invited (path 1) vs self-serve (path 2). Subtree RLS predicates, write-policy pairs, org-id inheritance in `createChildLocation`. Migrations 090–092. **★ New (2026-05-11).**                                                                                                                                             | 🟢 Canonical       |
| [architecture/hardware-commerce.md](architecture/hardware-commerce.md)           | The orders → fulfillment → install pipeline. `device_orders` schema, `demo_fulfill_order()` + `install_inventory_device()` RPCs, what's mocked vs real. Migrations 093–094. **★ New (2026-05-11).**                                                                                                                                                               | 🟢 Canonical (MVP) |
| [architecture/platform-vision.md](architecture/platform-vision.md)               | Roadmap for `/platform`'s evolution from tenant admin → full Adaptiv internal operations OS. 11-phase plan. **New `/platform` modules must update this doc before the migration.**                                                                                                                                                                                | 🟡 Roadmap         |
| [architecture/roles-and-access.md](architecture/roles-and-access.md)             | Who's who in Merlin from the building-owner perspective — workspace types, building-level grants, common permission errors. End-user counterpart to `reference/roles.md`'s engineering view.                                                                                                                                                                      | 🟢 Canonical       |
| [architecture/llm-provider-switching.md](architecture/llm-provider-switching.md) | Plan for pluggable LLM engines (Anthropic ↔ OpenAI) with a per-surface runtime toggle. Not yet implemented.                                                                                                                                                                                                                                                       | 🟠 Proposed        |
| [architecture/aws-migration.md](architecture/aws-migration.md)                   | Early SST compute-migration plan — **⛔ superseded.** The AWS migration is **DONE & live (2026-06-28)** via Terraform + self-host Supabase: see [operations/aws-migration.md](operations/aws-migration.md) (plan of record + status), [operations/aws-cutover-runbook.md](operations/aws-cutover-runbook.md) (data), and `infra/aws-compute/README.md` (compute). | ⛔ Superseded      |
| [architecture/mobile-worker-app.md](architecture/mobile-worker-app.md)           | Merlin Field — phone-first worker app at `mobile.adaptiv.systems`. **Phase 1 shipped 2026-06-21**; tabs split complete (~786-line shell); push **live**; Playwright happy-path E2E in CI.                                                                                                                                                                         | 🟢 Canonical       |
| [architecture/aws-export-runbook.md](architecture/aws-export-runbook.md)         | Original "leave Supabase + Vercel for AWS" reference. **✅ Superseded — the migration is DONE & live (2026-06-28).** Live runbooks: [operations/aws-migration.md](operations/aws-migration.md), [operations/aws-cutover-runbook.md](operations/aws-cutover-runbook.md), `infra/aws-compute/README.md`.                                                            | ✅ Done            |

---

## 🛠️ [guides/](guides/)

Task-oriented playbooks. User-facing or operator-facing.

| Doc                                                                      | What it covers                                                                                                                                                                                                                                                                    | Status       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| [guides/README.md](guides/README.md)                                     | Subfolder index.                                                                                                                                                                                                                                                                  | —            |
| [guides/getting-started.md](guides/getting-started.md)                   | End-to-end onboarding walkthrough — empty workspace → first running route.                                                                                                                                                                                                        | 🟢 Canonical |
| [guides/user-guide.md](guides/user-guide.md)                             | Demo logins, what each role sees, workspace switcher behavior. The Adaptiv employee cheat sheet.                                                                                                                                                                                  | 🟢 Canonical |
| [guides/platform-admin.md](guides/platform-admin.md)                     | The Adaptiv platform-admin playbook — `/platform` IA tour, common workflows (creating tenants, impersonation, adding platform admins, adding guides), engineering reference. **★ New (2026-05-11).**                                                                              | 🟢 Canonical |
| [guides/organization-setup.md](guides/organization-setup.md)             | Modeling an org's real-estate portfolio — the location tree, nesting, re-homing, rollups.                                                                                                                                                                                         | 🟢 Canonical |
| [guides/schedules-setup.md](guides/schedules-setup.md)                   | Zones, team roster, routes, availability, today's plan. "Running services in a building."                                                                                                                                                                                         | 🟢 Canonical |
| [guides/contractor.md](guides/contractor.md)                             | The complete contractor playbook — Contracts, Buildings, Hardware, Inventory, Merlin's take, proposals, reports, crew utilization. **Updated 2026-05-11 with the new Buildings + Hardware + Install flows.**                                                                      | 🟢 Canonical |
| [guides/contractor-multi-service.md](guides/contractor-multi-service.md) | The multi-service contractor experience (Apex Facilities) — service-line switcher, per-line agents + Merlin voice, tailored ANTICIPATE, contained device data, the My Day agent, demo logins. **Added 2026-06-08.**                                                               | 🟢 Canonical |
| [guides/contractor-savings.md](guides/contractor-savings.md)             | The contractor Savings page — real margin from your own (private) cost basis, and savings opportunities driven by live operational signals, each with a plan Merlin can draft. **Added 2026-06-09.**                                                                              | 🟢 Canonical |
| [guides/agents.md](guides/agents.md)                                     | Working with agents — autonomy slider, per-agent config, act vs ask, approvals.                                                                                                                                                                                                   | 🟢 Canonical |
| [guides/agents-demo-playbook.md](guides/agents-demo-playbook.md)         | Demo script for the agent runtime — talking points, sequencing, what to highlight per agent.                                                                                                                                                                                      | 🟢 Canonical |
| [guides/tickets.md](guides/tickets.md)                                   | Working with tickets — following what Merlin dispatches to a worker/contractor: lifecycle, assignment, the manager vs assignee views, notifications + email/Slack opt-in, overdue sweeps.                                                                                         | 🟢 Canonical |
| [guides/servicing.md](guides/servicing.md)                               | Working with Servicing (OPERATE → Services) — the roll-up → domain overview → board → item model across Cleaning/Security/Hospitality/Maintenance, reading boards (adherence/overdue/SLA/trend), Mark serviced + Raise ticket, the Servicing & SLAs agent, triage/loop workflows. | 🟢 Canonical |
| [guides/demos/](guides/demos/)                                           | 7 vertical-specific demo playbooks (EN+FR) — Meridian HQ · Meridian Distribution East · Meridian Health Clinic · First Empire Bank · IMF (internal only) · Contractor (SparkleCo). Customer-facing PDF guides generated from these.                                               | 🟢 Canonical |

---

## 📣 [marketing/](marketing/)

Outward-facing narrative content — website copy, product positioning, agents-library catalog. Source of truth for the story we tell externally.

| Doc                                                          | What it covers                                                                                                                                                                             | Status       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| [marketing/website-content.md](marketing/website-content.md) | Master website narrative — _Physical AI for the buildings of the world._ The shift, the moat (hardware + 6,000-building dataset), the Smart Display, the sensor library.                   | 🟢 Canonical |
| [marketing/agents-library.md](marketing/agents-library.md)   | The agents library catalog as a marketing piece — the 11 agents Merlin ships today, what each one watches, which vertical it lives in, why a fleet of specialists beats one general model. | 🟢 Canonical |

---

## 🔵 [reference/](reference/)

Canonical lookup tables, fixtures, and snapshots.

| Doc                                                  | What it covers                                                                                                                                                                                   | Status            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| [reference/README.md](reference/README.md)           | Subfolder index.                                                                                                                                                                                 | —                 |
| [reference/meridian-hq.md](reference/meridian-hq.md) | Canonical Meridian HQ workspace — 50 floors, 360 rooms, 208 zones, 23 routes, 4 active service contractors, 787-device fleet. **Updated 2026-05-11 with new zones + multi-contractor coverage.** | 🔵 Reference      |
| [reference/roles.md](reference/roles.md)             | Engineering reference for the 10-value `profile.role` enum + persona table + filter helpers + auth gates.                                                                                        | 🟢 Canonical      |
| [reference/user-types.md](reference/user-types.md)   | Design reference — the 3 identity axes, per-role archetypes + signal sets, derived persona matrix.                                                                                               | 🟢 Canonical      |
| [reference/deferred.md](reference/deferred.md)       | Every "we'll do that later" cut. **Updated 2026-05-11 with hardware-commerce deferred items (Stripe, real shipping, bulk install, drag-and-drop, building_zones writes).**                       | 📦 Living archive |
| [reference/scenarios/](reference/scenarios/)         | 5 pre-built scenario templates (small building, corporate HQ, hospital, university, bank network). Meridian + FEB2 are the live ones; others are design references.                              | 🟠 Aspirational   |

---

## 📘 [operations/](operations/)

Runbooks, rollout plans, production-readiness tracking.

| Doc                                                                                                            | What it covers                                                                                                                                                       | Status       |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| [operations/README.md](operations/README.md)                                                                   | Subfolder index.                                                                                                                                                     | —            |
| [operations/100-tenants-readiness.md](operations/100-tenants-readiness.md)                                     | Production-milestone checklist. Tier 1 hardening done. Tier 2 + gaps still open.                                                                                     | 🟡 Roadmap   |
| [operations/engineering-maturity.md](operations/engineering-maturity.md)                                       | Solo-velocity → team-ready plan. Tiers 1+2 shipped 2026-05-12-13. Tiers 3-4 remain.                                                                                  | 🟡 Roadmap   |
| [operations/i18n-french-locale.md](operations/i18n-french-locale.md)                                           | French localization rollout. Tier A through D closed (~2945 EN/FR pairs). Architecture supports adding Spanish/German per Tier H.                                    | 🟡 Roadmap   |
| [operations/sentry-alerts.md](operations/sentry-alerts.md)                                                     | Survey of current Sentry inbox + 4 recommended alert rules + 3 inbound filters.                                                                                      | 🟡 Roadmap   |
| [operations/auth-email-templates.md](operations/auth-email-templates.md)                                       | Adaptiv-branded HTML for Supabase Auth's 6 transactional emails. SMTP via Resend.                                                                                    | 🟢 Canonical |
| [operations/email-deliverability.md](operations/email-deliverability.md)                                       | DNS for `adaptiv.systems` — apex SPF + DKIM + DMARC ramp policy. The 2026-05-19 incident where tightening DMARC sent all mail to spam, plus the diagnostic playbook. | 🟢 Canonical |
| [operations/code-preparedness.md](operations/code-preparedness.md)                                             | Codebase audit — refreshed 2026-06-22 (Admin + Dashboard splits, 3 Playwright E2E, 21 Vitest). Industry-tier comparison + gaps.                                      | 🟢 Canonical |
| [operations/professionalization-roadmap.md](operations/professionalization-roadmap.md)                         | Prioritized plan for team scale and Series A DD — Admin + Dashboard done; 3 E2E; Chat split in progress. **Updated 2026-06-22.**                                     | 🟡 Roadmap   |
| [operations/series-b-readiness.md](operations/series-b-readiness.md)                                           | Series B + enterprise checklist — seven pillars (incl. enterprise on current stack), success criteria, 90-day schedule. **Updated 2026-06-30.**                       | 🟡 Roadmap   |
| [operations/migration-grant-pattern.md](operations/migration-grant-pattern.md)                                 | Explicit GRANT pattern every new public-schema table must include (Supabase auto-grant removal Oct 30 2026).                                                         | 🟢 Canonical |
| [operations/security-deferred.md](operations/security-deferred.md)                                             | Catalog of every known-security-relevant item that's deferred — refreshed 2026-06-21 after migs 257–259. Severity-tagged with signal-to-unblock.                     | 🟢 Canonical |
| [operations/multi-building-scoping-sprint.md](operations/multi-building-scoping-sprint.md)                     | Sprint to close the data-scoping gap on multi-building tenants. Asks-side shipped 2026-05-14; notifications + event firehose remain org-scoped.                      | 🟡 Planned   |
| [operations/demo-replay.md](operations/demo-replay.md)                                                         | Capture one org's agent activity once, replay it forever. Demo orgs no longer pay Anthropic. Meridian flipped on 2026-05-17 (PR #403, migration 136).                | 🟢 Canonical |
| [operations/runbooks/backup-restore.md](operations/runbooks/backup-restore.md)                                 | Supabase backup + PITR restore procedure.                                                                                                                            | 🟢 Canonical |
| [operations/runbooks/stripe-live-mode-flip.md](operations/runbooks/stripe-live-mode-flip.md)                   | Stripe TEST → LIVE flip procedure (executed 2026-05-14).                                                                                                             | 🟢 Canonical |
| [operations/runbooks/stripe-pro-subscriptions-setup.md](operations/runbooks/stripe-pro-subscriptions-setup.md) | Pro plan subscription setup in Stripe — products, prices, webhook config.                                                                                            | 🟢 Canonical |
| [operations/runbooks/stripe-agent-addon-setup.md](operations/runbooks/stripe-agent-addon-setup.md)             | Agent add-on subscription setup in Stripe — per-agent metered billing.                                                                                               | 🟢 Canonical |

---

## 🗂️ Live tenancy snapshot (what these docs describe)

8 orgs in prod:

| Org                          | Kind          | Role                                                                                                                                              |
| ---------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meridian                     | `real_estate` | Flagship multi-building tenant · **3 buildings** — HQ (50-floor tower) · MDE (warehouse) · MHC (healthcare clinic) · 4 active service contractors |
| First Empire Bank            | `real_estate` | 581-branch ecosystem · daily-cleaning compliance                                                                                                  |
| International Monetary Fund  | `real_estate` | Ecosystem + 2 buildings (HQ1 + HQ2) · variant=`imf` · **internal-only demo**, not pitched externally                                              |
| SparkleCo Cleaning Services  | `contractor`  | Holds 2 contracts (Meridian + FEB)                                                                                                                |
| ShineRight Cleaning Services | `contractor`  | Overnight deep-clean specialist on Meridian                                                                                                       |
| NorthStar Maintenance        | `contractor`  | HVAC + plumbing on Meridian                                                                                                                       |
| GuardWatch Security          | `contractor`  | Patrols on Meridian                                                                                                                               |
| Adaptiv                      | `adaptiv`     | Platform-admin gate (3 admins: JB · Robin · Philippe + JB Lucas)                                                                                  |

The legacy `demo` org kind was retired in migration 068. The legacy FEB1 tenant was deleted 2026-05-12. Meridian grew from a single tower into a 3-building tenant via migrations 104-112 (Distribution Center East = `variant='warehouse'`, Meridian Health Clinic = `variant='healthcare'`). IMF added through migration 117-125 with its own ecosystem variant. New verticals land as new `real_estate` tenants seeded via `/platform/tenants`; new contractor orgs land via either platform seed or self-serve signup.

---

## 🧭 Where to add new docs

| What you're writing                                            | Where it goes                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Customer how-to (a playbook or persona walkthrough)            | `docs/guides/<name>.md`                                                         |
| Engineering reference (an enum, a fixture, a frozen snapshot)  | `docs/reference/<name>.md`                                                      |
| System design (a model, an RLS shape, a cross-cutting concern) | `docs/architecture/<name>.md`                                                   |
| Per-platform-module spec                                       | `docs/architecture/platform/<module>.md` (referenced from `platform-vision.md`) |
| Runbook                                                        | `docs/operations/runbooks/<procedure>.md`                                       |
| Rollout / readiness plan                                       | `docs/operations/<plan>.md`                                                     |
| Scenario template                                              | `docs/reference/scenarios/<vertical>.md`                                        |

When a doc lands or gets a meaningful update, **add or update its row in this index** and the relevant subfolder README — that's the only way readers know it exists and what state it's in.

---

## Recent changes

- **2026-06-22 (PM)** — **Governance pack shipped:** [`deliverables/Merlin-Technical-Appendix.pdf`](deliverables/Merlin-Technical-Appendix.pdf) + 5 policies in [`deliverables/policies/`](deliverables/policies/) + subprocessor register.
- **2026-06-22** — Monolith sprint (#1008–#1018): Dashboard split complete (~384-line shell), Chat split started, **3 Playwright E2E** (login + Ask chat). Audit refresh in operations docs.
- **2026-06-21 (late)** — Hardening sprint (#989–#997 + Ask tab): mobile RPC guard + Playwright e2e + `api/_lib` units + full `wrapHandler` + `MobileApp.jsx` tab split complete (~786-line shell). Admin split (#999–#1006).
- **2026-06-21 (PM)** — Post-audit security hardening (migs **257–259**, PRs #984–#988): RPC least-privilege pass. Audit docs + [`operations/security-deferred.md`](operations/security-deferred.md) updated.
- **2026-06-21** — Audit docs refreshed after mobile + i18n sprint: [`operations/code-preparedness.md`](operations/code-preparedness.md) (15 tests, Merlin Field, DE/ES/PT, Node 22) and pure-logic unit tests (#983: `personas`, `pagination`, `locale-format`). Merlin Field mobile (#974–#982), German UI (5,255 keys), worker writes via party-guarded RPC, web push pipe, `/api/health`.
- **2026-06-20** — Docs audit trail reconciled: [`operations/code-preparedness.md`](operations/code-preparedness.md) refreshed (June hardening sprint) and [`operations/professionalization-roadmap.md`](operations/professionalization-roadmap.md) added. Same day: page render-smoke tests, `@ts-check` net (27 modules), `rules-of-hooks` blocking, route-map drift guard, Docs CMS Phase 4, Admin split Phase 1.
- **2026-05-17** — Sprint closeout (PRs #355-#386, 32 PRs). Session isolation between `/` (customer) and `/platform`, FloatingMenu as the sole top-right element in `/platform` header, DEMO badges on tenants + users tables, `subscription_skus` DB catalog replacing `STRIPE_PRICE_ID_*` env vars (migration 128), Schedules week-paging + Deployments Day/Week/Month switcher, briefing multi-building cache fix. See [memory/session-2026-05-17-handoff.md] for full detail.
- **2026-05-16** — Shell nav refresh + platform reorg + Stripe products CRUD + data-source pricing rule (PRs #332-#354, migration 127). Pink pillar breadcrumb + 5 brand-SVG pillar icons + PREDICT track strip lifted. `/platform` sidebar gained PAYMENTS pillar (Stripe out of INTERNAL); OVERVIEW absorbs Status/Costs. Full Stripe Products CRUD at `/platform/stripe/products`. Data-source pricing: `+50 data sources / $25/mo` overage cron live.
- **2026-05-15** — Pricing rollout finished + agent billing + IMF demo (PRs #309-#331, migrations 117-125). Phases A.2/B/C: promo codes, `organizations.plan` column, Stripe Subscription Checkout. Agent billing G1+G2+G3 + Customer Portal + per-building quantity sync. **IMF demo all 4 phases live** (data + simulator + variant flip + ecosystem); IMF internal-only.
- **2026-05-14** — Hardening sprint + 2-hour prod outage recovery (PRs #272-#308, migrations 113-116). Canonical domain `merlin.adaptiv.systems` finalized, Adaptiv-branded Supabase auth emails, Stripe LIVE flip, server-side Sentry via direct HTTP, public-storage LIST restriction. **2026-05-14 outage** PR #286 → fix PR #293 (don't hand-roll `manualChunks` — Rollup circular-chunk bug). Multi-building data-scoping sprint started.
- **2026-05-13** — Portfolio expansion + demo infrastructure (migrations 104-112). Meridian grew HQ + MDE (`variant='warehouse'`) + MHC (`variant='healthcare'`) under one org; new cold-chain + pharmacy-temp agents; vertical-aware Innovate shelf; 6 user-facing demo guides (EN+FR PDFs); `/platform/marketing/demo` now offers 5 demo bundles. Engineering maturity sprint: CI gate, api/ 100% TS-typed (51/51 files), money-path guards (PRs #239-#259).
- **2026-05-12** — Contractor intelligence loop closed end-to-end (Phases 1-7 + 8.1-8.11). Hypervisor admin rework, feature flags moved to platform.
- **2026-05-11** — Docs reorganized into 4 subfolders (`architecture/` · `guides/` · `reference/` · `operations/`). New: `architecture/contractor-self-serve.md`, `architecture/hardware-commerce.md`. Multi-contractor seed live (4 contractors total). Hardware commerce MVP closed loop end-to-end (PRs #205-#206).
