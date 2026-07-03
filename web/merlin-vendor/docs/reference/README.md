# Reference

Canonical lookup tables, fixtures, and snapshots. These docs answer "what's the value of X?" — change rarely, reflect a frozen truth at a point in time.

| Doc                              | What it covers                                                                                                                                                                                                                                                                                                  | Status            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| [meridian-hq.md](meridian-hq.md) | The canonical Meridian tenant — **now multi-building (HQ + MDE + MHC)** under one org. HQ = 50 floors, 360 rooms, 208 zones, 23 routes, 4 contractors, 787 devices. MDE = warehouse (`variant='warehouse'`), MHC = healthcare (`variant='healthcare'`). Source of truth for "how many of X does Meridian have." | 🔵 Reference      |
| [roles.md](roles.md)             | Engineering reference for the 10-value `profile.role` enum + persona table + filter helpers + auth gates. Adding a new role checklist.                                                                                                                                                                          | 🟢 Canonical      |
| [user-types.md](user-types.md)   | The 3 identity axes (kind / profile role / org-membership role), per-role archetypes + signal sets, derived persona matrix. Design reference.                                                                                                                                                                   | 🟢 Canonical      |
| [deferred.md](deferred.md)       | Catalog of every "we'll do that later" cut. Each entry: what was cut, why, what would unblock it. Ordered roughly by likelihood of pickup.                                                                                                                                                                      | 📦 Living archive |
| [scenarios/](scenarios/)         | Pre-built scenario templates (small building, corporate HQ, hospital, university, bank network). Meridian (3 buildings) + FEB (581 branches) + IMF (2 buildings) are the live ones.                                                                                                                             | 🟠 Aspirational   |

## When to add here

Canonical lookup tables, enums, fixture data, or frozen factual snapshots. If someone needs to ask "what's the number?", "what's the slug?", "which values are valid?", the answer goes here.

How-to content goes in [`../guides/`](../guides/). System-design narrative goes in [`../architecture/`](../architecture/).
