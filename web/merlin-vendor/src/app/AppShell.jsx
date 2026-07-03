// App-shell chrome, extracted from App.jsx (2026-06-24). The loading fallback +
// stale-chunk recovery boundary, the mac-window frame, the Window-Controls-Overlay
// title bar, the impersonation banner, and the ShellFrame that composes them.
// All used by App.jsx's surface routing; TitleBarOverlay + ImpersonationBanner are
// module-internal (only ShellFrame uses them).
import React, { useState } from 'react';
import { Icon } from './icons.jsx';
import { MessageDrawer } from './MessageDrawer.jsx';
import { useT } from './i18n.js';
import { useActiveOrg } from './org-data.js';
import { alertDialog } from './dialogs.jsx';
import { platformImpersonateEnd } from './platform-data.js';

// Suspense fallback for the lazy-loaded route chunks (Tier 2.1).
// Mirrors the page's flex layout so the surrounding chrome doesn't
// jump. Deliberately minimal — most chunks load in <100ms on a warm
// cache; users only see this on cold load or slow networks. No spinner
// either, for the same reason: a quick flash of a spinner is uglier
// than a brief plain pane.
export function LazyFallback() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: 0.15, textTransform: 'uppercase' }}>
        loading…
      </div>
    </div>
  );
}

// Catches the "Failed to fetch dynamically imported module" error that
// fires when a user has a tab open across a deploy — the OLD chunk hash
// is referenced by the OLD JS in their tab, but Vercel has already
// deleted the old chunk (only the new hash exists on the CDN).
//
// Recovery is a hard reload — fetches the fresh HTML, which references
// the new chunk hashes, and the lazy import succeeds. The user sees a
// flash of "loading…" then the page they wanted, no error toast needed.
// We use a session-storage sentinel so an infinite reload loop is
// impossible if reloading doesn't fix it (genuine network outage or
// adblock): show a manual reload button instead.
export class LazyChunkBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failedToLoad: false };
  }
  static getDerivedStateFromError(err) {
    // Match Vite/Rollup's chunk-load-failure message. Conservative —
    // we don't want to reload for unrelated runtime errors that bubble
    // up through Suspense.
    const msg = String(err?.message || err || '');
    if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
      return { failedToLoad: true };
    }
    throw err;
  }
  componentDidCatch(err) {
    if (!this.state.failedToLoad) return;
    // Avoid an infinite reload loop on adblock / offline. If we've
    // already reloaded once in this session and it still failed, fall
    // through to the manual UI.
    try {
      const k = 'merlin-chunk-reload-sentinel';
      if (sessionStorage.getItem(k) !== '1') {
        sessionStorage.setItem(k, '1');
        window.location.reload();
        return;
      }
    } catch {
      /* sessionStorage blocked → just don't loop */
    }
    // eslint-disable-next-line no-console
    console.warn('[LazyChunkBoundary] chunk load failed after reload — showing manual recovery', err);
  }
  render() {
    if (this.state.failedToLoad) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
            padding: 24,
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Update available</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55 }}>
              A new version of Merlin is live but this tab is on the previous one. Reload to continue.
            </div>
            <button
              onClick={() => {
                try {
                  sessionStorage.removeItem('merlin-chunk-reload-sentinel');
                } catch {}
                window.location.reload();
              }}
              style={{
                marginTop: 12,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                background: 'var(--accent)',
                color: '#fff',
                border: '1px solid var(--accent)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function MacWindowChrome({ children }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'stretch',
      }}
    >
      <div
        className="mac-window"
        style={{
          flex: 1,
          background: 'var(--surface)',
          display: 'flex',
          // PR #690: was overflow:hidden — that clipped the sidebar's
          // wordmark to 52px wide because the rotated wordmark renders
          // wider than the 52px rail column. Every dimension bump I
          // tried (250x75 → 500x150) was invisible since the parent
          // chrome clipped the visible width. Setting visible lets the
          // wordmark spill into the empty space alongside the rail
          // (between the rail and the central content card).
          // borderRadius is 0 here so the hidden wasn't load-bearing
          // for corner clipping.
          overflow: 'visible',
          borderRadius: 0,
          boxShadow: 'none',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Wraps the customer shell with an impersonation banner at the top when
// the platform admin is impersonating a tenant. The banner takes a
// fixed vertical slice; the rest of the viewport flows the regular
// chrome. Click "Exit" to release the impersonation and return to
// /platform/tenants.
// Window Controls Overlay title bar — only visible when Merlin runs as an
// INSTALLED app on a browser that supports WCO (Chrome/Edge desktop). There
// the OS title bar is removed and the web content owns the top strip, so we
// paint the brand pink→indigo gradient there (draggable, with a MERLIN
// wordmark just past the window controls / macOS traffic lights). In a normal
// browser tab or on unsupported OSes, env(titlebar-area-height) is 0 → this
// collapses to nothing: zero layout change, no regression. The manifest's
// solid theme_color stays the fallback bar in plain `standalone`. Mirrors the
// ImpersonationBanner pattern (a 0-flex top strip that pushes content down).
function TitleBarOverlay() {
  return (
    <div
      aria-hidden
      className="merlin-wco-titlebar"
      style={{
        height: 'env(titlebar-area-height, 0px)',
        flexShrink: 0,
        // Drawable area starts after the window controls; env(titlebar-area-x)
        // is that left inset (≈ width of the macOS traffic lights).
        paddingLeft: 'calc(env(titlebar-area-x, 0px) + 14px)',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(90deg, var(--accent-pink), var(--accent-indigo))',
        color: '#fff',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitAppRegion: 'drag',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em' }}>MERLIN</span>
    </div>
  );
}

export function ShellFrame({ session, children }) {
  return (
    <div className="screen-h" style={{ width: '100vw', display: 'flex', flexDirection: 'column' }}>
      <TitleBarOverlay />
      {session?.impersonatingOrgId && <ImpersonationBanner />}
      {children}
      <MessageDrawer />
    </div>
  );
}

function ImpersonationBanner() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const org = useActiveOrg();
  const exit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await platformImpersonateEnd();
    } catch (ex) {
      alertDialog(ex.message || t('imp.exit_failed'));
      setBusy(false);
    }
  };
  return (
    <div
      style={{
        flex: '0 0 36px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        background: 'linear-gradient(90deg, var(--warn), color-mix(in oklch, var(--warn) 70%, var(--accent)))',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        borderBottom: '1px solid rgba(0,0,0,0.15)',
        zIndex: 50,
      }}
    >
      <Icon.warn size={13} />
      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {t('imp.banner.prefix')}{' '}
        {org?.name ? <strong style={{ fontWeight: 800 }}>{org.name}</strong> : t('imp.banner.fallback')}
        {' · '}
        <span style={{ fontWeight: 500, opacity: 0.85 }}>{t('imp.banner.body')}</span>
      </div>
      <button
        onClick={exit}
        disabled={busy}
        style={{
          padding: '4px 12px',
          fontSize: 11.5,
          fontWeight: 700,
          background: 'rgba(0,0,0,0.25)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: 999,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? t('imp.banner.exiting') : t('imp.banner.exit')}
      </button>
    </div>
  );
}
