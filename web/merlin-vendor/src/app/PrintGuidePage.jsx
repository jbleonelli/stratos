// PrintGuidePage — chrome-less, print-friendly view of a single user
// guide. Reachable at /print/guide/<slug>. Reusable for either reading
// on-screen or producing a PDF via the browser's native Print dialog.
//
// When the URL carries ?print=1, the page fires `window.print()`
// automatically once content lands — saves a click for the "Save as
// PDF" path that PlatformSupport offers.
//
// Markdown bodies come from the same `?raw` Vite import pattern the
// in-app Docs section (docs-manifest.js) uses. Adding a new guide: drop the .md file in
// docs/guides/, add a `?raw` import + GUIDE_SOURCES entry below, then
// add a GUIDES entry in PlatformSupport.jsx for it to appear in the
// listing.
//
// Screenshots: when real images land under public/screenshots/<slug>/,
// reference them in the markdown with standard `![alt](/screenshots/
// <slug>/<file>.png)` syntax. Until they exist, the print template
// renders broken-image icons — that's intentional friction so missing
// art is visible. Convention is in public/screenshots/README.md.

import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLanguage } from './i18n.js';

// One ?raw import per guide we support. Slug → markdown source.
// EN sources (the originals — single source of truth for content). The
// existing 8 admin/setup guides ship EN-only today; the 6 demo guides
// added 2026-05-13 carry a parallel `.fr.md` for native FR delivery.
import gettingStartedSrc from '../../docs/guides/getting-started.md?raw';
import userGuideSrc from '../../docs/guides/user-guide.md?raw';
import platformAdminSrc from '../../docs/guides/platform-admin.md?raw';
import organizationSetupSrc from '../../docs/guides/organization-setup.md?raw';
import schedulesSetupSrc from '../../docs/guides/schedules-setup.md?raw';
import contractorSrc from '../../docs/guides/contractor.md?raw';
import agentsSrc from '../../docs/guides/agents.md?raw';
import agentsDemoSrc from '../../docs/guides/agents-demo-playbook.md?raw';

// Demo guides — one user-facing doc per seeded demo workspace. Both
// EN and FR ship at parity so the doc downloaded as a PDF reads in the
// reader's language.
import demoMeridianHqEn from '../../docs/guides/demos/meridian-hq.md?raw';
import demoMeridianHqFr from '../../docs/guides/demos/meridian-hq.fr.md?raw';
import demoMdeEn from '../../docs/guides/demos/meridian-distribution-east.md?raw';
import demoMdeFr from '../../docs/guides/demos/meridian-distribution-east.fr.md?raw';
import demoMhcEn from '../../docs/guides/demos/meridian-health-clinic.md?raw';
import demoMhcFr from '../../docs/guides/demos/meridian-health-clinic.fr.md?raw';
import demoFebEn from '../../docs/guides/demos/first-empire-bank.md?raw';
import demoFebFr from '../../docs/guides/demos/first-empire-bank.fr.md?raw';
import demoImfEn from '../../docs/guides/demos/international-monetary-fund.md?raw';
import demoImfFr from '../../docs/guides/demos/international-monetary-fund.fr.md?raw';
import demoContractorEn from '../../docs/guides/demos/contractor.md?raw';
import demoContractorFr from '../../docs/guides/demos/contractor.fr.md?raw';

// Each entry holds an EN body + optional FR body + an EN/FR title pair.
// `useLanguage()` picks the right body at render time; FR falls through
// to EN when the doc hasn't been translated yet.
const GUIDE_SOURCES = {
  'getting-started': {
    en: gettingStartedSrc,
    title: { en: 'Getting started with Merlin', fr: 'Démarrer avec Merlin' },
  },
  'user-guide': { en: userGuideSrc, title: { en: 'Merlin user guide', fr: 'Guide utilisateur Merlin' } },
  'platform-admin': {
    en: platformAdminSrc,
    title: { en: 'Merlin for Adaptiv platform admins', fr: 'Merlin pour les admins plateforme Adaptiv' },
  },
  'organization-setup': {
    en: organizationSetupSrc,
    title: { en: 'Setting up your organization', fr: 'Configurer votre organisation' },
  },
  'schedules-setup': {
    en: schedulesSetupSrc,
    title: { en: 'Running services in a building', fr: 'Exploiter des services dans un bâtiment' },
  },
  contractor: { en: contractorSrc, title: { en: 'Merlin for contractors', fr: 'Merlin pour les prestataires' } },
  agents: { en: agentsSrc, title: { en: 'Working with Merlin agents', fr: 'Travailler avec les agents Merlin' } },
  'agents-demo-playbook': {
    en: agentsDemoSrc,
    title: { en: 'Agents demo playbook', fr: 'Playbook de démo des agents' },
  },
  // Demo guides — full EN + FR parity.
  'demo-meridian-hq': {
    en: demoMeridianHqEn,
    fr: demoMeridianHqFr,
    title: { en: 'Demo · Meridian HQ', fr: 'Démo · Meridian HQ' },
  },
  'demo-meridian-distribution-east': {
    en: demoMdeEn,
    fr: demoMdeFr,
    title: { en: 'Demo · Meridian Distribution Center East', fr: 'Démo · Meridian Distribution Center East' },
  },
  'demo-meridian-health-clinic': {
    en: demoMhcEn,
    fr: demoMhcFr,
    title: { en: 'Demo · Meridian Health Clinic', fr: 'Démo · Meridian Health Clinic' },
  },
  'demo-first-empire-bank': {
    en: demoFebEn,
    fr: demoFebFr,
    title: { en: 'Demo · First Empire Bank', fr: 'Démo · First Empire Bank' },
  },
  'demo-international-monetary-fund': {
    en: demoImfEn,
    fr: demoImfFr,
    title: { en: 'Demo · International Monetary Fund', fr: 'Démo · International Monetary Fund' },
  },
  'demo-contractor': {
    en: demoContractorEn,
    fr: demoContractorFr,
    title: { en: 'Demo · Contractor (SparkleCo)', fr: 'Démo · Prestataire (SparkleCo)' },
  },
};

export function PrintGuidePage({ slug }) {
  const guide = GUIDE_SOURCES[slug];
  const uiLang = useLanguage();
  // Caller can force a language via ?lang=fr|en. Falls back to the
  // active UI language so the FR-locale reader gets a FR PDF by default.
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const requestedLang = (params.get('lang') || '').toLowerCase();
  const lang = requestedLang === 'fr' || requestedLang === 'en' ? requestedLang : uiLang;
  // Pick the language-appropriate body + title. Falls back to EN when
  // the doc hasn't been translated yet.
  const body = guide ? (lang === 'fr' && guide.fr ? guide.fr : guide.en) : null;
  const title = guide ? guide.title?.[lang] || guide.title?.en || '' : '';

  // Auto-fire the print dialog if the caller asked for it via ?print=1.
  useEffect(() => {
    if (!guide) return;
    if (typeof window === 'undefined') return;
    if (params.get('print') === '1') {
      // Give the layout a tick to render fonts + images so the print
      // dialog sees the final pagination.
      const tid = setTimeout(() => {
        try {
          window.print();
        } catch {}
      }, 400);
      return () => clearTimeout(tid);
    }
  }, [guide]);

  // Set a useful document title — becomes the default PDF filename.
  useEffect(() => {
    if (!guide) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      document.title = `Merlin — ${title} — ${today}`;
    } catch {}
  }, [guide, title]);

  if (!guide) {
    return (
      <div style={pageStyle}>
        <PrintStyleTag />
        <div style={{ padding: 48, textAlign: 'center', color: '#7a1a1a' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Guide not found</div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: '#666' }}>
            No guide registered for slug "{slug}". See <code>src/app/PrintGuidePage.jsx</code>'s GUIDE_SOURCES.
          </div>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={pageStyle} className="merlin-guide-print">
      <PrintStyleTag />

      {/* Floating Print button — hidden when actually printing. */}
      <div className="no-print" style={floatingActionStyle}>
        <button onClick={() => window.print()} style={printButtonStyle}>
          🖨 Print / Save as PDF
        </button>
      </div>

      {/* Cover page */}
      <section className="cover">
        <div className="cover-brand">
          <div className="cover-brand-mark" />
          <div>
            <div className="cover-brand-name">Adaptiv · Merlin</div>
            <div className="cover-brand-sub">User guide</div>
          </div>
        </div>
        <h1 className="cover-title">{title}</h1>
        <div className="cover-meta">
          <div>Generated · {today}</div>
          <div>
            Slug · <code>{slug}</code>
          </div>
        </div>
        <div className="cover-footer">Adaptiv Systems · merlin · merlin.adaptiv.systems</div>
      </section>

      <div className="page-break" />

      {/* Body */}
      <article className="guide-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Make images degrade gracefully when the file isn't there
            // yet — render a labeled placeholder figure so the missing
            // art is intentional, not a broken icon. The src + alt
            // stay on the placeholder so a real file replacing it
            // doesn't change the markdown.
            img: ({ src, alt }) => (
              <figure className="screenshot">
                <img
                  src={src}
                  alt={alt || ''}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.dataset.failed = 'true';
                  }}
                />
                <figcaption>{alt || ' '}</figcaption>
              </figure>
            ),
            // Open in-page anchors normally; cross-doc links open in new tab.
            a: ({ href, children }) => (
              <a href={href} target={href?.startsWith('#') ? undefined : '_blank'} rel="noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {body}
        </ReactMarkdown>
      </article>
    </div>
  );
}

const pageStyle = {
  background: '#fff',
  color: '#1a1a1a',
  minHeight: '100vh',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Akkurat LL", "Helvetica Neue", Arial, sans-serif',
  fontSize: 14,
  lineHeight: 1.6,
};

const floatingActionStyle = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: 100,
};

const printButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: 700,
  background: '#fff',
  color: '#20286D',
  border: '1px solid #d0d0d8',
  borderRadius: 8,
  cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(0,0,0,.08)',
  fontFamily: 'inherit',
};

// Print + on-screen CSS, kept inline so the standalone route has no
// external CSS dependency beyond the body font.
function PrintStyleTag() {
  return (
    <style>{`
      .merlin-guide-print {
        max-width: 760px;
        margin: 0 auto;
        padding: 48px 56px 80px;
      }
      .merlin-guide-print code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.88em;
        background: #f4f4f6;
        padding: 1px 5px;
        border-radius: 3px;
      }
      .merlin-guide-print pre {
        background: #f6f6f8;
        border: 1px solid #e4e4ea;
        border-radius: 6px;
        padding: 12px 14px;
        overflow-x: auto;
        font-size: 12px;
        line-height: 1.5;
      }
      .merlin-guide-print pre code {
        background: transparent;
        padding: 0;
      }
      .merlin-guide-print h1 {
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.01em;
        margin: 36px 0 12px;
      }
      .merlin-guide-print h2 {
        font-size: 19px;
        font-weight: 800;
        letter-spacing: -0.01em;
        margin: 30px 0 10px;
        padding-bottom: 4px;
        border-bottom: 1px solid #e4e4ea;
        page-break-after: avoid;
      }
      .merlin-guide-print h3 {
        font-size: 15px;
        font-weight: 700;
        margin: 22px 0 8px;
        page-break-after: avoid;
      }
      .merlin-guide-print h4 {
        font-size: 13.5px;
        font-weight: 700;
        margin: 18px 0 6px;
      }
      .merlin-guide-print p {
        margin: 0 0 12px;
      }
      .merlin-guide-print ul, .merlin-guide-print ol {
        padding-left: 24px;
        margin: 0 0 14px;
      }
      .merlin-guide-print li {
        margin: 0 0 6px;
      }
      .merlin-guide-print blockquote {
        margin: 14px 0;
        padding: 10px 14px;
        background: #f6f6f8;
        border-left: 3px solid #20286D;
        color: #2a2a30;
        font-size: 13px;
      }
      .merlin-guide-print blockquote p {
        margin: 0 0 6px;
      }
      .merlin-guide-print blockquote p:last-child {
        margin-bottom: 0;
      }
      .merlin-guide-print table {
        width: 100%;
        border-collapse: collapse;
        margin: 14px 0;
        font-size: 12px;
        page-break-inside: avoid;
      }
      .merlin-guide-print th, .merlin-guide-print td {
        border: 1px solid #e4e4ea;
        padding: 6px 10px;
        text-align: left;
        vertical-align: top;
      }
      .merlin-guide-print th {
        background: #f6f6f8;
        font-weight: 700;
      }
      .merlin-guide-print a {
        color: #20286D;
        text-decoration: underline;
      }
      /* Cover */
      .merlin-guide-print .cover {
        min-height: 88vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding-top: 40px;
      }
      .merlin-guide-print .cover-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .merlin-guide-print .cover-brand-mark {
        width: 32px; height: 32px;
        border-radius: 8px;
        background: linear-gradient(135deg, #FF00B2, #20286D);
      }
      .merlin-guide-print .cover-brand-name {
        font-size: 16px;
        font-weight: 800;
        letter-spacing: -0.01em;
      }
      .merlin-guide-print .cover-brand-sub {
        font-size: 12px;
        color: #666;
        margin-top: 2px;
      }
      .merlin-guide-print .cover-title {
        font-size: 44px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: -0.02em;
        margin: 24px 0 0;
        max-width: 90%;
      }
      .merlin-guide-print .cover-meta {
        font-size: 13px;
        color: #555;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .merlin-guide-print .cover-meta code {
        font-size: 12px;
      }
      .merlin-guide-print .cover-footer {
        font-size: 11px;
        color: #888;
        border-top: 1px solid #e4e4ea;
        padding-top: 10px;
      }
      .merlin-guide-print .page-break {
        page-break-after: always;
        height: 0;
      }
      /* Screenshot figures */
      .merlin-guide-print .screenshot {
        margin: 18px 0;
        padding: 0;
        page-break-inside: avoid;
      }
      .merlin-guide-print .screenshot img {
        display: block;
        width: 100%;
        max-width: 100%;
        height: auto;
        border: 1px solid #e4e4ea;
        border-radius: 6px;
      }
      /* Broken / missing image placeholder — the onError handler tags
         the img with data-failed="true" so we can style it like an
         intentional figure box instead of a broken icon. */
      .merlin-guide-print .screenshot img[data-failed="true"] {
        height: 200px;
        background:
          repeating-linear-gradient(
            45deg,
            #f4f4f6 0,
            #f4f4f6 10px,
            #ececef 10px,
            #ececef 20px
          );
        position: relative;
      }
      .merlin-guide-print .screenshot img[data-failed="true"]::after {
        content: "Screenshot pending";
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 700;
        color: #888;
        background: rgba(255,255,255,0.85);
      }
      .merlin-guide-print .screenshot figcaption {
        margin-top: 6px;
        font-size: 11.5px;
        color: #666;
        font-style: italic;
        text-align: center;
      }
      /* Print-only adjustments */
      @media print {
        .no-print { display: none !important; }
        .merlin-guide-print {
          max-width: none;
          padding: 0 0 0 0;
        }
        .merlin-guide-print .cover {
          min-height: 100vh;
          padding: 56px 64px;
        }
        .merlin-guide-print .guide-body {
          padding: 32px 64px;
        }
        @page {
          margin: 18mm 16mm 22mm;
          @bottom-center {
            content: "Merlin user guide · page " counter(page) " of " counter(pages);
            font-family: -apple-system, sans-serif;
            font-size: 10px;
            color: #888;
          }
        }
        h2, h3 { page-break-after: avoid; }
        table, pre, blockquote, figure { page-break-inside: avoid; }
      }
      @media screen {
        .merlin-guide-print .guide-body {
          padding-top: 8px;
        }
      }
    `}</style>
  );
}
