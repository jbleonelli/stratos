// @ts-check
// Merlin-computed contractor performance grade for the manager scorecard.
// Each contractor gets an objective 0–100 score + letter grade Merlin derives
// from their delivery signals (SLA attainment, response time, on-time route
// completion, proposal win-rate). For the demo these signals are mocked per
// contractor (the live scorecard hook reads them as "—" today); when real
// contractor_reports / SLA data lands, swap PERF_BY_NAME for the live source
// and keep computeGrade() as-is.

// Per-contractor delivery signals. Keyed by a lowercase substring of the
// contractor name so it matches regardless of the exact org row. Values are
// representative demo data tuned so the grades spread A → C.
const PERF_BY_NAME = [
  { match: 'sparkleco', slaAttainment: 96, responseMins: 14, onTimePct: 97, winRate: 82 },
  { match: 'guardwatch', slaAttainment: 91, responseMins: 22, onTimePct: 90, winRate: 74 },
  { match: 'shineright', slaAttainment: 78, responseMins: 41, onTimePct: 73, winRate: 55 },
  { match: 'northstar', slaAttainment: 88, responseMins: 18, onTimePct: 88, winRate: 68 },
];

// Deterministic fallback for any contractor not in the table above, so a
// new/unknown contractor still grades believably (no Math.random — stable
// per name).
function fallbackPerf(name) {
  let h = 0;
  for (let i = 0; i < String(name).length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const span = (lo, hi) => lo + (h % (hi - lo + 1));
  return { slaAttainment: span(74, 94), responseMins: span(15, 40), onTimePct: span(72, 95), winRate: span(50, 80) };
}

export function contractorPerf(name) {
  const lc = String(name || '').toLowerCase();
  return PERF_BY_NAME.find((p) => lc.includes(p.match)) || fallbackPerf(lc);
}

// Weighted 0–100 score from the four signals. Response time is inverted +
// clamped (≤10 min = full marks, ≥60 min = zero). Weights favour SLA
// attainment (what the FM is actually paying for) then reliability.
export function computeScore(perf) {
  const responseScore = Math.max(0, Math.min(100, ((60 - perf.responseMins) / 50) * 100));
  const score = perf.slaAttainment * 0.4 + responseScore * 0.25 + perf.onTimePct * 0.2 + perf.winRate * 0.15;
  return Math.round(score);
}

// 0–100 → letter grade. A+/A/A-/B+…/F bands.
export function letterGrade(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D';
  return 'F';
}

// Tone for the grade chip — green (strong) / amber (watch) / red (poor).
export function gradeTone(score) {
  if (score >= 85) return 'ok';
  if (score >= 70) return 'warn';
  return 'risk';
}

// One-call helper: name → { perf, score, grade, tone }.
export function gradeFor(name) {
  const perf = contractorPerf(name);
  const score = computeScore(perf);
  return { perf, score, grade: letterGrade(score), tone: gradeTone(score) };
}
