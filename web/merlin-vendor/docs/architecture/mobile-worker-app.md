# Mobile Worker App — `mobile.adaptiv.systems`

> **Status:** Phase 1 **shipped** (2026-06-21). All three tabs live on `mobile.adaptiv.systems` (or `?mobile=1` spike). Worker writes + ticket photos landed; **web push live** (VAPID set). Tab split complete (`MobileApp.jsx` ~786-line shell + `MobileTodayTab` / `MobileTicketsTab` / `MobileAskTab`). Playwright happy-path E2E in CI (#990). ES/PT UI chrome; chat multilingual (EN/FR/DE/ES/PT) day one.
> **One-liner:** A phone-first Merlin for the people _doing the work_ — "What can I do now?", my tickets, ask Merlin — served from a dedicated subdomain that installs as **Merlin Field**.

---

## 1. The pitch

Today Merlin is a manager's surface: dashboards, the Hypervisor, SLAs, the cockpit. The person mopping Floor 32 or fixing an HVAC unit doesn't open a desktop dashboard — they have a phone.

The mobile worker app turns Merlin from _a dashboard you check_ into _a co-worker in your pocket_. A custodian opens it, taps **Ask Merlin → "what can I do now?"**, and Merlin answers from **their** context:

> _"Three things. Floor 32 East restroom is in SLA breach — go there first. Then the 14:00 lobby sweep. The pantry restock can wait until after."_

That single interaction is the product. Everything else (today's tasks, tickets) supports it.

**Brand fit:** Merlin is "the AI Co-Worker for Buildings." This is the first surface where Merlin is literally a _co-worker_, not a manager's tool.

## 2. Who it's for

The **worker persona** — `session.role ∈ {cleaning, maintenance, security}` (see `WorkerApp.jsx`). Field staff, custodians, technicians, guards. People with a Merlin login but no admin, no building tree, no cockpit.

Managers-on-phones is a **separate, later** question. Do not let it dilute v1 — `mobile.adaptiv.systems` is the _worker_ app.

## 3. Why a dedicated subdomain (decided)

`mobile.adaptiv.systems` is a third surface alongside `merlin.` (customer app) and `excalibur.` (back-office) — all aliases on one Vercel deployment. Chosen over a path (`/m`) for three reasons:

1. **Dedicated PWA identity — the real win.** A separate origin gets its own `manifest.webmanifest`: it installs as **"Merlin Field"**, portrait, its own icon, `start_url` straight to the worker's _Today_ screen. One origin can only have one primary manifest, so a path can't give the home screen a purpose-built app.
2. **Automatic session isolation — a feature here.** Subdomains don't share `localStorage`, so `mobile.` has its own Supabase session (same `storageKey`-per-surface model already in `supabase.js`, but free). A worker signs in once on their phone and never sees the manager app; a manager's desktop session never bleeds in.
3. **Clean distribution.** QR code or "go to mobile.adaptiv.systems" → install → done.

**Tradeoff (accepted):** separate origin ⇒ separate login from desktop (no shared session). For a worker who lives on the phone, that's correct, not a cost.

## 4. What already exists (this is mostly a frontend problem)

The backend + several building blocks are already in place — mobile is **not** a rebuild:

| Asset                         | Where                                                                                                      | State                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Worker shell (desktop)**    | `src/app/WorkerApp.jsx` (`persona === 'worker'`)                                                           | Desktop worker view. Superseded on mobile by `MobileApp.jsx`. Lazy-loaded at `App.jsx`.                            |
| **Mobile worker app**         | `src/app/MobileApp.jsx` + `mobile-surface.js`                                                              | **Shipped Phase 1.** Three tabs, worker writes, ticket photos, push subscription UI. ~2,136 LOC — split tabs next. |
| **Ask-Merlin chat**           | `api/chat.ts` + `Chat.jsx`; grounding via `serializeBuilding → buildingSummary`, `openChat(q,{send:true})` | Works. Needs to ground on the _worker's assignments_ instead of the building summary.                              |
| **Tickets**                   | `tickets` + `ticket_comments` (migs 179–182), SLA-sweep cron                                               | Full follow-able work-item layer.                                                                                  |
| **Events pipeline**           | `public.events`                                                                                            | The signal spine (device / agent / web-service).                                                                   |
| **PWA**                       | `public/manifest.webmanifest` + `public/mobile.webmanifest`, `public/sw.js`                                | Desktop + **Merlin Field** manifests; mobile subdomain gets portrait, worker-branded install.                      |
| **Routes / assignments**      | `routes-data.js`, `route-overrides-data.js` (`routeRunsOn`, `todayStr`, `dowOf`)                           | "What's assigned to this worker today."                                                                            |
| **Surface routing precedent** | `supabase.js` (`isPlatformSurface` by path), `use-route.js`                                                | Path-based today; add a hostname check for `mobile.`.                                                              |

**Remaining gaps (post Phase 1):** (a) **`MobileApp.jsx` monolith split** — extract tab modules before it grows further; (b) **push go-live** — pipe + cron exist, dormant until VAPID keys set; (c) **automated tests** — worker RPC party guard + mobile smoke not yet in CI (see [`code-preparedness.md`](../operations/code-preparedness.md) G1).

## 5. The product — three screens

Bottom tab bar, single column, big touch targets, thumb-reachable actions.

1. **Today** _(default; evolves `WorkerApp`)_ — "What can I do now?" up top (one-tap to the chat with that prompt pre-sent), then today's assigned routes/tasks as a checklist. At-risk / overdue / SLA-breach items float to the top. **Tap a task → mark done**, or **flag a problem** (photo → ticket).
2. **Tickets** — the worker's tickets (assigned to or raised by them): open, in-progress, recently closed. **Raise a ticket** with a photo + short note. Reuses the `tickets` layer.
3. **Ask Merlin** — the chat, grounded on the worker (their building, shift, assignments, open items). Voice input (the composer already has a mic). This is where "what can I do now?", "where's the nearest supply closet?", "log that I finished Floor 12" live.

## 6. The hero interaction — "What can I do now?"

Reuses the existing chat-grounding mechanism, re-pointed:

- Desktop grounds chat on `buildingSummary` (a serialized building snapshot).
- Mobile grounds on a **worker summary**: their assigned routes today, current shift window, overdue + at-risk items on those routes, any Merlin Asks directed at them.
- The model answers conversationally with a _prioritized, walkable_ plan — not a dashboard.

This is the difference between "here are 4 panels" and "go to Floor 32 first." It's what makes Merlin feel like a co-worker.

## 7. Languages — broader than desktop, and chat-first

The people _doing the work_ are the most language-diverse population in the building — facilities, cleaning, and security workforces skew heavily Spanish- and Portuguese-speaking. So the mobile worker app supports **more languages than the manager desktop**: **English, French, German, Spanish, Portuguese** (desktop is EN/FR/DE). Merlin meeting a custodian in their own language _is_ the co-worker promise.

Two layers, with very different cost/coverage:

- **The chat is fully multilingual from day one — and it's cheap.** Chat answers are model-generated, and Claude is natively fluent in all five. "Multilingual chat" reduces to (a) a per-worker language setting and (b) the output-language directive in the chat's **LATE system block** (the pattern already in use). No translation pipeline, no per-string work — the model just answers in the worker's language. This is the highest-value multilingual surface _and_ the cheapest to deliver, so it ships in v1.
- **The UI chrome follows, via the existing Haiku pipeline.** The worker app's static strings (tab labels, "Mark done", "Raise ticket"…) are a _small, focused_ set — nothing like the 5,255-key desktop DICT. Batch-translate that subset to ES/PT (FR/DE already exist) with the same `/api/translate` generator used for the German rollout. Anything untranslated **falls back to English** (the i18n stack already fails safe — the German Phase-1 work proved it), so chrome coverage can trail the chat without blocking it.

**Decoupling principle:** chat language is the priority and may run _ahead_ of UI coverage. A worker can be chatting fluently in Portuguese while a few buttons are still English — that's fine. Do **not** gate the multilingual chat on full UI translation.

**Mechanics:**

- Extend `/api/translate` `SUPPORTED_LANGS` + `LANG_NAME` + default glossaries with `es` / `pt` (a trivial extension of the FR/DE parameterization already in place).
- The **mobile** language picker offers all five; **desktop** keeps EN/FR/DE. Per-surface exposure; the i18n English-fallback covers the gaps. (`SUPPORTED` in `i18n.js` is the _selectable_ set — mobile widens it.)
- Per-worker default read from `profiles.preferences.language` (the per-user-default-language mechanism already exists). Offer the picker on first run + in settings.

## 8. Architecture

- **Hostname routing.** Add a `mobile.adaptiv.systems` host check (today surface detection is path-based in `supabase.js`/`use-route.js`). On that host: force the worker mobile shell regardless of viewport, and use a `merlin-mobile-auth` `storageKey`. Cross-surface links stay full-navigation (`window.location.assign`) per the existing gotcha.
- **PWA manifest.** A separate manifest for the mobile host — name "Merlin Field", `orientation: portrait`, `start_url` → Today, its own maskable icons. (Either a second static manifest served on that host, or host-conditional manifest link.)
- **Session.** Own Supabase session via the new `storageKey`. Same auth backend; sign-in is the existing flow, mobile-skinned.
- **Backend reuse.** Supabase (RLS + realtime), `api/chat.ts`, `tickets`, `events` — all shared, unchanged. Vercel: one more alias on the current deployment.
- **Realtime.** Supabase realtime for live ticket/ask updates (already used elsewhere — mind the Node-22 / WebSocket requirement from the 2026-06-21 incident).

## 9. Backend work items (the only real non-UI work)

1. **Worker RLS write policies.** `WorkerApp` is read-only _because the worker write policies don't exist yet_ (its own header says so). v1 needs RLS for: mark a task/route-task complete (`route_task_completions`), raise/update a ticket as a worker, append a ticket comment. Fail-closed, scoped to the worker's own org + assignments. This is the gating backend task.
2. **Web push.** The forcing function for a worker app — "ticket assigned to you", "Merlin needs a decision", "shift starting." Needs: a VAPID keypair, a `push_subscriptions` table, a subscribe flow in the PWA, and a sender (a small `/api/push` + hooks from the ticket/ask events). Works on Android PWAs and **iOS 16.4+ installed** PWAs.

## 10. Phasing

- **Phase 1 — Worker PWA (the spike → MVP).** `mobile.` subdomain + hostname routing + mobile manifest; phone-first `WorkerApp` with the 3 tabs; the "what can I do now?" grounded chat, **multilingual (EN/FR/DE/ES/PT) from day one** (model-native — see §7); enable the deferred writes (mark-done, raise-ticket-with-photo) behind the new worker RLS. Ship installable. **Validate with real workers.**
- **Phase 2 — Push + polish.** Web push for ticket/ask/shift events. Offline read-cache via the service worker (field/basements). Many field apps live here permanently.
- **Phase 3 — Native shell (only if validated).** **Capacitor** wraps the existing PWA → App Store presence + rock-solid iOS push + camera/biometric/offline, reusing all the UI. Prefer Capacitor over a from-scratch React Native rewrite — a task-list + chat app doesn't need native render perf.

## 11. Open questions / decisions

- **Manager-on-mobile:** out of scope for v1 (separate concern). Confirm.
- **App name on the home screen:** "Merlin Field"? "Merlin for Teams"? "Merlin Worker"?
- **Offline depth:** read-only cache in Phase 2, or queue writes offline? (Queueing is real work — defer unless field connectivity demands it.)
- **Auth friction:** workers re-login per device/origin. Acceptable, or do we want a magic-link / shorter-lived QR sign-in for shared devices?
- **Contractor crews:** a contractor's cleaning crew is also a "worker." Does `mobile.` serve them too (same shell, contractor-scoped data)? Likely yes — confirm it's in v1's RLS thinking.

## 12. First concrete step

A **Phase-1 spike**: the `mobile.` subdomain (locally faked via a host/query flag) + a phone-first `WorkerApp` with the three tabs and a working "what can I do now?" chat — enough to **hold on a phone and feel it** before committing to the RLS + push build-out.
