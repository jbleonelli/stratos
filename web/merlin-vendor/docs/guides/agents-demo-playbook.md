# Demo playbook for agents

A 15-minute checklist for making the agents look great in a live demo. Covers the five minutes of prep before someone joins the call, the order to walk through the workspace, and how to reset after.

This is a Super Admin doc — every control mentioned lives in **Agentic** (gear menu → Agentic).

---

## 0. Know which mode the workspace is in (read this first)

Workspaces run in one of two modes. The right tuning steps depend on which:

### Replay mode (`replay_mode=true`)

Agent activity is **emitted from a captured fixture** by the replay-tick cron every minute. **No live Claude tokens are consumed.** What you see is real-shaped activity at **$0/day**.

Currently on replay:

- **Meridian HQ** (captured 2026-05-17; ~14,500 runs + 5,000 asks)
- **First Empire Bank** (captured 2026-05-17; 421 substantive runs + 171 asks across 7 banking-appropriate agents)

For replay-mode workspaces, the cadence controls in section 2 below **do not apply** — the replay-tick fires once a minute regardless. Skip section 2 entirely. Section 3's narrative still works because the emitted activity looks identical to a live tenant from the user's perspective.

### Live mode (`replay_mode=false` or NULL)

Agents run the real think-loop against the Claude API. Cost scales with cadence + workspace size. Section 2's tuning matters here.

Currently on live:

- **International Monetary Fund** — variant='imf', internal-only. Note: signal seeding isn't yet producing reactable input for `variant='imf'` rooms, so agents currently emit only `decision='skip'`. Don't lead the demo with the autonomous-loop arc on IMF; lead with Deployments + Insights instead. See [demos/international-monetary-fund.md](demos/international-monetary-fund.md).
- **SparkleCo (contractor)** — no captured activity yet.

To check / flip mode, see [`docs/operations/demo-replay.md`](../operations/demo-replay.md).

---

## 1. Pick the workspace

Five demo bundles available via `/platform/marketing/demo` (which sends a branded prospect invite + EN/FR PDF):

| Bundle                               | Vertical / Shape                                | Best for                                                                      |
| ------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| **Meridian HQ**                      | Single office tower                             | Steady-state ops, the classic narrative. **On replay.**                       |
| **Meridian Distribution East (MDE)** | Warehouse (`variant='warehouse'`)               | Cold-chain + supply-chain story. **On replay** (under Meridian org).          |
| **Meridian Health Clinic (MHC)**     | Healthcare (`variant='healthcare'`)             | Compliance + pharmacy-temp story. **On replay** (under Meridian org).         |
| **First Empire Bank**                | Retail network of 578 branches (ecosystem-kind) | Pattern detection across many small sites. **On replay.**                     |
| **International Monetary Fund**      | Campus, 2 buildings (`variant='imf'`)           | Multi-building enterprise. _Internal-only._ **Live mode (limited activity).** |
| **Contractor (SparkleCo)**           | Contractor self-serve                           | Intelligence loop, contractor side. **Live mode.**                            |

Load the demo before the meeting starts. If you're already signed in, switch via the user menu → Switch workspace.

---

## 2. Tune for impact — LIVE-MODE WORKSPACES ONLY (about 5 minutes)

This section applies to **live-mode** workspaces (today: IMF, SparkleCo). If you're demoing Meridian or FEB, skip ahead to section 3 — replay-mode cadence is fixed at 1 minute and isn't tunable from the Agentic page.

The Agentic page has two cards at the top of the **Agents** tab that change how alive the workspace feels:

### Tick frequency

How often agents think. Default is every 15 minutes — fine for production, too slow for a demo.

| Cadence      | Cost/day | Use it for                                |
| ------------ | -------- | ----------------------------------------- |
| Every minute | ~$2.02   | Live demo with active narration           |
| Every 2 min  | ~$1.01   | Live demo, more relaxed                   |
| Every 5 min  | ~$0.40   | Background demo (showing visitors around) |
| Every 15 min | ~$0.13   | Default — leave on after the demo         |
| Hourly       | ~$0.03   | Long-running demo workspace overnight     |
| Suspended    | $0       | Park the workspace between demos          |

Hit Save. The cron picks up the new cadence within a minute.

### Data simulator

How often synthetic events get injected so the agents have something to react to. Default is every 10 minutes — bump it up if the agents need fresh signal mid-demo.

| Cadence      | Events/day | Use it for                                  |
| ------------ | ---------- | ------------------------------------------- |
| Every minute | ~2,880     | Firehose — only when stress-testing         |
| Every 2 min  | ~1,440     | Live demo, agents will see new signal often |
| Every 5 min  | ~576       | Lively background activity                  |
| Every 10 min | ~288       | Default                                     |
| Suspended    | 0          | Quiet workspace (real signal only)          |

For most demos, **Tick = 2 min + Data simulator = 2 min** gives a workspace that feels alive without going nuts.

### (Optional) Tighten autonomy on one or two agents

If you want to demo the full autonomous loop, set the **HVAC agent** to **Auto low-risk** before the demo. It'll act on temp drift without waiting for approval — exactly the kind of thing that demos well. Leave Cleaning / Compliance / Security on **Approve critical** so you have asks to walk through.

---

## 3. Walk the demo

The narrative arc the agents support best, in order:

### a) The Dashboard, top-down

Open **MONITOR → AI Agents**. The KPI strip across the top tells the story in one glance:

- **Active agents N / total** — how many of the workspace's enabled agents are thinking right now (count varies by tenant: Meridian-HQ has 7, MDE adds cold-chain, MHC adds pharmacy-temp; FEB has 7 banking-appropriate agents)
- **Actions today** — what they've already done
- **Pending asks** — what's waiting on a human

Talk through the live action pills on each card ("HVAC just dialed Zone 32-E down by 1°C two minutes ago"). Click the chevron on any card to expand its full timeline of decisions today.

### b) The autonomous loop

If you set HVAC to Auto low-risk in step 2, point at its card. Within a minute or two of new signal, you should see a fresh `-X°C in Zone Y` pill appear. Open the timeline to show the act decision with the model's full reasoning. Click through to **Operations → Hypervisor** to show the corresponding zone if you want to ground it visually.

### c) The human-in-the-loop

Open the **Merlin chat** (right-side panel) and switch to the **Activity** tab. Show a few pending asks — anything with a "from <Agent> agent" pill underneath. Click that pill to deep-link to the originating agent's runtime card. Read the reasoning out loud — it sounds like a person.

Click **Approve** on one. Two things happen:

1. The pill disappears from chat (resolved).
2. Within seconds the corresponding agent card's pill flips to a fresh entry — the agent's proposed action just landed in its downstream table for real.

### d) The learning loop

Refresh the agent's expandable timeline. The most-recent `ask` row now carries a "(human approved this ask)" suffix. The agent will reason about that outcome on its next tick — show this by waiting one cycle and reading the new top-of-timeline reasoning, which should explicitly cite the prior approval.

### e) Cost transparency

Two flavors here, by mode:

- **Replay mode workspaces (Meridian, FEB):** Show `/platform/internal/costs` or the daily cost-watchdog cron output. Point at the $0/day line item for these tenants — the replay-tick fires SQL only, no Anthropic API calls. The whole demo of activity, asks, autonomous acts you just walked through cost the company exactly nothing in tokens.
- **Live mode workspaces (IMF, SparkleCo):** Back to Agentic → Tick frequency. Point at the live cost preview — even at "every minute" the cost is bounded (~$2-3/day for a typical workspace running 7-9 agents continuously). Prompt caching on the system prompt (PR #401) keeps this in check.

---

## 4. Reset after the demo

Two clicks:

1. **Tick frequency** → Every 15 minutes → Save
2. **Data simulator** → Every 10 minutes → Save

Or, if you're done with the workspace entirely:

1. **Tick frequency** → Suspended → Save (confirms a $0/day pause)
2. **Data simulator** → Suspended → Save

Suspended workspaces stay frozen until you flip them back on — useful if the same workspace is going to be demoed again next week and you want it untouched.

---

## Common gotchas

**The agents keep deciding "skip" no matter what I do.** The agents are conservative by design and look at their own recent_runs to avoid duplicating themselves. If recent runs have lots of "I already addressed this" reasoning about a particular signal, the model will keep skipping. Bump the Data simulator to a higher cadence to inject fresh, varied signal — the model will eventually find something new to act on.

**An agent asked but the Approve button doesn't seem to do anything.** Check that the ask carries a "from <Agent> agent" pill — that's an agent-pushed ask. Approving fires the proposed action; you should see it land on the agent's card pill within a second or two. If nothing changes, the agent's reasoning probably didn't include a concrete action object (rare since the K-17 prompt fix, but possible for edge cases).

**Cost looks higher than expected.** Check both Tick frequency and Data simulator. Tick is the dollars axis; Data simulator is technically free (just inserts) but more events lead to more `act` decisions which lead to more downstream rows. Either way, dropping Tick back to 15 min puts you under $0.20/day per workspace.

**The Agentic save button greyed out for one of the cadence cards.** That means draft equals what's currently live — pick a different cadence first, then Save lights up.

---

## Quick "before / after demo" checklist

Print or screenshot this:

```
BEFORE
□ Pick workspace (Meridian HQ / MDE / MHC / FEB / IMF / SparkleCo)
□ Check replay mode (see section 0) — replay workspaces skip the tuning step
□ LIVE only: Agentic → Tick frequency → Every 2 minutes → Save
□ LIVE only: Agentic → Data simulator → Every 2 minutes → Save
□ (Optional, LIVE only) HVAC autonomy → Auto low-risk
□ Open MONITOR → AI Agents
□ Open Merlin chat → Activity tab

DURING
□ Walk the KPI strip
□ Show one autonomous act (HVAC or Cleaning)
□ Approve one ask in chat
□ Show the timeline learning the resolution

AFTER (LIVE-mode workspaces only)
□ Tick frequency → Every 15 minutes → Save
□ Data simulator → Every 10 minutes → Save
□ (Or both → Suspended if parking the workspace)

AFTER (REPLAY-mode workspaces — no reset needed)
□ Replay continues at 1-min cadence indefinitely at $0/day. Nothing to do.
```
