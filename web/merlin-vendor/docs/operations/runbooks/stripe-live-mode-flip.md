# Stripe LIVE-mode flip runbook

Flips Merlin's hardware-commerce path from Stripe **TEST** mode (test cards only) to **LIVE** mode (real customer payments). This is a one-way operational change — rollback is straightforward but customer-visible during the brief window.

**Estimated time:** 15 minutes, mostly waiting for one Vercel redeploy.

**Pre-reqs:**

- ✅ Code support landed: [`api/_lib/stripe.ts`](../../../api/_lib/stripe.ts) `webhookSecret()` branches on `STRIPE_SECRET_KEY` prefix (PR #296). Confirms with `grep webhookSecretEnvVar api/_lib/stripe.ts`.
- ✅ LIVE-mode webhook destination created in Stripe Dashboard at `https://merlin.adaptiv.systems/api/stripe/webhook` (you did this already).
- ⏸️ `STRIPE_WEBHOOK_SECRET_LIVE` not yet set in Vercel (this runbook sets it).
- ⏸️ `STRIPE_SECRET_KEY` in Vercel Production still starts with `sk_test_` (this runbook flips it last).

If you're starting fresh (the webhook destination doesn't exist yet), see [Appendix A](#appendix-a-creating-the-live-mode-webhook-destination-from-scratch).

---

## Step 1 — Set `STRIPE_WEBHOOK_SECRET_LIVE` in Vercel

### 1a. Copy the LIVE signing secret from Stripe

1. https://dashboard.stripe.com → confirm the **Test mode** toggle (top-right) is **OFF**. Header should read just "Stripe" without an orange "Test mode" badge.
2. Developers → Webhooks → click the destination pointing at `https://merlin.adaptiv.systems/api/stripe/webhook`.
3. Look for **Signing secret** (right column or top of detail page). Click **Reveal** / **Click to reveal**.
4. Copy the value — it starts with `whsec_…`. Keep it on the clipboard; you'll paste it into Vercel next.

> ℹ️ The signing secret is unique per destination. Don't reuse the TEST-mode signing secret here — Stripe signs LIVE-mode events with a different secret, and `api/stripe/webhook.ts` verifies the HMAC against whichever secret matches the active mode.

### 1b. Add the env var in Vercel

1. https://vercel.com/jbleonellis-projects/merlin/settings/environment-variables
2. Click **Add New**.
3. Fill in:
   - **Key:** `STRIPE_WEBHOOK_SECRET_LIVE`
   - **Value:** the `whsec_…` from step 1a
   - **Environments:** ✅ **Production** only. Uncheck **Preview** and **Development** — those scopes should keep using the existing `STRIPE_WEBHOOK_SECRET` (TEST).
4. Click **Save**.

### 1c. Redeploy so the function picks up the new env var

Vercel does **not** auto-redeploy on env-var changes. Pick one:

**Option A (recommended) — push an empty commit:**

```bash
git checkout main && git pull
git commit --allow-empty -m "chore: pick up STRIPE_WEBHOOK_SECRET_LIVE env"
git push
```

**Option B — Vercel UI:** Deployments → latest Production deploy → **⋯** menu → **Redeploy** → uncheck _"Use existing Build Cache"_ → confirm.

Wait until Vercel shows **Ready** on the new deployment (~2 min).

---

## Step 2 — Flip `STRIPE_SECRET_KEY` to live mode

This is the actual go-live step. After this, `webhookSecret()` returns `STRIPE_WEBHOOK_SECRET_LIVE` and `stripeClient()` makes real-money API calls.

### 2a. Get a LIVE secret key

1. https://dashboard.stripe.com → **Test mode** toggle still **OFF**.
2. Developers → API keys.
3. Under **Secret key**, click **Reveal live key**. Copy the `sk_live_…` value.

> ⚠️ Treat this like a production database password. Don't paste it into any chat, screenshot, or commit. Vercel env-var input is the only safe destination.

### 2b. Update Vercel

1. https://vercel.com/jbleonellis-projects/merlin/settings/environment-variables
2. Find the existing `STRIPE_SECRET_KEY` row → click **⋯** → **Edit**.
3. **Production** scope: replace the `sk_test_…` value with the `sk_live_…` from step 2a. Keep **Preview** and **Development** on their TEST values (or unset).
4. Save.

### 2c. Redeploy again

Same options as 1c. Push an empty commit OR redeploy via UI. Wait for **Ready**.

---

## Step 3 — Verify

### 3a. Send a test event

1. Stripe Dashboard (LIVE mode) → Developers → Webhooks → click the `merlin.adaptiv.systems` destination.
2. Click **Send test webhook** (or **⋯** → Send test event) — pick `checkout.session.completed`.
3. Stripe's panel should show **200** within a few seconds.

### 3b. Confirm in Vercel logs

1. https://vercel.com/jbleonellis-projects/merlin → **Logs** (or **Runtime Logs** depending on UI).
2. Filter for path `/api/stripe/webhook` or function `api/stripe/webhook`.
3. Expected: a single 200 log line, no warnings.
4. **Bad signals:**
   - `[stripe] webhook received but STRIPE_WEBHOOK_SECRET_LIVE unset` — the env var didn't get picked up. Re-check Vercel (scope = Production, redeploy succeeded).
   - `[stripe] signature verification failed: …` — the env-var value is wrong (copy-paste error from step 1a). Re-copy from Stripe; the secret on the destination detail page is authoritative.
   - 5xx — function crashed. Read the stack trace. Roll back (step 4 below).

### 3c. Smoke a real checkout (optional, recommended before announcing GA)

1. Sign in as `lisa@sparkleco.com` / `merlin2026` on `merlin.adaptiv.systems`.
2. Hardware store → add an item → checkout.
3. Use a **real** card (small amount) OR a Stripe live-mode test card if Stripe supports it for your account.
4. Confirm in Stripe Dashboard → Payments → the charge appears, status `succeeded`.
5. Confirm in Merlin → the order's status flips to `delivered` (the webhook ran `fulfill_paid_order`).
6. Refund the test charge: Stripe Payments → the charge → **Refund** to avoid a real customer-visible mess.

---

## Step 4 — Rollback (if anything fails)

The change is fully reversible. Order matters:

1. Vercel → Environment Variables → edit `STRIPE_SECRET_KEY` → restore the `sk_test_…` value on Production. Save.
2. Trigger a redeploy (empty commit or UI).
3. **Optional:** leave `STRIPE_WEBHOOK_SECRET_LIVE` set. It's dormant when `STRIPE_SECRET_KEY` is `sk_test_…`, so it doesn't hurt; keeping it means re-trying the flip later doesn't need step 1.
4. Pending in-flight LIVE payments (if any): refund manually in Stripe Dashboard. None should exist if rollback is within minutes of the flip.

---

## Step 5 — Post-flip cleanup

Once you're confident live mode is healthy (give it 24h to catch any cron-driven edges):

### 5a. Delete the old LIVE webhook destination on the auto-URL

The Stripe Dashboard probably still has a LIVE webhook destination pointing at `https://merlin-three.vercel.app/api/stripe/webhook` (from before the canonical-domain cutover on 2026-05-13). Delete it:

1. Stripe Dashboard (LIVE mode) → Developers → Webhooks → click the `merlin-three.vercel.app` destination.
2. **⋯** → **Delete endpoint**.

> ℹ️ Until you delete it, every LIVE event Stripe emits gets POSTed to **both** the new canonical endpoint and the old auto-URL endpoint. Both will run `fulfill_paid_order`, but the RPC is idempotent (skips orders already at `status='delivered'`), so duplicate delivery is a wasted invocation rather than a data corruption. Still — clean it up to keep Stripe's "Recent deliveries" panel readable.

### 5b. Update `docs/operations/security-deferred.md` entry 3.1

Mark the section as **resolved** with the date of the flip. The runbook stays; the deferred-items entry shouldn't.

### 5c. Update memory

- `memory/canonical_domain_cutover.md` — strike through bullet #1 (Stripe LIVE webhook).
- `memory/MEMORY.md` `Canonical domain cutover` entry — change "Stripe LIVE webhook + Vercel-set-Primary still pending" to just "Vercel-set-Primary still pending (cosmetic)".

---

## Appendix A — Creating the LIVE-mode webhook destination from scratch

Only relevant if you're starting clean (no existing destination at `merlin.adaptiv.systems`):

1. Stripe Dashboard (**LIVE mode** — toggle OFF Test mode) → Developers → Webhooks → **Add destination**.
2. **Endpoint URL:** `https://merlin.adaptiv.systems/api/stripe/webhook`
3. **Events to send:** select `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`. (Match the TEST-mode destination's event list — same handler code paths.)
4. **API version:** match what we pin in code (`2024-12-18.acacia`, see `api/_lib/stripe.ts`). If Stripe defaults to a newer version, override.
5. Save. The signing secret appears on the new destination's detail page — that's the value for step 1a above.

---

## Appendix B — Why Stripe doesn't tell us if the secret is wrong

Stripe's "Send test event" panel shows the response status from our handler (200 vs 400 vs 5xx) but **doesn't verify the secret on Stripe's side**. The HMAC check happens in our code via `stripeClient().webhooks.constructEvent(raw, sig, secret)`. So:

- Wrong secret → `constructEvent` throws → our handler returns 400 → Stripe's panel shows **400 webhook error**.
- Right secret → `constructEvent` returns an event → our handler dispatches → returns 200 → Stripe's panel shows **200 OK**.

This means you genuinely cannot pre-validate the secret in Vercel without sending an actual event after the flip. That's why this runbook puts verification AFTER the flip in step 3, not before.

---

## Appendix C — Why we can't verify before flipping `STRIPE_SECRET_KEY`

A potential workaround would be: set `STRIPE_WEBHOOK_SECRET_LIVE`, send a test event from the LIVE destination _before_ flipping the key, and confirm the secret is right.

This doesn't work because `webhookSecret()` reads `STRIPE_WEBHOOK_SECRET_LIVE` **only when `STRIPE_SECRET_KEY` starts with `sk_live_`**. While the key is still `sk_test_…`, the handler verifies against the TEST secret. A LIVE-signed test event therefore fails sig verification — but that failure is expected, not a real bug.

The chicken-and-egg is annoying but the cost of trying live mode and rolling back if step 3 fails is ~5 minutes (two redeploys), so it's not worth adding a temporary debug code path.

---

## Related

- Code: [`api/_lib/stripe.ts`](../../../api/_lib/stripe.ts), [`api/stripe/webhook.ts`](../../../api/stripe/webhook.ts)
- Architecture context: [`docs/architecture/hardware-commerce.md`](../../architecture/hardware-commerce.md)
- Tracking entry: [`docs/operations/security-deferred.md`](../security-deferred.md) §3.1
- Prior canonical-domain context: `.claude/projects/.../memory/canonical_domain_cutover.md` (memory; local only)
