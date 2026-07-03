# Sentry alert rules — what to page on, what to ignore

**Last updated:** 2026-06-24 (added spend-breach + cron-failure rules — G3) · **Owner:** Adaptiv founding team
**Sentry project:** [adaptiv-systems / javascript-react](https://adaptiv-systems.sentry.io)

Tier 3.3 of [engineering-maturity.md](engineering-maturity.md). Sentry
has been live in prod since 2026-05-05, capturing errors with
`user_id` + `org_id` + `impersonating` tags, but there are **no alert
rules configured yet**. This doc says what to wire up and what to
deliberately ignore.

---

## Survey of current errors (2026-05-13 snapshot)

34 unresolved issues, 7-day window. Patterns:

| Pattern                                                                       | Issues                                                                                             | Action                                                                                                                                                                                   |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ReferenceError: <X> is not defined`                                          | 9 (LazyFallback, onOpenHelp, PlatformSubNav, GROUPS, isFebStyle, useRef, windowDays, AgentLiveRow) | Mostly stale — caused by intermediate-state pushes before the CI gate landed (PR #240). All future occurrences are genuine and should page.                                              |
| `cannot add postgres_changes callbacks for realtime:<topic>`                  | 8 (slas, agent_runs, agent_actions, merlin_asks, event_firehose, marketplace_vendors)              | **Known gotcha** — Supabase channel-topic dedup ([MEMORY](../../.claude/...)). Needs a code fix (extract `useAuthAwareCache` helper, suffix topics with `useId()`). Don't alert on this. |
| `Failed to fetch dynamically imported module`                                 | 3                                                                                                  | Caught by `LazyChunkBoundary` (PR #250) going forward. Don't alert.                                                                                                                      |
| `Rendered more hooks than during the previous render`                         | 2                                                                                                  | Real React bug. Worth alerting on (rare = high signal).                                                                                                                                  |
| `Lock "lock:sb-...-auth-token" was released because another request stole it` | 1                                                                                                  | **Benign** — known auth-lock race ([MEMORY](../../.claude/...)). Suppress.                                                                                                               |
| `Failed to fetch` (generic)                                                   | 1                                                                                                  | Mostly network blips. Don't alert.                                                                                                                                                       |

**Triage to do before turning on alerts:**

1. Mark the 9 `ReferenceError` issues as **Resolved** (they're all from intermediate pushes; CI gate prevents recurrence).
2. Mark the 3 chunk-load errors as **Resolved in next release** (PR #250 ships the recovery).
3. Add **inbound filters** for the noise classes (see below) so they never re-fire.

---

## Recommended alert rules

Configure in Sentry → Alerts → Create alert. Six rules cover the
high-signal cases without flooding the channel.

### 1. New issue type (high signal — every unknown error class)

**When:** A new issue is created
**Trigger:** First seen at any event count
**Notification:** Slack `#eng-alerts` (or email if no Slack yet)
**Frequency:** Once per issue, ever

Rationale: any error class we haven't seen before is worth a glance.
The volume is low (~3-5/week historically) — high signal per ping.

### 2. ReferenceError spike (medium signal — CI bypass detector)

**When:** An issue is seen by more than 1 user
**Filter:** `error.type:ReferenceError`
**Trigger:** > 3 users affected in 1 hour
**Notification:** Slack `#eng-alerts`

Rationale: `ReferenceError` should be ~zero after the CI gate. Any
spike means either a hotfix-merged-without-CI or a real production
regression that slipped through. Multi-user threshold avoids paging on
single-tab flukes.

### 3. Stripe webhook errors (high signal — revenue path) — LIVE 2026-06-24

**When:** A new/escalating/regressing issue tagged `function_name:stripe-webhook`
**Filter:** `function_name:stripe-webhook`
**Trigger:** Any (new issue / escalates / resolved→unresolved)
**Notification:** Member → jbleonelli (email; no Slack configured)

Rationale: Stripe retries webhooks 24h on failure. A persistent
webhook error means a charge succeeded but our DB doesn't know it
(unfulfilled order or unrecorded refund) — direct revenue impact.
Once per occurrence is fine; this should approximate zero in steady
state. We filter on `function_name:stripe-webhook` (the `wrapHandler`
tag set in `api/stripe/webhook.ts`) rather than `transaction:` — the
tag is set explicitly on every captured throw, whereas Sentry's
transaction-name inference is less predictable. Created in the Sentry
dashboard (no Sentry API exists), mirroring rules 5/6.

### 4. Error spike (catch-all backstop) — LIVE 2026-06-24

Implemented as a Sentry **Metric Monitor** (detection) + a **connected
issue alert** (notification) — the new Monitors model splits the two.

**Metric Monitor** "Number of errors above 100 over past 1 hour":

- **Dataset/visualize:** Errors · `count()` · filter `is:unresolved`
- **Interval:** 1 hour · all environments
- **Threshold:** static, High priority `Above 100` (auto-resolves at ≤100)

**Connected alert** "Notify jbleonelli": WHEN new issue / escalates /
resolved→unresolved → notify member jbleonelli (email).

Rationale: catches "something is wrong but I don't know what" — a
deploy that turns red, a Supabase outage, a Stripe-API rate-limit
storm. Threshold calibrated to **100/hr** against the observed
baseline (near-zero on the `is:unresolved` series, with a lone ~300
spike around Jun 20) — comfortably above noise so it only fires on
real incidents. The `is:unresolved` filter keeps resolved/ignored
background errors (e.g. the high-volume `WebSocketFactory` warning)
out of the count. NB the monitor only **creates an issue**; the
connected alert is what pages — and the monitor's issues also trip
the existing project alerts ("New issue type", "high priority
issues"), so coverage is redundant by design.

### 5. Claude spend breach (high signal — cost runaway) — G3

**When:** A new event with `tags.alert = claude_budget_breach`
**Filter:** `alert:claude_budget_breach`
**Trigger:** Any
**Notification:** Slack `#eng-alerts` AND email

Rationale: the daily budget watchdog (`api/cron/check-claude-budget`,
runs 02:00 UTC) emits this `captureMessage` when any org exceeds the
per-org cap (default $10/day) or the system total exceeds its cap
(default $50/day) — the cost-runaway class we actually lived through
(a demo org stuck at 1-min tick cadence). The message is stable so it
groups into one issue; read the event's `extra` for the day, totals,
and the per-org breach list. This is the Sentry counterpart to the
existing email + `platform_audit` breach records, so the alert fires
even if Resend is unconfigured. NB the **per-request** spend
circuit-breaker (`claude-spend-guard`, $5/hr·$30/day) is the real-time
hard stop; this daily watchdog is the after-the-fact backstop.

### 6. Cron handler failure (high signal — silent automation) — G3

**When:** An event whose `tags.function_name` is a cron handler
**Filter:** `function_name:check-claude-budget OR function_name:cron-* OR function_name:agents-*`
**Trigger:** Any (per distinct issue)
**Notification:** Slack `#eng-alerts`

Rationale: crons fail silently — no user sees a 500, so a broken
watchdog/agent/billing-sync can rot for days. `wrapHandler` already
tags every captured throw with `function_name`, so this rule just
routes those to a page. Transient upstream blips are deliberately NOT
captured (the handlers return a quiet 503 — see `api/_lib/transient.ts`),
so anything that reaches Sentry from a cron is a real failure.

---

## Recommended inbound filters (suppress noise)

Configure in Sentry → Project Settings → Inbound Filters. These
prevent the listed errors from creating issues at all (saves quota +
keeps the inbox readable).

### Suppress 1: Supabase auth-lock race (known benign)

**Match:** `error.value:"Lock \"lock:sb-*-auth-token\" was released"`
**Action:** Discard

The auth-lock contention is a Supabase-side race we mitigate via the
in-flight refresh dedupe in `auth.js`. The browser auto-recovers. No
user impact. Don't fill the inbox.

### Suppress 2: `cannot add postgres_changes callbacks` (until code fix)

**Match:** `error.value:"cannot add * postgres_changes callbacks"`
**Action:** Discard

Known channel-topic dedup gotcha. Until the `useAuthAwareCache`
helper extraction lands, suppress to keep the inbox clean. **Re-enable
this filter as alert once the code fix ships** — at that point any
new occurrence is a real regression.

### Suppress 3: Chunk load errors (LazyChunkBoundary handles them)

**Match:** `error.value:"Failed to fetch dynamically imported module"`
**Action:** Sample at 5%

Boundary auto-reloads. We don't need every occurrence in the inbox
but 5% sampling lets us spot "the boundary stopped working" if the
sampled count spikes.

---

## Step-by-step setup

1. Open https://adaptiv-systems.sentry.io/alerts/rules/.
2. Click "Create Alert Rule" → choose "Issue Alert" → fill the
   rules above.
3. Open https://adaptiv-systems.sentry.io/settings/javascript-react/filters/
   → "Custom Filters" tab → add the three suppress rules.
4. Triage the existing inbox: resolve all `ReferenceError` issues
   (they're stale), and the chunk-load errors (PR #250 fixes them
   going forward).
5. Once the channel-topic dedup code fix ships: re-enable the
   suppressed `postgres_changes` filter as an alert instead.

---

## What this gets you

- **High-signal pages only.** Slack `#eng-alerts` should see ~1-2
  pings/week in steady state, ~10/week during active product work.
- **No alert fatigue.** The known-benign noise classes are filtered
  at the inbound layer, not the alert layer — they don't show up at
  all.
- **Revenue-path protection.** Stripe webhook errors page
  immediately; everything else is "look when you have a moment."

When the team grows past 2-3 engineers, this should evolve:

- Add PagerDuty integration for #3 (Stripe) only — that's the
  one that warrants 2am wake-ups.
- Per-team routing (frontend errors → frontend on-call, backend →
  backend on-call). Single-channel works fine at current size.
