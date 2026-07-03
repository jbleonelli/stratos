# Demo · Contractor (SparkleCo)

**The other side of the FM relationship.** Merlin's contractor shell shows the same data Meridian's FM sees, _from the contractor's perspective_ — their portfolio of contracts, their crew, their proposals, their monthly reports.

> **One-line pitch:** "Your facility manager and your contractor are looking at the same Merlin, from different sides. The contract is the contract — but both sides finally see the same numbers."

---

## What the demo represents

- **One contractor-kind tenant** (SparkleCo Cleaning Services) delivering services to one or more FM clients.
- **A live contract with Meridian HQ** — SLA-tracked cleaning + supply delivery across the 50-floor tower.
- **A portfolio-aware view.** SparkleCo's Lisa doesn't see Meridian's HVAC drift or security badge events — only the slice of the data that touches her contracted services (cleaning, supply).
- **The contractor intelligence loop:** SLA performance → AI-suggested proposals → manager review → frozen monthly reports → SLA-delta attribution → renewal recommendations.

---

## Who to log in as

Password **`merlin2026`** unless noted.

| Email                      | Role                                       | What they see                                                                                                                                       |
| -------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lisa@sparkleco.com`       | Contractor manager (Ops lead at SparkleCo) | The full contractor shell — Contracts, Proposals, Reports, Crew utilization, Buildings they service, Hardware orders, Contractor-flavored Insights. |
| `sarah@shineright.com`     | ShineRight contractor admin                | A second contractor with their own contract on Meridian — useful for showing multi-contractor competition on one FM client.                         |
| `erik@northstar-maint.com` | NorthStar Maintenance admin                | Third contractor — maintenance specialty.                                                                                                           |
| `malcolm@guardwatch.com`   | GuardWatch Security admin                  | Fourth contractor — security specialty.                                                                                                             |

> **Important:** When Lisa signs in, Merlin's chat persona swaps to _contractor-portfolio mode_ — the system prompt is portfolio-aware, references contracts by name, talks about win rate + crew utilization + renewals. Same Merlin, different point of view.

---

## What to try (suggested 8-minute tour)

1. **Sign in as Lisa.** Land directly on Operations → Contracts. The top of the page shows lifetime revenue, run rate, win rate, median FM decision time, biggest pilot improvement this quarter. This is Lisa's executive summary.
2. **Click into the Meridian HQ contract.** See live SLA performance per metric (cleaning hygiene response, supply stockouts) plus a Merlin's-take recommendation: _"Based on the last 90 days, you're tight on the 20-minute hygiene SLA — consider proposing a dispatch-cadence change for floors 28-32."_
3. **"Draft proposal with Merlin"** — one click pre-fills a proposal with the recommendation, suggested vendor partners (from the Innovate marketplace), and projected SLA-delta. Edit the proposal, save it as a draft, or send it to Meridian.
4. **Operations → Proposals.** Symmetric to the FM-side inbox. See the state machine — draft, sent, viewed, accepted/declined/counter, accepted with monthly_value_delta auto-amending the contract.
5. **Operations → Reports.** Frozen monthly shareback reports. Each one is auto-narrated by Merlin (the `contractor_note` field is pre-filled from the month's SLA data + accepted proposals). Lisa edits the narrative if she wants; otherwise the report is one-click-send.
6. **Operations → Utilization.** Per-crew load vs capacity — overbooked / tight / headroom. Helps Lisa decide who to propose for new scope.
7. **Operations → Hardware.** Lisa can browse Adaptiv's device catalog, cart hardware, place a real Stripe-Checkout order, and (once paid) install the units into the FM client's building — fully self-serve.
8. **Ask Merlin in chat:** _"What should I propose to Meridian for renewal?"_ — the contractor chat persona pulls together the year's accepted pilots + cumulative SLA-impact deltas + the renewal window if end_date ≤ 60d.

---

## Demo highlights to call out

- **Same Merlin, opposite sides.** Meridian (Jamie) sees their contractor performance from the FM side; SparkleCo (Lisa) sees their portfolio from the contractor side. Both views are live, both touch the same contracts table — but the UI, language, and proposed actions are tuned to each side.
- **AI-suggested proposals grounded in real SLA data.** Not generic playbook copy — recommendations pull from the contract's actual 90-day performance.
- **State-machined proposals.** Draft → sent → viewed → accepted/declined/counter. Both parties see the same state in real time. Accepted proposals with a non-zero monthly_value_delta auto-amend the contract.
- **Frozen monthly reports** with Merlin's-take narration. The contractor doesn't have to handwrite a recap every month — Merlin generates the first draft from the data.
- **Renewal cycle.** When a contract end*date is within 60 days, the contract drawer offers *"Draft renewal with Merlin"\_ — pre-fills a renewal proposal grounded in the year's accepted pilots + cumulative SLA-impact deltas.
- **Contractor self-serve hardware.** Lisa can buy + install Adaptiv devices into the FM's building — fully end-to-end (Stripe Checkout → webhook → fulfillment → install). The FM doesn't have to procure on the contractor's behalf.

---

## What's seeded in this demo

- 4 contractor-kind tenants (SparkleCo, ShineRight, NorthStar Maintenance, GuardWatch Security)
- Each with an active contract on Meridian HQ
- Live SLA performance per contract
- Pre-seeded proposals + monthly reports in various states (draft / sent / accepted / declined)
- Contractor-flavored Insights (filtered to cleaning + supply categories for Lisa)
- Multi-contractor scorecard view on the FM side (Operations → Contractors)

---

## When to use this demo

- **When the audience is a contractor or a multi-contractor procurement lead.** The contractor shell is the right starting point.
- **After Meridian HQ**, to show the relationship side. Once a viewer has seen Jamie's view, flipping to Lisa's view shows the same contract from the opposite angle.
- **For health-system + retail-network contractor procurement.** The model holds across verticals.
