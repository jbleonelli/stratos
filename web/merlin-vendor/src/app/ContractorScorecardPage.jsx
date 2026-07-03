// ContractorScorecardPage — the contractor's one-glance "where I stand" cockpit.
// Consolidates, per service line, the signals scattered across SERVICING /
// ANTICIPATE / Quality: live adherence + trend, forecast vs the alert threshold,
// last FM inspection, open work. Enriched (2026-06-15): the overall grade
// explains its own math on click; line cards EXPAND in place to a full drill-in
// (sub-areas, real open/overdue items, forecast, inspection) rather than firing
// chat; a dedicated multi-line Evolution chart; and a "This week's focus" card
// surfacing the single highest-leverage move. Read-only + contractor-scoped.

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useSession } from './auth.js';
import { useSL } from './servicing-i18n.js';
import { useServicingRollup, synthTrend, useServicingOpenItems, contractorDispatch } from './servicing-data.js';
import { useContractorThresholds, useContractorAnalytics, useContractorPenaltyLedger } from './slas-data.js';
import { useInspections } from './contractor-programs-data.js';
import { slaForecast, inDays } from './sla-forecast.js';
import { SERVICING_GROUP_DOMAINS, AREA_BY_DOMAIN } from './servicing-areas.js';
import { penaltyTermFor, forecastExposure } from './penalty-model.js';
import { canonicalServiceLine } from './service-line.js';
import { useFormatCurrency } from './locale-format.js';

const LINE_LABEL = {
  cleaning: ['Cleaning', 'Nettoyage'],
  security: ['Security', 'Sécurité'],
  maintenance: ['Maintenance', 'Maintenance'],
  hospitality: ['Hospitality', 'Hôtellerie'],
};
const LINE_ICON = { cleaning: 'cleaning', security: 'security', maintenance: 'cog', hospitality: 'hospitality' };
// Distinct hues for the evolution chart (line identity, not status).
const LINE_HUE = {
  cleaning: 'var(--accent)',
  security: 'var(--risk)',
  hospitality: 'var(--warn)',
  maintenance: 'var(--ok)',
};
const GRADE_BANDS = [
  ['A+', 97],
  ['A', 93],
  ['B', 88],
  ['C', 80],
  ['D', 70],
  ['F', 0],
];

function gradeFor(score) {
  if (score == null) return '—';
  for (const [g, lo] of GRADE_BANDS) if (score >= lo) return g;
  return 'F';
}
function tone(v, threshold) {
  if (v == null) return 'neutral';
  if (v >= threshold) return 'ok';
  if (threshold - v <= 5) return 'warn';
  return 'risk';
}
function prettyDomain(d) {
  const s =
    String(d || '')
      .split('_')
      .slice(1)
      .join(' ') || String(d || '');
  return s
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bHvac\b/, 'HVAC')
    .replace(/\bCctv\b/, 'CCTV')
    .replace(/\bPm\b/, 'PM');
}

function Trend({ series, tone: t, width = 116, height = 34 }) {
  if (!series || series.length < 2) return null;
  const pad = 3;
  const lo = Math.min(...series) - 2,
    hi = Math.max(...series) + 2;
  const span = Math.max(1, hi - lo);
  const x = (i) => pad + (i / (series.length - 1)) * (width - 2 * pad);
  const y = (v) => pad + (1 - (v - lo) / span) * (height - 2 * pad);
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={`var(--${t})`}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r="2.4" fill={`var(--${t})`} />
    </svg>
  );
}

// Multi-line evolution of every line's adherence over the trend window.
function EvolutionChart({ lines, threshold, sl }) {
  const W = 640,
    H = 150,
    padL = 28,
    padR = 10,
    padT = 10,
    padB = 18;
  const series = lines.map((l) => ({
    key: l.key,
    label: l.label,
    hue: LINE_HUE[l.key] || 'var(--accent)',
    trend: l.trend,
  }));
  const allVals = series.flatMap((s) => s.trend).concat([threshold]);
  const lo = Math.max(40, Math.floor(Math.min(...allVals) - 3));
  const hi = 100;
  const n = series[0]?.trend.length || 7;
  const x = (i) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <Icon.beacon size={14} style={{ color: 'var(--accent)' }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.2,
            color: 'var(--text-soft)',
            textTransform: 'uppercase',
          }}
        >
          {sl('Adherence evolution · 7 days', 'Évolution de l’adhérence · 7 j')}
        </span>
        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {series.map((s) => (
            <span
              key={s.key}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)' }}
            >
              <span style={{ width: 9, height: 3, borderRadius: 2, background: s.hue }} /> {s.label}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} preserveAspectRatio="none">
        {[lo, Math.round((lo + hi) / 2), hi].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeWidth="0.6" />
            <text x={2} y={y(g) + 3} fontSize="8" fill="var(--text-faint)">
              {g}
            </text>
          </g>
        ))}
        <line
          x1={padL}
          x2={W - padR}
          y1={y(threshold)}
          y2={y(threshold)}
          stroke="var(--warn)"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.8"
        />
        {series.map((s) => (
          <polyline
            key={s.key}
            points={s.trend.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={s.hue}
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {series.map((s) => (
          <circle key={s.key} cx={x(n - 1)} cy={y(s.trend[n - 1])} r="2.6" fill={s.hue} />
        ))}
      </svg>
    </Card>
  );
}

export function ContractorScorecardPage({ building, onOpenChat }) {
  const sl = useSL();
  const session = useSession();
  const orgId = session?.organizationId;
  const { byTop, overall, rows } = useServicingRollup(building, orgId, { viewer: true });
  const { thresholdPct } = useContractorThresholds(orgId);
  const { inspections } = useInspections(orgId);
  const { items: openItems } = useServicingOpenItems(building, orgId);
  const { contracts } = useContractorAnalytics(orgId);
  const { rows: ledger } = useContractorPenaltyLedger(orgId);
  const fmtCurrency = useFormatCurrency();
  // All line drill-ins are open by default ("expanded all the time"); we track
  // the keys a user has explicitly COLLAPSED, so multiple stay open at once and
  // the page reads as a full at-a-glance scorecard rather than an accordion.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleLine = (key) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [showCalc, setShowCalc] = useState(false);
  const [focusSent, setFocusSent] = useState(false);

  // Per service line: the active contract's penalty term + value + breach streak,
  // so each line can carry its $-at-risk. (Penalty model lives in penalty-model.js.)
  const penaltyByLine = useMemo(() => {
    const streakByContract = {};
    const seen = {};
    for (const r of ledger || []) {
      if (seen[r.contract_id]) continue;
      streakByContract[r.contract_id] = r.streak || 0;
      seen[r.contract_id] = 1; // rows period-desc
    }
    const m = {};
    for (const c of contracts || []) {
      if (c.status !== 'active') continue;
      const line = canonicalServiceLine(c.service_kind);
      const term = penaltyTermFor(c, line);
      (m[line] || (m[line] = [])).push({
        term,
        monthlyValue: c.monthly_value,
        currency: c.currency,
        streak: streakByContract[c.id] || 0,
      });
    }
    return m;
  }, [contracts, ledger]);
  // Trailing penalties avoided (3 most-recent months per contract) for the badge.
  const avoided3 = useMemo(() => {
    const counts = {};
    let total = 0;
    let currency = null;
    for (const r of ledger || []) {
      // rows are period-desc
      counts[r.contract_id] = (counts[r.contract_id] || 0) + 1;
      if (counts[r.contract_id] <= 3) {
        total += Number(r.amount_avoided) || 0;
        currency = currency || r.currency;
      }
    }
    return { total, currency };
  }, [ledger]);

  const latestInspection = useMemo(() => {
    const m = {};
    for (const i of inspections) {
      if (i.status !== 'completed') continue;
      if (!m[i.service_kind] || new Date(i.scheduled_for) > new Date(m[i.service_kind].scheduled_for))
        m[i.service_kind] = i;
    }
    return m;
  }, [inspections]);

  const lines = useMemo(
    () =>
      SERVICING_GROUP_DOMAINS.filter((k) => byTop[k]).map((k) => {
        const s = byTop[k];
        const lp = LINE_LABEL[k] || ['Services', 'Services'];
        const fc = slaForecast(
          { id: `sc:${k}`, current: s.adh, target: thresholdPct, computable: true },
          { thresholdPct },
        );
        // $-at-risk: sum each contract on this line's penalty exposure at the forecast low.
        let penaltyAtRisk = 0;
        let pCurrency = null;
        for (const p of penaltyByLine[k] || []) {
          penaltyAtRisk += forecastExposure({
            term: p.term,
            monthlyValue: p.monthlyValue,
            fc,
            streak: p.streak,
          }).amount;
          pCurrency = pCurrency || p.currency;
        }
        return {
          key: k,
          label: sl(lp[0], lp[1]),
          adh: s.adh,
          overdue: s.overdue,
          open: s.open,
          total: s.total,
          trend: synthTrend(`scorecard:${k}`, s.adh),
          fc,
          inspection: latestInspection[k] || null,
          penaltyAtRisk,
          penaltyCurrency: pCurrency,
          subAreas: (rows || [])
            .filter((r) => String(r.domain || '').split('_')[0] === k)
            .sort((a, b) => (a.adherence_pct ?? 100) - (b.adherence_pct ?? 100)),
          items: (openItems || []).filter((it) => it.line === k),
        };
      }),
    [byTop, thresholdPct, latestInspection, rows, openItems, penaltyByLine, sl],
  );

  // "At risk" uses the SAME forecast signal as the per-line FORECAST pills, so
  // the focus card and the cards never disagree at the threshold boundary.
  const atRisk = lines.filter((l) => l.fc && l.fc.willAlert);
  const grade = gradeFor(overall.adh);
  const totalItems = lines.reduce((n, l) => n + (l.total || 0), 0);
  // The single highest-leverage move: the at-risk line with the most money on the
  // line (penalty $ at risk), falling back to the worst adherence when penalties tie.
  const focus = atRisk.slice().sort((a, b) => b.penaltyAtRisk - a.penaltyAtRisk || a.adh - b.adh)[0] || null;

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
      {/* Header + headline grade (click to explain) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-dim)' }}>
            {sl('SCORECARD', 'TABLEAU DE BORD')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <Icon.scoreboard size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{sl('Where you stand', 'Où vous en êtes')}</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 720, lineHeight: 1.5 }}>
            {sl(
              'Every service line at a glance — click a line to drill in, or the grade to see how it’s scored.',
              'Chaque métier en un coup d’œil — cliquez un métier pour explorer, ou la note pour voir son calcul.',
            )}
          </p>
          {avoided3.total > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 8,
                padding: '5px 11px',
                borderRadius: 999,
                background: 'color-mix(in oklch, var(--ok) 12%, transparent)',
                color: 'var(--ok)',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <Icon.check size={13} />
              {sl(
                `${fmtCurrency(avoided3.total, avoided3.currency)} in SLA penalties avoided over 3 months`,
                `${fmtCurrency(avoided3.total, avoided3.currency)} de pénalités SLA évitées sur 3 mois`,
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowCalc((v) => !v)}
          title={sl('How is this calculated?', 'Comment est-ce calculé ?')}
          style={{
            minWidth: 170,
            padding: '14px 18px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            textAlign: 'center',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            {sl('Overall adherence', 'Adhérence globale')}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 34, fontWeight: 800, color: `var(--${tone(overall.adh, thresholdPct)})` }}>
              {overall.adh != null ? `${overall.adh}%` : '—'}
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: `var(--${tone(overall.adh, thresholdPct)})` }}>
              {grade}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>
            {showCalc ? sl('hide breakdown', 'masquer le détail') : sl('how is this scored?', 'comment est-ce noté ?')}
          </div>
        </button>
      </div>

      {/* Grade calculation breakdown */}
      {showCalc && overall.adh != null && (
        <Card>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
            {sl('How your overall adherence is scored', 'Comment votre adhérence globale est calculée')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10 }}>
            {sl(
              `It’s the item-weighted mean of every serviced item across your lines — ${totalItems} items in total — so a big line counts more than a small one. Each line contributes its adherence × its item count:`,
              `C’est la moyenne pondérée par élément de tous vos éléments servis — ${totalItems} au total — un grand métier pèse donc plus qu’un petit. Chaque métier contribue à hauteur de son adhérence × son nombre d’éléments :`,
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lines.map((l) => (
              <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{ minWidth: 110, fontWeight: 600 }}>{l.label}</span>
                <span style={{ color: `var(--${tone(l.adh, thresholdPct)})`, fontWeight: 700, minWidth: 44 }}>
                  {l.adh}%
                </span>
                <span style={{ color: 'var(--text-faint)' }}>
                  × {l.total} {sl('items', 'élém.')}
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>
                  {Math.round((l.adh * l.total) / Math.max(1, totalItems))}
                  {sl('pp contribution', 'pp')}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10, lineHeight: 1.5 }}>
            {sl(
              'Grade bands: A+ ≥97 · A ≥93 · B ≥88 · C ≥80 · D ≥70 · F below. “At risk” = a line forecast below your alert threshold.',
              'Barème : A+ ≥97 · A ≥93 · B ≥88 · C ≥80 · D ≥70 · F en dessous. « À risque » = un métier prévu sous votre seuil d’alerte.',
            )}
          </div>
        </Card>
      )}

      {/* This week's focus + Evolution chart */}
      {lines.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          {focus ? (
            <Card accent>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <Icon.bolt size={14} style={{ color: 'var(--accent)' }} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.2,
                    color: 'var(--accent)',
                    textTransform: 'uppercase',
                  }}
                >
                  {sl('This week’s focus', 'Priorité de la semaine')}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                {sl(`Close the ${focus.label} gap`, `Combler l’écart ${focus.label}`)}
                {focus.penaltyAtRisk > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: 'var(--warn)' }}>
                    {sl(
                      `protects ~${fmtCurrency(focus.penaltyAtRisk, focus.penaltyCurrency)}/mo`,
                      `protège ~${fmtCurrency(focus.penaltyAtRisk, focus.penaltyCurrency)}/mois`,
                    )}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                {sl(
                  `${focus.label} is forecast below your ${thresholdPct}% line (${focus.adh}% now${focus.fc ? `, dipping to ~${Math.round(focus.fc.projectedMin)}%` : ''}), with ${focus.overdue} overdue${focus.open ? ` and ${focus.open} open` : ''}.${focus.penaltyAtRisk > 0 ? ` That puts ~${fmtCurrency(focus.penaltyAtRisk, focus.penaltyCurrency)}/mo of SLA penalties at risk.` : ''} Closing it lifts your overall toward ~${Math.min(99, overall.adh + 2)}% and removes your biggest FM escalation risk.`,
                  `${focus.label} est prévu sous votre seuil de ${thresholdPct}% (${focus.adh}% actuellement${focus.fc ? `, jusqu’à ~${Math.round(focus.fc.projectedMin)}%` : ''}), avec ${focus.overdue} en retard${focus.open ? ` et ${focus.open} ouvert(s)` : ''}.${focus.penaltyAtRisk > 0 ? ` Cela met ~${fmtCurrency(focus.penaltyAtRisk, focus.penaltyCurrency)}/mois de pénalités SLA en jeu.` : ''} Le résorber relève votre global vers ~${Math.min(99, overall.adh + 2)}% et supprime votre principal risque d’escalade FM.`,
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={async () => {
                    if (focusSent) return;
                    try {
                      await contractorDispatch({
                        line: focus.key,
                        title: `${focus.label}: dispatch crew to close the gap`,
                        detail: `Dispatched to close the ${focus.label.toLowerCase()} gap this week.`,
                      });
                      setFocusSent(true);
                    } catch {
                      /* noop */
                    }
                  }}
                  disabled={focusSent}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    background: focusSent ? 'color-mix(in oklch, var(--ok) 14%, transparent)' : 'var(--accent)',
                    color: focusSent ? 'var(--ok)' : '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: focusSent ? 'default' : 'pointer',
                  }}
                >
                  {focusSent ? (
                    <>✓ {sl('Crew dispatched', 'Équipe dépêchée')}</>
                  ) : (
                    <>
                      <Icon.ship size={12} /> {sl('Dispatch the fix', 'Dépêcher l’action')}
                    </>
                  )}
                </button>
                {onOpenChat && (
                  <button
                    onClick={() =>
                      onOpenChat(
                        sl(
                          `Build me a plan to close the ${focus.label.toLowerCase()} gap this week — what to dispatch first and the order.`,
                          `Construis un plan pour combler l’écart ${focus.label.toLowerCase()} cette semaine — quoi dépêcher d’abord et dans quel ordre.`,
                        ),
                        { send: true },
                      )
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      border: '1px solid var(--accent-line)',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon.sparkle size={12} /> {sl('Plan it with Merlin', 'Planifier avec Merlin')}
                  </button>
                )}
              </div>
              {focusSent && (
                <div style={{ fontSize: 11, color: 'var(--ok)', marginTop: 6 }}>
                  {sl(
                    'Crew dispatched — now In-progress on your Activity feed.',
                    'Équipe dépêchée — désormais En cours sur votre flux.',
                  )}
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <Icon.check size={14} style={{ color: 'var(--ok)' }} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.2,
                    color: 'var(--ok)',
                    textTransform: 'uppercase',
                  }}
                >
                  {sl('All lines on track', 'Tous les métiers conformes')}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {sl(
                  'Every line is above your alert threshold. Hold cadence and bank the margin.',
                  'Chaque métier est au-dessus de votre seuil. Maintenez le rythme.',
                )}
              </div>
            </Card>
          )}
          <EvolutionChart lines={lines} threshold={thresholdPct} sl={sl} />
        </div>
      )}

      {lines.length === 0 && (
        <Card>
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {sl('No service lines on this workspace yet.', 'Aucun métier sur cet espace pour l’instant.')}
          </div>
        </Card>
      )}

      {/* Per-line cards — expanded by default; click a header to collapse/expand */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lines.map((l) => {
          const LineIcon = Icon[LINE_ICON[l.key]] || Icon.sparkle;
          const t = tone(l.adh, thresholdPct);
          const insTone =
            l.inspection == null
              ? 'neutral'
              : l.inspection.result === 'pass'
                ? 'ok'
                : l.inspection.result === 'conditional'
                  ? 'warn'
                  : 'risk';
          const forecastBad = l.fc && l.fc.willAlert;
          const isOpen = !collapsed.has(l.key);
          return (
            <Card key={l.key}>
              <div
                onClick={() => toggleLine(l.key)}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleLine(l.key);
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 190 }}>
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: 'var(--accent-soft)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <LineIcon size={16} style={{ color: 'var(--accent)' }} />
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{l.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {l.overdue} {sl('overdue', 'en retard')}
                      {l.open ? ` · ${l.open} ${sl('open', 'ouv.')}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: `var(--${t})`, lineHeight: 1 }}>
                      {l.adh != null ? `${l.adh}%` : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                      {sl('vs', 'vs')} {thresholdPct}%
                    </div>
                  </div>
                  <Trend series={l.trend} tone={t} />
                </div>
                <div style={{ minWidth: 130 }}>
                  <div
                    style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}
                  >
                    {sl('Forecast', 'Prévision')}
                  </div>
                  {forecastBad ? (
                    <Pill tone="risk">
                      {l.fc.current < thresholdPct
                        ? sl('Below threshold', 'Sous le seuil')
                        : sl(`Below ${inDays(l.fc.daysToThreshold, sl)}`, `Sous ${inDays(l.fc.daysToThreshold, sl)}`)}
                    </Pill>
                  ) : (
                    <Pill tone="ok">{sl('On track', 'Conforme')}</Pill>
                  )}
                </div>
                <div style={{ minWidth: 130 }}>
                  <div
                    style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}
                  >
                    {sl('Last inspection', 'Dernier contrôle')}
                  </div>
                  {l.inspection ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: `var(--${insTone})` }}>
                        {l.inspection.score}%
                      </span>
                      <Pill tone={insTone}>
                        {l.inspection.result === 'pass'
                          ? sl('Pass', 'Conforme')
                          : l.inspection.result === 'conditional'
                            ? sl('Conditional', 'Sous cond.')
                            : sl('Fail', 'Échec')}
                      </Pill>
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{sl('None yet', 'Aucun')}</span>
                  )}
                </div>
                <span
                  aria-hidden
                  style={{
                    marginLeft: 'auto',
                    fontSize: 15,
                    color: 'var(--text-faint)',
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform .15s',
                  }}
                >
                  ›
                </span>
              </div>

              {isOpen && <LineDetail l={l} thresholdPct={thresholdPct} onOpenChat={onOpenChat} sl={sl} />}
            </Card>
          );
        })}
      </div>

      {onOpenChat && lines.length > 0 && (
        <button
          onClick={() =>
            onOpenChat(
              sl(
                'Give me a quick read on where I stand across all my service lines and what to focus on this week.',
                'Fais-moi un point rapide sur où j’en suis sur tous mes métiers et sur quoi me concentrer cette semaine.',
              ),
              { send: true },
            )
          }
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 13px',
            fontSize: 12.5,
            fontWeight: 600,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '1px solid var(--accent-line)',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <Icon.sparkle size={13} /> {sl('Ask Merlin for a portfolio read', 'Demander un point global à Merlin')}
        </button>
      )}
    </main>
  );
}

// Expanded drill-in for one line: weakest sub-areas, the real open/overdue items,
// forecast detail, last inspection, and a focused Ask-Merlin.
function LineDetail({ l, thresholdPct, onOpenChat, sl }) {
  const weak = l.subAreas.filter((r) => (r.adherence_pct ?? 100) < thresholdPct).slice(0, 6);
  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: '1px solid var(--border)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16,
      }}
    >
      {/* Weakest sub-areas */}
      <div>
        <SectionLabel icon="grid" text={sl('Weakest areas', 'Zones les plus faibles')} />
        {weak.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--ok)', marginTop: 6 }}>
            {sl('All areas above your line.', 'Toutes les zones au-dessus du seuil.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {weak.map((r) => {
              const adh = Math.round(r.adherence_pct ?? 0);
              const rt = adh >= thresholdPct ? 'ok' : adh >= thresholdPct - 5 ? 'warn' : 'risk';
              return (
                <div key={r.domain} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span
                    style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {AREA_BY_DOMAIN[r.domain]?.fallback || prettyDomain(r.domain)}
                  </span>
                  <span style={{ fontWeight: 700, color: `var(--${rt})` }}>{adh}%</span>
                  {r.overdue_now > 0 && (
                    <span style={{ color: 'var(--text-faint)' }}>
                      · {r.overdue_now} {sl('overdue', 'en retard')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* The actual open/overdue items */}
      <div>
        <SectionLabel icon="paper" text={sl('Open & overdue items', 'Éléments ouverts & en retard')} />
        {l.items.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
            {sl('Nothing flagged right now.', 'Rien à signaler.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {l.items.slice(0, 6).map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span
                  style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {it.item}
                </span>
                <span style={{ fontWeight: 700, color: it.open_count > 0 ? 'var(--warn)' : 'var(--risk)' }}>
                  {it.open_count > 0
                    ? sl(`${it.open_count} open`, `${it.open_count} ouv.`)
                    : `${it.hours_over}h ${sl('over', 'dépass.')}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Forecast + inspection + action */}
      <div>
        <SectionLabel icon="beacon" text={sl('Outlook', 'Perspective')} />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
          {l.fc &&
            (l.fc.willAlert ? (
              <div style={{ color: 'var(--risk)' }}>
                {l.fc.current < thresholdPct
                  ? sl(
                      `Below your ${thresholdPct}% threshold now (proj. ${Math.round(l.fc.projectedMin)}%).`,
                      `Sous votre seuil de ${thresholdPct}% (proj. ${Math.round(l.fc.projectedMin)}%).`,
                    )
                  : sl(
                      `Forecast below ${thresholdPct}% ${inDays(l.fc.daysToThreshold, sl)}.`,
                      `Prévu sous ${thresholdPct}% ${inDays(l.fc.daysToThreshold, sl)}.`,
                    )}
              </div>
            ) : (
              <div style={{ color: 'var(--ok)' }}>
                {sl('On track against your threshold.', 'Conforme à votre seuil.')}
              </div>
            ))}
          {l.inspection && (
            <div>
              {sl(
                `Last inspection: ${l.inspection.score}% (${l.inspection.result}).`,
                `Dernier contrôle : ${l.inspection.score}% (${l.inspection.result}).`,
              )}
            </div>
          )}
        </div>
        {onOpenChat && (
          <button
            onClick={() =>
              onOpenChat(
                sl(
                  `What's dragging my ${l.label.toLowerCase()} line and what should I fix first?`,
                  `Qu'est-ce qui pèse sur mon métier ${l.label.toLowerCase()} et que dois-je corriger d'abord ?`,
                ),
                { send: true },
              )
            }
            style={{
              marginTop: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 11px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <Icon.sparkle size={12} /> {sl(`Ask Merlin about ${l.label}`, `Demander à Merlin sur ${l.label}`)}
          </button>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ icon, text }) {
  const I = Icon[icon] || Icon.sparkle;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <I size={12} style={{ color: 'var(--text-dim)' }} />
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.2,
          color: 'var(--text-soft)',
          textTransform: 'uppercase',
        }}
      >
        {text}
      </span>
    </div>
  );
}
