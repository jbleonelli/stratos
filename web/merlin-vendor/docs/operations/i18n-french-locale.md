# French Locale — what's done, what's left

**Last updated:** 2026-05-06 · **Owner:** Adaptiv platform admins

> **Update 2026-05-06 (afternoon)**: shipped Tier A.5 partial-file
> sweep across Sidebar / Briefing / Settings / Dashboard chrome /
> AgentDetailView / Auth / App; Tier F polish (html lang, document
> title, navigator.language detection); Tier E module
> ([locale-format.js](../src/app/locale-format.js)) with
> Intl.\* helpers + React hooks for numbers / currency / dates /
> times / relative time. Three more commits on top of yesterday's
> baseline. **~140 EN/FR pairs added**.
>
> **Update 2026-05-06 (evening)**: Tier E adoption (relativeTime
> in incident-actions now reads getLanguage() at call time +
> Intl.RelativeTimeFormat for FR — every existing caller becomes
> locale-aware for free). Chat panel chrome. Reports + Deployments
> chrome. Admin sub-nav (7 section labels). Insights (Journey /
> Outcome). Help drawer. Agentic config (Persona / Autonomy /
> Pings / Model / Thresholds / Behavior flags / agents-on-bar /
> tick freq / data simulator / device simulator / pending pill).
> DeviceDetailPage breadcrumb + not-found. PlaybookEditor (eyebrow
>
> - tabs + unsaved + save note + revert). ContractorApp (Contracts
>   h1 + Terms section).
>
> **Update 2026-05-06 (late evening)**: Admin top-level section
> headers (Workspace setup h1, Organization / Members / Location
> access / Pending invites cards). DeviceDetailPage internal
> panels — 7 sub-components × Telemetry / Hardware / Firmware /
> Recent activity / Configuration / Firmware-behind pill /
> Unsaved pill, all translated with replace_all sweeping the
> recurring strings across SDC / PCB / SLB device kinds.
> WorkerApp ("My day" eyebrow + task completion tooltip).
> 9 commits on top of afternoon's batch.
>
> **Update 2026-05-06 (very late)**: Schedules chrome (Team /
> Crew / Filter / Shift legend / On shift now / Unassigned /
> No-one-assigned / Skipped today). DevicesUI (Fleet header,
> all-types/all-statuses + 5 status filter options, drawer
> Close, Reorder panel header). Dashboard super-admin KPIs
>
> - bank panel headers (Fines accrual / Branches last 24h).
>   11 commits on top of afternoon's batch. **~165 more EN/FR
>   pairs added**, dictionary now holds ~720 pairs.

This is the running checklist for shipping Merlin in French. The
machinery is now in place — dictionary lookup, structured-ask
rendering, on-read Haiku translation. What's left is mostly
mechanical: extending the dictionary across the unconverted UI files
and finishing localization for content surfaces that weren't touched
in the first pass.

> **Default sequencing rule:** ship the highest-traffic surfaces
> first. A French user encounters Briefing → Dashboard → Agents
> detail → Operations every day; Platform admin pages they may never
> see. Don't translate uniformly — translate where eyeballs are.

---

## ✅ Done — Phases 1–4 (first slice) shipped 2026-05-05

The pattern is established and verified end-to-end against
production via `/api/translate` against the deployed origin.

| #               | What                                                                                                                                                                                                                                                                                                                                                      | Files                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**           | **Simulator i18n** — every client-spawned incident, ambient tip, status progression, chat suggestion, auto-handle / human-handle line localizes at spawn time. ~75 dictionary keys × 2 langs.                                                                                                                                                             | [src/app/simulator.js](../src/app/simulator.js), [src/app/i18n.js](../src/app/i18n.js)                                                                                                                                 |
| **1**           | **`merlin_asks.kind` + `params`** structured-ask schema. Migration 069.                                                                                                                                                                                                                                                                                   | [supabase/migrations/069\_…](../supabase/migrations/069_merlin_asks_structured_kind.sql)                                                                                                                               |
| **2A**          | **Cleaning agent** emits structured `route_override` kind with `reason_code` enum. `renderAsk` localizes per-reader at read time. ~10 keys × 2 langs.                                                                                                                                                                                                     | [api/agents/cleaning.js](../api/agents/cleaning.js), [src/app/ask-render.js](../src/app/ask-render.js)                                                                                                                 |
| **2B**          | **Six other agents** (hvac, supply, space, energy, security, compliance) emit their own structured kinds (`setpoint_change`, `supply_order`, `booking_release`, `setback_proposal`, `escalation`, `evidence_request`). `renderTwoAxis` / `renderSingleAxis` helpers + severity-term localization with proper French gender agreement. ~38 keys × 2 langs. | All 6 agent files                                                                                                                                                                                                      |
| **2C**          | **Act-path tables** (`route_overrides` + 6 agent\_\* tables) gain `reason_code` + `params` columns. Migration 070. Dashboard agent pill + Schedules override row use `renderAgentAction` + `renderRouteOverride`. ~7 keys × 2 langs.                                                                                                                      | Migration 070, [src/app/Dashboard.jsx](../src/app/Dashboard.jsx), [src/app/Schedules.jsx](../src/app/Schedules.jsx), [src/app/agent-runs.js](../src/app/agent-runs.js)                                                 |
| **3**           | **On-read translation** for free-form prose. `text_translations` content-addressable cache (migration 071) + JWT-gated `/api/translate` Vercel function (Haiku, batched ≤50, rate-limited 30/min/org via `enforce_rate_limit`) + 2-layer client cache (localStorage 500-entry rolling + in-flight dedupe + 80ms batch debounce).                          | Migration 071, [api/translate.js](../api/translate.js), [src/app/event-translations.js](../src/app/event-translations.js)                                                                                              |
| **3**           | **Wired** to AgentDetailView `<RunRow>` (decision_reason), Chat `<AskCard>` + CallsForAction `<CallRow>` (legacy free-form fallback), Schedules `<TodayRouteRow>` (legacy override.reason).                                                                                                                                                               | [src/app/AgentDetailView.jsx](../src/app/AgentDetailView.jsx), [src/app/Chat.jsx](../src/app/Chat.jsx), [src/app/CallsForAction.jsx](../src/app/CallsForAction.jsx), [src/app/Schedules.jsx](../src/app/Schedules.jsx) |
| **4 (slice 1)** | **Operations.jsx, Devices.jsx (chrome only), IncidentView.jsx (chrome only)** — sub-nav, hero stats, Merlin watch strip, breadcrumbs, eyebrows, hero stats, action buttons (4 × 3 states), section titles, location panel, related-incidents row, Ask-Merlin chip strip. ~45 keys × 2 langs.                                                              | The three files                                                                                                                                                                                                        |
| **deploy**      | **/api/translate live in prod** as of 2026-05-05. Smoke-tested: 401 unauthed, 200 authed, ~2.5s cold (3 strings, single Haiku call), ~750ms warm (cache hit), rows persist in `public.text_translations`.                                                                                                                                                 | `merlin.adaptiv.systems`                                                                                                                                                                                               |

**Total dictionary**: ~250 keys (pre-Phase-1) + ~175 added across Phases
1–4 = **~425 EN/FR pairs**.

**Total migrations for i18n**: 069 (merlin_asks structured), 070
(act-path structured), 071 (text_translations cache).

---

## ✅ Done — Phase 4 slice 2 + 3 + Tier E + F (2026-05-06)

| Layer                 | What landed                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sidebar**           | Collapsed-pane icon button titles, Activity section + empty state + acted/called-for-action/no-reason rows, Standing-by agent default, Handled/Auto pills, pluralized count tooltips, Pin/Unpin tooltips, resize-handle tooltip, BuildingSwitcher subLabel (displays/sensors/loggers/counters), footer                                                               |
| **Briefing**          | Tell-me-about chat-prompt, product-showcase eyebrow + Featured + Request-a-demo + demo-prompt template + Tomorrow tease                                                                                                                                                                                                                                              |
| **Settings**          | Profile card fully translated (header, Upload/Change/Remove, all 5 field labels + 3 placeholders + email hint, Revert/Save changes/Saving)                                                                                                                                                                                                                           |
| **Dashboard chrome**  | FirehosePanel (title + events-today + 5 columns + empty state), FloorPlan sub-card (filter + selected eyebrow + Temperature + ghost pill + ask-room + select prompt), AgentsPanel (4 KPI labels + Running agents + Recent agent activity + Recent human actions), AgentRuntimeCard (2 tooltips + pluralized awaiting-review pill)                                    |
| **AgentDetailView**   | Breadcrumb + Edit-in-Agentic tooltip + Today's runs                                                                                                                                                                                                                                                                                                                  |
| **Auth**              | Forgot-password flow + password recovery flow fully translated (titles, subtitles, bullets, h2s, paragraphs, buttons, success banners, field labels)                                                                                                                                                                                                                 |
| **App**               | Invite banner + Dismiss button + Help (?) tooltip + account menu sections (Account / Workspace / Adaptiv / Platform / Switch workspace / ACTIVE)                                                                                                                                                                                                                     |
| **Insights**          | Journey + Outcome section titles                                                                                                                                                                                                                                                                                                                                     |
| **Tier F (document)** | `<html lang>` reflects active language. `<title>` mirrors active language. First-load detection: `localStorage` → `navigator.language` → `'en'`                                                                                                                                                                                                                      |
| **Tier E (Phase 5)**  | New [locale-format.js](../src/app/locale-format.js) module with `formatNumber`/`formatCurrency`/`formatDate`/`formatTime`/`formatRelative` + matching React hooks. en→en-US / fr→fr-FR. Source-currency only (no FX conversion). `1,234,567` ↔ `1 234 567`, `$14,251` ↔ `14 251 $US`, `May 6, 2026` ↔ `6 mai 2026`, `4:32 PM` ↔ `16:32`, `2 days ago` ↔ `avant-hier` |

## ⏳ Open — what's left

### Tier A · High-leverage chrome sweep (29 unconverted JSX files)

The big remaining bucket. Cheap individually but a lot of files.
Pattern is established: `import { useT } from './i18n.js'` → call
`useT()` → replace English literals with `t('namespace.key', vars)`
→ batch the EN+FR pairs into [i18n.js](../src/app/i18n.js).

**A.1 — Big files, very visible (probably one session each)**

| File                 | Lines | Notes                                                                                                 |
| -------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| Admin.jsx            | 2509  | Tenant-admin shell — Organization, Users, Features, Device import, Locations, SLAs, Product ads, etc. |
| Schedules.jsx        | 1357  | Partially touched in Phase 2C/3 — most chrome still EN                                                |
| Reports.jsx          | 1079  | CSV/PDF report viewer + live data fetchers                                                            |
| DeviceDetailPage.jsx | 1306  | `/device/<id>` standalone page                                                                        |
| DeviceView.jsx       | 1376  | Legacy in-page device view (non-Adaptiv kinds)                                                        |
| Agentic.jsx          | 1539  | Agentic-config admin page                                                                             |

**A.2 — Medium files (could batch 2–3 per session)**

| File                | Lines | Notes                                                                                                     |
| ------------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| DevicesUI.jsx       | 856   | Fleet board / detail drawer / reorder panel components                                                    |
| Deployments.jsx     | 838   | Rollouts board                                                                                            |
| AgentDetailView.jsx | 357   | Partially done in Phase 3 — RunRow uses `useTranslatedText` for decision_reason; everything else still EN |

**A.3 — Platform admin pages (Adaptiv-internal only, lower priority)**

| File                     | Lines   |
| ------------------------ | ------- |
| PlatformTenants.jsx      | 514     |
| PlatformTenantDetail.jsx | 478     |
| PlatformAds.jsx          | 454     |
| PlatformAuth.jsx         | 369     |
| PlatformApp.jsx          | (small) |
| PlatformAudit.jsx        | (small) |

These render only for `is_platform_admin()`-true users (Adaptiv
staff). The audience speaks English in practice; defer until tenant-
facing surfaces are 100% covered.

**A.4 — Smaller surfaces (could batch 5+ per session)**

| File               | Lines |
| ------------------ | ----- |
| PlaybookEditor.jsx | 465   |
| ContractorApp.jsx  | 465   |
| FloorPlan.jsx      | 448   |
| WorkerApp.jsx      | 335   |
| LocationTree.jsx   | 270   |
| Help.jsx           | 208   |
| ImfMap.jsx         | 173   |
| EcosystemMap.jsx   | 169   |
| LocationsMap.jsx   | 147   |
| SuspendedOrg.jsx   | 137   |
| Tweaks.jsx         | 51    |

**A.5 — Audit partially-converted files**

These import `useT` already but have only some strings localized.
Each likely has 10–30 hardcoded English literals remaining.

| File           | Already wired?                |
| -------------- | ----------------------------- |
| App.jsx        | ✓ partial                     |
| Auth.jsx       | ✓ partial                     |
| Briefing.jsx   | ✓ partial                     |
| Chat.jsx       | ✓ partial (Phase 2/3 touched) |
| Dashboard.jsx  | ✓ partial (Phase 2/3 touched) |
| Hypervisor.jsx | ✓ partial                     |
| Insights.jsx   | ✓ partial                     |
| Settings.jsx   | ✓ partial                     |
| Sidebar.jsx    | ✓ partial                     |

### Tier B · Deferred from completed Phase-4 files

Embedded JSX prose with inline `<b>` tags + role/building branching
that needs careful template extraction.

- **Devices.jsx role/building-conditional sub-paragraphs** —
  `subByRole.facility/cleaning/maintenance/security`, `ecosystemSub`,
  `healthSentence`. Mix of dynamic counts inside `<b>` tags.
  Recommended approach: extract each sentence into a key with
  placeholders for the bolded counts, render via `dangerouslySetInnerHTML`
  or via composition (`<b>{n}</b> {t('devices.…')}`).
- **IncidentView.jsx helper-generated prose** — `buildTimeline()`
  (5 event labels + descriptions), `buildMerlinActions()` (6 action
  sentences), `parseLocation()` (Low rise / Mid rise / High rise /
  Ground area / category map), `parseSla()` (5 SLA primary/secondary
  pairs), `pickAssignee()` role labels, `buildSensorSeries()` titles
  - axis labels.

### Tier C · Phase 3 wiring leftovers

`useTranslatedText` is the on-read translation hook from Phase 3, but
only some sites consume it. Remaining sites where free-form prose
still appears in source language:

- **Sidebar.jsx ~line 180** — live agent ticker `lastReason`
- **Sidebar.jsx ~line 227** — per-run reason in expanded ticker
- **Dashboard.jsx ~line 1282** — agent run row in agents card
- **Dashboard.jsx ~line 1603** — agent run row in expanded view
- **Dashboard.jsx ~line 2372** — separate `reason` reference

Pattern: extract row to a child component, call `useTranslatedText` per row.

### Tier D · Static demo data overlay extension

`data-fr.js` (995 lines) covers ~50% of the static incidents in
`data.js`. The rest fall through to English when `localized-data.js`
finds no override. Cheap to extend — just append entries.

- `data.js` (144 lines) — incident list, agents, conversations
- `ecosystem-data.js` — First Empire Bank static dataset
- `imf-data.js` — IMF static dataset

### Tier E · Phase 5 (locale-aware formatting)

Untouched today. Each is its own focused workstream.

| Concern       | Current state                                                                       | What's needed                                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dates         | Ad-hoc `${d.getHours()}:${d.getMinutes()}` everywhere                               | New `formatTime` / `formatDate` helpers wrapping `Intl.DateTimeFormat`, sweep usage sites                                                                                           |
| Numbers       | `.toLocaleString()` defaults to **system** locale (not app lang)                    | Helper that takes lang explicitly, sweep                                                                                                                                            |
| Currency      | Hardcoded `$`                                                                       | Decision needed: stay-in-source-currency vs convert. Easier policy: stay-in-source ($ for US tenants, € for EU) since money is real and conversion is a separate compliance concern |
| Relative time | `relativeTime()` in `incident-actions.js` and `relTime` in Dashboard — both English | Replace with `Intl.RelativeTimeFormat`                                                                                                                                              |

### Tier F · Document-level + UX gaps

- **`<html lang="…">`** in [index.html](../index.html) is hardcoded `en` — should reflect active lang for screen readers + browser hints
- **Document `<title>`** ("Merlin — AI Co-Worker for Buildings") not localized
- **No browser-language detection on first sign-in** — always defaults English; should read `navigator.language` and pre-select
- **No per-org default language** — org admin can't say "this tenant is French-first"
- **No persistence beyond localStorage** — user signs in on a new device, language resets to default

### Tier G · Translation quality + production readiness

- **Native-speaker review** of the dictionary I wrote and the auto-translations Haiku produces. Workmanlike but unaudited. Worth a pass-through with a French operations speaker.
- **Plurals** — currently handled English-style via duplicate keys (`_one` / `_many`). French plural rules mostly align but worth an audit.
- **`text_translations` pruning policy** — table is unbounded today. Either trust unbounded growth (rows are tiny, ~150 chars each, content-addressable so they cap naturally at vocabulary size) OR add a cron to drop rows older than N days with no recent reads. Defer until cache exceeds e.g. 100k rows.
- **Rate limit tuning** — 30 misses/min/org. Smoke-test passed at 1 of 30 used. Watch for 429s in Sentry; widen if real users hit the cap.

### Tier H · Multi-language readiness

Architecture handles N languages cleanly. Adding Spanish / German /
etc. would just need:

- Widen `SUPPORTED_LANGS` in [api/translate.js](../api/translate.js)
- Per-target-lang style guide block in `SYSTEM_PROMPT`
- Dictionary entries for the new lang (sweep `i18n.js` and add a third value to each pair)
- Language toggle UI in Settings supports the new option

Not on the roadmap — but no architectural work to add later.

---

## Suggested cadence

Most user-value-per-hour:

1. ✅ **Deploy + smoke-test Phase 3** in production. _Done 2026-05-05._
2. **Tier A.5 audit** — finish partial files (Dashboard, Settings, Sidebar, App, Auth, Briefing, Chat, Hypervisor, Insights). Most-trafficked surfaces; biggest French-coverage gain per hour. **2–3 sessions.**
3. **Tier C wiring** (Sidebar + Dashboard `decision_reason`). Quick win. **<1 session.**
4. **Phase 5 (Tier E)** — locale-aware date/number/currency helpers + sweep. Touches every screen. **1 session.**
5. **Tier D** — extend `data-fr.js` overlay for the remaining static demo content. Cheap. **1 session.**
6. **Tier B** — finish Devices.jsx role prose + IncidentView.jsx helpers. **1 session.**
7. **Admin.jsx** — its own session given size + visibility. **1 session.**
8. **Tier A.1 remaining** — Schedules / Reports / DeviceDetailPage / DeviceView / Agentic. **3–4 sessions.**
9. **Tier F polish** — `<html lang>`, browser-detect, per-org default. **<1 session.**
10. **Tier A.2 / A.3 / A.4** — medium files, platform pages, small surfaces. **2–3 sessions.**
11. **Tier G** — native-speaker translation review (async, no engineering work).

**Honest total estimate: 8–11 more focused sessions to get to "shippably French" across all surfaces.**

---

## Reference: where the i18n machinery lives

| Concern                                                   | File                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Dictionary + `useT` / `t` / `setLanguage` / `useLanguage` | [src/app/i18n.js](../src/app/i18n.js)                                                                  |
| Static-data French overlay (incidents/SLAs/insights)      | [src/app/data-fr.js](../src/app/data-fr.js), [src/app/localized-data.js](../src/app/localized-data.js) |
| Structured-ask render layer (kind+params → localized)     | [src/app/ask-render.js](../src/app/ask-render.js)                                                      |
| On-read translation cache + hook                          | [src/app/event-translations.js](../src/app/event-translations.js)                                      |
| Server-side translation endpoint                          | [api/translate.js](../api/translate.js)                                                                |
| Translation cache table                                   | `public.text_translations` (migration 071)                                                             |
| Structured-ask schema                                     | `public.merlin_asks.kind` + `params` (migration 069)                                                   |
| Structured-action schema                                  | 7 act-path tables, `reason_code` + `params` (migration 070)                                            |

---

## Out of scope (intentional)

- **Tenant data inside structured params** (`route_name`, `room`, SKU codes, location labels, SLA names). These are customer data, not UI chrome — stays in source language by design.
- **Static seed scripts** for SparkleCo / FEB / Meridian HQ. Same reasoning.
- **Code comments / variable names / TODOs**. Source code stays English.
