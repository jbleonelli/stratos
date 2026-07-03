# 100-Tenants Readiness — what's done, what's missing

**Last updated:** 2026-05-17 · **infra substrate note added 2026-06-29** · **Owner:** Adaptiv platform admins

> **⚠️ Stack moved 2026-06-28.** This checklist was written against the **managed Vercel + Supabase** stack. Since then the whole app migrated to **our own AWS account** (`us-east-1`): data → self-hosted Supabase on EC2; compute/API/crons/frontend → Lambda + API Gateway + EventBridge + S3/CloudFront; CI/CD via GitHub Actions. Most scaling concerns below are substrate-agnostic and still apply, but where an item references "Vercel deploy / Vercel cron / Vercel cost," read it as the AWS equivalent (CloudFront+Lambda / EventBridge / AWS bill ~2–4× higher). See [`code-preparedness.md`](code-preparedness.md) §4b + [`aws-migration.md`](../architecture/aws-migration.md).

This is the running checklist for taking Merlin from "demo with five
seeded tenants" to "production SaaS handling ~100 paying tenants" (now on
**self-hosted Supabase + AWS** — see note above). Every entry has a status, a
recommended owner, and a rough effort estimate so it's clear what's
shippable vs what's still architectural.

> **Default sequencing rule:** ship the _cheapest visible-impact_ item
> first, save _expensive infrastructure_ for when usage forces it. The
> goal isn't "everything done" — it's "no surprises at 100 tenants."

---

## ✅ Done — Tier 1 hardening (production-readiness gate)

These shipped between 2026-05-04 and 2026-05-05. They're the items
that would actually break or leak at 100 tenants if left alone.

| #   | Item                                 | What changed                                                                                         | Migration     |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------- |
| 1.1 | Pagination                           | 8 client read sites now walk past the PostgREST 1000-row cap via `fetchAllPaginated`                 | none (client) |
| 1.2 | Sentry error tracking                | Live in prod, errors flow tagged with user_id + org_id + impersonating-state                         | none          |
| 1.3 | Index audit                          | 5 composite (org_id, created_at desc) indexes; ~387x speedup on the firehose query                   | 064           |
| 1.4 | Cross-tenant leak suite              | 34 Vitest assertions running against prod as Lisa Sparkle                                            | none          |
| 1.5 | First-user invite at tenant creation | `platform_create_tenant` now optionally creates an owner invite; back-office surfaces the link       | 065           |
| 1.6 | `SUPABASE_SECRET_KEY` rotation       | Rotated 2026-05-05; new key is `sb_secret_75h...`                                                    | none          |
| 1.7 | Backup + PITR runbook                | `docs/runbooks/backup-restore.md` — drill checklist still needs verification (see Operational below) | none          |
| 1.8 | Per-tenant write rate limiting       | 4 BEFORE INSERT triggers + bucket table; smoke-tested                                                | 066           |

## ✅ Done — Tier 2 (mostly shipped 2026-05-12 to 2026-05-13)

| #   | Item                                                      | What changed                                                                                                             | Migration / PR |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------- |
| 2.2 | Tenant admin writes to allowlisted merlin_config sections | Lisa et al. can now save platform_ads_overrides + feature_flags without RLS denying their upserts                        | 067            |
| 2.4 | Bundle size + code splitting                              | Lazy-loaded 7 routes; main bundle 3.3 MB → 2.5 MB (-25%, -212 KB gzipped)                                                | PR #245        |
| 2.5 | Operational runbooks                                      | Backup + stripe-live-flip + stripe-pro-subscriptions + stripe-agent-addon-setup runbooks all in [`runbooks/`](runbooks/) | various        |

Plus the broader **engineering maturity sprint** (Tiers 1+2 of [`engineering-maturity.md`](engineering-maturity.md)) closed simultaneously: CI gate live, API layer 100% TypeScript, money-path test guards, i18n footgun lint, knip dead-code visibility, PR template. See PRs #239-#259.

---

## 🟡 Open work — Tier 2 (operational comfort)

Two items left.

### 2.4 — Bundle size + code splitting · ✅ shipped 2026-05-12

Lazy-loaded `PlatformApp`, `Operations`, `Reports`, `Insights`, `Agentic`, `Innovate`, `WorkerApp` (PR #245). Main bundle 3.3 MB → 2.5 MB; gzipped -212 KB. **NOTE:** the 2026-05-14 prod outage was caused by re-introducing `manualChunks` on top of these splits — that approach is now banned, see [`memory/session-2026-05-14.md`](../../.claude/memory/session-2026-05-14.md).

### 2.1 — RLS performance audit · ~3–4 days

Tier 1.3 fixed the hot paths I knew about. This is the data-driven
sweep: turn on `pg_stat_statements`, look at p95 query times after a
week of real traffic, optimize the next layer of slow queries.

Specific known concerns to revisit:

- **`device_events` and `agent_runs` full-table scans time out** under
  contractor RLS evaluation (`is_contractor_on_location` is expensive
  per-row). Production never queries them unfiltered, but if anyone
  wires up an unbounded read, it'll hit the timeout. Consider
  materializing a contractor-locations cache or moving the contractor
  bypass into a different policy shape.
- **`has_location_access` Band 2** ("user has no grants → full access
  in own org") is convenient but means a future RLS audit could miss a
  leak path that depends on the absence of grants. Worth revisiting.

**Owner:** Claude with JB on data interpretation. **Risk:** low
(read-only audit; index/policy tweaks are reversible).

### 2.5 — Operational runbooks · ✅ partial · ~1 day remaining

Backup ✅, Stripe live-mode flip ✅, Stripe Pro subscriptions setup ✅, Stripe agent add-on setup ✅. Still missing:

- **Tenant onboarding** — full step-by-step from sales handoff to
  paying-customer-using-the-app. Today there's tribal knowledge. `/platform/marketing/demo` covers the demo-bundle flow but not the real paying-customer path.
- **Customer outage triage** — how to read Sentry, how to check
  Supabase project health, how to roll back a Vercel deploy. **PARTIAL:** the 2026-05-14 outage retro in [`memory/session-2026-05-14.md`](../../.claude/memory/session-2026-05-14.md) is the closest thing today.
- **Migration rollback** — if a SQL migration broke prod, what's the
  recovery path? (PITR + replay forward? `pg_dump` of just affected
  tables?)
- **Hard delete a tenant** — soft-delete is in the back-office
  already; full purge (data + storage + auth.users + cascading FKs)
  is currently manual SQL.

**Owner:** mostly Claude (drafts) + JB (validates against actual ops).

### 2.3 — Realtime channel scoping · ~2 days

Supabase Realtime subscriptions are subscribed at module scope and
not org-filtered. At 100 tenants × ~5 channels per active browser =
500 simultaneous channels. Within Supabase limits (Pro = 200, Team = 500) but right at the edge. Filtering by `org_id` in each subscription
ensures each browser only consumes events for its own tenant —
both for performance and to avoid edge-case cross-tenant noise.

**Files to touch:** `agent-runs.js`, `event-firehose.js`,
`devices-store.js`, `merlin-asks.js`, anywhere that calls
`supabase.channel(...)`.

**Owner:** Claude. **Risk:** low (additive filter).

### 2.6 — Supabase Team tier upgrade · ~$575/mo cost decision

Pro tier ($25/mo) gets us 8 GB DB + 7-day PITR. Team tier ($599/mo)
unlocks 30-day PITR, SOC 2 inheritance, daily backups across regions,
24/7 support. Likely needed once we cross **5–10 paying tenants** OR
when the first customer asks for compliance documentation.

Not needed yet — Pro is fine for the demo phase. Just plan the
budget line.

**Owner:** JB.

---

## 🟠 Other gaps surfaced during the work

These came up while doing Tier 1 + Tier 2.2 and aren't on the original
tier list. Most are real production blockers if left alone.

### Tenant creation produces an empty workspace

The new `platform_create_tenant` RPC creates an `organizations` row + an
optional invite, but the resulting workspace has **no buildings, no
locations, no team_members, no default merlin_config**. The first
owner who accepts the invite lands in a blank app. Today JB seeds
each new tenant with custom SQL.

**What's needed:** a `tenant_seed_starter(org_id, scenario)` RPC that
creates a minimal-viable workspace (1 building with a few zones, a
default agent config, etc) at provisioning time. Pattern already
exists for demo orgs (`/api/seed-demo-scenario`) — adapt it for
real-customer onboarding.

**Effort:** ~2 days. **Owner:** Claude.

### Simulator can't run for non-platform-admin users

`agent_runs`, `device_events`, `device_requests`, `device_visits`,
`device_service_sessions` have NO customer-side INSERT policy after
Phase 5 — only `is_platform_admin()` can write. **For production this
is correct** (those tables get written by Vercel cron jobs using
`service_role` which bypasses RLS). **For the in-browser simulator**
used in demos, it means only JB can drive the simulator end-to-end.
Other demo users (Lisa, Robin) see static data.

**What's needed:** decide whether the simulator should keep running in
the browser long-term, or move entirely to server-side cron. If it
stays browser-side, add narrow customer INSERT policies; if it moves
server-side, drop the browser code.

**Effort:** depends on direction. ~2 days for a server-side move.

### No CI — tests run locally only · ✅ shipped 2026-05-12

CI gate live ([PR #240](https://github.com/jbleonelli/merlin/pull/240)): build · test · typecheck(api) · lint(i18n) · lint(dead code, informational). Runs on every PR + push to main. See [`engineering-maturity.md`](engineering-maturity.md) Tier 1.1.

### No alerting on Sentry · 🟡 partial

Sentry alert rules are surveyed + drafted in [`sentry-alerts.md`](sentry-alerts.md). Implementation in Sentry UI is the remaining step.

**What's needed:** Sentry → Slack integration. Doc has step-by-step
config for 4 recommended alert rules + 3 inbound filters.

**Effort:** ~1 hour. **Owner:** JB (Slack integration).

### Backup drill never actually run

The runbook in `docs/runbooks/backup-restore.md` describes the
procedure, but a real PITR restore to a sandbox project hasn't been
attempted. Plenty of teams discover their backups don't work during
the actual outage.

**What's needed:** ~30 minutes of JB's time, following the drill
checklist in the runbook.

**Effort:** ~30 min. **Owner:** JB.

### No load testing

We don't know empirically what breaks at 100 tenants × N concurrent
users. Indexes and rate limits are in place; whether they're sized
right is theoretical.

**What's needed:** a basic k6 / Artillery script that simulates 50
concurrent signed-in users hitting Briefing + Operations + a few
back-office actions. Run against a sandbox restore (NOT production).

**Effort:** ~1 day for a meaningful first run. **Risk:** medium
(could surface real blockers).

### Storage growth is unbounded

The `product-ads` bucket has a 10 MB-per-file cap (migration 051) but
no per-tenant or total quota. A future per-tenant document upload
feature would need quota enforcement before it ships.

**What's needed:** nothing today (no per-tenant uploads exist beyond
profile pictures + ad images). Track for v2.

### Auth-flow rate limiting

Per-tenant write rate limiting is in (1.8). Sign-in / password-reset
abuse is governed by Supabase's project-level rate limits, which are
shared across all tenants. A single attacker hammering one
account could exhaust the project's auth quota and degrade sign-ins
for everyone.

**What's needed:** Supabase has CAPTCHA + per-IP rate limiting
options under Auth → Rate Limits. Worth turning on before public
launch. Free, just config.

**Effort:** ~30 min. **Owner:** JB.

### Tenant onboarding email isn't automated · ✅ partial

The back-office "create tenant" flow + `/platform/marketing/demo` both now send branded transactional email via **Resend** (sender `noreply@adaptiv.systems`). Adaptiv-branded HTML templates for Supabase Auth's 6 transactional emails are stored in [`auth-email-templates.md`](auth-email-templates.md). Demo-invite emails carry EN/FR PDFs and per-demo quick-start.

**Still open:** the "real paying-customer welcome email" flow at signup is gated until the public signup flag flips on (currently `signupEnabled=false`).

### Customer onboarding documentation

No `docs/getting-started-customer.md` for a new owner who just
accepted an invite. They land in a blank workspace and have to figure
out the model. A 1-page "welcome to your Merlin workspace" guide
would dramatically reduce support load.

**Effort:** ~half day. **Owner:** Claude (drafts) + JB (voice/tone).

---

## 🔵 Operational tasks for JB (no code)

Things only JB can do, listed in priority order:

1. **[~30 min] Run the backup drill.** See `docs/runbooks/backup-restore.md`.
2. **[~30 min] Set up Sentry → Slack.** Errors are captured but unwatched.
3. **[~30 min] Turn on Supabase auth-flow rate limits + CAPTCHA.** Settings → Auth → Rate Limits.
4. **[~1 hour] Document tenant pricing model.** Even informally — a markdown file with "v1 is sales-led, target ARR per tenant is $X, comparable products charge Y" so the next pricing decision has a baseline.
5. **[plan] Decide on Supabase tier upgrade trigger.** "When we hit Z paying tenants" or "when first customer asks for SOC 2."
6. **[plan] First customer signup flow walkthrough.** Sit down for an hour, pretend you're a new customer, click through provisioning → invite → workspace empty-state → first SLA. Note every friction point. Most will surface as small docs gaps or seed-data tweaks.

---

## 🟣 Already deferred — see [`../reference/deferred.md`](../reference/deferred.md)

The full v2 list lives there. Several big themes have shipped since this doc was first written:

- **Stripe / commercial layer** — ✅ **LIVE** as of 2026-05-14. Pro subscriptions, agent add-on, data-source overage, Customer Portal all wired. Plus Stripe Products CRUD at `/platform/stripe/products`. DB-managed `subscription_skus` catalog (migration 128) replaces env var price IDs.
- **Self-serve signup** — flag exists (`signupEnabled`) but currently OFF; flips on at public launch.
- **Custom domains / subdomain-per-tenant** — still deferred
- **Per-tenant resource quotas** — still deferred (overage billing on data sources is the first wedge of this)
- **GDPR data export + delete** — still deferred (required for EU customers)
- **Platform identity hardening** — partially addressed via `is_platform_admin()` keying off Adaptiv-org membership; Adaptiv employees still live as `profile` rows but the gate is explicit.

---

## 💰 Cost forecast at 100 tenants

Today's bill is roughly:

- Supabase Pro: $25/mo
- Vercel Hobby/Pro: ~$20/mo (depending on traffic)
- Sentry: free (under 5K errors/mo)
- Anthropic API: variable, depends on chat usage
- **Total: ~$50–75/mo**

At 100 tenants, expect:

- Supabase Team: ~$599/mo (DB + extra connections + 30-day PITR)
- Vercel Pro: $20/mo + traffic + function invocations (~$50–100 likely)
- Sentry Team: $26/mo (cross 5K errors/mo)
- Anthropic API: scales with usage (could be $500–2,000/mo at 100 active tenants doing chat)
- **Total: ~$700–2,800/mo**

Margin question: are we charging enough per tenant to cover this +
support cost + engineering time? See "Document tenant pricing model"
above.

---

## How to use this doc

When something here ships, move it from 🟡/🟠 to ✅ and note the
migration/commit. When new gaps surface during real customer use,
add them under 🟠 with effort + owner + risk. When something gets
deferred, move it to `docs/deferred.md`.

Sequencing rule from the top still applies — pick the cheapest
visible-impact item first.
