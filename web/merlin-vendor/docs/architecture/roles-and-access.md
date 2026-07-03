# Roles and access

Merlin is designed for several different kinds of people: the property owner, the facility manager, the cleaning lead, the HVAC tech, the security guard, and contractors running services on behalf of owners. This guide explains who's who, what each role sees, and how to give the right access to the right person.

---

## Who uses Merlin

Most buildings have several distinct kinds of users, each with a different job to do. Merlin shows each person the view that makes sense for their work — a cleaning lead doesn't need to see badge logs, and a security guard doesn't need to know about floor polish rotations.

### Super Admin

The workspace owner. Typically one or two people per organization. Sees everything, can change everything.

- Invites and removes users
- Creates buildings and ecosystems
- Configures how autonomously Merlin operates
- Reviews cross-building metrics and costs

### Facility Manager

The person responsible for a building's day-to-day operations. Runs the workspace hands-on.

- Sees all domains: cleaning, HVAC, security, energy, supply
- Manages zones, routes, team rosters
- Sets SLA thresholds and approves Merlin's decisions
- Reviews incidents and overrides

### Cleaning Services

Lead custodians and their crews. Focuses on restroom cleanliness, supply levels, and today's work.

- Sees cleaning-relevant incidents only (hygiene, supply, amenity)
- Reads their crew's daily route and checklist
- Logs overrides when plans change (someone called out, spill reported)
- Flags supply shortages

### Building Maintenance

HVAC techs, electricians, plumbers, and elevator vendors. Focuses on infrastructure.

- Sees HVAC setpoints, air quality, water leaks, elevator status
- Reads today's work orders
- Tracks vendor SLAs (OTIS, Trane, Johnson Controls)
- Logs preventive maintenance completions

### Building Security

Security leads and guards. Focuses on access and incidents.

- Sees cameras, badge events, after-hours activity, tailgating alerts
- Reads today's patrol schedule
- Logs incident reports
- Reviews flagged access events

### Contractor Manager

The manager at a cleaning or maintenance firm that services one or more buildings under contract.

- Sees the contracts their company holds (which buildings, what services, what SLAs)
- Manages their own crew's schedule and assignments
- Reads routes and tasks inside the buildings they service
- Does not see buildings they don't have a contract on, and does not see other contractors' work

Contractors get a full playbook in Merlin: live SLA performance, Merlin's AI recommendations, structured proposals and upsells, periodic shareback reports, and the vendor marketplace — and it pays off operationally, commercially, and strategically.

### Crew Worker

Individual cleaning, maintenance, or security workers. Focus is on their own shift.

- Sees today's shifts and checklist
- Marks tasks complete
- Flags issues that need attention
- Minimal admin — no invite access, no route editing

---

## How access works

Merlin layers three kinds of access control. Most users only need to think about the first; the others come up when you're organizing a larger deployment.

### Your job role

Set on your user profile. This controls which features you see across any workspace you belong to. Someone with the **Cleaning Services** profile will see the same hygiene-focused views whether they're signed in at a real-estate workspace or at a contractor one.

Your admin sets this when you're invited. To change someone's role, go to **Admin → Users** and pick a new role from the dropdown.

### Your workspace role

Set when you accept an invite to a workspace. Controls what you can do _to the workspace itself_. **Strict tier hierarchy:** only Owners can promote at Owner / Admin level; Admins can only invite Members.

| Workspace role | What it unlocks                                                                            | Who they can invite / promote |
| -------------- | ------------------------------------------------------------------------------------------ | ----------------------------- |
| **Owner**      | Rename the workspace, invite and remove teammates at any tier, grant building-level access | Owner / Admin / Member        |
| **Admin**      | Invite and remove Members, grant building-level access                                     | Member only                   |
| **Member**     | See and work inside the workspace. No ability to change membership.                        | —                             |

Multi-owner per workspace is allowed (co-founder / co-manager pairs are common). The constraint is **who can grant the role**, not how many owners can exist. An Admin simply can't promote anyone to Admin or Owner — that's reserved for Owners.

Most users are **Members**. Owners are the people who shape the workspace itself.

### White-label branding (Enterprise)

Enterprise customers (or reseller-channel parents) can replace three Adaptiv-branded surfaces with their own — logo, accent color, and favicon. This is available when:

- You're on the Enterprise plan, or
- White-label branding has been enabled on your workspace as part of a custom partnership, or
- Your workspace is a reseller hub (resellers always have branding rights).

When you sign into a branded workspace, Merlin shows your workspace's own branding if it's set, otherwise your reseller parent's branding if you belong to one, otherwise the default Adaptiv branding.

### Building-level access (optional)

By default, every member of a workspace sees the entire location tree. For large deployments, an Owner or Admin can narrow specific users to specific buildings or ecosystems.

> **Where:** Admin → Organization → _Location access_ card

Grant a user access to "EMEA" and they see only EMEA and what's below it. Grant them access to "EMEA" _and_ "NYC" and they see both, but nothing else. Remove all grants and they go back to seeing everything.

This is the tool for _"Sarah runs our London buildings; she shouldn't see the Paris ones"_ — without creating separate workspaces.

---

## Workspace types

Not every workspace is a building owner. Merlin supports three kinds:

| Type            | Who uses it                                                 | Example                          |
| --------------- | ----------------------------------------------------------- | -------------------------------- |
| **Real estate** | Building owners, property managers, in-house facility teams | Meridian HQ, First Empire Bank 2 |
| **Contractor**  | Cleaning, HVAC, security, or electrical firms               | SparkleCo Cleaning Services      |
| **Adaptiv**     | The Adaptiv team's own workspace                            | Adaptiv                          |

Each workspace type gives its users a slightly different landing experience. A manager at a real estate workspace sees buildings, zones, and routes. A manager at a contractor workspace sees contracts, SLAs per contract, and their own crew. The Adaptiv workspace is for the Adaptiv team, not a customer-style operations workspace.

---

## What each role sees on sign-in

Your landing page depends on your job role _and_ your workspace type:

- **Super admin** anywhere → the full management shell (cross-org access)
- **Facility manager at a real-estate workspace** → the full management shell (Briefing, Dashboard, Operations, Reports, Insights)
- **Facility manager at a contractor workspace** → the same shell with the Contracts sub-page surfaced (this is the Contractor Manager surface)
- **Cleaning, maintenance, or security worker** → the crew view (today's shifts, checklist, flag issues)

You can always see which workspace you're in from the pill in the top-right user menu.

---

## Switching workspaces

If you belong to more than one workspace (common for contractors, or for Adaptiv staff), switch between them from your user menu.

1. Click your avatar (top-right).
2. Under _Workspace_, pick the one you want.
3. The page reloads and everything (buildings, routes, settings) refreshes to that workspace.

Your personal preferences (theme, density, etc.) carry over; workspace data doesn't cross over.

---

## Inviting someone new

> **Where:** Admin → Organization → _Pending invites_ card (owners and admins only)

1. Click **+ Invite**, enter their email, and pick a workspace role (Owner / Admin / Member).
2. Click **Create link** — Merlin generates a one-click URL.
3. Share the link (Slack, email, SMS). Invites expire after 14 days.
4. After they accept, set their profile role in **Admin → Users** — that's what determines the features they actually see.

---

## Changing who can do what

### Promote a member to admin

Admin → Organization → _Pending invites_ row or _Members_ list → change role to Admin.

### Change someone's job role

Admin → Users → find the row → pick a new role from the dropdown.

### Narrow someone to a specific building

Admin → Organization → Location access → find the member → **+ Grant** → pick the building or ecosystem. Remove all grants to restore full access.

### Remove someone from the workspace

Admin → Users → row → **Remove**. Their access is revoked immediately; their history stays for audit.

---

## When you hit a "permission" error

Four common causes:

1. **Your job role doesn't include this feature.** A Cleaning Services user can't edit a route — ask a facility manager to make the change.
2. **Your workspace role is too low.** Members can't invite new teammates — ask an owner or admin.
3. **You have a subtree grant that excludes this location.** Ask an admin to widen your grants, or to remove them entirely so you have full access.
4. **You're signed into the wrong workspace.** Check the workspace pill in your user menu.

---

## Tips for a clean setup

- **Keep the workspace role simple.** Most people should be **Members**. Reserve Owner and Admin for the one or two people who actually run the workspace.
- **Start without subtree grants.** Only add them when someone explicitly needs to be narrowed. The default "everyone sees everything" is easier to reason about.
- **Pick the right job role on invite.** If you invite someone as a Cleaning Services user but they're actually HVAC, they'll see the wrong set of features until their profile role is updated.
- **Use multiple workspaces for multiple companies.** If a contractor serves four different property owners, each owner has their own workspace — the contractor switches between them, rather than one mega-workspace containing all four.
