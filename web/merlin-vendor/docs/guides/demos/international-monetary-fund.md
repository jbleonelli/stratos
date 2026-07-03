# Demo · International Monetary Fund

**The small-enterprise campus demo.** Two HQ buildings in Washington DC for a single institutional tenant. Smaller than a retail network, bigger than a single building — the _2-building campus_ shape that covers a huge slice of mid-market real estate.

> **One-line pitch:** "Two buildings, one ops team, one Merlin workspace. Most enterprises live here — not in 50-floor towers and not in 500-branch networks."

---

## What the demo represents

- **One real-estate tenant** (International Monetary Fund) operating 2 HQ buildings in Washington DC.
- **A campus-scale ecosystem.** Smaller than First Empire Bank (network of similar small sites) but multi-building rather than single-tower like Meridian.
- **Mixed device footprint.** ~174 displays + ~49 sensors across the two buildings — a deployment that's mid-rollout, with active firmware + provisioning work visible.
- **Deployment-in-progress story.** The IMF demo includes rollouts (firmware reflashes, battery swaps, people-counter commissioning) that show what Merlin looks like during active hardware change — not just steady-state operations.

---

## Who to log in as

| Email                   | Role                | What they see                                                                                 |
| ----------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `robin@adaptiv.systems` | Adaptiv super-admin | Sign in here, then use the **workspace dropdown** to switch to _International Monetary Fund_. |

> Like First Empire Bank, the IMF demo currently relies on Adaptiv super-admin workspace switching. Per-role FM personas for IMF are on the roadmap for the next demo refresh.

---

## What to try (suggested 6-minute tour)

1. **Sign in as Robin → workspace dropdown → International Monetary Fund.** The eyebrow reads _"IMF · Washington, DC · 2 buildings"_.
2. **Read the attention cards.** Mixed mid-rollout incidents — _"HQ2 Fl 11 East RR Men · SDG00296 firmware reflash"_, _"HQ1 Fl 10 + Fl 11 · Battery swap (4 displays)"_, _"HQ1 Fl L Entrance · People Counter commissioning"_. These are deployment-state issues, not steady-state.
3. **Operations → Hypervisor.** Drill IMF → HQ1 + HQ2 → floors → rooms. Smaller location tree than Meridian HQ — easier to fit on one screen.
4. **Operations → Deployments.** This is where the IMF demo shines. See the rollout pipeline: provisioning queue (which devices arrived from Adaptiv), install calendar (which installs are scheduled this week), and rollout status cards.
5. **Operations → Reports.** Pull a report. IMF's reporting surface includes deployment progress alongside the usual SLA performance — the campus is mid-deployment.
6. **Ask Merlin in chat:** _"What's the status of the SDG firmware rollout?"_ or _"Which devices are still unpaired?"_
7. **Insights.** Open the Insights tab. IMF has 8 insights covering reliability (people-counter data quality, display battery aging), space (crew route rebalancing based on people-counter data), and supply chain (ADX-SDG-7 buffer reorder).

---

## Demo highlights to call out

- **Operations + Deployments side-by-side.** Most demos focus on steady-state ops. IMF shows what Merlin looks like when you're mid-rollout — provisioning queue, install calendar, rollout status, the full deployment flow.
- **Mid-market scale.** Most enterprises run 2–10 buildings. IMF is the right shape to demonstrate the campus pattern.
- **Deployment intelligence.** Merlin surfaces device-quality issues (sensor drift on a specific counter) and recommends fleet-wide changes (auto-flag + recalibration rules) — not just "fix this one device."
- **People-counter-driven insights.** With 14 people counters across 2 buildings, Merlin can show traffic patterns that drive crew routing recommendations.

---

## What's seeded in this demo

- 1 ecosystem-kind tenant · 2 HQ buildings · floor/room hierarchy
- ~174 displays + ~49 sensors across both buildings
- Mid-rollout provisioning queue + install calendar + rollout cards
- 8 insights (people-counter data quality, display battery aging, traffic-driven crew rebalancing, SDG buffer reorder)
- 3 active rollouts (firmware reflash, battery swap campaign, people-counter commissioning)
- Static IMF_SNAPSHOT with deployment-flavored incidents

---

## Demo replay status

**NOT on replay yet.** Unlike Meridian and First Empire Bank, IMF is currently still on the live agent tick. **Heads-up before demoing:** as of 2026-05-17, IMF's 1,611 captured agent runs are all `decision='skip'` with `cost_usd=0` — i.e. heartbeat-only, no `ask` decisions, no autonomous acts. The seed-signal pipeline doesn't yet produce reactable input for the `variant='imf'` rooms, so agents have nothing to react to. The My day's "Merlin handled these" panel will look quiet on this tenant.

What this means in practice:

- **Don't lead with the autonomous-loop or human-in-the-loop arc** on IMF — show those on Meridian or FEB first.
- **Do lead with Deployments, Insights, and the campus hierarchy** — IMF's deployment story is what shines.
- **Roadmap:** investigate seed-signal coverage for `variant='imf'`, then capture IMF the same way FEB was (live for ~1 week of real activity → `demo_capture_org()` → thin skips → flip `replay_mode`).

Until then, IMF stays on the live tick — cost is currently negligible because no agent is making non-skip decisions, so nothing hits Claude.

---

## When to use this demo

- **For mid-market enterprise buyers** — anyone running 2–10 buildings rather than one tower or 500 branches.
- **For COOs evaluating hardware rollout pain.** IMF demonstrates the Operations + Deployments overlap.
- **As a contrast to Meridian HQ.** Meridian shows steady-state operations on one big building; IMF shows mid-rollout on a multi-building campus.
