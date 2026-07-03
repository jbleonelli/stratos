# Deferred security tasks

Snapshot of every known security-relevant item that is **not done yet**, with severity, why it's parked, and the signal that should promote it back to active work. Compiled 2026-05-13 from the Supabase Security Advisor scan; **refreshed 2026-06-21** after the post-audit hardening sprint (migs 257–259, PRs #984–#988).

Pure operational debt (UX polish, performance, code organization) lives in [100-tenants-readiness.md](100-tenants-readiness.md) and [engineering-maturity.md](engineering-maturity.md). This doc is the **security-only** view.

## Severity legend

- 🔴 **Critical** — actively exploitable today; should ship in the next session
- 🟠 **High** — real risk but no known exploit path; ship within 30 days
- 🟡 **Medium** — hardening / best practice; ship within 90 days
- 🟢 **Low** — by-design or already-mitigated; ship if there's spare time

## Hard deadlines

| Deadline       | What                                                                                                                                                                                 | Owner |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| **2026-10-30** | Supabase Data API auto-grant removed on existing projects (see [migration-grant-pattern.md](migration-grant-pattern.md)). Audit all `public` tables for explicit grants before then. | JB    |

## Deferred items by category

### 1. Supabase Security Advisor warnings (still open after 2026-05-13 sweep)

The 2026-05-13 advisor run closed both ERROR items (security_definer views via migration 113) and the leaked-password warning (toggle flipped in Supabase Auth). 129 items remain — all WARN-level.

#### 🟢 1.2 — SECURITY DEFINER RPC least-privilege — substantially closed 2026-06-21 (migs 257–259)

The advisor flags every SECURITY DEFINER function executable by `anon` or `authenticated`. Merlin historically had ~100 such functions — by-design for client RPCs and RLS policy helpers. A **three-phase hardening sprint** (PRs #984–#988) reduced the client-callable surface without breaking app flows:

| Phase | Migration | What                                                                                                                                                                                                                                                                                                  |
| ----- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **257**   | Revoke client EXECUTE on 16 trigger functions (never meant to be RPC'd); pin `search_path` on 19 flagged helpers; scope `ticket-photos` storage LIST to caller's org folder                                                                                                                           |
| 2     | **258**   | Revoke `anon` EXECUTE on 37 admin/write client RPCs → authenticated only; 11 genuinely-public RPCs retain anon (device viewer, branding, signup). Promoted from [`docs/security/revoke-public-execute.DRAFT.sql`](../security/revoke-public-execute.DRAFT.sql) after prod privilege-matrix validation |
| 3     | **259**   | Lock 33 internal-only DEFINER functions to `service_role` only (cron/replay/webhook/order/rate-limit paths)                                                                                                                                                                                           |

**Still callable by clients (intentional):** ~19 RLS policy helper functions (`current_user_org`, `has_location_access`, …) — revoking these breaks every org-scoped query. ~11 public RPCs for pre-auth flows. ~37 authenticated client RPCs with internal party guards.

**Deliberately NOT applied** (documented in mig 257): flipping `has_location_access` from fail-open → fail-closed — 0 of 71 users have location grants today; would lock out every user. Org scoping still holds via `current_user_org()`.

- **Remaining effort**: Periodic re-audit when new SECURITY DEFINER functions land; confirm each has appropriate EXECUTE grants at creation time.
- **Signal to unblock**: New advisor sweep flags a specific function without internal gates.

#### 🟢 1.3 — Public storage bucket allows listing — resolved 2026-05-14 (PR #300, migration 115)

Original entry named the wrong buckets (`avatars`, `briefing`). The actual public buckets are `product-ads` (migration 049, vendor ad images on the Innovate shelf) and `profile-pictures` (migration 002, user avatars). Both legitimately need `public: true` for direct `<img src>` rendering — making them private would break the UI.

The actual fix was tightening the RLS SELECT policies on `storage.objects`, not the bucket-level public flag. Both policies had `to public using (bucket_id = '<bucket>')` — unconditionally readable by anonymous callers via the SDK's `.list()` / PostgREST. Migration 115 drops both. Direct URL serving via `/storage/v1/object/public/...` is unaffected (the public flag bypasses RLS for that path per Supabase docs).

Verified 2026-05-14:

- ✅ Direct image URLs return 200 with full PNG content (avatar + product ad both tested via fetch).
- ✅ Authenticated `.list()` against either bucket now returns `[]` (RLS-denied — was the entire bucket contents pre-migration).
- ✅ No application code uses `.list()` on these buckets (audited).
- ✅ Buckets remain `public: true`; the `<img>` tags in Briefing and the topbar avatar render unchanged.

Service role bypasses RLS, so the Supabase Dashboard storage browser still works for platform admins.

#### 🟢 1.4 — Ticket-photos bucket cross-tenant LIST — resolved 2026-06-21 (migration 257)

The `ticket-photos` bucket remains public (direct `<img src>` URLs need it), but migration 257 replaced the unconditional LIST policy with org-folder scoping: `(storage.foldername(name))[1] = current_user_org()::text`. Authenticated `.list()` can no longer enumerate another tenant's photo metadata. Direct URL access unchanged (public bucket bypasses RLS for object GET).

### 2. Email deliverability hardening (Resend / Adaptiv brand)

#### 🟢 2.1 — DMARC tightened to `p=quarantine` — resolved 2026-05-14

Route 53 `_dmarc.adaptiv.systems` now serves `"v=DMARC1; p=quarantine; sp=quarantine; adkim=r; aspf=r;"`. Verified consistent across Google DNS (8.8.8.8), Cloudflare DNS (1.1.1.1), and system resolver. Unaligned mail purporting to be from `adaptiv.systems` (or any subdomain) gets spam-foldered by receivers. SPF + DKIM alignment continues to pass on every Resend send (verified 2026-05-13).

**Optional next step (not blocking):** add `rua=mailto:dmarc@adaptiv.systems` to start receiving aggregate reports from receivers. Useful for spotting misconfigured senders or spoofing attempts at volume; otherwise adds inbox noise.

#### 🟢 2.2 — Dedicated `auth.adaptiv.systems` subdomain (optional, long-term)

Currently both transactional sends (Resend SDK, `api/demos/send.ts`) and auth sends (Supabase SMTP) use `adaptiv.systems` as the From domain. Splitting auth sends onto a dedicated `auth.adaptiv.systems` subdomain isolates auth-email reputation from marketing/demo sends — a noisy marketing campaign won't hurt password-reset deliverability.

- **Effort**: ~30 minutes — verify the subdomain in Resend (DKIM + SPF on `auth.adaptiv.systems`), update Supabase SMTP sender, redeploy.
- **Why deferred**: Premature optimization until we have real send volume.
- **Signal to unblock**: ~1000+ auth emails/month OR marketing sends start affecting Gmail folder placement.

### 3. Payment integrity

#### 🟢 3.1 — Stripe LIVE-mode flip — completed 2026-05-14

Production is now on LIVE Stripe. `STRIPE_SECRET_KEY` is `sk_live_…` (Production scope only; Preview + Development remain on `sk_test_…`). `STRIPE_WEBHOOK_SECRET_LIVE` is set and consumed by `webhookSecret()` via the prefix-branch in `api/_lib/stripe.ts` (PR #296). The Stripe Dashboard LIVE webhook destination points at `https://merlin.adaptiv.systems/api/stripe/webhook`; the old `merlin-three.vercel.app` URL was retired during the dashboard migration.

End-to-end verified via:

1. Bogus-signature POST to `/api/stripe/webhook` → HTTP 400 with Stripe SDK's `"No signatures found matching the expected signature for payload"` (proves the SDK initialized with `sk_live_`, `webhookSecret()` returned `STRIPE_WEBHOOK_SECRET_LIVE`, signature verification actually runs).
2. GET to same endpoint → HTTP 405 (handler imports + method gate work).
3. ~7 min of post-flip cron runs (`/api/agents/tick`, `/api/agents/seed-signal`, `/api/devices/seed-events`) → all 200, zero error/warning/fatal log lines, zero `[stripe] … unset` warnings.

**Open low-priority cleanup:** the Stripe sandbox/test-mode webhook destination still points at `https://merlin-three.vercel.app/api/stripe/webhook`. Test events from there would 400 against prod (since prod is now LIVE-mode and rejects TEST-signed events). Either update its URL to canonical OR delete it. Not blocking anything.

Runbook used: [`runbooks/stripe-live-mode-flip.md`](runbooks/stripe-live-mode-flip.md).

### 4. Error monitoring (Sentry)

#### 🟢 4.1 — Server-side Sentry for `api/` routes — **fully wrapped 2026-06-21 (#993)**

`src/app/sentry.js` initializes the frontend-only SDK (`@sentry/react`). For the Vercel serverless functions in `api/`, [`api/_lib/sentry-http.ts`](../../api/_lib/sentry-http.ts) provides direct HTTP transport to Sentry (no `@sentry/*` imports — avoids client bundle poisoning).

**2026-05-14:** 4 high-stakes handlers wrapped (Stripe webhook, checkout, refunds, agents/tick).

**2026-06-21 (#993):** Remaining **28 API handlers + all crons** wrapped via `wrapHandler`. Every serverless function now captures uncaught throws with `function_name`, `runtime: server`, `method`, `path`, `org`, `user` tags.

**Still open:** Sentry metric/threshold alert rules (§4.2 below) — the "new issue type" Issue Alert exists; frequency-based backstops not wired.

#### 🟡 4.2 — Additional Sentry alert rules (frontend, frequency-based)

Sentry's new UI dropped support for "issue seen more than N times in M minutes" alerts in the Issue Alert flow. The 2 unshipped rules from [sentry-alerts.md](sentry-alerts.md):

1. **ReferenceError spike** — CI bypass detector
2. **Error spike** — catch-all backstop

Both need Sentry's Metric/Monitor alert flow (different from Issue Alerts). Less critical because the "New issue type" rule already pages on every new error class — covers ~80% of these.

- **Effort**: ~20 minutes IF the Metric Alert flow is exposed in the current Sentry plan tier.
- **Why deferred**: Lower marginal value over the already-shipped "New issue type" alert.
- **Signal to unblock**: Once a recurring noise pattern emerges that the "new issue" rule under-counts.

### 5. RLS / data-isolation audit (from 100-tenants-readiness Tier 2)

#### 🟡 5.1 — RLS performance audit (Tier 2.1)

Per [100-tenants-readiness.md § 2.1](100-tenants-readiness.md#21--rls-performance-audit--3-4-days): a data-driven sweep with `pg_stat_statements` on after enough realistic load. Tier 1.3 fixed the known hot paths; this is the audit that catches whatever's still slow at p95.

- **Effort**: 3-4 days of focused work.
- **Why deferred**: Need real production load shape before this is meaningful.
- **Signal to unblock**: After 3+ paying tenants are doing real work OR before SOC 2 audit.

#### 🟡 5.2 — Realtime channel scoping (Tier 2.3)

Per [100-tenants-readiness.md § 2.3](100-tenants-readiness.md#23--realtime-channel-scoping--2-days): Realtime subscriptions are subscribed at module scope, not org-filtered. At 100 tenants × ~5 channels per active browser this is a noise problem (every browser is notified of every other tenant's updates, then filters client-side). Not a leak (RLS still gates the row data), but wasteful + a known DoS-by-fan-out risk.

- **Effort**: ~2 days.
- **Why deferred**: Performance not security; promoted here because the fan-out is technically a side-channel.
- **Signal to unblock**: 50+ active tenants OR a Realtime billing surprise.

### 6. Coming hard deadlines

#### 🟠 6.1 — Supabase Data API GRANT audit (Oct 30 2026)

Per [migration-grant-pattern.md](migration-grant-pattern.md): on Oct 30 2026, Supabase removes auto-grant of public-schema tables to Data API roles. **Existing tables keep their grants** — nothing breaks on the cutover. But before that date we should run a one-time verification pass that confirms every existing table has the grants we expect, in case any edge case slipped through.

- **Effort**: ~1 hour — pull `pg_tables.tablename`, run `has_table_privilege('authenticated', 'public.<t>', 'SELECT')` for each, eyeball the few that return `false`.
- **Why deferred**: Not urgent until ~September 2026.
- **Signal to unblock**: 2026-09-15 calendar entry.

## Items recently closed (for reference)

| Item                                                                           | Closed     | How                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full API/cron Sentry wrap (`wrapHandler` on all handlers)                      | 2026-06-21 | PR #993                                                                                                                                                                                                                            |
| Post-audit RPC least-privilege (trigger revokes, anon strip, internal fn lock) | 2026-06-21 | Migrations 257–259 (PRs #984–#988)                                                                                                                                                                                                 |
| Ticket-photos cross-tenant storage LIST                                        | 2026-06-21 | Migration 257 — org-folder scoped SELECT policy                                                                                                                                                                                    |
| 19 × `function_search_path_mutable` (advisor re-flag)                          | 2026-06-21 | Migration 257 — pinned `search_path = public`                                                                                                                                                                                      |
| 2 × `security_definer_view` (cross-tenant leak via aggregate views)            | 2026-05-13 | Migration 113 — flipped both to `security_invoker=true`                                                                                                                                                                            |
| 27 × `function_search_path_mutable` (search-path hijack hardening)             | 2026-05-13 | Migration 114 — pinned `search_path = public, pg_catalog` on all 27 functions                                                                                                                                                      |
| Leaked-password protection disabled                                            | 2026-05-13 | Supabase Auth dashboard toggle                                                                                                                                                                                                     |
| Sentry alert rule for new issues + 3 inbound filters                           | 2026-05-14 | Sentry dashboard — Alert 1 created, noise filters in place. Alert 2 (Stripe webhook errors) deferred pending server-side Sentry.                                                                                                   |
| Hydrate-on-auth-change cache leak in 6 modules                                 | 2026-05-14 | Extracted `useAuthAwareCache` helper, applied to merlin-asks, route-overrides-data, team-data, routes-data, custom-locations, event-firehose. The 7th was slas-data.js which doesn't actually have the module-level latch pattern. |
| All hardcoded `merlin-three.vercel.app` URLs in code                           | 2026-05-13 | PR #274                                                                                                                                                                                                                            |
| Stripe TEST webhook signing secret + URL                                       | 2026-05-13 | Dashboard + Vercel env update                                                                                                                                                                                                      |
| Supabase Auth allowed redirect URLs include canonical domain                   | 2026-05-13 | Supabase Auth → URL Configuration                                                                                                                                                                                                  |
| Custom SMTP via Resend for auth emails                                         | 2026-05-13 | Supabase SMTP settings                                                                                                                                                                                                             |

## Adding to this doc

Whenever a Supabase Security Advisor item is consciously deferred (not just unseen) — or a security-adjacent finding lands from any source — add it here with severity, effort estimate, and the signal that would promote it. Keep the "Recently closed" table short (last 90 days only); rotate older entries out into commit history.
