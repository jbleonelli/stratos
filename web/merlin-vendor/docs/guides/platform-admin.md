# Merlin for Adaptiv platform admins

A field guide for Adaptiv employees who run the back-office. Everything about `/platform` — the surface where we manage tenants, users, the device catalog and fleet, the marketplace, costs, audit log, feature flags, and the customer-facing guides we publish.

> **Audience:** Adaptiv employees with platform-admin access. For the customer-facing roles see [`./user-guide.md`](./user-guide.md); for the architectural map of where `/platform` is going see [`../architecture/platform-vision.md`](../architecture/platform-vision.md).
>
> **Status:** This guide reflects the platform as of 2026-05-17. The IA expanded to 8 sidebar groups (added PAYMENTS pillar; OVERVIEW absorbed Costs + Status). **Stripe is LIVE** — Pro subscriptions + agent add-on + data-source overage + Customer Portal. Stripe Products CRUD UI at `/platform/stripe/products`. Session isolation between `/` and `/platform/*` shipped. FloatingMenu is now the sole top-right control in the platform header. **Demo replay** (migration 136) takes paid demo tenants off live Claude tokens — Meridian + FEB are on replay; IMF + SparkleCo are still live. Real shipping + cross-tenant analytics are still on the roadmap.

---

## What "platform admin" means

Platform admin is the role that operates Merlin itself — not a customer tenant. There are three tenant kinds in Merlin (`real_estate`, `contractor`, `adaptiv`), and the platform-admin capability comes from being a **member of an `adaptiv`-kind organization**, not from a profile role. `is_platform_admin()` keys off that membership.

This matters because it's an easy gotcha: even an account with `profile.role = 'superadmin'` won't have `/platform` access unless they're also in `organization_members` for the Adaptiv org. Always check membership when troubleshooting access.

### The 4-tier Adaptiv hierarchy (migration 131, 2026-05-17)

| Tier            | Stripe + Costs | Overview / Marketing / Internal | Tenants / Devices / Support          | Can create   |
| --------------- | -------------- | ------------------------------- | ------------------------------------ | ------------ |
| **Owner**       | ✓              | ✓                               | ✓                                    | Super Admins |
| **Super Admin** | ✓              | ✓                               | ✓                                    | Admins       |
| **Admin**       | ✗              | ✓                               | ✓                                    | Normal Users |
| **Normal User** | ✗              | ✗                               | ✓ (Tenants + Devices + Support only) | —            |

The customer-side notion of _tenant super admin_ (the owner role within a customer org) is the existing `organization_members.role='owner'` for that org — orthogonal to this Adaptiv-side hierarchy. Don't conflate.

### Merlin Owner — the single "god mode" account (top of the hierarchy)

One human, one account, at most one ever — enforced by a partial unique index on `profiles.is_merlin_owner`. Currently bound to `jb@leonelli.net`.

The owner retains every capability AND is the _only_ user permitted to promote or demote other Super Admins. RLS on `organization_members` for the Adaptiv org enforces the tier rules: Owner can write any row, Super Admin can write Admin + Normal User rows, Admin can write Normal User rows only.

Surfaces:

- **Session:** `session.isMerlinOwner`, `session.isSuperAdmin`, `session.platformRole` ('owner' | 'super_admin' | 'admin' | 'normal_user' | null).
- **DB helpers:** `public.is_merlin_owner()`, `public.is_super_admin_or_owner()` (Stripe + Costs gate), `public.is_admin_or_above()` (Overview / Marketing / Internal gate), `public.is_platform_admin()` (everyone with any Adaptiv membership — Customers / Devices / Support gate).
- **Trigger:** any profile inserted/updated with `email = 'jb@leonelli.net'` and no existing owner automatically gets the flag flipped.
- **Auto-onboarding:** any new `@adaptiv.systems` account lands as **Normal User** by default (migration 130 + 131). Owner / Super Admin promotes from there via SQL or future UI.
- **Visual:** filled-gold OWNER pill on `/platform/team-activity` + `/platform/users`. Distinct from STAFF (pink), DEMO (amber), REAL (green). The user menu's effective-role label reflects the tier directly — "Owner", "Super Admin", "Admin", "User".

The session shape:

- **You authenticate** like any user (`/` sign-in page, same auth flow).
- **The shell decides** based on `is_platform_admin()`: if true, `/platform/*` takes over the entire window (no customer top-nav, no workspace picker, no Merlin chat). If false, you land in the customer shell.
- **The Adaptiv org is not a customer workspace.** It's the platform-admin gate. There's no operational data inside Adaptiv — the cron handler whitelist (`['real_estate']`) intentionally skips it.

---

## How to access /platform

1. Sign in **directly at `/platform`** (`merlin.adaptiv.systems/platform`). Customer (`/`) and platform (`/platform/*`) shells now use **independent Supabase storageKeys** (`merlin-customer-auth` and `merlin-platform-auth`), so signing in at `/` does NOT carry you to platform-admin.
2. The shell auto-detects platform-admin and routes to `/platform/overview`.
3. If you land in a "no access" state, you don't have Adaptiv-org membership — see "Adding a new platform admin" below.

**Cross-surface navigation gotcha:** never use SPA navigation between `/` and `/platform/*` — the storageKey is bound at module load. Always use `window.location.assign('/platform')` or `window.location.assign('/')` to force a full reload onto the right client.

Current platform admins (4 as of 2026-05-17): `jb@adaptiv.systems`, `robin@adaptiv.systems`, `philippe@adaptiv.systems`, `jblucas@adaptiv.systems`.

---

## The IA

The left sidebar groups every surface by audience and purpose. Eight top-level groups today:

| Group          | Surfaces                                                           | What it's for                                                                                                 |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **OVERVIEW**   | Performance, Costs                                                 | Cross-platform health + LLM spend (Costs absorbed from INTERNAL 2026-05-16)                                   |
| **CUSTOMERS**  | Tenants, Users, Logins                                             | Tenant lifecycle + cross-tenant user directory + sign-ins/IP geo                                              |
| **SALES** ★    | Overview, Products, Subscriptions, Refunds, Sales inquiries, Deals | Sales pipeline + Stripe. Renamed from PAYMENTS 2026-05-19; URL path stays `/platform/payments` for continuity |
| **DEVICES**    | Catalog, Inventory, Fleet                                          | SKUs, kits, warehouse stock, installed fleet                                                                  |
| **MARKETING**  | Marketplace, Ads, Demo, Catalog                                    | Innovation marketplace + ads + demo-bundle invite tool + device-SKU catalog                                   |
| **SUPPORT**    | Guides                                                             | Customer-facing playbooks + PDF generation                                                                    |
| **OPERATIONS** | Hypervisor                                                         | Canonical admin surface for the location tree (tree CRUD + per-building grants + CSV bulk-load)               |
| **INTERNAL**   | Audit log, Experimental                                            | Every mutation, platform-wide feature flags                                                                   |

The IA is canonical in [`../architecture/platform-vision.md`](../architecture/platform-vision.md); new `/platform` modules are added there first, then implemented.

### Platform header

The top-right of the platform header is now a single **FloatingMenu** (47×47 px button → popup panel with user card + nav + "Open dashboard" CTA). Inline name/email/avatar/sign-out are gone; everything user/nav-related is in the popup. Customer (`/`) and platform (`/platform/*`) sidebars use different storageKeys — there is no cross-surface SPA nav.

---

## OVERVIEW → Performance

The platform-wide health dashboard. Reads aggregate counts directly from the live DB:

- **Tenants** — how many customer orgs exist, broken down by `kind`.
- **Users** — how many `profiles` rows.
- **Buildings** — how many `kind='building'` or `'ecosystem'` rows in `locations`.
- **Devices** — how many `devices` rows.

Each widget has a sparkline trend (where available). Subscription revenue is intentionally blank — Merlin v1 is sales-led; recurring revenue tracking lands with the self-serve commercial layer.

---

## CUSTOMERS → Tenants

The canonical tenant-management surface. One row per customer org. Each row carries kind, slug, member count, location count, lifecycle state (active / suspended / deleted), and a click-through to the tenant detail page.

### Common workflows

- **Create a tenant** — top-right "New tenant" CTA opens a modal. Fields: name, slug (validated format + uniqueness), kind, primary contact email, optional owner email. On submit, the `platform_create_tenant` RPC stamps a new org row + (if owner email provided) a pending invite, and you get an inviteToken back to share. Slugs are editable later from the tenant detail page (PR #193, migration 088).
- **Suspend a tenant** — from the tenant detail page. Sets `lifecycle_state = 'suspended'`, stamps `suspended_at` + `suspended_reason`. Suspended tenants' users see a SuspendedOrgPage on login, can't transact, but data is preserved.
- **Soft-delete a tenant** — from the tenant detail page. Sets `lifecycle_state = 'deleted'`, stamps `deleted_at`. Data is preserved; the row drops out of normal queries. Hard-delete is intentionally not exposed — it requires direct SQL with cascading cleanup.
- **Impersonate** — from the tenant detail page. Sets your `profile.impersonating_org_id`, which the `current_user_org()` RLS helper honors first. Your session now reads + writes as if you were a member of that tenant. The customer-side TopBar shows an orange "Impersonating <tenant>" pill. Hit "Stop impersonating" to return to platform-admin mode.

### Anatomy of a tenant detail page

- **ContactCard** — primary contact email (editable inline).
- **SlugCard** — editable slug via `platform_update_tenant_slug` RPC (with format + uniqueness validation + audit log).
- **Lifecycle controls** — active / suspended / deleted state machine.
- **Members table** — every `organization_members` row for the tenant. Shows profile role + org-role + joined date. No editing here yet (use the tenant's own Admin → Users page after impersonating if you need to add or remove people).
- **Locations summary** — count of buildings the tenant owns.

---

## CUSTOMERS → Users

The cross-tenant user directory (PR #209). Flat list of every `profile` row across every org, with the user's primary org + membership count + profile role surfaced inline.

- **Sortable** by every column: name, email, role, primary org, org kind, memberships, joined.
- **Filterable** by primary org, org kind (real_estate / contractor / adaptiv), profile role.
- **Searchable** across email, name, company, primary-org name.
- **Click a row** → navigates to that user's primary tenant detail page.

Useful for finding "every user at Meridian" or "every contractor admin" without going tenant-by-tenant.

---

## SALES (formerly PAYMENTS, renamed 2026-05-19)

Originally spun out of INTERNAL as PAYMENTS on 2026-05-16, then renamed to SALES because the surface had outgrown payment-processing and grew into the full sales pipeline (Stripe + sales inquiries + the new replicated-from-Notion deal database). Sub-pages:

### Overview

Recent activity feed: charges, subscriptions started/canceled, refunds, payouts. Reads via the Stripe SDK in LIVE mode.

### Products (full Stripe Products CRUD)

First-class management of Stripe Products at `/platform/stripe/products`:

- **Create** a new product (name, description, recurring vs one-time).
- **Edit** existing products.
- **Add price** to a product (lookup_key + interval + amount).
- **Deactivate** (Stripe `active=false`) — soft-archive without deleting.

This is the surface to use when introducing a new subscription SKU. Any new recurring SKU should also be registered in `subscription_skus` (migration 128) so backend code can resolve `getSubscriptionPriceId(slug)` from the DB rather than from env vars.

### Subscriptions

Active subscriptions across all customer orgs. Sortable by org, plan, MRR, billing status. Click into a row → tenant detail page with the subscription embedded. Reactivation cleanup + per-building agent add-on quantity sync are both wired (the cron reconciles agent quantity against `entitled_buildings` daily).

### Refunds

List of recent refunds + a "Create refund" CTA (calls `/api/refunds/create`, audit-logged).

### Sales inquiries

Outbound triage queue. Fed by the `/pricing/contact` form (the public-facing inquiry page). Each row has the inquirer's details, message, requested plan, and a status field. Workflow: triage → assign owner → close with outcome.

### subscription_skus catalog

A platform-admin-managed table (migration 128) carrying `slug`, `stripe_price_id`, `stripe_price_id_test`. Backend reads via `getSubscriptionPriceId(slug)` with env-var fallback. All 4 live SKUs (manager_pro, contractor_pro, agent_addon, datasource_addon) populated 2026-05-16. Adding a new recurring product no longer requires a Vercel env var.

**Pending operational task:** delete the redundant `STRIPE_PRICE_ID_*` env vars from Vercel after the verification window.

---

## DEVICES → Catalog

The product catalog Adaptiv sells. Two tables back it:

- **`device_skus`** — one row per SKU (~12 seeded: Smart Display Touch Classic, SDC eInk, SDG, Air Quality v2, Occupancy mmWave, People Counter, Leak Puck, AI Camera, NFC + BLE Badge Reader, Asset Beacon, Smart Logger Basic, etc.).
- **`device_profiles`** — predefined kits (~5 seeded: Restroom Basics, Conference Room, Open Floor, Security Perimeter, Leak Monitoring). Each kit has a bill of materials via `device_profile_items`.

Active rows are readable by any authenticated user (so the customer-side Hardware store works); writes are platform-admin only. Catalog edits today happen via SQL or this editor.

---

## DEVICES → Inventory

Every Adaptiv-built device, across its full lifecycle. The `inventory_devices` table tracks 13 states:

```
manufactured → received → qc_passed → firmware_updated → configured →
shipped → delivered → installed → service → rma_inbound →
rma_received → refurb → decommissioned
```

A unit becomes a customer-facing `devices` row only when it hits `installed`. The `device_lifecycle_events` table is the append-only audit log of every state transition.

Use this surface to:

- Spot stuck units (e.g. lots in `qc_passed` for too long → QC bottleneck).
- Find a specific serial.
- Validate a customer's claim ("we never received unit ADX-SDC-V1-001234").

---

## DEVICES → Fleet

Every Adaptiv device, installed or not. Drives the "what's live where" view. Combines `inventory_devices` (lifecycle) with `devices` (customer-facing) so platform admins see both the warehouse perspective and the deployed perspective in one place.

---

## OPERATIONS → Hypervisor

The canonical admin surface for the location tree (PRs #161-#164, 2026-05-12). Three capabilities:

- **Tree CRUD** — create, rename, re-home, delete any node from ecosystem → building → floor → restroom/meeting room → zone → position.
- **Per-building location grants** — wire which users get access to which building, scoped to subtrees if needed.
- **CSV bulk-load** — upload a CSV of locations and Hypervisor diffs it against the live tree, shows what would change, applies on confirm. Load-progress UI prevents tab-flips from breaking long imports.

Used during tenant seeding (after `/platform/tenants` creates the org) to populate the location hierarchy without writing SQL.

---

## MARKETING → Marketplace

The innovation-partner catalog. One row per vendor that contractors can attach to a proposal (e.g. a TouchFreeFlush, a leak-sensor vendor, an AI-camera company).

Why it's here: contractors pitch innovation upgrades to facility managers via `contract_proposals`. When the proposal has a third-party product attached, the marketplace row gives Lily Park the full vendor card (name, tagline, region, key features, learn-more link). Adaptiv curates this list.

---

## MARKETING → Ads catalog

Cross-tenant promotional content surfaced inside customer workspaces (e.g. the kill-switch entry that gates promo banners site-wide). Platform-admin-managed; turn off here to silence platform promos everywhere instantly.

---

## MARKETING → Demo (2026-05-13)

One-click prospect demo invite tool at `/platform/marketing/demo`. Five demo bundles available today:

| Slug                   | Workspace                                                 | Personas                          |
| ---------------------- | --------------------------------------------------------- | --------------------------------- |
| `meridian-hq`          | Meridian HQ (50-floor tower)                              | Jamie Lin (FM)                    |
| `meridian-warehouse`   | Meridian Distribution Center East (`variant='warehouse'`) | Cold-chain agent persona          |
| `meridian-healthcare`  | Meridian Health Clinic (`variant='healthcare'`)           | Pharmacy-temp agent persona       |
| `first-empire-bank`    | FEB 581-branch ecosystem                                  | Daily-cleaning compliance         |
| `contractor-sparkleco` | SparkleCo contractor (cleaning)                           | Lisa Sparkle (contractor manager) |

Each bundle:

- Sends a branded EN or FR PDF guide with quickStart steps.
- Lands the recipient in the right building automatically via `profiles.preferences.default_building_id`.
- Email template copy is platform-admin-editable via `platform_settings.demo_email_overrides` (migration 112).

Audited in `demo_invites` (migration 103). All sends use Resend with sender `noreply@adaptiv.systems`.

**IMF demo (migration 117-125) is internal-only** — present on the platform side but NOT pitched externally.

### Demo replay (migration 136, 2026-05-17)

Demo tenants no longer pay live Claude tokens. The `organizations.replay_mode` flag swaps the live agent tick for a replay-tick that re-emits captured `agent_runs` + `merlin_asks` fixtures on a 1-minute cadence. To the UI the workspace looks alive — fresh runs, fresh asks, live charts — but every byte was captured weeks ago and there's no API call.

Current state:

| Tenant                      | Replay mode                    | Notes                                                                                                     |
| --------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Meridian (HQ + MDE + MHC)   | **On** (since 2026-05-17)      | ~14.5k runs + 5k asks in the fixture.                                                                     |
| First Empire Bank           | **On** (since 2026-05-17)      | 421 substantive runs + 171 asks across 7 banking-appropriate agents.                                      |
| International Monetary Fund | Off (live mode, internal-only) | Currently produces only `decision='skip'` — needs seed-signal investigation before capture is worthwhile. |
| SparkleCo (contractor)      | Off (live mode)                | No captured activity yet; needs ~1 week of live ticking before capture.                                   |

To capture a new tenant + flip onto replay, see the full operational doc at [`docs/operations/demo-replay.md`](../operations/demo-replay.md). The key SQL flow: `select demo_capture_org('<org-uuid>'::uuid, 7)` → thin skip rows from `demo_fixtures.agent_runs` → `update organizations set replay_mode=true, replay_window_days=7, replay_started_at=null, replay_last_tick_at=null where id=…` → wait two minutes for the cron to fire.

Today there's no `/platform` UI for the flip — it's SQL only. A super-admin-only toggle on `/platform/tenants/<id>` is a known follow-up.

---

## SUPPORT → Guides

The customer-facing playbooks shipped to users + contractors + (this) platform admins. Same source as the in-app help drawer (`HelpDrawer` reads the same markdown files via `?raw` imports), with an added **"Save as PDF"** path per guide via the `/print/guide/<slug>` chrome-less route.

To add a new guide:

1. Drop the `.md` file in `docs/guides/`.
2. Add an entry to `GUIDES` in `src/app/PlatformSupport.jsx` (slug + title key + summary key + audience pill key).
3. Add the `?raw` import + a `GUIDE_SOURCES` entry in `src/app/PrintGuidePage.jsx`.
4. Add the i18n keys.
5. Optionally register the guide in `Help.jsx` so it's reachable from the in-app help drawer too.

PDFs are generated via the browser's native Print dialog — the print view ships cover page + body + page-numbered footers + cross-doc anchor links. Screenshot conventions are documented in `public/screenshots/README.md`.

---

## INTERNAL → Costs

LLM usage tracking. Every Claude API call from Merlin lands in `claude_usage_events` (migration 073) with model, input/output tokens, cache hit/miss, computed cost. The Costs page rolls this up by day / org / model so we can answer:

- "How much did Meridian's contractor-recommendations cost us last week?"
- "How much have we spent on Haiku vs Sonnet vs Opus this month?"
- "What's our cache hit rate?"

Useful for pricing decisions + spotting runaway loops (e.g. a stuck cron that re-runs Haiku every minute).

---

## INTERNAL → Audit log

Every platform-admin mutation lands here. Created in migration 060 alongside the tenant-management RPCs. Each row: actor, action verb, target type + id, timestamp, free-form payload.

Examples:

- Creating a tenant → `audit_log` row: actor=robin@adaptiv, action=`tenant.create`, target_id=<new org uuid>, payload={name, slug, kind}.
- Suspending a tenant → same shape with action=`tenant.suspend`, payload={reason}.
- Editing a slug (migration 088) → action=`tenant.slug_update`, payload={old_slug, new_slug}.

The expectation is that every back-office mutation goes through a SECURITY DEFINER RPC that also writes an audit row. New back-office mutations should follow the same pattern.

---

## INTERNAL → Experimental

Platform-wide feature flags. Stored in `platform_settings.feature_flags`. Flipping a flag here propagates to every tenant on next page load — there's no per-tenant override yet.

The UX has a staged-toggle pattern (Unsaved pill + Save / Cancel) so a fat-finger doesn't propagate to every tenant mid-call. The list of flags is defined in `FLAG_DEFINITIONS` in `PlatformExperimental.jsx`.

Adding a new flag is a 3-step recipe:

1. Default value in `DEFAULT_FEATURE_FLAGS` (a constant in `feature-flags.js`).
2. Read via `useFeatureFlags().<flag>` from any client component.
3. Add a row to `FLAG_DEFINITIONS` so it shows up on this page.

---

## Common platform-admin workflows

### Adding a new platform admin

**Tier-gated.** Since migration 131, RLS denies inserts on `organization_members` for the Adaptiv org unless the writer's tier is above what they're trying to insert:

- Owner → can insert any tier (Super Admin / Admin / Normal User)
- Super Admin → can insert Admin or Normal User
- Admin → can insert Normal User only

Two steps:

1. **Make sure they have a `profiles` row.** For `@adaptiv.systems` emails the auto-onboarding trigger handles this — they're created at first sign-up as Normal User automatically.
2. **Promote them to the right tier** by setting `organization_members.platform_role` on their Adaptiv-org row:
   ```sql
   update public.organization_members
      set platform_role = 'admin'   -- or 'super_admin'
    where org_id = (select id from public.organizations where kind='adaptiv')
      and user_id = (select user_id from public.profiles where email = 'newperson@adaptiv.systems');
   ```
3. Their next sign-in re-reads `current_platform_role()` and the sidebar reflects the new tier.

After migration 131, RLS enforces the tier hierarchy: Owner promotes to Super Admin, Super Admin promotes to Admin, Admin promotes to Normal User. Direct SQL still works (service_role bypasses RLS), but the platform-side UI honors the same rules.

### Spinning up a new customer tenant

1. `/platform/tenants` → "New tenant" → fill name / slug / kind / primary contact / optional owner email.
2. Share the returned invite link with the owner if you provided their email.
3. Optionally seed real-estate fixtures via `scripts/seed-meridian-hq-locations.mjs` (or a custom variant).
4. Optionally write a contract from the customer side to wire them up with a contractor.

### Investigating a customer issue

1. Find their org in `/platform/tenants` (search by name or slug).
2. Open the tenant detail page. Note the active state, members, location count.
3. Impersonate to see what they see. The orange impersonation pill in the topbar reminds you that mutations land as them.
4. If the issue is data-related, drop into Supabase MCP (`apply_migration` for DDL, `execute_sql` for reads).
5. Stop impersonating when done.

### Pulling a problem flag

If a flag-gated feature is misbehaving for everyone:

1. `/platform/experimental`.
2. Toggle the flag off. Save.
3. Tenants pick up the new value on next page load.
4. File a follow-up to fix the root cause.

### Auditing a mutation chain

`/platform/audit` shows every recent mutation. Filter by actor or target_id to trace what happened to a specific tenant or who did what during a debugging window.

---

## What `/platform` deliberately doesn't do

- **Tenant impersonation does NOT bypass RLS for writes** — your writes still go through the impersonated org's RLS gates. Useful safety net.
- **No bulk tenant operations** — every action is one-at-a-time. Bulk delete / bulk suspend would need a confirmation flow + audit batching; not built yet.
- **No per-tenant feature-flag overrides** — flags are platform-wide today. Per-tenant comes when self-serve customers diverge.
- **No tenant data export / GDPR DSAR** — soft-delete preserves data; real export tooling is deferred until first regulated customer.
- **No Hard delete from the UI** — requires manual SQL with cascading cleanup. Intentional friction.
- **No SPA cross-surface nav** — customer (`/`) and platform (`/platform/*`) are independent storage scopes. Always use `window.location.assign(...)` to switch.

---

## Engineering reference (where to find things)

| Capability                              | Code                                                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar IA + activeSection routing      | [`src/app/PlatformApp.jsx`](../../src/app/PlatformApp.jsx) `GROUPS` array                                                                      |
| Tenants list + create modal             | [`src/app/PlatformTenants.jsx`](../../src/app/PlatformTenants.jsx) `PlatformTenantsPage`, `CreateTenantModal`                                  |
| Tenant detail (lifecycle + impersonate) | [`src/app/PlatformTenantDetail.jsx`](../../src/app/PlatformTenantDetail.jsx)                                                                   |
| Users directory                         | [`src/app/PlatformUsers.jsx`](../../src/app/PlatformUsers.jsx) `PlatformUsersPage`                                                             |
| Performance widgets                     | [`src/app/PlatformPerformance.jsx`](../../src/app/PlatformPerformance.jsx)                                                                     |
| Catalog editor                          | [`src/app/PlatformCatalog.jsx`](../../src/app/PlatformCatalog.jsx)                                                                             |
| Inventory list                          | [`src/app/PlatformInventory.jsx`](../../src/app/PlatformInventory.jsx)                                                                         |
| Fleet view                              | [`src/app/PlatformFleet.jsx`](../../src/app/PlatformFleet.jsx)                                                                                 |
| Marketplace catalog                     | [`src/app/PlatformMarketplace.jsx`](../../src/app/PlatformMarketplace.jsx)                                                                     |
| Ads catalog                             | [`src/app/PlatformAds.jsx`](../../src/app/PlatformAds.jsx)                                                                                     |
| Support → Guides listing                | [`src/app/PlatformSupport.jsx`](../../src/app/PlatformSupport.jsx) `PlatformSupportGuidesPage`                                                 |
| Print-friendly guide view               | [`src/app/PrintGuidePage.jsx`](../../src/app/PrintGuidePage.jsx)                                                                               |
| Costs page                              | [`src/app/PlatformCosts.jsx`](../../src/app/PlatformCosts.jsx)                                                                                 |
| Audit log                               | [`src/app/PlatformAudit.jsx`](../../src/app/PlatformAudit.jsx)                                                                                 |
| Experimental flags                      | [`src/app/PlatformExperimental.jsx`](../../src/app/PlatformExperimental.jsx)                                                                   |
| Back-office data layer                  | [`src/app/platform-data.js`](../../src/app/platform-data.js) (`useAllTenants`, `useAllUsers`, mutations via SECURITY DEFINER RPCs)             |
| Auth gate                               | `is_platform_admin()` RPC (migration 059), `session.isPlatformAdmin` in `auth.js`                                                              |
| Tenant lifecycle RPCs                   | `platform_create_tenant`, `platform_suspend_tenant`, `platform_unsuspend_tenant`, `platform_soft_delete_tenant`, `platform_update_tenant_slug` |
| Audit log RPC                           | `platform_audit_log_write` (called by every SECURITY DEFINER mutation)                                                                         |

---

## Where to ask for help

- **Architecture deep dive** — [`../architecture/platform-vision.md`](../architecture/platform-vision.md) is the canonical roadmap. Every new `/platform` module updates that doc first.
- **Open the in-app help drawer** — top-right of the customer shell carries the same guides this surface lists.
- **The audit log** is your friend for "who did what when".
