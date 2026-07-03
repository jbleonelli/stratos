# Platform — Adaptiv Internal Operations OS

`/platform` is the back-office for Adaptiv employees. It started as the SaaS-v1 tenant admin (migrations 060–068) and is evolving into the operations OS for everything Adaptiv: Merlin tenants, customer support, billing, device manufacturing/inventory/lifecycle, marketing.

This doc is the canonical source of truth for what `/platform` is, who uses each part, and how the pieces relate. New modules extend this doc; the doc is updated **before** the migration.

> **Scope reminder:** _Customer-facing_ roles (facility / cleaning / maintenance / security / superadmin) live in [`../reference/roles.md`](../reference/roles.md). This doc is _internal-facing_ — Adaptiv employees only.

> **Status update (2026-05-17):** Major modules shipped over the 2026-05-13 → 2026-05-17 sprint:
>
> - **Billing / Stripe LIVE** ✅ — Pro subscriptions, agent add-on (per-building quantity sync), data-source overage cron, Customer Portal, sales-inquiry pipeline (`/pricing/contact` + `/platform/marketing/sales`), Stripe Products CRUD at `/platform/stripe/products`, DB-managed `subscription_skus` catalog (migration 128).
> - **PAYMENTS pillar** ✅ — Stripe spun out of INTERNAL into its own pillar with sub-pages (Overview, Products, Subscriptions, Refunds).
> - **OVERVIEW absorbs Status + Costs** — `/platform/performance` is the cross-platform health surface.
> - **Marketing → Demo bundles** ✅ — `/platform/marketing/demo` offers 5 demo bundles (meridian-hq · meridian-warehouse · meridian-healthcare · first-empire-bank · contractor-sparkleco), per-demo quickStart, platform-admin-editable email templates via `platform_settings.demo_email_overrides`.
> - **Adaptiv Catalog deduped** — one page under Marketing reading `device_skus` (formerly two near-duplicate pages).
> - **Session isolation** — customer at `/` and platform at `/platform/*` have independent Supabase storageKeys; one-time forced re-auth happened at deploy.
> - **Contractor side** (closed 2026-05-11) — Contractor write paths, self-serve building creation, multi-contractor seed (4 orgs total), hardware ordering + simulated fulfillment + install. See [`./contractor-self-serve.md`](./contractor-self-serve.md) + [`./hardware-commerce.md`](./hardware-commerce.md).

---

## 1. Vision

Adaptiv employees today juggle work across email (`support@adaptiv.systems`), Zendesk, Excel sheets (inventory / manufacturing / orders), Stripe dashboard (when applicable), and the existing SaaS back-office. The cost is context-switching, manual reconciliation, and no single source of truth.

`/platform` consolidates every internal workflow that touches a customer, a device, or revenue. One UI, one auth boundary, one audit log. Third-party services (Stripe, Postmark, factory ERPs) plug in as integrations, not separate destinations.

The customer side gains a self-serve story: **signup → pick a device profile → check out → devices ship → auto-claim on first heartbeat → onboarded.** The Adaptiv side fulfils.

---

## 2. Information architecture

```
PLATFORM (as of 2026-05-17)
├── OVERVIEW
│   ├── Performance         ← live · cross-platform health, sparklines
│   └── Costs               ← live · Claude API spend (rolled into OVERVIEW)
├── CUSTOMERS
│   ├── Tenants             ← live · lifecycle, impersonation, DEMO badges
│   ├── Users               ← live · cross-tenant directory, STAFF/DEMO badges
│   └── Logins              ← live · sign-ins, IP geo (URL still /platform/team-activity)
├── SALES                      ← formerly PAYMENTS (renamed 2026-05-19); URL still /platform/payments
│   ├── Overview            ← live
│   ├── Products            ← live · full Stripe Products CRUD (create, edit, add-price, deactivate)
│   ├── Subscriptions       ← live · Pro plans + agent add-on + data-source overage
│   ├── Refunds             ← live
│   └── Sales inquiries     ← live · `/pricing/contact` form sink + outbound triage
├── DEVICES
│   ├── Catalog             ← live · `device_skus` (deduped, one page)
│   ├── Inventory           ← live · 13-state lifecycle ledger
│   └── Fleet               ← live
├── MARKETING
│   ├── Marketplace CMS     ← live
│   ├── Ads catalog         ← live
│   ├── Demo                ← live · 5 demo bundles, EN+FR PDFs, editable templates
│   └── Catalog             ← live · `device_skus` reader
├── SUPPORT
│   └── Guides              ← live · 9+ in-app guides with PDF export
├── OPERATIONS
│   └── Hypervisor          ← live · canonical location-tree admin surface (tree CRUD + per-building grants + CSV load)
└── INTERNAL
    ├── Audit log           ← live
    ├── Experimental flags  ← live · platform-managed feature flags
    └── Reports             ← future · MRR, signup funnel, fleet health
```

The sidebar nests by section heading. SALES (formerly PAYMENTS) got its own pillar once Stripe surfaces multiplied (products, subs, refunds, sales) and didn't fit under INTERNAL anymore; the rename to SALES followed when the surface grew beyond payment processing into the broader pipeline.

---

## 3. Roles

`organizations.kind='adaptiv'` is the platform org. Today every member gets `is_platform_admin()` — a binary check. Phase 0 widens this to a `platform_role` enum on `organization_members`, only meaningful when the parent org's `kind = 'adaptiv'`.

### Roles × access matrix

| Role            | Customers                            | Devices                  | Marketing | Internal            | Notes                                   |
| --------------- | ------------------------------------ | ------------------------ | --------- | ------------------- | --------------------------------------- |
| **super_admin** | full                                 | full                     | full      | full                | JB & cofounders                         |
| **support**     | Tenants r · Support full · Billing — | Fleet r                  | —         | Audit r             | can impersonate (audit-logged)          |
| **finance**     | Tenants r · Support — · Billing full | —                        | —         | Costs r · Reports r | revenue + spend                         |
| **ops**         | Tenants r (no PII)                   | full                     | —         | Audit r             | warehouse, fulfilment, RMA              |
| **sales**       | Tenants r · Support r                | Catalog r                | full      | Reports r           | outbound + collateral                   |
| **field_tech**  | —                                    | Fleet r/w (limited cols) | —         | —                   | mobile-first, day-to-day install/repair |

This is a straw man. Adjust as real workflows reveal who needs what.

### Implementation sketch

- Migration 074 adds the `platform_role` enum + column on `organization_members`.
- New SECURITY DEFINER functions: `current_platform_role()`, `is_platform_role(text)`, `is_platform_super_admin()`.
- Existing `is_platform_admin()` becomes shorthand for `current_platform_role() IS NOT NULL` — backwards compatible with all existing RLS policies.
- New platform-only tables gate SELECT/INSERT/UPDATE by role-specific helper functions.
- `/platform` sidebar hides sections the user doesn't have access to (no error pages — just absence).

---

## 4. Module specs

Each live or in-flight module either has a brief inline summary (when the spec is small) or links to its own `docs/platform/<module>.md`. New modules start as stubs here and graduate to their own file when implementation begins.

### CUSTOMERS

#### Tenants — _live_

Lifecycle of every customer org: create, suspend, soft-delete, impersonate. Background in [`memory/saas_v1_backoffice.md`](../.claude/projects/-Users-jbleonelli-Library-CloudStorage-Dropbox-ADAPTIV-Jean-Baptiste-Leonelli-DESIGN-WORK-CLAUDE-PROJECTS-MERLIN/memory/saas_v1_backoffice.md). Tenant detail page is the natural home for cross-module data (tickets, orders, billing, fleet) once those modules land.

#### Support — _phase 6 · planned_

Replace Zendesk. Inbound from `support@adaptiv.systems` parses to tickets via webhook. Ticket queue surface, per-tenant ticket history embedded on the tenant detail page. Phone (1-800) integrates later via Aircall / Twilio Voice. **Decision D-2 resolved:** transactional email via Resend (sender `noreply@adaptiv.systems`).
_Spec when started: `docs/platform/support.md`._

#### Billing — _✅ LIVE (2026-05-14 → 2026-05-16)_

Stripe LIVE mode active. Pro subscriptions, agent add-on (per-building quantity sync), data-source overage cron (`+50 data sources / $25/mo`), Customer Portal for self-serve plan changes, sales-inquiry pipeline (`/pricing/contact` + `/platform/marketing/sales`). Full Stripe Products CRUD at `/platform/stripe/products` (create + edit + add-price + deactivate). DB-managed `subscription_skus` catalog (migration 128) replaces `STRIPE_PRICE_ID_*` env vars — `getSubscriptionPriceId(slug)` reads from DB with env-var fallback. Reactivation cleanup, upcoming-invoice surface on Admin → Organization. See migrations 117-128 + [`memory/session-2026-05-15.md`](../../.claude/memory/session-2026-05-15.md) + [`memory/session-2026-05-16-subscription-skus.md`](../../.claude/memory/session-2026-05-16-subscription-skus.md). **Pending:** delete redundant `STRIPE_PRICE_ID_*` from Vercel env.

### DEVICES

#### Catalog & Profiles — _phase 1b · planned_

SKUs and predefined "kits" (e.g. _Restroom Smart Display Kit_ = 1 SDC + 1 occupancy sensor + 1 supply puck). Customers pick a kit at signup; ops fulfils against it. Profiles encode device configuration (firmware target, app config, role assignments) so receive-→-ship is a deterministic flow.
_Spec when started: `docs/platform/device-catalog.md`._

#### Orders — _phase 4 · planned_

Customer-placed device orders. Lifecycle: `placed → received → qc_passed → firmware_updated → configured → shipped → delivered → installed`. Auto-claim links delivered devices back to the originating tenant on first heartbeat (see _Fleet_ below). **Open:** payment timing (at order, on ship, on install).
_Spec when started: `docs/platform/orders.md`._

#### Inventory — _phase 1a · planned_

Warehouse stock by SKU; reorder points; allocation against open orders. v1 is read-only — import current Excel as the seed; writes come with the Orders workflow in phase 4.
_Spec when started: `docs/platform/inventory.md`._

#### Fleet — _phase 1a · planned_

Every Adaptiv-built device across every state, in one table. Each row is `(serial, mac, model, sku, current_state, current_owner_org, current_location, last_heartbeat, firmware)`. The lifecycle state machine lives here:

```
            ┌────────────────────────────────────────────────────────────────────┐
            │                                                                    ▼
manufactured ──► received ──► qc_passed ──► firmware_updated ──► configured ──► shipped
                    │                                                                │
                    │                                                                ▼
                    │                                                          delivered
                    │                                                                │
                    │                                                                ▼
                    │                                                          installed (live in Merlin)
                    │                                                                │
                    │                                                                ▼
                    │                                                            service (offline / maint)
                    │                                                                │
                    ▼                                                                ▼
              decommissioned ◄── refurb ◄── rma_received ◄── rma_inbound ◄──────────┘
```

Each transition writes an `audit_log` row (who / when / from / to). Existing customer-side `devices` table extends; doesn't fork.
_Spec when started: `docs/platform/fleet.md`._

#### Manufacturing — _phase 9 · later_

Factories worldwide, batches, open POs, expected delivery dates. Lowest priority on the build list — Excel may stay as the source of truth here longest. Eventual integration: factory submits CSV / API, our system seeds rows in `manufactured` state.
_Spec when started: `docs/platform/manufacturing.md`._

#### RMA / Refurb — _phase 8 · planned_

Customer returns: issue RMA number, track inbound shipment, evaluate, refurb (back to inventory) or decommission. Builds on Fleet's state machine; just adds the workflow UI.
_Spec when started: `docs/platform/rma.md`._

### MARKETING

#### Marketplace CMS — _live_

Vendor catalog backing INNOVATE (migration 072). Adaptiv staff curate; tenants browse.

#### Ads catalog — _live_

Product ad inserts shown in Briefing. Adaptiv staff publish; per-tenant `merlin_config.product_ads` controls display.

### INTERNAL

#### Costs — _live (PR #67)_

Daily Claude API spend across all tenants. Migration 073 = `claude_usage_events` + `claude_usage_daily` view.

#### Audit log — _live_

Chronological log of every back-office mutation. Reads `platform_audit_log`. Per-module support log → audit log will fold in here once Support ships.

#### Reports — _future_

Cross-cutting read-only dashboards. Likely first ones: MRR / ARR, signup funnel, trial-to-paid conversion, fleet health (devices at risk of churn), Claude cost per tenant ÷ MRR.

---

## 5. Customer-side (Merlin) touchpoints

Where `/platform` modules show up in the customer-facing product:

- **Signup flow** — anonymous → `auth.users` + `organizations` (kind=customer) + first member + 30-day trial. Lands in their workspace. _Phase 2._
- **Onboarding** — choose a Catalog profile → checkout → order created. Empty workspace until first device installs. _Phase 3._
- **Order tracking** — customer sees their order(s)' state in-product. New `/orders` sub-page or drawer in /admin. _Phase 4._
- **Auto-claim** — device first heartbeats with its `external_id` → server matches an open order → assigns to tenant + transitions Fleet state to `installed`. _Phase 5._
- **Trial countdown banner** — visible from signup; converts to "upgrade" prompt approaching day 30. _Phase 2._
- **In-product upgrade CTA** — when trial near-end, when fleet expands beyond plan, when usage triggers an upsell condition. _Phase 7._

---

## 6. Phased roadmap

Build order. Phase status reflects 2026-05-17 state.

| Phase  | Module(s)                                                 | Status                                                                                                          | Why this slot                                                                                |
| ------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **0**  | This doc · `platform_role` migration + RLS helpers        | 🟡 Partial — `is_platform_admin()` works org-membership-based; finer-grained `platform_role` enum still pending | Anchor + role model                                                                          |
| **1a** | Devices → Inventory + Fleet (read-only)                   | ✅ Live                                                                                                         | Greenfield schema, biggest internal pain (Excel chaos)                                       |
| **1b** | Devices → Catalog & Profiles                              | ✅ Live (deduped to one page reading `device_skus`)                                                             | Prerequisite for customer-side order page                                                    |
| **2**  | Customer-side signup + 30-day trial + workspace creation  | 🟡 Flag exists (`signupEnabled=false`); flips on at public launch                                               | Commercial growth unlock                                                                     |
| **3**  | Customer-side device store + checkout                     | ✅ Live (PR #205-206)                                                                                           | Real orders flowing in demo mode                                                             |
| **4**  | Adaptiv-side Order Management                             | 🟡 Schema in place; full fulfillment workflow deferred                                                          | Fulfilment side of phase 3                                                                   |
| **5**  | Auto-claim on first heartbeat                             | 🔴 Not started                                                                                                  | Closes customer-onboarding loop                                                              |
| **6**  | Support — email-in tickets + queue                        | 🔴 Not started; D-2 resolved (Resend)                                                                           | Replaces Zendesk                                                                             |
| **7**  | **Billing — Stripe subs + invoicing + revenue dashboard** | ✅ **LIVE (2026-05-14 → 2026-05-16)**                                                                           | Pro subs, agent add-on, data-source overage, Customer Portal, Stripe Products CRUD all wired |
| **8**  | RMA / Refurb workflow                                     | 🔴 Not started                                                                                                  | Once fleet is real and returns are happening                                                 |
| **9**  | Manufacturing — POs, ETAs                                 | 🔴 Not started                                                                                                  | Excel can probably hold here longest                                                         |
| **10** | Phone (1-800) integration                                 | 🔴 Not started                                                                                                  | Manual call logging in Support meanwhile                                                     |

---

## 7. Open decisions

Open questions that block a phase. When answered, the row moves into a _Decisions_ section.

| #   | Open question                                                                                      | Blocks               | Owner                        |
| --- | -------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------- |
| D-3 | Trial requires CC up-front? — Stripe-style trial vs. no-card                                       | Phase 2 (Signup)     | JB                           |
| D-4 | First-run experience on empty workspace — guided "create your first building" or seed demo content | Phase 2 (Signup)     | JB                           |
| D-5 | Marketing CRM — HubSpot / Customer.io / native (use platform tenant data + Resend)                 | Any drip campaigns   | JB                           |
| D-6 | Order payment timing — at order placement, on ship, on install                                     | Phase 4 (Orders)     | JB                           |
| D-7 | Auto-claim mechanism — pre-baked tenant in firmware/cert vs. claim-token at install time           | Phase 5 (Auto-claim) | JB · likely engineering call |

### Decisions

- **D-1 (pricing model) — RESOLVED 2026-05-15.** Per-building Pro subscriptions ($X/building/month) + per-building agent add-on (Stripe quantity = building count) + data-source overage ($25 per +50 sources/mo). Promo codes via Stripe. Plan column on `organizations` table (migration 121).
- **D-2 (inbound email provider) — RESOLVED 2026-05-14.** Resend for outbound (sender `noreply@adaptiv.systems`); inbound parsing to tickets still deferred until Support module starts.

---

## How this doc evolves

- New module proposed → add a stub to §4 with status `proposed`.
- Module starts implementation → spin up `docs/platform/<module>.md`, link from §4, status → `in flight`.
- Module ships → status → `live`, brief inline summary, deep spec stays in the linked doc.
- Decision in §7 resolves → move to a _Decisions_ section with date + reasoning.
- Phase order shifts → just edit §6.

This file is the index. Detail lives in per-module docs as they get written.
