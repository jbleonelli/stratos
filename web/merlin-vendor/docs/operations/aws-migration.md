# AWS migration plan — self-host Supabase on AWS (Path B), parallel-path

> ## 🟢🟢 DONE — LIVE IN PROD 2026-06-28
>
> Both layers are off their original vendors and on our AWS account. **Data** runs on the self-host Supabase (`merlindb.adaptiv.systems`, EC2, us-east-1). **Compute** (the app, API, crons, frontend) runs on Lambda + API Gateway + EventBridge + S3/CloudFront — `merlin`/`mobile`/`excalibur`.adaptiv.systems serve from CloudFront. Vercel and managed Supabase remain as warm rollbacks. See the Status section + [`aws-cutover-runbook.md`](aws-cutover-runbook.md) (data) and [`infra/aws-compute/README.md`](../../infra/aws-compute/README.md) (compute). The text below is the original plan-of-record, kept for the rationale and decision trail.

The plan of record for consolidating Merlin into our own AWS account. **Driver: control / consolidation** (everything in one account, single vendor). **Approach: self-host the Supabase open-source stack on AWS** — not a from-scratch native rebuild. **Strategy: parallel-path** — built the AWS stack alongside live prod, kept the current database as the single source of truth until a final discrete cutover. **Home region: `us-east-1`.** **Deployment model: a reusable Terraform module instantiated as per-client isolated stacks** (see below) — our managed SaaS is instance #1.

Related: [`code-preparedness.md`](code-preparedness.md), [`scale-hardening-backlog.md`](scale-hardening-backlog.md). LLM inference runs on Amazon Bedrock behind `CLAUDE_PROVIDER=bedrock` — that layer is done. **Note:** prod is currently `eu-central-1` (EU residency); the US move switches Bedrock to `us-east-1` + `us.anthropic.*` inference profiles, so **data residency becomes per-deployment** rather than globally EU (an EU client gets an EU-region dedicated stack).

---

## Phase 0 finding: cost (recorded 2026-06-27)

Cost was the original stated driver, so we modelled it first on real usage:

- **DB: 865 MB / 100 tables** (tiny). **Bedrock: ~$0.25/day ≈ $7.50/mo** (demo `replay_mode` keeps it near-zero). 18 crons (8 per-minute), 134 functions — invocation volume inside Lambda's free tier.
- **Native AWS would cost ~$145–215/mo** (Aurora floor ~$43 + Fargate for self-hosted services ~$45–90 + RDS Proxy ~$11 + NAT ~$32 + …) **vs. Supabase Pro ~$25 + Vercel ~$20–40 today.**

**Conclusion: at this scale a migration _increases_ monthly spend ~2–4×**, because Supabase bundles managed Postgres + PostgREST + Auth + Realtime + Storage into ~$25 that we'd unbundle into separately-billed AWS infra. **Cost is therefore NOT the justification.** JB confirmed the real driver is **control / consolidation** (own account, single vendor) — the higher cost is an accepted trade. Re-run this model at materially larger scale.

---

## Why Path B (self-host Supabase) over Path C (native rebuild)

Both end with everything in our AWS account. The difference is cost-of-getting-there:

|                | **Path B — self-host Supabase OSS**                      | **Path C — native rebuild**                             |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| App changes    | **~zero** — `supabase-js`, RLS, auth, realtime unchanged | rewrite auth→Cognito, realtime→AppSync, every data call |
| Auth/RLS risk  | **none** — same GoTrue + `auth.uid()`                    | high — re-source identity across 100+ RLS tables        |
| Effort         | weeks                                                    | months                                                  |
| Ongoing burden | operate the Supabase containers (upgrades/backups/HA)    | operate native services                                 |

**Chosen: Path B.** Supabase is open source; its whole stack runs as containers, so we lift it into our AWS account and keep the entire API surface — preserving RLS verbatim, which is the security backbone.

**Sub-option worth pricing first: Supabase BYOC / Enterprise** — Supabase can run _their_ managed stack inside _our_ AWS account/VPC. That satisfies "everything in our account" with **zero self-host ops burden**. If the consolidation goal is account/VPC ownership (not running it ourselves), BYOC may beat self-hosting outright — get a quote before committing to self-managed.

---

## Deployment model — per-client isolated stacks

The migration target isn't a single SaaS install; it's a **reusable, parameterized deployment unit** we instantiate per client. Each client gets a **fully isolated stack** (own VPC, own DB, own Supabase, own domain, own region) **inside our AWS account(s)**, which we operate. Our managed multi-tenant SaaS is just **instance #1** of the same module.

- **One Terraform module**, instantiated per client via a var-file: `terraform apply -var-file=clients/acme.tfvars` (vars: client id, **region**, sizing, domain). **Isolated state per client** (separate state file/key — never shared).
- **Region is a per-client variable** → residency is satisfied per deployment (US client → `us-east-1`; EU client → an EU region with `eu.anthropic.*` Bedrock profiles). Make `claudeModel()` derive the geo prefix (`us.`/`eu.`) from `AWS_REGION` so each stack self-configures — a small refactor of the Bedrock client.
- **Single-tenant by construction**: the app is already org-scoped, so a dedicated stack is simply "one client's org(s), alone" — no app rearchitecture. ⚠️ The `/platform` Excalibur back-office (cross-org admin/impersonation) is **SaaS-only**; a dedicated client stack ships the customer app, not the platform console.
- **Containers ⇒ portable**: because the stack is the Supabase OSS containers + the app, the same unit could later run on a client's own hardware (docker-compose) for an air-gapped tier — not in scope now (clients run in our AWS), but the design doesn't preclude it.
- **The Phase 0 PoC is the seed** of this module (`infra/aws-supabase-poc/`, region already a var). Phase 1 hardens it into the parameterized module (RDS, ECS, TLS, Secrets Manager, per-client state).

---

## Current stack

| Layer                      | Today                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| LLM                        | **Bedrock** `eu-central-1` — ✅ already AWS                                                                        |
| Hosting/compute            | Vercel — Vite SPA + **134 serverless fns** + **18 crons** (8 per-minute)                                           |
| Data/auth/realtime/storage | **Supabase** — Postgres (865 MB, **268 migrations**), GoTrue auth, RLS on 100+ tables, Realtime, 7 Storage buckets |
| Ancillary                  | Stripe, Resend, Sentry                                                                                             |

## Target architecture (Path B)

| Piece                                       | Target                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| SPA                                         | S3 + CloudFront + Route 53 + ACM                                                                                           |
| 134 fns                                     | Lambda + API Gateway (one Vercel→Lambda adapter shim; all share `wrapHandler`)                                             |
| Crons                                       | EventBridge Scheduler → Lambda (`cron-auth.ts` gates)                                                                      |
| Postgres                                    | **RDS / Aurora Postgres** (restore the 268 migrations + data) + Supavisor/RDS Proxy pooling                                |
| PostgREST + GoTrue + Realtime + Storage API | **Supabase OSS containers on ECS/Fargate** behind an ALB (Kong gateway)                                                    |
| Storage backend                             | **S3** (Supabase Storage API points at S3)                                                                                 |
| Secrets                                     | JWT secret + anon/service keys in Secrets Manager — **reuse the existing JWT secret** so issued tokens/sessions stay valid |
| App config                                  | `supabase-js` `SUPABASE_URL`/`ANON_KEY` → our Kong gateway URL — an **env change, not a code change**                      |
| IaC                                         | Terraform or AWS CDK — entire stack as code (tool TBD with JB)                                                             |

---

## Parallel-path strategy

Build and prove the AWS stack against **real prod data** with **zero risk**, cut over one reversible layer at a time.

- **Stateless (SPA, fns, crons, storage): parallel freely.** AWS as IaC in a separate stack; served under `aws.merlin.adaptiv.systems`; DNS flip when proven; rollback = flip DNS back.
- **Database/auth: keep SaaS Supabase as the single source of truth** until a final discrete cutover. Never run two live DBs (split-brain).
- **Linchpin:** during the parallel phase, point AWS compute (and even the self-hosted Supabase containers) at the **existing SaaS Supabase Postgres** over its **pooled (Supavisor/PgBouncer)** connection — full validation, no data migration, no risk. The DB move to our RDS is the last step, with SaaS Supabase as rollback.

### Gotchas to bank

1. **Crons run on ONE side only** — 18 crons (8 per-minute) firing on both Vercel + EventBridge = double agent ticks / double Claude spend / double billing. Vercel authoritative until cutover.
2. **Reuse the GoTrue JWT secret + anon/service keys** in the self-hosted stack, or every existing session/token is invalidated and `supabase-js` clients break.
3. **Storage migration** — copy the 7 buckets' objects to S3 and point Supabase Storage API at the S3 backend; update any hardcoded `*.supabase.co` object URLs.
4. **Realtime** needs the `supabase_realtime` publication + `REPLICA IDENTITY` carried over (see [[supabase_gotchas]] — `payload.old` is PK-only by default).
5. **Self-host = we own upgrades/patching/backups/HA** — the thing SaaS handled. Budget ops time (or use BYOC).
6. **Lambda → Postgres uses the pooler**, not the direct connection, or Lambda storms the DB.

---

## Phases (reversible-first, DB cutover last)

| Phase                      | Scope                                                                                                                                                                                                         | Risk           | Reversible?        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------ |
| **0 — PoC**                | Stand up the Supabase OSS stack on AWS (ECS/Fargate + RDS) in our account; restore a schema dump; validate **login, RLS row-scoping, a realtime subscription, a Storage round-trip**. Price BYOC in parallel. | none (scratch) | n/a — **go/no-go** |
| **1 — Static + storage**   | SPA → S3/CloudFront; buckets → S3                                                                                                                                                                             | low            | yes (DNS)          |
| **2 — Compute**            | 134 fns → Lambda, crons → EventBridge (disabled), behind the adapter shim; **still pointing at SaaS Supabase data**                                                                                           | low–med        | yes (DNS)          |
| **3 — Data plane cutover** | Migrate Postgres → our RDS/Aurora; point self-hosted Supabase + compute at it; flip. SaaS Supabase = rollback.                                                                                                | **high**       | window + rollback  |
| **4 — Decommission**       | turn off Vercel + SaaS Supabase; EventBridge crons authoritative                                                                                                                                              | —              | —                  |

## Phase 0 — PoC recipe & exit criteria

PoC steps (JB runs the AWS provisioning; agent authors IaC + commands):

1. RDS/Aurora Postgres in a VPC; `pg_dump` the SaaS schema (or a redacted subset) → restore.
2. Supabase OSS stack on ECS/Fargate (or one EC2 for the spike) — GoTrue, PostgREST, Realtime, Storage, Kong — **reusing the prod JWT secret**, pointed at the RDS instance.
3. Point a local/staging `supabase-js` at the Kong URL + anon key.

**Exit criteria (all true → greenlight):**

- A user logs in (GoTrue), and `supabase.from(<org-scoped table>)` returns **only their org's rows** — RLS via `auth.uid()`/`current_user_org()` behaves identically to prod (fail-closed on no-grant).
- A `supabase.channel()` realtime subscription fires on an insert.
- A Storage upload/download round-trips against the S3 backend.
- BYOC quote obtained and compared to self-host ops cost.

---

## Risk register

| Risk                                                  | Severity     | Mitigation                                                                   |
| ----------------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| Two live DBs diverge                                  | **Critical** | one source of truth; DB cutover is the last discrete step                    |
| JWT secret/keys not reused → all sessions break       | High         | carry the exact GoTrue secret + anon/service keys into the self-hosted stack |
| Self-host ops burden on a solo team                   | High         | price BYOC as the zero-ops alternative; budget ops time if self-managing     |
| Realtime/Storage misconfig breaks events/chat/uploads | High         | validate both explicitly in Phase 0; carry publication + REPLICA IDENTITY    |
| Crons double-fire across stacks                       | Med          | AWS crons disabled until cutover                                             |
| 268 migrations don't restore cleanly                  | Med          | dry-run restore into scratch RDS in Phase 0                                  |
| Monthly cost up ~2–4×                                 | Accepted     | documented; control/consolidation is the driver, not cost                    |

---

## Status

- **2026-06-27** — Driver confirmed = control/consolidation (cost model showed a migration costs more — accepted). Approach chosen = **Path B, self-host Supabase on AWS**. Home region **`us-east-1`**; per-client isolated stacks. IaC = **Terraform** (`infra/aws-supabase-poc/`).
- **2026-06-27 — ✅ Phase 0 PoC = GO.** Stood up the Supabase OSS stack on EC2 in our AWS (`us-east-1`) via the scoped `merlin-migration` profile. **All four checks passed** with synthetic data (no prod dump): Auth (GoTrue sign-in), **RLS row-scoping** (authed user → only their org's rows via the `auth.uid()`→`current_user_org()` chain; anon → none), Realtime (WS `HTTP 101`), Storage (bucket→upload→download round-trip). Path B verified end-to-end; app cutover is an env-swap, not a rewrite. Gotchas captured in the PoC README. Spike instance running (~$2/day) — destroy when done.
- **2026-06-27 — schema-compatibility dry-run (bonus).** Replayed the repo's 264 migration files against the self-host Postgres: **217 applied clean; 47 failed — all seed-data/ordering artifacts, zero structural incompatibilities.** Failures are (a) demo-seed `INSERT`s referencing prod rows absent from an empty DB (orgs/users/devices — e.g. "organization_id=Meridian not present"), and (b) cascades amplified by per-migration transaction wrapping rolling back good DDL alongside a failed trailing seed. **Confirms the cutover method: `pg_dump` prod (schema + data together) → restore, NOT migration-replay** — the dump carries parent rows so these FK/seed failures don't arise. No self-host/Postgres feature gap found.
- **2026-06-27 — Phase 1 slice 1 DONE** (PR #1116): reusable per-client module at `infra/aws/` (`modules/supabase-stack` + `clients/<name>.tfvars` + isolated state). `terraform validate` passes; not applied.
- **2026-06-27 — DB-host finding (supersedes "RDS" in this plan):** ⚠️ **RDS/Aurora cannot host the Supabase self-host stack** — prod uses `supabase_vault` (Supabase-only, absent on RDS) and the init scripts/services assume the `supabase/postgres` image (extensions, roles, `_supabase`/`_realtime` schemas). **Revised slice 2 = keep the `supabase/postgres` container, give it a persistent EBS volume for `volumes/db/data` + nightly `pg_dump` to S3** (EC2 instance role). Full compatibility, still entirely in our AWS; trades RDS-managed backups for EBS-snapshot + dump backups. (Everywhere this doc says "RDS/Aurora," read "durable supabase/postgres container.")
- **2026-06-27 — Phase 1 slice 2 DONE & validated live** (PRs #1118/#1119): durable Postgres on a dedicated **persistent EBS volume** + **nightly `pg_dump`→S3** via an EC2 instance role. Verified end-to-end (PG on the volume, services healthy, backup object in S3), then torn down. Known follow-ups: `supabase-pooler` crash-loops (non-blocking); full instance-replace durability test not run. IAM on `merlin-migration` was broadened (region-scoped power policy) to enable slices 2+.
- **2026-06-27 — roadmap re-scoped:** ECS/Fargate **dropped** (Fargate can't use EBS → poor for stateful Postgres; per-client = one box, so orchestration buys little). One hardened EC2 per client is the topology. Revisit ECS only for a client needing HA/scale.
- **2026-06-27 — TLS slice AUTHORED** (PR #1121, not yet applied): per-client public HTTPS via **Caddy + auto Let's Encrypt** + a stable **Elastic IP** + optional `domain` var (no ALB/ACM/Route53 dependency). To activate: apply → point the `domain` A record at the EIP (`terraform output dns_record`) → Caddy issues the cert.
- **2026-06-28 — Phase 1 slice: PG17 pin (PR #1125).** Pinned the self-host clone to a fixed `supabase/supabase` commit (`supabase_ref`, ships `supabase/postgres:17.6.1.136`) instead of floating `master`, + a belt-and-suspenders `postgres_image` `sed` of the compose db image. Closes the rehearsal gate (prod is PG 17.6 → target must be PG17). Also fixed an SG ingress description with a non-ASCII `→` (TLS slice carried it; rejected by AWS) that `terraform plan` surfaced. Secrets Manager slice validated incidentally (every apply now fetches secrets at boot via the instance role).
- **2026-06-28 — ✅ CUTOVER REHEARSAL = SUCCESS (the capstone Phase 1 goal).** Applied the per-client stack HTTP-only, confirmed the running DB is **PG 17.6 on the persistent EBS volume**, dumped the **868 MB** prod DB (`pg_dump -Fc` over the session-mode pooler `:5432` → 85 MB), restored into the pinned self-host, and verified the app via the Kong gateway. Then torn down (14 resources destroyed). **Thesis proven against real prod data: cutover = env-swap, not a rewrite.** Restore runbook below.
- **2026-06-28 — ✅ TLS SLICE VALIDATED LIVE.** Applied the stack with `domain` set, pointed a DNS A record at the Elastic IP, and Caddy auto-issued a publicly-trusted **Let's Encrypt** cert (`CN=aws-poc.adaptiv.systems`, 90-day, `ssl_verify=0`); gateway answered over TLS (401 Kong = proxy chain works) and port 80 **308-redirects** to HTTPS. Then torn down. ⚠️ **DNS gotcha:** the live `adaptiv.systems` Route 53 zone is in a **different AWS account** than the migration account (`112039069587`) — the `merlin-migration` profile only sees a stale, non-delegated **shadow zone** (`Z2G9F8J32ZUDXA`, NS don't match the delegated set), so the A record must be created in the live zone by whoever owns it (not automatable from the migration profile). For real client stacks that want self-wiring Route 53 records, the module needs the live `hosted_zone_id` + cross-account access.
- **2026-06-28 — 🟢🟢 PHASE 3 DATA CUTOVER EXECUTED & LIVE IN PROD.** Big-bang cutover ran: write-freeze → `pg_dump`→restore (excl. storage) → storage API-to-API migrate (5,509 blobs via `scripts/migrate-storage.mjs`) → 12 storage RLS policies (`infra/aws/storage-rls-policies.sql`) → flip the 4 Vercel env vars → smoke → lift. Merlin's data layer now runs on the self-host at **`merlindb.adaptiv.systems`** (EC2 `m6i.xlarge`, EIP `32.197.171.128`, us-east-1). Users re-logged-in once (self-host uses fresh HS256 keys; prod's ES256 signing key couldn't be exported). One live scare fixed in-window via **mig 265** (RLS subselect hoist; 15.8s→1.5s). Managed Supabase = untouched warm rollback. Full runbook + lessons: [`aws-cutover-runbook.md`](aws-cutover-runbook.md).
- **2026-06-28 — 🟢🟢 PHASE 2 COMPUTE CUTOVER EXECUTED & LIVE IN PROD (#1141).** The app itself moved off Vercel onto AWS — **zero downtime, DNS-flip cutover**. IaC at [`infra/aws-compute/`](../../infra/aws-compute/) (4 slices): (1) `merlin-api-saas` Lambda (`nodejs22.x`, arm64) serving all 72 `api/` endpoints behind an HTTP API, Secrets-Manager-before-import bootstrap; (2) 18 Vercel crons → EventBridge Scheduler → `merlin-cron-saas` Lambda; (3) SPA on private S3 + CloudFront (`/api/*`→API Gateway, default→S3, edge-function SPA routing + excalibur→/platform redirect); (5) ACM cert + custom domains. `merlin`/`mobile`/`excalibur`.adaptiv.systems flipped Vercel→CloudFront; AWS crons enabled + Vercel crons disabled. **App + data now 100% on our AWS.** Compute runbook + cutover gotchas (CNAME→Vercel CAA block; cross-account Route 53 alias via CLI) in [`infra/aws-compute/README.md`](../../infra/aws-compute/README.md).
- **Rollbacks still warm:** managed Supabase (data, paused/untouched) + the Vercel project (compute, crons disabled, DNS pointed away). Both are a DNS/env flip back, no rebuild.
- **Next:** soak → retire the Vercel project · GitHub Actions deploy (today = `node build.mjs` + `terraform apply` + `deploy-spa.sh`) · downsize Lambda memory (142 MB used of 1024) · decide first real per-client stack vs. managed-SaaS-only · (optional) opt-in Route 53 record resource for client zones we control.

---

## Cutover restore runbook (validated 2026-06-28)

Restoring a prod (managed Supabase) dump into the self-host. Both sides run `supabase/postgres:17.6.1.136`, so internal-schema drift is minimal. **Order matters** (FK deps) and the only conflicts are benign + predictable.

1. **Dump prod** (read-only; session-mode `:5432`, NOT the transaction pooler `:6543` — `pg_dump` needs a session): `pg_dump -Fc --no-owner --no-privileges -d "$PROD_URI" -f prod.dump`.
2. **Ship it in**: `scp prod.dump` → instance → `docker cp prod.dump supabase-db:/tmp/`.
3. **Restore, in this order** (`pg_restore -U supabase_admin -d postgres --no-owner --no-privileges`):
   - `--data-only --disable-triggers --schema=auth` — carries identities **first** so `public` FKs to `auth.users` validate. (1 benign error: `auth.schema_migrations` dup-key — the target's own GoTrue tracker; leave it.)
   - `--data-only --disable-triggers --schema=storage` — (1 benign error: `storage.migrations` dup-key — same pattern.)
   - **Pre-create the app schemas** the init doesn't own: `CREATE SCHEMA IF NOT EXISTS demo_fixtures; CREATE SCHEMA IF NOT EXISTS supabase_migrations;` (⚠️ `pg_restore --schema=X` restores objects _into_ X but never emits `CREATE SCHEMA`; `public` only worked because it always pre-exists).
   - `--schema=public` — restores **0 errors** (the bulk: 100 tables + data + FKs).
   - `--schema=demo_fixtures` then `--schema=supabase_migrations`.
   - **Exclude** `realtime`, `vault`, `extensions`, `graphql*`, `pgbouncer` — the self-host init/services own these; carrying them desyncs the services.
4. **Verify** through the Kong gateway (`http://<ip>:8000`): GoTrue password login (auth.users hashes carried in the dump authenticate), then a PostgREST read of an org-scoped table — anon → 0 rows, authed → only the user's grant-scoped rows (RLS via `auth.uid()` behaves identically to prod).
5. ⚠️ **Day-of-cutover deltas (NOT exercised by the rehearsal):** reuse the **real prod JWT secret + anon/service keys** (else live sessions break); copy the 7 **storage buckets' objects** to S3 (rehearsal carried only `storage.objects` metadata, not blobs); carry the **`supabase_realtime` publication membership** (excluded here, so realtime broadcast won't fire); decrypt-and-recreate any **`vault.secrets`** the app reads (vault root key differs per stack).
