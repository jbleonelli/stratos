// Pricing page — public unauthenticated route at /pricing.
//
// Phase A of the 3-plan rollout. Content (copy, prices, features,
// CTAs) is editable from /platform/pricing — see pricing-content.js.
// English/French copy lives side-by-side in the platform_settings
// row; this component picks the current locale via useLanguage().

import React, { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { navigateTo } from './use-route.js';
import { useLanguage } from './i18n.js';
import { usePricingContent } from './pricing-content.js';
import { checkPromoCode } from './promo-codes.js';

// Read `?promo=XYZ` from the URL on initial render. Returns the raw code
// (uppercased) or null. Doesn't subscribe to navigation changes — the
// pricing page is a top-level surface, query-param edits don't happen
// without a page reload.
function readPromoFromUrl() {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('promo');
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{1,40}$/.test(trimmed) ? trimmed : null;
}

// Append `&promo=XYZ` to internal route CTAs when a promo is active so
// the signup flow can stash it in sessionStorage (App.jsx) and Phase C
// can pass it through to Stripe Checkout. mailto: and external https:
// targets are passed through untouched.
function clickCta(target, promoCode) {
  if (!target) return;
  if (target.startsWith('mailto:') || target.startsWith('http://') || target.startsWith('https://')) {
    window.location.href = target;
    return;
  }
  let final = target;
  if (promoCode) {
    final += target.includes('?') ? '&' : '?';
    final += `promo=${encodeURIComponent(promoCode)}`;
  }
  navigateTo(final);
}

export function PricingPage() {
  const [audience, setAudience] = useState('real_estate');
  const lang = useLanguage();
  const { content, ready } = usePricingContent();

  // Read `?promo=` once on mount. If valid, render a pill above the
  // cards. The actual discount is applied at Stripe Checkout (Phase C);
  // this validation just prevents misleading pills for typos.
  const [promo, setPromo] = useState(null);
  useEffect(() => {
    const code = readPromoFromUrl();
    if (!code) return;
    let cancelled = false;
    checkPromoCode(code).then((result) => {
      if (cancelled) return;
      if (result?.valid) setPromo(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hero = content.hero?.[lang] || content.hero?.en || {};
  const toggle = content.toggle?.[lang] || content.toggle?.en || { real_estate: '', contractor: '' };
  const plans = content.plans?.[audience] || [];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #fafaff 0%, #f5f5f5 100%)',
        color: 'var(--text)',
      }}
    >
      <header
        style={{
          padding: '20px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 1200,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <button
          onClick={() => navigateTo('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 20,
            color: 'var(--text)',
            padding: 0,
          }}
        >
          Merlin
        </button>
        <button
          onClick={() => navigateTo('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text)',
            fontWeight: 500,
            fontSize: 14,
            padding: '8px 16px',
          }}
        >
          {lang === 'fr' ? 'Se connecter →' : 'Sign in →'}
        </button>
      </header>

      <div style={{ textAlign: 'center', padding: '64px 24px 32px' }}>
        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            margin: '0 0 16px',
            letterSpacing: -0.02,
            lineHeight: 1.05,
          }}
        >
          {hero.title}
        </h1>
        <p
          style={{
            fontSize: 20,
            color: 'var(--text-muted, #666)',
            maxWidth: 640,
            margin: '0 auto 40px',
            lineHeight: 1.5,
          }}
        >
          {hero.subtitle}
        </p>

        <div
          role="tablist"
          style={{
            display: 'inline-flex',
            background: 'rgba(0,0,0,0.04)',
            borderRadius: 999,
            padding: 4,
            gap: 4,
          }}
        >
          {[
            { id: 'real_estate', label: toggle.real_estate },
            { id: 'contractor', label: toggle.contractor },
          ].map((opt) => (
            <button
              key={opt.id}
              role="tab"
              aria-selected={audience === opt.id}
              onClick={() => setAudience(opt.id)}
              style={{
                padding: '10px 24px',
                borderRadius: 999,
                border: 'none',
                background: audience === opt.id ? 'var(--accent)' : 'transparent',
                color: audience === opt.id ? '#fff' : 'var(--text)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {promo && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '0 24px 16px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 999,
              background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
              border: '1px solid color-mix(in oklch, var(--accent) 35%, transparent)',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span aria-hidden>🎁</span>
            <span>
              {lang === 'fr' ? 'Code promo' : 'Promo code'}{' '}
              <code style={{ background: 'rgba(255,255,255,0.4)', padding: '1px 6px', borderRadius: 4 }}>
                {promo.code}
              </code>{' '}
              {lang === 'fr' ? 'appliqué' : 'applied'} — {promo.display}
            </span>
          </div>
        </div>
      )}

      <div
        style={{
          padding: '32px 24px 80px',
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          flexWrap: 'wrap',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          // While the platform_settings row hydrates, show a faint
          // skeleton state. Most paint cycles will hit a warm cache so
          // this almost never flashes.
          opacity: ready ? 1 : 0.6,
          transition: 'opacity 0.2s',
        }}
      >
        {plans.map((plan) => {
          const text = plan[lang] || plan.en || {};
          return (
            <PlanCard
              key={plan.id}
              featured={plan.featured}
              featuredBadge={lang === 'fr' ? 'Le plus populaire' : 'Most popular'}
              name={text.name}
              tagline={text.tagline}
              price={text.price}
              priceUnit={text.priceUnit}
              features={text.features || []}
              ctaLabel={text.ctaLabel}
              onCta={() => clickCta(plan.ctaTarget, promo?.code)}
            />
          );
        })}
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '0 24px 64px',
          color: 'var(--text-muted, #666)',
          fontSize: 14,
        }}
      >
        {hero.footerText}
        <a href={hero.footerLinkUrl} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          {hero.footerLinkLabel}
        </a>
      </div>
    </div>
  );
}

function PlanCard({ featured, featuredBadge, name, tagline, price, priceUnit, features, ctaLabel, onCta }) {
  return (
    <div
      style={{
        width: 340,
        maxWidth: '100%',
        padding: 32,
        borderRadius: 16,
        background: '#fff',
        border: featured ? '2px solid var(--accent)' : '1px solid rgba(0,0,0,0.08)',
        boxShadow: featured
          ? '0 12px 32px color-mix(in oklch, var(--accent) 18%, transparent)'
          : '0 1px 3px rgba(0,0,0,0.04)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {featured && (
        <div
          style={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--accent)',
            color: '#fff',
            padding: '4px 14px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {featuredBadge}
        </div>
      )}

      <h3 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>{name}</h3>
      <p
        style={{
          color: 'var(--text-muted, #666)',
          fontSize: 14,
          lineHeight: 1.5,
          margin: '0 0 28px',
          minHeight: 42,
        }}
      >
        {tagline}
      </p>

      <div style={{ marginBottom: 28 }}>
        <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -0.02 }}>{price}</span>
        <div
          style={{
            color: 'var(--text-muted, #666)',
            fontSize: 13,
            marginTop: 4,
          }}
        >
          {priceUnit}
        </div>
      </div>

      <button
        onClick={onCta}
        style={{
          padding: '12px 16px',
          borderRadius: 8,
          border: featured ? 'none' : '1px solid rgba(0,0,0,0.12)',
          background: featured ? 'var(--accent)' : '#fff',
          color: featured ? '#fff' : 'var(--text)',
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
          marginBottom: 24,
          width: '100%',
        }}
      >
        {ctaLabel}
      </button>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {features.map((feature, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 14,
              lineHeight: 1.45,
            }}
          >
            <Icon.check
              style={{
                width: 16,
                height: 16,
                color: 'var(--ok, #0a0)',
                flexShrink: 0,
                marginTop: 3,
              }}
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
