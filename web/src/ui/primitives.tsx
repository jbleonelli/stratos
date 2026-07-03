// Shared visual primitives — the Adaptiv component kit, styled entirely through
// the tokens.css custom properties. Ported from the Adaptiv Design System.
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './icons';

const WORDMARK_URL = '/logo-adaptiv.png';

type Tone = 'neutral' | 'ok' | 'warn' | 'risk' | 'accent' | 'info';

export function Pill({
  children,
  tone = 'neutral',
  style = {},
}: {
  children: ReactNode;
  tone?: Tone;
  style?: CSSProperties;
}) {
  const tones: Record<Tone, { bg: string; fg: string; bd: string }> = {
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

export function Dot({ tone = 'ok', size = 8, pulse = false }: { tone?: Tone | 'off'; size?: number; pulse?: boolean }) {
  const color = {
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    risk: 'var(--risk)',
    info: 'var(--info)',
    accent: 'var(--accent)',
    neutral: 'var(--text-faint)',
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
        color,
        flexShrink: 0,
        animation: pulse ? 'ds-pulse 1.6s ease-out infinite' : 'none',
      }}
    />
  );
}

export function Card({
  children,
  style = {},
  pad = true,
  interactive = false,
  accent = false,
}: {
  children: ReactNode;
  style?: CSSProperties;
  pad?: boolean;
  interactive?: boolean;
  accent?: boolean;
}) {
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

export function DataError({
  message,
  onRetry,
  retryLabel = 'Try again',
  compact = false,
  style = {},
}: {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  style?: CSSProperties;
}) {
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
}: {
  data: Array<number | { v: number }>;
  w?: number;
  h?: number;
  stroke?: string;
  fill?: string;
  responsive?: boolean;
}) {
  const val = (d: number | { v: number }) => (typeof d === 'number' ? d : d.v);
  const max = Math.max(...data.map(val));
  const min = Math.min(...data.map(val));
  const span = Math.max(1, max - min);
  const pts = data.map((d, i) => {
    const v = val(d);
    const x = (i / (data.length - 1)) * w;
    const y = h - 2 - ((v - min) / span) * (h - 4);
    return [x, y] as const;
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;
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

// The agent mark — a slowly-spinning pink→indigo gradient ring around a fixed
// inner disc. Shared so anywhere the agent "speaks" uses the same identity.
export function AgentAvatar({ size = 28, glow = true }: { size?: number; glow?: boolean }) {
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
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FF00B2, #20286D)',
          animation: 'ds-disk-spin 6s linear infinite',
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

export function Ring({
  pct,
  size = 44,
  thick = 4,
  tone = 'ok',
  label,
}: {
  pct: number;
  size?: number;
  thick?: number;
  tone?: 'ok' | 'warn' | 'risk' | 'accent';
  label?: ReactNode;
}) {
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

// Branded loading indicator — the Adaptiv wordmark in the brand gradient with a
// soft breath pulse + gradient shimmer.
const LOADER_SIZES = {
  sm: { w: 80, h: 24 },
  md: { w: 120, h: 36 },
  lg: { w: 180, h: 54 },
} as const;

export function AdaptivLoader({
  size = 'md',
  label = null,
  style = {},
}: {
  size?: keyof typeof LOADER_SIZES;
  label?: ReactNode;
  style?: CSSProperties;
}) {
  const dims = LOADER_SIZES[size] || LOADER_SIZES.md;
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: label ? 14 : 0, ...style }}>
      <div
        role="img"
        aria-label="Loading"
        style={{
          width: dims.w,
          height: dims.h,
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
          animation: 'ds-breathe 1.8s ease-in-out infinite, ds-shimmer 3.2s linear infinite',
          willChange: 'opacity, transform, background-position',
        }}
      />
      {label && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.01em' }}>{label}</div>
      )}
    </div>
  );
}

export function IconBtn({
  children,
  onClick,
  size = 30,
  title,
  active = false,
  style = {},
}: {
  children: ReactNode;
  onClick?: () => void;
  size?: number;
  title?: string;
  active?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={!active ? 'ds-iconbtn' : undefined}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(active ? { background: 'var(--accent-soft)' } : null),
        color: active ? 'var(--accent)' : 'var(--text-soft)',
        border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
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

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  style = {},
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    whiteSpace: 'nowrap',
    transition: 'filter .12s, background .12s',
  };
  const skin: CSSProperties =
    variant === 'primary'
      ? { background: 'linear-gradient(120deg, var(--accent-pink), var(--accent-indigo))', color: '#fff', border: '1px solid transparent' }
      : { background: 'var(--surface)', color: 'var(--text-soft)', border: '1px solid var(--border)' };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...skin, ...style }}>
      {children}
    </button>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  style = {},
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  style?: CSSProperties;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '9px 12px',
        color: 'var(--text)',
        fontSize: 13.5,
        outline: 'none',
        ...style,
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-line)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    />
  );
}

// Section header used at the top of dashboard panels.
export function PanelHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 14,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text)' }}>
        {title}
      </h2>
      {right}
    </div>
  );
}

// A branded wordmark rendered via mask-image so it always paints in the brand
// gradient (works on light + dark shells). `mono` paints a flat colour instead.
export function Wordmark({ height = 22, style = {} }: { height?: number; style?: CSSProperties }) {
  return (
    <div
      aria-label="Adaptiv"
      role="img"
      style={{
        height,
        width: height * 3.4,
        background: 'linear-gradient(120deg, #FF00B2, #20286D)',
        maskImage: `url(${WORDMARK_URL})`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'left center',
        WebkitMaskImage: `url(${WORDMARK_URL})`,
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'left center',
        ...style,
      }}
    />
  );
}
