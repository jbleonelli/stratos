// ManagerSuggestionsInbox — Feature #2 (FM side): the client/FM reviewing the
// improvement & wellbeing suggestions its contractors have sent up, and
// adopting or declining them for real (set_suggestion_decision, mig 230). The
// contractor sees the decision land on their Suggestions page (the feedback
// loop). real_estate-org surface under OPERATE → Contractors.

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useSession } from './auth.js';
import { useSL } from './servicing-i18n.js';
import { useManagerSuggestions, setSuggestionDecision } from './contractor-programs-data.js';

const CAT = {
  wellbeing: { icon: 'sparkle', label: ['Wellbeing', 'Bien-être'], tone: 'ok' },
  service: { icon: 'cog', label: ['Service', 'Service'], tone: 'accent' },
  cost: { icon: 'bolt', label: ['Cost', 'Coût'], tone: 'warn' },
  safety: { icon: 'shield', label: ['Safety', 'Sécurité'], tone: 'risk' },
  energy: { icon: 'beacon', label: ['Energy', 'Énergie'], tone: 'ok' },
};

function CategoryChip({ category, sl }) {
  const meta = CAT[category] || CAT.service;
  const I = Icon[meta.icon] || Icon.sparkle;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 700,
        color: `var(--${meta.tone})`,
      }}
    >
      <I size={12} /> {sl(meta.label[0], meta.label[1])}
    </span>
  );
}

export function ManagerSuggestionsInbox() {
  const sl = useSL();
  const session = useSession();
  const { suggestions, loaded, refresh } = useManagerSuggestions(session?.organizationId);
  const [busyId, setBusyId] = useState(null);

  const pending = useMemo(() => suggestions.filter((s) => s.status === 'sent'), [suggestions]);
  const decided = useMemo(
    () => suggestions.filter((s) => s.status === 'adopted' || s.status === 'declined'),
    [suggestions],
  );
  const adoptedN = decided.filter((s) => s.status === 'adopted').length;

  const decide = async (id, status) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await setSuggestionDecision(id, status);
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
            {sl('Contractor suggestions', 'Suggestions des prestataires')}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 720, lineHeight: 1.5 }}>
            {sl(
              'Improvement & wellbeing ideas your contractors have proposed. Adopt the ones you want — they’ll see your decision.',
              'Idées d’amélioration et de bien-être proposées par vos prestataires. Adoptez celles que vous souhaitez — ils verront votre décision.',
            )}
          </p>
        </div>
        {decided.length > 0 && (
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
              {sl('Adopted', 'Adoptées')}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ok)', marginTop: 2 }}>
              {adoptedN}
              <span style={{ fontSize: 15, color: 'var(--text-faint)' }}>/{decided.length}</span>
            </div>
          </div>
        )}
      </div>

      {!loaded && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
          {sl('Loading…', 'Chargement…')}
        </div>
      )}
      {loaded && suggestions.length === 0 && (
        <Card>
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {sl('No suggestions from your contractors yet.', 'Aucune suggestion de vos prestataires pour l’instant.')}
          </div>
        </Card>
      )}

      {/* Awaiting your decision */}
      {pending.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel
            icon="bell"
            text={sl(`Awaiting your decision · ${pending.length}`, `En attente de décision · ${pending.length}`)}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {pending.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <CategoryChip category={s.category} sl={sl} />
                  {s.impact && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ok)' }}>{s.impact}</span>}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{s.title}</div>
                {s.body && <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.body}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {sl('From', 'De')} {s.contractor}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <button
                    onClick={() => decide(s.id, 'adopted')}
                    disabled={busyId === s.id}
                    style={{ ...adoptBtn, opacity: busyId === s.id ? 0.6 : 1 }}
                  >
                    <Icon.check size={12} /> {sl('Adopt', 'Adopter')}
                  </button>
                  <button onClick={() => decide(s.id, 'declined')} disabled={busyId === s.id} style={declineBtn}>
                    {sl('Decline', 'Décliner')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Decided */}
      {decided.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel icon="paper" text={sl('Decided', 'Décidées')} />
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {decided.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '9px 0',
                    borderBottom: '1px solid var(--border)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ minWidth: 96 }}>
                    <CategoryChip category={s.category} sl={sl} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 160 }}>{s.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.contractor}</span>
                  <Pill tone={s.status === 'adopted' ? 'ok' : 'risk'}>
                    {s.status === 'adopted' ? sl('Adopted', 'Adoptée') : sl('Declined', 'Déclinée')}
                  </Pill>
                </div>
              ))}
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

const adoptBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
};
const declineBtn = {
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  background: 'none',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  cursor: 'pointer',
};
