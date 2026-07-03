// KpiCockpit — the curated executive "KPI Cockpit" (Phase 1 of the FM Master
// Dashboard scope, see docs/reference/fm-master-dashboard-analysis.md).
//
// A single-screen, role-differentiated command center assembled ENTIRELY from
// data Merlin already has (no new schema): service adherence, incidents,
// devices/sensing, and the role's own economics. Every tile is value + target +
// status (green/amber/red) + a deep-link / Ask-Merlin. On-screen only (no PDF).
//
// Role split (the FM sees the whole building incl. its devices + SLA list; the
// contractor sees their contained scope + their economics/penalties). Phase-2
// families (MTTR/MTBF reliability, CAPEX/OPEX finance, HSE) are intentionally
// NOT here yet — we only render families backed by real data today.

import React, { useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Card, Pill, Dot, Ring, Sparkline } from './primitives.jsx';
import { useSession } from './auth.js';
import { useActiveOrg } from './org-data.js';
import { useSL } from './servicing-i18n.js';
import { useFormatCurrency } from './locale-format.js';
import {
  useServicingRollup,
  useBuildingSensorReadings,
  useEquipmentReliability,
  useBuildingBudgets,
  useOrgKpis,
} from './servicing-data.js';
import { useOrgIncidentSummary } from './events.js';
import { useDevices } from './devices-store.js';
import { useSlaPerformance, useContractorAnalytics, useContractorPenaltyLedger } from './slas-data.js';
import { useInspections } from './contractor-programs-data.js';

const LINE_LABEL = {
  cleaning: ['Cleaning', 'Nettoyage'],
  security: ['Security', 'Sécurité'],
  maintenance: ['Maintenance', 'Maintenance'],
  hospitality: ['Hospitality', 'Hôtellerie'],
};
const LINE_ICON = { cleaning: 'cleaning', security: 'security', maintenance: 'cog', hospitality: 'hospitality' };
// Per-discipline accent so each service line reads as its own identifiable
// section. Chosen OUTSIDE the status palette (green/amber/red) so a line's
// colour can never be confused with its on-target / watch / breach state.
const LINE_COLOR = { cleaning: '#0ea5e9', security: '#6366f1', maintenance: '#8b5cf6', hospitality: '#ec4899' };
const lineColor = (k) => LINE_COLOR[k] || 'var(--accent)';

// Status tone vs a target. higherIsBetter: ≥target = ok, within `warnBand` = warn, else risk.
function toneVs(value, target, { higherIsBetter = true, warnBand = 5 } = {}) {
  if (value == null) return 'neutral';
  if (higherIsBetter) return value >= target ? 'ok' : target - value <= warnBand ? 'warn' : 'risk';
  return value <= target ? 'ok' : value - target <= warnBand ? 'warn' : 'risk';
}
const toneColor = (t) =>
  t === 'ok' ? 'var(--ok)' : t === 'warn' ? 'var(--warn)' : t === 'risk' ? 'var(--risk)' : 'var(--text-soft)';

// Severity buckets for the incident-summary donut/legend (colour + label).
// The matching/counting lives in useOrgIncidentSummary (events.js).
const SEV = [
  { key: 'critical', color: 'var(--risk)' },
  { key: 'major', color: '#f97316' },
  { key: 'minor', color: 'var(--warn)' },
  { key: 'low', color: 'var(--ok)' },
];

export function KpiCockpit({ building, onOpenChat, onView }) {
  const sl = useSL();
  const fmtCurrency = useFormatCurrency();
  const session = useSession();
  const activeOrg = useActiveOrg();
  const orgId = session?.organizationId || null;
  const isContractor = activeOrg?.kind === 'contractor';

  // ── Shared sources (role-scoped via the `viewer` flag / contained RPCs) ──
  const { byTop, overall, loaded: rollupLoaded } = useServicingRollup(building, orgId, { viewer: isContractor });
  const { byFloor: occByFloor } = useBuildingSensorReadings(building, orgId, 'occupancy');
  const { byFloor: aqByFloor } = useBuildingSensorReadings(building, orgId, 'airquality');

  // ── FM-only sources ──
  const { counts: deviceCounts } = useDevices(isContractor ? null : building);
  const { slas, perf } = useSlaPerformance(isContractor ? null : orgId);

  // ── Contractor-only sources ──
  const { metrics: cMetrics } = useContractorAnalytics(isContractor ? orgId : null);
  const { rows: penaltyRows } = useContractorPenaltyLedger(isContractor ? orgId : null);
  const { inspections } = useInspections(isContractor ? orgId : null);

  // ── Phase 2: reliability (both roles, contained) + finance (FM only) ──
  const { rows: reliability } = useEquipmentReliability(building, orgId);
  const { capex, opex, currency: budgetCcy } = useBuildingBudgets(isContractor ? null : orgId);
  // ── Phase 3: HSE + CX (both roles; each org reads its own row) ──
  const { hse, cx } = useOrgKpis(orgId);

  // ── Derived KPIs ──
  const adherence = overall?.adh ?? null;

  // Org-wide OPEN incidents by severity (+ 48h closed) — see useOrgIncidentSummary.
  // Org-scoped on purpose: matches the rest of this FM cockpit's portfolio-level
  // KPIs and includes null-location org incidents the per-building filter dropped.
  const incidents = useOrgIncidentSummary(orgId);

  const deviceAvail = useMemo(() => {
    if (!deviceCounts || !deviceCounts.total) return null;
    return Math.round(((deviceCounts.online || deviceCounts.healthy || 0) / deviceCounts.total) * 100);
  }, [deviceCounts]);

  const avgOcc = useMemo(() => avgOfMap(occByFloor), [occByFloor]);
  const avgAq = useMemo(() => avgOfMap(aqByFloor), [aqByFloor]);

  // Contractor economics + penalties.
  const econ = useMemo(() => {
    if (!isContractor) return null;
    const counts = {};
    let avoided3 = 0;
    let currency = null;
    for (const r of penaltyRows || []) {
      counts[r.contract_id] = (counts[r.contract_id] || 0) + 1;
      if (counts[r.contract_id] <= 3) {
        avoided3 += Number(r.amount_avoided) || 0;
        currency = currency || r.currency;
      }
    }
    return {
      runRate: cMetrics?.monthlyRunRate ?? null,
      currency: currency || cMetrics?.currency || 'USD',
      activeContracts: cMetrics?.activeContracts ?? null,
      avoided3,
    };
  }, [isContractor, penaltyRows, cMetrics]);

  const qualityPass = useMemo(() => {
    if (!isContractor) return null;
    const done = (inspections || []).filter((i) => i.status === 'completed');
    if (!done.length) return null;
    return Math.round((done.filter((i) => i.result === 'pass').length / done.length) * 100);
  }, [isContractor, inspections]);

  // FM SLA list (current vs target).
  const slaRows = useMemo(() => {
    if (isContractor || !slas) return [];
    return slas
      .map((s) => ({
        id: s.id,
        name: s.name,
        target: s.target_pct ?? 95,
        current: perf?.[s.id]?.current ?? null,
        trend: perf?.[s.id]?.trend || null,
      }))
      .filter((s) => s.current != null)
      .sort((a, b) => a.current - a.target - (b.current - b.target))
      .slice(0, 8);
  }, [isContractor, slas, perf]);

  const lines = useMemo(
    () =>
      Object.keys(LINE_LABEL)
        .filter((k) => byTop?.[k])
        .map((k) => ({ key: k, ...byTop[k] })),
    [byTop],
  );

  const updated = useMemo(
    () => new Date().toLocaleTimeString(sl('en-US', 'fr-FR'), { hour: '2-digit', minute: '2-digit' }),
    [sl],
  );

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 12,
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-dim)' }}>
            {sl('KPI COCKPIT', 'COCKPIT KPI')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <Icon.monitor size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              {building?.name || sl('Workspace', 'Espace')} — {sl('operations KPI', 'KPI opérationnels')}
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 720, lineHeight: 1.5 }}>
            {isContractor
              ? sl(
                  'Your live performance across every line you run here — service, quality, incidents and the economics behind them.',
                  'Votre performance en direct sur tous vos métiers ici — service, qualité, incidents et l’économie associée.',
                )
              : sl(
                  'Whole-building health at a glance — service, incidents, assets, sensing and SLAs, each against its target.',
                  'La santé du bâtiment d’un coup d’œil — service, incidents, actifs, captation et SLA, chacun face à sa cible.',
                )}
          </p>
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--text-dim)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
          }}
        >
          <Dot tone="ok" pulse /> {sl(`Updated ${updated}`, `Mis à jour ${updated}`)}
        </div>
      </div>

      {/* Headline gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <GaugeTile
          label={sl('Service adherence', 'Adhérence service')}
          pct={adherence}
          target={95}
          onClick={() => onView?.('services')}
        />
        {isContractor ? (
          <GaugeTile
            label={sl('Quality pass rate', 'Taux de réussite qualité')}
            pct={qualityPass}
            target={90}
            onClick={() => onView?.('quality')}
          />
        ) : (
          <GaugeTile
            label={sl('Asset availability', 'Disponibilité actifs')}
            pct={deviceAvail}
            target={99}
            onClick={() => onView?.('devices')}
          />
        )}
        <StatTile
          label={sl('Open incidents', 'Incidents ouverts')}
          value={incidents.open}
          sub={sl(`${incidents.closed} closed`, `${incidents.closed} clos`)}
          tone={incidents.open > 8 ? 'risk' : incidents.open > 3 ? 'warn' : 'ok'}
          onClick={() => onView?.('activity')}
        />
        <StatTile
          label={sl('Overdue items', 'Éléments en retard')}
          value={overall?.overdue ?? '—'}
          sub={sl(`${overall?.open ?? 0} open`, `${overall?.open ?? 0} ouv.`)}
          tone={(overall?.overdue || 0) > 20 ? 'risk' : (overall?.overdue || 0) > 8 ? 'warn' : 'ok'}
          onClick={() => onView?.('services')}
        />
        {avgOcc != null && (
          <GaugeTile
            label={sl('Avg occupancy', 'Occupation moy.')}
            pct={avgOcc}
            target={70}
            higherIsBetter={false}
            warnBand={15}
            onClick={() => {
              if (onView) onView('hypervisor');
            }}
          />
        )}
      </div>

      {/* ── Service lines — the disciplines run on this workspace, each its own
          clearly-identified section (discipline colour + icon badge) read against
          its 95% adherence target. The cockpit's operational hero, full-width. ── */}
      <Card>
        <style>{`.kpi-line{transition:border-color .15s,box-shadow .15s,transform .15s}.kpi-line:hover{border-color:var(--border-strong);box-shadow:0 4px 14px rgba(15,23,42,0.06);transform:translateY(-1px)}`}</style>
        <PanelHead
          icon="sparkle"
          title={sl('Service lines', 'Métiers de service')}
          action={sl('Open Services →', 'Ouvrir Services →')}
          onAction={() => onView?.('services')}
        />
        {!rollupLoaded && <Muted>{sl('Loading…', 'Chargement…')}</Muted>}
        {rollupLoaded && lines.length === 0 && (
          <Muted>{sl('No service lines on this workspace.', 'Aucun métier sur cet espace.')}</Muted>
        )}
        {lines.length > 0 && <MarkerLegend sl={sl} note="95%" />}
        {lines.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(236px, 1fr))', gap: 12 }}>
            {lines.map((l) => (
              <ServiceLineTile key={l.key} line={l} sl={sl} onView={onView} />
            ))}
          </div>
        )}
      </Card>

      {/* ── Incidents + role economics/SLA + sensing — a balanced band: the
          incident summary on the left, the role's money + live-sensing panels
          stacked on the right so the row fills evenly (no orphaned column). ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {/* Incident summary (severity donut + open/closed) */}
        <Card>
          <PanelHead
            icon="warn"
            title={sl('Incident summary', 'Synthèse incidents')}
            action={sl('Open Activity →', 'Ouvrir Activité →')}
            onAction={() => onView?.('activity')}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 6, flexWrap: 'wrap' }}>
            <SeverityDonut counts={incidents.counts} total={incidents.total} sl={sl} />
            <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {SEV.map((b) => (
                <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: b.color }} />
                  <span style={{ flex: 1, textTransform: 'capitalize' }}>{sevLabel(b.key, sl)}</span>
                  <span style={{ fontWeight: 700 }}>{incidents.counts[b.key]}</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Pill tone={incidents.open > 0 ? 'risk' : 'ok'}>
                  {sl(`${incidents.open} open`, `${incidents.open} ouverts`)}
                </Pill>
                <Pill tone="neutral">{sl(`${incidents.closed} closed`, `${incidents.closed} clos`)}</Pill>
              </div>
            </div>
          </div>
        </Card>

        {/* Right column — role economics/SLA stacked over role sensing/assets,
            so two compact panels balance the incident donut on the left. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Role panel A — FM: SLA breakdown | Contractor: Economics */}
          {isContractor ? (
            <Card>
              <PanelHead
                icon="bolt"
                title={sl('Your economics', 'Votre économie')}
                action={sl('Open Savings →', 'Ouvrir Économies →')}
                onAction={() => onView?.('predict-contractor-savings')}
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 12,
                  marginTop: 6,
                }}
              >
                <MiniStat
                  label={sl('Monthly run-rate', 'Revenu mensuel')}
                  value={econ?.runRate != null ? fmtCurrency(econ.runRate, econ.currency) : '—'}
                />
                <MiniStat label={sl('Active contracts', 'Contrats actifs')} value={econ?.activeContracts ?? '—'} />
                <MiniStat
                  label={sl('Penalties avoided · 3 mo', 'Pénalités évitées · 3 mois')}
                  value={econ?.avoided3 ? fmtCurrency(econ.avoided3, econ.currency) : '—'}
                  tone="ok"
                />
              </div>
            </Card>
          ) : (
            <Card>
              <PanelHead
                icon="shield"
                title={sl('SLA compliance', 'Conformité SLA')}
                action={sl('Open Forecast →', 'Ouvrir Prévisions →')}
                onAction={() => onView?.('predict-forecast')}
              />
              {slaRows.length === 0 && <Muted>{sl('No measured SLAs yet.', 'Aucun SLA mesuré pour l’instant.')}</Muted>}
              {slaRows.length > 0 && <MarkerLegend sl={sl} />}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {slaRows.map((s) => {
                  const tone = toneVs(s.current, s.target);
                  const { fillFrac, targetFrac } = pctFracs(s.current, s.target);
                  return (
                    <div key={s.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                        <span
                          style={{
                            fontSize: 12,
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {s.name}
                        </span>
                        {s.trend && s.trend.length > 1 && (
                          <Sparkline data={s.trend} w={56} h={18} stroke={toneColor(tone)} />
                        )}
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 800,
                            color: toneColor(tone),
                            minWidth: 64,
                            textAlign: 'right',
                          }}
                        >
                          {Math.round(s.current)}%{' '}
                          <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>/ {s.target}%</span>
                        </span>
                      </div>
                      <Bullet fillFrac={fillFrac} targetFrac={targetFrac} tone={tone} />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Role panel B — FM: Assets & smart building | Contractor: Penalty exposure note */}
          {isContractor ? (
            <Card>
              <PanelHead
                icon="beacon"
                title={sl('Sensing snapshot', 'Captation en direct')}
                action={sl('Open Hypervisor →', 'Ouvrir Hyperviseur →')}
                onAction={() => onView?.('hypervisor')}
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 12,
                  marginTop: 6,
                }}
              >
                <MiniStat label={sl('Avg occupancy', 'Occupation moy.')} value={avgOcc != null ? `${avgOcc}%` : '—'} />
                <MiniStat
                  label={sl('Avg air quality', 'Qualité air moy.')}
                  value={avgAq != null ? `${avgAq} ppb` : '—'}
                  tone={avgAq != null && avgAq > 600 ? 'warn' : 'ok'}
                />
              </div>
            </Card>
          ) : (
            <Card>
              <PanelHead
                icon="grid"
                title={sl('Assets & smart building', 'Actifs & bâtiment connecté')}
                action={sl('Open Devices →', 'Ouvrir Appareils →')}
                onAction={() => onView?.('devices')}
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 12,
                  marginTop: 6,
                }}
              >
                <MiniStat
                  label={sl('Devices online', 'Appareils en ligne')}
                  value={deviceAvail != null ? `${deviceAvail}%` : '—'}
                  tone={toneVs(deviceAvail, 99)}
                />
                <MiniStat label={sl('Devices', 'Appareils')} value={deviceCounts?.total ?? '—'} />
                <MiniStat label={sl('Avg occupancy', 'Occupation moy.')} value={avgOcc != null ? `${avgOcc}%` : '—'} />
                <MiniStat
                  label={sl('Avg air quality', 'Qualité air moy.')}
                  value={avgAq != null ? `${avgAq} ppb` : '—'}
                  tone={avgAq != null && avgAq > 600 ? 'warn' : 'ok'}
                />
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Reliability — unified per-equipment MTTR + MTBF (both roles; contractor
          sees their slice). Full-width centerpiece: each asset gets two bullet
          bars (repair speed + uptime) read against its own target. */}
      {reliability.length > 0 && <ReliabilityPanel rows={reliability} sl={sl} onView={onView} />}

      {/* Finance (CAPEX/OPEX, FM only) + HSE + Customer Experience — a balanced
          families row; each org renders only the families it has data for. */}
      {(capex.length > 0 || opex.length > 0 || hse.length > 0 || cx.length > 0) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 14,
            alignItems: 'start',
          }}
        >
          {!isContractor && capex.length > 0 && (
            <CapexPanel rows={capex} currency={budgetCcy} fmtCurrency={fmtCurrency} sl={sl} />
          )}
          {!isContractor && opex.length > 0 && (
            <OpexPanel rows={opex} currency={budgetCcy} fmtCurrency={fmtCurrency} sl={sl} />
          )}
          {hse.length > 0 && (
            <KpiListPanel
              icon="shield"
              rows={hse}
              sl={sl}
              title={
                isContractor
                  ? sl('Crew health & safety', 'Santé & sécurité équipe')
                  : sl('Health & safety', 'Santé & sécurité')
              }
            />
          )}
          {cx.length > 0 && (
            <KpiListPanel
              icon="badge"
              rows={cx}
              sl={sl}
              title={
                isContractor
                  ? sl('Client experience', 'Expérience client')
                  : sl('Occupant experience', 'Expérience occupants')
              }
            />
          )}
        </div>
      )}

      {onOpenChat && (
        <button
          onClick={() =>
            onOpenChat(
              sl(
                'Give me a plain-language readout of my KPI cockpit — what is on target, what is at risk, and what I should do first.',
                'Donne-moi une lecture simple de mon cockpit KPI — ce qui est dans la cible, ce qui est à risque, et quoi faire en priorité.',
              ),
              { send: true },
            )
          }
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: 12.5,
            fontWeight: 600,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '1px solid var(--accent-line)',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <Icon.sparkle size={13} /> {sl('Ask Merlin to read the cockpit', 'Demander à Merlin de lire le cockpit')}
        </button>
      )}
    </main>
  );
}

// ── helpers ──
function avgOfMap(m) {
  if (!m || m.size === 0) return null;
  let sum = 0;
  let n = 0;
  for (const v of m.values()) {
    if (v?.value != null && !Number.isNaN(v.value)) {
      sum += v.value;
      n += 1;
    }
  }
  return n ? Math.round(sum / n) : null;
}
function sevLabel(key, sl) {
  return (
    {
      critical: sl('Critical', 'Critique'),
      major: sl('Major', 'Majeur'),
      minor: sl('Minor', 'Mineur'),
      low: sl('Low', 'Faible'),
    }[key] || key
  );
}

function GaugeTile({ label, pct, target, higherIsBetter = true, warnBand = 5, onClick }) {
  const tone = pct == null ? 'neutral' : toneVs(pct, target, { higherIsBetter, warnBand });
  // gap to target, signed so positive is always good
  const gap = pct == null ? null : Math.round(higherIsBetter ? pct - target : target - pct);
  return (
    <Card
      interactive={!!onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', textAlign: 'center' }}
      {...(onClick ? { onClick } : {})}
    >
      <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: 0.2,
          }}
        >
          {label}
        </div>
        <Ring
          pct={pct ?? 0}
          size={78}
          thick={8}
          tone={tone === 'neutral' ? 'accent' : tone}
          label={pct == null ? '—' : `${Math.round(pct)}%`}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
            {higherIsBetter ? '≥' : '≤'} {target}%
          </div>
          {gap != null && (
            <div style={{ fontSize: 11, fontWeight: 800, color: toneColor(tone) }}>
              {gap >= 0 ? '+' : ''}
              {gap} pts
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function StatTile({ label, value, sub, tone = 'neutral', onClick }) {
  return (
    <Card interactive={!!onClick} style={{ cursor: onClick ? 'pointer' : 'default' }} {...(onClick ? { onClick } : {})}>
      <div
        onClick={onClick}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 0' }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: 0.2,
            textAlign: 'center',
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: toneColor(tone) }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{sub}</div>}
      </div>
    </Card>
  );
}

function MiniStat({ label, value, tone = 'neutral' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.2,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 800, color: tone === 'neutral' ? 'var(--text)' : toneColor(tone) }}>
        {value}
      </span>
    </div>
  );
}

function PanelHead({ icon, title, action, onAction }) {
  const I = Icon[icon] || Icon.sparkle;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <I size={15} style={{ color: 'var(--accent)' }} />
      <div style={{ fontSize: 13.5, fontWeight: 800, flex: 1 }}>{title}</div>
      {action && onAction && (
        <button
          onClick={onAction}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--accent)',
            cursor: 'pointer',
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

function Muted({ children }) {
  return <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', marginTop: 6 }}>{children}</div>;
}

// ── Phase 2 panels: reliability (MTTR/MTBF) + finance (CAPEX/OPEX) ──
function fmtDuration(min) {
  const m = Number(min) || 0;
  if (m < 60) return `${Math.round(m)}min`;
  return `${Math.round((m / 60) * 10) / 10}h`;
}

// ── Equipment reliability (unified MTTR + MTBF centerpiece) ──────────
// Per-asset verdict against its OWN target. `betterLow` flips the good
// direction (MTTR: faster = better; MTBF: longer = better).
const EQUIP_ICON = [
  [/chiller|hvac|air handl|ahu|condens/i, 'hvac'],
  [/generator|genset/i, 'bolt'],
  [/ups|battery|power/i, 'battery'],
  [/fire alarm|alarm|smoke|detector/i, 'bell'],
  [/pump|plumb|water|sprinkler/i, 'droplet'],
  [/light/i, 'light'],
  [/bms|server|controller|gateway|network/i, 'gateway'],
  [/elevator|escalator|lift/i, 'building'],
];
function equipIcon(name) {
  const hit = EQUIP_ICON.find(([re]) => re.test(name || ''));
  return Icon[hit?.[1]] || Icon.cog;
}
function reliabilityTone(actual, target, betterLow) {
  const ratio = target > 0 ? actual / target : 1;
  if (betterLow) return ratio <= 1 ? 'ok' : ratio <= 1.1 ? 'warn' : 'risk';
  return ratio >= 1 ? 'ok' : ratio >= 0.9 ? 'warn' : 'risk';
}
const worstTone = (a, b) => (a === 'risk' || b === 'risk' ? 'risk' : a === 'warn' || b === 'warn' ? 'warn' : 'ok');
// Signed improvement vs target where positive is ALWAYS good.
const goodDelta = (actual, target, betterLow) =>
  target > 0 ? Math.round(((betterLow ? target - actual : actual - target) / target) * 100) : 0;

function ReliabilityPanel({ rows, sl, onView, style }) {
  const enriched = useMemo(
    () =>
      rows
        .map((r) => {
          const mttrA = Number(r.mttr_actual_min) || 0,
            mttrT = Number(r.mttr_target_min) || 0;
          const mtbfA = Number(r.mtbf_actual_days) || 0,
            mtbfT = Number(r.mtbf_target_days) || 0;
          const mttrTone = reliabilityTone(mttrA, mttrT, true);
          const mtbfTone = reliabilityTone(mtbfA, mtbfT, false);
          return {
            ...r,
            mttrA,
            mttrT,
            mtbfA,
            mtbfT,
            mttrTone,
            mtbfTone,
            tone: worstTone(mttrTone, mtbfTone),
            mttrDelta: goodDelta(mttrA, mttrT, true),
            mtbfDelta: goodDelta(mtbfA, mtbfT, false),
          };
        })
        .sort((a, b) => ({ risk: 0, warn: 1, ok: 2 })[a.tone] - { risk: 0, warn: 1, ok: 2 }[b.tone]),
    [rows],
  );

  const summary = useMemo(() => {
    const healthy = enriched.filter((r) => r.tone === 'ok').length;
    const watch = enriched.filter((r) => r.tone === 'warn').length;
    const breach = enriched.filter((r) => r.tone === 'risk').length;
    const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : 0);
    return {
      healthy,
      watch,
      breach,
      avgMttr: avg(enriched.map((r) => r.mttrDelta)),
      avgMtbf: avg(enriched.map((r) => r.mtbfDelta)),
    };
  }, [enriched]);

  const signed = (n) => `${n >= 0 ? '+' : ''}${n}%`;
  return (
    <Card style={style}>
      <style>{`.kpi-equip{transition:border-color .15s,box-shadow .15s,transform .15s}.kpi-equip:hover{border-color:var(--border-strong);box-shadow:0 4px 14px rgba(15,23,42,0.06);transform:translateY(-1px)}`}</style>
      <PanelHead
        icon="cog"
        title={sl('Equipment reliability', 'Fiabilité des équipements')}
        action={sl('Open Hypervisor →', 'Ouvrir Hyperviseur →')}
        onAction={() => onView?.('hypervisor')}
      />

      {/* Summary strip: health mix + avg performance vs target + legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '4px 0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--text-dim)' }}>
          {[
            ['ok', summary.healthy, sl('healthy', 'sains')],
            ['warn', summary.watch, sl('watch', 'à surveiller')],
            ['risk', summary.breach, sl('breach', 'manqués')],
          ]
            .filter(([, n]) => n > 0)
            .map(([t, n, lbl]) => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Dot tone={t} size={8} />
                <b style={{ color: 'var(--text)', fontSize: 12.5 }}>{n}</b> {lbl}
              </span>
            ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <Pill tone={summary.avgMttr >= 0 ? 'ok' : 'risk'}>
            {sl('Repair', 'Réparation')} {signed(summary.avgMttr)} {sl('vs target', 'vs cible')}
          </Pill>
          <Pill tone={summary.avgMtbf >= 0 ? 'ok' : 'risk'}>
            {sl('Uptime', 'Disponibilité')} {signed(summary.avgMtbf)} {sl('vs target', 'vs cible')}
          </Pill>
        </div>
      </div>

      {/* Asset tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {enriched.map((r) => {
          const EIcon = equipIcon(r.equipment);
          return (
            <div
              key={r.equipment}
              className="kpi-equip"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm, 8px)',
                background: 'var(--surface-2)',
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--surface-3)',
                    flexShrink: 0,
                  }}
                >
                  <EIcon size={14} style={{ color: 'var(--text-soft)' }} />
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.equipment}
                </span>
                <Dot tone={r.tone} size={9} />
              </div>
              <MetricBullet
                label={sl('Repair · MTTR', 'Réparation · MTTR')}
                actual={r.mttrA}
                target={r.mttrT}
                betterLow
                tone={r.mttrTone}
                delta={r.mttrDelta}
                fmt={fmtDuration}
                sl={sl}
              />
              <div style={{ height: 9 }} />
              <MetricBullet
                label={sl('Uptime · MTBF', 'Disponibilité · MTBF')}
                actual={r.mtbfA}
                target={r.mtbfT}
                betterLow={false}
                tone={r.mtbfTone}
                delta={r.mtbfDelta}
                fmt={(d) => `${Math.round(d)}${sl('d', 'j')}`}
                sl={sl}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Shared bullet bar — the cockpit's house style for "actual vs target",
// used by reliability (MTTR/MTBF), service-line adherence and SLA
// compliance so they all read identically. Fill = actual; a notch marks
// target; a faint tint shades the GOOD side of target (left for
// lower-is-better, right otherwise). Optional caption sits under the notch.
function Bullet({ fillFrac, targetFrac = 0.6, tone, betterLow = false, caption = null }) {
  const color = toneColor(tone);
  const ff = Math.max(0.02, Math.min(1, fillFrac));
  const tf = Math.max(0, Math.min(1, targetFrac));
  const goodLeft = betterLow ? 0 : tf;
  const goodWidth = betterLow ? tf : 1 - tf;
  return (
    <div>
      <div
        style={{
          position: 'relative',
          height: 8,
          borderRadius: 999,
          background: 'var(--surface-3)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${goodLeft * 100}%`,
            width: `${goodWidth * 100}%`,
            background: 'color-mix(in oklch, var(--ok) 14%, transparent)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: `${ff * 100}%`,
            background: color,
            borderRadius: 999,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -1,
            bottom: -1,
            left: `${tf * 100}%`,
            width: 2,
            background: 'var(--text-dim)',
            transform: 'translateX(-50%)',
          }}
        />
      </div>
      {caption && (
        <div style={{ position: 'relative', height: 11, marginTop: 2 }}>
          <span
            style={{
              position: 'absolute',
              left: `${tf * 100}%`,
              transform: `translateX(${tf > 0.85 ? '-100%' : tf < 0.15 ? '0' : '-50%'})`,
              fontSize: 9.5,
              color: 'var(--text-faint)',
              whiteSpace: 'nowrap',
            }}
          >
            {caption}
          </span>
        </div>
      )}
    </div>
  );
}

// Percent → bullet fractions on a target-relative window [target−30, 100]
// so compliance values (which cluster near the top) read with usable spread.
function pctFracs(actual, target) {
  const lo = Math.max(0, target - 30);
  const hi = 100;
  const span = Math.max(1, hi - lo);
  return { fillFrac: (actual - lo) / span, targetFrac: (target - lo) / span };
}

// One service line as an identifiable section tile: discipline colour accent +
// icon badge, name, status pill, big adherence value and a target-relative
// bullet. The whole tile deep-links into Services. Used in the Service lines panel.
function ServiceLineTile({ line, sl, onView }) {
  const lp = LINE_LABEL[line.key] || ['Services', 'Services'];
  const LineIcon = Icon[LINE_ICON[line.key]] || Icon.sparkle;
  const col = lineColor(line.key);
  const tone = toneVs(line.adh, 95);
  const { fillFrac, targetFrac } = pctFracs(line.adh, 95);
  const pill =
    tone === 'ok'
      ? sl('On target', 'Cible OK')
      : tone === 'warn'
        ? sl('Watch', 'À surveiller')
        : sl('Breach', 'Manqué');
  return (
    <button
      type="button"
      className="kpi-line"
      onClick={() => onView?.('services')}
      style={{
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${col}`,
        borderRadius: 'var(--radius-sm, 8px)',
        background: 'var(--surface-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `color-mix(in oklch, ${col} 16%, transparent)`,
            flexShrink: 0,
          }}
        >
          <LineIcon size={15} style={{ color: col }} />
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {sl(lp[0], lp[1])}
        </span>
        <Pill tone={tone}>{pill}</Pill>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: toneColor(tone) }}>
          {Math.round(line.adh)}%
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>
          {line.overdue > 0 ? `${line.overdue} ${sl('overdue', 'en retard')}` : sl('none overdue', 'rien en retard')}
        </span>
      </div>
      <Bullet fillFrac={fillFrac} targetFrac={targetFrac} tone={tone} />
    </button>
  );
}

// One-line "│ marks target" key for the percent-bullet panels.
function MarkerLegend({ sl, note }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10.5,
        color: 'var(--text-faint)',
        marginBottom: 6,
      }}
    >
      <span style={{ display: 'inline-block', width: 2, height: 11, borderRadius: 1, background: 'var(--text-dim)' }} />
      {sl('marks target', 'repère la cible')}
      {note ? ` · ${note}` : ''}
    </div>
  );
}

// One metric (MTTR or MTBF) as a labelled bullet: header (label · signed
// delta · value) over a target-relative bar carrying the asset's own target.
function MetricBullet({ label, actual, target, betterLow, tone, delta, fmt, sl }) {
  const TM = 0.6;
  const ratio = target > 0 ? actual / target : 0;
  const color = toneColor(tone);
  const signed = `${delta >= 0 ? '+' : ''}${delta}%`;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: 0.2,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color }}>{signed}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color, minWidth: 38, textAlign: 'right' }}>{fmt(actual)}</span>
      </div>
      <Bullet
        fillFrac={ratio * TM}
        targetFrac={TM}
        tone={tone}
        betterLow={betterLow}
        caption={`${sl('tgt', 'cible')} ${fmt(target)}`}
      />
    </div>
  );
}

function CapexPanel({ rows, currency, fmtCurrency, sl }) {
  const fmtM = (n) => fmtCurrency(n, currency, { notation: 'compact', maximumFractionDigits: 1 });
  const totBudget = rows.reduce((s, r) => s + (Number(r.budget) || 0), 0);
  const totActual = rows.reduce((s, r) => s + (Number(r.actual) || 0), 0);
  const totPct = Math.round((totActual / Math.max(1, totBudget)) * 100);
  return (
    <Card>
      <PanelHead icon="bolt" title={sl('CAPEX · FY2026', 'CAPEX · EX2026')} />
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
        {sl(
          `${fmtM(totActual)} of ${fmtM(totBudget)} · ${totPct}% spent`,
          `${fmtM(totActual)} sur ${fmtM(totBudget)} · ${totPct}% engagé`,
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((r) => {
          const budget = Number(r.budget) || 0;
          const actual = Number(r.actual) || 0;
          const pct = Math.round((actual / Math.max(1, budget)) * 100);
          const over = actual > budget;
          return (
            <div
              key={r.category}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  fontSize: 11.5,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.category}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', minWidth: 48, textAlign: 'right' }}>
                {fmtM(budget)}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: over ? 'var(--risk)' : 'var(--text)',
                  minWidth: 48,
                  textAlign: 'right',
                }}
              >
                {fmtM(actual)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: over ? 'var(--risk)' : 'var(--text-dim)',
                  minWidth: 40,
                  textAlign: 'right',
                }}
              >
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function OpexPanel({ rows, currency, fmtCurrency, sl }) {
  const fmtM = (n) => fmtCurrency(n, currency, { notation: 'compact', maximumFractionDigits: 1 });
  const total = rows.reduce((s, r) => s + (Number(r.actual) || 0), 0);
  return (
    <Card>
      <PanelHead icon="bolt" title={sl('OPEX · FY2026', 'OPEX · EX2026')} />
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
        {sl(`${fmtM(total)} / year`, `${fmtM(total)} / an`)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((r) => {
          const annual = Number(r.actual) || 0;
          const share = Math.round((annual / Math.max(1, total)) * 100);
          return (
            <div
              key={r.category}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  fontSize: 11.5,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.category}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', minWidth: 60, textAlign: 'right' }}>
                {fmtM(annual / 12)}
                {sl('/mo', '/mois')}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 48, textAlign: 'right' }}>{fmtM(annual)}</span>
              <div
                style={{
                  width: 40,
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--surface-3)',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <div style={{ width: `${share}%`, height: '100%', background: 'var(--accent)' }} />
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--text-dim)', minWidth: 28, textAlign: 'right' }}>
                {share}%
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// org_kpis.metric is stored in English for every tenant; translate the known
// set for FR tenants (titles already localize via sl()). Unmapped names fall
// back to the raw English string.
const METRIC_FR = {
  // HSE
  'Lost-Time Injury': 'Accidents avec arrêt',
  'Safety Compliance': 'Conformité sécurité',
  'PPE Compliance': 'Conformité EPI',
  'Toolbox Talks': 'Causeries sécurité',
  'Near-Miss Reporting': 'Signalement des presqu’accidents',
  'HSE Audit Score': 'Score d’audit HSE',
  'Fire Drill Compliance': 'Conformité exercices incendie',
  'Emergency Evacuation': 'Évacuation d’urgence',
  // CX
  'Client Satisfaction': 'Satisfaction client',
  'Occupant Satisfaction': 'Satisfaction des occupants',
  'Complaint Resolution': 'Résolution des réclamations',
  'Service Quality Index': 'Indice de qualité de service',
  'Inspection Pass Rate': 'Taux de réussite des inspections',
  'Response SLA': 'SLA de réponse',
  'Tenant Retention': 'Rétention des locataires',
  'Visitor Satisfaction': 'Satisfaction des visiteurs',
};

// Generic metric list (HSE / CX): metric · status dot · value, verdict vs target.
function KpiListPanel({ title, icon, rows, sl }) {
  return (
    <Card>
      <PanelHead icon={icon} title={title} />
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 2 }}>
        {rows.map((r) => {
          const val = Number(r.value);
          const tone = toneVs(val, Number(r.target), {
            higherIsBetter: r.higher_is_better,
            warnBand: r.unit === 'min' ? 2 : 5,
          });
          const disp = r.unit === '%' ? `${Math.round(val)}%` : `${val}${r.unit ? ` ${r.unit}` : ''}`;
          const label = sl ? sl(r.metric, METRIC_FR[r.metric] || r.metric) : r.metric;
          return (
            <div
              key={r.metric}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
              <Dot tone={tone} />
              <span
                style={{ fontSize: 12.5, fontWeight: 800, color: toneColor(tone), minWidth: 54, textAlign: 'right' }}
              >
                {disp}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Multi-segment severity donut (SVG stroke-dasharray ring).
function SeverityDonut({ counts, total, sl }) {
  const size = 108;
  const sw = 16;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segs = SEV.map((b) => {
    const v = counts[b.key] || 0;
    const frac = total > 0 ? v / total : 0;
    const seg = { color: b.color, dash: frac * c, off: offset };
    offset += frac * c;
    return seg;
  }).filter((s) => s.dash > 0);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={sw} />
      {segs.map((s, i) => (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={sw}
          strokeDasharray={`${s.dash} ${c - s.dash}`}
          strokeDashoffset={-s.off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
      <text x="50%" y="46%" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--text)">
        {total}
      </text>
      <text x="50%" y="62%" textAnchor="middle" fontSize="10" fill="var(--text-dim)">
        {sl('total', 'total')}
      </text>
    </svg>
  );
}
