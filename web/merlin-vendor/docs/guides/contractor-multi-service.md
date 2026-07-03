# Merlin for multi-service contractors

A hands-on guide to the **multi-service contractor** experience — one contractor company that holds several service lines (cleaning **and** security **and** maintenance **and** hospitality) for a client, and a Merlin that re-tailors itself to whichever line you're working at that moment.

> **Audience:** the contractor manager who runs an integrated facilities team across more than one discipline. For the general contractor picture (contracts, proposals, reports, hardware) see [Merlin for contractors](contractor.md).
>
> **Status:** live in production. Everything below is real on `merlin.adaptiv.systems` today.

---

## What makes it "multi-service"

Most contractors do one thing — SparkleCo cleans, GuardWatch guards. A **multi-service contractor** holds contracts across several disciplines for the same client. The demo hero is **Apex Facilities Group**, which holds all four lines on Meridian HQ:

| Line           | Contract                                            | Monthly |
| -------------- | --------------------------------------------------- | ------- |
| 🧹 Cleaning    | Meridian HQ — Integrated cleaning + supplies        | $26,000 |
| 🛡️ Security    | Meridian HQ — Integrated security + lobby coverage  | $33,000 |
| 🔧 Maintenance | Meridian HQ — Integrated maintenance + asset upkeep | $28,000 |
| 🛎️ Hospitality | Meridian HQ — Integrated reception & guest services | $20,000 |

When Apex logs in, Merlin doesn't show one generic contractor view — it **configures itself to the service line you pick**, and re-tailors the moment you switch lines:

- the **agents** Merlin runs for you,
- the **voice** Merlin uses in chat,
- the forward-looking risk in **ANTICIPATE**,
- and the proactive asks Merlin puts on your **My Day**.

---

## Try it — logins

All demo passwords are **`merlin2026`**.

### The multi-service hero

| Who                                     | Email                        | What you'll see                                                                                                                                         |
| --------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Morgan Hale — Apex Facilities Group** | `morgan@apex-facilities.com` | The full multi-service experience: the **service-line switcher** in the top bar, all four lines, and Merlin re-tailoring as you switch. **Start here.** |

### Single-service contractors (for contrast)

Each runs one discipline — no switcher; Merlin auto-pins to their one line.

| Who                         | Email                          | Discipline            | Clients                                                       |
| --------------------------- | ------------------------------ | --------------------- | ------------------------------------------------------------- |
| Lisa Sparkle — SparkleCo    | `lisa@sparkleco.com`           | Cleaning              | Meridian HQ, First Empire Bank, Campus PSG, Hemisphere Center |
| Malcolm Bryant — GuardWatch | `malcolm@guardwatch.com`       | Security              | …same four clients                                            |
| Erik Norse — NorthStar      | `erik@northstar-maint.com`     | Maintenance           | …same four clients                                            |
| Aria Vance — Sequoia        | `aria@sequoia-hospitality.com` | Hospitality           | …same four clients                                            |
| Sarah Lin — ShineRight      | `sarah@shineright.com`         | Cleaning (deep-clean) | Meridian HQ                                                   |

### The other side of the relationship

To see what the _client_ sees (the building owner who receives your reports and grades your SLAs):

| Who                                        | Email                | What you'll see                                                                                                                                             |
| ------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jamie Lin — Meridian HQ (facility manager) | `jamie@meridian.com` | The owner view: OPERATE → Services boards, the Reports inbox, the contractor scorecard. Note the owner's ANTICIPATE is the _building_ forecast — unchanged. |

> **Tip:** SparkleCo (`lisa@`) is the best login to see **real, computed SLA risk** — its cleaning SLAs at Meridian are wired to live restroom device signals, so its ANTICIPATE shows real breaches. Apex's cleaning line shows real numbers too; its other three lines read "Gathering data" (no device coverage there yet).

---

## The service-line switcher

For a multi-service contractor, a **service-line pill** appears in the top bar next to the building selector:

```
[ 🏢 Meridian HQ ▾ ]  [ 🧹 Cleaning ▾ ]   MONITOR · OPERATE · REPORT · ANTICIPATE · INNOVATE
```

Click it to flip between **Cleaning · Security · Maintenance · Hospitality**. Everything that's service-line-aware re-renders instantly. Single-service contractors don't see the pill — they're pinned to their one line automatically.

> The current line is remembered across the app, so switching it once re-tailors MONITOR, OPERATE, and ANTICIPATE together.

---

## What re-tailors when you switch lines

### 1. The agents Merlin runs (MONITOR → AI Agents)

Each line shows only the agents that matter to it:

| Line        | Agents shown                                                           |
| ----------- | ---------------------------------------------------------------------- |
| Cleaning    | Cleaning & hygiene · Supplies · Compliance · Servicing & SLAs          |
| Security    | Security & safety · Compliance · Servicing & SLAs                      |
| Maintenance | Predictive maintenance · HVAC · Energy · Compliance · Servicing & SLAs |
| Hospitality | Servicing & SLAs · Supplies · Space                                    |

Switch from Cleaning to Security and the grid drops from four agents to three — no HVAC, no supply agent, just what a security operation runs on.

### 2. Merlin's voice (the chat panel)

Open the **Ask Merlin** chat and Merlin speaks in the current line's language. On Cleaning it talks routes, refills, restroom status; on Security it talks patrols, after-hours access, incidents; and it won't volunteer the other lines' detail unless you ask. It always frames things from _your_ side — "our crew", "our SLA at Meridian", "what should I pitch the client".

### 3. ANTICIPATE — "what to get ahead of"

**ANTICIPATE → (the single contractor tab).** Instead of the building-owner forecast, you get a forward-looking view of _your_ accountability for the current line, one card per client contract:

- **SLA risk** — each of your SLAs with its live status (On track / At risk / **Breach**), e.g. _Hygiene — response < 20m: 77% / 98% · Breach_.
- **Service-line signals · last 7 days** — the recent device/agent signals at your client's site that matter to this line (cleaning → hygiene & supply requests, footfall; security → after-hours access, patrol gaps), with high-severity counts and how fresh they are.
- **Renewals & pipeline** — contracts coming up for renewal ("Renews in N days — pitch a renewal") and proposals awaiting the client's decision.

The owner-only ANTICIPATE tabs (Savings, Wellbeing, Compliance, Innovations, building Forecast) are hidden for contractors — you get the one tailored view.

### 4. My Day — Merlin works your queue (MONITOR → Now)

This is the part where Merlin acts as your co-worker. A **servicing agent runs for you** and surfaces proactive asks on your My Day:

> **Maintenance Firesafety — Device 1** · _Device 1 at Meridian HQ. Last serviced 266h ago vs your 168h SLA. Approve a dispatch?_ **[ Approve ]**

It watches the work backlog at your client's sites (for the lines you're contracted on), proposes dispatches when something is slipping its SLA, logs the ones it handles into Activity, and escalates a hard breach into a **ticket** on your queue. Every action is logged; nothing irreversible happens without your **Approve**.

---

## What data you can — and can't — see

Merlin gives you the device and sensor signals at your client's sites **that are relevant to your contracts**, and nothing else. The boundary is strict:

- ✅ You see the live signals, devices, and rooms for buildings covered by one of your **active** contracts.
- ❌ You never see another building the client owns but you don't service, another client entirely, or signals from a _draft_ (not-yet-active) contract.

So Apex — contracted on Meridian HQ — sees Meridian HQ's signals, but not Meridian's warehouse or healthcare buildings (it isn't on those), and not First Empire Bank at all. Apex only ever sees the buildings it's contracted on — nothing from other clients or other buildings.

---

## Contracts, SLAs, reports

These work the same for multi-service and single-service contractors and are covered in depth in **[Merlin for contractors](contractor.md)**. In short:

- **OPERATE → Contractors → Contracts** — your portfolio, revenue run-rate, win rate. Open a contract to see its SLAs and generate a **performance report** (Merlin drafts the narrative; export to PDF; mark as sent to the client).
- **SLAs** — the agreement targets you're graded on, per contract.
- **Reports** land in the client's Reports inbox (sign in as `jamie@meridian.com` to see the receiving end).

---

## A 3-minute demo walkthrough

1. **Sign in** as `morgan@apex-facilities.com` (`merlin2026`).
2. Note the **service-line switcher** ("Cleaning") in the top bar.
3. **MONITOR → AI Agents** — see the 4 cleaning agents. Flip the switcher to **Security** → the grid re-tailors to 3.
4. **MONITOR → Now** — see Merlin's **asks on your My Day** ("…vs your 168h SLA. Approve a dispatch?") with Approve actions.
5. **ANTICIPATE** — the tailored "what to get ahead of" view: SLA risk, last-7-day signals, renewals. Switch lines and watch it change.
6. **Ask Merlin** (chat) "Where am I most at risk and what should I do first?" — it answers in the current line's voice, grounded in your contracts.
7. **OPERATE → Contractors → Contracts** — open the Meridian cleaning contract, **Generate monthly** report, **Draft with Merlin**, **Export PDF**.
8. (Optional) Sign out, sign in as `jamie@meridian.com` → **REPORT** to see the report arrive on the client's side.

> Everything is in **English or French** — toggle the language and the whole contractor surface (switcher, ANTICIPATE, signals) follows.
