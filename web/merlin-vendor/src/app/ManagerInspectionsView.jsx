// ManagerInspectionsView — Feature #2 (FM side): the client's view of the
// quality-control inspections it runs on its contractors — upcoming schedule +
// scored results across every contractor and service line. Read-only (the
// replay loop completes/schedules them; the contractor sees the same rows on
// their Quality page). real_estate-org surface under OPERATE → Contractors.

import React, { useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useSession } from './auth.js';
import { useSL } from './servicing-i18n.js';
import { useManagerInspections } from './contractor-programs-data.js';

const LINE_LABEL = {
  cleaning: ['Cleaning', 'Nettoyage'],
  security: ['Security', 'Sécurité'],
  maintenance: ['Maintenance', 'Maintenance'],
  hospitality: ['Hospitality', 'Hôtellerie'],
};
const RESULT_TONE = { pass: 'ok', conditional: 'warn', fail: 'risk' };
const RESULT_LABEL = {
  pass: ['Pass', 'Conforme'],
  conditional: ['Conditional', 'Sous conditions'],
  fail: ['Fail', 'Non conforme'],
};
function scoreTone(s) {
  return s == null ? 'neutral' : s >= 90 ? 'ok' : s >= 78 ? 'warn' : 'risk';
}
function daysUntil(d) {
  return Math.round((new Date(d).getTime() - Date.now()) / 86_400_000);
}

export function ManagerInspectionsView() {
  const sl = useSL();
  const session = useSession();
  const { inspections, loaded } = useManagerInspections(session?.organizationId);

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
  const passRate = useMemo(() => {
    if (!completed.length) return null;
    return Math.round((completed.filter((i) => i.result === 'pass').length / completed.length) * 100);
  }, [completed]);

  const lineLabel = (k) => {
    const lp = LINE_LABEL[k] || ['Services', 'Services'];
    return sl(lp[0], lp[1]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{sl('Quality inspections', 'Contrôles qualité')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 720, lineHeight: 1.5 }}>
            {sl(
              'The QC inspections you run on your contractors — what’s scheduled and how they’ve scored.',
              'Les contrôles qualité que vous menez sur vos prestataires — ce qui est programmé et leurs résultats.',
            )}
          </p>
        </div>
        {passRate != null && (
          <div
            style={{
              minWidth: 150,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              {sl('Pass rate', 'Taux de réussite')}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: `var(--${scoreTone(passRate)})`, marginTop: 2 }}>
              {passRate}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {completed.length} {sl('inspections', 'contrôles')}
            </div>
          </div>
        )}
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

      {upcoming.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel icon="bell" text={sl('Scheduled', 'Programmés')} />
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {upcoming.map((i) => {
                const days = daysUntil(i.scheduled_for);
                return (
                  <div
                    key={i.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '9px 0',
                      borderBottom: '1px solid var(--border)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 150 }}>{i.contractor}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 96 }}>
                      {lineLabel(i.service_kind)}
                    </span>
                    <Pill tone={days <= 3 ? 'warn' : 'neutral'}>
                      {days <= 0 ? sl('due', 'à échéance') : sl(`in ${days}d`, `dans ${days} j`)}
                    </Pill>
                    <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                      {new Date(i.scheduled_for).toLocaleDateString(sl('en-US', 'fr-FR'), {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      )}

      {completed.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel icon="paper" text={sl('Results', 'Résultats')} />
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {completed.map((i) => {
                const rt = RESULT_TONE[i.result] || 'neutral';
                const rl = RESULT_LABEL[i.result] || [i.result, i.result];
                const findings = Array.isArray(i.findings) ? i.findings : [];
                return (
                  <div
                    key={i.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '9px 0',
                      borderBottom: '1px solid var(--border)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 150 }}>{i.contractor}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 96 }}>
                      {lineLabel(i.service_kind)}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-dim)', minWidth: 70 }}>
                      {new Date(i.scheduled_for).toLocaleDateString(sl('en-US', 'fr-FR'), {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span
                      style={{ fontSize: 14, fontWeight: 800, color: `var(--${scoreTone(i.score)})`, minWidth: 48 }}
                    >
                      {i.score}%
                    </span>
                    <Pill tone={rt}>{sl(rl[0], rl[1])}</Pill>
                    {findings.length > 0 && (
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flex: 1, minWidth: 0 }}>
                        {findings.map((f) => f.area).join(' · ')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
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
