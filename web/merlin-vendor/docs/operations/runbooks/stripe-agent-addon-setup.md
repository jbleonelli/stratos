# Stripe agent add-on — one-time setup

G3 of the agents-billing rollout shipped the code for billing extra
agents at $99/mo per agent per building. The Admin → Agents toggle
now routes through `/api/agents/toggle-entitlement`, which creates
or removes a Stripe subscription_item on the org's Pro subscription
when the toggle goes beyond the free quota. This runbook is the
operational counterpart — one Stripe Product, one env var.

**Status flags:**

- Code shipped: ✅ (this PR)
- LIVE Product created: ⬜
- LIVE env var set: ⬜

---

## 1. Create the Stripe Product (LIVE mode)

Open [https://dashboard.stripe.com/products](https://dashboard.stripe.com/products). Confirm top-left toggle shows **"Test mode" is OFF**.

Click **+ Add product**:

| Field          | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Name           | `Merlin AI Agent — Add-on`                                            |
| Description    | `Per-agent per-building monthly add-on to a Merlin Pro subscription.` |
| Pricing model  | **Standard pricing**                                                  |
| Price          | **99.00 USD**                                                         |
| Billing period | **Monthly**                                                           |
| Recurring      | ✅                                                                    |

Save and **copy the `price_xxxxxxxxxxxxxxxx` id**.

---

## 2. Set the env var in Vercel

Vercel → Project: `merlin` → Settings → Environment Variables.

Add (Production scope):

```
STRIPE_PRICE_ID_AGENT_ADDON = price_xxx  (from step 1)
```

Redeploy production (Deployments → ⋯ → Redeploy on the latest).

---

## 3. Webhook destination — no change required

The Phase C runbook already added `customer.subscription.{created,
updated,deleted}` to the LIVE webhook. These events cover G3 too —
when a subscription is deleted, our webhook clears every linked
`stripe_subscription_item_id` from the entitlement table and demotes
those rows to `source='manual', active=false`. No new event types
needed.

---

## 4. Smoke test (optional, recommended)

Requires:

- An org on Pro with `subscription_status='active'`
- That org's owner/admin signed in
- The org must have a building with at least 2 agents toggleable

Steps:

1. Sign in as the org's admin.
2. Go to Admin → Agents (top-bar building picker on the right building).
3. Toggle a 2nd-or-later agent ON. The summary stat "Monthly cost"
   should bump from $0 to $99 immediately.
4. Verify in Supabase MCP:
   ```sql
   select agent_id, source, active, stripe_subscription_item_id
   from public.building_agent_entitlements
   where organization_id = '<org-uuid>'
     and building_id     = '<building-id>'
     and active = true
   order by agent_id;
   ```
   The newly-toggled row should have `source='paid'` and a
   `si_xxxxxxxxxxxxxxx` id.
5. Verify in Stripe Dashboard → Subscriptions → click the org's
   subscription. The line items list should now show 2 items:
   one for the original Pro plan + one for the agent add-on.
6. Toggle the agent OFF. The Monthly cost should drop back to $0
   and the row's `stripe_subscription_item_id` should be NULL.
7. Verify in Stripe that the line item disappeared from the
   subscription.

---

## Edge cases handled in code

- **Toggle ON for grandfathered row** — no Stripe call. Row stays
  `source='grandfathered'`. Free regardless of count.
- **Toggle ON for the 1st agent in a building** — no Stripe call.
  Row written with `source='free_quota'`.
- **Toggle ON for the 2nd+ agent, org has no Pro sub** — endpoint
  returns 409 with code `no_active_subscription`. UI shows a
  localized error: "No active subscription. Complete Pro signup
  before activating paid agents."
- **Toggle ON for the 2nd+ agent, org has active Pro sub** — Stripe
  `subscriptionItems.create` runs, row written with `source='paid'`
  and the new `stripe_subscription_item_id`.
- **Toggle OFF for a paid row** — Stripe
  `subscriptionItems.del(id, { proration_behavior: 'create_prorations' })`
  runs, then row updated to `active=false`. If Stripe returns
  "no*such*\*"/404, we proceed with the DB write (item already gone).
- **Subscription deleted** — webhook clears every row's
  `stripe_subscription_item_id` and demotes `source='paid'` rows to
  `source='manual', active=false`. The next paid toggle creates a
  fresh item against the next subscription.

## Open follow-ups (post-launch)

- **Reactivation flow** — when a previously-cancelled org re-subscribes
  to Pro, all their `source='manual', active=false` rows are still
  there. They have to re-toggle to bring agents back. Could auto-restore
  via a "remember last config" pattern.
- **Quantity sweep** — if Stripe and our DB ever drift (e.g. webhook
  drop), there's no reconciliation job. Worth adding a daily cron
  that compares Stripe subscription items to entitlement rows and
  alerts on mismatch.
