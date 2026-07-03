// Shared visual primitives
import React from 'react';
import { Icon } from './icons.jsx';
import { WORDMARK_URL } from './brand-assets.js';

export function Pill({ children, tone = 'neutral', style = {} }) {
  const tones = {
    neutral: { bg: 'var(--surface-3)', fg: 'var(--text-soft)', bd: 'var(--border)' },
    ok: {
      bg: 'color-mix(in oklch, var(--ok) 12%, transparent)',
      fg: 'var(--ok)',
      bd: 'color-mix(in oklch, var(--ok) 30%, transparent)',
    },
    warn: {
      bg: 'color-mix(in oklch, var(--warn) 14%, transparent)',
      fg: 'var(--warn)',
      bd: 'color-mix(in oklch, var(--warn) 35%, transparent)',
    },
    risk: {
      bg: 'color-mix(in oklch, var(--risk) 14%, transparent)',
      fg: 'var(--risk)',
      bd: 'color-mix(in oklch, var(--risk) 35%, transparent)',
    },
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)', bd: 'var(--accent-line)' },
    info: {
      bg: 'color-mix(in oklch, var(--info) 12%, transparent)',
      fg: 'var(--info)',
      bd: 'color-mix(in oklch, var(--info) 30%, transparent)',
    },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = 'ok', size = 8, pulse = false }) {
  const color = {
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    risk: 'var(--risk)',
    info: 'var(--info)',
    accent: 'var(--accent)',
    off: 'var(--text-faint)',
  }[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: pulse ? `0 0 0 0 ${color}` : 'none',
        animation: pulse ? 'merlinPulse 1.6s ease-out infinite' : 'none',
      }}
    />
  );
}

export function Card({ children, style = {}, pad = true, interactive = false, accent = false }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${accent ? 'var(--accent-line)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: pad ? 'var(--pad)' : 0,
        transition: 'border-color .15s, transform .15s',
        cursor: interactive ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Shown when a data fetch FAILS — as opposed to legitimately returning no rows.
// Pages should branch loaded → error → empty → data so a network / RLS / server
// failure reads as "couldn't load, retry" instead of a misleading empty state
// (the "app silently lies under failure" footgun). `message` + `retryLabel` are
// caller-localized; `onRetry` is usually the hook's refresh().
export function DataError({ message, onRetry, retryLabel = 'Try again', compact = false, style = {} }) {
  return (
    <Card
      style={{
        borderColor: 'color-mix(in oklch, var(--risk) 35%, var(--border))',
        background: 'color-mix(in oklch, var(--risk) 6%, transparent)',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 9,
          textAlign: 'center',
          padding: compact ? '6px 4px' : '16px 12px',
        }}
      >
        <Icon.warn size={compact ? 16 : 22} style={{ color: 'var(--risk)' }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', maxWidth: 360, lineHeight: 1.45 }}>
          {message || 'Couldn’t load this. Check your connection and try again.'}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 2,
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--risk)',
              background: 'var(--surface)',
              border: '1px solid color-mix(in oklch, var(--risk) 35%, var(--border))',
              fontFamily: 'inherit',
            }}
          >
            <Icon.reload size={12} /> {retryLabel}
          </button>
        )}
      </div>
    </Card>
  );
}

export function Sparkline({
  data,
  w = 120,
  h = 28,
  stroke = 'var(--accent)',
  fill = 'var(--accent-soft)',
  responsive = false,
}) {
  const max = Math.max(...data.map((d) => d.v ?? d));
  const min = Math.min(...data.map((d) => d.v ?? d));
  const span = Math.max(1, max - min);
  const pts = data.map((d, i) => {
    const v = d.v ?? d;
    const x = (i / (data.length - 1)) * w;
    const y = h - 2 - ((v - min) / span) * (h - 4);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;
  // `responsive` stretches to the parent's width via a viewBox (the line/area
  // scale horizontally); default keeps the fixed-pixel SVG so existing callers
  // are unchanged.
  return (
    <svg
      width={responsive ? '100%' : w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={responsive ? 'none' : 'xMidYMid meet'}
      style={{ display: 'block' }}
    >
      <path d={area} fill={fill} />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect={responsive ? 'non-scaling-stroke' : undefined}
      />
    </svg>
  );
}

// Merlin's animated mark — a slowly-spinning pink→indigo gradient ring
// around a fixed inner disc. Shared so chat, the Now briefing, and anywhere
// Merlin "speaks" use the same identity at any size. Inner disc is ~60% so
// the ring stays visible from 16px to 44px. (Extracted from Chat.jsx,
// 2026-06.) `glow` adds the soft accent shadow used in the chat header.
export function MerlinAvatar({ size = 28, glow = true }) {
  const inner = Math.round(size * 0.6);
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        boxShadow: glow
          ? '0 0 0 2px var(--surface), 0 2px 8px color-mix(in oklch, var(--accent) 40%, transparent)'
          : 'none',
      }}
    >
      <style>{`@keyframes merlin-disk-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FF00B2, #20286D)',
          animation: 'merlin-disk-spin 6s linear infinite',
          willChange: 'transform',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: inner,
          height: inner,
          borderRadius: '50%',
          background: 'var(--surface)',
        }}
      />
    </div>
  );
}

export function Ring({ pct, size = 44, thick = 4, tone = 'ok', label }) {
  const r = (size - thick) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);
  const color = { ok: 'var(--ok)', warn: 'var(--warn)', risk: 'var(--risk)', accent: 'var(--accent)' }[tone];
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border-strong)" strokeWidth={thick} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={thick}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text)',
        }}
      >
        {label ?? `${Math.round(pct)}%`}
      </div>
    </div>
  );
}

// Branded loading indicator — drop-in replacement for "Loading…"
// text. Renders the Adaptiv wordmark in the brand gradient with a
// soft breath pulse + gradient shimmer sweeping diagonally.
//
// Sizes:
//   - sm: inline, card-level (~80×24)
//   - md: section/page-level (~120×36)  — default
//   - lg: full-shell loading (~180×54)
//
// Optional `label` renders below the mark for context ("Loading
// workspace", etc) when the wordmark alone isn't enough cue.
const LOADER_SIZES = {
  sm: { w: 80, h: 24 },
  md: { w: 120, h: 36 },
  lg: { w: 180, h: 54 },
};
export function AdaptivLoader({ size = 'md', label = null, style = {} }) {
  const dims = LOADER_SIZES[size] || LOADER_SIZES.md;
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: label ? 14 : 0,
        ...style,
      }}
    >
      <style>{`
        @keyframes adaptiv-pulse {
          0%, 100% { opacity: 0.55; transform: scale(0.97); }
          50%      { opacity: 1;    transform: scale(1.0); }
        }
        @keyframes adaptiv-shimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
      <div
        role="img"
        aria-label="Loading"
        style={{
          width: dims.w,
          height: dims.h,
          /* Wider-than-element gradient + shimmer keyframe sweeps the
             colour through the wordmark while pulse breathes the mark. */
          background: 'linear-gradient(110deg, #FF00B2 0%, #20286D 35%, #FF00B2 70%, #20286D 100%)',
          backgroundSize: '200% 100%',
          maskImage: `url(${WORDMARK_URL})`,
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskImage: `url(${WORDMARK_URL})`,
          WebkitMaskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          animation: 'adaptiv-pulse 1.8s ease-in-out infinite, adaptiv-shimmer 3.2s linear infinite',
          willChange: 'opacity, transform, background-position',
        }}
      />
      {label && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.01em' }}>{label}</div>
      )}
    </div>
  );
}

export function IconBtn({ children, onClick, size = 28, title, active = false, style = {}, chromeless = false }) {
  // chromeless: render the glyph only — no chip background/border, no hover
  // bg manipulation. Used when a parent (e.g. expanded sidebar NavRow)
  // already carries the hover/active highlight on the row level. Without
  // this, the imperative hover handler below would leave a stale grey
  // background on the icon after click → React's style-prop diff doesn't
  // detect a change (parent overrides both renders to transparent) so the
  // imperative bg never gets cleared.
  // stopPropagation so a click on the IconBtn doesn't ALSO fire the
  // onClick of a wrapping container (e.g. NavRow in the sidebar).
  // Without this, NavRow's chat-toggle handler ran twice — once from
  // the button, once from the row — and the second toggle cancelled
  // the first, making the Ask Merlin icon look like a dead click.
  // PR #750. Other callers were idempotent so the double-fire was
  // silent for them.
  const handleClick = onClick
    ? (e) => {
        e.stopPropagation();
        onClick(e);
      }
    : undefined;
  // Default (non-active, non-chromeless) hover background is owned by CSS
  // (.mrln-iconbtn:hover, tokens.css) instead of an imperative element.style
  // mutation. The old approach left a stale grey background when a click or
  // re-render swallowed mouseleave — e.g. the bottom-rail settings icon looked
  // permanently "selected". CSS :hover clears itself, so it can't get stuck.
  const hoverable = !active && !chromeless;
  return (
    <button
      onClick={handleClick}
      title={title}
      className={hoverable ? 'mrln-iconbtn' : undefined}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        // hoverable: leave background to the CSS class; active/chromeless set it here.
        ...(hoverable ? null : { background: chromeless ? 'transparent' : 'var(--accent-soft)' }),
        color: active ? 'var(--accent)' : 'var(--text-soft)',
        border: chromeless ? '1px solid transparent' : `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
        borderRadius: 8,
        cursor: 'pointer',
        padding: 0,
        transition: 'background .12s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
