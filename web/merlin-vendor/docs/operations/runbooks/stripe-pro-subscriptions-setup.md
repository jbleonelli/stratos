# Stripe Pro subscriptions — one-time setup

Phase C of the 3-plan rollout shipped the code for collecting Pro
subscription payments via Stripe Checkout. This runbook is the
operational counterpart — what you (JB) need to do in the Stripe
Dashboard + Vercel env settings to make the new code path live.

**Status flags:**

- Code shipped: ✅ (this PR)
- TEST mode setup complete: ⬜
- LIVE mode setup complete: ⬜

Do TEST mode first (validate end-to-end with a card like 4242 4242 4242
4242), then duplicate everything for LIVE mode.

---

## 1. Create the Stripe Products + Prices

In Stripe Dashboard → **Products** → **Add product**.

### Product 1 — "Merlin Pro — Property Manager"

- **Name:** `Merlin Pro — Property Manager`
- **Description:** `Per-building Merlin Pro plan for real estate / facility teams.`
- **Pricing model:** Standard pricing → Recurring
- **Billing period:** Monthly
- **Amount:** $149.00 USD
- **Per-unit:** ✅ (this is per-building pricing; Stripe lets the
  subscription `quantity` parameter scale the line)

Save. **Copy the `price_xxxxxxxxxxxxxx` id** from the Pricing tab.

### Product 2 — "Merlin Pro — Contractor"

- **Name:** `Merlin Pro — Contractor`
- **Description:** `Flat-rate Merlin Pro plan for cleaning + facility contractors.`
- **Pricing model:** Standard pricing → Recurring
- **Billing period:** Monthly
- **Amount:** $99.00 USD
- **Per-unit:** ❌ (flat — quantity always 1)

Save. **Copy the `price_xxxxxxxxxxxxxx` id.**

---

## 2. Set env vars in Vercel

Vercel → Project: `merlin` → Settings → Environment Variables.

For **TEST mode** validation, set these in the **Preview** scope first:

```
STRIPE_PRICE_ID_MANAGER_PRO     = price_xxx (from Product 1)
STRIPE_PRICE_ID_CONTRACTOR_PRO  = price_xxx (from Product 2)
```

Once you've validated end-to-end with a test card, copy the same env
vars into **Production** scope (using the LIVE-mode Stripe price ids
created against your LIVE Stripe account).

---

## 3. Extend the webhook destination

In Stripe Dashboard → **Developers → Webhooks**, select the live
endpoint pointing at `https://merlin.adaptiv.systems/api/stripe/webhook`.
Add these event types (they're new for Phase C):

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

(The existing `checkout.session.completed`, `checkout.session.expired`,
`payment_intent.payment_failed`, and `charge.refunded` stay — they're
used by the hardware-commerce flow and don't conflict.)

Repeat for the TEST-mode webhook endpoint (if you maintain a separate
sandbox destination).

---

## 4. Smoke test (TEST mode)

1. Visit `https://merlin.adaptiv.systems/pricing` in incognito.
2. Click **Get Pro** under the Property Manager column → lands on `/?signup=1&plan=pro&audience=real_estate`.
3. Sign up with a throwaway email. After successful signup, you should be redirected to Stripe Checkout.
4. Use Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
5. Confirm payment → Stripe redirects you to `https://merlin.adaptiv.systems/checkout/success?session_id=…&kind=subscription`.
6. The page should show "Confirming your subscription…" briefly, then "Welcome to Merlin Pro." within ~5s.
7. Verify in Supabase MCP:
   ```sql
   select id, name, plan, subscription_status, stripe_subscription_id
   from public.organizations
   where stripe_subscription_id is not null
   order by created_at desc limit 5;
   ```
   The new org should show `plan='pro'`, `subscription_status='active'`, and a `sub_xxx` id.

---

## 5. Smoke test the cancel path

1. Repeat the signup but on the Stripe Checkout page, click **← back**.
2. Stripe redirects to `/checkout/cancel?kind=subscription`.
3. The page should show "No subscription started." with a back-to-app button.
4. The org row exists with `plan='pro'` but `subscription_status` is NULL — they signed up for the plan but haven't paid.

---

## 6. Promote to LIVE mode

After TEST validation passes:

1. Create the same two Products + Prices against your LIVE Stripe account.
2. Update the Production env vars (`STRIPE_PRICE_ID_MANAGER_PRO` and
   `STRIPE_PRICE_ID_CONTRACTOR_PRO`) to the LIVE `price_xxx` ids.
3. Redeploy production (Vercel auto-redeploys on env var change, but you
   can force one if needed: Deployments → "…" → Redeploy).
4. Validate with a real card on a low-stakes throwaway account, then
   delete that test org from Supabase.

---

## Open follow-ups (post-launch)

- **Per-building quantity sync** — when a Pro org adds/removes a
  building, the Stripe subscription's `quantity` should update. Currently
  it stays at the signup-time count (default 1). Tracked as a future PR.
- **"Manage subscription" UI** in customer Settings ✅ — endpoint at
  `api/checkout/customer-portal.ts` opens Stripe's Customer Portal;
  Admin → Organization → Subscription card shows current plan + a
  button (admin/owner gated). **Requires** a one-time Stripe Dashboard
  setup in Settings → Billing → Customer portal: turn the portal ON,
  enable payment-method update + invoice history + cancellation,
  whitelist the canonical return URL (`https://merlin.adaptiv.systems`),
  pick branding. Both TEST + LIVE dashboards. Without that the API
  call returns 400 'No configuration provided'.
- **G3 (paid agents)** ✅ — `/api/agents/toggle-entitlement` wraps
  `stripe.subscriptionItems.create/del` around the
  `building_agent_entitlements` upsert. $99/agent/month prorated.
  Shipped in PR #318 (migration 120).
