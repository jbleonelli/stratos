// /platform/marketing/demo — Adaptiv-side surface to spin up a demo
// of a canned tenant (Meridian HQ today; FEB / others later) and email
// the bundle to a prospect.
//
// One click does the full loop:
//   1. POST /api/demos/send with {to, name?, language, demoSlug}
//   2. Server creates N persona auth users in the right orgs, generates
//      a branded PDF user guide, sends the email via Resend, and writes
//      one row to public.demo_invites.
//   3. UI shows success state + the bundle that just went out.
//
// History below the form lists the last 25 sends, RLS-scoped to
// platform admins via the policies in migration 103.
//
// Demos are added in api/_lib/demo-templates.js (server-side copy +
// persona list) and DEMO_CATALOG below (client-side picker metadata).

import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Card, Pill, AdaptivLoader } from './primitives.jsx';
import { useT, useLanguage } from './i18n.js';
import { supabase } from './supabase.js';
import { useDemoInvitesSent } from './queries/demos.ts';
import { useDemoEmailOverrides, saveDemoEmailOverrides } from './demo-email-overrides.js';
import { DEMO_EMAIL_DEFAULTS } from './demo-email-defaults.js';

// Client-side picker catalog. Mirror of demo-templates.js DEMOS for the
// UI (server is the source of truth for which demos can actually be
// sent; this surface just picks one).
const DEMO_CATALOG = [
  {
    slug: 'meridian-hq',
    icon: 'building',
    titleKey: 'platform.demo.catalog.meridian.title',
    descKey: 'platform.demo.catalog.meridian.desc',
    personasKey: 'platform.demo.catalog.meridian.personas',
  },
  {
    slug: 'meridian-warehouse',
    icon: 'cart',
    titleKey: 'platform.demo.catalog.meridian_warehouse.title',
    descKey: 'platform.demo.catalog.meridian_warehouse.desc',
    personasKey: 'platform.demo.catalog.meridian_warehouse.personas',
  },
  {
    slug: 'meridian-healthcare',
    icon: 'shield',
    titleKey: 'platform.demo.catalog.meridian_healthcare.title',
    descKey: 'platform.demo.catalog.meridian_healthcare.desc',
    personasKey: 'platform.demo.catalog.meridian_healthcare.personas',
  },
  {
    slug: 'first-empire-bank',
    icon: 'map',
    titleKey: 'platform.demo.catalog.first_empire_bank.title',
    descKey: 'platform.demo.catalog.first_empire_bank.desc',
    personasKey: 'platform.demo.catalog.first_empire_bank.personas',
  },
  {
    slug: 'contractor-sparkleco',
    icon: 'people',
    titleKey: 'platform.demo.catalog.contractor_sparkleco.title',
    descKey: 'platform.demo.catalog.contractor_sparkleco.desc',
    personasKey: 'platform.demo.catalog.contractor_sparkleco.personas',
  },
  // IMF is intentionally absent — kept as an internal-only org for
  // superadmin walkthroughs (JB + Robin + Philippe + JB Lucas). The
  // org, devices, simulator, and full IMF UI stack are all live; we
  // just don't surface it as a sendable prospect-invite bundle.
];

export function PlatformDemoPage() {
  const t = useT();
  const activeLang = useLanguage();

  const [to, setTo] = useState('');
  const [name, setName] = useState('');
  const [language, setLanguage] = useState(activeLang === 'fr' ? 'fr' : 'en');
  const [demoSlug, setDemoSlug] = useState(DEMO_CATALOG[0].slug);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState('send'); // 'send' | 'template'
  // History is now its own page — see PlatformDemosListPage below.
  // The Demos pillar's sub-nav (Demos list | Invite) is what surfaces
  // it now, so we don't duplicate the table inside the Invite form.

  const emailValid = useMemo(() => !!to && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()), [to]);
  const canSubmit = emailValid && !busy && demoSlug;

  async function send() {
    if (!canSubmit) return;
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error(t('platform.demo.err.no_session'));
      const r = await fetch('/api/demos/send', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: to.trim(),
          name: name.trim() || undefined,
          language,
          demoSlug,
        }),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(payload.error || t('platform.demo.err.send_failed'));
      setResult(payload);
      setTo('');
      setName('');
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero />

      <TopTabs tab={tab} setTab={setTab} t={t} />

      {tab === 'send' ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 'var(--pad)',
              alignItems: 'start',
            }}
          >
            {/* ───── LEFT: form */}
            <Card pad>
              <SectionTitle icon="sparkle" labelKey="platform.demo.form.title" />
              <FormRow labelKey="platform.demo.form.demo_label">
                <DemoPicker value={demoSlug} onChange={setDemoSlug} />
              </FormRow>

              <FormRow labelKey="platform.demo.form.language_label">
                <LangPicker value={language} onChange={setLanguage} />
              </FormRow>

              <FormRow labelKey="platform.demo.form.email_label">
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder={t('platform.demo.form.email_placeholder')}
                  disabled={busy}
                  style={inputStyle}
                />
              </FormRow>

              <FormRow labelKey="platform.demo.form.name_label" hintKey="platform.demo.form.name_hint">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('platform.demo.form.name_placeholder')}
                  disabled={busy}
                  style={inputStyle}
                />
              </FormRow>

              <div
                style={{
                  marginTop: 18,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <button
                  onClick={send}
                  disabled={!canSubmit}
                  style={{
                    ...primaryBtn,
                    opacity: canSubmit ? 1 : 0.55,
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Icon.bolt size={12} />
                  {busy ? t('platform.demo.form.sending') : t('platform.demo.form.submit')}
                </button>
                <div style={{ flex: '1 1 240px', minWidth: 0, fontSize: 11.5, color: 'var(--text-dim)' }}>
                  {t('platform.demo.form.disclaimer')}
                </div>
              </div>

              {err && (
                <div style={errBoxStyle}>
                  <Icon.warn size={12} style={{ marginRight: 6, position: 'relative', top: 1 }} />
                  {err}
                </div>
              )}

              {result?.ok && <SuccessPanel result={result} t={t} />}
            </Card>

            {/* ───── RIGHT: about / what gets sent */}
            <Card pad>
              <SectionTitle icon="help" labelKey="platform.demo.about.title" />
              <p style={aboutPara}>{t('platform.demo.about.line1')}</p>
              <ul style={aboutList}>
                <li>{t('platform.demo.about.bullet1')}</li>
                <li>{t('platform.demo.about.bullet2')}</li>
                <li>{t('platform.demo.about.bullet3')}</li>
              </ul>
              <p style={aboutPara}>{t('platform.demo.about.line2')}</p>
            </Card>
          </div>

          {/* History moved to its own page — see PlatformDemosListPage. */}
        </>
      ) : (
        <EmailTemplateEditor t={t} />
      )}
    </div>
  );
}

// /platform/demos/list — interactive browse view of the available demo
// bundles a platform admin can send. The grid renders short copy from
// the client-side DEMO_CATALOG (no round-trip on first paint); clicking
// a card selects it and lazy-loads the rich detail via /api/demos/list
// (server-side source of truth, same data Invite + PDF + email use).
//
// Detail panel below the grid shows: long description, full persona
// breakdown (role + label + summary), and the per-demo quick-start
// steps. Click another card to swap; click the same card again to
// close. Read-only — the actual "send" action lives on the Invite tab.
export function PlatformDemosListPage() {
  const t = useT();
  const activeLang = useLanguage();
  const lang = activeLang === 'fr' ? 'fr' : 'en';
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null); // { lang, demos: [...] }
  const [loading, setLoading] = useState(false);

  // Lazy-fetch the rich catalog when the user picks a card for the
  // first time. Cache for the page's lifetime; re-fetch if language
  // changes so the persona/quickStart strings localize correctly.
  useEffect(() => {
    if (!selected) return;
    if (details && details.lang === lang) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          if (alive) {
            setDetails(null);
            setLoading(false);
          }
          return;
        }
        const r = await fetch(`/api/demos/list?lang=${lang}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const payload = await r.json().catch(() => null);
        if (!alive) return;
        setDetails(r.ok && payload ? payload : null);
      } catch {
        if (alive) setDetails(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selected, lang, details]);

  const selectedDemo = useMemo(
    () => (details?.demos || []).find((d) => d.slug === selected) || null,
    [details, selected],
  );

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Card pad>
        <SectionTitle icon="sparkle" labelKey="platform.demos.list.title" />
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.5 }}>
          {t('platform.demos.list.intro')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 12,
          }}
        >
          {DEMO_CATALOG.map((d) => {
            const IconC = Icon[d.icon] || Icon.sparkle;
            const isSelected = selected === d.slug;
            return (
              <button
                key={d.slug}
                onClick={() => setSelected(isSelected ? null : d.slug)}
                style={{
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 16px',
                  background: isSelected ? 'var(--accent-soft)' : 'var(--surface-2)',
                  border: `1px solid ${isSelected ? 'var(--accent-line)' : 'var(--border)'}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: 'inherit',
                  transition: 'background .12s, border-color .12s',
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    flexShrink: 0,
                    background: isSelected ? 'var(--accent)' : 'var(--surface-3)',
                    color: isSelected ? '#fff' : 'var(--text-soft)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconC size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{t(d.titleKey)}</div>
                    <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-faint)' }}>
                      {d.slug}
                    </div>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    {t(d.descKey)}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                    {t(d.personasKey)}
                  </div>
                </div>
                {isSelected && <Icon.check size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Detail panel — only renders once a card has been selected.
          Loading state covers the network round-trip; null state covers
          the (rare) failure path. */}
      {selected &&
        (loading ? (
          <Card pad>
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <AdaptivLoader size="sm" />
            </div>
          </Card>
        ) : selectedDemo ? (
          <DemoDetailPanel demo={selectedDemo} onClose={() => setSelected(null)} t={t} />
        ) : (
          <Card pad>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('platform.demos.list.detail_error')}</div>
          </Card>
        ))}
    </div>
  );
}

// Renders one selected demo's full description, persona breakdown, and
// quick-start steps. Lives only on the Demos list tab — the Invite tab
// has its own (more compact) DemoPicker.
function DemoDetailPanel({ demo, onClose, t }) {
  return (
    <Card pad>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{demo.name}</div>
          <div style={{ marginTop: 2, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-faint)' }}>
            {demo.slug}
          </div>
        </div>
        <button
          onClick={onClose}
          title={t('platform.demos.list.close')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'transparent',
            color: 'var(--text-dim)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Icon.close size={12} />
        </button>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6, marginBottom: 18 }}>
        {demo.description}
      </div>

      {/* Personas */}
      {Array.isArray(demo.personas) && demo.personas.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <SectionTitle icon="people" labelKey="platform.demos.list.detail.personas" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
            {demo.personas.map((p, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <Pill tone="accent">{p.role}</Pill>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{p.label}</div>
                </div>
                {p.summary && (
                  <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    {p.summary}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick-start steps */}
      {Array.isArray(demo.quickStart) && demo.quickStart.length > 0 && (
        <div>
          <SectionTitle icon="sparkle" labelKey="platform.demos.list.detail.quickstart" />
          <ol
            style={{ margin: '6px 0 0', paddingLeft: 22, color: 'var(--text-soft)', fontSize: 12.5, lineHeight: 1.6 }}
          >
            {demo.quickStart.map((step, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

// /platform/demos/sent — full-page audit table of past demo invites.
// Reuses the HistoryTable component below + the same RLS-scoped query
// the inline history used to run inside PlatformDemoPage. Capped at
// 100 most-recent here (vs 25 on the embedded view) since this surface
// is dedicated to browsing the audit.
export function PlatformDemosSentPage() {
  const t = useT();
  // Invites + per-bundle sign-in summary; the two reads + aggregation live in
  // the query hook. ready=!isLoading (matches the prior "loaded" flag).
  const { data: rows = [], isLoading } = useDemoInvitesSent();
  const ready = !isLoading;

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Card pad>
        <SectionTitle icon="people" labelKey="platform.demo.history.title" />
        <HistoryTable rows={rows} ready={ready} t={t} />
      </Card>
    </div>
  );
}

function TopTabs({ tab, setTab, t }) {
  const tabs = [
    { v: 'send', labelKey: 'platform.demo.tab.send', icon: 'bolt' },
    { v: 'template', labelKey: 'platform.demo.tab.template', icon: 'paper' },
  ];
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        background: 'var(--surface-3)',
        borderRadius: 10,
        border: '1px solid var(--border)',
        alignSelf: 'flex-start',
      }}
    >
      {tabs.map((o) => {
        const active = tab === o.v;
        const IconC = Icon[o.icon] || Icon.sparkle;
        return (
          <button
            key={o.v}
            onClick={() => setTab(o.v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 14px',
              borderRadius: 7,
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-soft)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: 'inherit',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <IconC size={12} />
            {t(o.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

// Fields surfaced for editing. Order = render order. The `kind` flag
// chooses input vs textarea. `placeholderKey` shows the in-code default
// hint to the editor so they know what they're overriding.
const TEMPLATE_FIELDS = [
  {
    name: 'pitchLine',
    kind: 'textarea',
    labelKey: 'platform.demo.tpl.field.pitch_line.label',
    hintKey: 'platform.demo.tpl.field.pitch_line.hint',
  },
  {
    name: 'guideBody',
    kind: 'textarea',
    labelKey: 'platform.demo.tpl.field.guide_body.label',
    hintKey: 'platform.demo.tpl.field.guide_body.hint',
  },
  {
    name: 'closing',
    kind: 'textarea',
    labelKey: 'platform.demo.tpl.field.closing.label',
    hintKey: 'platform.demo.tpl.field.closing.hint',
  },
  {
    name: 'signOff',
    kind: 'input',
    labelKey: 'platform.demo.tpl.field.signoff.label',
    hintKey: 'platform.demo.tpl.field.signoff.hint',
  },
  {
    name: 'footerTagline',
    kind: 'input',
    labelKey: 'platform.demo.tpl.field.footer_tagline.label',
    hintKey: 'platform.demo.tpl.field.footer_tagline.hint',
  },
  {
    name: 'note',
    kind: 'textarea',
    labelKey: 'platform.demo.tpl.field.note.label',
    hintKey: 'platform.demo.tpl.field.note.hint',
  },
];

// Hydrate a draft from saved overrides — every field gets a visible
// value: the saved override if non-empty, otherwise the in-code default.
// This is what the editor displays so the admin always sees real copy.
function hydrateDraft(savedOverrides) {
  const out = { en: {}, fr: {} };
  for (const lang of ['en', 'fr']) {
    for (const f of TEMPLATE_FIELDS) {
      const saved = savedOverrides[lang]?.[f.name] || '';
      out[lang][f.name] = saved || DEMO_EMAIL_DEFAULTS[lang][f.name] || '';
    }
  }
  return out;
}

// Save side: if the draft value equals the in-code default, persist
// as '' (= keep using the default forever, including if it ever
// changes in code). Otherwise persist the draft string as an override.
function draftToOverrides(draft) {
  const out = { en: {}, fr: {} };
  for (const lang of ['en', 'fr']) {
    for (const f of TEMPLATE_FIELDS) {
      const v = draft[lang]?.[f.name] || '';
      const def = DEMO_EMAIL_DEFAULTS[lang][f.name] || '';
      out[lang][f.name] = v.trim() === def.trim() ? '' : v;
    }
  }
  return out;
}

function EmailTemplateEditor({ t }) {
  const { overrides: savedOverrides, ready } = useDemoEmailOverrides();
  const [draft, setDraft] = useState(() => hydrateDraft(savedOverrides));
  const [langTab, setLangTab] = useState('en'); // 'en' | 'fr'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [okFlash, setOkFlash] = useState(false);

  // When the DB hydrates, seed the draft from the saved value (one-shot).
  useEffect(() => {
    if (ready) setDraft(hydrateDraft(savedOverrides));
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dirty = current draft → overrides ≠ saved overrides.
  const dirty = useMemo(() => {
    const next = draftToOverrides(draft);
    for (const lang of ['en', 'fr']) {
      for (const f of TEMPLATE_FIELDS) {
        if ((next[lang]?.[f.name] || '') !== (savedOverrides[lang]?.[f.name] || '')) return true;
      }
    }
    return false;
  }, [draft, savedOverrides]);

  function setField(lang, field, value) {
    setDraft((d) => ({ ...d, [lang]: { ...d[lang], [field]: value } }));
    setOkFlash(false);
  }

  async function onSave() {
    setBusy(true);
    setErr('');
    setOkFlash(false);
    try {
      await saveDemoEmailOverrides(draftToOverrides(draft));
      setOkFlash(true);
      setTimeout(() => setOkFlash(false), 3000);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function onRevert() {
    setDraft(hydrateDraft(savedOverrides));
    setErr('');
  }

  function onResetAllToDefaults() {
    // Visual reset to defaults in both languages. Save then persists
    // empty overrides (= use in-code default at send time).
    setDraft({
      en: { ...DEMO_EMAIL_DEFAULTS.en },
      fr: { ...DEMO_EMAIL_DEFAULTS.fr },
    });
  }

  function resetFieldToDefault(lang, field) {
    setDraft((d) => ({
      ...d,
      [lang]: { ...d[lang], [field]: DEMO_EMAIL_DEFAULTS[lang][field] || '' },
    }));
  }

  const langDraft = draft[langTab];

  return (
    <Card pad>
      <SectionTitle icon="paper" labelKey="platform.demo.tpl.title" />
      <p style={aboutPara}>{t('platform.demo.tpl.subtitle')}</p>

      {/* Language tabs */}
      <div
        style={{
          display: 'inline-flex',
          gap: 4,
          padding: 4,
          background: 'var(--surface-3)',
          borderRadius: 8,
          border: '1px solid var(--border)',
          marginBottom: 14,
        }}
      >
        {[
          { v: 'en', labelKey: 'platform.demo.lang.en' },
          { v: 'fr', labelKey: 'platform.demo.lang.fr' },
        ].map((o) => {
          const active = langTab === o.v;
          return (
            <button
              key={o.v}
              onClick={() => setLangTab(o.v)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-soft)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'inherit',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t(o.labelKey)}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {TEMPLATE_FIELDS.map((f) => {
          const value = langDraft?.[f.name] || '';
          const def = DEMO_EMAIL_DEFAULTS[langTab][f.name] || '';
          const isDefault = value.trim() === def.trim();
          return (
            <div key={f.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <label
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: 'var(--text-soft)',
                    letterSpacing: 0.1,
                    textTransform: 'uppercase',
                  }}
                >
                  {t(f.labelKey)}
                </label>
                {isDefault ? (
                  <Pill tone="neutral">{t('platform.demo.tpl.pill.default')}</Pill>
                ) : (
                  <Pill tone="accent">{t('platform.demo.tpl.pill.customized')}</Pill>
                )}
                {!isDefault && (
                  <button
                    onClick={() => resetFieldToDefault(langTab, f.name)}
                    disabled={busy}
                    style={ghostBtnLink}
                    title={t('platform.demo.tpl.reset_field_title')}
                  >
                    {t('platform.demo.tpl.reset_field')}
                  </button>
                )}
              </div>
              {f.kind === 'textarea' ? (
                <textarea
                  value={value}
                  onChange={(e) => setField(langTab, f.name, e.target.value)}
                  placeholder={def}
                  disabled={busy}
                  rows={Math.max(3, Math.min(6, Math.ceil((def.length || 1) / 90)))}
                  style={{ ...inputStyle, maxWidth: 760, fontFamily: 'inherit', resize: 'vertical', minHeight: 70 }}
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setField(langTab, f.name, e.target.value)}
                  placeholder={def}
                  disabled={busy}
                  style={{ ...inputStyle, maxWidth: 760 }}
                />
              )}
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t(f.hintKey)}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <button
          onClick={onSave}
          disabled={!dirty || busy}
          style={{
            ...primaryBtn,
            opacity: dirty && !busy ? 1 : 0.55,
            cursor: dirty && !busy ? 'pointer' : 'not-allowed',
          }}
        >
          <Icon.check size={12} />
          {busy ? t('platform.demo.tpl.saving') : t('platform.demo.tpl.save')}
        </button>
        <button
          onClick={onRevert}
          disabled={!dirty || busy}
          style={{
            ...secondaryBtn,
            opacity: dirty && !busy ? 1 : 0.55,
            cursor: dirty && !busy ? 'pointer' : 'not-allowed',
          }}
        >
          {t('platform.demo.tpl.revert')}
        </button>
        <button
          onClick={onResetAllToDefaults}
          disabled={busy}
          style={{ ...secondaryBtn, opacity: busy ? 0.55 : 1 }}
          title={t('platform.demo.tpl.clear_all_title')}
        >
          {t('platform.demo.tpl.clear_all')}
        </button>
        {dirty && <Pill tone="warn">{t('platform.demo.tpl.unsaved')}</Pill>}
        {okFlash && <Pill tone="ok">{t('platform.demo.tpl.saved_flash')}</Pill>}
      </div>

      {err && (
        <div style={errBoxStyle}>
          <Icon.warn size={12} style={{ marginRight: 6, position: 'relative', top: 1 }} />
          {err}
        </div>
      )}
    </Card>
  );
}

// ───────────────────────────── pieces

function Hero() {
  const t = useT();
  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ padding: 'var(--pad)', position: 'relative' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            fontWeight: 700,
          }}
        >
          {t('platform.demo.eyebrow')}
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
          {t('platform.demo.heading')}
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 760, lineHeight: 1.55 }}>
          {t('platform.demo.subheading')}
        </p>
      </div>
    </Card>
  );
}

function SectionTitle({ icon, labelKey }) {
  const t = useT();
  const IconC = Icon[icon] || Icon.sparkle;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <IconC size={14} style={{ color: 'var(--accent)' }} />
      <div style={{ fontSize: 13, fontWeight: 700 }}>{t(labelKey)}</div>
    </div>
  );
}

function FormRow({ labelKey, hintKey, children }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      <label
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: 'var(--text-soft)',
          letterSpacing: 0.1,
          textTransform: 'uppercase',
        }}
      >
        {t(labelKey)}
      </label>
      {children}
      {hintKey && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t(hintKey)}</div>}
    </div>
  );
}

function DemoPicker({ value, onChange }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {DEMO_CATALOG.map((d) => {
        const IconC = Icon[d.icon] || Icon.sparkle;
        const active = value === d.slug;
        return (
          <button
            key={d.slug}
            onClick={() => onChange(d.slug)}
            style={{
              textAlign: 'left',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 14px',
              background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
              border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
              borderRadius: 10,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'inherit',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                flexShrink: 0,
                background: active ? 'var(--accent)' : 'var(--surface-3)',
                color: active ? '#fff' : 'var(--text-soft)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconC size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t(d.titleKey)}</div>
              <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                {t(d.descKey)}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                {t(d.personasKey)}
              </div>
            </div>
            {active && <Icon.check size={14} style={{ color: 'var(--accent)', marginTop: 4 }} />}
          </button>
        );
      })}
    </div>
  );
}

function LangPicker({ value, onChange }) {
  const t = useT();
  const opts = [
    { v: 'en', labelKey: 'platform.demo.lang.en' },
    { v: 'fr', labelKey: 'platform.demo.lang.fr' },
  ];
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 6,
        padding: 4,
        background: 'var(--surface-3)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}
    >
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-soft)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t(o.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

function SuccessPanel({ result, t }) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        background: 'color-mix(in oklch, var(--ok) 10%, transparent)',
        border: '1px solid color-mix(in oklch, var(--ok) 30%, transparent)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon.check size={14} style={{ color: 'var(--ok)' }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ok)' }}>{t('platform.demo.success.title')}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{t('platform.demo.success.body')}</div>
      {Array.isArray(result.users) && result.users.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {result.users.map((u) => (
            <div key={u.email} style={{ fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--text-soft)' }}>
              <strong style={{ color: 'var(--text)' }}>{u.label}</strong> — {u.email}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryTable({ rows, ready, t }) {
  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
        <AdaptivLoader size="sm" />
      </div>
    );
  }
  if (rows.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('platform.demo.history.empty')}</div>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-dim)', fontWeight: 700 }}>
            <th style={th}>{t('platform.demo.history.col.when')}</th>
            <th style={th}>{t('platform.demo.history.col.recipient')}</th>
            <th style={th}>{t('platform.demo.history.col.demo')}</th>
            <th style={th}>{t('platform.demo.history.col.lang')}</th>
            <th style={th}>{t('platform.demo.history.col.users')}</th>
            <th style={th}>{t('platform.demo.history.col.signed_in')}</th>
            <th style={th}>{t('platform.demo.history.col.status')}</th>
            <th style={th}>{t('platform.demo.history.col.by')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={td}>{relTime(r.created_at)}</td>
              <td style={td}>
                <div style={{ color: 'var(--text)' }}>{r.sent_to_email}</div>
                {r.sent_to_name && <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>{r.sent_to_name}</div>}
              </td>
              <td style={td}>{r.demo_slug}</td>
              <td style={td}>
                <Pill tone="neutral">{(r.language || 'en').toUpperCase()}</Pill>
              </td>
              <td style={td}>{Array.isArray(r.created_users) ? r.created_users.length : 0}</td>
              <td style={td}>
                <SignedInCell summary={r.sign_in_summary} t={t} />
              </td>
              <td style={td}>
                {r.status === 'sent' ? (
                  <Pill tone="ok">{t('platform.demo.history.status.sent')}</Pill>
                ) : r.status === 'failed' ? (
                  <Pill tone="risk" style={{ cursor: r.error_message ? 'help' : 'default' }}>
                    <span title={r.error_message || ''}>{t('platform.demo.history.status.failed')}</span>
                  </Pill>
                ) : (
                  <Pill tone="warn">{t('platform.demo.history.status.revoked')}</Pill>
                )}
              </td>
              <td style={td}>{r.sent_by_email || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Renders the "Signed in" column for one invite row. `summary` carries
// `{ first, last }` epoch-ms aggregated across every persona created
// for that invite. Renders:
//   - "Never" when nobody ever signed in
//   - "2026-05-21 14:32 UTC"           when first === last (single sign-in)
//   - "first → last" stacked otherwise
// Times are formatted in UTC so cross-timezone team members read the
// same string.
function SignedInCell({ summary, t }) {
  const first = summary?.first;
  const last = summary?.last;
  if (!first && !last) {
    return (
      <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>
        {t('platform.demo.history.signed_in.never')}
      </span>
    );
  }
  if (first === last) {
    return <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{formatUtc(first)}</span>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'var(--mono)', fontSize: 11 }}>
      <div>
        <span style={{ color: 'var(--text-faint)', marginRight: 4 }}>{t('platform.demo.history.signed_in.first')}</span>
        {formatUtc(first)}
      </div>
      <div>
        <span style={{ color: 'var(--text-faint)', marginRight: 4 }}>{t('platform.demo.history.signed_in.last')}</span>
        {formatUtc(last)}
      </div>
    </div>
  );
}

// "2026-05-21 14:32 UTC" — concise, ISO-ish, no locale ambiguity.
function formatUtc(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm} UTC`;
}

function relTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const delta = Date.now() - d.getTime();
  const m = Math.round(delta / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.round(h / 24);
  if (dd < 30) return `${dd}d ago`;
  return d.toLocaleDateString();
}

// ───────────────────────────── styles

const inputStyle = {
  width: '100%',
  maxWidth: 460,
  padding: '8px 10px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  fontSize: 13,
  color: 'var(--text)',
  fontFamily: 'inherit',
  outline: 'none',
};
const primaryBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  fontSize: 12.5,
  fontWeight: 700,
  background: 'var(--accent)',
  color: '#fff',
  border: '1px solid var(--accent)',
  borderRadius: 7,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const secondaryBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  fontSize: 12.5,
  fontWeight: 700,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const ghostBtnLink = {
  background: 'transparent',
  border: 'none',
  padding: '0 4px',
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'inherit',
  color: 'var(--accent)',
  cursor: 'pointer',
  textDecoration: 'underline',
};
const errBoxStyle = {
  marginTop: 12,
  padding: '10px 12px',
  background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
  color: 'var(--risk)',
  border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
  borderRadius: 6,
  fontSize: 12,
};
const aboutPara = { margin: '0 0 10px', fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.6 };
const aboutList = { margin: '0 0 10px', paddingLeft: 18, fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.6 };
const th = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--border)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.1,
};
const td = { padding: '10px', color: 'var(--text-soft)', verticalAlign: 'top' };
