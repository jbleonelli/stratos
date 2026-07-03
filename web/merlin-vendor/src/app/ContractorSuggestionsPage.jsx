// ContractorSuggestionsPage — Feature C: send improvement & occupant-wellbeing
// suggestions UP to the client/FM. Merlin drafts ideas from what it observes
// (contractor_suggestions, mig 229); the contractor sends or dismisses them, and
// the adopted/declined feedback loop is visible. A lighter, idea-stage channel
// than formal contract proposals. Contractor-scoped + RLS-guarded.

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useSession } from './auth.js';
import { useSL } from './servicing-i18n.js';
import { useContractorSuggestions, setSuggestionStatus } from './contractor-programs-data.js';

const CAT = {
  wellbeing: { icon: 'sparkle', label: ['Wellbeing', 'Bien-être'], tone: 'ok' },
  service: { icon: 'cog', label: ['Service', 'Service'], tone: 'accent' },
  cost: { icon: 'bolt', label: ['Cost', 'Coût'], tone: 'warn' },
  safety: { icon: 'shield', label: ['Safety', 'Sécurité'], tone: 'risk' },
  energy: { icon: 'beacon', label: ['Energy', 'Énergie'], tone: 'ok' },
};
function daysAgo(d) {
  return d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 86_400_000)) : null;
}

export function ContractorSuggestionsPage({ onOpenChat }) {
  const sl = useSL();
  const session = useSession();
  const orgId = session?.organizationId;
  const { suggestions, loaded, refresh } = useContractorSuggestions(orgId);
  const [busyId, setBusyId] = useState(null);

  const drafts = useMemo(() => suggestions.filter((s) => s.status === 'draft'), [suggestions]);
  const sent = useMemo(() => suggestions.filter((s) => s.status === 'sent'), [suggestions]);
  const decided = useMemo(
    () => suggestions.filter((s) => s.status === 'adopted' || s.status === 'declined'),
    [suggestions],
  );
  const adoptedN = decided.filter((s) => s.status === 'adopted').length;

  const act = async (id, status) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await setSuggestionStatus(id, status);
      refresh();
    } finally {
      setBusyId(null);
    }
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
            {sl('SUGGESTIONS', 'SUGGESTIONS')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <Icon.innovate size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              {sl('Ideas for your client', 'Des idées pour votre client')}
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 720, lineHeight: 1.5 }}>
            {sl(
              'Merlin spots improvements worth proposing to the FM — service tweaks, occupant wellbeing, cost, safety. Review them, send the ones you like, and track what the client adopts.',
              'Merlin repère des améliorations à proposer au FM — service, bien-être des occupants, coût, sécurité. Examinez-les, envoyez celles qui vous conviennent et suivez ce que le client adopte.',
            )}
          </p>
        </div>
        {decided.length > 0 && (
          <div
            style={{
              minWidth: 150,
              padding: '14px 18px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              {sl('Adopted', 'Adoptées')}
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--ok)', marginTop: 2 }}>
              {adoptedN}
              <span style={{ fontSize: 16, color: 'var(--text-faint)' }}>/{decided.length}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{sl('of decided', 'des décidées')}</div>
          </div>
        )}
      </div>

      {/* Draft a new idea */}
      {onOpenChat && (
        <button
          onClick={() =>
            onOpenChat(
              sl(
                'Draft an improvement or occupant-wellbeing suggestion I can send my client, based on what you’re seeing in the building this week. Keep it concrete with the expected impact.',
                'Rédige une suggestion d’amélioration ou de bien-être des occupants que je peux envoyer à mon client, d’après ce que tu observes dans le bâtiment cette semaine. Reste concret avec l’impact attendu.',
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
          <Icon.sparkle size={13} /> {sl('Draft a new idea with Merlin', 'Rédiger une nouvelle idée avec Merlin')}
        </button>
      )}

      {!loaded && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
          {sl('Loading…', 'Chargement…')}
        </div>
      )}

      {/* Drafts Merlin prepared */}
      {drafts.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel
            icon="sparkle"
            text={sl(`Drafted for you · ${drafts.length}`, `Préparées pour vous · ${drafts.length}`)}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {drafts.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                sl={sl}
                busy={busyId === s.id}
                onSend={() => act(s.id, 'sent')}
                onDismiss={() => act(s.id, 'dismissed')}
              />
            ))}
          </div>
        </section>
      )}

      {/* Sent — awaiting the client */}
      {sent.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel icon="ship" text={sl(`Sent · awaiting your client`, `Envoyées · en attente`)} />
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sent.map((s) => (
                <SuggestionRow key={s.id} s={s} sl={sl} statusTone="neutral" statusLabel={sl('Sent', 'Envoyée')} />
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Decided — the feedback loop */}
      {decided.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel icon="paper" text={sl('Client decisions', 'Décisions du client')} />
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {decided.map((s) => (
                <SuggestionRow
                  key={s.id}
                  s={s}
                  sl={sl}
                  statusTone={s.status === 'adopted' ? 'ok' : 'risk'}
                  statusLabel={s.status === 'adopted' ? sl('Adopted', 'Adoptée') : sl('Declined', 'Déclinée')}
                />
              ))}
            </div>
          </Card>
        </section>
      )}

      {loaded && suggestions.length === 0 && (
        <Card>
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {sl(
              'No suggestions yet — Merlin will surface ideas as it learns the building.',
              'Aucune suggestion pour l’instant — Merlin en proposera en apprenant le bâtiment.',
            )}
          </div>
        </Card>
      )}
    </main>
  );
}

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

function SuggestionCard({ s, sl, busy, onSend, onDismiss }) {
  return (
    <div
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
      {(() => {
        const a = daysAgo(s.created_at);
        return a == null ? null : (
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
            {a === 0
              ? sl('Merlin spotted this today', 'Repéré par Merlin aujourd’hui')
              : sl(`Merlin spotted this ${a}d ago`, `Repéré par Merlin il y a ${a} j`)}
          </div>
        );
      })()}
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button onClick={onSend} disabled={busy} style={{ ...sendBtn, opacity: busy ? 0.6 : 1 }}>
          <Icon.ship size={12} /> {sl('Send to client', 'Envoyer au client')}
        </button>
        <button onClick={onDismiss} disabled={busy} style={dismissBtn}>
          {sl('Dismiss', 'Ignorer')}
        </button>
      </div>
    </div>
  );
}

function SuggestionRow({ s, sl, statusTone, statusLabel }) {
  return (
    <div
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
      {s.impact && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-soft)' }}>{s.impact}</span>}
      <Pill tone={statusTone}>{statusLabel}</Pill>
      {s.status === 'adopted' && s.decided_at && (
        <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
          {sl('in effect since', 'en place depuis')}{' '}
          {new Date(s.decided_at).toLocaleDateString(sl('en-US', 'fr-FR'), { month: 'short', day: 'numeric' })}
        </span>
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

const sendBtn = {
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
const dismissBtn = {
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  background: 'none',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  cursor: 'pointer',
};
