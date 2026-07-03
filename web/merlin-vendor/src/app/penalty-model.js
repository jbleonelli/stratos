// @ts-check
// penalty-model.js — SLA penalty terms + exposure math (pure, deterministic).
//
// FMs increasingly attach PENALTY TERMS to a contract's SLA: an adherence FLOOR
// below which a charge applies, a RATE (% of the monthly contract value per
// point below the floor), a CAP (max % of monthly value per period), and an
// ESCALATION (uplift per consecutive month already in breach — penalties bite
// harder the longer you miss). Terms live in `contracts.penalties` (jsonb, one
// object per contract — a contract is a single service line). When none are set
// we fall back to a believable per-line default so EVERY contractor sees the
// notion, not just the seeded demo ones.
//
// Everything here is pure + deterministic so the contractor's "$ at risk" and a
// mitigation's "$ avoided" never flicker between renders. $0 — no Claude, no DB.

const num = (v, d) => (v == null || Number.isNaN(Number(v)) ? d : Number(v));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Per-line defaults — harsher where misses carry safety/hygiene risk.
export const DEFAULT_PENALTY_TERMS = {
  cleaning: { floor_pct: 95, rate_pct: 1.2, cap_pct: 8, escalation_pct: 25 },
  security: { floor_pct: 96, rate_pct: 1.5, cap_pct: 10, escalation_pct: 25 },
  maintenance: { floor_pct: 95, rate_pct: 1.0, cap_pct: 8, escalation_pct: 20 },
  hospitality: { floor_pct: 94, rate_pct: 0.8, cap_pct: 6, escalation_pct: 15 },
};
const GENERIC_DEFAULT = { floor_pct: 95, rate_pct: 1.0, cap_pct: 8, escalation_pct: 20 };
const MAX_ESC_MONTHS = 3; // escalation tops out after 3 consecutive breach months

function normalizeTerm(t, source) {
  return {
    floor_pct: clamp(num(t.floor_pct, 95), 50, 100),
    rate_pct: clamp(num(t.rate_pct, 1), 0, 20),
    cap_pct: clamp(num(t.cap_pct, 8), 0, 50),
    escalation_pct: clamp(num(t.escalation_pct, 0), 0, 200),
    source: source || t.set_by || t.source || 'default',
  };
}

// The penalty term for a contract+line: the FM's authored terms when present
// (object shape with a floor_pct), otherwise the per-line default. The legacy
// extraction shape (an array of {trigger,threshold,rate}) is ignored → default.
export function penaltyTermFor(contract, line) {
  const p = contract?.penalties;
  if (p && typeof p === 'object' && !Array.isArray(p) && p.floor_pct != null) {
    return normalizeTerm(p, 'fm');
  }
  return normalizeTerm(DEFAULT_PENALTY_TERMS[line] || GENERIC_DEFAULT, 'default');
}

// Whether a contract carries explicitly FM-authored terms (vs. a default).
export function hasAuthoredTerms(contract) {
  const p = contract?.penalties;
  return !!(p && typeof p === 'object' && !Array.isArray(p) && p.floor_pct != null);
}

// The escalation multiplier for N consecutive prior breach months.
export function escalationMultiplier(term, streak = 0) {
  return 1 + (num(term.escalation_pct, 0) / 100) * clamp(streak, 0, MAX_ESC_MONTHS);
}

// The penalty charge, as a % of monthly value, at a given adherence level.
// streak = consecutive prior breach months (drives escalation; default 0).
export function penaltyChargePct(term, adherencePct, streak = 0) {
  const shortfall = Math.max(0, term.floor_pct - num(adherencePct, term.floor_pct));
  if (shortfall <= 0) return 0;
  const base = Math.min(term.cap_pct, shortfall * term.rate_pct);
  const escMult = escalationMultiplier(term, streak);
  const escCap = term.cap_pct * escalationMultiplier(term, MAX_ESC_MONTHS);
  return Math.min(escCap, base * escMult);
}

// The penalty amount (rounded currency) at a given adherence level.
export function penaltyAmount(term, monthlyValue, adherencePct, streak = 0) {
  return Math.round((num(monthlyValue, 0) * penaltyChargePct(term, adherencePct, streak)) / 100);
}

// Live exposure from a forecast: the charge at the forecast's projected MIN
// adherence (the worst point in the window), measured against the FM floor —
// independent of the contractor's own early-warning threshold.
export function forecastExposure({ term, monthlyValue, fc, streak = 0 }) {
  if (!term || !fc) return { amount: 0, shortfall: 0, floor: term?.floor_pct ?? null, atAdh: null };
  const atAdh = Math.min(num(fc.projectedMin, 100), num(fc.current, 100));
  const amount = penaltyAmount(term, monthlyValue, atAdh, streak);
  return { amount, shortfall: Math.max(0, term.floor_pct - atAdh), floor: term.floor_pct, atAdh };
}

// How much a mitigation that lifts adherence by `liftPts` points avoids, given
// the line is currently forecast down at `fromAdh`.
export function penaltyAvoided({ term, monthlyValue, fromAdh, liftPts, streak = 0 }) {
  const before = penaltyAmount(term, monthlyValue, fromAdh, streak);
  const after = penaltyAmount(term, monthlyValue, Math.min(100, num(fromAdh, 0) + num(liftPts, 0)), streak);
  return Math.max(0, before - after);
}

// A short human label for a term, e.g. "below 95% → 1.2%/pt, cap 8%".
export function termSummary(term, sl) {
  const pick = sl || ((en) => en);
  return pick(
    `below ${term.floor_pct}% → ${term.rate_pct}%/pt, cap ${term.cap_pct}%`,
    `sous ${term.floor_pct}% → ${term.rate_pct}%/pt, plafond ${term.cap_pct}%`,
  );
}
