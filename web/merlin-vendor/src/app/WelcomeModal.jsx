// WelcomeModal — Phase 1 of new-tenant onboarding.
//
// Renders a centered modal over /customer the first time someone signs
// into a fresh tenant. Six-card vertical picker (office / warehouse /
// healthcare / stadium / retail / other) + Skip. On submit:
//   1. Sets organizations.setup_progress.vertical_picked
//   2. Sets organizations.setup_progress.recommended_agents (from
//      vertical-recommendations.js for the chosen vertical)
//   3. Creates a default building if none exists, with variant set
//   4. Closes — caller re-renders without the modal
//
// Gates on organizations.setup_progress.vertical_picked being null /
// missing. Once set (by either a real pick or a Skip), this modal
// never reappears for that org.
//
// Design rationale + flow in docs/architecture/new-tenant-onboarding.md.

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { listVerticals } from './vertical-recommendations.js';
import { useOrgSetupGate, usePickVertical } from './queries/onboarding.ts';
import { useT } from './i18n.js';

const VERTICAL_EMOJI = {
  office: '🏢',
  warehouse: '📦',
  healthcare: '🏥',
  stadium: '🏟',
  retail: '🛒',
  other: '…',
};

export function WelcomeModal({ organizationId, organizationName }) {
  const tT = useT();
  const [selected, setSelected] = useState(null);
  // Local "user closed it" flag — set on a successful pick so the modal hides
  // immediately (the gate query is also invalidated, but this avoids a flash).
  const [dismissed, setDismissed] = useState(false);

  // React Query owns the read gate and the write. Contractor orgs and orgs that
  // already picked a vertical don't see the picker (same rule as before, now
  // derived from the query instead of a status state machine).
  const { data: org, isLoading, isError } = useOrgSetupGate(organizationId);
  const pick = usePickVertical(organizationId, organizationName);

  const sp = org?.setup_progress || {};
  const gateOpen = !isLoading && !isError && org?.kind !== 'contractor' && sp.vertical_picked == null;
  const submitting = pick.isPending;
  const error = pick.error?.message || null;

  function persist(verticalKey) {
    pick.mutate(verticalKey, { onSuccess: () => setDismissed(true) });
  }

  if (dismissed || (!gateOpen && !submitting)) return null;

  const verticals = listVerticals();

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--surface, #fff)',
          borderRadius: 16,
          boxShadow: '0 12px 64px rgba(0,0,0,0.25)',
          width: '100%',
          maxWidth: 720,
          padding: 28,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            marginBottom: 8,
          }}
        >
          {tT('onboarding.welcome.eyebrow')}
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3, marginBottom: 6 }}>
          {tT('onboarding.welcome.title')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 22, lineHeight: 1.5 }}>
          {tT('onboarding.welcome.subtitle')}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          {verticals.map((v) => {
            const isSelected = selected === v.key;
            return (
              <button
                key={v.key}
                onClick={() => setSelected(v.key)}
                disabled={submitting}
                style={{
                  textAlign: 'left',
                  background: isSelected ? 'var(--accent-soft, #FCE4F0)' : 'var(--surface-2, #F8FAFC)',
                  border: isSelected ? '2px solid var(--accent, #D946EF)' : '1px solid var(--rule, #E5E7EB)',
                  borderRadius: 10,
                  padding: 14,
                  cursor: submitting ? 'default' : 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{VERTICAL_EMOJI[v.key]}</div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: 'var(--text-dim)',
                    marginBottom: 4,
                  }}
                >
                  {v.label}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--text)' }}>{v.description}</div>
              </button>
            );
          })}
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: 10,
              fontSize: 12,
              background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
              color: 'var(--risk)',
              borderRadius: 6,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            onClick={() => persist('other')}
            disabled={submitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: 12,
              cursor: submitting ? 'default' : 'pointer',
              letterSpacing: 0.2,
              padding: '6px 4px',
            }}
          >
            {tT('onboarding.welcome.cta_skip')}
          </button>
          <button
            onClick={() => selected && persist(selected)}
            disabled={!selected || submitting}
            style={{
              background: selected ? 'var(--accent, #D946EF)' : 'var(--surface-2, #F8FAFC)',
              color: selected ? 'white' : 'var(--text-dim)',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 0.2,
              padding: '10px 22px',
              borderRadius: 8,
              cursor: selected && !submitting ? 'pointer' : 'default',
              minWidth: 140,
            }}
          >
            {submitting ? tT('onboarding.welcome.cta_submitting') : tT('onboarding.welcome.cta_submit')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
