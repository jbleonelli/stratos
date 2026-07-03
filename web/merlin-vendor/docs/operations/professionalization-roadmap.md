# Merlin Professionalization Roadmap

**Purpose:** A prioritized plan to take Merlin from "strong solo-founder velocity" to a codebase that passes investor technical due diligence, supports a second engineer safely, and scales to ~100 paying tenants without surprises.

**Audience:** Founding team, future hires, investors (Technical Appendix source).

**Status:** 🟡 Roadmap · updated 2026-06-29  
**Baseline:** ~130K LOC frontend · ~23K LOC API · 265 migrations · **self-hosted Supabase + full stack on AWS** (off Vercel, 2026-06-28) · **four app surfaces** · **10 CI jobs**

> Complements [`code-preparedness.md`](code-preparedness.md) (current-state audit) and [`engineering-maturity.md`](engineering-maturity.md) (tier plan). Update this doc when a phase lands or priorities shift.

> **Update 2026-06-29 — two big arcs landed since the last revision:**
>
> 1. **Whole stack moved to AWS** (data → self-hosted Supabase on EC2; compute/API/crons/frontend → Lambda + API Gateway + EventBridge + S3/CloudFront; GitHub Actions CI/CD). Infrastructure-only; app/RLS/tests unchanged. See [`code-preparedness.md`](code-preparedness.md) §4b + [`aws-migration.md`](aws-migration.md).
> 2. **Frontend improvement Phases 0–3 COMPLETE** — dead-code sweep (−4,135 lines), native TypeScript stood up (`types/db.ts` + typed `sb` client + 22 `.ts`/`.tsx`), **TanStack Query data layer** (19 `queries/*.ts`; the direct-Supabase-in-components gap closed), and god-file decomposition (`i18n.js` 7,034→156, `NowBriefingPage`/`Agentic`/`DeviceView` all under 2K). The frontend-typing and monolith sections below (§2.1/§2.2) are largely **executed** — cells updated inline.

---

## Executive summary

Merlin is already **above average** for its stage on schema discipline, multi-tenancy, documentation, and operational runbooks. The gaps that block "professional codebase" status are now concentrated in three areas:

1. **Subprocessor DPA collection** — register exists; vendor PDFs to populate per deal
2. **E2E breadth** — **3 hermetic journeys in CI** ✅; desktop approve-flow + contractor journeys still open
3. **Team onboarding surface** — **god-files largely decomposed** (mobile · Admin · Dashboard · Chat · i18n · NowBriefingPage · Agentic · DeviceView ✅); only a handful of ~2.3–2.6K-line files remain, none blocking

Observability and critical-path test gaps from the June roadmap **largely closed** (full `wrapHandler`, mobile RPC guard, `api/_lib` units, Playwright e2e in CI). The **monolith decomposition sprint (#999–#1018)** plus the **frontend Phase 0–3 sprint (#1152–#1187)** closed Admin, Dashboard, Chat, i18n, and three more component god-files, and stood up native TypeScript + a TanStack Query data layer.

This roadmap is ordered by **impact per week of effort**, not by "best practices" completeness. The goal is _no surprises when engineer #2 starts or when an investor opens the repo_, not a three-month refactor that stops product shipping.

---

## Current state (honest baseline)

### Strengths to preserve

| Area          | Evidence                                                                                                                                                                                                                                                    | Investor / audit value                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Schema & RLS  | 259 forward-only migrations, RLS on tenant tables, cross-tenant leak suite, worker party-guarded RPCs, RPC least-privilege (migs 257–259)                                                                                                                   | Top-decile for Series A                        |
| API typing    | 100% TypeScript in `api/`, CI `tsc --noEmit`                                                                                                                                                                                                                | Strong                                         |
| Multi-tenancy | B2B2B contracts model, impersonation audit log, four app surfaces                                                                                                                                                                                           | Real enterprise plumbing                       |
| i18n          | 5,276-key EN/FR DICT (now in `en-fr-translations.js`; `i18n.js` a 156-line engine), EN/FR/DE desktop, ES/PT mobile chrome, custom linter                                                                                                                    | Unusual at this size                           |
| Ops docs      | Runbooks (backup, Stripe, email), architecture canon, `/api/health`                                                                                                                                                                                         | High                                           |
| CI            | **10 jobs** + Husky pre-commit, Node 22 pinned (incl. Playwright e2e)                                                                                                                                                                                       | Credible gate                                  |
| Recent wins   | Monolith sprint (#999–#1018): Admin + Dashboard shells done, Chat started; **3 Playwright E2E** (#1014–#1015); `calls-approve` component test (#1016); mobile test+E2E (#989–#990), `api/_lib` units (#991), full Sentry wrap (#993), security migs 257–259 | Product + ops + security + team-scale maturity |

### Gaps to close

| Area                | Current                                                                                                                                                         | Target                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Automated tests     | **21 Vitest + 3 Playwright E2E** (mobile happy-path, login, worker Ask chat in CI); desktop approve + contractor open                                           | 5 hermetic E2E journeys total                                                          |
| Frontend typing     | **43 `@ts-check` + 22 native `.ts`/`.tsx`** (incl. `types/db.ts`, typed `sb` client, 19 `queries/*.ts`); CI `typecheck:js` gated ✅                             | Continue leaf-by-leaf `.jsx`→`.tsx`; strict mode                                       |
| Monolith files      | **Mobile + Admin + Dashboard + Chat + i18n + servicing-content + NowBriefingPage + Agentic + DeviceView decomposed ✅**; `App.jsx` lifted to `AuthedRoutes.jsx` | Largest now `Schedules`/`contractor-hardware`/`Hypervisor` (~2.3–2.6K) — none blocking |
| Sentry (server)     | ✅ All handlers `wrapHandler`-wrapped; metric alerts open                                                                                                       | Sentry UI alert rules per `sentry-alerts.md`                                           |
| Dead code           | Knip informational                                                                                                                                              | Ratchet to fail CI                                                                     |
| Internal docs       | Refreshed 2026-06-22; **Technical Appendix + policies shipped**                                                                                                 | Quarterly refresh when CI/schema shifts                                                |
| External audit pack | [`Merlin-Technical-Appendix.pdf`](../deliverables/Merlin-Technical-Appendix.pdf) + [`policies/`](../deliverables/policies/) · DPA PDFs open                     | Subprocessor folder populated per enterprise deal                                      |

---

## Guiding principles

1. **Preserve velocity** — incremental adoption (Prettier/Husky model), not big-bang rewrites
2. **Security and money paths first** — RLS, Stripe, refunds, tenant isolation before UI polish
3. **Make failures visible** — Sentry + `DataError` pattern over silent empty states
4. **Document before you migrate** — hosting changes (AWS) only when procurement requires it
5. **One file at a time for TS** — `@ts-check` net already in place; grow it deliberately

---

## Phase 0 — Documentation & governance (1 week)

_Low code risk; high DD payoff._

### 0.1 Refresh internal audit docs

Update these to current reality (259 migrations, **10 CI jobs**, Node 22, Merlin Field mobile, security migs 257–259, **3 Playwright E2E in CI**, Admin + Dashboard splits):

- [`code-preparedness.md`](code-preparedness.md)
- [`engineering-maturity.md`](engineering-maturity.md) (Tier 3+4 status)
- [`../README.md`](../README.md) recent changes section

**Acceptance:** Snapshot table matches `git rev-list --count` and migration count.

### 0.2 Create investor / DD Technical Appendix (15–25 pages) — **done ✅**

**Deliverables:**

- [`Merlin-Technical-Appendix.pdf`](../deliverables/Merlin-Technical-Appendix.pdf) · [`.docx`](../deliverables/Merlin-Technical-Appendix.docx) · [source `.md`](../deliverables/Merlin-Technical-Appendix.md)
- Regenerate: `.venv-deliverables/bin/python scripts/generate-merlin-architecture-doc.py` (+ `pandoc`/`typst` for PDF)

**Sections covered:**

| Section             | Content                                                             |
| ------------------- | ------------------------------------------------------------------- |
| Architecture        | System diagram, three app shells, events → agents pipeline          |
| Data & security     | RLS model, subprocessors, auth, what goes to Anthropic              |
| Scalability         | 100-tenant readiness: done vs open                                  |
| Engineering process | CI jobs, branch policy, pre-commit, Dependabot                      |
| Test strategy       | What runs in CI, prod read-only leak tests, destructive write guard |
| Known gaps          | Honest list with dates — builds trust                               |
| Post-raise plan     | 90-day engineering priorities                                       |

**Acceptance:** Non-engineer investor can read in 20 minutes and understand risks.

### 0.3 Lightweight policies (2–3 pages each) — **done ✅**

Located in [`docs/deliverables/policies/`](../deliverables/policies/):

- [Information security policy](../deliverables/policies/information-security-policy.md)
- [Access control policy](../deliverables/policies/access-control-policy.md)
- [Incident response policy](../deliverables/policies/incident-response-policy.md)
- [Change management policy](../deliverables/policies/change-management-policy.md)
- [Data retention & deletion policy](../deliverables/policies/data-retention-and-deletion-policy.md)

Not a full ISO 27001 ISMS — enough for standard SaaS questionnaires.

**Acceptance:** Can answer 80% of a standard SaaS security questionnaire from these docs.

### 0.4 Subprocessor folder — **register done ✅ · PDFs open 🟡**

Register: [`docs/deliverables/subprocessors/README.md`](../deliverables/subprocessors/README.md). Collect DPA / SOC 2 PDFs per vendor before enterprise deals.

---

## Phase 1 — Test maturity (3–4 weeks)

_Most critical-path items **landed 2026-06-21 PM** (#989–#991, #990). **E2E expanded 2026-06-22** (#1014–#1015). Remaining work: desktop approve + contractor journeys._

### 1.1 Expand component tests — **partial ✅**

**Done:** `personas`, `pagination`, `locale-format`, `mobile-surface`, `doc-markdown`, `docs-utils`, device-uplink, hypervisor utils, **`calls-approve.test.jsx`** (#1016 — CallRow approve/hold wiring).

**Still open:** `primitives.jsx` Pill/DataError; extend doc-markdown edge cases.

### 1.2 API library unit tests — **core `_lib` done ✅ (#991)**

**Done:** `autonomyGate`, Stripe LIVE/TEST config branching, `sendPushToUser` skip/prune.

**Still open:** handler-level integration (webhook signature, auth gates, cron drain loops).

### 1.3 Playwright E2E smoke — **3 journeys done ✅ (#990, #1014–#1015)**

**Done (all hermetic, stub Supabase, CI job `e2e`):**

| Spec                            | Journey                                                      | PR    |
| ------------------------------- | ------------------------------------------------------------ | ----- |
| `e2e/mobile-happy-path.spec.js` | Worker Today → mark done → Tickets → raise ticket with photo | #990  |
| `e2e/login.spec.js`             | Logged-out visitor → password sign-in → signed-in surface    | #1014 |
| `e2e/ask.spec.js`               | Worker Ask Merlin tab → send question → reply in thread      | #1015 |

**Still open (2 journeys):**

1. Desktop approve/dismiss flow on a pending ask (demo org)
2. Contractor login → contracts view
3. _(Optional)_ Platform admin → tenants list

Prefer **hermetic stub pattern** over disposable Supabase until flake budget allows real-DB previews.

### 1.4 Harden existing integration tests

**Already done (keep):**

- `ALLOW_DESTRUCTIVE` prod write guard in `tests/setup.js`
- `tolerateTimeout()` in leak suite

**Still to do:**

- Expand leak suite tables as new RLS tables ship (process in PR template)
- Implement or remove `describe.todo` in `money-paths.test.js` (Stripe webhook guards)
- Add disposable test project in CI secrets (separate from prod Lisa tests)

**Target:** CI runs full leak suite on prod (read-only) + write tests only on test project.

### 1.5 Coverage ratchet (Week 4)

- Add Vitest coverage report (informational first)
- Set threshold on `api/_lib/` and `tests/` directories only
- Block regressions on cross-tenant leak file count

**Acceptance:** Can truthfully say "~30% coverage on critical paths" in DD.

---

## Phase 2 — Code structure & typing (4–6 weeks, parallel with product)

### 2.1 Decompose monolith files

| Order  | File                                    | Status                                                                                                                                                                              |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~0~~  | ~~`MobileApp.jsx`~~                     | ✅ **Done** — shell ~786 lines; `MobileTodayTab` / `MobileTicketsTab` / `MobileAskTab` + `mobile-utils.js`                                                                          |
| ~~1~~  | ~~`Admin.jsx`~~                         | ✅ **Done** (#999–#1006) — shell ~190 lines; 10 section modules + `admin-ui.jsx`; largest slice `AdminLocations.jsx` (1,723 lines)                                                  |
| ~~2~~  | ~~`Dashboard.jsx`~~                     | ✅ **Done** (#1008–#1012) — shell ~384 lines; `DashboardBankPanels` (1,090) · `DashboardAgents` (1,337) · `DashboardIncidents` · `DashboardFirehose` + dead Hero/FloorPlan removed  |
| ~~3~~  | ~~`Chat.jsx`~~ (1,739→1,559)            | ✅ **Done** — `ChatMessages` · `ChatWindowChrome` (#1013–#1018) + LLM-grounding context builders → `chat-context.js` (#1189); the stateful `ChatPanel` core is kept whole by design |
| ~~4~~  | ~~`App.jsx`~~                           | ✅ Routing lifted to `AuthedRoutes.jsx`                                                                                                                                             |
| ~~5~~  | ~~`i18n.js`~~ (7,034→156)               | ✅ **Done** (#1184) — DICT → `en-fr-translations.js`                                                                                                                                |
| ~~6~~  | ~~`NowBriefingPage.jsx`~~ (3,311→1,850) | ✅ **Done** (#1187) — `now-bubbles.jsx` · `now-charts.jsx`                                                                                                                          |
| ~~7~~  | ~~`Agentic.jsx`~~ (2,785→1,987)         | ✅ **Done** (#1186) — `agentic-frequency-cards.jsx` (chat untouched)                                                                                                                |
| ~~8~~  | ~~`DeviceView.jsx`~~ (2,723→1,925)      | ✅ **Done** (#1185) — `device-view-primitives.jsx` · `device-view-telemetry.jsx`                                                                                                    |
| ~~9~~  | ~~`servicing-content.js`~~ (3,033→119)  | ✅ **Done** (#1189) — `SERVICING_CONTENT` data object + pools → `servicing-content-data.js`                                                                                         |
| ~~10~~ | ~~`Dashboard.jsx`~~ (649)               | ✅ Shell since #1008–#1012; **not split further by design** — catalog inline to avoid a circular import (`Dashboard.jsx:38`)                                                        |

**Still >2K (not yet targeted, none blocking):** `Schedules.jsx` (~2,625), `contractor-hardware.jsx` (~2,579), `Hypervisor.jsx` (~2,363), `LocationTree.jsx` (~2,328), `DeviceDetailPage.jsx` (~2,176). The remaining big files are pure data dictionaries (`en-fr-translations.js`, `de-translations.js`, `servicing-content-data.js`, `slas-data.js`) — data, not logic.

**Rule:** No new features in monolith files — new code only in extracted modules.

**Acceptance (revised):** No _logic_ file >2,000 lines except the data dictionaries; the original "except `i18n.js`" carve-out is moot now that `i18n.js` is a 156-line engine.

### 2.2 Incremental frontend TypeScript — ✅ stood up (Phase 1–2)

**Done:** native TS landed — generated `types/db.ts` (Supabase schema), a typed `sb` client (`db-client.ts`), and **19 `queries/*.ts` React Query hooks** with typed `TablesInsert`/`TablesUpdate` writes, on top of **43 `@ts-check` `.js`** modules. CI `typecheck:js` gates all of it (`jsconfig.json` includes `.ts`/`.tsx`).

**Continue (leaf-by-leaf, not big-bang):** convert hot `.jsx`→`.tsx` (explicit-extension imports), add `@ts-check` to mobile tab modules, then enable `strict` incrementally.

**Do not** enable global `checkJs: true` / `strict` until the backlog is burned.

**Acceptance:** ✅ exceeded the original "20+ `@ts-check`" bar (43 + 22 native TS); zero regressions in CI.

### 2.3 Shared UI primitives (minimal design system in code)

Reduce duplicated inline button/input styles:

Extract from repeated patterns in `PlatformDemo.jsx`, `LocationDrawer.jsx`, etc.:

- `Button` — primary / secondary / ghost / danger / tab
- `Input`, `Select`, `Field` label wrapper
- `Table` header/cell styles

**Not** a full shadcn migration — match existing `tokens.css` variables.

**Acceptance:** New platform admin surfaces use primitives; no new copy-paste button objects.

### 2.4 ESLint graduation

Current: `react-hooks/rules-of-hooks` is **error** ✅ (blocking in CI). `exhaustive-deps` remains **warn** (~44 violations).

1. ~~Flip `rules-of-hooks` to **error**~~ ✅
2. Burn `exhaustive-deps` backlog file-by-file (Sidebar, PlatformTenantDetail were the worst offenders)
3. Dead `import React` sweep → flip `no-unused-vars` to error

**Acceptance:** ESLint warnings near zero; CI fails on new hook violations.

### 2.5 Knip enforcement

1. Run knip; delete clearly dead exports (retired ContractorApp shell leftovers)
2. Ratchet: set max allowed dead exports in CI
3. Fail on regression

**Acceptance:** `lint-deadcode` blocks merges.

---

## Phase 3 — Observability & reliability (2 weeks)

### 3.1 Complete Sentry coverage — **server handlers done ✅ (#993)**

**Frontend:** Data-layer reads done (22 `*-data.js` modules). Still open: chat tool-use errors, 3D viewer init failures.

**Backend:** ✅ All API handlers + crons wrapped with `wrapHandler` (PR #993).

**Still open:** Sentry metric/threshold alert rules (§3.2).

### 3.2 Sentry alert rules

From [`sentry-alerts.md`](sentry-alerts.md) §4.2:

- Metric alert: ReferenceError spike (frontend)
- Metric alert: Error rate backstop
- Separate project or tag filter for `runtime: server` vs client

### 3.3 Realtime channel org scoping

From [`100-tenants-readiness.md`](100-tenants-readiness.md) §2.3:

Filter Supabase Realtime subscriptions by `org_id` in:

- `agent-runs.js`, `event-firehose.js`, `devices-store.js`, `merlin-asks.js`, `realtime-channel.js`

**Acceptance:** No cross-tenant realtime fan-out at 50+ active tenants.

### 3.4 RLS performance audit

Enable `pg_stat_statements`; after 1 week of traffic:

- Review p95 on `device_events`, `agent_runs`, contractor RLS paths
- Index or policy shape fixes

**Acceptance:** Documented baseline; no unbounded client reads added without pagination.

### 3.5 Backup drill

Execute sandbox PITR restore per [`runbooks/backup-restore.md`](runbooks/backup-restore.md):

- Document timestamp, steps, verification
- Schedule annual recurrence

**Acceptance:** One-page "we tested recovery on [date]" in Technical Appendix.

---

## Phase 4 — Security & compliance hardening (2–3 weeks)

### 4.1 Supabase GRANT audit (before Oct 30, 2026)

Per [`migration-grant-pattern.md`](migration-grant-pattern.md):

- Verify every `public` table has explicit grants
- Automated check in CI or quarterly script

### 4.2 SECURITY DEFINER RPC review — **substantially closed ✅ (migs 257–259)**

See [`security-deferred.md`](security-deferred.md) §1.2. Periodic re-audit when new SECURITY DEFINER functions land.

### 4.3 Upgrade Supabase tier when revenue justifies

**Pro → Team** when:

- First enterprise deal requires SOC 2 inheritance, or
- ~10 paying tenants, or
- Need 30-day PITR

**Acceptance:** Supabase SOC 2 report in subprocessor folder.

### 4.4 MFA & access inventory

Document and enforce:

- GitHub org: MFA required
- Vercel, Supabase, Stripe, DNS: named admins only (max 3)
- Quarterly access review checklist

### 4.5 Optional: dedicated auth subdomain

`auth.adaptiv.systems` for Supabase SMTP — when auth email volume >1K/month (per [`security-deferred.md`](security-deferred.md) §2.2).

---

## Phase 5 — Hosting & enterprise optics (only when required)

**Do not do preemptively for investor DD.** Vercel + Supabase is defensible.

Trigger AWS migration ([`../architecture/aws-migration.md`](../architecture/aws-migration.md)) when:

- Enterprise contract requires "application tier on AWS," or
- Procurement blocks Vercel explicitly

**If triggered:**

- SST: CloudFront + S3 + Lambda for SPA + 110 API handlers
- Keep Supabase as data plane (do not rewrite RLS)
- Secrets Manager, CloudWatch 30-day retention, EventBridge crons
- Budget 2–4 weeks + parallel run

**Alternative:** Vercel Enterprise for SOC 2 report + SLA without migration.

---

## Phase 6 — Team readiness (ongoing)

### 6.1 PR template & definition of done

Every PR that touches:

| Change type     | Required                                       |
| --------------- | ---------------------------------------------- |
| New RLS table   | Migration + GRANT + leak suite tier assignment |
| New client read | RLS lint pass or `rls-scope-ok` waiver comment |
| New i18n string | EN + FR keys                                   |
| New API route   | `wrapHandler` + typecheck                      |
| User-facing UI  | Component test if logic-bearing                |

### 6.2 Onboarding doc for engineer #2

One week plan:

- Day 1: [`../guides/getting-started.md`](../guides/getting-started.md), run local dev, read [`../architecture/building-ops-model.md`](../architecture/building-ops-model.md)
- Day 2: Trace one agent tick end-to-end
- Day 3: Fix one ESLint hook warning or add one component test
- Day 4–5: Small scoped PR with review

### 6.3 CODEOWNERS (when 2+ engineers)

- `supabase/migrations/` — require review
- `api/_lib/stripe.ts`, `api/stripe/` — require review
- `.github/workflows/` — require review

---

## 90-day consolidated schedule

| Week    | Focus                                            | Deliverable                                           |
| ------- | ------------------------------------------------ | ----------------------------------------------------- |
| 1       | ~~**Finish Technical Appendix PDF** + policies~~ | ✅ **Done** — see [`deliverables/`](../deliverables/) |
| ~~2~~   | ~~Component + `api/_lib` tests + mobile E2E~~    | ✅ **Done** (#989–#991, #990)                         |
| ~~3~~   | ~~Sentry wrap all handlers~~                     | ✅ **Done** (#993)                                    |
| ~~4~~   | ~~Decompose `MobileApp.jsx`~~                    | ✅ **Done** (#992, #997, Ask tab)                     |
| ~~5–6~~ | ~~Decompose `Admin.jsx`~~                        | ✅ **Done** (#999–#1006)                              |
| ~~7–8~~ | ~~Decompose `Dashboard.jsx`~~                    | ✅ **Done** (#1008–#1012)                             |
| ~~9~~   | ~~Login + worker Ask E2E~~                       | ✅ **Done** (#1014–#1015)                             |
| 10      | Finish `Chat.jsx` split                          | Shell <800 lines + extracted modules                  |
| 11      | 2 more Playwright journeys                       | Desktop approve-flow + contractor in CI               |
| 12      | Sentry metric alerts + backup drill doc          | Alert rules wired                                     |
| 13      | Knip ratchet + `format:check` in CI              | Dead code CI gate                                     |
| 14–16   | Decompose `App.jsx` + expand `@ts-check`         | Team onboarding ready                                 |

---

## What not to do

| Avoid                                        | Why                                       |
| -------------------------------------------- | ----------------------------------------- |
| Full frontend TypeScript migration in one PR | Kills velocity; use `@ts-check` net       |
| AWS replatform before a customer requires it | 2–4 week distraction                      |
| Adopt shadcn/Tailwind mid-flight             | Style system already in `tokens.css`      |
| Claim SOC 2 certified                        | Inherit from vendors only until you audit |
| 100% test coverage goal                      | Wrong metric; target critical paths       |
| Split every file at once                     | Regression risk without E2E               |

---

## Success criteria ("professional codebase" definition)

Merlin reaches **professional / hiring-ready / DD-ready** when:

- [x] Technical Appendix PDF exists and matches repo ([`Merlin-Technical-Appendix.pdf`](../deliverables/Merlin-Technical-Appendix.pdf))
- [x] CI: build, typecheck (api + opt-in js), lint-i18n, lint-rls, lint-js (errors), test, **e2e**, audit
- [x] Cross-tenant leak suite runs on every PR with credentials
- [x] Playwright — **3 hermetic journeys in CI** (#990, #1014–#1015); desktop approve + contractor still open
- [x] Page render-smoke harness (~33 routed leaves incl. MobileApp)
- [x] Route-map drift guard in CI
- [x] `rules-of-hooks` blocking in ESLint
- [x] 20+ `@ts-check` frontend modules (**43 `@ts-check` + 22 native `.ts`/`.tsx`** today; React Query data layer in `queries/*.ts`)
- [x] 20+ unit/component test files beyond smoke (**27 Vitest files** today)
- [x] All crons and API handlers report to Sentry (#993)
- [x] No frontend _logic_ file >2,000 lines except data dictionaries (mobile · Admin · Dashboard · Chat · `App.jsx`→`AuthedRoutes` · `i18n.js` · `NowBriefingPage` · `Agentic` · `DeviceView` ✅; remaining >2K = `Schedules`/`contractor-hardware`/`Hypervisor`/`LocationTree`/`DeviceDetailPage`, not yet targeted)
- [ ] Knip fails CI on dead export regression
- [ ] Backup restore drill documented within last 12 months
- [ ] Subprocessor DPA folder complete
- [x] [`code-preparedness.md`](code-preparedness.md) updated within last quarter (2026-06-22)

---

## Appendix A — CI target state

```
build
typecheck (api)          — blocking
typecheck (frontend)     — blocking, @ts-check files only
lint-i18n                — blocking
lint-rls                 — blocking
lint-js                  — blocking, 0 warnings on hooks
lint-deadcode (knip)     — blocking with ratchet
test (vitest)            — blocking
test (playwright)        — blocking on preview env OR nightly
audit (npm)              — informational → blocking on high/critical
format:check (prettier)  — blocking in CI (pre-commit is not enough alone)
```

---

## Appendix B — Investor one-liner (current state)

> Merlin is ~200K LOC of production B2B SaaS with RLS-first multi-tenancy, 259 versioned migrations, and a **10-job CI pipeline** on Node 22 (cross-tenant leak tests, 21 Vitest suites, and **3 hermetic Playwright journeys** — mobile worker path, login, and Ask chat). Every API/cron handler reports to Sentry. June 2026 shipped RPC least-privilege hardening (migs 257–259), full mobile/Admin/Dashboard decomposition, and an Architecture Overview deliverable. The primary remaining investment before scaling the team is **finishing the governance pack (Technical Appendix + policies) and 2 more E2E journeys** — not architectural rework.

---

## Appendix C — Related internal docs

| Doc                                                                    | Role                                 |
| ---------------------------------------------------------------------- | ------------------------------------ |
| [`code-preparedness.md`](code-preparedness.md)                         | Current audit (refreshed 2026-06-22) |
| [`series-b-readiness.md`](series-b-readiness.md)                       | Series B checklist                   |
| [`engineering-maturity.md`](engineering-maturity.md)                   | Tier plan                            |
| [`100-tenants-readiness.md`](100-tenants-readiness.md)                 | Scale checklist                      |
| [`security-deferred.md`](security-deferred.md)                         | Security backlog                     |
| [`../architecture/aws-migration.md`](../architecture/aws-migration.md) | Optional hosting move                |
| [`runbooks/backup-restore.md`](runbooks/backup-restore.md)             | Recovery procedure                   |
