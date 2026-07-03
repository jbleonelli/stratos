// ContractorAnticipatePage — the ANTICIPATE pillar, reframed for a contractor.
//
// Owners get a building-wide forecast (energy/comfort/compliance). A contractor
// needs forward-looking risk for THEIR service line: where am I about to miss an
// SLA, what's coming up (renewals), and what device signals should I get ahead
// of. One card per active contract (≈ per client site), grouped by service line.
//
// SLA EARLY-WARNING (feature A): the forecast runs on each line's REAL service
// adherence (the item-weighted % from the live servicing board — the same number
// shown in SERVICING / the Now strip), NOT the contract's individual clause
// readings (some of which aren't measured in the demo and read 0%). The
// contractor sets the threshold at which Merlin should alert them
// (contractor_alert_thresholds, mig 227); when a line is forecast to dip below
// it, the card raises an alert with ranked mitigations + a "draft a plan" CTA,
// and the page summarises all alerts in a banner.
//
// Data is real + contractor-scoped: useContractorAnalytics (contracts/renewals),
// useServicingRollup (live per-line adherence, viewer-scoped), useContractPerformance
// (the per-clause SLA list shown beside it), and the /signals endpoint.
//
// i18n: English string-literals localized via the servicing useSL() picker.

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card } from './primitives.jsx';
import { useSession } from './auth.js';
import { canonicalServiceLine, SERVICE_LINE_ORDER } from './service-line.js';
import {
  useContractorAnalytics,
  useContractPerformance,
  fetchContractSignals,
  useContractorThresholds,
  setContractorThreshold,
  useContractorPenaltyLedger,
} from './slas-data.js';
import { useServicingRollup, contractorDispatch } from './servicing-data.js';
import { slaForecast, slaMitigations, mitigationPrompt, inDays } from './sla-forecast.js';
import { penaltyTermFor, forecastExposure, penaltyAvoided, termSummary } from './penalty-model.js';
import { useFormatCurrency } from './locale-format.js';
import { relativeTime } from './incident-actions.js';
import { useSL } from './servicing-i18n.js';

const LINE_LABEL = {
  cleaning: ['Cleaning', 'Nettoyage'],
  security: ['Security', 'Sécurité'],
  maintenance: ['Maintenance', 'Maintenance'],
  hospitality: ['Hospitality', 'Hôtellerie'],
};
const LINE_ICON = { cleaning: 'cleaning', security: 'security', maintenance: 'cog', hospitality: 'hospitality' };
const STATUS_TONE = { breach: 'risk', at_risk: 'warn', ok: 'ok', pending: 'neutral' };
const STATUS_LABEL = {
  breach: ['Breach', 'Non respecté'],
  at_risk: ['At risk', 'À risque'],
  ok: ['On track', 'Conforme'],
  pending: ['Gathering data', 'Collecte de données'],
};
const FC_TONE = { breach: 'risk', at_risk: 'risk', watch: 'warn', ok: 'ok' };
const SIGNAL_FR = {
  cleaning: 'Nettoyage & hygiène',
  supply: 'Consommables',
  compliance: 'Conformité',
  servicing: 'Services & SLA',
  security: 'Sécurité & sûreté',
  hvac: 'CVC',
  energy: 'Énergie',
  space: 'Espace & occupation',
};
const RENEWAL_SOON_DAYS = 120;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}
function slaRiskRank(s) {
  return { breach: 0, at_risk: 1, ok: 2, pending: 3 }[s.status] ?? 4;
}

export function ContractorAnticipatePage({ building, onOpenChat }) {
  const sl = useSL();
  const session = useSession();
  const orgId = session?.organizationId;
  const { contracts, loaded } = useContractorAnalytics(orgId);
  const { thresholdPct, leadDays, enabled, loaded: thLoaded, refresh: refreshTh } = useContractorThresholds(orgId);
  // Live, item-weighted per-line adherence — the real basis for the forecast.
  const { byTop } = useServicingRollup(building, orgId, { viewer: true });
  // Penalty track record (mig 238) — drives the escalation streak on live
  // exposure and the "avoided lately" counterpoint on the exposure card.
  const { rows: ledger } = useContractorPenaltyLedger(orgId);
  // Latest streak + trailing avoided ($, last 3 months) per contract.
  const ledgerByContract = useMemo(() => {
    const m = {};
    for (const r of ledger || []) {
      const e = m[r.contract_id] || (m[r.contract_id] = { streak: 0, avoided3: 0, seen: 0 });
      if (e.seen === 0) e.streak = r.streak || 0; // rows are period-desc; first = latest
      if (e.seen < 3) e.avoided3 += Number(r.amount_avoided) || 0;
      e.seen += 1;
    }
    return m;
  }, [ledger]);

  // Each contract card reports its forecast alerts up here for the banner.
  const [alertMap, setAlertMap] = useState({});
  const reportAlerts = useCallback((cid, list) => {
    setAlertMap((prev) => {
      if (!list || list.length === 0) {
        if (!prev[cid]) return prev;
        const next = { ...prev };
        delete next[cid];
        return next;
      }
      return { ...prev, [cid]: list };
    });
  }, []);
  const allAlerts = useMemo(() => Object.values(alertMap).flat(), [alertMap]);
  const fmtCurrency = useFormatCurrency();

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

  // SLA penalty exposure: FMs attach penalty terms to a contract's SLA (an
  // adherence floor, a $-rate per point below it, a cap, escalation on repeat).
  // Tie the forecast to those REAL terms — per contract, the charge at the
  // forecast's projected low against the FM floor, escalated by the current
  // breach streak. Deterministic. (penalty-model.js holds the math.)
  const penaltyExposure = useMemo(() => {
    let total = 0;
    const perLine = [];
    let currency = null;
    let avoided3 = 0;
    for (const g of lineGroups) {
      const adh = byTop[g.line]?.adh;
      if (adh == null) continue;
      const fc = slaForecast(
        { id: `pe:${g.line}`, current: adh, target: thresholdPct, computable: true },
        { thresholdPct },
      );
      if (!fc) continue;
      let lineAmount = 0;
      let floor = null;
      for (const c of g.contracts) {
        const term = penaltyTermFor(c, g.line);
        const streak = ledgerByContract[c.id]?.streak || 0;
        const { amount } = forecastExposure({ term, monthlyValue: c.monthly_value, fc, streak });
        lineAmount += amount;
        floor = floor == null ? term.floor_pct : Math.max(floor, term.floor_pct);
        avoided3 += ledgerByContract[c.id]?.avoided3 || 0;
        currency = currency || c.currency;
      }
      if (lineAmount <= 0) continue;
      const lp = LINE_LABEL[g.line] || ['Services', 'Services'];
      perLine.push({ line: g.line, label: sl(lp[0], lp[1]), amount: lineAmount, floor });
      total += lineAmount;
    }
    perLine.sort((a, b) => b.amount - a.amount);
    return { total, perLine, currency, avoided3 };
  }, [lineGroups, byTop, thresholdPct, ledgerByContract, sl]);

  const renewals = useMemo(() => {
    const all = [];
    for (const g of lineGroups) {
      for (const c of g.contracts) {
        const days = daysUntil(c.end_date);
        if (days != null && days <= RENEWAL_SOON_DAYS) all.push({ c, days, line: g.line });
      }
    }
    return all.sort((a, b) => a.days - b.days);
  }, [lineGroups]);

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
      {/* Header + threshold control */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-dim)' }}>
            {sl('ANTICIPATE', 'ANTICIPER')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <Icon.beacon size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              {sl('What to get ahead of', 'Ce qu’il faut anticiper')}
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 700, lineHeight: 1.5 }}>
            {sl(
              'Where your service adherence is forecast to slip below your SLA before it happens, the contracts coming up for renewal, and the live signals worth acting on — across every line you run.',
              'Où votre adhérence est prévue de passer sous votre SLA avant que cela n’arrive, les contrats à renouveler et les signaux en direct à surveiller — pour chacun de vos métiers.',
            )}
          </p>
        </div>
        {thLoaded && (
          <ThresholdControl
            thresholdPct={thresholdPct}
            leadDays={leadDays}
            enabled={enabled}
            onSaved={refreshTh}
            sl={sl}
          />
        )}
      </div>

      {/* Forecast-alert banner — aggregated across all lines */}
      {enabled && allAlerts.length > 0 && (
        <ForecastAlertBanner alerts={allAlerts} thresholdPct={thresholdPct} sl={sl} />
      )}

      {/* SLA penalty exposure — the money behind the misses */}
      {enabled && penaltyExposure.total > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
              <Icon.bolt size={18} style={{ color: 'var(--warn)' }} />
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.2,
                    color: 'var(--text-soft)',
                    textTransform: 'uppercase',
                  }}
                >
                  {sl('SLA penalty exposure', 'Exposition aux pénalités SLA')}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--warn)' }}>
                  ~{fmtCurrency(penaltyExposure.total, penaltyExposure.currency)}
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>
                    /{sl('mo at risk', 'mois à risque')}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {sl(
                'Penalties your client can charge this month if the forecast holds — on the SLA floors they set. ',
                'Pénalités que votre client peut appliquer ce mois-ci si la tendance se confirme — sur les seuils SLA qu’il a fixés. ',
              )}
              {penaltyExposure.perLine[0] &&
                sl(
                  `Closing ${penaltyExposure.perLine[0].label} alone avoids ~${fmtCurrency(penaltyExposure.perLine[0].amount, penaltyExposure.currency)}.`,
                  `Résoudre ${penaltyExposure.perLine[0].label} évite à lui seul ~${fmtCurrency(penaltyExposure.perLine[0].amount, penaltyExposure.currency)}.`,
                )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {penaltyExposure.perLine.map((p) => (
                  <span
                    key={p.line}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: 'color-mix(in oklch, var(--warn) 10%, transparent)',
                      color: 'var(--warn)',
                    }}
                  >
                    {p.label} {fmtCurrency(p.amount, penaltyExposure.currency)}
                    {p.floor != null ? ` · <${p.floor}%` : ''}
                  </span>
                ))}
              </div>
              {penaltyExposure.avoided3 > 0 && (
                <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: 'var(--ok)' }}>
                  ✓{' '}
                  {sl(
                    `You've avoided ~${fmtCurrency(penaltyExposure.avoided3, penaltyExposure.currency)} in penalties over the last 3 months by staying above the floor.`,
                    `Vous avez évité ~${fmtCurrency(penaltyExposure.avoided3, penaltyExposure.currency)} de pénalités sur les 3 derniers mois en restant au-dessus du seuil.`,
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Renewals strip — across all lines */}
      {renewals.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon.bell size={14} style={{ color: 'var(--accent)' }} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>{sl('Renewals coming up', 'Renouvellements à venir')}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {renewals.map(({ c, days, line }) => {
              const lp = LINE_LABEL[line] || ['Services', 'Services'];
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: days <= 30 ? 'color-mix(in oklch, var(--warn) 8%, transparent)' : 'var(--surface-3)',
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                    {c.manager_org?.name || c.name} · {sl(lp[0], lp[1])}
                  </span>
                  <span style={{ fontSize: 11, color: days <= 30 ? 'var(--warn)' : 'var(--text-dim)' }}>
                    {days <= 0
                      ? sl('Expired — pitch a renewal', 'Expiré — proposez un renouvellement')
                      : sl(`Renews in ${days} day${days === 1 ? '' : 's'}`, `Renouvellement dans ${days} j`)}
                  </span>
                </div>
              );
            })}
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
            {sl(
              'No active contracts on this workspace yet. Check OPERATE → Contracts.',
              'Aucun contrat actif sur cet espace pour l’instant. Voir OPÉRER → Contrats.',
            )}
          </div>
        </Card>
      )}

      {/* One section per service line */}
      {lineGroups.map((g) => {
        const lp = LINE_LABEL[g.line] || ['Services', 'Services'];
        const label = sl(lp[0], lp[1]);
        const LineIcon = Icon[LINE_ICON[g.line]] || Icon.sparkle;
        const lineAdh = byTop[g.line]?.adh ?? null;
        return (
          <section key={g.line} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                paddingTop: 2,
                borderTop: '1px solid var(--border)',
                marginTop: 2,
              }}
            >
              <LineIcon size={17} style={{ color: 'var(--accent)', marginTop: 12 }} />
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: '12px 0 0' }}>{label}</h2>
            </div>
            {g.contracts.map((c) => (
              <ContractAnticipateCard
                key={c.id}
                contract={c}
                label={label}
                line={g.line}
                lineAdh={lineAdh}
                onOpenChat={onOpenChat}
                thresholdPct={thresholdPct}
                alertsEnabled={enabled}
                onAlerts={reportAlerts}
                streak={ledgerByContract[c.id]?.streak || 0}
              />
            ))}
          </section>
        );
      })}
    </main>
  );
}

// ── Threshold control — "alert me when forecast adherence drops below X%" ──
function ThresholdControl({ thresholdPct, leadDays, enabled, onSaved, sl }) {
  const [editing, setEditing] = useState(false);
  const [pct, setPct] = useState(thresholdPct);
  const [lead, setLead] = useState(leadDays);
  const [on, setOn] = useState(enabled);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setPct(thresholdPct);
    setLead(leadDays);
    setOn(enabled);
  }, [thresholdPct, leadDays, enabled, editing]);

  const save = async () => {
    setSaving(true);
    try {
      await setContractorThreshold({ thresholdPct: Number(pct), leadDays: Number(lead), enabled: on });
      onSaved?.();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        minWidth: 248,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--surface-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <Icon.bell size={13} style={{ color: enabled ? 'var(--accent)' : 'var(--text-faint)' }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.2,
            color: 'var(--text-soft)',
            textTransform: 'uppercase',
          }}
        >
          {sl('SLA breach alert', 'Alerte de manquement SLA')}
        </span>
      </div>
      {!editing ? (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>
            {enabled
              ? sl(
                  `Alert me when a line is forecast below ${thresholdPct}% — ${leadDays} day${leadDays === 1 ? '' : 's'} ahead.`,
                  `M’alerter quand un métier est prévu sous ${thresholdPct}% — ${leadDays} j à l’avance.`,
                )
              : sl('Forecast alerts are off.', 'Alertes de prévision désactivées.')}
          </div>
          <button onClick={() => setEditing(true)} style={linkBtn}>
            {sl('Adjust', 'Ajuster')}
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
            {sl('Forecast alerts on', 'Alertes activées')}
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 12,
              opacity: on ? 1 : 0.5,
            }}
          >
            {sl('Alert below', 'Alerte sous')}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                min={50}
                max={99}
                value={pct}
                disabled={!on}
                onChange={(e) => setPct(e.target.value)}
                style={numInput}
              />
              %
            </span>
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 12,
              opacity: on ? 1 : 0.5,
            }}
          >
            {sl('Lead time', 'Délai d’alerte')}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                min={1}
                max={30}
                value={lead}
                disabled={!on}
                onChange={(e) => setLead(e.target.value)}
                style={numInput}
              />
              {sl('d', 'j')}
            </span>
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <button onClick={save} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? sl('Saving…', 'Enregistrement…') : sl('Save', 'Enregistrer')}
            </button>
            <button onClick={() => setEditing(false)} style={linkBtn}>
              {sl('Cancel', 'Annuler')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aggregated alert banner ──
function ForecastAlertBanner({ alerts, thresholdPct, sl }) {
  const clients = new Set(alerts.map((a) => a.client)).size;
  const soonest = alerts.reduce((m, a) => (a.days != null && (m == null || a.days < m) ? a.days : m), null);
  const n = alerts.length;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px solid color-mix(in oklch, var(--risk) 35%, var(--border))',
        background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
      }}
    >
      <Icon.warn size={18} style={{ color: 'var(--risk)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--risk)' }}>
          {sl(
            `${n} service line${n === 1 ? '' : 's'} forecast to fall below your ${thresholdPct}% threshold`,
            `${n} métier${n === 1 ? '' : 's'} prévu${n === 1 ? '' : 's'} sous votre seuil de ${thresholdPct}%`,
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {sl(
            `Across ${clients} client${clients === 1 ? '' : 's'}`,
            `Sur ${clients} client${clients === 1 ? '' : 's'}`,
          )}
          {soonest != null && ` · ${sl(`soonest ${inDays(soonest, sl)}`, `au plus tôt ${inDays(soonest, sl)}`)}`}
          {` · ${sl('see mitigations below', 'voir les actions ci-dessous')}`}
        </div>
      </div>
    </div>
  );
}

// ── Tiny forward-projection sparkline with threshold reference line ──
function ForecastSparkline({ series, threshold, tone, width = 140, height = 38 }) {
  if (!series || series.length < 2) return null;
  const pad = 3;
  const lo = Math.max(35, Math.min(...series, threshold) - 4);
  const hi = Math.min(100, Math.max(...series, threshold) + 3);
  const span = Math.max(1, hi - lo);
  const xAt = (i) => pad + (i / (series.length - 1)) * (width - 2 * pad);
  const yAt = (v) => pad + (1 - (v - lo) / span) * (height - 2 * pad);
  const pts = series.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
  const color = `var(--${tone})`;
  let cx = null;
  for (let i = 0; i < series.length; i++) {
    if (series[i] < threshold) {
      cx = i;
      break;
    }
  }
  return (
    <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      <line
        x1={pad}
        x2={width - pad}
        y1={yAt(threshold)}
        y2={yAt(threshold)}
        stroke="var(--warn)"
        strokeWidth="1"
        strokeDasharray="3 2"
        opacity="0.7"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {cx != null && <circle cx={xAt(cx)} cy={yAt(series[cx])} r="2.6" fill={color} />}
    </svg>
  );
}

function ContractAnticipateCard({
  contract,
  label,
  line,
  lineAdh,
  onOpenChat,
  thresholdPct,
  alertsEnabled,
  onAlerts,
  streak = 0,
}) {
  const sl = useSL();
  const fmtCurrency = useFormatCurrency();
  const term = useMemo(() => penaltyTermFor(contract, line), [contract, line]);
  const { slas, loaded: slasLoaded, error: slasError } = useContractPerformance(contract.id);
  const [signals, setSignals] = useState(null);
  const [signalsErr, setSignalsErr] = useState(false);
  const clientName = contract.manager_org?.name || sl('Client', 'Client');

  useEffect(() => {
    let cancelled = false;
    setSignals(null);
    setSignalsErr(false);
    fetchContractSignals(contract.id)
      .then((r) => {
        if (!cancelled) setSignals(r?.signals || []);
      })
      .catch(() => {
        if (!cancelled) setSignalsErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contract.id]);

  const sortedSlas = useMemo(() => [...(slas || [])].sort((a, b) => slaRiskRank(a) - slaRiskRank(b)), [slas]);
  // "At risk" excludes clauses that simply aren't measured yet (current 0 / null).
  const atRisk = sortedSlas.filter(
    (s) => (s.status === 'breach' || s.status === 'at_risk') && (s.current ?? 0) > 0,
  ).length;

  // ── The forecast runs on the LINE's real service adherence (item-weighted %
  // from the live board), with the contractor's threshold as the target. One
  // forecast per line — no per-clause noise, no duplicate mitigations.
  const lineSla = useMemo(
    () =>
      lineAdh == null
        ? null
        : {
            id: `${contract.id}:${line}`,
            name: sl(`${label} service adherence`, `Adhérence ${label.toLowerCase()}`),
            current: lineAdh,
            target: thresholdPct,
            computable: true,
          },
    [contract.id, line, lineAdh, thresholdPct, label, sl],
  );
  const fc = useMemo(() => (lineSla ? slaForecast(lineSla, { thresholdPct }) : null), [lineSla, thresholdPct]);
  const alerting = useMemo(
    () => (alertsEnabled && fc && fc.willAlert && lineSla ? [{ s: lineSla, fc }] : []),
    [alertsEnabled, fc, lineSla],
  );

  // Report this card's alert up to the page banner.
  const alertKey = alerting.map((a) => `${a.s.id}:${a.fc.daysToThreshold}`).join('|');
  useEffect(() => {
    onAlerts?.(
      contract.id,
      alerting.map((a) => ({
        id: a.s.id,
        name: a.s.name,
        client: clientName,
        line,
        days: a.fc.daysToThreshold,
      })),
    );
    return () => onAlerts?.(contract.id, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertKey, contract.id]);

  return (
    <Card>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
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
        {lineAdh != null && (
          <Pill tone={lineAdh >= thresholdPct ? 'ok' : 'risk'}>
            {sl(`Adherence ${Math.round(lineAdh)}%`, `Adhérence ${Math.round(lineAdh)}%`)}
          </Pill>
        )}
        {contract.monthly_value != null && (
          <Pill tone="neutral">
            {fmtCurrency(contract.monthly_value, contract.currency)}/{sl('mo', 'mois')}
          </Pill>
        )}
        <Pill tone="neutral" title={termSummary(term, sl)}>
          {sl('Penalty', 'Pénalité')} &lt;{term.floor_pct}%
        </Pill>
        {alerting.length > 0 ? (
          <Pill tone="risk">{sl('Forecast alert', 'Alerte prévue')}</Pill>
        ) : atRisk > 0 ? (
          <Pill tone="warn">{sl(`${atRisk} SLA${atRisk === 1 ? '' : 's'} at risk`, `${atRisk} SLA à risque`)}</Pill>
        ) : slasLoaded && sortedSlas.length > 0 ? (
          <Pill tone="ok">{sl('SLAs on track', 'SLA conformes')}</Pill>
        ) : null}
      </div>

      {/* Two-column body: SLA clause list | live signals */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* SLA clauses (per-clause status; unmeasured clauses read "gathering data") */}
        <div>
          <SectionLabel icon="shield" text={sl('SLA clauses', 'Clauses SLA')} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            <span style={{ fontWeight: 700, color: 'var(--warn)' }}>{sl('Penalty', 'Pénalité')}:</span>{' '}
            {termSummary(term, sl)}
            {term.escalation_pct > 0
              ? sl(`, +${term.escalation_pct}%/mo on repeat`, `, +${term.escalation_pct}%/mois si répété`)
              : ''}
            {streak > 0 ? sl(` · ${streak}-mo streak — escalating`, ` · ${streak} mois consécutifs — en hausse`) : ''}
          </div>
          {!slasLoaded && <Muted>{sl('Computing performance…', 'Calcul de la performance…')}</Muted>}
          {slasLoaded && slasError && (
            <Muted>
              {sl("Couldn't load performance right now.", 'Impossible de charger la performance pour le moment.')}
            </Muted>
          )}
          {slasLoaded && !slasError && sortedSlas.length === 0 && (
            <Muted>{sl('No SLAs configured on this contract.', 'Aucun SLA configuré sur ce contrat.')}</Muted>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            {sortedSlas.map((s) => {
              const noData = (s.current ?? 0) <= 0; // clause not measured in the demo
              const dispStatus = noData ? 'pending' : s.status;
              const tone = STATUS_TONE[dispStatus] || 'neutral';
              const pair = STATUS_LABEL[dispStatus] || [dispStatus, dispStatus];
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <Dot tone={tone} />
                  <span
                    style={{
                      fontSize: 12.5,
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.name}
                  </span>
                  {!noData && s.computable && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: `var(--${tone === 'neutral' ? 'text-soft' : tone})`,
                      }}
                    >
                      {Math.round(s.current)}%{' '}
                      <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>/ {s.target}%</span>
                    </span>
                  )}
                  <Pill tone={tone}>{sl(pair[0], pair[1])}</Pill>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live signals — uniform grid */}
        <div>
          <SectionLabel icon="beacon" text={sl('Live signals · 7 days', 'Signaux en direct · 7 j')} />
          {signals == null && !signalsErr && <Muted>{sl('Reading device signals…', 'Lecture des signaux…')}</Muted>}
          {signalsErr && <Muted>{sl('Signals unavailable right now.', 'Signaux indisponibles pour le moment.')}</Muted>}
          {signals != null && signals.length === 0 && (
            <Muted>
              {sl(
                'No notable signals in the last 7 days — quiet is good.',
                'Aucun signal notable sur les 7 derniers jours — le calme, c’est bien.',
              )}
            </Muted>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 8,
              marginTop: 6,
            }}
          >
            {(signals || []).map((sig) => (
              <div
                key={sig.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  padding: '9px 11px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Dot tone={sig.tone} />
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sl(sig.label, SIGNAL_FR[sig.key] || sig.label)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{sig.count}</span>
                  {sig.high > 0 && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--risk)' }}>
                      {sl(`${sig.high} high`, `${sig.high} élevés`)}
                    </span>
                  )}
                </div>
                {sig.latest && (
                  <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{relativeTime(sig.latest)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Forecast alert + mitigations — only when the line is forecast below the threshold */}
      {alerting.length > 0 && (
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid color-mix(in oklch, var(--risk) 30%, var(--border))',
            background: 'color-mix(in oklch, var(--risk) 5%, transparent)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon.warn size={14} style={{ color: 'var(--risk)' }} />
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                letterSpacing: 0.2,
                color: 'var(--risk)',
                textTransform: 'uppercase',
              }}
            >
              {sl('Forecast alert — get ahead of this', 'Alerte de prévision — anticipez')}
            </span>
          </div>
          {alerting.map(({ s, fc: f }) => (
            <ForecastRow
              key={s.id}
              sla={s}
              fc={f}
              line={line}
              label={label}
              clientName={clientName}
              onOpenChat={onOpenChat}
              sl={sl}
              term={term}
              monthlyValue={contract.monthly_value}
              currency={contract.currency}
              streak={streak}
              fmtCurrency={fmtCurrency}
            />
          ))}
        </div>
      )}

      {/* Ask Merlin */}
      {onOpenChat && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() =>
              onOpenChat(
                sl(
                  `Where am I most at risk on my ${label.toLowerCase()} SLAs at ${clientName}, and what should I do first?`,
                  `Où suis-je le plus à risque sur mes SLA ${label.toLowerCase()} chez ${clientName}, et que dois-je faire en priorité ?`,
                ),
                { send: true },
              )
            }
            style={{
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
            <Icon.sparkle size={12} /> {sl('Ask Merlin what to prioritize', 'Demander à Merlin quoi prioriser')}
          </button>
        </div>
      )}
    </Card>
  );
}

// ── The line forecast: trajectory + ranked mitigations + draft CTA ──
function ForecastRow({
  sla,
  fc,
  line,
  label,
  clientName,
  onOpenChat,
  sl,
  term,
  monthlyValue,
  currency,
  streak = 0,
  fmtCurrency,
}) {
  const [open, setOpen] = useState(true);
  const [dispatch, setDispatch] = useState('idle'); // idle | busy | done
  const tone = FC_TONE[fc.severity] || 'warn';
  const mitigations = useMemo(() => slaMitigations(sla, line, fc), [sla, line, fc]);

  // The penalty each fix avoids: how much closing `impact` points back above the
  // floor shrinks the charge, from the forecast's projected low.
  const fmt = fmtCurrency || ((n) => `$${Math.round(n || 0)}`);
  const avoidedFor = (impact) =>
    term ? penaltyAvoided({ term, monthlyValue, fromAdh: fc.projectedMin, liftPts: impact, streak }) : 0;
  const topAvoided = mitigations[0] ? avoidedFor(mitigations[0].impact) : 0;

  const doDispatch = async () => {
    if (dispatch !== 'idle') return;
    setDispatch('busy');
    try {
      const top = mitigations[0];
      await contractorDispatch({
        line,
        title: `${label}: ${top ? sl(top.title.en, top.title.fr) : 'dispatch crew'}`,
        detail: `Dispatched to protect the ${label.toLowerCase()} SLA at ${clientName}.`,
      });
      setDispatch('done');
    } catch {
      setDispatch('idle');
    }
  };

  const verdict =
    fc.current < fc.thresholdPct
      ? sl(`Below your ${fc.thresholdPct}% threshold now`, `Sous votre seuil de ${fc.thresholdPct}% actuellement`)
      : sl(
          `Forecast to dip below your ${fc.thresholdPct}% threshold ${inDays(fc.daysToThreshold, sl)}`,
          `Prévu sous votre seuil de ${fc.thresholdPct}% ${inDays(fc.daysToThreshold, sl)}`,
        );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <ForecastSparkline series={fc.series} threshold={fc.thresholdPct} tone={tone} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{sla.name}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: `var(--${tone})` }}>
              {Math.round(fc.current)}% → {Math.round(fc.projectedMin)}%
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: `var(--${tone})`, marginTop: 2 }}>{verdict}</div>
        </div>
        <button onClick={() => setOpen((o) => !o)} style={linkBtn}>
          {open ? sl('Hide fixes', 'Masquer') : sl(`${mitigations.length} fixes`, `${mitigations.length} actions`)}
        </button>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
          {mitigations.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', minWidth: 18 }}>{i + 1}.</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {sl(m.title.en, m.title.fr)}
                  <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: 'var(--ok)' }}>
                    +{m.impact}% {sl('est.', 'est.')}
                  </span>
                  {avoidedFor(m.impact) > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: 'var(--ok)' }}>
                      · {sl('avoids', 'évite')} ~{fmt(avoidedFor(m.impact), currency)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sl(m.why.en, m.why.fr)}</div>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <button
              onClick={doDispatch}
              disabled={dispatch !== 'idle'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 11px',
                fontSize: 12,
                fontWeight: 700,
                background:
                  dispatch === 'done'
                    ? 'var(--ok-soft, color-mix(in oklch, var(--ok) 14%, transparent))'
                    : 'var(--accent)',
                color: dispatch === 'done' ? 'var(--ok)' : '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: dispatch === 'idle' ? 'pointer' : 'default',
              }}
            >
              {dispatch === 'done' ? (
                <>✓ {sl('Crew dispatched', 'Équipe dépêchée')}</>
              ) : (
                <>
                  <Icon.ship size={12} />{' '}
                  {dispatch === 'busy'
                    ? sl('Dispatching…', 'Envoi…')
                    : topAvoided > 0
                      ? sl(
                          `Dispatch the top fix · avoids ~${fmt(topAvoided, currency)}`,
                          `Dépêcher l’action · évite ~${fmt(topAvoided, currency)}`,
                        )
                      : sl('Dispatch the top fix', 'Dépêcher l’action prioritaire')}
                </>
              )}
            </button>
            {onOpenChat && (
              <button
                onClick={() =>
                  onOpenChat(mitigationPrompt(sla, label.toLowerCase(), clientName, fc, sl), { send: true })
                }
                style={{
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
                <Icon.sparkle size={12} /> {sl('Draft a plan with Merlin', 'Rédiger un plan avec Merlin')}
              </button>
            )}
          </div>
          {dispatch === 'done' && (
            <div style={{ fontSize: 11, color: 'var(--ok)', paddingLeft: 4 }}>
              {sl('Now In-progress on your Activity feed.', 'Désormais En cours sur votre flux d’activité.')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ icon, text }) {
  const I = Icon[icon] || Icon.sparkle;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <I size={13} style={{ color: 'var(--text-dim)' }} />
      <span
        style={{
          fontSize: 11,
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
function Muted({ children }) {
  return <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', marginTop: 6 }}>{children}</div>;
}

const linkBtn = {
  background: 'none',
  border: 'none',
  padding: '4px 0',
  marginTop: 4,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--accent)',
  cursor: 'pointer',
  textAlign: 'left',
};
const primaryBtn = {
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
};
const numInput = {
  width: 52,
  padding: '3px 6px',
  fontSize: 12,
  textAlign: 'right',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text)',
};
