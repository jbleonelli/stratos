// ContractorQualityPage — Feature B: pass the client's quality controls.
//
// The FM runs periodic QC inspections of the contractor's work (inspections,
// mig 228, scored from the live servicing board). This page gives the
// contractor what they never had: their own quality score, the schedule of
// upcoming inspections, and — crucially — Merlin's "prep to pass" list (the
// weakest areas in that line right now, so they fix the right things first),
// plus the scored history. Contractor-scoped + RLS-guarded.

import React, { useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useSession } from './auth.js';
import { useSL } from './servicing-i18n.js';
import { useInspections } from './contractor-programs-data.js';
import { useServicingRollup, synthTrend } from './servicing-data.js';
import { AREA_BY_DOMAIN } from './servicing-areas.js';
import { inDays } from './sla-forecast.js';

const LINE_LABEL = {
  cleaning: ['Cleaning', 'Nettoyage'],
  security: ['Security', 'Sécurité'],
  maintenance: ['Maintenance', 'Maintenance'],
  hospitality: ['Hospitality', 'Hôtellerie'],
};
const LINE_ICON = { cleaning: 'cleaning', security: 'security', maintenance: 'cog', hospitality: 'hospitality' };
const RESULT_TONE = { pass: 'ok', conditional: 'warn', fail: 'risk' };
const RESULT_LABEL = {
  pass: ['Pass', 'Conforme'],
  conditional: ['Conditional', 'Sous conditions'],
  fail: ['Fail', 'Non conforme'],
};
// Only areas below the pass threshold are a real gap worth prepping.
const PREP_FLAG = 90;
// Safety / security-critical areas — surfaced first in prep, an FM inspector
// weighs these heaviest.
const CRITICAL_DOMAINS = new Set([
  'maintenance_firesafety',
  'maintenance_hvac',
  'maintenance_electrical',
  'security_incidents',
  'security_access',
  'cleaning_disinfection',
]);

function gradeFor(score) {
  if (score == null) return '—';
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 88) return 'B';
  if (score >= 80) return 'C';
  if (score >= 70) return 'D';
  return 'F';
}
function scoreTone(score) {
  if (score == null) return 'neutral';
  if (score >= 90) return 'ok';
  if (score >= 78) return 'warn';
  return 'risk';
}
function daysUntil(d) {
  return Math.round((new Date(d).getTime() - Date.now()) / 86_400_000);
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

export function ContractorQualityPage({ building, onOpenChat }) {
  const sl = useSL();
  const session = useSession();
  const orgId = session?.organizationId;
  const { inspections, loaded } = useInspections(orgId);
  const rollup = useServicingRollup(building, orgId, { viewer: true });

  const upcoming = useMemo(
    () =>
      inspections
        .filter((i) => i.status === 'scheduled')
        .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for)),
    [inspections],
  );
  const completed = useMemo(
    () =>
      inspections
        .filter((i) => i.status === 'completed')
        .sort((a, b) => new Date(b.scheduled_for) - new Date(a.scheduled_for)),
    [inspections],
  );
  const overall = useMemo(() => {
    const scored = completed.filter((i) => i.score != null);
    if (!scored.length) return null;
    return Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length);
  }, [completed]);

  // Merlin "prep to pass": only the sub-areas that are an ACTUAL gap (below the
  // pass threshold) — never list a 100% area under "fix these first". Safety /
  // security-critical areas sort first so they're addressed before cosmetics.
  const weakAreasFor = (line) =>
    (rollup.rows || [])
      .filter((r) => String(r.domain || '').split('_')[0] === line)
      .filter((r) => (r.adherence_pct ?? 100) < PREP_FLAG)
      .map((r) => ({ ...r, critical: CRITICAL_DOMAINS.has(r.domain) }))
      .sort((a, b) => Number(b.critical) - Number(a.critical) || (a.adherence_pct ?? 100) - (b.adherence_pct ?? 100))
      .slice(0, 4);

  // Predicted score if the inspection ran today (= the line's live adherence,
  // the same basis the FM scores from) + the lift from clearing the flagged
  // gaps, so prep reads as "you'll land at X, fix these to reach Y".
  const readinessFor = (line, weak) => {
    const adh = rollup.byTop?.[line]?.adh;
    if (adh == null) return null;
    const projected = Math.min(98, adh + Math.max(weak.length ? 3 : 0, weak.length * 2));
    return { today: Math.round(adh), projected: Math.round(projected), gaps: weak.length };
  };

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-dim)' }}>
            {sl('QUALITY CONTROL', 'CONTRÔLE QUALITÉ')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <Icon.quality size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              {sl('Pass every FM inspection', 'Réussir chaque contrôle FM')}
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 720, lineHeight: 1.5 }}>
            {sl(
              'Your client inspects your work on a cadence. Here’s your quality score, what’s coming up, and the exact areas Merlin says to fix first so you walk into each inspection clean.',
              'Votre client contrôle vos prestations régulièrement. Voici votre score qualité, ce qui arrive, et les zones que Merlin vous conseille de traiter en priorité pour aborder chaque contrôle sereinement.',
            )}
          </p>
        </div>
        {/* Headline quality score */}
        <div
          style={{
            minWidth: 180,
            padding: '14px 18px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.2,
            }}
          >
            {sl('Quality score', 'Score qualité')}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 34, fontWeight: 800, color: `var(--${scoreTone(overall)})` }}>
              {overall != null ? `${overall}` : '—'}
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: `var(--${scoreTone(overall)})` }}>
              {gradeFor(overall)}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
            {sl(
              `${completed.length} inspection${completed.length === 1 ? '' : 's'}`,
              `${completed.length} contrôle${completed.length === 1 ? '' : 's'}`,
            )}
          </div>
          {overall != null && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
              <ScoreSpark series={synthTrend(`quality:${orgId || ''}`, overall)} tone={scoreTone(overall)} />
            </div>
          )}
        </div>
      </div>

      {!loaded && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
          {sl('Loading…', 'Chargement…')}
        </div>
      )}
      {loaded && inspections.length === 0 && (
        <Card>
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {sl('No inspections scheduled yet.', 'Aucun contrôle programmé pour l’instant.')}
          </div>
        </Card>
      )}

      {/* Upcoming inspections + Merlin prep */}
      {upcoming.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel icon="bell" text={sl('Upcoming inspections', 'Contrôles à venir')} />
          {upcoming.map((insp) => {
            const lp = LINE_LABEL[insp.service_kind] || ['Services', 'Services'];
            const label = sl(lp[0], lp[1]);
            const LineIcon = Icon[LINE_ICON[insp.service_kind]] || Icon.sparkle;
            const days = daysUntil(insp.scheduled_for);
            const weak = weakAreasFor(insp.service_kind);
            const soon = days <= 3;
            const readiness = readinessFor(insp.service_kind, weak);
            const lastInsp = completed.find((c) => c.service_kind === insp.service_kind);
            const lastAgo = lastInsp ? -daysUntil(lastInsp.scheduled_for) : null;
            const predTone =
              readiness == null ? 'neutral' : readiness.today >= 90 ? 'ok' : readiness.today >= 78 ? 'warn' : 'risk';
            const predResult =
              readiness == null
                ? null
                : readiness.today >= 90
                  ? sl('Pass', 'Conforme')
                  : readiness.today >= 78
                    ? sl('Conditional', 'Sous cond.')
                    : sl('Fail', 'Échec');
            return (
              <Card key={insp.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <LineIcon size={16} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{label}</span>
                  <Pill tone={soon ? 'warn' : 'neutral'}>{inDays(days, sl)}</Pill>
                  {insp.inspection_type && (
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-dim)' }}>
                      {insp.inspection_type}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{insp.inspector}</span>
                  {lastAgo != null && lastAgo > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      · {sl(`last ${lastAgo}d ago`, `dernier il y a ${lastAgo} j`)}
                    </span>
                  )}
                </div>
                {/* Readiness: where you'd score today + the gap to close. */}
                {readiness && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-faint)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.2,
                      }}
                    >
                      {sl('Projected today', 'Projeté aujourd’hui')}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: `var(--${predTone})` }}>
                      {readiness.today}%
                    </span>
                    <Pill tone={predTone}>{predResult}</Pill>
                    {readiness.gaps > 0 && readiness.projected > readiness.today && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {sl(
                          `→ clear ${readiness.gaps} flagged area${readiness.gaps === 1 ? '' : 's'} → ~${readiness.projected}% Pass`,
                          `→ traiter ${readiness.gaps} zone${readiness.gaps === 1 ? '' : 's'} → ~${readiness.projected}% Conforme`,
                        )}
                      </span>
                    )}
                  </div>
                )}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--accent-line)',
                    background: 'var(--accent-soft)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Icon.sparkle size={13} style={{ color: 'var(--accent)' }} />
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: 'var(--accent)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.2,
                      }}
                    >
                      {sl('Merlin’s prep — fix these first', 'Préparation Merlin — à traiter d’abord')}
                    </span>
                  </div>
                  {weak.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 600 }}>
                      {sl(
                        'Inspection-ready — no areas below your pass line.',
                        'Prêt pour le contrôle — aucune zone sous votre seuil.',
                      )}
                    </div>
                  ) : (
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}
                    >
                      {weak.map((w) => {
                        const adh = Math.round(w.adherence_pct ?? 0);
                        const tone = adh >= 90 ? 'ok' : adh >= 80 ? 'warn' : 'risk';
                        return (
                          <div
                            key={w.domain}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                              padding: '7px 10px',
                              borderRadius: 8,
                              background: 'var(--surface)',
                              border: `1px solid ${w.critical ? 'color-mix(in oklch, var(--risk) 35%, var(--border))' : 'var(--border)'}`,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                overflow: 'hidden',
                              }}
                            >
                              {w.critical && (
                                <span
                                  title={sl('Safety-critical', 'Critique sécurité')}
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    color: 'var(--risk)',
                                    border: '1px solid var(--risk)',
                                    borderRadius: 4,
                                    padding: '0 3px',
                                    flexShrink: 0,
                                  }}
                                >
                                  {sl('CRIT', 'CRIT')}
                                </span>
                              )}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {AREA_BY_DOMAIN[w.domain]?.fallback || prettyDomain(w.domain)}
                              </span>
                            </span>
                            <span style={{ fontSize: 11, color: `var(--${tone})`, fontWeight: 700 }}>
                              {adh}%{w.overdue_now ? ` · ${w.overdue_now} ${sl('overdue', 'en retard')}` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {onOpenChat && (
                    <button
                      onClick={() =>
                        onOpenChat(
                          sl(
                            `I have a ${label.toLowerCase()} quality inspection in ${days} day${days === 1 ? '' : 's'}. Based on where my ${label.toLowerCase()} work is weakest right now, what should my crew fix first to pass — in priority order?`,
                            `J’ai un contrôle qualité ${label.toLowerCase()} dans ${days} j. D’après les points faibles actuels de mes prestations ${label.toLowerCase()}, que doit corriger mon équipe en priorité pour réussir ?`,
                          ),
                          { send: true },
                        )
                      }
                      style={prepBtn}
                    >
                      <Icon.sparkle size={12} /> {sl('Prep with Merlin', 'Préparer avec Merlin')}
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {/* Recent results */}
      {completed.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel icon="paper" text={sl('Recent results', 'Résultats récents')} />
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {completed.map((insp) => {
                const lp = LINE_LABEL[insp.service_kind] || ['Services', 'Services'];
                const label = sl(lp[0], lp[1]);
                const rt = RESULT_TONE[insp.result] || 'neutral';
                const rl = RESULT_LABEL[insp.result] || [insp.result, insp.result];
                const findings = Array.isArray(insp.findings) ? insp.findings : [];
                return (
                  <div
                    key={insp.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      padding: '9px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 96 }}>{label}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-dim)', minWidth: 92 }}>
                        {new Date(insp.scheduled_for).toLocaleDateString(sl('en-US', 'fr-FR'), {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {insp.inspection_type && (
                        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{insp.inspection_type}</span>
                      )}
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: 14,
                          fontWeight: 800,
                          color: `var(--${scoreTone(insp.score)})`,
                        }}
                      >
                        {insp.score}% <span style={{ fontSize: 11, fontWeight: 700 }}>{gradeFor(insp.score)}</span>
                      </span>
                      <Pill tone={rt}>{sl(rl[0], rl[1])}</Pill>
                    </div>
                    {(findings.length > 0 || insp.corrective_action) && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', paddingLeft: 2 }}>
                        {findings.length > 0 && (
                          <span>
                            {sl('Findings', 'Constats')}: {findings.map((f) => f.area).join(' · ')}
                          </span>
                        )}
                        {insp.corrective_action && (
                          <span style={{ color: 'var(--ok)' }}>
                            {findings.length > 0 ? ' · ' : ''}✓ {insp.corrective_action}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      )}
    </main>
  );
}

function ScoreSpark({ series, tone, width = 120, height = 22 }) {
  if (!series || series.length < 2) return null;
  const pad = 2;
  const lo = Math.min(...series) - 1,
    hi = Math.max(...series) + 1;
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
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r="2.2" fill={`var(--${tone})`} />
    </svg>
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

const prepBtn = {
  alignSelf: 'flex-start',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 11px',
  fontSize: 12,
  fontWeight: 600,
  background: 'var(--surface)',
  color: 'var(--accent)',
  border: '1px solid var(--accent-line)',
  borderRadius: 8,
  cursor: 'pointer',
};
