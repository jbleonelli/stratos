// Suspended-tenant landing (SaaS v1, phase 5).
//
// Rendered by App.jsx when the user's active org has lifecycle_state =
// 'suspended'. Shown instead of the customer-side shell so we don't have
// to thread suspension state through every page. Users with multiple
// memberships can switch workspaces from here; otherwise sign-out is
// the only path forward.

import React from 'react';
import { Icon } from './icons.jsx';
import { logout as doLogout } from './auth.js';
import { switchOrg } from './org-data.js';
import { useOtherMemberships } from './queries/memberships.ts';
import { useT } from './i18n.js';
import { alertDialog } from './dialogs.jsx';

export function SuspendedOrgPage({ org, session }) {
  const t = useT();
  const reason = org?.suspended_reason || null;
  // Other active workspaces the user can switch to. React Query owns the fetch,
  // caching, and lifecycle (replaces the hand-rolled useEffect+useState below the
  // 'adaptiv' gate, which is now inside the hook).
  const { data: otherMemberships = [] } = useOtherMemberships(session?.userId, org?.id);

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background:
          'radial-gradient(800px 500px at 50% -10%, color-mix(in oklch, var(--warn) 15%, transparent), transparent 60%), var(--surface)',
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 14,
          padding: 32,
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'color-mix(in oklch, var(--warn) 18%, transparent)',
              color: 'var(--warn)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon.warn size={17} />
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--warn)',
                letterSpacing: 0.15,
                textTransform: 'uppercase',
              }}
            >
              {t('suspended.eyebrow')}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{org?.name || '—'}</div>
          </div>
        </div>

        <p style={{ fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.55, margin: '0 0 14px' }}>
          {t('suspended.body')}
        </p>

        {reason && (
          <div
            style={{
              padding: '10px 12px',
              background: 'color-mix(in oklch, var(--warn) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--warn) 35%, transparent)',
              borderRadius: 8,
              fontSize: 12.5,
              color: 'var(--warn)',
              fontWeight: 600,
              marginBottom: 14,
            }}
          >
            <strong>{t('suspended.reason')}</strong> {reason}
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, margin: '0 0 18px' }}>
          {t('suspended.support_pre')}
          <a href="mailto:support@adaptiv.systems" style={{ color: 'var(--accent)' }}>
            support@adaptiv.systems
          </a>
          {t('suspended.support_post')}
        </p>

        {otherMemberships.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-dim)',
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {t('suspended.switch_workspace')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {otherMemberships.map((m) => (
                <button
                  key={m.id}
                  onClick={async () => {
                    try {
                      await switchOrg(m.id);
                    } catch (ex) {
                      alertDialog(ex.message || t('suspended.switch_failed'));
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Icon.sparkle size={12} style={{ color: 'var(--accent)' }} />
                  <span style={{ flex: 1 }}>{m.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={doLogout}
          style={{
            width: '100%',
            padding: '11px 16px',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('suspended.signout')}
        </button>
      </div>
    </div>
  );
}
