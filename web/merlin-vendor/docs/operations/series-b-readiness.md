# Series B & enterprise readiness — Merlin

**Purpose:** Honest checklist for what “Series B ready” and **enterprise-class on the current architecture** (self-host Supabase + Lambda/CloudFront) mean for Merlin — engineering, operations, compliance, and scale.

**Audience:** Founding team, future hires, investors (Technical Appendix source material).

**Status:** 🟡 Roadmap · updated 2026-06-30  
**Baseline:** ~200K LOC · **267 migrations** · **1,894 commits** · 10 CI jobs (+ `terraform-plan` + manual `deploy-prod`) · four app surfaces · ~8 prod orgs · **full stack on AWS** (data + compute, off Vercel/managed Supabase 2026-06-28)

> Complements [`code-preparedness.md`](code-preparedness.md) (current-state audit), [`professionalization-roadmap.md`](professionalization-roadmap.md) (Series A / hiring-ready plan), and [`100-tenants-readiness.md`](100-tenants-readiness.md) (production scale to ~100 tenants). Update this doc when a pillar lands or priorities shift.

> **Update 2026-06-30:** Synced to live repo + enterprise checklist. Shipped since 2026-06-29: **Phase 3 finish** (`servicing-content` + `Chat` grounding, #1189–#1190) · **7 Playwright E2E** (approve-flow + contractor-login, #1102–#1103) · **`format:check` in CI** (#1100) · **handler integration** started (#1101) · **DR restore drill** (#1144, 2026-06-28) · **GitHub Actions deploy** (`deploy-prod.yml` manual + PR `terraform-plan`, #1143) · **RLS perf** (migs 265–267 + `lint:rls-perf` CI, #1194) · **WAF on CloudFront** COUNT mode (#1201–#1203). Architecture unchanged — close **ops proof**, **scale proof**, and **compliance closure**.

---

## How to read this doc

**Series A DD** asks: _Is the architecture sound? Will this break embarrassingly in prod?_

**Series B DD** asks: _Can a team of 5–10 engineers ship safely at ~100 paying tenants? Can you pass enterprise security questionnaires? Do ops and tests scale beyond the founder?_

**Enterprise-class (keep current architecture)** asks: _Can you operate under contract — detect, respond, recover, and answer a security questionnaire without a rewrite?_

Merlin **passes Series A** on schema, RLS, CI, security hardening (migs 257–261), mobile write-path guards, **7 Playwright E2E journeys**, full API Sentry wrap, **frontend Phases 0–3** (React Query + typed client + god-file decomposition), and the **governance pack**. Remaining gap is **operational proof + scale validation + compliance closure** — not an architectural rewrite.

---

## Tier comparison (industry norms)

| Tier           | Typical traits                                                                                                                     | Merlin today                                                                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Series A**   | 50–150K LOC, CI/CD, multi-tenant, ~30% critical-path tests                                                                         | **Matches or exceeds**                                                                                                                                                                                       |
| **Series B**   | 150–400K LOC, ~50% critical-path coverage, observability + on-call, team onboarding <1 week, 100-tenant ops proof, compliance pack | **Architecture + governance strong; ops alerting, load test, team process open**                                                                                                                             |
| **Enterprise** | Formal SLAs, pen test, DPA pack, HA/DR proof, SOC 2 or AWS Artifact + policies                                                     | **Policies + AWS control + WAF + DR drill ✅; gaps: alerting, load test, DPA PDFs, GDPR, streaming replica, reference customer** — see [Pillar 7](#pillar-7--enterprise-class-on-current-architecture) |

---

## Pillar 1 — Team & codebase onboarding

_Goal: engineer #2–#5 merges without breaking tenant isolation or money paths._

| #   | Item                                 | Status                          | Target                                                    | Effort    | Notes                                                                                                                                                                                                                           |
| --- | ------------------------------------ | ------------------------------- | --------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | **`Admin.jsx` decomposition**        | ✅ Done (#999–#1006)            | Shell ~190 lines; 10 section modules                      | —         | Largest slice: `AdminLocations.jsx` (1,723 lines)                                                                                                                                                                               |
| 1.2 | **`Dashboard.jsx` split**            | ✅ Done (#1008–#1012)           | Shell ~649 lines (catalog inline by design)               | —         | Panel modules extracted; shell holds `METRICS_WIDGET_CATALOG` to avoid import cycle                                                                                                                                             |
| 1.3 | **`Chat.jsx` split**                 | ✅ Done (#1013–#1018, #1189)    | Grounding builders extracted                              | —         | ~1,559 lines shell + `chat-context.js`; `ChatMessages` · `ChatWindowChrome` earlier                                                                                                                                             |
| 1.4 | **No _logic_ god-files**             | ✅ Core done (#1184–#1189)      | Split when edit-hot                                       | Ongoing   | i18n/servicing-content/NowBriefingPage/Agentic/DeviceView ✅ · **open (pages, split if hot): `Schedules`/`contractor-hardware`/`Hypervisor`/`LocationTree`/`DeviceDetailPage` (~2.2–2.6K)** · data modules (`*-data.js`) OK |
| 1.5 | **Frontend TypeScript + data layer** | ✅ Stood up (Phase 1–2)         | Strict mode; convert hot `.jsx`→`.tsx`                    | Ongoing   | 43 `@ts-check` + 22 native `.ts`/`.tsx` (incl. `types/db.ts`, typed `sb`, 19 `queries/*.ts`); CI `typecheck:js` gated                                                                                                           |
| 1.6 | **Knip blocking in CI**              | ❌ Informational                | Ratchet dead-export count                                 | ~1 day    | See [`professionalization-roadmap.md`](professionalization-roadmap.md) §2.5                                                                                                                                                     |
| 1.7 | **PR template + CODEOWNERS**         | ❌ Partial (PR template exists) | Migrations · Stripe · `.github/workflows/` · `infra/`   | ~1 day    | Change-management story for DD                                                                                                                                                                                                  |
| 1.8 | **Engineer #2 onboarding week**      | ❌ Open                         | 5-day plan doc                                            | ~half day | Trace agent tick · run leak suite · scoped PR                                                                                                                                                                                   |

**Acceptance:** New engineer ships a merged PR in week 2 without touching tenant isolation or Stripe.

---

## Pillar 2 — Test & quality gates

_Goal: truthfully claim critical paths are covered; regressions caught in CI._

| #    | Item                                         | Status       | Target                                | Effort  | Notes                                                                                    |
| ---- | -------------------------------------------- | ------------ | ------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| 2.1  | Cross-tenant RLS leak suite (prod read-only) | ✅           | —                                     | —       | Lisa@SparkleCo in CI                                                                     |
| 2.2  | Money-path / RPC guards                      | ✅           | —                                     | —       | `money-paths`, `contract-costs-guards`, etc.                                             |
| 2.3  | Page render smoke (~33 leaves)               | ✅           | —                                     | —       | Incl. `MobileApp`                                                                        |
| 2.4  | Mobile worker RPC guard                      | ✅           | —                                     | —       | `worker-rpc-guard.test.js`                                                               |
| 2.5  | **`api/_lib` unit tests**                    | ✅ Core done | Expand handler integration            | Ongoing | `autonomyGate`, Stripe config, push dispatch, claude-provider, spend-guard (#991+)     |
| 2.6  | **Playwright E2E — mobile happy path**       | ✅           | —                                     | —       | Hermetic stub Supabase (#990, CI job `e2e`)                                              |
| 2.6b | **Playwright E2E — login / logout**          | ✅           | —                                     | —       | Password sign-in (#1014) · sign-out (#1023)                                             |
| 2.6c | **Playwright E2E — worker Ask chat**         | ✅           | —                                     | —       | Ask Merlin tab → reply in thread (#1015)                                                 |
| 2.6d | **Playwright E2E — desktop approve-flow**    | ✅           | —                                     | —       | Facility manager approves pending ask (#1102)                                            |
| 2.6e | **Playwright E2E — contractor login**        | ✅           | —                                     | —       | Contractor → contracts portfolio (#1103)                                               |
| 2.6f | **Playwright E2E — customer shell routing**  | ✅           | —                                     | —       | 5-pillar desktop routing (#1038)                                                         |
| 2.7  | **Playwright E2E — breadth**                 | 🟡 7/8 done  | 7–10 total journeys                   | ~2 days | _(Optional)_ platform admin impersonation journey                                        |
| 2.8  | **Handler integration tests**                | 🟡 Partial   | Stripe webhook sig · cron auth        | ~3 days | `cron-auth.test.js` + Stripe webhook (#1101); expand cron drain loops                    |
| 2.9  | **Coverage ratchet**                         | ❌           | Vitest report on `api/_lib/` + guards | ~2 days | Informational → fail on regression                                                       |
| 2.10 | **`format:check` in CI**                     | ✅           | Prettier blocking                     | —       | Whole-repo Prettier + CI gate (#1100)                                                    |
| 2.11 | **`lint:rls-perf` in CI**                    | ✅           | Catch unfiltered big-table reads      | —       | (#1194)                                                                                  |
| 2.12 | **Load test (sandbox)**                      | ❌           | k6/Artillery, 50 concurrent users     | ~1 day  | Against restored sandbox, **not prod**; publish p95 in Technical Appendix                |

**Acceptance:** Technical Appendix lists every CI job + which customer journeys are E2E-covered (**7 today**).

---

## Pillar 3 — Observability & incident response

_Goal: failures are detected, triaged, and recovered — with a paper trail._

| #   | Item                             | Status     | Target                                              | Effort    | Notes                                                                                          |
| --- | -------------------------------- | ---------- | --------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| 3.1 | Sentry on all API/cron handlers  | ✅         | —                                                   | —         | `wrapHandler` everywhere (#993)                                                                |
| 3.2 | Sentry data-layer (`*-data.js`)  | ✅         | —                                                   | —         | 22 modules                                                                                     |
| 3.3 | **`/api/health` liveness probe** | ✅         | Uptime monitor documented                           | ~30 min   | Node 22 + DB round-trip                                                                        |
| 3.4 | **Sentry → Slack**               | ❌         | Errors watched, not inbox-only                      | ~1 hour   | [`sentry-alerts.md`](sentry-alerts.md)                                                         |
| 3.5 | **Sentry metric alerts**         | ❌         | ReferenceError spike + error backstop               | ~half day | Issue Alert for new types exists                                                               |
| 3.6 | **CloudWatch → Slack**           | ❌         | Lambda errors · cron · EC2 · disk · cert · dump age | ~1 day    | Complements Sentry; required for self-host ops                                                 |
| 3.7 | **Customer outage runbook**      | 🟡 Partial | Alert → triage → **AWS rollback** → comms           | ~1 day    | 2026-05-14 retro exists; update for Lambda/CloudFront (not Vercel)                             |
| 3.8 | **Backup restore drill**         | 🟡 Partial | Dated one-page record                               | —         | **Executed 2026-06-28** — path proven; **open:** live prod dump script format + freshness alarm |
| 3.9 | **Migration rollback procedure** | 🟡 Partial | Restore + replay-forward doc                        | ~half day | [`runbooks/backup-restore.md`](runbooks/backup-restore.md) rewritten post-AWS                  |
| 3.10 | **Incident postmortem template** | ❌         | Lightweight, 1 page                                 | ~1 hour   | Referenced in incident-response policy                                                         |
| 3.11 | **On-call / escalation doc**     | ❌         | Even founder-only                                   | ~1 hour   | Who, when, customer comms template                                                             |

**Acceptance:** On-call has a single runbook path from alert → triage → rollback/deploy.

---

## Pillar 4 — Scale to ~100 tenants

_Goal: no surprises when concurrent users and tenant count grow 10×._

| #    | Item                                   | Status      | Target                                            | Effort    | Notes                                                                   |
| ---- | -------------------------------------- | ----------- | ------------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| 4.1  | Pagination past PostgREST 1K cap       | ✅          | —                                                 | —         | `fetchAllPaginated`                                                     |
| 4.2  | Per-tenant write rate limiting         | ✅          | —                                                 | —         | Mig 066                                                                 |
| 4.3  | Composite indexes on hot paths         | ✅          | —                                                 | —         | Migs 064, 262–263, scale sweep #1045–#1049                              |
| 4.4  | **RLS planner hoists (location/device)** | ✅        | `(select …)` InitPlan pattern                     | —         | Migs 265–267 + `lint:rls-perf` CI (#1194)                               |
| 4.5  | **Realtime org-scoping**               | ❌          | Filter subscriptions by `org_id`                  | ~2 days   | [`100-tenants-readiness.md`](100-tenants-readiness.md) §2.3             |
| 4.6  | **RLS performance audit (p95 report)**  | 🟡 Partial  | `pg_stat_statements` + documented results         | ~2 days   | Hot fixes shipped; formal audit + Appendix page open                    |
| 4.7  | **Load test (sandbox)**                | ❌          | 50+ concurrent users, p95 latencies               | ~1 day    | Publish one-page results in Technical Appendix                          |
| 4.8  | **Streaming replica / hot standby**    | ❌ Plan     | Document RPO/RTO; implement when load justifies   | Budget    | Single EC2 + auto-recovery + DLM today; enterprise wants numbers        |
| 4.9  | **Auth rate limits + CAPTCHA**         | ❌          | GoTrue / edge settings                            | ~30 min   | Project-wide auth abuse                                                 |
| 4.10 | **`tenant_seed_starter` RPC**          | ❌          | Non-empty workspace on provision                  | ~2 days   | Today: empty org after create                                           |
| 4.11 | **Paying-customer onboarding runbook** | ❌          | Sales → live tenant                               | ~1 day    | Demo flow ≠ real customer path                                          |
| 4.12 | **Storage quotas**                     | 🟡 Deferred | Per-tenant caps before doc uploads v2             | —         | Track when uploads ship                                                 |
| 4.13 | **`agent_runs` retention**             | 🟡 Open     | Retention window + prune cron                     | ~1 day    | [`scale-hardening-backlog.md`](scale-hardening-backlog.md)              |

**Acceptance:** Load test + RLS audit completed once; results in Technical Appendix.

---

## Pillar 5 — Governance & enterprise compliance

_Goal: answer 80% of a standard SaaS security questionnaire from written artifacts._

| #    | Item                                 | Status           | Target                                                   | Effort     | Notes                                                                                                              |
| ---- | ------------------------------------ | ---------------- | -------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| 5.1  | **Technical Appendix PDF**           | ✅               | 15–25 pp from `docs/`                                    | —          | [`Merlin-Technical-Appendix.pdf`](../deliverables/Merlin-Technical-Appendix.pdf) + `.docx` + `.md`                 |
| 5.2  | **Information security policy**      | ✅               | 2–3 pp                                                   | —          | [`policies/information-security-policy.md`](../deliverables/policies/information-security-policy.md)               |
| 5.3  | **Access control policy**            | ✅               | Named prod admins, MFA                                   | —          | [`policies/access-control-policy.md`](../deliverables/policies/access-control-policy.md)                           |
| 5.4  | **Incident response policy**         | ✅               | Sentry → triage → postmortem                             | —          | [`policies/incident-response-policy.md`](../deliverables/policies/incident-response-policy.md)                     |
| 5.5  | **Change management policy**         | ✅               | PR + CI + deploy on `main`                               | —          | [`policies/change-management-policy.md`](../deliverables/policies/change-management-policy.md)                     |
| 5.6  | **Data retention & tenant deletion** | ✅               | What exists vs deferred                                  | —          | [`policies/data-retention-and-deletion-policy.md`](../deliverables/policies/data-retention-and-deletion-policy.md) |
| 5.7  | **Subprocessor / DPA folder**        | 🟡 Register done | **AWS** · Stripe · Resend · Bedrock · Sentry           | ~1 day     | [`subprocessors/README.md`](../deliverables/subprocessors/README.md) — **refresh off Vercel/managed Supabase**; collect PDFs |
| 5.8  | **GDPR export + hard delete**        | ❌               | EU enterprise blocker                                    | ~1–2 weeks | In [`../reference/deferred.md`](../reference/deferred.md)                                                          |
| 5.9  | **RPC least-privilege narrative**    | ✅               | —                                                        | —          | Migs 257–261 + [`security-deferred.md`](security-deferred.md)                                                       |
| 5.10 | **Oct 30 2026 GRANT audit**          | 🟡 Planned       | Verify all tables before cutover                         | ~1 hour    | [`migration-grant-pattern.md`](migration-grant-pattern.md)                                                         |
| 5.11 | **MFA enforced (prod access)**       | 🟡 Policy only   | AWS · GitHub · Stripe verified                           | ~2 hours   | Audit IAM/root/console + GitHub org settings                                                                       |
| 5.12 | **Pen test or third-party assessment** | ❌             | Scoped annual or pre-enterprise pilot                    | Budget     | Often required for RFPs                                                                                            |
| 5.13 | **Edge WAF**                         | 🟡 COUNT live    | Tune → BLOCK mode                                        | ~2 days    | CloudFront WAF (#1201–#1203); move to block after false-positive soak                                                |

**Acceptance:** Non-engineer investor reads Appendix in 20 minutes and understands risks.

---

## Pillar 6 — Product & commercial readiness

_Series B is traction + unit economics, not only code._

| #   | Item                               | Status               | Target                            | Notes                                                                |
| --- | ---------------------------------- | -------------------- | --------------------------------- | -------------------------------------------------------------------- |
| 6.1 | Stripe LIVE + subscriptions        | ✅                   | —                                 | Executed 2026-05-14                                                  |
| 6.2 | **Paying tenants (10–20+)**        | 🟡 ~8 demo/live orgs | Revenue proof                     | Series B funds growth, not first revenue                             |
| 6.3 | **Self-serve signup**              | ❌                   | `signupEnabled` + empty-state fix | Flag exists, off today                                               |
| 6.4 | **Customer getting-started guide** | ❌                   | 1-pager for new owners            | Reduces support load                                                 |
| 6.5 | **Pricing / unit economics doc**   | ❌                   | Informal markdown OK              | [`100-tenants-readiness.md`](100-tenants-readiness.md) cost forecast |
| 6.6 | **First enterprise pilot**         | ❌                   | Reference customer + case study   | Often required for B round narrative                                 |
| 6.7 | **Support SLA doc**                | ❌                   | Response times by severity        | Even if founder-led today                                            |

---

## Pillar 7 — Enterprise-class on current architecture

_Goal: operate under contract on **self-host Supabase + Lambda/CloudFront** without a rewrite. Maps the “what to improve” list for keeping this stack._

**Architecture decision:** ✅ Keep Path B (self-host Supabase OSS on AWS). Do **not** pursue native AWS rebuild (Cognito/AppSync/BFF) unless procurement explicitly requires it.

| Priority | Item | Pillar | Status |
| -------- | ---- | ------ | ------ |
| **P0** | CloudWatch + Sentry → Slack/PagerDuty | 3.4–3.6 | ❌ |
| **P0** | Live prod backup script fix + dump-freshness alarm | 3.8 | 🟡 |
| **P0** | Subprocessor register refresh (AWS not Vercel) + DPA PDFs | 5.7 | 🟡 |
| **P0** | MFA audit on prod access | 5.11 | 🟡 |
| **P1** | Load test on sandbox + Appendix page | 2.12 / 4.7 | ❌ |
| **P1** | Realtime org-scoping | 4.5 | ❌ |
| **P1** | WAF COUNT → BLOCK | 5.13 | 🟡 |
| **P1** | Staging stack ergonomics (GH workflow or documented ephemeral) | — | 🟡 `deploy-prod` manual (#1143); `infra/staging/` local |
| **P1** | CODEOWNERS + engineer onboarding week | 1.7–1.8 | ❌ |
| **P1** | Customer outage runbook (AWS rollback path) | 3.7 | 🟡 |
| **P2** | Streaming replica / published SLOs | 4.8 | ❌ |
| **P2** | GDPR export + hard delete or dated plan | 5.8 | ❌ |
| **P2** | Pen test letter | 5.12 | ❌ |
| **P2** | Retire dual-stack rollback (managed Supabase/Vercel warm) | — | ❌ |
| **P2** | First enterprise pilot + case study | 6.6 | ❌ |

### 90-day enterprise closure schedule

| Phase | Weeks | Focus | Done when |
| ----- | ----- | ----- | --------- |
| **Ops proof** | 1–2 | Alerts (Sentry + CloudWatch), live dump fix, outage runbook | Alert → triage → rollback documented + tested once |
| **Security pack** | 2–3 | DPA PDFs, MFA audit, WAF → BLOCK, subprocessors refresh | Questionnaire 80% from artifacts |
| **Scale proof** | 4–6 | Load test, realtime org-scoping, RLS p95 report in Appendix | One-page results dated |
| **Team scale** | 6–8 | CODEOWNERS, onboarding doc, knip ratchet | Engineer #2 merges week 2 |
| **Commercial** | 8–12 | Enterprise pilot, provisioning runbook, GDPR plan | Reference customer or explicit timeline |

---

## What you do _not_ need (keep this architecture)

Unless a customer or investor explicitly requires it:

| Avoid | Why |
| ----- | --- |
| **Remove Supabase / native AWS rebuild** | Control already achieved via self-host; rewrite adds months of auth/RLS risk |
| **Microservices split** | RLS-first monolith + Lambda is appropriate to ~100 tenants |
| **Multi-region active-active** | Per-client isolated stack + single-region DR is enough; document honestly |
| **100% E2E or line coverage** | 7–10 hermetic journeys + guard suites is the enterprise sweet spot |
| **SOC 2 Type II (day one)** | AWS Artifact + policies + subprocessors often suffice for pilots |
| **Big-bang strict TypeScript** | Leaf-by-leaf via `@ts-check` + `queries/*.ts` |

---

## 90-day consolidated schedule (historical + remaining)

| Week    | Focus                                                                               | Deliverable                                                              |
| ------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1–2     | ~~**Governance pack**~~                                                             | ✅ Technical Appendix + 5 policies ([`deliverables/`](../deliverables/)) |
| 2       | **Ops proof**                                                                       | 🟡 DR drill done; **open:** alerts + live dump fix                       |
| ~~3–4~~ | ~~Monolith split — Admin + Dashboard~~                                              | ✅ **Done** (#999–#1018)                                                 |
| ~~5~~   | ~~E2E — login + worker Ask~~                                                        | ✅ **Done** (#1014–#1015)                                                |
| ~~6–7~~ | ~~Chat + servicing-content split · E2E breadth~~                                    | ✅ **Done** (#1189, #1102–#1103)                                         |
| ~~—~~   | ~~Frontend Phase 0–3 · format:check · WAF · RLS perf CI~~                            | ✅ (#1100, #1174–#1190, #1201, #1194)                                    |
| **Now** | **Enterprise closure** (see [Pillar 7 schedule](#90-day-enterprise-closure-schedule)) | Alerts · load test · CODEOWNERS · DPA PDFs                               |

---

## Success criteria — “Series B ready” definition

Merlin is **Series B ready** when all of the following are true:

### Engineering

- [x] No frontend _logic_ god-files (Phase 3 complete; page files >2K split when edit-hot)
- [x] **5+ Playwright E2E journeys** in CI (**7 today**)
- [x] Prettier `format:check` blocking in CI
- [ ] Knip blocking in CI
- [ ] `@ts-check` + native TS on 50+ frontend modules (**65 typed modules today** — 43 + 22)
- [ ] Load test executed once; results documented

### Operations

- [ ] Backup restore drill **fully closed** (dated record ✅ 2026-06-28; live dump script + alarm open)
- [ ] Sentry → Slack live; metric alerts configured
- [ ] CloudWatch → Slack for Lambda/cron/EC2/disk/cert/dump-age
- [ ] Customer outage + migration rollback runbooks written (**AWS path**)
- [ ] Realtime subscriptions org-scoped
- [ ] RLS performance audit completed; top issues fixed or documented in Appendix

### Governance

- [x] Technical Appendix PDF matches repo ([`Merlin-Technical-Appendix.pdf`](../deliverables/Merlin-Technical-Appendix.pdf))
- [ ] Subprocessor DPA folder complete (register ✅; **refresh for AWS**; vendor PDFs open)
- [x] 5 lightweight security/ops policies written ([`policies/`](../deliverables/policies/))
- [ ] GDPR export + hard delete **planned or shipped** (if EU GTM)
- [ ] WAF in BLOCK mode after tuning

### Scale & product

- [ ] `tenant_seed_starter` or equivalent — new tenant not empty
- [ ] Paying-customer onboarding runbook
- [ ] **10+ paying tenants** or equivalent ARR narrative (business, not code)
- [ ] First enterprise pilot or case study

---

## Investor one-liner (current state)

> Merlin is ~200K LOC of production B2B SaaS with RLS-first multi-tenancy, **267 versioned migrations**, and a CI pipeline including cross-tenant leak tests, **30 Vitest suites**, and **7 hermetic Playwright journeys**. The full stack runs in **our AWS account** (self-host Supabase + Lambda/API Gateway/EventBridge + S3/CloudFront + WAF). Every API handler reports to Sentry; RPC least-privilege was hardened across migs 257–261; Claude inference runs on Bedrock with per-org spend guards. Frontend Phases 0–3 shipped (React Query, typed client, god-file decomposition). A compliance pack (policies, subprocessors, Technical Appendix) supports enterprise procurement; **remaining gap is operability proof** (alerting, load test, DPA PDFs) — not architecture.

---

## Related docs

| Doc                                                                    | Role                                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| [`code-preparedness.md`](code-preparedness.md)                         | Current-state audit (refreshed 2026-06-29+)               |
| [`professionalization-roadmap.md`](professionalization-roadmap.md)     | Hiring-ready / Series A DD phased plan                    |
| [`100-tenants-readiness.md`](100-tenants-readiness.md)                 | Production scale checklist                                |
| [`engineering-maturity.md`](engineering-maturity.md)                   | Tier 1–4 maturity model                                   |
| [`security-deferred.md`](security-deferred.md)                         | Security backlog                                          |
| [`sentry-alerts.md`](sentry-alerts.md)                                 | Alert rule setup                                          |
| [`../architecture/aws-migration.md`](../architecture/aws-migration.md) | **Executed** AWS migration plan-of-record                 |
| [`../../infra/aws-compute/CICD-SETUP.md`](../../infra/aws-compute/CICD-SETUP.md) | GitHub Actions → AWS deploy                         |
| [`runbooks/backup-restore.md`](runbooks/backup-restore.md)             | DR procedure (post-AWS)                                   |

---

## Maintaining this doc

When an item ships, move it to ✅ and note the PR/migration. When Series B or enterprise DD surfaces a new question, add a row under the relevant pillar. Re-run the success-criteria checklist quarterly or before a fundraise process.

```bash
# Quick sanity checks (run from repo root)
git rev-list --count HEAD
ls supabase/migrations/[0-9]*.sql | wc -l          # migrations
find tests -name '*.test.*' | wc -l               # vitest files
find e2e -name '*.spec.js' 2>/dev/null | wc -l    # playwright specs
wc -l src/app/Admin.jsx src/app/Dashboard.jsx src/app/Chat.jsx src/app/servicing-content.js
rg -l '@ts-check' src --glob '*.{js,jsx}' | wc -l
find src/app/queries -name '*.ts' | wc -l
```
