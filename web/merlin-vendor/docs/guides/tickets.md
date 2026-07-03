# Working with Tickets

A **ticket** is a follow-able work item. When Merlin dispatches a task to a person — a worker on your team or an external contractor — a ticket is how you follow it through to done: who owns it, what state it's in, when it's due, and the conversation around it.

Merlin already records what it _decided_, the _signal_ that triggered it, and whether a manager _approved_ the action. Tickets close the missing half: the **human side of the loop** — acknowledge → in progress → done — with an owner and an audit trail.

> **Where:** Operations → **Tickets**

---

## What's in a ticket

| Field               | What it means                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title & details** | What needs doing. Auto-filled from Merlin's escalation, or typed in for a manual ticket.                                                              |
| **Priority**        | Urgent / High / Normal / Low — shown as a coloured dot on the left of the card. For Merlin-raised tickets it's mapped from the escalation's severity. |
| **Status**          | Where the work is in its lifecycle (see below).                                                                                                       |
| **Assignee**        | Who's doing it — an external contractor org, or a free-text name (e.g. "Night crew").                                                                 |
| **Due date**        | When it's expected. Past-due, non-closed tickets show an **Overdue** badge.                                                                           |
| **From Merlin**     | A chip marking tickets Merlin raised automatically, versus ones you created by hand.                                                                  |
| **Notes**           | A comment thread on the ticket — both the manager and the assignee can post.                                                                          |

Every ticket also keeps a link back to the Merlin escalation or event it came from, so the trail stays intact — the ticket never replaces that history, it sits on top of it.

---

## Where tickets come from

There are two ways a ticket is created:

1. **Automatically, from Merlin.** When Merlin escalates a task to a human (a security escalation, a job that needs a person on site), a ticket is created for it the moment the escalation happens — priority set from the escalation's severity, status **Open**, with the _From Merlin_ chip. You don't have to do anything; it shows up in the Tickets tab.
2. **Manually.** Click **+ New ticket** to raise one yourself — a task that didn't come from an agent. Give it a title, optional details, priority, an assignee name, and a due date.

> Only Merlin's **human-dispatch** actions (escalations) become tickets — not the things Merlin handles autonomously. The Tickets list stays focused on "something a person needs to do."

---

## The lifecycle

Every ticket moves through these states. The status pill on the card tells you where it is.

```
Open ──▶ Acknowledged ──▶ In progress ──▶ Done
                    └──────▶ Blocked ◀──────┘
                                          (or Cancelled, at any point)
```

| Status           | Meaning                                           |
| ---------------- | ------------------------------------------------- |
| **Open**         | Raised, not yet picked up.                        |
| **Acknowledged** | The assignee has seen it and accepts it.          |
| **In progress**  | Work has started.                                 |
| **Blocked**      | Stuck — waiting on something. Notifies the owner. |
| **Done**         | Completed. Notifies the owner.                    |
| **Cancelled**    | No longer needed (manager only).                  |

The timestamps for _acknowledged_, _started_, and _completed_ are stamped automatically as the status changes — you don't set them by hand.

---

## The manager (owner) view

If you're the facility manager whose building the work is in, each ticket card gives you full control:

> **Where:** Operations → Tickets

- **Set status** — a dropdown with the full lifecycle, including Cancel and re-open.
- **Assign to a contractor** — a dropdown listing the contractor organisations on your contracts. Assigning a ticket notifies that contractor (see [Notifications](#notifications)). You can also leave the free-text assignee name a Merlin escalation came with (e.g. "Night security crew") and assign it to a real contractor later.
- **Due date & priority** — set when you create a manual ticket; drive the overdue badge and sort order.
- **Notes** — add context for the assignee.

**Filters** across the top: **Live** (everything not yet closed), **All**, **Open**, **In progress**, **Done**. There's also a **per-building scope** toggle when you're working in one building — flip it to see only that building's tickets.

The header shows running counts — how many are **live**, how many are **overdue**, and the total.

---

## The contractor / worker (assignee) view

When a ticket is assigned to your organisation, you see it in the same **Operations → Tickets** tab — but scoped to _your_ work, with a simpler set of controls:

- The header reads **"Work dispatched to your team"** and the New-ticket form is hidden — you don't raise tickets, you act on them.
- Instead of a status dropdown, each card shows the **actions you can take right now**: **Acknowledge**, **Start**, **Block**, **Mark done** — whichever apply to the ticket's current state.
- You can post **notes** on the thread.

You can advance your own tickets, but you can't reassign them, change the due date, or edit the details. This isn't just hidden in the screen — the boundary is enforced behind the scenes, so it holds no matter how the ticket is reached.

---

## Notifications

Every ticket event lights the in-app **bell** for the right party:

| Event                           | Who's notified                   |
| ------------------------------- | -------------------------------- |
| Ticket assigned to a contractor | The contractor org               |
| Ticket marked **Done**          | The owner (manager) org          |
| Ticket marked **Blocked**       | The owner (manager) org          |
| Ticket goes **overdue**         | The owner (and assignee, if any) |

The bell always works, with no setup. To _also_ push these events to **email or Slack**, an admin opts the organisation in:

> **Where:** Admin → **Notifications**

- Toggle **Send ticket events** on.
- Add one or more **email recipients** (comma-separated).
- Optionally paste a **Slack incoming webhook URL**.

Once configured, ticket events are sent to those channels in addition to the bell — typically within a few minutes of the event. With nothing configured, the bell is the only channel. Only org **admins** can change these settings.

---

## Due dates & overdue tickets

A ticket with a **due date** that passes without being closed is **overdue**. Two things happen:

1. The card shows a red **Overdue** badge, and the ticket sorts up.
2. Merlin watches ticket age and, shortly after a ticket slips past due, raises an **overdue** notification to the owner — once per ticket, so you're not spammed — which also flows to email/Slack if you've opted in.

This means an overdue ticket reaches you even if nobody happens to be looking at the Tickets tab.

---

## Who can do what

| Action                              | Manager (owner org)  | Contractor / worker (assignee) | Platform admin |
| ----------------------------------- | -------------------- | ------------------------------ | -------------- |
| See the ticket                      | ✅ (their buildings) | ✅ (assigned to them)          | ✅             |
| Create a manual ticket              | ✅                   | —                              | ✅             |
| Assign / reassign                   | ✅                   | —                              | ✅             |
| Set due date & priority             | ✅                   | —                              | ✅             |
| Advance status (acknowledge → done) | ✅                   | ✅ (their own)                 | ✅             |
| Cancel / re-open                    | ✅                   | —                              | ✅             |
| Add notes                           | ✅                   | ✅                             | ✅             |
| Configure email/Slack               | Admins only          | —                              | ✅             |

---

## A typical flow

1. Merlin escalates an after-hours access issue at your building → a ticket appears in **Operations → Tickets**, _From Merlin_, priority High, status **Open**.
2. You open it, set a due date, and **assign it to GuardWatch Security**.
3. GuardWatch's bell lights (and their email, if they're opted in). They open Tickets, hit **Acknowledge**, then **Start**.
4. You both add notes as the job progresses.
5. GuardWatch hits **Mark done** → your bell lights with the completion.
6. If they'd missed the due date instead, Merlin would have nudged you automatically.

That's the whole loop — from Merlin's dispatch to a confirmed _done_, followed every step of the way.

---

_Related: [Working with agents](agents.md) · [Working with SLAs](slas.md) · [The contractor playbook](contractor.md)_
