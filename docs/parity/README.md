# Acceptance gate

**Status:** 🟠 Plan · 2026-07-02

"Works correctly" is not a vibe — it is a **test gate**. A slice of Stratos is
accepted when its suites pass against the AWS stack in CI and block release.

---

## The gates

| Gate | What it proves | Blocking? |
| --- | --- | --- |
| **Cross-tenant leak suite** | Tenant isolation holds (app-layer authz + RLS backstop) | ✅ Hard block |
| **Playwright E2E journeys** | Real user flows work end-to-end | ✅ Hard block |
| **Money-path / RPC guards** | Billing + write RPCs behave | ✅ Hard block |
| **Page render smoke** | Every surface mounts | ✅ |
| **Route-map drift** | Navigation surface matches spec | ✅ |
| **Unit / pure-logic** | Domain logic is pinned | ✅ |

## Core E2E journeys (7)

1. Mobile worker happy-path (task done → ticket + photo)
2. Login (password → signed-in surface)
3. Logout
4. Worker assistant chat
5. Desktop approve-flow (facility manager approves a pending ask)
6. Contractor login → contracts portfolio
7. Customer shell 5-pillar routing

Each must run **hermetically** against a stubbed/seeded Stratos stack — no prod,
no mutation of real data.

## Leak suite — two modes (see authz doc)

1. App-layer authz **on** + RLS **on** (production shape).
2. App-layer authz **bypassed** + RLS **on** (proves the DB backstop blocks a
   resolver bug).

Both green = the authorization layer is trustworthy. A runnable version already
lives in [`../../db/proof/`](../../db/proof/).

## Definition of done

- [ ] All 7 E2E journeys green against Stratos in CI
- [ ] Cross-tenant leak suite green in both modes
- [ ] Money-path / RPC guards green
- [ ] Page smoke + route drift green
- [ ] Personas can each sign in (Cognito) and see only their org's data

## Non-goals

- 100% line or E2E coverage. 7–10 hermetic journeys + guard suites is the target.
