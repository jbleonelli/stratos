# Code preparedness — Merlin codebase audit

Honest snapshot of where the Merlin codebase stands against professional-engineering norms. Useful for: tech due-diligence prep, onboarding a teammate, deciding where the next hardening sprint focuses, or answering the "are we ready?" question.

Complements:

- [`engineering-maturity.md`](engineering-maturity.md) — the _tier plan_ (what to build when)
- [`professionalization-roadmap.md`](professionalization-roadmap.md) — the _prioritized roadmap_ (phased work to hiring-ready / Series A DD)
- [`series-b-readiness.md`](series-b-readiness.md) — the _Series B + enterprise checklist_ (team scale, scale proof, compliance pack, Pillar 7 enterprise closure on current architecture)

This doc is the _current state_ (audit + gaps). Re-run the snapshot table quarterly or after a significant hardening sprint.

## Snapshot (run 2026-06-22 · frontend rows refreshed 2026-06-29 after the Phase 0–3 frontend sprint)

| Metric                              | Value                                                                     | Notes                                                                                                                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Total source lines**              | ~200K                                                                     | Excludes node_modules, dist, locks                                                                                                                                                                                                                                                 |
| Frontend (`src/app/`)               | ~130K                                                                     | React 18 + Vite SPA · **four surfaces** (customer · platform · worker · mobile) · **served from S3 + CloudFront** (off Vercel 2026-06-28)                                                                                                                                          |
| API (`api/`)                        | ~23K                                                                      | 72 HTTP endpoints (113 TS files incl. `_lib` helpers). **Served on AWS Lambda + API Gateway** as one bundled router (migrated off Vercel functions 2026-06-28; `infra/aws-compute/`)                                                                                               |
| Migrations (`supabase/migrations/`) | ~27K (**261 numbered**)                                                   | Forward-only, sequential (+ `_template.sql`)                                                                                                                                                                                                                                       |
| Docs (`docs/`)                      | ~16K (**84 files**)                                                       | Architecture / guides / operations / runbooks                                                                                                                                                                                                                                      |
| Tests (`tests/`)                    | ~3.2K (**27 Vitest files**) + **5 Playwright E2E**                        | Smoke + prod guard suites · mobile RPC guard · `api/_lib` + Claude-provider + spend-guard + **money-path (datasource overage) + agent-loop (autonomy gate)** units · hermetic E2E (mobile, login, logout, Ask chat, **+ desktop customer shell: 5-pillar routing**) in CI — see G1 |
| **TypeScript coverage in `api/`**   | 113 / 113 files (100%)                                                    | Zero `@ts-nocheck`                                                                                                                                                                                                                                                                 |
| **Frontend type safety**            | **43 `@ts-check` `.js` + 22 native `.ts`/`.tsx`**                         | Native TS = generated `types/db.ts`, typed `sb` client (`db-client.ts`) + **19 `queries/*.ts` React Query hooks** (Phase 1–2). CI `typecheck:js` gates all of it via `jsconfig.json`                                                                                               |
| **Frontend data layer**             | **TanStack Query (React Query v5)**                                       | Phase 2: every component reads/writes through typed hooks in `queries/*.ts` (or an in-place realtime-`useQuery` pattern); the old "direct-Supabase across 331 `useEffect`s" gap is closed. 3 documented non-candidates (UserMenu/MobileTicketsTab/CheckoutResultPage)              |
| **i18n**                            | **5,276-key EN/FR DICT** · **EN/FR/DE** desktop · **ES/PT** mobile chrome | Phase 3 split: DICT lives in `en-fr-translations.js` (mirrors `de/es/pt-translations.js`); `i18n.js` is now a 156-line engine. Custom lint blocks missing keys + footgun patterns                                                                                                  |
| **Crons running**                   | **18**                                                                    | Agents, billing, SLA sweeps, demo replay, CRM sync, push-dispatch, etc. **On EventBridge Scheduler → `merlin-cron-saas` Lambda** (off Vercel Cron 2026-06-28)                                                                                                                      |
| **CI jobs**                         | **10**                                                                    | build · api typecheck · frontend typecheck · lint-i18n · lint-rls · lint-js · knip · test · **e2e** · npm audit                                                                                                                                                                    |
| **Node runtime**                    | **22.x** (pinned)                                                         | CI + `engines.node` + `engines-node.test.js` guard after 2026-06-21 prod incident                                                                                                                                                                                                  |
| **Pre-commit**                      | Husky + Prettier + ESLint on staged files                                 |                                                                                                                                                                                                                                                                                    |
| **Sentry**                          | Data-layer (22 `*-data.js` modules) + **all API/cron handlers**           | Every serverless handler `wrapHandler`-wrapped (#993); alert rules defined in `sentry-alerts.md` (error-rate, Stripe, spend-breach, cron-failure) — code signals shipped; dashboard rules are a one-time manual setup                                                              |
| **Liveness probe**                  | `/api/health`                                                             | Cold-start + DB round-trip; catches Node-runtime regressions                                                                                                                                                                                                                       |
| **RPC surface hardening**           | **Migs 257–261**                                                          | Trigger revokes · anon stripped from 37 write RPCs · 33 internal fns → `service_role` only · `push_outbox` client grants revoked (261) · timing-safe secret compares (#1030)                                                                                                       |
| **Git history**                     | **1,709 commits**                                                         | Active, solo-founder velocity                                                                                                                                                                                                                                                      |

### Shipped 2026-06-28 — AWS migration (compute + data now on our AWS)

- **The whole app moved off managed Supabase + Vercel onto our own AWS account** (`us-east-1`): data on self-host Supabase (EC2), compute/API/crons/frontend on Lambda + API Gateway + EventBridge + S3/CloudFront. Zero-downtime DNS-flip for compute; big-bang write-freeze for data. **Infrastructure-only change — application code, RLS, and tests unchanged.** This shifts the operational-readiness picture (new ops burden + a temporary CI/CD and DR-proof regression against new gains in control/IaC/consolidation) — **see the new [§4b Infrastructure & hosting](#4b-infrastructure--hosting--in-transition-after-the-aws-migration-2026-06-28-) assessment below.** Runbooks: [`aws-migration.md`](aws-migration.md), [`aws-cutover-runbook.md`](aws-cutover-runbook.md), [`../../infra/aws-compute/README.md`](../../infra/aws-compute/README.md).

### Shipped since last audit refresh (2026-06-23 — Claude on Amazon Bedrock, EU data residency)

- **Claude inference cut over to Amazon Bedrock (`eu-central-1`, Frankfurt) in prod — verified.** All five Claude call sites (chat, translate ×2, extract, agent loop) route through one provider factory ([`api/_lib/claude-client.ts`](../../api/_lib/claude-client.ts)) selected by the `CLAUDE_PROVIDER` env flag; first-party Anthropic stays the default and the one-env-var rollback. The Bedrock path pins an EU region + uses EU cross-region inference profiles (`eu.anthropic.…`), so **model inference and data stay in the EU** — a concrete data-residency capability for EU / enterprise prospects, and the reason it was chosen over Anthropic-operated alternatives that can't pin EU. Verified end-to-end on prod (chat served by Bedrock — response `request_id` carries the `msg_bdrk_` signature — with the agent cron healthy on the new path). Commit `0e0913f`.
- **+16 unit tests** ([`tests/claude-provider.test.js`](../../tests/claude-provider.test.js)) — covers the routing logic the cutover would otherwise have shipped untested: bare→EU-profile model mapping, the provider-aware `isClaudeConfigured()` mockClaude-fallback gate, factory provider selection, and `computeCost()` rate resolution after the `eu.anthropic.`/`-v1:0` prefix strip. Commit `9700c3b`; chips at G1.

#### Cost + security hardening (2026-06-23 PM)

- **Per-org spend circuit-breaker** ([`api/_lib/claude-spend-guard.ts`](../../api/_lib/claude-spend-guard.ts), mig 260) — hard-blocks runaway Claude/Bedrock cost at `$5/hr` / `$30/day` per org (env-tunable), enforced at all five call sites, fail-open on a meter error. DB-side aggregate (`claude_org_spend_usd`) stays O(1) under a runaway. +10 unit tests. Closes the Series-B "per-org spend circuit-breaker" punch-list item. (#1029)
- **Timing-safe secret comparisons** ([`api/_lib/secure-compare.ts`](../../api/_lib/secure-compare.ts)) — the 10 service-role/cron auth gates now compare `CRON_SECRET`/`SUPABASE_SECRET_KEY` via constant-time `secureEqual` (SHA-256 + `timingSafeEqual`) instead of `===`, closing a timing-oracle and the unset-env `undefined === undefined` hole. +5 unit tests. (#1030)
- **RLS advisor review** — the three flagged items were verified **intentional, not vulnerabilities**: `sales_inquiries`' always-true INSERT is a public intake form (reads are platform-admin only); `push_outbox`'s RLS-deny-all-no-policy is the service-role-only outbox. `push_outbox`'s vestigial anon/authenticated grants were revoked and intent documented on the schema (mig 261).

### Shipped earlier (2026-06-22 PM — governance pack)

- **Technical Appendix + policies** — [`Merlin-Technical-Appendix.pdf`](../deliverables/Merlin-Technical-Appendix.pdf) (15 sections, 7 diagrams), [`.docx`](../deliverables/Merlin-Technical-Appendix.docx), [source markdown](../deliverables/Merlin-Technical-Appendix.md); five policies in [`policies/`](../deliverables/policies/); subprocessor register in [`subprocessors/`](../deliverables/subprocessors/). Regenerate: `scripts/generate-merlin-architecture-doc.py`.

### Shipped earlier same day (monolith sprint #1008–#1018 + E2E #1014–#1016)

- **`Dashboard.jsx` fully decomposed (#1008–#1012)** — **2,839 → ~384 lines (−86%)**; shell only. Slices: `DashboardBankPanels.jsx` (1,090), `DashboardAgents.jsx` (1,337), `DashboardIncidents.jsx`, `DashboardFirehose.jsx`; dead Hero/FloorPlan body removed (#1012).
- **`Chat.jsx` split started (#1013, #1017–#1018)** — **2,358 → ~1,565 lines (−33%)**; `ChatMessages.jsx` · `ChatWindowChrome.jsx` extracted; dead action-card/asks-stack removed.
- **Playwright E2E expanded (#1014–#1015)** — **3 hermetic journeys in CI:** `e2e/login.spec.js` (password sign-in), `e2e/ask.spec.js` (worker Ask Merlin tab), plus existing `e2e/mobile-happy-path.spec.js`.
- **`calls-approve.test.jsx` (#1016)** — CallRow approve/hold decision wiring (component test beyond page smoke).

### Shipped earlier same sprint (Admin split #999–#1006)

- **`Admin.jsx` fully decomposed (#999–#1006)** — **5,088 → ~190 lines (−96%)**; shell + section dispatch only. Sections: `AdminOrganization.jsx`, `AdminLocations.jsx` (+Zones, **1,723 lines** — largest slice), `AdminSetup.jsx`, `AdminUsers.jsx`, `AdminSlas.jsx`, `AdminAgents.jsx`, `AdminChannel.jsx`, `AdminNotifications.jsx`, `AdminImport.jsx` (+ shared `admin-ui.jsx`). Guarded by Rollup build + eslint `no-undef` (not page-smoke — Admin excluded from smoke harness).
- **Architecture Overview deliverable started** — `scripts/generate-merlin-architecture-doc.py` + [`docs/deliverables/Merlin-Architecture-Overview.docx`](../deliverables/Merlin-Architecture-Overview.docx) (7 diagrams). Partial progress toward Technical Appendix PDF; policies + test/ops sections still open.

### Shipped earlier (2026-06-21 PM — hardening sprint #989–#997 + Ask tab)

- **Mobile worker-path tests (#989)** — `worker-rpc-guard.test.js` (party guard on `worker_complete_route_task`), `mobile-surface.test.js`, `MobileApp` in page-smoke
- **`api/_lib` unit tests (#991)** — `autonomy-gate.test.js`, `stripe-config.test.js`, `push-dispatch.test.js`
- **Playwright E2E (#990)** — hermetic mobile happy-path (mark task done → raise ticket with photo); stub Supabase; UI + payload assertions; CI job `e2e`
- **Full server Sentry wrap (#993)** — all remaining API handlers + crons via `wrapHandler`
- **Mobile monolith split (#992, #997, Ask tab)** — `MobileApp.jsx` **2,136 → ~786 lines** (shell only); tabs in `MobileTodayTab.jsx` / `MobileTicketsTab.jsx` / `MobileAskTab.jsx` + `mobile-utils.js`
- **Web push live** — VAPID configured; mig 256 triggers active
- **Housekeeping** — removed stale `NEXT-SESSION.md` / `docs/sessions/` log (#994–#995); desktop sign-in `100dvh` fix (#996)

### Shipped earlier same day (security sprint #984–#988)

- **Post-audit DB hardening (migs 257–259)** — trigger-function revokes; `anon` stripped from 37 write RPCs; 33 internal DEFINER fns → `service_role`; ticket-photos LIST scoped to org folder
- **Security review artifact** — [`docs/security/revoke-public-execute.DRAFT.sql`](../security/revoke-public-execute.DRAFT.sql) promoted to mig 258

### Shipped earlier same week (2026-06-20 → 2026-06-21 AM)

- **Merlin Field (mobile worker app)** — worker writes (mig 253), ticket photos, push infrastructure, `mobile.adaptiv.systems` PWA
- **German i18n** — 5,255 DICT keys + Docs CMS DE; mobile ES/PT chrome
- **Node 20 → 22** + `/api/health` + pure-logic unit tests (#983)

## What "professional-level" means here

Five rubrics: schema discipline, type safety, multi-tenancy, operational readiness, and code quality. Industry baselines are the implicit Series-A / "we're hiring our first engineer" standard.

### 1. Schema discipline — top-decile ✅

- 259 sequential forward-only migrations, named `NNN_topic.sql`. No squashes, no rewrites after apply.
- Explicit GRANT pattern documented in [`migration-grant-pattern.md`](migration-grant-pattern.md) (Supabase auto-grant removal Oct 30 2026 already accounted for).
- Every tenant-scoped table has RLS enabled with `organization_id = current_user_org()` + `has_location_access(location_id)` policies.
- Worker mobile writes use party-guarded RPCs (mig 253), not bare INSERT policies — matches established pattern.
- **RPC least-privilege (Jun 2026):** trigger functions no longer client-callable; admin/write RPCs authenticated-only; internal cron helpers service-role-only. See [`security-deferred.md`](security-deferred.md) for what remains open.
- Helper functions in SQL centralize access logic so RLS policies stay consistent.

This is meaningfully better than most Series-A startups. The schema is genuinely well-versioned.

### 2. Type safety — strong ✅ (API) · advancing ✅ (frontend)

- 100% TS coverage in `api/`. Every handler compiles cleanly under `tsc --noEmit` (the handlers keep their original `(req, res)` signature; on AWS one esbuild-bundled router Lambda runs them all via an adapter shim — `infra/aws-compute/`).
- **Frontend now stands up native TypeScript (Phase 1):** generated `types/db.ts` (Supabase schema) + a typed `sb` client (`db-client.ts`) cast against it, so all new data code is type-checked end-to-end. **22 native `.ts`/`.tsx` modules** alongside **43 `@ts-check` `.js`** modules; CI `typecheck:js` blocks regressions across both.
- **A real data layer landed (Phase 2):** the previous "38 components calling Supabase directly across 331 `useEffect`s, no React Query" gap is closed — reads/writes route through typed TanStack Query v5 hooks in `queries/*.ts` (19 domain files) or an in-place realtime-`useQuery` pattern. Typed `TablesInsert`/`TablesUpdate` on every write.
- Remaining JSX bulk (~200+ files) still untyped — intentional gradual adoption (leaf-by-leaf, explicit `.jsx`→`.tsx` conversions), not a big-bang migration. Mobile tab modules remain `@ts-check`-only.

### 3. Multi-tenancy — mature ✅

- 8 organisations live in prod: Adaptiv (`adaptiv`), Meridian (3 buildings), IMF, FEB, SparkleCo + other contractors.
- Multi-building tenants scoped via location prefix filters where it matters.
- Cross-tenant contractor flows gated through `contracts` with RLS for both parties.
- Platform role hierarchy + impersonation with audit trail (`platform_audit_log`).
- Cross-tenant leak regression suite in CI (read-only against prod as Lisa@SparkleCo).
- **Fourth app surface (mobile)** reuses same auth + RLS; worker writes scoped via party-guarded RPC + CI guard test.
- **Storage:** ticket photo LIST scoped to org folder (mig 257); direct public URLs unchanged for `<img>` rendering.

This is real enterprise B2B2B plumbing, not a prototype.

### 4. Operational readiness — professional ✅

- **Crons:** 18, now on **EventBridge Scheduler → `merlin-cron-saas` Lambda** (was `vercel.json`); each with documented purpose; all Sentry-wrapped.
- **Sentry:** data-layer failures reported; **every serverless handler** captures uncaught throws with `function_name`/`method`/`path` tags. (⚠️ now complemented by CloudWatch for Lambda/cron/EC2 — see the infrastructure note below.)
- **Health probe:** `/api/health` exercises cold-start + DB after Node 22 incident.
- **Backup + DR:** nightly `pg_dump` → versioned S3 + EBS snapshots (DLM, 12h) + EC2 auto-recovery on the self-host (was Supabase managed PITR). Procedure: [`runbooks/backup-restore.md`](runbooks/backup-restore.md) ⚠️ **runbook needs a rewrite for the dump/snapshot model + a real drill — now higher priority since the mechanism is unproven.**
- **Email deliverability:** SPF + DKIM + DMARC. [`email-deliverability.md`](email-deliverability.md).
- **i18n** with custom linter blocking missing keys; **DE desktop + ES/PT mobile** now live.
- **Web push:** live (VAPID set, mig 256 triggers + push-dispatch cron).
- **Demo replay:** demo orgs avoid live Anthropic spend.
- **Spend circuit-breaker:** per-org hourly + daily Claude/Bedrock cost cap (`api/_lib/claude-spend-guard.ts`, mig 260 `claude_org_spend_usd`) gates every call site (chat, agent loop, translate, extract) — hard-blocks a runaway above `$5/hr` / `$30/day` (env-tunable), fail-open on a meter error.
- **Stripe LIVE** with subscriptions, agent add-ons, Customer Portal, data-source overage cron.
- **Tooling:** Dependabot (minor/patch), Husky pre-commit, **10-job CI**, Node 22 pinned.

The runbook density here is well above solo-founder norm.

### 4b. Infrastructure & hosting — in transition after the AWS migration (2026-06-28) ⚠️

The app + data moved off managed Supabase + Vercel onto **our own AWS account** (`us-east-1`): self-host Supabase on EC2 (data) + Lambda/API Gateway/EventBridge + S3/CloudFront (compute/frontend). This was an **infrastructure-only** change — the application code, RLS, multi-tenancy, and CI test gates above are **unchanged**, so rubrics 1–3 carry over verbatim. But the hosting/ops posture shifted, and the audit should track it honestly.

**Gained:** "hosted on AWS" enterprise/DD optic · single-vendor consolidation + full account control · **IaC for the whole stack** (Terraform, data _and_ compute; previously Vercel config + `vercel.json`) — reproducible + per-client stampable · SOC 2 inheritance from one provider · secrets in **AWS Secrets Manager** · data residency per-deployment.

**New gaps the migration introduced (close in this order):**

1. **CI/CD regressed — top priority.** Lost Vercel auto-deploy + PR preview environments. Deploy is now manual (`infra/aws-compute/build.mjs` + `terraform apply` + `deploy-spa.sh`); no staging/preview env. A **GitHub Actions deploy + a staging stack** is the single biggest gap.
2. **DR — drilled 2026-06-28 ✅, two follow-ups open.** First restore drill on the self-host: found the nightly dump had never run, forced one, restored into a throwaway box (isolated; prod untouched) — **backup path + data-complete proven** (15 orgs / 71 users / 1210 locations / 5509 storage rows). Found + fixed the dump format (plain→`-Fc --no-owner --no-privileges`, clean 0-error restore; cloud-init PR #1144). Runbook rewritten ([`runbooks/backup-restore.md`](runbooks/backup-restore.md)). **Open:** apply the format fix to the LIVE prod script (cloud-init only applies on boot); add a dump-freshness CloudWatch alarm (→ gap #3).
3. **Observability parity.** CloudWatch (Lambda/cron/EC2) now sits alongside Sentry; wire alerting on Lambda error-rate, cron failures, EC2 status-check, EBS disk-fill, and cert expiry.
4. **Self-host ops burden.** We now own Postgres/OS patching, cert-renewal monitoring, EBS capacity, and Supabase-stack upgrades. **Single EC2 box** — auto-recovery + snapshots mitigate, but no hot standby (deliberate tradeoff; a real availability ceiling). HA replica is the documented fast-follow.
5. **No managed WAF/edge protection** (Vercel gave basic DDoS/bot mitigation free) — CloudFront basics only; no AWS WAF rules configured.
6. **Transitional dual-stack** — managed Supabase + Vercel remain warm rollbacks until the soak ends; retire after.
7. **Cost up ~2–4×** (accepted; control/consolidation is the driver) · **Lambda cold start ~940 ms** (new latency characteristic; the SPA's direct-to-DB path is unaffected).

**Verdict:** application maturity unchanged and strong; infrastructure maturity is _mid-transition_ — control/IaC/consolidation bought at the cost of self-host ops + a temporary deploy-automation and DR-proof regression. Full plan + runbooks: [`aws-migration.md`](aws-migration.md), [`aws-cutover-runbook.md`](aws-cutover-runbook.md), [`../../infra/aws-compute/README.md`](../../infra/aws-compute/README.md).

### 5. Code quality — strong on process ✅ · god-files largely decomposed ✅

- **CI gates:** build (Rollup circular-chunk guard), api + frontend typecheck, lint-i18n, lint-rls, lint-js (**`rules-of-hooks` = error**), Vitest, **Playwright e2e (5 specs)**, npm audit (informational).
- **No `@ts-nocheck`** anywhere in `api/`.
- **Mobile split complete:** `MobileApp.jsx` ~786-line shell; tabs extracted and E2E-guarded.
- **Admin split complete:** `Admin.jsx` ~190-line shell; 10 section modules + `admin-ui.jsx`.
- **Dashboard split complete:** `Dashboard.jsx` ~384-line shell; 4 panel modules.
- **Phase 3 god-file decomposition (2026-06-29):** `i18n.js` 7,034→**156** (DICT → `en-fr-translations.js`) · `servicing-content.js` 3,033→**119** (the `SERVICING_CONTENT` data object + pools → `servicing-content-data.js`) · `NowBriefingPage.jsx` 3,311→**1,850** (→ `now-bubbles.jsx` / `now-charts.jsx`) · `Agentic.jsx` 2,785→**1,987** (→ `agentic-frequency-cards.jsx`; chat orchestration deliberately untouched) · `DeviceView.jsx` 2,723→**1,925** (→ `device-view-primitives.jsx` / `device-view-telemetry.jsx`) · `Chat.jsx` 1,739→**1,559** (pure LLM-grounding context builders → `chat-context.js`; the stateful `ChatPanel` core deliberately kept whole). All behavior-preserving slices via the byte-faithful recipe.
- **`Dashboard.jsx` (649) deliberately not split further** — already a shell; its `METRICS_WIDGET_CATALOG` references in-file widget components and is inline by design to avoid a circular import (documented at `Dashboard.jsx:38`).
- **Largest remaining code files (>2K lines):** `Schedules.jsx` (~2,625), `contractor-hardware.jsx` (~2,579), `Hypervisor.jsx` (~2,363), `LocationTree.jsx` (~2,328), `DeviceDetailPage.jsx` (~2,176), `Insights.jsx` (~2,172), `Deployments.jsx` (~2,159). The big files that remain are pure data dictionaries (`en-fr-translations.js`, `de-translations.js`, `servicing-content-data.js`, `slas-data.js`) — data, not logic. `App.jsx` routing was extracted to `AuthedRoutes.jsx`.
- **Per-widget ErrorBoundary** on customizable surfaces; global boundary on `<App />`.
- **Test layering:** leak suite · money-path guards · page smoke · route drift · pure-logic pins · mobile guards · hermetic E2E — see G1.

## Gaps (in priority order)

### G1. Test coverage — critical paths covered; E2E breadth partial ⚠️

**Was #1 critical gap (May 2026).** June hardening closed mobile write path; **3 Playwright journeys now in CI:**

| Layer                         | Status                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-tenant RLS leak suite   | ✅ CI, prod read-only                                                                                                                                                  |
| Money-path / RPC guards       | ✅                                                                                                                                                                     |
| Page render smoke (~33 pages) | ✅ (desktop leaves **+ MobileApp**)                                                                                                                                    |
| Route-map drift guard         | ✅                                                                                                                                                                     |
| Component / pure logic tests  | ✅ (+ `personas`, `pagination`, `locale-format`, `engines-node`, `mobile-surface`, **`api/_lib` units**, **`calls-approve`**, **`claude-provider`** (Bedrock routing)) |
| Prod write safety gate        | ✅ `ALLOW_DESTRUCTIVE`                                                                                                                                                 |
| **Mobile worker RPC guard**   | ✅ `worker-rpc-guard.test.js` (prod as Lisa)                                                                                                                           |
| **Mobile surface smoke**      | ✅ page-smoke + `mobile-surface.test.js`                                                                                                                               |
| **Playwright E2E (4 specs)**  | ✅ `mobile-happy-path` · `login` · `logout` · `ask` (#990, #1014–#1015, #1023)                                                                                         |

**Still missing:**

- **Playwright E2E breadth** — desktop approve-flow, contractor surface (login + mobile worker tabs ✅)
- **`api/` handler integration** — pure `_lib` logic unit-tested; webhook signature verification, auth gates, cron drain loops still manual
- **Behavioral UI tests** — page smoke only asserts mount, not correctness

**What it'd take:** ~1 week for 2 additional hermetic E2E journeys; see [`professionalization-roadmap.md`](professionalization-roadmap.md) Phase 1.

### G2. Monolith file decomposition — mobile + Admin + Dashboard + i18n + 3 component god-files DONE ✅

- **`MobileApp.jsx` fully decomposed: 2,136 → ~786 lines (−63%)** — shell + tabs in `MobileTodayTab` / `MobileTicketsTab` / `MobileAskTab` (+ `mobile-utils.js`). Guarded by 3 E2E specs + page-smoke.
- **`Admin.jsx` fully decomposed: 5,088 → ~190 lines (−96%)** — 10 section modules + `admin-ui.jsx`.
- **`Dashboard.jsx` fully decomposed: 2,839 → ~384 lines (−86%)** — `DashboardBankPanels` · `DashboardAgents` · `DashboardIncidents` · `DashboardFirehose` (#1008–#1012).
- **Frontend Phase 3 (#1184–#1189):** `i18n.js` 7,034→156 (DICT extracted) · `servicing-content.js` 3,033→119 · `NowBriefingPage.jsx` 3,311→1,850 · `Agentic.jsx` 2,785→1,987 (chat untouched) · `DeviceView.jsx` 2,723→1,925 · `Chat.jsx` 1,739→1,559 (grounding builders out; `ChatPanel` core kept whole). Behavior-preserving; each verified on prod. `Dashboard.jsx` (649) left as a shell by design (catalog inline to avoid a cycle).
- **Largest open monoliths:** `Schedules.jsx` (~2,625), `contractor-hardware.jsx` (~2,579), `Hypervisor.jsx` (~2,363), `LocationTree.jsx` (~2,328). `App.jsx` routing already lifted to `AuthedRoutes.jsx`.

**What it'd take:** Same byte-faithful slice recipe on `Schedules`/`contractor-hardware`/`Hypervisor` if/when they become edit-hot; none are blocking.

### G3. Sentry coverage — server handlers wrapped; alerts open ⚠️

- **Done:** data-layer report sites in 22 frontend `*-data.js` modules; **every serverless handler `wrapHandler`-wrapped** (#993).
- **Open:** Sentry metric/threshold alerts per [`sentry-alerts.md`](sentry-alerts.md). Frontend still data-layer-only (no interaction breadcrumbs beyond error boundary).

**What it'd take:** ~half a day to define alert rules in the Sentry UI.

### G4. Frontend TypeScript + data layer — advancing ✅ (was stalled)

- **Un-stalled by the Phase 0–3 frontend sprint (2026-06-29).** Native TS now stood up: generated `types/db.ts` + typed `sb` client + 22 `.ts`/`.tsx` modules, on top of 43 `@ts-check` `.js` modules; CI `typecheck:js` gates all of it.
- **Data layer no longer ad-hoc:** TanStack Query v5 across the app (19 `queries/*.ts` domain files) — the "direct-Supabase in components" gap is closed.
- Mobile tab modules remain `@ts-check`-only; the untyped JSX bulk converts leaf-by-leaf.

**What it'd take:** Continue converting hot `.jsx`→`.tsx` and adding `@ts-check`; enable strict mode incrementally. No longer a blocking gap.

### G5. Knip enforcement — open ⚠️

Dead-code linter runs in CI but is **informational** (`continue-on-error: true`).

**What it'd take:** 1 day audit + ratchet to fail on regression.

### G6. Governance artifacts — policies + Technical Appendix shipped ✅ · DPA collection open 🟡

- **Technical Appendix** — [`Merlin-Technical-Appendix.pdf`](../deliverables/Merlin-Technical-Appendix.pdf) + [`.docx`](../deliverables/Merlin-Technical-Appendix.docx) + [source markdown](../deliverables/Merlin-Technical-Appendix.md); regenerate via `scripts/generate-merlin-architecture-doc.py`.
- **Five lightweight policies** — [`docs/deliverables/policies/`](../deliverables/policies/) (information security, access control, incident response, change management, data retention).
- **Subprocessor register** — [`docs/deliverables/subprocessors/`](../deliverables/subprocessors/); vendor DPA/SOC 2 PDFs still to collect per deal.
- Backup restore drill not yet documented as executed.
- Web push go-live not yet documented in a runbook (feature is live).

**What it'd take:** See [`professionalization-roadmap.md`](professionalization-roadmap.md) Phase 0.

### G7. Scale / performance hardening — highest-impact slice done ✅ · retention + hygiene open 🟡

A 2026-06-24 sweep (perf advisor + table-size scan) fixed the timeout-class bugs
and the one genuinely unbounded table: `route_overrides` (#1045), hot unindexed
FKs + `rate_limit_buckets` retention (#1047), silent `catch → []` reads (#1048/#1049),
and a manual RLS blind-spot review (clean). **Remaining work is captured in
[`scale-hardening-backlog.md`](scale-hardening-backlog.md)** — the headline open
item is **`agent_runs` retention** (280 MB audit log, needs a retention-window
decision); the rest (≈70 small-table FKs, 56 unused indexes, 24 `auth_rls_initplan`)
is low-impact hygiene. Run that doc's queries to refresh.

## Industry tier comparison

| Tier                 | Typical traits                                                       | Where Merlin sits                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Indie / solo**     | Migrations ad-hoc, no i18n, minimal docs, 10–30K LOC                 | Well above.                                                                                                                                                      |
| **Series A startup** | 50–150K LOC, ~30% test coverage, CI/CD, multi-tenant.                | **Matches or exceeds** — architecture, CI, security hardening, 3 E2E, modularization, **Technical Appendix + policies**; **DPA folder + 2 E2E journeys** remain. |
| **Series B startup** | 150–400K LOC, ~50% test coverage, observability stack, multi-region. | Architecture + i18n + observability close; **Chat/App splits**, 2 more E2E, governance pack, scale validation remain.                                            |
| **Enterprise**       | 500K+ LOC, service boundaries, deep observability, formal SLAs.      | Not yet. Architectured to grow into it.                                                                                                                          |

If a Series-A funder did a tech-DD today, they'd compliment schema + multi-tenant + CI, the **June security sprint**, **full API Sentry wrap**, **3 E2E journeys**, **mobile/Admin/Dashboard modularization**, and the **Technical Appendix + policy pack** — then ask for **subprocessor DPA PDFs** and **desktop approve + contractor E2E**. Headline: _"Credible Series-A engineering posture with DD documentation; ops proof and 2 E2E journeys are the main follow-ups."_

## Recommended next sprint (aligned with professionalization roadmap)

Detailed phases live in [`professionalization-roadmap.md`](professionalization-roadmap.md). Immediate priorities:

1. **Collect subprocessor DPA/SOC 2 PDFs** — populate [`docs/deliverables/subprocessors/`](../deliverables/subprocessors/) per vendor
2. **Finish `Chat.jsx` split** — continue byte-faithful extraction (#1013–#1018 pattern)
3. **2 more Playwright journeys** — desktop approve-flow, contractor login
4. **Sentry metric alerts** — wire rules in Sentry UI (~half day)
5. **Backup restore drill doc** — execute sandbox PITR once, one-page record
6. **Widen `@ts-check` net** — start with `mobile-utils.js`, data hooks as files are touched

## How to re-run this audit

```bash
# Run from the project root after a `git pull`.

# Migration count (numbered only)
ls supabase/migrations/[0-9]*.sql | wc -l

# Vitest files + Playwright specs
find tests -name '*.test.*' | wc -l
find e2e -name '*.spec.js' 2>/dev/null | wc -l

# @ts-check frontend modules
rg -l '@ts-check' src --glob '*.{js,jsx}' | wc -l

# Top 10 largest frontend files
wc -l src/app/*.{js,jsx} 2>/dev/null | sort -rn | head -10

# Sentry report sites (frontend data layer)
rg -l 'captureException' src/app --glob '*-data.js' | wc -l

# Commits
git rev-list --count HEAD
```

Update this doc whenever a significant chunk of the recommended sprint lands, or quarterly even if nothing changes — the snapshot table calibrates "where we are."
