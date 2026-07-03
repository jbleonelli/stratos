# Engineering Maturity — from solo-velocity to team-ready

**Last updated:** 2026-05-17 · **Owner:** Adaptiv founding team

This is the running plan for taking Merlin from "one operator + AI"
velocity-mode to a codebase a second or third engineer can safely
contribute to. It's **not** a "best practices" laundry list — every
item is ordered by impact-per-week-spent and gated on a specific
risk the codebase carries today.

> **Default sequencing rule:** preserve the velocity that made the
> codebase good. The goal is "no surprises when engineer #2 starts,"
> not "every Twitter-approved practice in place." A three-month
> professionalization sprint would tank product throughput and the
> founder discipline that produced the code in the first place.

---

## What Merlin is today (updated 2026-05-17)

| Metric               | Before Week 1      | After Tier 1+2 + sprint         | Note                                                                                                                 |
| -------------------- | ------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Frontend LOC         | ~72,000            | ~78,000                         | +6k from /platform reorg + Stripe products CRUD + FloatingMenu + pricing flow                                        |
| Backend LOC          | ~10,500            | ~14,000                         | +3.5k from agent billing G1+G2+G3, Stripe webhooks, subscription_skus, data-source overage cron                      |
| Migrations           | 103                | **128**                         | +25 over the sprint (104-128: portfolio expansion, IMF, agent billing, subscription_skus)                            |
| **Bundle (gzipped)** | ~900 KB            | **~686 KB (-24%)**              | 7 lazy chunks loaded on demand (PR #245). NOTE: 2026-05-14 outage taught us NOT to add manualChunks on top — PR #293 |
| Commits              | 604                | 850+                            | Through PR #386                                                                                                      |
| Test coverage        | ~0%                | ~minimal                        | 3 RPC guard tests + 3 todo() stubs (PR #242)                                                                         |
| **CI gates**         | 0                  | **5**                           | build · test · typecheck(api) · lint(i18n) · lint(dead code, informational)                                          |
| **Type system**      | None               | **API 100% TS-typed**           | All 51 files migrated; zero `@ts-nocheck` remaining (achieved 2026-05-13)                                            |
| i18n coverage        | EN/FR, ~2945 pairs | EN/FR, ~5000+ keys + lint-gated | Footgun bug class permanently dead (PR #243). All new demo guides + Stripe + pricing surfaces localized              |
| Dead-code visibility | None               | 107-export remaining            | Down from 134 baseline; informational mode, `continue-on-error: true` until near zero                                |

The shape: **founder-velocity-optimised**. Few abstractions, rich
docs (header comments, MEMORY system, PR-message essays), heavy use
of platform services (Supabase / Stripe / Resend / Vercel /
Anthropic) so the code surface stays honest. Works beautifully for
one operator. Hits a wall at engineer #2 or #3.

---

## Tier 1 — Stop the bleeding (~1 week, do this first)

These three together remove the entire class of "I didn't know that
was load-bearing" incidents that hit the day engineer #2 starts.
None of them slow product throughput; all three pay back inside a
month.

### 1.1 CI gate on every PR

**Status:** 🟢 Shipped 2026-05-12 — [PR #240](https://github.com/jbleonelli/merlin/pull/240) · **Effort:** ~1 day

GitHub Actions workflow that runs on every PR:

- `npm install`
- `npm run build` (catches Rollup import resolution that Vite dev tolerates — already a documented gotcha in MEMORY)
- A basic ESLint pass (unused vars, undefined refs)

Block merge on red. Set up the same job to run on push to `main`
so a force-merged-with-broken-build can't slip through unnoticed.

**Why first:** currently nothing checks. The recurring "intermediate
HMR error during edits" the founder has hit during shell rewrites
would have surfaced in CI before ship. PRs #232 and #237 each had
brief broken states that we caught manually in preview but a
distracted contributor wouldn't.

**Quick start:**

```yaml
# .github/workflows/ci.yml
name: ci
on: [pull_request, push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
```

### 1.2 TypeScript on the API layer only

**Status:** 🟢 Fully shipped 2026-05-13 — [PR #241](https://github.com/jbleonelli/merlin/pull/241) onward · **Effort:** ~3 days initial scaffold + per-file follow-up _(all 51 files now strict-mode TS; zero `@ts-nocheck` remaining; money paths fully type-safe)_

Migrate `api/_lib/*.js` + `api/*.js` to `.ts` with `strict: true`.
~50 files, all stateless, no React. Frontend stays JS — that
migration is 6+ months and not yet urgent.

**Why:** the API layer is where token-shape and payload-validation
bugs become user-visible 500s. The "Server not configured" + the
Stripe / Resend URL bugs we hit on PR #234 are both classes of
error that types prevent. The frontend can stay JS because its
errors are usually visible at design-review time; backend errors
hit production directly.

**Quick start:**

1. Add `typescript` + `@types/node` + a minimal `tsconfig.json`
   scoped to `api/` only.
2. Rename `api/_lib/admin.js` → `.ts`, fix the resulting errors
   (export types for `requirePlatformAdmin` return shape, etc.).
3. Rename file-by-file as you touch them; no big-bang migration.
4. Update the CI workflow to also run `tsc --noEmit` for `api/`.

**Pairs with 1.1.** The CI gate makes the migration safe.

### 1.3 Integration tests on the money paths

**Status:** 🟡 Phase 1 shipped 2026-05-12 — [PR #242](https://github.com/jbleonelli/merlin/pull/242) · **Effort:** ~2 days _(actual: 3 RPC guard tests landed. HTTP-endpoint happy-path tests filed as `describe.todo()` stubs — they need handler-mock helper + Stripe SDK mock + writeable test fixture project before they can run.)_

Not 100% coverage. Just five endpoints where a regression equals
lost data or money:

- `POST /api/checkout/create-session`
- `POST /api/stripe/webhook` (the `payment_intent.succeeded` +
  `charge.refunded` branches)
- `POST /api/refunds/create`
- The `install_inventory_device` RPC (via a thin endpoint or
  direct supabase-js call)
- The `demo_fulfill_order` RPC

Vitest is already in `package.json`. Hit a test Supabase project
or use the existing demo project with a setup/teardown that wraps
each test in a transaction.

**Why:** these five are the only ones where the bug isn't
recoverable from logs. A broken UI is fixable in a hotfix; a
double-charged customer or an unfulfilled order isn't. Coverage
of _only_ these is more valuable than 80% line coverage across
the rest.

---

## Tier 2 — Make the bundle + i18n team-ready (~2 weeks)

Do these only after Tier 1. They're worth doing before engineer #2
arrives because they're "one-time correctness fixes" that get
harder once two people are editing.

### 2.1 Route-based code-splitting

**Status:** 🟢 Shipped 2026-05-12 — [PR #245](https://github.com/jbleonelli/merlin/pull/245) · **Effort:** ~2 days _(actual: lazy-loaded 7 routes; main bundle 3.3 MB → 2.5 MB / -25%, -212 KB gzipped)_

Vite supports `React.lazy()` + dynamic imports out of the box.
Split:

- `PlatformApp` (entire `/platform` shell — only loaded for platform admins)
- `Operations` + sub-pages (Hypervisor especially — has react-leaflet)
- `ContractorApp` (well… RIP, but the pattern applies to whatever
  replaces it)
- `Insights` (financials v2, heavier charts)

Expected gain: 3.2 MB → ~800 KB for the cold-load chunk. Build
will stop complaining on every PR.

**Why before engineer #2:** the "one big bundle" pattern is the
default if no one establishes the lazy-import discipline early.
Easier to set up the splits once than to ask three contributors
to remember.

### 2.2 i18n key linter

**Status:** 🟢 Shipped 2026-05-12 — [PR #243](https://github.com/jbleonelli/merlin/pull/243) · **Effort:** ~½ day _(actual: linter + 22 existing footgun fixes in one PR; `lint (i18n)` CI job runs in ~7s)_

A 30-line build-time script that:

- Walks `src/app/**/*.{js,jsx}` for `t('foo.bar')` calls.
- Fails if the key isn't in the `DICT` (now in `src/app/en-fr-translations.js`; `i18n.js` is the engine).
- Fails if the call is `t('foo.bar') || 'Fallback'` — the
  recurring footgun [MEMORY](../../../.claude/projects/-Users-jbleonelli-Library-CloudStorage-Dropbox-ADAPTIV-Jean-Baptiste-Leonelli-DESIGN-WORK-CLAUDE-PROJECTS-MERLIN/memory/MEMORY.md)
  calls out four times because `t()` returns the raw key when
  missing, which is truthy, so the `||` fallback never fires.

Hook into the CI gate from 1.1.

**Why:** kills the bug class permanently. The cost of the footgun
isn't "the fallback shows up" — it's that the fallback _doesn't_
show up and prod ships with raw keys like `platform.demo.subheading`
visible to users. Has happened on PRs #159, #160, #166, #174 per
MEMORY.

### 2.3 Dead-code sweep + `ts-prune` in CI

**Status:** 🟡 Shipped informational mode 2026-05-12 — [PR #244](https://github.com/jbleonelli/merlin/pull/244) · **Effort:** ~½ day initial + ongoing _(actual: used `knip` not `ts-prune` — more comprehensive; baseline is 134 unused exports, CI is `continue-on-error: true` until the count is driven down. Cleanup PRs ratchet it; flip to strict when near zero.)_

The codebase pattern is "ship the new path, leave the old as dead
code" (`ContractorApp.jsx` shell — 4541 LOC; `MERLIN_TODAY_BY_ROLE`
in `roles.js`; the wide-mode Sidebar branch I orphaned in PR #237).
Works as long as someone eventually sweeps. `ts-prune` (or
`knip`) in CI surfaces unreachable exports as warnings — fail the
build if the unused-export count grows.

---

## Tier 3 — Prep for engineer #2 (~1 week, do shortly before hiring)

### 3.1 PR template

**Status:** 🟢 Shipped 2026-05-13 (engineering maturity sprint) · **Effort:** ~1 hour

GitHub PR template at `.github/pull_request_template.md`:

- [ ] Build green locally
- [ ] i18n keys added in the _same_ PR (no `t() || 'fallback'`)
- [ ] Memory note added if behavior is non-obvious or surprising
- [ ] Tested in preview at desktop + narrow viewport
- [ ] Updated relevant doc in `docs/architecture/`

Codifies the founder discipline. The "added in the _same_ PR" rule
exists explicitly because deferring the i18n keys to a follow-up
has hit four times.

### 3.2 ADR format in `docs/architecture/`

**Status:** 🟡 Half-formal already · **Effort:** ~½ day

`docs/architecture/` already has good strategic docs
(`platform-vision.md`, `contractor-self-serve.md`,
`hardware-commerce.md`, the proposed `llm-provider-switching.md`).
Formalize an ADR (Architecture Decision Record) format:

```
# ADR-NNN: <decision>
## Status: Accepted | Proposed | Superseded by ADR-MMM
## Context
## Decision
## Consequences
```

Retroactively write ADRs for: the Supabase + RLS choice, the
single-bundle decision, the "MEMORY system as tribal knowledge
substrate" choice, the "no TS" choice. These exist as implicit
trade-offs today; an ADR makes them defendable when engineer #2
asks "why."

### 3.3 Sentry alert rules

**Status:** 🟡 Sentry wired (server-side via direct HTTP since 2026-05-14), alert rules drafted in [`sentry-alerts.md`](sentry-alerts.md), Slack integration not yet configured · **Effort:** ~½ day

Sentry is in `package.json` and emits errors from prod, but no
pager rules. Add:

- Error rate > 5/min on any `/api/*` endpoint → Slack ping
- Any error tagged `stripe-webhook` → page (one of these is a
  charge that didn't fulfill)
- Any error in `/api/demos/send` → ping (sales-blocker)

---

## Tier 4 — Once there's a second engineer (~6 months ongoing)

These can wait. Don't do them solo — they're the kind of work
that's actually faster with a fresh pair of eyes.

- **Frontend TS migration.** File-by-file. Probably 6-12 months
  for 72k LOC. Start with `data.js` helpers and primitives.
- **Component library extraction.** `Card`, `Pill`, `IconBtn`,
  `Hero` pattern already disciplined enough to be a published
  internal `@adaptiv/ui` package once there's a reason to share.
- **E2E tests** (Playwright) for the 3 critical user journeys:
  sign-in → see Briefing, FM → contractor proposal accept,
  Stripe checkout → install.
- **Storybook** for the UI primitives. Pays back at >2
  frontend contributors.
- **Renovate / Dependabot** for the npm tree. Keeps Supabase,
  Stripe, Sentry SDKs current without one-by-one PRs.

---

## What NOT to do

A few patterns to actively resist:

- **A "professionalization sprint."** Three months of pure
  infrastructure work would frame the founder's velocity as the
  problem to solve. It isn't. The velocity _is_ the moat.
- **Frontend TS before backend TS.** Six months of pain, marginal
  payoff (frontend errors are visible at design-review time).
  Backend TS pays back from day one.
- **Adopting Redux / Zustand / Context everywhere.** The
  module-level state pattern (`let openState` in CommandPalette,
  `let currentLang` in i18n, auth listeners) is unusual but
  _legible_. A state library would add ceremony without removing a
  bug class.
- **Full code coverage targets.** The five-money-paths rule (1.3)
  is the right test investment for the stage. "80% coverage" is a
  proxy metric that produces low-value tests fast.
- **Premature monorepo / nx / turborepo.** Single-repo single-app
  works fine at this size. Revisit when there's a second
  customer-facing app.

---

## Progress snapshot (2026-05-17)

Tiers 1, 2, and 3.1 are fully shipped. 3.3 partially. The codebase is now:

- **Gated** — every PR must pass build + tests + typecheck + i18n lint.
- **Fully type-safe on the API layer** — all 51 files in strict TS; zero `@ts-nocheck`. Money paths (Stripe, refunds, agent billing, subscription_skus) all type-safe.
- **Lean cold-load** — main bundle dropped 25%; PlatformApp / Admin /
  Agentic / Reports / Insights / Innovate / WorkerApp all lazy.
- **Locked against the i18n footgun** — `t('x') || 'fallback'` is now
  a CI-fatal pattern.
- **Aware of its dead-code surface** — knip surfaces 107 unused exports
  informationally; future cleanup PRs drive the count down.
- **PR-template gated** — `.github/pull_request_template.md` codifies the founder discipline.

What's next, by priority:

1. **Tier 3.3 — Sentry alert rules wired to Slack.** ~½ day. Rules drafted in [`sentry-alerts.md`](sentry-alerts.md); execution pending JB's Slack integration.
2. **Knip cleanup sweep.** Ratchet 107 → < 20 unused exports, then flip CI from `continue-on-error: true` to strict.
3. **Tier 1.3 happy-path tests.** The three `describe.todo()` stubs
   for `/api/checkout`, `/api/stripe/webhook`, `/api/refunds` need
   handler-mock helper + Stripe SDK mock + writeable test fixtures.
   ~1 day of setup.
4. **Stale-chunk auto-recover** — already shipped. After the 2026-05-14 outage retro, the SPA detects chunk-load failures and forces a full reload to pick up a fresh build.

### Sprint additions worth noting (2026-05-14 onward)

The hardening sprint added several engineering-maturity items that weren't in the original Tier plan but belong here:

- **Rollup `manualChunks` is banned.** [`memory/session-2026-05-14.md`](../../.claude/memory/session-2026-05-14.md) documents the 2-hour prod outage caused by a hand-rolled vendor split. Use `splitVendorChunkPlugin` or Rollup's `output.experimentalMinChunkSize` if vendor splitting is needed.
- **Auth-aware cache helper.** `src/app/use-auth-aware-cache.js` solves the module-level `let hydrated = false` cross-user leak class. 7 modules wired; any new module-level cache MUST call `registerAuthAwareCache`.
- **Surface-aware Supabase client.** `/` and `/platform/*` have independent storageKeys (`merlin-customer-auth` vs `merlin-platform-auth`). The chosen client is bound at module load — never use `navigateTo` cross-surface; always `window.location.assign(...)` for full reload.
- **Provider-agnostic realtime wrapper.** New realtime subscriptions go through `src/app/realtime-channel.js`, not direct `supabase.channel(...)` calls. One layer of indirection so an eventual AWS IoT Core / AppSync migration is one-file.

---

## Suggested execution path

If you do **exactly one thing** this month: **Tier 1, all three
items.** Roughly one focused week. Removes the entire class of
"contributor-#2 breakage" risk and costs less than one product PR
of velocity.

If you do **one thing per month**: Tier 1 month one, Tier 2 month
two, Tier 3 month three. By month four you're ready to hire.

If you're **already hiring**: do Tier 1 the week before they
start, and pair on Tier 2 with them in their first month so they
build the codebase intuition while making it safer.
