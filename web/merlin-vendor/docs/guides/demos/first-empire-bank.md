# Demo · First Empire Bank

**The retail-network demo.** A 578-branch retail bank ecosystem across New York State, modeled on real FDIC Chase branch data. One central FM team, one display per branch, hundreds of operationally-similar small sites — a completely different scale profile from a single tower.

> **One-line pitch:** "When you operate 578 branches, you don't supervise individual buildings — you supervise patterns. Merlin makes the patterns visible."

---

## What the demo represents

- **One real-estate tenant** (First Empire Bank) operating 578 branches across NY State, organized into 6 regions (Manhattan, Bronx, Brooklyn, Queens, Staten Island, Upstate).
- **An ecosystem-kind workspace**, not a single building. The picker shows regions as the top-level entities; you drill into a region to see its branches.
- **Branch-scale uniformity.** Each branch has 1 smart-display + 1 sensor cluster + standardized cleaning + restock cadences. The interesting signal isn't per-branch — it's _which branches are drifting from the average_.
- **Aggregate-first surfaces.** My day rolls up across the 578 branches; the attention cards surface the few outliers worth a human glance.

---

## Who to log in as

| Email                   | Role                | What they see                                                                                                |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `robin@adaptiv.systems` | Adaptiv super-admin | Sign in here, then use the **workspace dropdown** (top-right account menu) to switch to _First Empire Bank_. |

> First Empire Bank ships with a streamlined demo user profile — Adaptiv super-admins use the workspace switcher to enter the tenant. The full FM persona set for FEB is on the roadmap for the next demo refresh.

To navigate within FEB, use the **region/branch picker** (top-left of the topbar). Pick a region (e.g. "Manhattan") to scope all surfaces to that region's branches.

---

## What to try (suggested 8-minute tour)

1. **Sign in as Robin → workspace dropdown → First Empire Bank.** Land on My day. Notice the eyebrow reads _"First Empire Bank · 578 branches"_ — the entity Merlin is watching is the network, not a single building.
2. **Read the attention cards.** Expect things like _"Screen offline — Manhattan · 34th St"_, _"Leak signal — Syracuse · Westcott"_, _"Tamper alert — Bronx · Fordham"_. Each card names the branch directly so dispatch is one click.
3. **Pick a region** from the BuildingSwitcher. The picker indents sub-regions with a "REGIONS" subheader and a "Region" pill (distinct from "Ecosystem" for the parent).
4. **Operations → Hypervisor.** Drill: First Empire Bank → Manhattan region → individual branch → its smart display + sensor cluster. Each branch shows as a `kind='branch'` location with lat/long, address, and embedded device list.
5. **Operations → Devices.** Filter by region. 578 smart loggers (one per branch) plus the regional rollup numbers.
6. **Ask Merlin in chat:** _"Which 5 branches have the worst hygiene SLA performance this month?"_ The chat reads the ecosystem aggregate and names specific branches.
7. **Reports.** Pull a regional report to see how the cleaning + supply SLAs land across the 578 branches in aggregate. The cumulative-impact view is the buyer's "what did Merlin save us this quarter" surface.

---

## Demo highlights to call out

- **Scale.** 578 branches is the right number to demonstrate Merlin's pattern-detection value. A 10-branch demo wouldn't surface the same need.
- **Ecosystem ≠ Building.** The data model + UI treat a regional rollup differently from a single tower. The picker, the My day, the Reports tab all aggregate by region first, then drill to branch.
- **Real geography.** Branch addresses + coordinates come from real FDIC FFIEC data (Chase NY branches). The map widget renders them at correct lat/long.
- **Operationally-similar sites.** Because each branch carries the same hardware kit + cadences, the _deviations_ are what matter. Merlin's job is to surface deviations + auto-handle the routine ones.
- **The aggregate view that doesn't exist in spreadsheets.** Try asking the chat: _"Sort branches by SLA breaches this week."_ That's a 30-second answer in Merlin vs. a half-day Excel exercise.

---

## What's seeded in this demo

- 1 ecosystem-kind tenant · 6 regions
- 578 branch locations (real Chase NY data via FDIC)
- 578 smart-display devices (one per branch) + sensor clusters
- Aggregate cleaning + supply SLAs computed across the network
- Static ECOSYSTEM_SNAPSHOT with branch-flavored incidents

---

## Demo replay status

**On replay since 2026-05-17** (`replay_mode=true`, 7-day fixture window). Agent activity that lands on the Activity feed, the My day's "Merlin handled these" panel, and any per-agent decision pill is being **emitted from a captured 7-day fixture** — 421 substantive runs across 7 banking-appropriate agents (cleaning, compliance, supply, energy, security, space, hvac), plus 171 asks. **No live Claude tokens are consumed for this tenant.** What you see is real-shaped activity at zero ongoing cost.

For platform admins: the fixture lives in `demo_fixtures.*`; the replay cron at `/api/agents/replay-tick` fans it back into `public.agent_runs` / `public.merlin_asks` on a 1-minute cadence. Full operational doc at [`docs/operations/demo-replay.md`](../../operations/demo-replay.md).

---

## When to use this demo

- **For retail-network buyers** — bank branches, fast-food chains, dental groups, mall-anchor stores. Any network of N similar small sites.
- **After Meridian HQ.** Once a viewer understands single-building Merlin, "Merlin × 578 branches" lands fast.
- **For pattern-detection skeptics.** Anyone who still does network operations via Excel + email needs to see this.
