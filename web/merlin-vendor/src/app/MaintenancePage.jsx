// MaintenancePage — what users see when platform_settings.maintenance_mode
// is enabled.
//
// Renders pre-signin (App.jsx routes here instead of the auth form when
// maintenance is on) and post-signin (App.jsx's render-time gate cuts
// non-Owner sessions over to this page until logout completes).
//
// Visual choice — hardcoded colors instead of theme tokens:
//   The page is intentionally theme-agnostic. The earlier version
//   inherited `var(--text)` which, under bold-variant or any tweak that
//   sets a light --text while --bg stays light, rendered the title
//   light-on-light (JB hit this 2026-05-22). Since this is an emergency
//   surface that anyone might land on without their tweaks fully
//   applied yet, we just pin the palette: light bg, dark text, brand
//   accent for the eyebrow.
//
// No admin sign-in shortcut on this page — the Merlin Owner reaches
// /platform/experimental directly to disable maintenance.

import React from 'react';
import { useT } from './i18n.js';
import { WORDMARK_URL } from './brand-assets.js';

const BG = '#f4f6fa'; // matches :root --bg in light mode
const TEXT = '#0b1020'; // matches :root --text in light mode
const TEXT_DIM = '#6b7390'; // matches :root --text-dim in light mode
const ACCENT_PINK = '#FF00B2';

export function MaintenancePage({ customMessage }) {
  const t = useT();
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: BG,
        color: TEXT,
        padding: 24,
        position: 'relative',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: ACCENT_PINK,
          }}
        >
          {t('maintenance.eyebrow')}
        </div>

        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: -0.5,
            lineHeight: 1.2,
            color: TEXT,
          }}
        >
          {t('maintenance.title')}
        </div>

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: TEXT_DIM,
            maxWidth: 460,
          }}
        >
          {customMessage || t('maintenance.body_default')}
        </div>

        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.3,
            color: TEXT_DIM,
          }}
        >
          {t('maintenance.signoff')}
        </div>
      </div>

      {/* Vertical Adaptiv wordmark anchored bottom-left, matching the
          sign-in screen (Auth.jsx:LeftWordmark) — same mask + brand
          gradient, same clamp sizing. */}
      <div style={{ position: 'absolute', bottom: 48, left: 44, pointerEvents: 'none' }}>
        <LeftWordmark />
      </div>
    </div>
  );
}

// Vertical Adaptiv wordmark — duplicated from Auth.jsx:LeftWordmark to
// keep MaintenancePage standalone (it can render before the rest of the
// app boots). Same CSS-mask + brand-gradient pattern; if the source PNG
// or sizing logic changes, update both call sites.
function LeftWordmark() {
  const VISUAL_H = 'clamp(200px, 32vh, 320px)';
  const VISUAL_W = 'clamp(60px, 9.6vh, 96px)';
  return (
    <div
      style={{
        position: 'relative',
        width: VISUAL_W,
        height: VISUAL_H,
        flexShrink: 0,
        marginLeft: -12,
      }}
    >
      <div
        role="img"
        aria-label="Adaptiv"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: VISUAL_H,
          height: VISUAL_W,
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          transformOrigin: 'center center',
          background: 'linear-gradient(135deg, #FF00B2, #20286D)',
          maskImage: `url(${WORDMARK_URL})`,
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskImage: `url(${WORDMARK_URL})`,
          WebkitMaskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
        }}
      />
    </div>
  );
}
