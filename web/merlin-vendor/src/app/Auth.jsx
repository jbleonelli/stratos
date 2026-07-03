// Auth shell + Login + Signup.
// Mock auth — wired to src/app/auth.js.
import React, { useState } from 'react';
import { Icon } from './icons.jsx';
import { WORDMARK_URL } from './brand-assets.js';
import { signup, login, resetPassword, commitNewPassword, consumeRecoveryReturn } from './auth.js';
import { supabase } from './supabase.js';
import { useT, useLanguage, setLanguage } from './i18n.js';
import { useFeatureFlags } from './feature-flags.js';
import { isMobileSurface } from './mobile-surface.js';

// ────── Shared shell

function AuthShell({ variant = 'conservative', children, side }) {
  const isBold = variant === 'bold';

  // Merlin Mobile (mobile.adaptiv.systems / ?mobile=1): the desktop two-panel
  // marketing layout is wrong on a phone. Render a single focused column — just
  // the form, centered, big touch targets, language picker at the foot. Drops
  // the BrandSide panel and the giant Adaptiv wordmark. Covers login / signup /
  // reset / recovery since they all go through AuthShell.
  if (isMobileSurface()) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: '100%',
            maxWidth: 440,
            margin: '0 auto',
            padding: '28px 22px',
          }}
        >
          {children}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 calc(18px + env(safe-area-inset-bottom))',
          }}
        >
          <LanguagePicker />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        // 100dvh (not 100vh): on iOS Safari 100vh is the *large* viewport
        // (counts the area behind the collapsible toolbar + home indicator),
        // so a 100vh column runs taller than the visible area and its bottom
        // gets clipped on iPad. dvh tracks the actually-visible height. The
        // mobile branch above already does this; this is the desktop parity fix.
        minHeight: '100dvh',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        background: isBold ? 'transparent' : 'var(--bg)',
      }}
    >
      {/* Left — form. The form is vertically centered in the full
          column height (matches the original design). The vertical
          Adaptiv wordmark is absolutely positioned at the bottom-left
          so it doesn't shrink the form's centering space. Same CSS-
          mask + brand-gradient treatment as the icon-bar wordmark
          (Sidebar.jsx ~line 180). */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 56px',
          minHeight: '100dvh', // match the grid (see note above) so the form column + its bottom-anchored wordmark aren't clipped on iPad Safari
          background: 'color-mix(in oklch, var(--surface) 70%, transparent)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            maxWidth: 420,
            width: '100%',
            margin: '0 auto',
            padding: '48px 0',
          }}
        >
          {children}
        </div>

        <div
          style={{
            fontSize: 11.5,
            color: 'var(--text-dim)',
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <LanguagePicker />
        </div>

        {/* Wordmark anchored to the bottom-left of the column without
            displacing layout — form stays vertically centered in the
            full column height as in the original design. */}
        <div style={{ position: 'absolute', bottom: 48, left: 44, pointerEvents: 'none' }}>
          <LeftWordmark />
        </div>
      </div>

      {/* Right — visual side */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          background:
            'radial-gradient(700px 500px at 30% 20%, color-mix(in oklch, var(--accent) 22%, transparent), transparent 60%), radial-gradient(800px 600px at 80% 100%, color-mix(in oklch, #20286D 55%, transparent), transparent 55%), #05070d',
          color: '#eef1f8',
        }}
      >
        {side}
      </div>
    </div>
  );
}

// Vertical Adaptiv wordmark anchored at the bottom-left of the form
// pane. Same mask + gradient pattern as the icon-bar wordmark
// (Sidebar.jsx), sized larger here so it reads as a real brand
// element. Outer wrapper carries POST-rotation dimensions so the
// rotated mask doesn't shift its siblings; inner uses absolute
// centering so nothing can squash its declared unrotated size.
function LeftWordmark() {
  // Sizing scales with viewport height so the wordmark stays
  // proportional to the page. Clamp keeps it readable on short
  // laptops and from blowing out on tall monitors. Source PNG ratio
  // is 1360×409 ≈ 3.32:1 — width tracks height by /3.32.
  const VISUAL_H = 'clamp(200px, 32vh, 320px)';
  const VISUAL_W = 'clamp(60px, 9.6vh, 96px)';
  return (
    <div
      style={{
        position: 'relative',
        width: VISUAL_W,
        height: VISUAL_H,
        flexShrink: 0,
        marginLeft: -12, // small bleed so the wordmark hangs flush with the column edge
      }}
    >
      <div
        role="img"
        aria-label="Adaptiv"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          // unrotated: width = post-rotation visual height; height = post-rotation visual width
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

// ────── Language picker (footer)
//
// Native-name labels by convention — a French speaker landing on the
// English UI needs to see "Français" to know where to switch, not
// "French". setLanguage() persists to localStorage; the next sign-in
// preference sync (in App.jsx) overrides it once the user's profile
// loads, so anonymous visitors get a sticky choice and signed-in users
// keep their account preference as the source of truth.
function LanguagePicker() {
  const lang = useLanguage();
  // ES/PT only on the worker surface — desktop sign-in stays EN/FR/DE (their
  // DICT coverage is the sign-in chrome only; see es/pt-translations.js).
  const langs = [
    { id: 'en', label: 'English' },
    { id: 'fr', label: 'Français' },
    { id: 'de', label: 'Deutsch' },
    ...(isMobileSurface()
      ? [
          { id: 'es', label: 'Español' },
          { id: 'pt', label: 'Português' },
        ]
      : []),
  ];
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <Icon.chat size={11} style={{ color: 'var(--text-dim)' }} />
      <select
        value={lang}
        onChange={(e) => setLanguage(e.target.value)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 22px 3px 8px',
          fontFamily: 'inherit',
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--text-soft)',
          cursor: 'pointer',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 6px center',
        }}
      >
        {langs.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ────── Decorative right-hand panel

function BrandSide({ title, subtitle, bullets }) {
  const t = useT();
  return (
    <div style={{ maxWidth: 460, position: 'relative', zIndex: 2 }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          color: '#eef1f8',
          marginBottom: 20,
        }}
      >
        <Icon.sparkle size={11} />
        {t('auth.badge')}
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: 38,
          lineHeight: 1.1,
          fontWeight: 900,
          letterSpacing: -0.02,
          color: '#fff',
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: '16px 0 28px',
          fontSize: 15,
          lineHeight: 1.55,
          color: 'rgba(238, 241, 248, 0.75)',
        }}
      >
        {subtitle}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {bullets.map((b, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 13.5,
              color: 'rgba(238, 241, 248, 0.85)',
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'color-mix(in oklch, var(--accent) 30%, transparent)',
                color: '#fff',
                marginTop: 1,
              }}
            >
              <Icon.check size={11} />
            </span>
            {b}
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: 36,
          fontFamily: 'var(--mono)',
          fontSize: 26,
          fontWeight: 800,
          color: 'var(--accent)',
          letterSpacing: 0.4,
          lineHeight: 1,
        }}
      >
        #askmerlin
      </div>
    </div>
  );
}

// ────── Inputs

function Field({ label, children, hint, error }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)' }}>{label}</span>
      {children}
      {hint && !error && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: 'var(--risk)' }}>{error}</span>}
    </label>
  );
}

function Input({ icon, ...props }) {
  const IconC = icon ? Icon[icon] : null;
  // On the mobile surface use a ≥16px font so iOS Safari doesn't zoom on focus,
  // and a bigger touch target.
  const mobile = isMobileSurface();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: mobile ? '13px 14px' : '10px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 10,
        transition: 'border-color .12s, box-shadow .12s',
      }}
      onFocusCapture={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-line)';
        e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-soft)';
      }}
      onBlurCapture={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-strong)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {IconC && <IconC size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />}
      <input
        {...props}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'inherit',
          fontSize: mobile ? 16 : 13.5,
          color: 'var(--text)',
          padding: 0,
          minWidth: 0,
          ...(props.style || {}),
        }}
      />
    </div>
  );
}

function PrimaryButton({ children, loading, ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      style={{
        padding: '12px 16px',
        background: 'var(--accent)',
        color: '#fff',
        border: 'none',
        borderRadius: 10,
        fontFamily: 'inherit',
        fontSize: 13.5,
        fontWeight: 700,
        letterSpacing: 0.1,
        cursor: loading || props.disabled ? 'not-allowed' : 'pointer',
        opacity: loading || props.disabled ? 0.6 : 1,
        boxShadow: '0 6px 20px color-mix(in oklch, var(--accent) 35%, transparent)',
        transition: 'transform .08s, box-shadow .12s, opacity .12s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
      onMouseDown={(e) => {
        if (!loading && !props.disabled) e.currentTarget.style.transform = 'translateY(1px)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {loading ? (
        <span className="merlin-thinking">
          <span />
          <span />
          <span />
        </span>
      ) : (
        children
      )}
    </button>
  );
}

// ────── Error helper — translate keyed errors via useT

function useErr() {
  const t = useT();
  return (msg) => {
    if (!msg) return '';
    if (msg.startsWith('auth.err.')) return t(msg);
    return msg;
  };
}

// ────── Login

export function LoginPage({ tweaks, onAuthed, onSwitchToSignup, onSwitchToReset, hasPendingInvite }) {
  const t = useT();
  // Pre-auth read of platform feature flags (migration 102 admits an
  // anon SELECT on the feature_flags row of platform_settings). When
  // signupEnabled is OFF, hide the OR divider + "Create a new account"
  // CTA so the page reads as login-only. Adaptiv flips this from
  // /platform/experimental.
  const flags = useFeatureFlags();
  const translateErr = useErr();
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
      onAuthed?.();
    } catch (ex) {
      setErr(ex.message || 'auth.err.generic');
      setLoading(false);
    }
  };

  return (
    <AuthShell
      variant={tweaks?.variant}
      side={
        <BrandSide
          title={t('auth.login.hero.title')}
          subtitle={t('auth.login.hero.subtitle')}
          bullets={[t('auth.hero.bullet.login1'), t('auth.hero.bullet.login2'), t('auth.hero.bullet.login3')]}
        />
      }
    >
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.01, color: 'var(--text)' }}>
          {t('auth.login.title')}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-dim)' }}>{t('auth.login.subtitle')}</p>
        {hasPendingInvite && <InviteCallout />}
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={t('auth.field.email')}>
          <Input
            icon="chat"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label={t('auth.field.password')}>
          <div style={{ position: 'relative' }}>
            <Input
              icon="shield"
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
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                background: 'transparent',
                color: 'var(--text-dim)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {showPw ? t('auth.hide') : t('auth.show')}
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
              color: 'var(--accent)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('auth.login.forgot_link')}
          </button>
        </div>

        {err && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
              color: 'var(--risk)',
              fontSize: 12.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon.warn size={13} /> {translateErr(err)}
          </div>
        )}

        <PrimaryButton type="submit" loading={loading}>
          {t('auth.login.submit')} <Icon.chevR size={12} />
        </PrimaryButton>

        {flags.signupEnabled && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{t('auth.or')}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <button
              type="button"
              onClick={onSwitchToSignup}
              style={{
                padding: '11px 16px',
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border-strong)',
                borderRadius: 10,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background .12s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface)';
              }}
            >
              {t('auth.login.switch')}
            </button>
          </>
        )}
      </form>
    </AuthShell>
  );
}

// ────── Signup

export function SignupPage({ tweaks, onAuthed, onSwitchToLogin, hasPendingInvite }) {
  const t = useT();
  const translateErr = useErr();
  const [form, setForm] = useState({ name: '', email: '', company: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  // Defensive gate: even though LoginPage hides the link to here, a
  // bookmarked or shared signup URL can still reach this component.
  // When Adaptiv has signup disabled platform-wide, send the visitor
  // back to /login with a brief notice.
  const flags = useFeatureFlags();
  if (!flags.signupEnabled) {
    return (
      <AuthShell tweaks={tweaks}>
        <h1 style={{ fontSize: 22, margin: 0, letterSpacing: -0.02 }}>{t('auth.signup.disabled_title')}</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.55, margin: '8px 0 16px' }}>
          {t('auth.signup.disabled_body')}
        </p>
        <button
          type="button"
          onClick={onSwitchToLogin}
          style={{
            padding: '11px 16px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('auth.signup.disabled_back')}
        </button>
      </AuthShell>
    );
  }

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErr('');
    setLoading(true);
    try {
      // Phase B's signup() reads sessionStorage.merlin-intended-plan
      // + audience and writes them onto the new org via
      // self_serve_create_org. After signup lands, peek at the plan
      // they came in for: if Pro, redirect to Stripe Subscription
      // Checkout (Phase C). Starter / Enterprise (or no hint) →
      // normal onAuthed() flow into Briefing.
      let intendedPlan = null;
      let intendedPromo = null;
      try {
        intendedPlan = sessionStorage.getItem('merlin-intended-plan');
        intendedPromo = sessionStorage.getItem('merlin-intended-promo');
      } catch {}
      await signup(form);
      if (intendedPlan === 'pro') {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            const r = await fetch('/api/checkout/create-subscription', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ promo_code: intendedPromo || undefined }),
            });
            const payload = await r.json().catch(() => ({}));
            if (r.ok && payload.url) {
              // Promo consumed at this point.
              try {
                sessionStorage.removeItem('merlin-intended-promo');
              } catch {}
              window.location.href = payload.url;
              return; // Don't call onAuthed — we're navigating away.
            }
            // mode:'demo' or any non-OK response → fall through to
            // onAuthed(). The user lands in the app on the Pro plan
            // but with no active subscription; they can subscribe
            // later from Settings.
            // eslint-disable-next-line no-console
            console.warn('[signup] subscription Checkout unavailable:', payload);
          }
        } catch (chErr) {
          // eslint-disable-next-line no-console
          console.warn('[signup] Checkout create failed:', chErr?.message || chErr);
          // Fall through to onAuthed — don't block the user.
        }
      }
      onAuthed?.();
    } catch (ex) {
      setErr(ex.message || 'auth.err.generic');
      setLoading(false);
    }
  };

  const pwStrength = strengthOf(form.password, t);

  return (
    <AuthShell
      variant={tweaks?.variant}
      side={
        <BrandSide
          title={t('auth.signup.hero.title')}
          subtitle={t('auth.signup.hero.subtitle')}
          bullets={[t('auth.hero.bullet.signup1'), t('auth.hero.bullet.signup2'), t('auth.hero.bullet.signup3')]}
        />
      }
    >
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.01, color: 'var(--text)' }}>
          {t('auth.signup.title')}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-dim)' }}>{t('auth.signup.subtitle')}</p>
        {hasPendingInvite && <InviteCallout />}
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={t('auth.field.name')}>
          <Input
            icon="people"
            type="text"
            autoComplete="name"
            required
            placeholder={t('auth.placeholder.name')}
            value={form.name}
            onChange={update('name')}
          />
        </Field>

        <Field label={t('auth.field.email_work')}>
          <Input
            icon="chat"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            value={form.email}
            onChange={update('email')}
          />
        </Field>

        <Field label={t('auth.field.company')} hint={t('auth.field.company.hint')}>
          <Input
            icon="building"
            type="text"
            autoComplete="organization"
            placeholder={t('auth.placeholder.company')}
            value={form.company}
            onChange={update('company')}
          />
        </Field>

        <Field label={t('auth.field.password')} hint={t('auth.field.password.hint')}>
          <div style={{ position: 'relative' }}>
            <Input
              icon="shield"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder={t('auth.field.password.placeholder')}
              value={form.password}
              onChange={update('password')}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                background: 'transparent',
                color: 'var(--text-dim)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {showPw ? t('auth.hide') : t('auth.show')}
            </button>
          </div>
          {form.password && <StrengthBar level={pwStrength.level} label={pwStrength.label} />}
        </Field>

        {err && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
              color: 'var(--risk)',
              fontSize: 12.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon.warn size={13} /> {translateErr(err)}
          </div>
        )}

        <PrimaryButton type="submit" loading={loading}>
          {t('auth.signup.submit')} <Icon.chevR size={12} />
        </PrimaryButton>

        <p
          style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}
        >
          {t('auth.signup.terms')}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 4,
            fontSize: 12.5,
          }}
        >
          <span style={{ color: 'var(--text-dim)' }}>{t('auth.signup.have')}</span>
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'var(--accent)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('auth.signup.switch')}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

// ────── Password strength

function strengthOf(pw, t) {
  if (!pw) return { level: 0, label: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const keys = [
    'auth.pw.tooShort',
    'auth.pw.weak',
    'auth.pw.okay',
    'auth.pw.good',
    'auth.pw.strong',
    'auth.pw.veryStrong',
  ];
  const lvl = Math.min(score, 5);
  return { level: lvl, label: t(keys[lvl]) };
}

function StrengthBar({ level, label }) {
  const colors = ['var(--risk)', 'var(--risk)', 'var(--warn)', 'var(--warn)', 'var(--ok)', 'var(--ok)'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <div style={{ flex: 1, display: 'flex', gap: 3 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i < level ? colors[level] : 'var(--border)',
              transition: 'background .15s',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: colors[level], minWidth: 72, textAlign: 'right' }}>
        {label}
      </span>
    </div>
  );
}

// ────── Reset password (send email)

export function ResetPasswordPage({ tweaks, onSwitchToLogin }) {
  const t = useT();
  const translateErr = useErr();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErr('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('auth.err.email');
    setLoading(true);
    try {
      await resetPassword({ email });
      setSent(true);
    } catch (ex) {
      setErr(ex.message || 'auth.err.generic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      variant={tweaks?.variant}
      side={
        <BrandSide
          title={t('auth.reset.title')}
          subtitle={t('auth.reset.subtitle')}
          bullets={[t('auth.reset.bullet.1'), t('auth.reset.bullet.2'), t('auth.reset.bullet.3')]}
        />
      }
    >
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.01, color: 'var(--text)' }}>
          {sent ? t('auth.reset.check_inbox') : t('auth.reset.forgot')}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-dim)' }}>
          {sent ? t('auth.reset.sent_p', { email }) : t('auth.reset.enter_p')}
        </p>
      </div>

      {!sent && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label={t('auth.field.email')}>
            <Input
              icon="chat"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {err && <ErrBanner msg={translateErr(err)} />}
          <PrimaryButton type="submit" loading={loading}>
            {t('auth.reset.send_link')} <Icon.chevR size={12} />
          </PrimaryButton>
          <BackLink onClick={onSwitchToLogin} label={t('auth.reset.back_to_signin')} />
        </form>
      )}

      {sent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 10,
              background: 'color-mix(in oklch, var(--ok) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--ok) 30%, transparent)',
              color: 'var(--ok)',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon.check size={14} /> {t('auth.reset.email_sent', { email })}
          </div>
          <PrimaryButton type="button" onClick={onSwitchToLogin}>
            {t('auth.reset.back_to_signin')} <Icon.chevR size={12} />
          </PrimaryButton>
          <BackLink
            onClick={() => {
              setSent(false);
              setEmail('');
            }}
            label={t('auth.reset.use_different_email')}
          />
        </div>
      )}
    </AuthShell>
  );
}

// ────── Password recovery landing (user arrived via email link)

export function PasswordRecoveryPage({ tweaks, onDone }) {
  const t = useT();
  const translateErr = useErr();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // When the reset was triggered from /platform, redirect there after
  // success instead of just back to the customer login (auth.js stashes
  // the flag pre-submit). consumeRecoveryReturn() reads + clears it.
  const [returnTo, setReturnTo] = useState(null);
  const strength = strengthOf(password, t);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErr('');
    if (!password || password.length < 8) return setErr('auth.err.pwLength');
    if (password !== confirm) return setErr('auth.err.pwMismatch');
    setLoading(true);
    try {
      await commitNewPassword(password);
      setReturnTo(consumeRecoveryReturn());
      setDone(true);
    } catch (ex) {
      setErr(ex.message || 'auth.err.generic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      variant={tweaks?.variant}
      side={
        <BrandSide
          title={t('auth.recovery.title')}
          subtitle={t('auth.recovery.subtitle')}
          bullets={[t('auth.recovery.bullet.1'), t('auth.recovery.bullet.2'), t('auth.recovery.bullet.3')]}
        />
      }
    >
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.01, color: 'var(--text)' }}>
          {done ? t('auth.recovery.updated_h2') : t('auth.recovery.choose_h2')}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-dim)' }}>
          {done ? t('auth.recovery.updated_p') : t('auth.recovery.choose_p')}
        </p>
      </div>

      {!done && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label={t('auth.recovery.new_password')}>
            <div style={{ position: 'relative' }}>
              <Input
                icon="shield"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
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
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {showPw ? t('auth.hide') : t('auth.show')}
              </button>
            </div>
            {password && <StrengthBar level={strength.level} label={strength.label} />}
          </Field>
          <Field label={t('auth.recovery.confirm_password')}>
            <Input
              icon="shield"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              required
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          {err && <ErrBanner msg={translateErr(err)} />}
          <PrimaryButton type="submit" loading={loading}>
            {t('auth.recovery.update_btn')} <Icon.chevR size={12} />
          </PrimaryButton>
        </form>
      )}

      {done && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 10,
              background: 'color-mix(in oklch, var(--ok) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--ok) 30%, transparent)',
              color: 'var(--ok)',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon.check size={14} /> {t('auth.recovery.updated_short')}
          </div>
          {returnTo === 'platform' ? (
            <>
              {/* Full-page reload to /platform so the platform-side Supabase
                  client (different storage key) takes over cleanly — same
                  rule as every other cross-surface nav (session-isolation). */}
              <PrimaryButton
                type="button"
                onClick={() => {
                  window.location.assign('/platform');
                }}
              >
                {t('auth.recovery.continue_platform')} <Icon.chevR size={12} />
              </PrimaryButton>
              <BackLink onClick={onDone} label={t('auth.recovery.continue_customer')} />
            </>
          ) : (
            <PrimaryButton type="button" onClick={onDone}>
              {t('auth.login.submit')} <Icon.chevR size={12} />
            </PrimaryButton>
          )}
        </div>
      )}
    </AuthShell>
  );
}

function ErrBanner({ msg }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
        border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
        color: 'var(--risk)',
        fontSize: 12.5,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Icon.warn size={13} /> {msg}
    </div>
  );
}

function BackLink({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '8px 0',
        color: 'var(--text-dim)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// Phase 11d: shown above login/signup forms when the visitor arrived
// via a ?invite=<token> link. The token is already stashed in
// sessionStorage; this just tells them why they're here.
function InviteCallout() {
  const t = useT();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 16,
        padding: '10px 14px',
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent-line)',
        borderRadius: 10,
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--accent)',
      }}
    >
      <Icon.sparkle size={13} />
      <span>{t('auth.invite.callout')}</span>
    </div>
  );
}
