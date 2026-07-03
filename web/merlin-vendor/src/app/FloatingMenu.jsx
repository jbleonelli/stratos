// FloatingMenu — self-contained floating circular button + popup nav panel.
// Originally authored as a copy-pasteable TS component for the Adaptiv
// marketing site; ported to plain JSX for use inside Merlin (rest of
// src/ is JSX, not TSX). No external CSS, no design-system dependency —
// all styling is inline + a scoped <style> block.
//
// Exports:
//   - FloatingMenu (default-export pattern preserved as named export)
//   - AdaptivAIcon (the Adaptiv "A" mark with brand gradient)

import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function defaultRenderLink({ href, className, style, children }) {
  return (
    <a href={href} className={className} style={style}>
      {children}
    </a>
  );
}

export function FloatingMenu({
  items,
  cta,
  currentPath,
  icon,
  iconAlt = '',
  accentColor = '#FF00B2',
  renderLink = defaultRenderLink,
  positionStyle,
  panelPositionStyle,
  eyebrow = '// Navigation',
  closeHint = 'ESC',
  closeOnPathChange = true,
  // Optional ReactNode rendered between the eyebrow header and the
  // items list — used by Merlin's /platform header to embed a user
  // profile card + sign-out button in the popup. Generic enough that
  // the marketing-site version can ignore it. No default styling;
  // caller controls layout.
  headerSlot = null,
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  // Close on path change
  useEffect(() => {
    if (!closeOnPathChange) return;
    setOpen(false);
  }, [currentPath, closeOnPathChange]);

  // ESC + click-outside
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e) => {
      const t = e.target;
      if (panelRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const accent = accentColor;
  const accentBorder = withAlpha(accent, 0.55);
  const accentShadowOpen = withAlpha(accent, 0.25);
  const accentShadowClosed = withAlpha(accent, 0.15);

  // Class names used by the scoped <style> block below.
  const BTN = '_fm_btn';
  const ROW = '_fm_row';
  const CHEV = '_fm_chev';
  const CTA = '_fm_cta';
  const DOT = '_fm_cta_dot';

  const iconNode =
    typeof icon === 'string' ? (
      <img src={icon} alt={iconAlt} draggable={false} aria-hidden={!open} style={iconAnimStyle(open)} />
    ) : (
      <span
        aria-hidden={!open}
        style={{ ...iconAnimStyle(open), display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {icon}
      </span>
    );

  return (
    <>
      <style>{`
        .${BTN}:hover { transform: scale(1.05); }
        .${BTN}:active { transform: scale(0.95); }
        .${ROW} { transition: background-color 150ms ease-out; }
        .${ROW}:hover { background: color-mix(in oklch, var(--text) 6%, transparent); }
        .${ROW} .${CHEV} {
          opacity: 0;
          transform: translateX(-4px);
          transition: opacity 200ms ease-out, transform 200ms ease-out;
        }
        .${ROW}:hover .${CHEV} { opacity: 1; transform: translateX(0); }
        .${CTA} { transition: background-color 200ms ease-out; }
        .${CTA}:hover { background: ${accent}; }
        .${CTA}:hover .${DOT} { background: #fff; }
      `}</style>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className={BTN}
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          // Above platform modals/drawers (TeamActivity 110, Stripe 300,
          // etc.). FloatingMenu is a top-level surface — should always
          // clear page content.
          zIndex: 501,
          width: 48,
          height: 48,
          borderRadius: 999,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          cursor: 'pointer',
          transition:
            'transform 300ms ease-out, background-color 300ms ease-out, box-shadow 300ms ease-out, border-color 300ms ease-out',
          background: open ? 'transparent' : 'color-mix(in oklch, var(--surface) 85%, transparent)',
          backdropFilter: open ? undefined : 'blur(12px)',
          WebkitBackdropFilter: open ? undefined : 'blur(12px)',
          border: `1px solid ${open ? 'transparent' : accentBorder}`,
          boxShadow: open ? `0 6px 22px ${accentShadowOpen}` : `0 2px 10px ${accentShadowClosed}`,
          ...positionStyle,
        }}
      >
        {/* Hamburger lines (closed state) */}
        <span
          aria-hidden={open}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: open ? 0 : 1,
            transition: open ? 'opacity 120ms ease-out 0ms' : 'opacity 240ms ease-out 180ms',
          }}
        >
          <span style={{ position: 'relative', width: 20, height: 20, display: 'block' }}>
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 'calc(50% - 4px)',
                height: 1.5,
                borderRadius: 999,
                background: accent,
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 'calc(50% + 3px)',
                height: 1.5,
                borderRadius: 999,
                background: accent,
              }}
            />
          </span>
        </span>

        {iconNode}
      </button>

      {/* Portal the panel to document.body so it escapes any parent
          stacking context. Platform headers + sub-nav strips use
          backdrop-filter, which creates new stacking contexts that
          trap descendants — even fixed-position children with very
          high z-index can't render above siblings of the trapping
          ancestor. Portaling pulls the panel out of that subtree so
          its z-index applies against the viewport's root context. */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-hidden={!open}
            style={{
              position: 'fixed',
              top: 80,
              right: 20,
              // Sits just under the button (501) so the button's hover/active
              // scale doesn't get masked, but above all platform modals
              // (TeamActivity 110, Stripe 300, etc.).
              zIndex: 500,
              width: 'min(86vw, 340px)',
              borderRadius: 16,
              // Frosted-glass — theme-aware via var(--surface). Matches
              // the Merlin chat panel's surface treatment so the menu
              // reads correctly in dark mode (was hardcoded white).
              background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
              backdropFilter: 'blur(16px) saturate(180%)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)',
              border: '1px solid var(--border)',
              boxShadow: '0 24px 60px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)',
              transformOrigin: 'top right',
              transition: 'opacity 300ms ease-out, transform 300ms ease-out',
              opacity: open ? 1 : 0,
              transform: open ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-8px)',
              pointerEvents: open ? 'auto' : 'none',
              ...panelPositionStyle,
            }}
          >
            {(eyebrow || closeHint) && (
              <div
                style={{
                  padding: '16px 20px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {eyebrow ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--text-dim)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {eyebrow}
                  </span>
                ) : (
                  <span />
                )}
                {closeHint ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: '0.18em',
                      color: 'var(--text-faint)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {closeHint}
                  </span>
                ) : null}
              </div>
            )}

            {headerSlot}

            <nav style={{ display: 'flex', flexDirection: 'column', padding: '0 8px 8px' }}>
              {items.map((item, i) => {
                const active = currentPath === item.href;
                const number = String(i + 1).padStart(2, '0');

                const rowContent = (
                  <>
                    {active && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 3,
                          height: 20,
                          borderRadius: 999,
                          background: accent,
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '0.05em',
                        color: active ? accent : 'var(--text-faint)',
                      }}
                    >
                      {number}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 14,
                        letterSpacing: '-0.01em',
                        color: active ? 'var(--text)' : 'var(--text-soft)',
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      {item.label}
                    </span>
                    <svg
                      className={CHEV}
                      width={12}
                      height={12}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={active ? accent : 'rgba(0,0,0,0.35)'}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={active ? { opacity: 1, transform: 'translateX(0)' } : undefined}
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                  </>
                );

                const linkStyle = {
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '10px 12px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  color: 'inherit',
                  transitionDelay: open ? `${i * 24}ms` : '0ms',
                };

                return (
                  <Fragment key={item.href}>
                    {renderLink({
                      href: item.href,
                      className: ROW,
                      style: linkStyle,
                      children: rowContent,
                    })}
                  </Fragment>
                );
              })}
            </nav>

            {cta && (
              <>
                <div style={{ margin: '0 20px', borderTop: '1px solid rgba(0,0,0,0.06)' }} />
                <div style={{ padding: 12 }}>
                  {renderLink({
                    href: cta.href,
                    className: CTA,
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 8,
                      background: '#111827',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                      textDecoration: 'none',
                    },
                    children: (
                      <>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            className={DOT}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              background: accent,
                              display: 'inline-block',
                            }}
                          />
                          {cta.label}
                        </span>
                        <svg
                          width={14}
                          height={14}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M5 12h14" />
                          <path d="m13 6 6 6-6 6" />
                        </svg>
                      </>
                    ),
                  })}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AdaptivAIcon — Adaptiv "A" mark, square SVG, brand gradient inside,
// white path on top. The FloatingMenu button has a circular clipPath
// applied to its icon slot, so the square corners get hidden naturally.

export function AdaptivAIcon({ size = 128, className, style, title }) {
  const gradientId = useId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={className}
      style={style}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gradientId} x1="11.32" y1="116.68" x2="114.76" y2="13.24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#000064" />
          <stop offset="0.37" stopColor="#60006d" />
          <stop offset="0.59" stopColor="#a71992" />
          <stop offset="0.77" stopColor="#d011a0" />
          <stop offset="0.91" stopColor="#ed09ab" />
          <stop offset="1" stopColor="#ff00b2" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" fill={`url(#${gradientId})`} />
      {/* A path scaled to 80% of viewBox around center so it sits
          comfortably inside the gradient circle with breathing room
          on all sides. Scaling the path itself (not the SVG) keeps
          the gradient at full viewBox so it still fills the entire
          button via clipPath circle(50%) — only the A shrinks. */}
      <g transform="translate(64 64) scale(0.8) translate(-64 -64)">
        <path
          fill="#fff"
          d="m103.97,90.19l-24.74-64.46c-3-7.81-10.63-13.05-18.99-13.05s-15.99,5.24-18.99,13.05l-17.21,44.84c-4.65,12.11,4.29,25.13,17.27,25.13h0c7.66,0,14.53-4.72,17.27-11.87l1.66-4.32,9.19,23.95c2.73,7.1,9.67,11.87,17.27,11.87,6.09,0,11.79-3,15.25-8.02,3.45-5.02,4.21-11.42,2.02-17.11Zm-17.27,9.92h0c-1.36,0-2.59-.84-3.07-2.11l-23.39-60.93-16.66,43.41h-7.06l18.93-49.31c.76-1.98,2.67-3.29,4.79-3.29h0c2.13,0,4.03,1.31,4.79,3.29l24.74,64.46c.83,2.16-.76,4.47-3.07,4.47Z"
        />
      </g>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// internals

function iconAnimStyle(open) {
  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    display: 'block',
    transition: 'opacity 500ms ease-out, transform 500ms ease-out',
    opacity: open ? 1 : 0,
    // Open state: scale(1.0) + clipPath circle(50%) so the gradient
    // fills the entire button diameter (no transparent ring showing
    // the page underneath). The A path inside the SVG naturally
    // occupies ~80% of the viewBox, so it sits inside the gradient
    // circle with even breathing room — no extra SVG scaling needed.
    // Previous values (1.12 then 0.9 on a 46% clip) left a visible
    // ring around the circle.
    transform: open ? 'rotate(0deg) scale(1)' : 'rotate(-180deg) scale(0.5)',
    clipPath: 'circle(50% at 50% 50%)',
  };
}

// "#RRGGBB" or "#RGB" → rgba() with the given alpha. Passes through other
// formats unchanged (e.g. rgb(), hsl(), CSS named colors).
function withAlpha(color, alpha) {
  const hex = (color || '').trim();
  if (!hex.startsWith('#')) return color;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else {
    return color;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
