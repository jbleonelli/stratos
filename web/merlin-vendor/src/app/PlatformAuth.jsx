// Adaptiv Platform — back-office sign-in surface (SaaS v1, phase 6.5).
//
// Dedicated login experience at /platform when the user is signed out.
// Visually distinct from the customer Merlin login so the boundary is
// obvious: dark Adaptiv-black background, no Merlin branding, "Adaptiv
// staff sign-in" framing. Auth still goes through the same Supabase
// pool — this is a UX layer, not a separate identity store.
//
// PlatformAccessDenied is the companion surface for users who land on
// /platform while signed-in but lacking platform_admin membership.

import React, { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { WORDMARK_URL } from './brand-assets.js';
import { login, resetPassword, logout as doLogout } from './auth.js';
import { navigateTo } from './use-route.js';
import { useT } from './i18n.js';

// ────── PlatformLoginPage
// Returned-to-path memory: if the user arrived at e.g.
// /platform/tenants/<id> while signed-out, after sign-in we navigate
// them back there instead of always to /platform/tenants.
export function PlatformLoginPage() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'reset'
  const [returnTo] = useState(() => readReturnPath());
  return (
    <PlatformAuthShell>
      {mode === 'signin' ? (
        <SignInForm onSwitchToReset={() => setMode('reset')} returnTo={returnTo} />
      ) : (
        <ResetForm onSwitchBack={() => setMode('signin')} />
      )}
    </PlatformAuthShell>
  );
}

function readReturnPath() {
  if (typeof window === 'undefined') return '/platform/tenants';
  const p = window.location.pathname || '';
  // Anything under /platform is a valid landing target after sign-in.
  // Default to /platform/tenants (the canonical entry).
  if (/^\/platform(\/|$)/.test(p)) return p === '/platform' ? '/platform/tenants' : p;
  return '/platform/tenants';
}

function SignInForm({ onSwitchToReset, returnTo }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErr('');
    setLoading(true);
    try {
      await login({ email, password });
      // The platform admin gate is enforced one level up in App.jsx —
      // on successful login the cached session updates, App re-renders,
      // and either the back-office shell or the AccessDenied page wins.
      // We just navigate to the deep-link path so the user lands where
      // they came from.
      navigateTo(returnTo);
    } catch (ex) {
      setErr(humanErr(ex.message, t));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Heading title={t('platform.auth.signin_title')} subtitle={t('platform.auth.signin_subtitle')} />

      <Field label={t('platform.auth.email')}>
        <Input
          type="email"
          autoComplete="email"
          required
          placeholder={t('platform.auth.email_ph')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label={t('platform.auth.password')}>
        <div style={{ position: 'relative' }}>
          <Input
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              background: 'transparent',
              color: 'rgba(255,255,255,0.55)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {showPw ? t('platform.auth.hide') : t('platform.auth.show')}
          </button>
        </div>
      </Field>

      <div style={{ marginTop: -6, textAlign: 'right' }}>
        <button
          type="button"
          onClick={onSwitchToReset}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: '#FF00B2',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('platform.auth.forgot')}
        </button>
      </div>

      {err && <ErrorBanner text={err} />}

      <PrimaryButton type="submit" loading={loading}>
        {t('platform.auth.signin_btn')} <Icon.chevR size={12} />
      </PrimaryButton>
      {/* No "Back to customer" link — the customer and platform surfaces
          have isolated Supabase sessions (see supabase.js storageKey).
          A cross-surface SPA nav would land on the wrong session keyspace. */}
    </form>
  );
}

function ResetForm({ onSwitchBack }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErr('');
    setLoading(true);
    try {
      await resetPassword({ email });
      setSent(true);
    } catch (ex) {
      setErr(humanErr(ex.message, t));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Heading
          title={t('platform.auth.check_email_title')}
          subtitle={t('platform.auth.check_email_body', { email })}
        />
        <BackLink onClick={onSwitchBack} label={t('platform.auth.back_to_signin')} />
      </div>
    );
  }
  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Heading title={t('platform.auth.reset_title')} subtitle={t('platform.auth.reset_subtitle')} />
      <Field label={t('platform.auth.email')}>
        <Input
          type="email"
          autoComplete="email"
          required
          placeholder={t('platform.auth.email_ph')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      {err && <ErrorBanner text={err} />}
      <PrimaryButton type="submit" loading={loading}>
        {t('platform.auth.send_reset')} <Icon.chevR size={12} />
      </PrimaryButton>
      <BackLink onClick={onSwitchBack} label={t('platform.auth.back_to_signin')} />
    </form>
  );
}

// ────── PlatformAccessDenied
// Signed in on the /platform surface but the user isn't a platform
// admin. With session isolation (see supabase.js), the only sensible
// action is to drop the bad session and let them try a different
// account. The customer-app session (if any) is in a separate storage
// key and is left untouched.
export function PlatformAccessDenied({ session }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <PlatformAuthShell>
      <Heading
        title={t('platform.auth.denied_title')}
        subtitle={t('platform.auth.denied_subtitle', { email: session?.email || '—' })}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
        <PrimaryButton
          onClick={async () => {
            setBusy(true);
            try {
              await doLogout();
              // Full page navigation so supabase.js re-bootstraps with the
              // platform storageKey — SPA navigateTo would have kept the
              // already-bound supabase client and could land the user on
              // the wrong surface after signOut.
              window.location.assign('/platform');
            } finally {
              setBusy(false);
            }
          }}
          loading={busy}
        >
          {t('platform.auth.denied_signout')} <Icon.chevR size={12} />
        </PrimaryButton>
      </div>
    </PlatformAuthShell>
  );
}

// ────── Shell + form primitives (dark theme — distinct from customer auth)

function PlatformAuthShell({ children }) {
  // Apply the dark background to <body> while this surface is mounted so
  // there's no flash-of-white during route transitions.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.background;
    document.body.style.background = '#0A0B14';
    return () => {
      document.body.style.background = prev;
    };
  }, []);
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100vw',
        background: 'radial-gradient(900px 600px at 70% 0%, rgba(255,0,178,0.15), transparent 60%), #0A0B14',
        color: '#fff',
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
          maxWidth: 420,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <BrandHeader />
        {children}
      </div>
      {/* Vertical Adaptiv wordmark anchored at the bottom-left of the
          viewport — same size + position as the Merlin sign-in page
          (Auth.jsx:LeftWordmark) but white-masked so it reads on the
          dark platform background. */}
      <div style={{ position: 'absolute', bottom: 48, left: 44, pointerEvents: 'none' }}>
        <LeftWordmarkWhite />
      </div>
      <Footnote />
    </div>
  );
}

// White-mask variant of Auth.jsx:LeftWordmark for the dark platform
// surface. Same dimensions (clamp values, rotation, mask asset) so the
// brand reads identically across customer and platform sign-in pages —
// only the fill changes (gradient → white).
function LeftWordmarkWhite() {
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
          background: '#fff',
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

function BrandHeader() {
  const t = useT();
  return (
    <div style={{ lineHeight: 1.15, marginBottom: 24 }}>
      <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.01 }}>{t('platform.auth.brand')}</div>
      <div
        style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.55)',
          fontWeight: 600,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
        }}
      >
        {t('platform.auth.brand_sub')}
      </div>
    </div>
  );
}

function Heading({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.01 }}>{title}</h2>
      {subtitle && (
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: 0.1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '11px 14px',
        background: 'rgba(255,255,255,0.06)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 10,
        fontSize: 13.5,
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border-color .12s, background .12s',
        ...(props.style || {}),
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#FF00B2';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
      }}
    />
  );
}

function PrimaryButton({ children, loading, ...rest }) {
  const t = useT();
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      style={{
        padding: '12px 16px',
        background: loading
          ? 'color-mix(in oklch, #FF00B2 60%, transparent)'
          : 'linear-gradient(135deg, #FF00B2, #20286D)',
        color: '#fff',
        border: 'none',
        borderRadius: 10,
        fontFamily: 'inherit',
        fontSize: 13.5,
        fontWeight: 700,
        cursor: loading ? 'wait' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        boxShadow: '0 8px 24px rgba(255,0,178,0.35)',
        transition: 'transform .12s',
      }}
      onMouseEnter={(e) => {
        if (!loading) e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
      }}
    >
      {loading ? t('platform.auth.working') : children}
    </button>
  );
}

function BackLink({ href, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick || (() => navigateTo(href || '/'))}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'center',
      }}
    >
      ← {label}
    </button>
  );
}

function ErrorBanner({ text }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(239,68,68,0.12)',
        border: '1px solid rgba(239,68,68,0.45)',
        color: '#fca5a5',
        fontSize: 12.5,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Icon.warn size={13} /> {text}
    </div>
  );
}

function Footnote() {
  const t = useT();
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 11,
        color: 'rgba(255,255,255,0.35)',
        pointerEvents: 'none',
      }}
    >
      {t('platform.auth.footnote')}
    </div>
  );
}

function humanErr(key, t) {
  const map = {
    'auth.err.badPassword': t('platform.auth.err.bad_password'),
    'auth.err.email': t('platform.auth.err.email'),
    'auth.err.pwLength': t('platform.auth.err.pw_length'),
    'auth.err.emailNotConfirmed': t('platform.auth.err.email_not_confirmed'),
    'auth.err.exists': t('platform.auth.err.exists'),
    'auth.err.noSession': t('platform.auth.err.no_session'),
    'auth.err.generic': t('platform.auth.err.generic'),
  };
  return map[key] || key || t('platform.auth.err.generic');
}
