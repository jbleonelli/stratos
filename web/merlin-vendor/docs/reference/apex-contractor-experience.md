# Apex contractor experience — handoff

**Status:** shipped to `main` + deployed (Vercel), 2026-06-15. Migrations **226–235** applied to prod. Commits `4ca230a` → `18b684a`.
**Hero org:** **Apex Facilities Group** — a multi-service contractor (cleaning + security + maintenance + hospitality) on **Meridian HQ**. Login `morgan@apex-facilities.com` / `merlin2026`.
**Cost:** everything below is **$0** — replay fixtures, no Claude spend — and **generic to every replay contractor** (Apex, Samsic, …), not hard-coded to Apex.

This documents the "contractor employee" experience: Merlin as an **AI co-worker for a facilities contractor**, covering the full operating loop — _know where you stand → see what's coming (with dollar stakes) → act in one click → prove quality → save money → suggest improvements upward_.

---

## 1. What a contractor sees (surface by surface)

A contractor org (`kind='contractor'`) gets the same 5-pillar shell as an owner, re-tailored. The contractor-only surfaces:

| Pillar → tab               | Page                        | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MONITOR → Now**          | `NowBriefingPage`           | Building-scoped briefing + the "Priorities" bubble/Hypervisor card.                                                                                                                                                                                                                                                                                                                                                                                                   |
| **MONITOR → Scorecard**    | `ContractorScorecardPage`   | One-glance cockpit. Per-line **adherence + trend + forecast + last inspection**; **overall grade is a button** that reveals its math (item-weighted mean + per-line contribution + grade bands); **line cards expand in place** (weakest sub-areas, the real open/overdue items, forecast outlook, focused Ask-Merlin); a **multi-line Evolution chart**; a **"This week's focus"** card (the worst forecast-at-risk line + projected lift + **Dispatch** / Plan-it). |
| **OPERATE → Activity**     | `Activity.jsx`              | Maximal 3-pool lifecycle feed: **~20 CTAs / ~12 In-progress / ~45–60 Resolved**, churning each minute (in-progress complete → resolved). Replay contractors read the **unified events feed** (not the legacy incident stream).                                                                                                                                                                                                                                        |
| **OPERATE → Quality**      | `ContractorQualityPage`     | "Pass every FM inspection." Own **quality score + grade**, upcoming inspections (staggered per-line cadence, named inspectors, type), **Merlin "prep to pass"** (weakest sub-areas, critical-first, predicted score + readiness gap), and an audit-trail history (findings + corrective actions).                                                                                                                                                                     |
| **ANTICIPATE → Forecast**  | `ContractorAnticipatePage`  | **SLA early-warning.** Per service line, the live adherence is **forecast forward**; the contractor sets the **alert threshold**; when a line is forecast to dip below it, the card raises an alert with **ranked, line-aware mitigations** + a **Dispatch** button + "Draft a plan with Merlin". Plus **SLA credit exposure** (the dollar consequence) and renewals.                                                                                                 |
| **ANTICIPATE → Savings**   | `ContractorSavingsPage`     | Real margin per contract from an entered **cost basis** (with a **labour / supplies breakdown**), signal-scaled savings opportunities, a **margin trend**, and a **"Realized /mo"** stat fed by adopted suggestions.                                                                                                                                                                                                                                                  |
| **INNOVATE → Suggestions** | `ContractorSuggestionsPage` | Improvement / **wellbeing** / cost / safety / **energy** ideas Merlin drafts from observed signals ("Merlin spotted this Nd ago"), with quantified impact. Send to client / dismiss; track adopted/declined ("in effect since").                                                                                                                                                                                                                                      |
| **Chat (Merlin)**          | `Chat.jsx` + `api/chat.ts`  | Grounded with the contractor's portfolio, live per-line adherence, **and the actual open/overdue line items** so it answers "show me the open restroom requests" with specifics rather than punting.                                                                                                                                                                                                                                                                  |

## 2. What the client/FM sees (the other end of two loops)

Most of the above is **contractor-private** (the FM never sees it; Savings is explicitly private). Two loops are two-sided — the FM (a `real_estate` org like Meridian) sees its half under **OPERATE → Contractors**:

- **Inspections** (`ManagerInspectionsView`) — the QC inspections the FM runs across its contractors, scored, with a pass-rate headline. (Read-only; the replay loop drives the schedule.)
- **Suggestions** (`ManagerSuggestionsInbox`) — the ideas contractors sent up, with real **Adopt / Decline** (`set_suggestion_decision`). The contractor sees the decision land on their Suggestions page.

## 3. The loops

- **Quality loop:** contractor _preps to pass_ (Quality page) ↔ FM _runs & scores the inspection_ (FM Inspections). The contractor's prediction is scored from the same live adherence the inspection uses.
- **Suggestion loop:** Merlin _drafts_ → contractor _sends_ → FM _adopts/declines_ → contractor sees the decision → adopted ideas roll into **"Realized /mo"** on Savings.
- **Act loop:** Merlin _forecasts a miss_ → recommends _ranked mitigations_ with **dollar stakes** → contractor clicks **Dispatch** → an in-progress crew task appears on the **Activity feed** → the replay churn completes it.

---

## 4. Data model (all replay/demo, $0)

Tables (Supabase `jatenmlbczwqmdlnhjbq`):

- **`contractor_alert_thresholds`** (mig 227) — one row/contractor: the adherence level + lead time at which Merlin alerts on a forecast dip.
- **`inspections`** (mig 228; `inspection_type` + `corrective_action` added mig 232) — FM QC inspections per contractor/line. `location_id` is **TEXT**.
- **`contractor_suggestions`** (mig 229) — improvement/wellbeing/cost/safety/energy ideas + their lifecycle (draft → sent → adopted/declined).

RPCs (all `security definer`, party-guarded by `current_user_org()`):

- `set_contractor_alert_threshold` (227) — contractor sets their alert threshold.
- `set_suggestion_status` (229, contractor: send/dismiss) · `set_suggestion_decision` (230, manager: adopt/decline).
- `servicing_open_items_for_viewer(building)` (234) — the real open/overdue items for chat grounding (overdue from `demo_servicing_state` + open restrooms from `demo_restroom_state`); contained like `servicing_rollup_for_viewer`/`servicing_state_for_viewer`.
- `contractor_dispatch(line, title, detail)` (235) — inserts an in-progress crew dispatch → lands In-progress in the Activity feed.

Replay ticks (per replay contractor, each cron minute, wired in `api/agents/replay-tick.ts`):

- `demo_contractor_agent_tick` (rewritten mig 226) — the maximal Activity feed (3 churning pools).
- `demo_contractor_inspections_tick` (228 → 231 cadence → 232 texture) — rolling inspection window scored from live adherence.
- `demo_contractor_suggestions_tick` (229 → 233 richer pool) — maintains drafts + advances sent→decided.

Client data hooks (`src/app/`): `useContractorThresholds`/`setContractorThreshold` + `sla-forecast.js` (slas-data.js); `useInspections`/`useManagerInspections`/`useContractorSuggestions`/`useManagerSuggestions`/`setSuggestionStatus`/`setSuggestionDecision` (`contractor-programs-data.js`); `useServicingOpenItems`/`contractorDispatch` (`servicing-data.js`).

---

## 5. Demo script (as Apex, on prod)

1. **MONITOR → Scorecard** — click the **grade** to see how it's scored; click a **line card** to expand its drill-in; note the **Evolution** chart + **This week's focus**. Hit **Dispatch the fix** on the focus card.
2. **ANTICIPATE → Forecast** — show the **SLA credit exposure** card ("$X/mo at risk"), the per-line **forecast + mitigations**, and click **Dispatch the top fix**.
3. **OPERATE → Activity** — the dispatched crew now shows under **In-progress**.
4. **OPERATE → Quality** — quality score, upcoming inspection + **Merlin's prep / predicted score**, audit-trail history.
5. **INNOVATE → Suggestions** — Merlin's drafted ideas (incl. Energy), **Send to client**.
6. **Chat** — "Show me the open restroom requests" → Merlin names the actual restrooms.
7. _(As Meridian)_ **OPERATE → Contractors → Suggestions** — **Adopt** one; back as Apex it shows adopted + feeds **Realized /mo** on Savings.

---

## 6. Verification status

- **Verified live** in the dev preview (logged in as Apex on Meridian HQ): Scorecard, ANTICIPATE Forecast + credit exposure + dispatch, Savings breakdown, Quality, Suggestions — all render with real prod data; dispatch confirmed to write an in-progress event.
- **Prod-only checks (not testable in the sandbox):** the **chat** reply quality (chat is mocked in dev), the **3D Hypervisor** heatmap (WebGL doesn't paint headless), and the **FM/Meridian side** (the preview is the Apex user — needs a Meridian login).

---

## 7. Gotchas (durable)

- **`location_id` is TEXT** app-wide (slugs like `hq-fl-43`), not uuid — new tables referencing it use `text`.
- **`demo_servicing_state` has no `adherence_pct`** (it's per-item: `open_count`/`hours_since`/`sla_hours`) and **`open_count` is 0 everywhere** — adherence comes from `demo_servicing_perf`; "open" requests come from `demo_restroom_state`.
- **Replay contractors read the unified events Activity feed**, not the legacy incident stream (`Activity.jsx`: `useLegacyIncidents = isReplayMode && kind !== 'contractor'`).
- **Contractor contract SLA _clauses_ read ~0% in the demo** (not measured) — never forecast/score off them; use the servicing-line adherence (`useServicingRollup` `byTop[line].adh`). The clause numbers on ANTICIPATE are demo-synthesised (anchored to line adherence) for `replay_mode` manager orgs only; the agent/report paths use the real (uncomputed) values.
- **At-risk / focus uses the forecast signal** (`fc.willAlert`), not `adh < threshold` — the demo drifts to ~90% (the threshold), so a raw comparison disagrees with the per-line forecast pills.
- **`useT()` returns a fresh closure each render** — don't put `t` in a `useMemo` dep that feeds expensive work; depend on `lang` (`useLanguage()`).
- **Adding a contractor-only page:** `{contractorOnly:true}` item in `pillar-subnav.js` (`PILLAR_SUBNAV` + `VIEW_TO_PILLAR`) + an App.jsx route branch gated on `activeOrg?.kind==='contractor'` + a DICT label (`lint:i18n` enforces parity).

---

## 8. Open / next

- **True event-level clause compute** — seed realistic `device_requests` at Meridian HQ so the two computable clauses (Hygiene response-time, Supplies stockouts) are genuinely event-driven rather than demo-anchored.
- **Deeper FM inspection actions** — let the FM schedule/score inspections (today the FM side is read-only; the replay loop drives it).
- **Crew & coverage view** — the workforce layer the dispatch/mitigation actions imply ("add an evening shift") but that has no home yet. Strongest net-new for a follow-on session.
- **Samsic** (the FR/EUR contractor clone) gets all of this generically — worth a prod spot-check.

> Machine-readable session log: `~/.claude/.../memory/session-2026-06-15-contractor-experience.md`.
