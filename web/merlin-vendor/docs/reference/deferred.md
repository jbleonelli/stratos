# Deferred items

A running catalog of every _"we'll do that later"_ decision. None of these block the product today, but they're worth tracking so they aren't re-discovered fresh in three months. Each entry includes **what** is deferred, **why** it was cut, and **when it would come back** (the signal that promotes it from deferred to scheduled).

Ordered roughly by how likely they are to get picked up. Covers Tracks D through J, plus the SaaS v2 commercialization track at the top.

---

## SaaS v2 (commercialization) — UPDATE 2026-05-17

> **Many items below have shipped.** Stripe is LIVE since 2026-05-14. Pricing is per-building Pro + agent add-on + data-source overage. `subscription_skus` DB-managed catalog (migration 128). Self-serve signup flag exists (`signupEnabled=false`) but is currently OFF — flips on at public launch. Per-tenant resource limits started landing as data-source overage. The remaining v2 items are custom domains, GDPR export/delete, platform identity hardening.

### Stripe / commercial layer — ✅ SHIPPED 2026-05-14 → 2026-05-16

**Status:** LIVE in production. Pro subscriptions, agent add-on (per-building quantity sync), data-source overage cron, Customer Portal, sales-inquiry pipeline, Stripe Products CRUD UI. DB-managed `subscription_skus` catalog replaces env-var price IDs. Promo codes via Stripe. `organizations.plan` column (migration 121).
**What ships next:** invoicing for enterprise/manual contracts (today the manual track still happens out-of-band).

### Custom domains / subdomain-per-tenant

**What:** Every tenant lives at the same root domain (`merlin.adaptiv.systems`). No `acme.merlin.app` or vanity domains.
**Why deferred:** Subdomain routing requires DNS automation (per-tenant CNAMEs or wildcard cert), an entry path that resolves the tenant from hostname, and a cookie-domain story. Single domain + workspace picker is fine for sales-led demos.
**Signal to unblock:** Customer asks for white-label / vanity URL, or marketing wants per-customer landing pages.

### Self-serve signup — 🟡 FLAG EXISTS, OFF

**What:** Public signup form is built (`signupEnabled` feature flag in `platform_settings`), currently OFF. Public launch flips this on. Until then, Adaptiv staff create tenants from `/platform/tenants`.
**Why still off:** awaiting marketing site polish + launch sequencing.
**Signal to unblock:** Public launch.

### Per-tenant resource quotas / rate limiting — 🟡 STARTED

**What:** First wedge shipped 2026-05-16 — data-source overage billing (`+50 data sources / $25/mo`). Per-tenant write rate limiting shipped earlier (4 BEFORE INSERT triggers + bucket table, migration 066).
**What's still missing:** caps on devices, users, API calls, storage scoped to plan tier.
**Signal to unblock:** First customer hits the data-source overage threshold + asks "what else is metered?"

### Data residency / GDPR export + delete

**What:** Tenants live in one region (Supabase project default). No export-my-data button, no "purge this tenant fully" automation beyond the back-office soft-delete.
**Why deferred:** Real export tooling needs a data dictionary, format choice (JSON / CSV / SQL dump), and a download surface. Real purge needs an inventory of every table holding tenant data + a verified cascade. Both are sizeable; soft-delete + a manual SQL cleanup covers the demo phase.
**Signal to unblock:** First customer in a regulated jurisdiction (EU GDPR DSAR, California CCPA), or a compliance-driven sale.

### Platform identity hardening

**What:** Adaptiv employees today live as `profile` rows inside customer orgs (JB-as-superadmin in Meridian). Phase 2 of v1 moves them into a synthetic Adaptiv platform org, but the underlying identity model is still "row in profiles + membership in an org."
**Why deferred:** A clean separation (separate `platform_users` table, distinct auth flow, dedicated SSO) is invasive and not needed at v1 scale. The phase-2 platform-org pattern is a workable middle ground.
**Signal to unblock:** First Adaptiv employee onboarding where the current profile-in-org pattern feels wrong, or a security review flags the cross-pollution.

### Cross-tenant analytics for back-office

**What:** Back-office tenant detail shows per-tenant health. There's no portfolio-level "all tenants by activity / revenue / health" dashboard.
**Why deferred:** With <10 tenants you can read the list. Aggregation matters at scale.
**Signal to unblock:** ~20+ tenants and an Adaptiv exec asks for a weekly portfolio rollup.

---

## Invites

### Email delivery on invite

**What:** The invite flow is link-only. Owners generate an invite, copy the URL, share it out of band (Slack, email, SMS).
**Why deferred:** Supabase Edge Functions + SMTP templates would double Phase 11d's scope. Only the Adaptiv Demo org is active today, so "paste this link in Slack" is zero-friction.
**Signal to unblock:** Second org onboards and asks for a hands-off invite experience.

### Pre-populated signup email from invite

**What:** Landing on `?invite=<token>` while signed out stashes the token but doesn't pre-fill the email on the signup form. The user has to type the invited email correctly for the invite to consume.
**Why deferred:** Would require decoding the token client-side (it's opaque) or an RPC to return the invite's email given its token (leaks "this token is valid").
**Signal to unblock:** Invite accept-rate drops because users mistype their email.

### Bulk invites

**What:** One invite per click. No CSV upload, no "invite 20 people to admin all at once."
**Why deferred:** Tiny workspaces don't need it; large customers tend to use SCIM/SSO which sidesteps manual invite entirely.
**Signal to unblock:** Customer with 50+ seats and no SSO.

### Editable roles on pending invites

**What:** You can't edit the role on a pending invite; you revoke and re-create.
**Why deferred:** Revoke + re-create is one extra click and keeps the invite state model append-only, which we like for audit.
**Signal to unblock:** Users report frustration with the pattern in a user test.

### SCIM / SSO

**What:** Every user signs in with email + password; no SAML, OIDC, or SCIM provisioning.
**Why deferred:** Supabase supports SSO but it's org-level configuration; mixing SSO and non-SSO orgs is a fair bit of work. Not a blocker below ~50-seat customers.
**Signal to unblock:** First SSO-required customer.

---

## Permissions

### Cross-device expand-state sync

**What:** The Locations tree remembers which nodes you expanded or collapsed — but only per browser. A laptop/desktop user sees different states depending on which machine they're on.
**Why deferred:** Syncing via `profile.preferences` adds a DB round-trip on every toggle. Per-browser covers the main "I keep re-collapsing the same node" pain without the network chatter.
**Signal to unblock:** Users report cross-device friction.

### Role-level subtree grants

**What:** A `user_location_grants` row is scoped to a single user. There's no "members of cleaning team get access to London Campus" pattern.
**Why deferred:** Every customer's role-structure is different; encoding a generic rule engine is more scope than it's worth for a demo. One-user-one-grant is simple and unambiguous.
**Signal to unblock:** A customer asks for group-based access and it comes up repeatedly.

---

## Audit + history

### Audit non-structural column changes

**What:** `location_edits` records creates, deletes, renames, and re-homes. Changes to displays / sensors / occupancy / sqft don't leave a trail.
**Why deferred:** Those columns churn from device imports and simulator tick. Logging every change would drown the signal.
**Signal to unblock:** Compliance review specifically asks for display-count history.

### Global org-wide audit log page

**What:** History is shown per-location in a modal. There's no "show me everything that changed in this org this week" page.
**Why deferred:** 13a's model supports this (the `location_edits` rows carry `organization_id`) — just no UI yet. Per-location coverage is enough for the "what happened to this building" case, which is the common one.
**Signal to unblock:** First compliance-driven review session.

### Audit for routes, zones, team

**What:** `location_edits` only audits locations. Renaming a route, changing a zone's kind, editing a team member's availability — none of those land in a log.
**Why deferred:** Route/zone churn is higher-frequency by nature, and structural-location-changes was the identified compliance concern.
**Signal to unblock:** Customer audit of route changes over a regulated period.

### CSV / JSON export of audit log

**What:** No export button. To pull history out, you query `location_edits` directly.
**Why deferred:** SQL access is the defensible export path for a compliance review.
**Signal to unblock:** A non-technical auditor needs to run the report themselves.

---

## Location tree

### Fully strip `BUILDINGS` from `src/app/data.js`

**What:** Phase 14a promoted the four demo buildings to real rows but kept them in `data.js` as a fallback seed. If someone deletes a DB row, the static version reappears on next reload.
**Why deferred:** Stripping `BUILDINGS` touches every component that imports it (Dashboard, Briefing, IncidentView, …). The DB wins in practice today, so it's a cleanup-debt item, not a correctness one.
**Signal to unblock:** Refactoring a client-side module that still imports `BUILDINGS`, or confusion caused by a deleted demo reappearing.

### Touch-device support on drag-to-reparent

**What:** HTML5 drag works on mouse; not on tablet touch.
**Why deferred:** Admin work is predominantly desktop today. Polyfills for touch drag add complexity.
**Signal to unblock:** Serious tablet-first use pattern.

### Marker clustering on the map view

**What:** 4–20 markers render fine; at 200+ pins start to overlap.
**Why deferred:** Only four demo locations have coords today. `react-leaflet-markercluster` is the plug-in when it matters.
**Signal to unblock:** First customer with 50+ buildings populated with coords.

### Address-based geocoding

**What:** Latitude + longitude are typed into the Edit modal by hand. There's no "given this address, fill in the coords" button.
**Why deferred:** A free geocoding service (Nominatim, Census) introduces runtime dependency, rate limits, and fuzzy results. Manual entry for a demo is ~30 seconds of typing.
**Signal to unblock:** Onboarding a customer with dozens of buildings at once.

### Multi-select drag

**What:** Drag one location at a time.
**Why deferred:** Bulk reorganization is rare; the single-select UX is cleaner for the common case.
**Signal to unblock:** Admins report that single-drag is slow for bulk moves.

---

## SLA + routes

### Real SLA-breach tracking

**What:** "At risk" is a heuristic — a route is at-risk when it has a configured SLA threshold _and_ an active non-note override today. Actual execution events (started, finished) aren't tracked, so a route that's silently running late without an override doesn't trip the flag.
**Why deferred:** Wiring route-execution events requires a field team workflow that doesn't exist yet (someone has to log "I started the route at 08:14"). The heuristic is useful for demos; the real thing waits for mobile/tablet execution UI.
**Signal to unblock:** First customer where crew uses Merlin on-the-ground to check in on routes.

### SLA on route types, not just individual routes

**What:** SLA threshold is per-route. No global "all restroom cleans must finish within 30 minutes" rule.
**Why deferred:** Service-type-level SLAs would need a cascading-override model that doesn't exist yet.
**Signal to unblock:** Three customers each setting the same SLA on every restroom clean.

---

## Incidents

### Structured location on incident rows

**What:** Demo `INCIDENTS` in `data.js` bake location into free-text titles like _"VOC spike — Floor 32 East Restroom"_. There's no `location_id` + `zone_id` on the incident record.
**Why deferred:** Incidents are simulator-generated ephemeral state; making them real rows with structured location means persisting them, which changes the simulator's model. Bigger phase than it sounds.
**Signal to unblock:** Moving from simulator-only incidents to real sensor-driven incidents.

### Breadcrumbs on incident rows

**What:** Only Today's plan route rows render a breadcrumb above the title. Incident rows on Dashboard / Briefing don't.
**Why deferred:** Blocked on structured location above.
**Signal to unblock:** Same as above.

---

## Misc small

### Searching zone names in the Locations filter

**What:** The Locations search matches on location names only; typing _"restroom"_ doesn't highlight buildings that have restroom zones.
**Why deferred:** Zones live one layer down; including them would broaden the filter semantics significantly and clutter the result list.
**Signal to unblock:** "I need to find every building that has a kitchen" becomes a real workflow.

### Configurable invite expiry

**What:** Every invite expires after 14 days. You can't pick 7 days or 30.
**Why deferred:** 14 days is an agreeable default; a knob is YAGNI until a customer asks.
**Signal to unblock:** Customer policy requires shorter-lived tokens.

### Default-collapse to remember per-user, not per-browser

**What:** The expand-state localStorage is per browser. Sign in on a different computer and every ecosystem is back at auto-expanded depth 2.
**Why deferred:** Same reason as "cross-device expand-state sync" above — DB round-trip per toggle isn't worth it yet.
**Signal to unblock:** Customers report confusion about cross-device state.

---

## Multi-org operations (Track G)

### Property Manager / portfolio split

**What:** `profile.role = facility` at a `real_estate` org today resolves to `facility_manager` persona — one shell for both per-building FMs and portfolio-level property managers. No dedicated portfolio dashboard.
**Why deferred:** Collapsing the two into one shell works well enough for demos; splitting the UX adds a second full shell to maintain. Noted as v2 in `personas.js`.
**Signal to unblock:** First REIT or owner-operator customer asks for a portfolio KPI / cost-rollup view across buildings.

### Tenant / occupant-contact role

**What:** No way to model the HR manager at a company leasing floors in a building. They can't log in and see their tenant-scoped hygiene SLA compliance.
**Why deferred:** The commercial real-estate tenant-facing view is an entire additional persona with its own scoped RLS + dashboard. Out of scope for the initial multi-org rollout.
**Signal to unblock:** First commercial property needs a tenant view, or a multi-tenant office adopts Merlin for all tenant reporting.

### Auditor / compliance-officer role

**What:** No time-bounded read-only credential for a third-party auditor (health inspector, SOC2 reviewer). They'd share a superadmin login today, which is overkill.
**Why deferred:** Requires a scoped-read-only membership role + time-bounded tokens. New territory for Merlin's auth model.
**Signal to unblock:** First regulated scenario (hospital, school, bank) with a concrete audit deliverable.

### Contractor write access to team_members

**What:** Contractor managers can read their crew roster but writes (adding a new hire at Maple Cleaning) flow through an Adaptiv-assisted path, not self-serve.
**Why deferred:** The initial Track G scope was read-only for contractors across the board. Writes open a larger surface (team_availability, invites, profile creation) that's coupled to the invite flow.
**Signal to unblock:** First active contractor scales past ~5 crew and can't accept Adaptiv-assisted hiring.

### Service Dispatch / FM-network persona

**What:** No support for CBRE / JLL-style FM networks that dispatch work orders across multiple buildings + contractors on behalf of customers.
**Why deferred:** Adjacent to contractor*manager but distinct (dispatches rather than \_is* a contractor). Worth adding when we move past single-owner-plus-contractors scenarios.
**Signal to unblock:** First FM network customer.

### Executive / CFO shell

**What:** No dedicated exec dashboard — portfolio KPIs, cost rollups, trend reports. Execs use superadmin today and see way more than they need.
**Why deferred:** Probably derivable as a superadmin tweak (a "minimal" landing page) rather than a new role. Not urgent for the demo phase.
**Signal to unblock:** Customer asks for a weekly exec digest.

---

## Devices + fleet (Track H)

### Ecosystem device seeding (IMF, NYBank) — ✅ SHIPPED

**Status:** Both FEB (581-branch ecosystem) and IMF (2-building ecosystem) are DB-backed now. FEB shipped earlier; IMF added through migrations 117-125 in 2026-05-15. FEB branches now first-class `kind='branch'` rows; IMF uses `variant='imf'` flavoring.

### Per-building floor-plan geometry

**What:** Hypervisor shows a floor plan for Meridian HQ only (`FP_ROOMS` hardcoded to Floor 32 layout). Every other building shows an empty state.
**Why deferred:** Floor-plan geometry is authored per-building and doesn't generalize from a data feed. Needs its own schema + seeder (or an upload flow).
**Signal to unblock:** A customer with SVG floor plans they want to overlay with live sensor readings.

### Full installer + procurement schema

**What:** Deployments tab's installer chips, install calendar, provisioning queue, and rollout templates are static decoration in Meridian's scenario. DB-backed scenarios just show derived firmware rollouts.
**Why deferred:** A real deployments schema (installer roster, calendar events, procurement queue, template bundles) is its own phase. Firmware-only rollout derivation covers the main use case for demos.
**Signal to unblock:** First customer provisioning devices through Merlin at scale.

### BLE aggregator-child count persistence

**What:** `telemetry.ble_children_count` on display rows is derived at read time, not stored. Every fleet query recomputes.
**Why deferred:** Avoided a post-seed update pass (would have added ~200 round-trips on Company HQ). Derivation is fast enough at current fleet sizes.
**Signal to unblock:** A fleet large enough that the count-derivation query becomes measurable.

### Real device telemetry ingest

**What:** Devices have rich telemetry jsonb (RSSI, LTE metadata, embedded sensor values) but it's all seeded state, not live. No MQTT / HTTP ingest path.
**Why deferred:** Live ingest requires an entirely separate pipeline (per-customer device keys, rate limits, schema validation). Demo data is enough for sales.
**Signal to unblock:** First pilot with real Adaptiv hardware.

---

## Tweaks + UX polish (Track J)

### Cross-device tweaks sync

**What:** Persisted tweaks (active building, theme, density, etc.) live in browser localStorage. Users on two devices have two sets of tweaks.
**Why deferred:** Syncing to `profile.preferences` is a DB round-trip per toggle. Per-browser is fine for 99% of use.
**Signal to unblock:** Users complain about cross-device friction (same as the Locations expand-state issue).

### Auto-upgrade stale `tweaks.building` = 'hq' to first DB building

**What:** Pre-Track-J users with a persisted `tweaks.building = 'hq'` (Meridian) keep it even when their active org has DB-backed buildings. Auto-correct only fires when the id is genuinely invalid; `hq` is always in the static set.
**Why deferred:** Forcing a jump away from an explicitly picked (or legacy-persisted) static building risks stomping a user's intentional choice. The user can pick the right building once — it persists going forward.
**Signal to unblock:** Noticeable onboarding friction — users reporting they can't find their demo data on first load.

### Self-serve demo cleanup

**What:** Deleting a demo org requires an Adaptiv superadmin (cascading FK cleanup across merlin_asks, org_members, etc.).
**Why deferred:** A self-serve cleanup endpoint needs to handle the full dependency graph safely. The Load Demo flow is already fast enough that users just create a new one instead of cleaning up old.
**Signal to unblock:** Users accumulate 5+ demo orgs each and complain about picker clutter.

---

## Hardware commerce (Track L — shipped 2026-05-11, with deferred pieces)

The hardware commerce loop is closed end-to-end in demo mode (`Browse → Cart → Place order → Simulate fulfillment → Install`). What follows is what was deliberately left out of the v1 cut.

### Real payment integration (Stripe / partner) — ✅ STRIPE LIVE

**Status:** Stripe LIVE since 2026-05-14 for subscriptions (Pro plans, agent add-on, data-source overage). For hardware orders specifically, Stripe Checkout for hardware shipped 2026-05-11 (migration 097), still currently using LIVE mode keys. The `device_orders.subtotal_cents` / `tax_cents` etc. fields are populated end-to-end.

### Real shipping rates + carrier labels + tracking webhooks

**What:** `device_orders` has `tracking_number` + `carrier` columns; today they're filled by the `demo_fulfill_order()` RPC. There's no Shippo / EasyPost integration that buys labels, computes rates, or webhooks tracking updates.
**Why deferred:** Real shipping is a sizeable integration in its own right (address verification, dimensional weight, customs for international, return labels). Adaptiv ships from one warehouse today — flat-rate shipping or "we'll quote you" works fine.
**Signal to unblock:** Order volume crosses a threshold where flat-rate eats margin, OR international shipping is a real requirement.

### Real fulfillment workflow (platform admin)

**What:** The `demo_fulfill_order()` RPC is intentionally callable by the customer for demo convenience. In production this should move to platform-admin-only with manual transitions: order placed → admin reviews → admin marks as confirmed → fulfillment team marks as shipped → carrier webhook (or admin) marks delivered.
**Why deferred:** Same reason as payment — the partner / workflow tooling decisions haven't been made yet. The customer-callable simulate path is honest about being a demo helper.
**Signal to unblock:** First real order placed; payment + shipping partners locked in.

### Bulk install worksheet

**What:** `install_inventory_device()` is one-unit-at-a-time. A real install workflow for a kit order (e.g. 12 SDCs + 12 PCBs + 4 SLBs delivered → distributed across 28 rooms) would benefit from a worksheet UI (CSV upload OR multi-select grid) that maps N delivered units to N locations in a single transaction.
**Why deferred:** The per-unit install is good enough for testing the full loop, and the canonical demo flow is "place small order → install a few units". Bulk matters at deployment scale, not demo scale.
**Signal to unblock:** First real deployment of >20 units, OR contractor feedback that one-by-one is painful.

### Drag-and-drop install on the floor plan

**What:** Today the InstallModal uses a flat `<select>` grouped by building (optgroup). A nicer UX lifts this onto the existing floor-plan / Hypervisor canvas — drag a delivered SKU onto a room → installed.
**Why deferred:** UX polish, not capability. The dropdown does the job; the floor-plan version is a Phase 2 quality-of-life item.
**Signal to unblock:** Floor-plan canvas gets its next major refresh (sprite reusability lands), at which point this becomes a small additional drop target.

### Building-zones writes from the Hypervisor UI

**What:** Migration 091 opens the RLS gate for contractor zone writes (path 1 + path 2), but the Hypervisor UI doesn't currently expose an "+ Add zone" affordance — zones are only created via migration seeds.
**Why deferred:** Zones are typically a building-onboarding concern, not a day-to-day operation. Migrations seed them; the install loop doesn't need users to create new ones.
**Signal to unblock:** First customer asks to add a zone in-app (e.g. "we just renovated and there's a new pantry on Floor 7").

---

## Process / meta

Entries here are cut when they ship — check the commit log for the phase number. The ordering is a heuristic for the next session to pick from, not a commitment.
