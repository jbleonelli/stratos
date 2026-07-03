# AI-written alert headlines (deferred)

**Status:** Proposed / deferred · **Owner:** JB · **Last updated:** 2026-05-30

## Context

The Hypervisor 3D viewer + My Day canvas cards show a one-glance **headline** per
agent ask. Today that headline is derived **deterministically** on the client —
`summarizeTitle(decision_reason)` in `src/app/hypervisor-3d-utils.js` takes the
first clause of the reason, cut at a clean word boundary, clamped to 2 lines
(PR #837). The full reason is in the Details drawer.

This reads fine. The deferred upgrade: replace the heuristic headline with a
**punchy ~6-word AI-written title** generated once per ask (e.g.
_"Energy & Security SLAs in breach"_ instead of the first 52 chars of the
reason paragraph).

## Why it's not "just call the LLM in the card"

The headline must be **generated once, stored, read many times**. Summarizing
via an LLM on every render / realtime tick is a non-starter (cost, latency,
flicker). So this is a write-path change, not a render-path change.

## The 5 parts

1. **DB column** — `agent_runs.headline text` (migration). Nullable; old rows
   fall back to the deterministic headline.
2. **Agent runtime** — `writeAgentRun` in `api/agents/_shared.ts` already has
   the full reasoning in context when it creates an ask. Generate a short
   headline there (cheap incremental token cost; Haiku is fine) and write it to
   `agent_runs.headline`, and mirror it into the **event payload**
   (`payload.headline`) so the events pipeline carries it without a join.
3. **Replay RPC parity** — `demo_replay_emit_tick` (migration, see
   `supabase/migrations/169_demo_replay_emit_tick_events.sql` + memory
   [[replay_vs_live_emit_parity]]). Replay-mode orgs (Meridian HQ/MDE/MHC —
   i.e. _every demo screenshot_) bypass `writeAgentRun` entirely, so the RPC
   must also emit `payload.headline` (copy from the fixture / derive) or
   headlines will silently never appear on the orgs we demo. **This is the
   step most likely to be missed.**
4. **Backfill** — one-time pass to generate `headline` for existing pending
   asks (otherwise every current card keeps using the fallback until the ask
   churns). Could be a script or an admin-triggered job.
5. **Card read** — `Hypervisor3DScene.jsx` CTACard + `Hypervisor.jsx`/
   `Briefing.jsx` `ctaRows`: read `cta.headline ?? summarizeTitle(cta.title)`.
   The events flatten in `src/app/events.js` should surface `payload.headline`
   as `headline` so consumers don't dig into payload.

## Sequencing (each its own verified PR)

1. Migration: add column (zero risk).
2. Card read with fallback (no-op until headlines exist — safe to ship first).
3. Agent runtime generation + event payload.
4. Replay RPC parity (mig) — verify on a replay org.
5. Backfill existing rows.

## Acceptance

- New asks on a live org show an AI headline within one agent tick.
- New asks on a **replay** org (Meridian) show an AI headline (the parity check).
- Old asks still render a clean deterministic headline (no blanks).
- No per-render LLM calls — headline is read from stored data only.

## Out of scope

Card layout (done in #837). Drawer detail (done — exhaustive + humanized).
