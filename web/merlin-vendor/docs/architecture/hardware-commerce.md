# Hardware commerce — orders, fulfillment, install

> **Audience:** engineering. End-user view in [`../guides/contractor.md`](../guides/contractor.md) §18–19.
> **Status:** 🟢 Real payment shipped 2026-05-11 (PR #212, migration 097) via Stripe Checkout. **Stripe LIVE mode active since 2026-05-14.** Real shipping still deferred — see [`../reference/deferred.md`](../reference/deferred.md). Demo fulfillment kept as platform-admin-only fallback for keyless environments. The broader Stripe subscription stack (Pro plans + agent add-on + data-source overage) is documented in [`platform-vision.md`](platform-vision.md) §Billing and the Stripe runbooks under [`../operations/runbooks/`](../operations/runbooks/).

The commerce pipeline takes a contractor from "I need 12 Smart Displays" to "they're installed in 12 rooms and producing telemetry" without leaving the app. Five lifecycle states + two RPCs + two RLS tables drive the whole loop.

```
   ┌────────┐   place order   ┌────────┐  simulate  ┌──────────┐  install   ┌──────────┐
   │  cart  ├────────────────►│ placed ├───────────►│ delivered├───────────►│installed │
   └────────┘ (place_order)   └────────┘ (RPC)      └──────────┘ (RPC)      └──────────┘
       │                          │                       │                       │
   client state            device_orders            inventory_devices         devices
   (React useState)           row exists            state='delivered'       row exists +
                                                                              inv.state=
                                                                              'installed'
```

Real payment, real shipping, and platform-admin-driven fulfillment are the v1 boundary — captured as deferred items. The schema is ready for all three; the workflow tooling is what's missing.

---

## Catalog (migration 074 — already in prod)

Three tables drive what's for sale:

- **`device_skus`** — one row per SKU we sell (12 seeded: SDC Touch Classic, SDC Touch Pro, SDC eInk, SDG, Air Quality v2, Occupancy mmWave, People Counter, Leak Puck, AI Camera, NFC + BLE Reader, Asset Beacon, Smart Logger Basic). Carries `family`, `kind` (maps to `devices.kind` on install), `list_price_cents`, `currency`, `short_description`, `active`.
- **`device_profiles`** — one row per kit (5 seeded: Restroom Basics, Conference Room, Open Floor, Security Perimeter, Leak Monitoring). Each kit has a `use_case`, `list_price_cents`, `recommended` flag, `estimated_install_minutes`.
- **`device_profile_items`** — bill of materials: which SKUs and what qty roll up to each kit. Expanded at install time so kit orders generate the right N units per SKU.

RLS reads on all three are open to any authenticated user when `active = true` (so the customer-side catalog browse path works without granting broader rights). Writes are platform-admin only — catalog edits happen via SQL or the Platform editor.

---

## Orders (migration 093)

### `device_orders`

One row per customer order. Key columns:

| Column                                                            | Type        | Notes                                                                    |
| ----------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `organization_id`                                                 | uuid        | The buying org. Scopes RLS reads.                                        |
| `placed_by`                                                       | uuid        | `auth.users` ref. Nullable on delete-set-null.                           |
| `status`                                                          | text check  | `cart` / `placed` / `confirmed` / `shipped` / `delivered` / `cancelled`  |
| `ship_to_*`                                                       | text        | name, address, city, region, postal_code, country                        |
| `subtotal_cents` / `tax_cents` / `shipping_cents` / `total_cents` | int         | Money in cents. v1 tax + shipping = 0.                                   |
| `currency`                                                        | text        | Default `USD`.                                                           |
| `placed_at` / `shipped_at` / `delivered_at` / `cancelled_at`      | timestamptz | Lifecycle timestamps.                                                    |
| `tracking_number` / `carrier`                                     | text        | Demo fulfillment fills these in; real carrier integration would replace. |

### `device_order_items`

One row per line item. References either a SKU or a profile, never both:

```sql
check ((sku_id is not null) or (profile_id is not null))
```

Carries `qty`, `unit_price_cents`, `line_total_cents` — captured at place-order time so price-snapshot history is preserved if catalog prices later change.

### RLS

- **Read** — members of the org (`organization_id = current_user_org()`) OR platform admin
- **Insert** — members can only insert orders for their own org, only with `status in ('cart', 'placed')`. Platform-admin-only transitions to later states are enforced via a separate update policy.
- **Update (member)** — member can update orders in `cart` or `placed` status (qty edits, cancel). Cannot push through to shipped / delivered.
- **Update (platform admin)** — full update path. Real fulfillment workflow uses this.
- **Delete** — members can delete cart-state orders only; platform admin can delete any.

### Place order (client side)

`placeOrder({ lines, shipTo, notes })` in `src/app/hardware-store.js`:

1. Loops the cart lines, snapshots prices into `unit_price_cents` + `line_total_cents`, computes `subtotal_cents`.
2. Inserts the `device_orders` row in `placed` state (skipping the cart phase entirely for v1 — no persisted cart yet).
3. Inserts all line items in a single batch.
4. **Rollback safety**: if items insert fails, deletes the order so there's no orphan row with no items.

The client-side cart is plain React state (`useState`) — there's no persisted cart-state order, so refreshing the page mid-cart loses your selection. Persisted carts are a future polish (would lift the cart into a `device_orders` row in `cart` state).

---

## Real payment — Stripe Checkout (migration 097, PR #212)

The cart's "Place order" button now hands off to Stripe Checkout. Five moving parts:

```
┌────────┐  POST /api/checkout/    ┌─────────┐  redirect   ┌────────────┐
│  cart  ├─────create-session─────►│ Vercel  ├────────────►│  Stripe    │
└────────┘                         └─────────┘  url        │  Checkout  │
                                                           └─────┬──────┘
                                                                 │ pays
                                                                 ▼
┌──────────────┐   POST /api/stripe/webhook    ┌─────────────────────┐
│ /checkout/   │◄──── redirect with session_id ┤ checkout.session.   │
│  success     │                               │  completed event    │
└──────────────┘                               └─────────┬───────────┘
   polls device_orders.paid_at                           │
                                                         ▼
                                          mark device_orders.paid_at
                                          + call fulfill_paid_order()
```

### Env vars

- `STRIPE_SECRET_KEY` — `sk_test_…` for now (live mode is a separate, gated rollout). When this flips to `sk_live_…`, the webhook handler automatically switches to verifying against `STRIPE_WEBHOOK_SECRET_LIVE` instead of `STRIPE_WEBHOOK_SECRET`.
- `STRIPE_WEBHOOK_SECRET` — `whsec_…` from the **TEST**-mode webhook registration in the Stripe dashboard.
- `STRIPE_WEBHOOK_SECRET_LIVE` — `whsec_…` from the **LIVE**-mode webhook registration. Only consulted when `STRIPE_SECRET_KEY` starts with `sk_live_`. Set this BEFORE flipping `STRIPE_SECRET_KEY` to a live key, otherwise signature verification will fail for every live event.
- `STRIPE_PUBLIC_BASE_URL` — optional; defaults to the request's origin. Set explicitly if you're behind a CDN that mangles `x-forwarded-host`.

If `STRIPE_SECRET_KEY` is unset, `/api/checkout/create-session` returns `{ mode: 'demo' }` and the cart drops back into the platform-admin-driven `demo_fulfill_order` path. This keeps keyless dev envs working end-to-end.

### Webhook setup

Stripe issues a different signing secret for each webhook destination, so TEST and LIVE need separate registrations:

1. **TEST mode** — register a webhook in the Stripe dashboard (test mode) at `https://merlin.adaptiv.systems/api/stripe/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`. The signing secret goes in `STRIPE_WEBHOOK_SECRET`.
2. **LIVE mode** — same setup in the dashboard's live mode. The signing secret goes in `STRIPE_WEBHOOK_SECRET_LIVE`. Verify in Stripe's "Send test event" panel before flipping `STRIPE_SECRET_KEY` to a live key.

The handler picks the right secret at request time by checking the `STRIPE_SECRET_KEY` prefix (`sk_live_` → live secret, else → test secret). See `webhookSecret()` / `webhookSecretEnvVar()` in `api/_lib/stripe.ts`.

The webhook handler is idempotent: re-firing on a delivered order is a no-op because `fulfill_paid_order` skips orders already at `status='delivered'`.

### Customer model

One Stripe Customer per Merlin org, stored in `organizations.stripe_customer_id`. Created lazily on first checkout — the metadata.organization_id field on the customer keeps the link traceable from the Stripe dashboard back to Merlin.

### Fulfillment gate

`fulfill_paid_order(uuid)` is `SECURITY DEFINER` and refuses to expand line items unless `paid_at IS NOT NULL` OR the caller is `is_platform_admin()`. So a client that calls it directly can't fulfill without payment; the webhook (running with service role) sets `paid_at` first, then calls the RPC.

---

## Demo fulfillment (`demo_fulfill_order` RPC — platform admin only after migration 097)

Pre-097 this was customer-callable for demo convenience. Migration 097 tightened it to `is_platform_admin()` and routed the path through `fulfill_paid_order` (which also stamps a synthetic `paid_at` so the resulting order is indistinguishable from a Stripe-paid one downstream).

When to use it:

- Keyless dev environments where you want the order → inventory flow without setting up Stripe.
- Rescue path: a real Stripe order paid but the webhook never landed (Stripe outage, signature mismatch). Platform admin runs `select demo_fulfill_order('<uuid>')` and the order completes.

Customers cannot call this RPC anymore — they go through Stripe Checkout. The order → inventory expansion logic itself lives in `fulfill_paid_order`; `demo_fulfill_order` is now a thin platform-admin wrapper.

---

## Install (`install_inventory_device` RPC, migration 094)

The bridge from "delivered hardware" to "live device in the fleet". SECURITY DEFINER, callable by the inventory owner or a platform admin. Three-table atomic transition.

### Inputs

```sql
install_inventory_device(
  p_inventory_id uuid,
  p_location_id  text,
  p_device_name  text  -- nullable; used only in the lifecycle event note
) returns uuid  -- the new devices row id
```

### Validation

1. Inventory row exists and is **not** already `installed`.
2. Caller owns the inventory (`assigned_org_id = current_user_org()`) OR is platform admin.
3. Target location exists and is **not** a `building` or `ecosystem` (those are containers, not install sites).
4. Caller can write to the target location: location's `organization_id = current_user_org()` OR caller has an active contract on the location's subtree (`is_contractor_on_location` from migration 091).
5. The inventory's SKU exists in the catalog (so we know what `devices.kind` + `devices.model` to write).

Any failure raises a SQL exception — no silent no-op. The client surfaces the exception text in the InstallModal.

### The atomic transition

```
1. Insert  → public.devices              org = location.organization_id
                                          external_id = inv.serial
                                          kind = sku.kind
                                          model = sku.name
                                          status = 'online'

2. Update  → public.inventory_devices    state = 'installed'
                                          device_id = new_device.id
                                          installed_at = now()

3. Insert  → public.device_lifecycle_events
                                          from_state, to_state, actor, notes
```

### The org-stamping trick

The new `devices` row inherits `organization_id` **from the target location**, not from the caller. This is what closes the dual-path model on the install side:

- **Contractor installs into Meridian's `'hq-fl-32-r-floor-32-conf-alder'`** → location's org is Meridian → device's org is Meridian → Lily Park sees the new device in her fleet natively.
- **Contractor installs into their own self-owned `'sparkleco-acme-fl-1-r-mailroom'`** → location's org is the contractor's → device lands in the contractor's fleet.

Symmetrical to how `createChildLocation` inherits parent org-id during tree creation (see [`./contractor-self-serve.md`](./contractor-self-serve.md)).

### Customer-side inventory read access

Migration 093 adds:

```sql
create policy inventory_devices_select_own_org on public.inventory_devices
  for select to authenticated using (
    assigned_org_id = public.current_user_org()
  );
```

`inventory_devices` was platform-admin-read-only since migration 074. Customers need to see _their_ assigned units so the Inventory tab + the orders-tab roll-up render. The new policy keys on `assigned_org_id` so cross-org visibility stays closed.

---

## Client surfaces

| Surface                                          | Where                                                           | Calls                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Catalog (Browse tab)                             | `ContractorHardware` → `HardwareCatalog` in `ContractorApp.jsx` | `useDeviceCatalog()`                                                           |
| Cart (Cart tab)                                  | `HardwareCart` in `ContractorApp.jsx`                           | client `useState`, then `placeOrder()` on submit                               |
| Order history (Orders tab)                       | `HardwareOrders` + `OrderCard`                                  | `useDeviceOrders()` + `simulateFulfill()`                                      |
| Delivered inventory roll-up                      | `InventoryStrip` (on Orders tab)                                | `useOrgInventory()`                                                            |
| Inventory list + install actions (Inventory tab) | `HardwareInventory` + `InstallModal`                            | `useOrgInventory()` + `useInstallableLocations()` + `installInventoryDevice()` |

Data layer lives in [`../../src/app/hardware-store.js`](../../src/app/hardware-store.js) — three hooks (`useDeviceCatalog`, `useDeviceOrders`, `useOrgInventory`) + a helper hook (`useInstallableLocations`) + three RPC wrappers (`placeOrder`, `simulateFulfill`, `installInventoryDevice`).

Bilingual i18n keys for every string land in `i18n.js` under the `contractor.hardware.*` namespace.

---

## What's deferred (the v1 boundary)

Captured in [`../reference/deferred.md`](../reference/deferred.md) under **Hardware commerce (Track L)**. Quickly:

1. **Live-mode Stripe** — test mode is wired; live keys need legal/business sign-off.
2. **Real shipping** — `tracking_number` + `carrier` columns are filled by demo / Stripe fulfillment; a Shippo / EasyPost integration replaces them.
3. **Refunds in UI** — admin-only via Stripe dashboard today; a self-serve refund flow on the order detail card is next.
4. **Failed-payment surface** — `payment_intent.payment_failed` events are acked but no UI tells the customer their card declined.
5. **Bulk install worksheet** — one-unit-at-a-time today; deployment-scale rollouts would benefit from a CSV / multi-select grid.
6. **Drag-and-drop install on the floor plan** — UX polish; the dropdown picker works.

---

## Migrations index

| Migration                                   | What it adds                                                                                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `074_device_catalog_and_inventory.sql`      | `device_skus`, `device_profiles`, `device_profile_items`, `inventory_devices`, `device_lifecycle_events`. Backfills installed devices into inventory.                                         |
| `093_device_orders.sql`                     | `device_orders`, `device_order_items`. Order RLS (customer-side reads/writes). `demo_fulfill_order()` RPC. `inventory_devices_select_own_org` policy.                                         |
| `094_install_inventory_device.sql`          | `install_inventory_device()` RPC.                                                                                                                                                             |
| `095_fix_demo_fulfill_serial_collision.sql` | Kit BOM serial namespace fix so two kits sharing a SKU don't collide.                                                                                                                         |
| `097_stripe_checkout.sql`                   | `organizations.stripe_customer_id`, `device_orders.stripe_session_id` / `stripe_payment_intent_id` / `paid_at`. New `fulfill_paid_order()` RPC. `demo_fulfill_order` gated to platform admin. |
