# New-tenant onboarding

> Status: **🟢 Shipped (core flow).** The first-login vertical picker shipped as
> `WelcomeModal.jsx` (wired in `App.jsx`) and the Get-started card as
> `GetStartedCard.jsx` (wired in `Briefing.jsx`) — both consume the
> vertical→agent recommendation map (`src/app/vertical-recommendations.js`) and
> track progress in `organizations.setup_progress` (migration 162). The deeper
> per-building data capture grew into the **Setup hub** —
> see [building-setup.md](building-setup.md) (migrations 170–173). The journey
> sketched below is the original design; the shipped UI follows its shape but may
> differ in detail (verify against the components above before treating any
> specific screen as ground truth).

## Problem

After a new user signs up + selects a plan, they land in an empty organization with no buildings, no devices, no agents enabled, no team. They're staring at the same `FirstRunEmpty` empty states we built in May 2026 — which explain what each surface is _for_, but don't tell the user **what to do first**.

The product positions Merlin as an **AI co-worker for buildings**. So the first 10 minutes after signup should feel like that — not a wizard, not a form, but a guided start where Merlin proposes a sensible default kit based on what the user's actually managing.

## The user journey

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Signup +       │ →  │  Vertical        │ →  │  Dashboard with  │
│   plan select    │    │  picker          │    │  "Get started"   │
│                  │    │  (one decision)  │    │  card + agent    │
│   (existing)     │    │                  │    │  enable chips    │
└──────────────────┘    └──────────────────┘    └──────────────────┘
                              ↓ submit
                        Workspace provisioned:
                        - 1 building (named "Your HQ" by default)
                        - locations.variant set
                        - 3 recommended agents pre-marked
                          (NOT enabled — user clicks to enable)
```

The pivot: **picking a vertical is the only mandatory first step**. Everything else is opt-in, from the same surface, at the user's pace.

## Step 1 — Vertical picker

Shown on first login after signup. Six options as a 3×2 grid of cards. One-click submit.

```
┌─────────────────────────────────────────────────────────────────────┐
│   What kind of building(s) are you managing?                        │
│   We'll suggest a starter kit based on your answer.                 │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ 🏢 OFFICE      │  │ 📦 WAREHOUSE   │  │ 🏥 HEALTHCARE  │        │
│  │                │  │                │  │                │        │
│  │ Single tower,  │  │ Distribution,  │  │ Clinic, hosp., │        │
│  │ co-working,    │  │ 3PL, cold-     │  │ dental, lab    │        │
│  │ corporate HQ   │  │ chain logist.  │  │                │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ 🏟  STADIUM     │  │ 🛒 RETAIL      │  │ … OTHER        │        │
│  │                │  │                │  │                │        │
│  │ Arena, concert │  │ Mall, big-box, │  │ Mixed-use or   │        │
│  │ venue, hall    │  │ boutique       │  │ not listed     │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                     │
│  ☐ Skip — I'll set this up later                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**On submit:**

- Insert one row into `locations` — kind=`building`, name=`"${org_name} HQ"`, variant=`<picked vertical's variant>`. Parent set to a default ecosystem if one doesn't exist.
- Write `merlin_config.setup_progress.vertical_picked = <key>`
- Write `merlin_config.recommended_agents = <agent ids from vertical-recommendations.js>`
- Redirect to `/customer` → Dashboard

**On "Skip":**

- Skip the location + recommendation writes
- Set `setup_progress.vertical_picked = 'other'`
- Redirect to Dashboard with the Get started card showing the variant-free default kit

## Step 2 — Dashboard "Get started" card

A slim banner at the top of the Dashboard, above the existing widgets. Shows as long as `setup_progress.done !== true`.

```
┌─────────────────────────────────────────────────────────────────────┐
│  GET STARTED                                                  ✕    │
│  ✓ Building created · Your HQ (office)                              │
│                                                                     │
│  ☐ Enable your first agent                                          │
│    [+ Cleaning]  [+ HVAC]  [+ Space]      see all 7 recommended →   │
│                                                                     │
│  ☐ Connect a data source                                            │
│    Cleaning needs occupancy sensors. Connect a source →             │
│                                                                     │
│  ☐ Invite a teammate                                                │
│    Invite people →                                                  │
│                                                                     │
│  Or chat with Merlin: "Help me set this up" →                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Behaviors:**

- Each `[+ Agent]` chip is a one-click toggle. Click → POST to `merlin_config.agents[<id>].enabled = true` with sensible defaults (`autonomy = 'propose'`, `confidence_floor = 50`). Chip flips to `[✓ Cleaning enabled]` with green check.
- "see all 7 recommended →" expands to show the full recommendations list with rationale text inline.
- The "Connect a data source" copy shows the device-kind hint for whichever agent the user enabled most recently (e.g., "Cleaning needs occupancy sensors").
- "Invite a teammate" opens the existing invite modal.
- Card disappears when `setup_progress.done = true`. User can dismiss via ✕ at any time (also sets done).

**State tracking** in `merlin_config.setup_progress`:

```jsonc
{
  "vertical_picked": "office", // step 1 done
  "first_agent_enabled_at": "2026...", // step 2 done
  "data_source_connected_at": null, // step 3 pending
  "first_invite_sent_at": null, // step 4 pending
  "done": false, // computed or manual dismiss
}
```

## Phasing

| PR       | Scope                                                                                                                   | Risk                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1 (this) | Recommendation map + this doc                                                                                           | Zero — config + design only                         |
| 2        | Vertical picker page (`/customer/welcome`) + submit handler                                                             | Low — new route, no existing surface touched        |
| 3        | Dashboard "Get started" card + agent-enable chips                                                                       | Low — additive widget, existing dashboard unchanged |
| 4        | The chat-hook entrypoint (link from card → Merlin chat with prefilled "help me set this up")                            | Medium — needs chat prefill support                 |
| 5        | Per-step nudges (e.g., "Cleaning enabled → now connect a sensor") + post-onboarding "first agent decision" notification | Medium — touches multiple surfaces                  |

## Open questions

1. **Where does the picker live in the routing tree?** Options:
   - `/customer/welcome` — new route, only shown when `setup_progress.vertical_picked` is null. Pro: clean separation. Con: another customer route to maintain.
   - First-load modal over `/customer` — never a separate URL, just a `<Modal>` on Dashboard when state says "not picked yet". Pro: simpler routing. Con: harder to deep-link / share.
   - Step at the end of the platform-side signup flow on `/auth` — moves the picker out of the customer app entirely. Pro: matches the rest of the signup flow. Con: requires `/auth` to know about agent recommendations (cross-surface coupling).

   **Recommendation:** First-load modal over `/customer`. Lightweight, no new route, doesn't couple `/auth` to product-level concerns.

2. **What if the user changes verticals later?** The `variant` is mutable; the picker could show as an "edit" surface in Admin → Workspace. Recommendations re-compute but already-enabled agents don't get auto-disabled.

3. **What if their plan doesn't include their recommended agents?** Three options:
   - Gracefully drop ineligible agents from recommendations (preferred)
   - Show all recommendations with an "Upgrade" link on locked ones
   - Pop a "your plan doesn't cover X" modal mid-flow

   **Recommendation:** Filter out locked agents from the recommendation list; add a separate "Upgrade for more agents" card below. Avoids paywall friction in the first 5 minutes.

4. **What about contractor orgs?** Contractors don't have buildings — they have contracts that touch other orgs' buildings. The picker should detect `kind = 'contractor'` and skip the vertical question entirely, going straight to a different flow ("Connect your first customer contract"). Filed as a Phase 6 concern.

5. **What happens after `setup_progress.done = true`?** Card vanishes from Dashboard. We probably also want a one-time "Welcome to Merlin" toast or first-week email summarizing what was set up. Filed as Phase 5.

6. **Localization.** The picker labels + descriptions need to flow through `i18n.js`. Filed as Phase 3's last step.

## Decisions JB to make before PR 2

- [ ] Confirm the recommendation pairings in `src/app/vertical-recommendations.js`. The opinionated parts (e.g., "office gets compliance" vs "office doesn't get cold-chain") deserve a read.
- [ ] Confirm the "first-load modal over `/customer`" routing approach
- [ ] Confirm the default autonomy + confidence floor for one-click agent enable (currently `propose` / `50` — both conservative)
- [ ] Confirm whether "Skip" on the picker is acceptable or whether we want to force the choice

Once those land, PR 2 (the picker UI) is ~2-3 hours of work.
