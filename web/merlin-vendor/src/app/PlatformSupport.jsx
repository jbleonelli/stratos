// Platform → Support → Guides
//
// Adaptiv-side surface for browsing the user-facing guides we ship to
// customers and contractors. The guide bodies are the markdown files
// under docs/guides/ — the same bundled source the in-app Docs section
// (docs-manifest.js) renders, so this surface stays in sync automatically
// when those defaults are edited.
//
// "Open guide" routes to /print/guide/<slug>, a chrome-less print-
// friendly view. From there the reader either reads on-screen or hits
// the browser's Print dialog (or the in-page "Print" button) to
// produce a PDF. No server-side PDF generation — the browser's native
// pipeline is the cheapest and most pixel-faithful path.
//
// Adding a new guide:
//   1. Drop the .md file in docs/guides/
//   2. Add an entry to GUIDES below (slug + meta)
//   3. Add a `?raw` import in PrintGuidePage.jsx
//   4. Add the page to docs-manifest.js if you want it to appear in the
//      in-app Docs section too (page id == slug makes cross-doc links resolve).

import React from 'react';
import { Icon } from './icons.jsx';
import { Card, Pill } from './primitives.jsx';
import { useT } from './i18n.js';

// Single source of truth for which guides ship in /platform/support/guides
// + their metadata. Order = display order on the page.
const GUIDES = [
  {
    slug: 'getting-started',
    icon: 'sparkle',
    titleKey: 'platform.support.guide.getting_started.title',
    summaryKey: 'platform.support.guide.getting_started.summary',
    audienceKey: 'platform.support.audience.all_users',
  },
  {
    slug: 'user-guide',
    icon: 'people',
    titleKey: 'platform.support.guide.user_guide.title',
    summaryKey: 'platform.support.guide.user_guide.summary',
    audienceKey: 'platform.support.audience.adaptiv_team',
  },
  {
    slug: 'platform-admin',
    icon: 'cog',
    titleKey: 'platform.support.guide.platform_admin.title',
    summaryKey: 'platform.support.guide.platform_admin.summary',
    audienceKey: 'platform.support.audience.adaptiv_team',
  },
  {
    slug: 'organization-setup',
    icon: 'building',
    titleKey: 'platform.support.guide.organization_setup.title',
    summaryKey: 'platform.support.guide.organization_setup.summary',
    audienceKey: 'platform.support.audience.fm_admin',
  },
  {
    slug: 'schedules-setup',
    icon: 'sla',
    titleKey: 'platform.support.guide.schedules_setup.title',
    summaryKey: 'platform.support.guide.schedules_setup.summary',
    audienceKey: 'platform.support.audience.fm_admin',
  },
  {
    slug: 'contractor',
    icon: 'shield',
    titleKey: 'platform.support.guide.contractor.title',
    summaryKey: 'platform.support.guide.contractor.summary',
    audienceKey: 'platform.support.audience.contractor_admin',
  },
  {
    slug: 'agents',
    icon: 'bolt',
    titleKey: 'platform.support.guide.agents.title',
    summaryKey: 'platform.support.guide.agents.summary',
    audienceKey: 'platform.support.audience.all_users',
  },
  {
    slug: 'agents-demo-playbook',
    icon: 'play',
    titleKey: 'platform.support.guide.agents_demo.title',
    summaryKey: 'platform.support.guide.agents_demo.summary',
    audienceKey: 'platform.support.audience.adaptiv_team',
  },
];

// Demo docs — one per seeded demo workspace. User-facing (not developer-
// facing): what the demo represents, who to log in as, what to try.
// EN + FR shipped at parity so the downloaded PDF is in the reader's
// language out of the box.
const DEMOS = [
  {
    slug: 'demo-meridian-hq',
    icon: 'building',
    titleKey: 'platform.support.demo.meridian_hq.title',
    summaryKey: 'platform.support.demo.meridian_hq.summary',
    audienceKey: 'platform.support.audience.adaptiv_team',
  },
  {
    slug: 'demo-meridian-distribution-east',
    icon: 'cart',
    titleKey: 'platform.support.demo.meridian_dist_east.title',
    summaryKey: 'platform.support.demo.meridian_dist_east.summary',
    audienceKey: 'platform.support.audience.adaptiv_team',
  },
  {
    slug: 'demo-meridian-health-clinic',
    icon: 'shield',
    titleKey: 'platform.support.demo.meridian_health_clinic.title',
    summaryKey: 'platform.support.demo.meridian_health_clinic.summary',
    audienceKey: 'platform.support.audience.adaptiv_team',
  },
  {
    slug: 'demo-first-empire-bank',
    icon: 'map',
    titleKey: 'platform.support.demo.first_empire_bank.title',
    summaryKey: 'platform.support.demo.first_empire_bank.summary',
    audienceKey: 'platform.support.audience.adaptiv_team',
  },
  {
    slug: 'demo-international-monetary-fund',
    icon: 'panel',
    titleKey: 'platform.support.demo.imf.title',
    summaryKey: 'platform.support.demo.imf.summary',
    audienceKey: 'platform.support.audience.adaptiv_team',
  },
  {
    slug: 'demo-contractor',
    icon: 'people',
    titleKey: 'platform.support.demo.contractor.title',
    summaryKey: 'platform.support.demo.contractor.summary',
    audienceKey: 'platform.support.audience.adaptiv_team',
  },
];

export function PlatformSupportGuidesPage() {
  const t = useT();
  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon.help size={16} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>
            {t('platform.support.guides.title')}
          </h1>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: 0, lineHeight: 1.55, maxWidth: 760 }}>
          {t('platform.support.guides.subtitle')}
        </p>
      </div>

      {/* Convention card */}
      <Card style={{ padding: 14, display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--surface-2)' }}>
        <Icon.sparkle size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{t('platform.support.guides.howto_title')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-soft)', lineHeight: 1.55 }}>
            {t('platform.support.guides.howto_body')}
          </div>
        </div>
      </Card>

      {/* Guide grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 14,
        }}
      >
        {GUIDES.map((g) => (
          <GuideCard key={g.slug} guide={g} t={t} />
        ))}
      </div>

      {/* Demos section — separate header so it reads as a distinct
          family of docs (one per seeded demo workspace, EN + FR). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon.play size={14} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>
            {t('platform.support.demos.title')}
          </h2>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: 0, lineHeight: 1.55, maxWidth: 760 }}>
          {t('platform.support.demos.subtitle')}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 14,
        }}
      >
        {DEMOS.map((d) => (
          <GuideCard key={d.slug} guide={d} t={t} />
        ))}
      </div>
    </div>
  );
}

function GuideCard({ guide, t }) {
  const IconC = Icon[guide.icon] || Icon.help;
  const printHref = `/print/guide/${guide.slug}`;
  return (
    <Card
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 200,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconC size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>{t(guide.titleKey)}</div>
          <div style={{ marginTop: 4 }}>
            <Pill tone="neutral">{t(guide.audienceKey)}</Pill>
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5, flex: 1 }}>
        {t(guide.summaryKey)}
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <a
          href={printHref}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 700,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            textDecoration: 'none',
            fontFamily: 'inherit',
            cursor: 'pointer',
            flex: 1,
          }}
        >
          {t('platform.support.guides.open')}
          <Icon.chevR size={11} />
        </a>
        {/* EN + FR PDF download buttons. The print route accepts ?lang=
            to force a language regardless of the reader's UI locale, and
            ?print=1 to auto-fire the browser's Save-as-PDF dialog. */}
        <a
          href={`${printHref}?lang=en&print=1`}
          target="_blank"
          rel="noreferrer"
          title={t('platform.support.guides.download_en_title')}
          style={pdfPillStyle}
        >
          <Icon.paper size={11} /> EN
        </a>
        <a
          href={`${printHref}?lang=fr&print=1`}
          target="_blank"
          rel="noreferrer"
          title={t('platform.support.guides.download_fr_title')}
          style={pdfPillStyle}
        >
          <Icon.paper size={11} /> FR
        </a>
      </div>
    </Card>
  );
}

const pdfPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  padding: '8px 10px',
  fontSize: 11.5,
  fontWeight: 700,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  textDecoration: 'none',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
