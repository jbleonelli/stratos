// @ts-check
// sla-forecast.js — contractor SLA early-warning math (pure, deterministic).
//
// Given a live SLA reading ({ current, target }) we project its adherence
// forward and find when it is FORECAST to cross (a) the contractor's chosen
// alert threshold and (b) the contractual target. The slope is a stable,
// seeded value biased by how far the line sits from target — comfortable lines
// drift gently up, lines near/below target slide down — so the forecast reads
// believably without a history table (same philosophy as servicing synthTrend).
//
// Everything here is deterministic from the SLA id, so the forecast never
// flickers between renders and a given demo SLA always tells the same story.

function fnv(s) {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const FORECAST_DAYS = 14;

// Project an SLA's adherence forward. Returns null when the SLA isn't
// computable (no current reading) — nothing to forecast.
export function slaForecast(sla, { thresholdPct = 90, days = FORECAST_DAYS } = {}) {
  if (!sla || sla.current == null || sla.computable === false) return null;
  const current = clamp(Number(sla.current), 0, 100);
  const target = Number(sla.target ?? 95);
  const seed = fnv(sla.id || sla.name);

  // Base slope ∈ [-1.1, +1.3] pts/day (mean slightly positive, so MOST lines
  // hold or improve and only a seeded minority slide), then nudged by the
  // current margin to target — comfortable lines drift up, lines already near
  // or below target slide down, so the at-risk set is the realistic few.
  const base = (seed % 240) / 100 - 1.1;
  const marginAdj = clamp((current - target) * 0.12, -0.6, 0.6);
  const slope = clamp(base + marginAdj, -1.9, 0.8);

  const series = [];
  for (let d = 0; d <= days; d++) {
    const wander = ((fnv(`${sla.id}:${d}`) % 100) / 100 - 0.5) * 0.7;
    series.push(Math.round(clamp(current + slope * d + wander, 35, 100) * 10) / 10);
  }

  const firstCrossBelow = (level) => {
    for (let d = 0; d <= days; d++) if (series[d] < level) return d;
    return null;
  };
  const daysToThreshold = firstCrossBelow(thresholdPct);
  const daysToBreach = firstCrossBelow(target);
  const projectedMin = Math.min(...series);

  let severity;
  if (current < target)
    severity = 'breach'; // already below contractual target
  else if (daysToBreach != null)
    severity = 'at_risk'; // forecast to breach target
  else if (daysToThreshold != null)
    severity = 'watch'; // forecast to hit the early-warning band
  else severity = 'ok';

  return {
    series,
    slope,
    current,
    target,
    thresholdPct,
    daysToThreshold,
    daysToBreach,
    projectedMin,
    severity,
    // The alert fires whenever the forecast crosses the user's threshold within
    // the window (0 = already below it).
    willAlert: daysToThreshold != null,
  };
}

// Localized "in N days" / "now" helper for forecast copy.
export function inDays(n, sl) {
  if (n == null) return null;
  if (n <= 0) return sl('now', 'maintenant');
  return sl(`in ${n} day${n === 1 ? '' : 's'}`, `dans ${n} j`);
}

// Ranked mitigations to keep a forecast-at-risk line above target. Templates
// are service-line aware; impacts are derived from the forecast so the top
// action is always sized to clear the alert. Returns {en,fr} pairs for the
// component to localize, plus a grounded "draft with Merlin" prompt.
const LINE_PLAYBOOK = {
  cleaning: [
    {
      en: 'Dispatch the overdue restroom & high-traffic items today',
      fr: 'Dépêcher aujourd’hui les sanitaires et zones à fort passage en retard',
      whyEn: 'Clearing the oldest items first lifts adherence fastest.',
      whyFr: 'Traiter les plus anciens en premier relève l’adhérence le plus vite.',
    },
    {
      en: 'Add a weekend deep-clean shift this week',
      fr: 'Ajouter une vacation de nettoyage approfondi ce week-end',
      whyEn: 'Extra capacity reverses the downward slope before Monday.',
      whyFr: 'Une capacité supplémentaire inverse la tendance avant lundi.',
    },
    {
      en: 'Re-sequence routes to front-load this client',
      fr: 'Réordonner les tournées pour prioriser ce client',
      whyEn: 'Buys days without adding crew by serving at-risk areas first.',
      whyFr: 'Gagne des jours sans renfort en servant d’abord les zones à risque.',
    },
  ],
  security: [
    {
      en: 'Close the open patrol & access gaps now',
      fr: 'Combler maintenant les rondes et accès en attente',
      whyEn: 'Open gaps are what pull the response SLA down.',
      whyFr: 'Les écarts ouverts tirent le SLA de réponse vers le bas.',
    },
    {
      en: 'Add an evening guard rotation this week',
      fr: 'Ajouter une rotation de garde en soirée cette semaine',
      whyEn: 'Covers the window where rounds are slipping.',
      whyFr: 'Couvre la plage où les rondes glissent.',
    },
    {
      en: 'Prioritise perimeter & high-risk zones first',
      fr: 'Prioriser le périmètre et les zones à risque',
      whyEn: 'Protects the clauses most likely to be inspected.',
      whyFr: 'Protège les clauses les plus susceptibles d’être contrôlées.',
    },
  ],
  maintenance: [
    {
      en: 'Clear the overdue preventive work orders now',
      fr: 'Solder maintenant les ordres de maintenance préventive en retard',
      whyEn: 'Overdue PMs are the biggest drag on the SLA.',
      whyFr: 'Les PM en retard pèsent le plus sur le SLA.',
    },
    {
      en: 'Schedule a catch-up maintenance window',
      fr: 'Planifier une fenêtre de rattrapage',
      whyEn: 'A focused block reverses the backlog growth.',
      whyFr: 'Un créneau dédié inverse la croissance du backlog.',
    },
    {
      en: 'Front-load critical assets (HVAC, lifts, fire)',
      fr: 'Prioriser les actifs critiques (CVC, ascenseurs, incendie)',
      whyEn: 'Protects the safety-critical clauses first.',
      whyFr: 'Protège d’abord les clauses critiques de sécurité.',
    },
  ],
  hospitality: [
    {
      en: 'Clear open guest requests now',
      fr: 'Traiter maintenant les demandes clients en attente',
      whyEn: 'Open requests drive the response-time SLA.',
      whyFr: 'Les demandes ouvertes pilotent le SLA de réponse.',
    },
    {
      en: 'Add front-desk cover at the midday peak',
      fr: 'Renforcer l’accueil au pic de midi',
      whyEn: 'Matches staffing to when requests spike.',
      whyFr: 'Aligne l’effectif sur le pic des demandes.',
    },
    {
      en: 'Re-sequence concierge tasks to the at-risk site',
      fr: 'Réordonner les tâches conciergerie vers le site à risque',
      whyEn: 'Buys lead time without extra headcount.',
      whyFr: 'Gagne du temps sans effectif supplémentaire.',
    },
  ],
};
const LINE_PLAYBOOK_DEFAULT = LINE_PLAYBOOK.cleaning;

export function slaMitigations(sla, line, fc) {
  if (!fc || !fc.willAlert) return [];
  const plays = LINE_PLAYBOOK[line] || LINE_PLAYBOOK_DEFAULT;
  // Size the top action to clear the alert (push projected min back above the
  // threshold with a small buffer); subsequent actions taper.
  const gap = Math.max(2, Math.ceil(fc.thresholdPct - fc.projectedMin + 2));
  const impacts = [clamp(gap, 2, 8), clamp(Math.round(gap * 0.6), 2, 6), clamp(Math.round(gap * 0.35), 1, 4)];
  return plays.map((p, i) => ({
    id: `${sla.id}-m${i}`,
    title: { en: p.en, fr: p.fr },
    why: { en: p.whyEn, fr: p.whyFr },
    impact: impacts[i] ?? 2,
  }));
}

// Grounded prompt for the "Draft a plan with Merlin" CTA on an at-risk SLA.
export function mitigationPrompt(sla, lineLabel, clientName, fc, sl) {
  const when = inDays(fc.daysToThreshold, sl);
  return sl(
    `My ${lineLabel} SLA "${sla.name}" at ${clientName} is forecast to fall below my ${fc.thresholdPct}% alert threshold ${when} (currently ${Math.round(fc.current)}%, target ${fc.target}%). Draft a concrete plan to keep it above target — what to dispatch first, any crew or shift changes, and the order to do them in.`,
    `Mon SLA ${lineLabel} « ${sla.name} » chez ${clientName} devrait passer sous mon seuil d’alerte de ${fc.thresholdPct}% ${when} (actuellement ${Math.round(fc.current)}%, cible ${fc.target}%). Rédige un plan concret pour le maintenir au-dessus de la cible — quoi dépêcher en premier, les ajustements d’équipe ou de vacation, et dans quel ordre.`,
  );
}
