# Your Savings page — margin & opportunities

A hands-on guide to the contractor **Savings** tab (ANTICIPATE → Savings): your
real **margin** per contract, and the **savings opportunities** Merlin can
implement for you — each one driven by your own numbers and your building's real
signals, not a guess.

> **Audience:** the contractor manager who wants to see what each contract
> actually earns and where the next dollar of savings is. For the broader
> contractor picture (contracts, proposals, reports, hardware) see
> [Merlin for contractors](contractor.md); for running several service lines at once see
> [Multi-service contractors](contractor-multi-service.md).
>
> **Status:** live in production. Margin is real once you enter a cost basis;
> opportunity values reflect your real operational signals.

---

## Where it is

Top bar → **ANTICIPATE** → **Savings**. It's a contractor-only view — building
owners have a different (energy/budget) Savings track.

The page is your economics, grouped by service line (Cleaning / Security /
Maintenance / Hospitality), with one card per contract.

---

## The portfolio header

The strip at the top sums your whole book:

- **Monthly revenue** — the total of your active contracts' values.
- **Blended margin** — revenue minus your cost-to-serve, across all contracts,
  with the blended margin %.
- **Savings on the table** — the total monthly value of the opportunities below.
- **Active contracts** — how many you're counting.

A one-line note under the strip tells you, honestly, which numbers are real and
which are estimated (see [How the numbers work](#how-the-numbers-work)).

---

## Real margin — set your cost basis

**Revenue is always real** — it's the contract value the client agreed to.

**Cost-to-serve starts as an estimate** until you tell Merlin your costs. On each
contract card, click **Edit cost basis** and enter four numbers:

| Field            | What it is                                 |
| ---------------- | ------------------------------------------ |
| **Crew**         | How many people you staff on this contract |
| **Rate /hr**     | Their average loaded hourly rate           |
| **Hours /wk**    | Crew hours per week                        |
| **Supplies /mo** | Monthly consumables / materials spend      |

Merlin computes:

```
cost to serve = crew × rate × hours/wk × 4.33 (weeks/mo) + supplies/mo
margin        = revenue − cost to serve
```

A **live preview** shows the resulting cost and margin as you type, so you can
sanity-check before saving. **Save**, and the card's margin, the margin % pill,
and the portfolio "Blended margin" all update to your real numbers — the
"(est.)" label on cost-to-serve disappears.

> **Your cost basis is private.** Only you (the contractor) can read it — the
> client / facilities manager never sees your crew counts, rates, or margins.
> They see the contract value; your cost structure stays yours.

You can update it any time — costs change, and the page follows.

---

## Savings opportunities

Under each contract's margin strip is a list of **opportunities** — concrete
moves Merlin can run to lift your margin, each one expandable to a rationale and
a **step-by-step plan** (typically a 1-week / 2-week / 1-month rollout).

Each opportunity shows a **monthly impact** (e.g. `+$2,100/mo`) and, where it's
grounded in real activity, a provenance line:

> **Reflects 71 emergency signals · 7d**

That number is **live** — it comes from the real events at your contracted
locations over the last 7 days:

- **Emergency signals** — high-severity events (e.g. an SLA breach surge, urgent
  callouts). Drives dispatch / preventive / incident-routing opportunities.
- **Supply requests** — supply/stockout events. Drives auto-replenishment.
- **Security signals** — security events. Drives coverage opportunities.

The more real activity there is, the larger the opportunity — the dollar moves
with your operation (bounded, so it stays sensible). Opportunities with no live
signal show a baseline estimate instead.

### Ask Merlin to draft it

Inside any opportunity, **Ask Merlin to draft this proposal** opens the chat
pre-loaded with a tailored prompt — Merlin writes a client-ready proposal
including the plan, the SLA impact, and the monthly value, addressed to that
client. You review and send.

---

## How the numbers work

Straight answer on what's real:

- **Revenue** — real (the contract value).
- **Cost-to-serve & margin** — real once you enter a cost basis; a labelled
  estimate until then.
- **Opportunity value** — scaled by your **real operational signals** (last 7
  days) from your cost basis. It's a projection — there's no "true" future
  savings number — but it moves with what's actually happening at your sites
  rather than a flat percentage. The provenance line shows exactly what drives
  it.

Nothing here is shared with the client unless you send a proposal.

---

## Try it (demo logins)

All demo accounts use the password **`merlin2026`**.

| Login                        | Who                                   | What you'll see                                                                                |
| ---------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `morgan@apex-facilities.com` | Apex Facilities (multi-service hero)  | 4 contracts on Meridian HQ — real ~26% margins, opportunities driven by the live signals at hq |
| `lisa@sparkleco.com`         | SparkleCo (cleaning, several clients) | Cleaning contracts across tenants, with real margin + cleaning/supply signals                  |

---

## A 2-minute walkthrough

1. Sign in as `morgan@apex-facilities.com` → **ANTICIPATE → Savings**.
2. Read the header: revenue, **blended margin (real)**, savings on the table.
3. On a contract card, click **Edit cost basis**, nudge a number, watch the live
   margin preview, **Save** — the card and the header update.
4. Expand a savings opportunity — note the **"Reflects N … 7d"** provenance and
   the step-by-step plan.
5. Hit **Ask Merlin to draft this proposal** to see Merlin write the
   client-ready pitch.

---

Everything on this page is available in **English or French** — switch the
language and the labels, plans, and provenance all follow.
