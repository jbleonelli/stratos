// ContractorSavingsPage — the "Savings" tab of a contractor's ANTICIPATE.
//
// The owner's Savings track is building energy/cost-vs-budget. For a contractor
// this is THEIR economics: (2) margin / cost-to-serve per contract, and (3)
// operational-savings OPPORTUNITIES — each an actionable proposal with an
// implementation plan Merlin could run (mirrors the owner Insights cards'
// `implementation: [{when, what}]` shape). Revenue is real (contract.monthly_value);
// cost + savings impacts are a DETERMINISTIC estimate modeled from contract value
// + service mix (no real cost data yet — labelled "estimated", stable hash).

import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useSession } from './auth.js';
import { canonicalServiceLine, SERVICE_LINE_ORDER } from './service-line.js';
import { useContractorAnalytics, fetchContractSignals, useContractorPenaltyLedger } from './slas-data.js';
import { useContractCosts, setContractCosts } from './contract-costs-data.js';
import { useContractorSuggestions } from './contractor-programs-data.js';
import { synthTrend } from './servicing-data.js';
import { useFormatCurrency } from './locale-format.js';
import { useSL } from './servicing-i18n.js';

const WEEKS_PER_MONTH = 4.33;
// Real cost-to-serve from an entered basis, or null when none entered.
function costFromBasis(basis) {
  if (!basis) return null;
  const crew = Number(basis.crew_count) || 0;
  const rate = Number(basis.hourly_rate) || 0;
  const hrs = Number(basis.hours_per_week) || 0;
  const labor = crew * rate * hrs * WEEKS_PER_MONTH;
  return Math.round(labor + (Number(basis.supplies_monthly) || 0));
}

const LINE_LABEL = {
  cleaning: ['Cleaning', 'Nettoyage'],
  security: ['Security', 'Sécurité'],
  maintenance: ['Maintenance', 'Maintenance'],
  hospitality: ['Hospitality', 'Hôtellerie'],
};
const LINE_ICON = { cleaning: 'cleaning', security: 'security', maintenance: 'cog', hospitality: 'hospitality' };
const COST_RATIO = { cleaning: 0.7, security: 0.74, maintenance: 0.68, hospitality: 0.72 };

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Savings-opportunity templates per service line. `rate` is the modeled monthly
// impact as a fraction of contract revenue; `plan` is the implementation Merlin
// would run (when · what), in the owner-Insights shape. EN/FR text via sl().
const PROPOSALS = {
  cleaning: [
    {
      key: 'sensor-dispatch',
      rate: 0.06,
      driver: 'emergency',
      title: ['Sensor-driven cleaning dispatch', 'Affectation du nettoyage pilotée par capteurs'],
      why: [
        'Move from fixed-interval rounds to VOC/occupancy-triggered dispatch — cut labour + consumables on floors running below threshold, with zero SLA risk.',
        'Passer de tournées à intervalle fixe à un déclenchement par COV/occupation — réduit main-d’œuvre et consommables sur les étages sous le seuil, sans risque SLA.',
      ],
      plan: [
        [
          ['1 wk', 'Instrument occupancy + VOC triggers on the high-traffic floors'],
          ['1 sem.', 'Instrumenter les déclencheurs occupation + COV sur les étages à fort trafic'],
        ],
        [
          ['2 wks', 'Pilot dynamic dispatch vs the fixed schedule; watch the Hygiene SLA'],
          ['2 sem.', 'Piloter l’affectation dynamique vs le planning fixe ; surveiller le SLA Hygiène'],
        ],
        [
          ['1 mo', 'Roll out building-wide; formalize as a cadence amendment with the FM'],
          ['1 mois', 'Déployer sur tout le bâtiment ; formaliser via un avenant de cadence avec le FM'],
        ],
      ],
    },
    {
      key: 'supply-auto',
      rate: 0.018,
      driver: 'supply',
      title: ['Supply auto-replenishment', 'Réassort automatique des consommables'],
      why: [
        'Reset reorder thresholds and move to twice-weekly replenishment with a backup supplier to kill stockouts and rush orders.',
        'Réajuster les seuils de réassort et passer à un réapprovisionnement bihebdomadaire avec un fournisseur de secours pour éliminer ruptures et commandes urgentes.',
      ],
      plan: [
        [
          ['1 wk', 'Raise reorder minimums ~30% on high-churn consumables'],
          ['1 sem.', 'Relever les minimums de réassort d’environ 30 % sur les consommables à forte rotation'],
        ],
        [
          ['2 wks', 'Switch to twice-weekly replenishment + a backup supplier'],
          ['2 sem.', 'Passer au réassort bihebdomadaire + fournisseur de secours'],
        ],
      ],
    },
  ],
  security: [
    {
      key: 'cv-coverage',
      rate: 0.05,
      driver: 'security',
      title: ['CV coverage for low-traffic zones', 'Vidéo-analyse des zones à faible trafic'],
      why: [
        'Computer-vision coverage of low-traffic zones after hours reduces patrol rounds without dropping security posture — pitch a Verkada integration via the INNOVATE marketplace.',
        'La vision par ordinateur des zones à faible trafic en dehors des heures réduit les rondes sans baisser la posture de sécurité — proposer une intégration Verkada via la place de marché INNOVATE.',
      ],
      plan: [
        [
          ['1 wk', 'Pitch the Verkada integration to the FM via INNOVATE'],
          ['1 sem.', 'Proposer l’intégration Verkada au FM via INNOVATE'],
        ],
        [
          ['3 wks', 'Deploy CV on after-hours low-traffic zones'],
          ['3 sem.', 'Déployer la vidéo-analyse sur les zones à faible trafic hors heures'],
        ],
        [
          ['1 mo', 'Re-balance patrol routes; bank the crew-hour reduction'],
          ['1 mois', 'Rééquilibrer les rondes ; capter la réduction d’heures'],
        ],
      ],
    },
    {
      key: 'incident-routing',
      rate: 0.022,
      driver: 'emergency',
      title: ['Smart incident-response routing', 'Routage intelligent des interventions'],
      why: [
        'Route the nearest on-shift guard to incidents to hold the <5m response SLA and avoid penalty exposure.',
        'Diriger l’agent le plus proche vers les incidents pour tenir le SLA de réponse <5 min et éviter les pénalités.',
      ],
      plan: [
        [
          ['2 wks', 'Wire badge/camera signals into response routing'],
          ['2 sem.', 'Relier badges/caméras au routage des interventions'],
        ],
        [
          ['1 mo', 'Track response-time SLA + penalty avoidance'],
          ['1 mois', 'Suivre le SLA de réponse + pénalités évitées'],
        ],
      ],
    },
  ],
  maintenance: [
    {
      key: 'bundle-pm',
      rate: 0.04,
      driver: 'emergency',
      title: [
        'Bundle preventive visits to avoid callouts',
        'Regrouper les visites préventives pour éviter les interventions d’urgence',
      ],
      why: [
        'Cluster PM tasks and bundle at-risk asset work (e.g. a bearing swap with a scheduled inspection) to avoid premium emergency callouts.',
        'Regrouper les tâches préventives et le travail sur les actifs à risque (ex. remplacement de roulement avec une inspection planifiée) pour éviter les interventions d’urgence à coût majoré.',
      ],
      plan: [
        [
          ['1 wk', 'Cluster PM tasks by floor / asset window'],
          ['1 sem.', 'Regrouper les tâches par étage / fenêtre d’actif'],
        ],
        [
          ['2 wks', 'Bundle the highest-risk asset work into the next inspection'],
          ['2 sem.', 'Intégrer le travail sur l’actif le plus à risque à la prochaine inspection'],
        ],
        [
          ['1 mo', 'Carve emergency-response labour scope explicitly in the contract'],
          ['1 mois', 'Délimiter explicitement la main-d’œuvre d’urgence dans le contrat'],
        ],
      ],
    },
    {
      key: 'predictive',
      rate: 0.02,
      driver: 'emergency',
      title: ['Predictive failure alerts', 'Alertes de panne prédictives'],
      why: [
        'Act on runtime / vibration trends before assets slip into emergency territory.',
        'Agir sur les tendances de fonctionnement / vibration avant que les actifs ne basculent en urgence.',
      ],
      plan: [
        [
          ['2 wks', 'Enable predictive alerts on the highest-risk assets'],
          ['2 sem.', 'Activer les alertes prédictives sur les actifs les plus à risque'],
        ],
        [
          ['1 mo', 'Pre-schedule service inside the risk window'],
          ['1 mois', 'Planifier l’intervention dans la fenêtre de risque'],
        ],
      ],
    },
  ],
  hospitality: [
    {
      key: 'occupancy-staffing',
      rate: 0.05,
      title: ['Occupancy-responsive staffing', 'Effectifs adaptés à l’occupation'],
      why: [
        'Lighter morning coverage ramping to the ~11:00 peak recovers 0.5–1.0 FTE-equivalent without a guest-satisfaction hit — the Merlin occupancy feed can trigger crew levels in near real-time.',
        'Une couverture matinale allégée montant vers le pic de ~11h récupère 0,5–1,0 ETP sans impact sur la satisfaction — le flux d’occupation de Merlin peut ajuster les effectifs en quasi temps réel.',
      ],
      plan: [
        [
          ['1 wk', 'Instrument the Merlin occupancy feed for front-of-house'],
          ['1 sem.', 'Instrumenter le flux d’occupation Merlin pour l’accueil'],
        ],
        [
          ['2 wks', 'Shift to occupancy-responsive crew levels; monitor CSAT'],
          ['2 sem.', 'Passer à des effectifs adaptés à l’occupation ; suivre la satisfaction'],
        ],
        [
          ['1 mo', 'Lock the staffing pattern; bank the recovered hours'],
          ['1 mois', 'Figer le modèle d’effectifs ; capter les heures récupérées'],
        ],
      ],
    },
    {
      key: 'mail-batch',
      rate: 0.015,
      title: ['Mail & parcel batching', 'Regroupement courrier & colis'],
      why: [
        'Batch inbound mail/parcel runs to hold the <4h delivery SLA with fewer trips.',
        'Regrouper les tournées courrier/colis pour tenir le SLA de livraison <4 h avec moins de trajets.',
      ],
      plan: [
        [
          ['1 wk', 'Define batched delivery windows'],
          ['1 sem.', 'Définir des fenêtres de livraison groupées'],
        ],
        [
          ['2 wks', 'Track delivery SLA + trips saved'],
          ['2 sem.', 'Suivre le SLA de livraison + trajets économisés'],
        ],
      ],
    },
  ],
};

// Real-signal drivers scale each opportunity's modeled baseline within a bounded
// band — more real activity → bigger opportunity, but saturating (tanh) so the
// demo's large event counts never blow the number past revenue. driverCount=0 →
// factor 1 (unchanged baseline).
const DRIVER_REF = { emergency: 20, supply: 5, security: 8 };
const DRIVER_LABEL = {
  emergency: ['emergency signals', 'signaux d’urgence'],
  supply: ['supply requests', 'demandes de réassort'],
  security: ['security signals', 'signaux de sécurité'],
};
function driverFor(p, drivers) {
  if (!p.driver || !drivers) return { factor: null, count: 0 };
  const count = Number(drivers[p.driver]) || 0;
  if (count <= 0) return { factor: null, count: 0 };
  const ref = DRIVER_REF[p.driver] || 12;
  return { factor: 1 + 0.4 * Math.tanh(count / ref), count };
}

function model(contract, line, basis, drivers) {
  const revenue = Number(contract.monthly_value) || 0;
  // Real cost from the contractor's entered basis when present; otherwise the
  // legacy deterministic estimate (a per-line fraction of revenue).
  const realCost = costFromBasis(basis);
  let cost;
  let real;
  let laborCost = null;
  let suppliesCost = null;
  if (realCost != null) {
    cost = realCost;
    real = true;
    // Deterministic decomposition from the entered basis (crew·rate·hrs·4.33 + supplies).
    laborCost = Math.round(
      (Number(basis.crew_count) || 0) *
        (Number(basis.hourly_rate) || 0) *
        (Number(basis.hours_per_week) || 0) *
        WEEKS_PER_MONTH,
    );
    suppliesCost = Math.round(Number(basis.supplies_monthly) || 0);
  } else {
    const h = hashStr(contract.id);
    const jitter = ((h % 9) - 4) / 100;
    const ratio = Math.min(0.85, Math.max(0.55, (COST_RATIO[line] ?? 0.72) + jitter));
    cost = Math.round(revenue * ratio);
    real = false;
  }
  const margin = revenue - cost;
  const marginPct = revenue ? Math.round((margin / revenue) * 100) : 0;
  const proposals = (PROPOSALS[line] || PROPOSALS.cleaning).map((p) => {
    const { factor, count } = driverFor(p, drivers);
    // Real signal present → scale the baseline by the bounded factor; else the
    // legacy deterministic estimate (stable hash jitter).
    const mult = factor != null ? factor : 1 + ((hashStr(contract.id + p.key) % 7) - 3) / 100;
    return { ...p, impact: Math.round(revenue * p.rate * mult), driverCount: count, driverReal: factor != null };
  });
  const opportunity = proposals.reduce((s, p) => s + p.impact, 0);
  return { revenue, cost, margin, marginPct, proposals, opportunity, real, laborCost, suppliesCost };
}

export function ContractorSavingsPage({ onOpenChat }) {
  const sl = useSL();
  const session = useSession();
  const fmt = useFormatCurrency();
  const { contracts, loaded } = useContractorAnalytics(session?.organizationId);
  const { costs, reload: reloadCosts } = useContractCosts(session?.organizationId);

  // Real operational signals per contract (last 7d) — drive the opportunity
  // dollars. Reuses the contained, contract-party-validated signals endpoint.
  // { [contractId]: { emergency, supply, security } }. Tolerant: a contract with
  // no signals (or a fetch error) simply gets no drivers → baseline estimate.
  const [drivers, setDrivers] = useState({});
  useEffect(() => {
    let alive = true;
    const active = (contracts || []).filter((c) => c.status === 'active');
    if (active.length === 0) {
      setDrivers({});
      return undefined;
    }
    (async () => {
      const out = {};
      await Promise.all(
        active.map(async (c) => {
          try {
            const r = await fetchContractSignals(c.id);
            const sigs = r?.signals || [];
            out[c.id] = {
              emergency: sigs.reduce((s, x) => s + (x.high || 0), 0),
              supply: sigs.find((x) => x.key === 'supply')?.count || 0,
              security: sigs.find((x) => x.key === 'security')?.count || 0,
            };
          } catch {
            /* no drivers for this contract → baseline */
          }
        }),
      );
      if (alive) setDrivers(out);
    })();
    return () => {
      alive = false;
    };
  }, [contracts]);

  const lineGroups = useMemo(() => {
    const byLine = new Map();
    for (const c of contracts || []) {
      if (c.status !== 'active') continue;
      const line = canonicalServiceLine(c.service_kind);
      if (!byLine.has(line)) byLine.set(line, []);
      byLine.get(line).push(c);
    }
    return SERVICE_LINE_ORDER.filter((l) => byLine.has(l)).map((l) => ({ line: l, contracts: byLine.get(l) }));
  }, [contracts]);

  const totals = useMemo(() => {
    let revenue = 0,
      margin = 0,
      opp = 0,
      n = 0,
      realN = 0,
      currency = null;
    for (const g of lineGroups)
      for (const c of g.contracts) {
        const m = model(c, g.line, costs[c.id], drivers[c.id]);
        revenue += m.revenue;
        margin += m.margin;
        opp += m.opportunity;
        n += 1;
        if (m.real) realN += 1;
        // Single-currency per tenant in practice — take the first contract's.
        currency = currency || c.currency;
      }
    return { revenue, margin, marginPct: revenue ? Math.round((margin / revenue) * 100) : 0, opp, n, realN, currency };
  }, [lineGroups, costs, drivers]);

  const anySignals = useMemo(
    () => Object.values(drivers).some((d) => (d?.emergency || 0) + (d?.supply || 0) + (d?.security || 0) > 0),
    [drivers],
  );

  // Closed loop: savings the client has ADOPTED (from the Suggestions feedback
  // loop) become realized margin. Each adopted improvement ≈ 1.5% of monthly
  // revenue — a believable per-improvement saving. Plus a blended-margin trend.
  const { suggestions } = useContractorSuggestions(session?.organizationId);
  const adoptedCount = useMemo(() => suggestions.filter((s) => s.status === 'adopted').length, [suggestions]);
  const realizedMonthly = useMemo(
    () => adoptedCount * Math.round((totals.revenue || 0) * 0.015),
    [adoptedCount, totals.revenue],
  );
  const marginTrend = useMemo(
    () => synthTrend(`margin:${session?.organizationId || ''}`, totals.marginPct),
    [session?.organizationId, totals.marginPct],
  );

  // Penalties avoided (mig 238 ledger): money kept by staying above the SLA floor.
  // This month's avoided feeds the realized number; trailing 3 months its own stat.
  const { rows: penaltyLedger } = useContractorPenaltyLedger(session?.organizationId);
  const { penaltyAvoidedMonthly, penaltyAvoided3mo } = useMemo(() => {
    const counts = {};
    let m = 0;
    let q = 0;
    for (const r of penaltyLedger || []) {
      // rows period-desc
      counts[r.contract_id] = (counts[r.contract_id] || 0) + 1;
      const n = counts[r.contract_id];
      if (n === 1) m += Number(r.amount_avoided) || 0;
      if (n <= 3) q += Number(r.amount_avoided) || 0;
    }
    return { penaltyAvoidedMonthly: m, penaltyAvoided3mo: q };
  }, [penaltyLedger]);

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 12,
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-dim)' }}>
          {sl('ANTICIPATE', 'ANTICIPER')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <Icon.bolt size={20} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{sl('Savings', 'Économies')}</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 720, lineHeight: 1.5 }}>
          {sl(
            'Your margin per contract — from your own cost basis — and the savings opportunities Merlin can implement, each with a plan.',
            'Votre marge par contrat — à partir de votre propre base de coûts — et les opportunités d’économies que Merlin peut mettre en œuvre, chacune avec un plan.',
          )}
        </p>
      </div>

      {loaded && totals.n > 0 && (
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
            <Stat
              label={sl('Monthly revenue', 'Revenu mensuel')}
              value={`${fmt(totals.revenue, totals.currency)}/${sl('mo', 'mois')}`}
            />
            <Stat
              label={sl('Blended margin', 'Marge moyenne')}
              value={`${fmt(totals.margin, totals.currency)}/${sl('mo', 'mois')}`}
              sub={`${totals.marginPct}%`}
              tone={totals.marginPct >= 28 ? 'ok' : 'warn'}
            />
            <Stat
              label={sl('Savings on the table', 'Économies à capter')}
              value={`${fmt(totals.opp, totals.currency)}/${sl('mo', 'mois')}`}
              tone="accent"
            />
            {adoptedCount > 0 || penaltyAvoidedMonthly > 0 ? (
              <Stat
                label={sl('Realized /mo', 'Réalisé /mois')}
                value={`${fmt(realizedMonthly + penaltyAvoidedMonthly, totals.currency)}`}
                sub={
                  penaltyAvoidedMonthly > 0
                    ? sl(
                        `${adoptedCount} adopted · ${fmt(penaltyAvoidedMonthly, totals.currency)} penalties avoided`,
                        `${adoptedCount} adoptées · ${fmt(penaltyAvoidedMonthly, totals.currency)} pénalités évitées`,
                      )
                    : sl(`${adoptedCount} adopted`, `${adoptedCount} adoptées`)
                }
                tone="ok"
              />
            ) : (
              <Stat label={sl('Active contracts', 'Contrats actifs')} value={String(totals.n)} />
            )}
            {penaltyAvoided3mo > 0 && (
              <Stat
                label={sl('Penalties avoided · 3 mo', 'Pénalités évitées · 3 mois')}
                value={`${fmt(penaltyAvoided3mo, totals.currency)}`}
                sub={sl('staying above the SLA floor', 'en restant au-dessus du seuil')}
                tone="ok"
              />
            )}
          </div>
          {/* Blended-margin trend (last 7 days). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
                letterSpacing: 0.2,
              }}
            >
              {sl('Margin trend · 7 days', 'Tendance marge · 7 j')}
            </span>
            <Trend series={marginTrend} tone={totals.marginPct >= 28 ? 'ok' : 'warn'} />
            <span
              style={{ fontSize: 12.5, fontWeight: 700, color: `var(--${totals.marginPct >= 28 ? 'ok' : 'warn'})` }}
            >
              {totals.marginPct}%
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 12, fontStyle: 'italic' }}>
            {totals.realN === 0
              ? sl(
                  'Cost & margin estimated — set your cost basis per contract to show real margin.',
                  'Coût et marge estimés — renseignez votre base de coûts par contrat pour afficher la marge réelle.',
                )
              : totals.realN < totals.n
                ? sl(
                    `Margin is real on ${totals.realN} of ${totals.n} contracts (your entered cost basis).`,
                    `Marge réelle sur ${totals.realN} contrats sur ${totals.n} (votre base de coûts).`,
                  )
                : sl('Margin is from your entered cost basis.', 'Marge calculée à partir de votre base de coûts.')}{' '}
            {anySignals
              ? sl(
                  'Savings opportunities reflect your real operational signals (last 7 days).',
                  'Les opportunités d’économies reflètent vos signaux opérationnels réels (7 derniers jours).',
                )
              : sl('Savings opportunities are estimated.', 'Les opportunités d’économies sont estimées.')}
          </div>
        </Card>
      )}

      {!loaded && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
          {sl('Loading…', 'Chargement…')}
        </div>
      )}
      {loaded && lineGroups.length === 0 && (
        <Card>
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {sl('No active contracts on this workspace yet.', 'Aucun contrat actif sur cet espace pour l’instant.')}
          </div>
        </Card>
      )}

      {lineGroups.map((g) => {
        const lp = LINE_LABEL[g.line] || ['Services', 'Services'];
        const label = sl(lp[0], lp[1]);
        const LineIcon = Icon[LINE_ICON[g.line]] || Icon.sparkle;
        return (
          <section key={g.line} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, borderTop: '1px solid var(--border)' }}>
              <LineIcon size={17} style={{ color: 'var(--accent)', marginTop: 12 }} />
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: '12px 0 0' }}>{label}</h2>
            </div>
            {g.contracts.map((c) => (
              <SavingsCard
                key={c.id}
                contract={c}
                line={g.line}
                label={label}
                basis={costs[c.id]}
                drivers={drivers[c.id]}
                onSaved={reloadCosts}
                onOpenChat={onOpenChat}
              />
            ))}
          </section>
        );
      })}
    </main>
  );
}

function Trend({ series, tone, width = 120, height = 30 }) {
  if (!series || series.length < 2) return null;
  const pad = 3;
  const lo = Math.min(...series) - 2,
    hi = Math.max(...series) + 2;
  const span = Math.max(1, hi - lo);
  const x = (i) => pad + (i / (series.length - 1)) * (width - 2 * pad);
  const y = (v) => pad + (1 - (v - lo) / span) * (height - 2 * pad);
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={`var(--${tone})`}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r="2.4" fill={`var(--${tone})`} />
    </svg>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.2,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: tone ? `var(--${tone})` : 'var(--text)' }}>{value}</span>
        {sub && (
          <span style={{ fontSize: 12, fontWeight: 700, color: tone ? `var(--${tone})` : 'var(--text-soft)' }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function SavingsCard({ contract, line, basis, drivers, onSaved, onOpenChat }) {
  const sl = useSL();
  const fmt = useFormatCurrency();
  const m = useMemo(() => model(contract, line, basis, drivers), [contract, line, basis, drivers]);
  const [open, setOpen] = useState(() => new Set());
  const [editing, setEditing] = useState(false);
  const clientName = contract.manager_org?.name || sl('Client', 'Client');
  const toggle = (k) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  return (
    <Card>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{clientName}</div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {contract.name}
        </div>
        <Pill tone={m.marginPct >= 28 ? 'ok' : 'warn'}>
          {m.marginPct}% {sl('margin', 'marge')}
        </Pill>
      </div>

      {/* Margin strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 18,
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--surface-3)',
          marginBottom: editing ? 0 : 12,
        }}
      >
        <MarginStat
          label={sl('Revenue', 'Revenu')}
          value={`${fmt(m.revenue, contract.currency)}/${sl('mo', 'mois')}`}
        />
        <MarginStat
          label={m.real ? sl('Cost to serve', 'Coût de service') : sl('Cost to serve (est.)', 'Coût de service (est.)')}
          value={`−${fmt(m.cost, contract.currency)}`}
          muted={!m.real}
        />
        <MarginStat
          label={sl('Margin', 'Marge')}
          value={`${fmt(m.margin, contract.currency)}/${sl('mo', 'mois')}`}
          tone={m.marginPct >= 28 ? 'ok' : 'warn'}
        />
        <button
          onClick={() => setEditing((e) => !e)}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
          }}
        >
          <Icon.cog size={12} />{' '}
          {basis
            ? sl('Edit cost basis', 'Modifier la base de coûts')
            : sl('Set cost basis', 'Définir la base de coûts')}
        </button>
      </div>
      {/* Deterministic cost-to-serve breakdown (from the entered basis). */}
      {!editing && m.real && m.laborCost != null && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-4px 0 12px 2px' }}>
          {sl('Cost to serve', 'Coût de service')} = {sl('labour', 'main-d’œuvre')}{' '}
          {fmt(m.laborCost, contract.currency)}
          {' · '}
          {sl('supplies', 'consommables')} {fmt(m.suppliesCost, contract.currency)}
          {m.suppliesCost > 0 ? ` (${Math.round((m.suppliesCost / m.cost) * 100)}%)` : ''}
        </div>
      )}
      {editing && (
        <CostBasisEditor contract={contract} basis={basis} onClose={() => setEditing(false)} onSaved={onSaved} />
      )}

      {/* Savings opportunities — actionable proposals with plans */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <Icon.sparkle size={13} style={{ color: 'var(--text-dim)' }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.2,
            color: 'var(--text-soft)',
            textTransform: 'uppercase',
          }}
        >
          {sl('Savings opportunities', 'Opportunités d’économies')}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          · {sl('up to', 'jusqu’à')}{' '}
          <b style={{ color: 'var(--accent)' }}>
            {fmt(m.opportunity, contract.currency)}/{sl('mo', 'mois')}
          </b>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {m.proposals.map((p) => {
          const isOpen = open.has(p.key);
          return (
            <div key={p.key} style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
              <button
                onClick={() => toggle(p.key)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: isOpen ? 'var(--surface-3)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Icon.chevD
                  size={12}
                  style={{
                    color: 'var(--text-dim)',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform .15s',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{sl(p.title[0], p.title[1])}</span>
                  {p.driverReal && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                      {sl(
                        `Reflects ${p.driverCount} ${DRIVER_LABEL[p.driver]?.[0] || 'signals'} · 7d`,
                        `Reflète ${p.driverCount} ${DRIVER_LABEL[p.driver]?.[1] || 'signaux'} · 7 j`,
                      )}
                    </span>
                  )}
                </span>
                <Pill tone="accent">
                  +{fmt(p.impact, contract.currency)}/{sl('mo', 'mois')}
                </Pill>
              </button>
              {isOpen && (
                <div style={{ padding: '4px 14px 14px 34px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55, margin: 0 }}>
                    {sl(p.why[0], p.why[1])}
                  </p>
                  <div>
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: 0.2,
                        color: 'var(--text-dim)',
                        textTransform: 'uppercase',
                        marginBottom: 6,
                      }}
                    >
                      {sl('Plan', 'Plan')}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {p.plan.map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', minWidth: 48 }}>
                            {sl(step[0][0], step[1][0])}
                          </span>
                          <span style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.45 }}>
                            {sl(step[0][1], step[1][1])}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {onOpenChat && (
                    <button
                      onClick={() =>
                        onOpenChat(
                          sl(
                            `Draft a proposal for ${clientName} to implement "${p.title[0]}" — include the plan, the SLA impact, and the monthly value.`,
                            `Rédige une proposition pour ${clientName} afin de mettre en œuvre « ${p.title[1]} » — inclus le plan, l’impact SLA et la valeur mensuelle.`,
                          ),
                          { send: true },
                        )
                      }
                      style={{
                        alignSelf: 'flex-start',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 12px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        border: '1px solid var(--accent-line)',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      <Icon.sparkle size={12} />{' '}
                      {sl('Ask Merlin to draft this proposal', 'Demander à Merlin de rédiger cette proposition')}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function MarginStat({ label, value, muted, tone }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.2,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: tone ? `var(--${tone})` : muted ? 'var(--text-dim)' : 'var(--text)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// Inline editor: the contractor enters crew / rate / hours / supplies → real
// cost-to-serve (saved via the contract-party-guarded RPC). Shows a live margin
// preview as they type.
function CostBasisEditor({ contract, basis, onClose, onSaved }) {
  const sl = useSL();
  const fmt = useFormatCurrency();
  const [crew, setCrew] = useState(basis?.crew_count ?? '');
  const [rate, setRate] = useState(basis?.hourly_rate ?? '');
  const [hrs, setHrs] = useState(basis?.hours_per_week ?? '');
  const [supplies, setSupplies] = useState(basis?.supplies_monthly ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const revenue = Number(contract.monthly_value) || 0;
  const previewCost = costFromBasis({
    crew_count: crew,
    hourly_rate: rate,
    hours_per_week: hrs,
    supplies_monthly: supplies,
  });
  const previewMargin = previewCost != null ? revenue - previewCost : null;
  const previewPct = previewCost != null && revenue ? Math.round((previewMargin / revenue) * 100) : null;

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      await setContractCosts(contract.id, {
        crewCount: crew === '' ? null : Number(crew),
        hourlyRate: rate === '' ? null : Number(rate),
        hoursPerWeek: hrs === '' ? null : Number(hrs),
        suppliesMonthly: supplies === '' ? null : Number(supplies),
        currency: contract.currency || 'USD',
      });
      await onSaved?.();
      onClose?.();
    } catch (e) {
      setErr(e?.message || sl('Could not save.', 'Échec de l’enregistrement.'));
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--accent-line)',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        padding: 12,
        marginBottom: 12,
        background: 'var(--surface-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.2,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
        }}
      >
        {sl('Your cost basis (monthly)', 'Votre base de coûts (mensuel)')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <Field label={sl('Crew', 'Équipe')} value={crew} onChange={setCrew} />
        <Field label={sl('Rate /hr', 'Taux /h')} value={rate} onChange={setRate} />
        <Field label={sl('Hours /wk', 'Heures /sem.')} value={hrs} onChange={setHrs} />
        <Field label={sl('Supplies /mo', 'Fournitures /mois')} value={supplies} onChange={setSupplies} />
      </div>
      {previewCost != null && (
        <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
          {sl('Cost to serve', 'Coût de service')} <b>−{fmt(previewCost, contract.currency)}</b>
          {' · '}
          {sl('margin', 'marge')}{' '}
          <b style={{ color: (previewPct ?? 0) >= 28 ? 'var(--ok)' : 'var(--warn)' }}>
            {fmt(previewMargin, contract.currency)} ({previewPct}%)
          </b>
        </div>
      )}
      {err && <div style={{ fontSize: 11.5, color: 'var(--warn)' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '7px 14px',
            fontSize: 12.5,
            fontWeight: 700,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? sl('Saving…', 'Enregistrement…') : sl('Save', 'Enregistrer')}
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '7px 14px',
            fontSize: 12.5,
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--text-soft)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          {sl('Cancel', 'Annuler')}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.2,
        }}
      >
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '7px 9px',
          fontSize: 13,
          borderRadius: 7,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontFamily: 'inherit',
        }}
      />
    </label>
  );
}
