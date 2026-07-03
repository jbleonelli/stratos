// Excalibur Docs CMS — edit the customer-facing Docs section.
//
// Left: sections + pages (reorder, rename, delete). Right: a bilingual editor —
// EN/FR toggle drives the title/blurb/body fields, with an image uploader and
// live markdown preview. A History panel shows past saved versions and can
// restore one. Content lives in docs_sections / docs_pages; the in-app Docs
// section reads it (falling back to the bundled repo defaults). "Seed from repo"
// populates the DB from those defaults the first time.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { DataError } from './primitives.jsx';
import { DocMarkdown, slugify } from './doc-markdown.jsx';
import { confirmDialog, promptDialog, alertDialog } from './dialogs.jsx';
import {
  useDocsAdmin,
  savePage,
  deletePage,
  saveSection,
  deleteSection,
  reorderSections,
  reorderPages,
  seedFromDefaults,
  uploadDocImage,
  useRevisions,
} from './docs-cms-data.js';
import { diffLines, diffStat } from './text-diff.js';
import { findBrokenLinks } from './docs-link-check.js';
import { supabase } from './supabase.js';

const blankPage = (sectionId) => ({
  id: '',
  section_id: sectionId || '',
  slug: '',
  title_en: '',
  title_fr: '',
  title_de: '',
  blurb_en: '',
  blurb_fr: '',
  blurb_de: '',
  body: '',
  body_fr: '',
  body_de: '',
  sort_order: 0,
  published: true,
  _isNew: true,
});

// Editor languages: which column each edits + display label. EN is the source;
// FR/DE are translations (Copy-from-EN + Generate available, fall back to EN).
const KEYS = {
  en: { title: 'title_en', blurb: 'blurb_en', body: 'body' },
  fr: { title: 'title_fr', blurb: 'blurb_fr', body: 'body_fr' },
  de: { title: 'title_de', blurb: 'blurb_de', body: 'body_de' },
};
const EDITOR_LANGS = ['en', 'fr', 'de'];
// Non-English editor languages — the ones with translation tooling.
const TR_LANGS = ['fr', 'de'];

export function PlatformDocsPage() {
  const { sections, pages, loaded, error: loadError, refresh } = useDocsAdmin();
  const [selId, setSelId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [lang, setLang] = useState('en');
  const [historyFor, setHistoryFor] = useState(null);
  const [linkFindings, setLinkFindings] = useState(null);

  const seeded = sections.length > 0 || pages.length > 0;
  const pagesBySection = useMemo(() => {
    const m = {};
    for (const p of pages) (m[p.section_id] ||= []).push(p);
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
    return m;
  }, [pages]);

  // Load the selected page into the draft.
  useEffect(() => {
    if (selId == null) {
      setDraft(null);
      return;
    }
    if (selId === '__new__') return; // draft set by the New handler
    const p = pages.find((x) => x.id === selId);
    if (p) setDraft({ ...p });
  }, [selId, pages]);

  const dirty =
    draft && (draft._isNew || JSON.stringify(draft) !== JSON.stringify({ ...pages.find((p) => p.id === draft.id) }));

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const guard = async (fn) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const onNew = () => {
    const sid = sections[0]?.id;
    const d = blankPage(sid);
    d.sort_order = (pagesBySection[sid] || []).length;
    setDraft(d);
    setSelId('__new__');
    setErr(null);
  };

  const onSeed = () =>
    guard(async () => {
      if (
        seeded &&
        !(await confirmDialog({
          body: 'Reset ALL docs to the repo defaults? This overwrites every page’s English text with the bundled version. (French page bodies and uploaded images are kept.)',
          danger: true,
        }))
      )
        return;
      await seedFromDefaults();
      refresh();
    });

  const onAddSection = () =>
    guard(async () => {
      const name = await promptDialog({
        title: 'New section',
        body: 'Section name (e.g. "Billing")',
        placeholder: 'Section name',
      });
      if (!name) return;
      const id = slugify(name);
      if (!id) return;
      await saveSection({ id, title_en: name, title_fr: name, sort_order: sections.length });
      refresh();
    });

  const onRenameSection = (s) =>
    guard(async () => {
      const key = lang === 'en' ? 'title_en' : `title_${lang}`;
      const cur = s[key] || s.title_en;
      const name = await promptDialog({
        title: lang === 'fr' ? 'Rename section (FR)' : 'Rename section',
        body: 'Section name',
        placeholder: 'Section name',
        defaultValue: cur,
      });
      if (!name || name === cur) return;
      await saveSection({ ...s, [key]: name });
      refresh();
    });

  const onDeleteSection = (s) =>
    guard(async () => {
      if ((pagesBySection[s.id] || []).length > 0) {
        await alertDialog({ body: 'Move or delete this section’s pages first, then delete the section.' });
        return;
      }
      if (!(await confirmDialog({ body: `Delete the empty "${s.title_en}" section?`, danger: true }))) return;
      await deleteSection(s.id);
      refresh();
    });

  const onMoveSection = (idx, dir) =>
    guard(async () => {
      const ids = sections.map((s) => s.id);
      const j = idx + dir;
      if (j < 0 || j >= ids.length) return;
      [ids[idx], ids[j]] = [ids[j], ids[idx]];
      await reorderSections(ids);
      refresh();
    });

  const onMovePage = (sectionId, idx, dir) =>
    guard(async () => {
      const ids = (pagesBySection[sectionId] || []).map((p) => p.id);
      const j = idx + dir;
      if (j < 0 || j >= ids.length) return;
      [ids[idx], ids[j]] = [ids[j], ids[idx]];
      await reorderPages(ids);
      refresh();
    });

  const onSave = () =>
    guard(async () => {
      if (!draft) return;
      const id = draft._isNew ? draft.id || slugify(draft.title_en) : draft.id;
      if (!id) {
        setErr('A page id/slug is required.');
        return;
      }
      if (!draft.section_id) {
        setErr('Pick a section.');
        return;
      }
      if (!draft.title_en) {
        setErr('An English title is required.');
        return;
      }
      const row = { ...draft, id, slug: draft.slug || id };
      delete row._isNew;
      await savePage(row);
      refresh();
      setSelId(id);
      setDraft({ ...row });
    });

  const onDelete = () =>
    guard(async () => {
      if (!draft || draft._isNew) {
        setSelId(null);
        setDraft(null);
        return;
      }
      if (
        !(await confirmDialog({
          body: `Delete the "${draft.title_en}" page? (You can re-seed it from the repo default later.)`,
          danger: true,
        }))
      )
        return;
      await deletePage(draft.id);
      refresh();
      setSelId(null);
      setDraft(null);
    });

  const onCheckLinks = () => {
    setLinkFindings(
      findBrokenLinks(pages.map((p) => ({ id: p.id, body: p.body, body_fr: p.body_fr, body_de: p.body_de }))),
    );
  };

  const onRestore = (rev) => {
    setDraft((d) => ({
      ...d,
      title_en: rev.title_en ?? '',
      title_fr: rev.title_fr ?? '',
      title_de: rev.title_de ?? '',
      blurb_en: rev.blurb_en ?? '',
      blurb_fr: rev.blurb_fr ?? '',
      blurb_de: rev.blurb_de ?? '',
      body: rev.body ?? '',
      body_fr: rev.body_fr ?? '',
      body_de: rev.body_de ?? '',
    }));
    setHistoryFor(null);
    setErr(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Icon.help size={16} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 16, fontWeight: 800 }}>Docs</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Edit the customer-facing Docs section</div>
        <div style={{ flex: 1 }} />
        {seeded && (
          <button onClick={onNew} style={primaryBtn}>
            <Icon.plus size={12} /> New page
          </button>
        )}
        {seeded && (
          <button
            onClick={onCheckLinks}
            disabled={busy}
            style={ghostBtn}
            title="Scan every page for broken internal doc links"
          >
            <Icon.search size={12} /> Check links
          </button>
        )}
        <button
          onClick={onSeed}
          disabled={busy}
          style={ghostBtn}
          title="Overwrite page text with the repo defaults (keeps FR + images)"
        >
          <Icon.reload size={12} /> {seeded ? 'Reset from repo' : 'Seed from repo'}
        </button>
      </div>

      {err && (
        <div
          style={{
            margin: '10px 20px 0',
            padding: '8px 12px',
            fontSize: 12.5,
            color: 'var(--risk)',
            background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
            border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
            borderRadius: 8,
          }}
        >
          {err}
        </div>
      )}

      {!loaded ? (
        <div style={{ padding: 40, color: 'var(--text-dim)' }}>Loading…</div>
      ) : loadError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <DataError
            message="Couldn’t load the docs library. This is a load error, not an empty CMS — don’t re-seed."
            onRetry={refresh}
            style={{ maxWidth: 460 }}
          />
        </div>
      ) : !seeded ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 460, textAlign: 'center' }}>
            <Icon.help size={30} style={{ color: 'var(--text-faint)' }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>No docs in the CMS yet</div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginTop: 8 }}>
              The Docs section is currently showing the built-in repo guides. Click below to import them into the CMS so
              you can edit them here. After that, your edits are the source of truth and go live instantly.
            </p>
            <button onClick={onSeed} disabled={busy} style={{ ...primaryBtn, marginTop: 14, padding: '9px 16px' }}>
              <Icon.reload size={13} /> {busy ? 'Importing…' : 'Seed from repo defaults'}
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '300px minmax(0, 1fr)',
            gap: 12,
            padding: 12,
            minHeight: 0,
          }}
        >
          {/* Left: section + page tree with reorder controls */}
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflow: 'auto',
              padding: 12,
              background: 'var(--surface-2)',
            }}
          >
            {sections.map((s, si) => {
              const sectionPages = pagesBySection[s.id] || [];
              return (
                <div key={s.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 4px 6px' }}>
                    <button
                      onClick={() => onRenameSection(s)}
                      disabled={busy}
                      title="Click to rename"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                        fontSize: 10.5,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                        color: 'var(--text-faint)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        background: 'transparent',
                        border: 'none',
                        cursor: busy ? 'default' : 'pointer',
                        padding: 0,
                        fontFamily: 'inherit',
                      }}
                    >
                      {s[`title_${lang}`] || s.title_en}
                    </button>
                    <IconBtn title="Move up" disabled={si === 0 || busy} onClick={() => onMoveSection(si, -1)}>
                      <Icon.chevD size={12} style={{ transform: 'rotate(180deg)' }} />
                    </IconBtn>
                    <IconBtn
                      title="Move down"
                      disabled={si === sections.length - 1 || busy}
                      onClick={() => onMoveSection(si, 1)}
                    >
                      <Icon.chevD size={12} />
                    </IconBtn>
                    <IconBtn title="Delete section" disabled={busy} onClick={() => onDeleteSection(s)}>
                      <Icon.close size={11} />
                    </IconBtn>
                  </div>
                  {sectionPages.map((p, pi) => {
                    const active = p.id === selId;
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 2 }}>
                        <button
                          onClick={() => {
                            setSelId(p.id);
                            setErr(null);
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 9px',
                            background: active ? 'var(--accent-soft)' : 'transparent',
                            color: active ? 'var(--accent)' : 'var(--text-soft)',
                            border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                            borderRadius: 7,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: 12.5,
                            fontWeight: active ? 700 : 500,
                          }}
                        >
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.title_en}
                          </span>
                          {!p.published && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: 'var(--warn)',
                                background: 'color-mix(in oklch, var(--warn) 14%, transparent)',
                                padding: '1px 5px',
                                borderRadius: 4,
                              }}
                            >
                              DRAFT
                            </span>
                          )}
                          <TrBadge page={p} />
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <IconBtn
                            title="Move up"
                            disabled={pi === 0 || busy}
                            onClick={() => onMovePage(s.id, pi, -1)}
                            small
                          >
                            <Icon.chevD size={10} style={{ transform: 'rotate(180deg)' }} />
                          </IconBtn>
                          <IconBtn
                            title="Move down"
                            disabled={pi === sectionPages.length - 1 || busy}
                            onClick={() => onMovePage(s.id, pi, 1)}
                            small
                          >
                            <Icon.chevD size={10} />
                          </IconBtn>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <button
              onClick={onAddSection}
              disabled={busy}
              style={{ ...ghostBtn, width: '100%', justifyContent: 'center', marginTop: 4 }}
            >
              <Icon.plus size={11} /> Section
            </button>
          </div>

          {/* Right: editor */}
          <div style={{ overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {!draft ? (
              <div style={{ padding: 40, color: 'var(--text-dim)', fontSize: 13 }}>
                Select a page on the left, or create a new one.
              </div>
            ) : (
              <Editor
                draft={draft}
                set={set}
                sections={sections}
                busy={busy}
                dirty={dirty}
                lang={lang}
                setLang={setLang}
                onSave={onSave}
                onDelete={onDelete}
                onShowHistory={() => setHistoryFor(draft.id)}
                setErr={setErr}
              />
            )}
          </div>
        </div>
      )}

      {historyFor && (
        <HistoryModal
          pageId={historyFor}
          current={pages.find((p) => p.id === historyFor) || null}
          onClose={() => setHistoryFor(null)}
          onRestore={onRestore}
        />
      )}
      {linkFindings && (
        <LinkCheckModal
          findings={linkFindings}
          pages={pages}
          onClose={() => setLinkFindings(null)}
          onOpenPage={(id) => {
            setSelId(id);
            setLinkFindings(null);
            setErr(null);
          }}
        />
      )}
    </div>
  );
}

function IconBtn({ children, onClick, disabled, title, small }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: small ? 16 : 22,
        height: small ? 13 : 22,
        padding: 0,
        background: 'transparent',
        border: 'none',
        borderRadius: 5,
        cursor: disabled ? 'default' : 'pointer',
        color: 'var(--text-faint)',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '7px 10px',
  fontSize: 13,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontFamily: 'inherit',
  outline: 'none',
};

function LangToggle({ lang, setLang }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {EDITOR_LANGS.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            padding: '6px 11px',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
            border: 'none',
            background: lang === l ? 'var(--accent)' : 'var(--surface)',
            color: lang === l ? '#fff' : 'var(--text-dim)',
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Editor({ draft, set, sections, busy, dirty, lang, setLang, onSave, onDelete, onShowHistory, setErr }) {
  const K = KEYS[lang];
  const bodyRef = useRef(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Insert text at the textarea caret (or append), keeping the body in the
  // active language.
  const insertAtCaret = (text) => {
    const ta = bodyRef.current;
    const cur = draft[K.body] || '';
    if (!ta) {
      set(K.body, cur + text);
      return;
    }
    const a = ta.selectionStart ?? cur.length;
    const b = ta.selectionEnd ?? cur.length;
    const next = cur.slice(0, a) + text + cur.slice(b);
    set(K.body, next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = a + text.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const url = await uploadDocImage(file);
      const alt = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
      insertAtCaret(`\n\n![${alt}](${url})\n\n`);
    } catch (err) {
      setErr(err.message || String(err));
    } finally {
      setUploading(false);
    }
  };

  // Seed the CURRENT language's fields from English — only the EMPTY ones, so a
  // partial translation isn't clobbered. Gives translators a starting draft. (No-
  // op in the EN view.)
  const trPending =
    lang !== 'en' &&
    ((!draft[K.title] && draft.title_en) || (!draft[K.blurb] && draft.blurb_en) || (!draft[K.body] && draft.body));
  const copyFromEn = () => {
    if (!draft[K.title] && draft.title_en) set(K.title, draft.title_en);
    if (!draft[K.blurb] && draft.blurb_en) set(K.blurb, draft.blurb_en);
    if (!draft[K.body] && draft.body) set(K.body, draft.body);
  };

  // Generate a real translation of (title + blurb + body) into the CURRENT editor
  // language via the markdown translate endpoint, then drop it into the draft for
  // review before Save. A genuine (billed) Haiku call — markdown + links preserved.
  const generateTr = async () => {
    if (draft[K.body] && draft[K.body].trim()) {
      const ok = await confirmDialog({
        body: `Replace the existing ${lang.toUpperCase()} translation with a freshly generated one?`,
      });
      if (!ok) return;
    }
    setGenerating(true);
    setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error('Not signed in.');
      // In dev, /api/* isn't served by Vite — point at prod (same pattern as event-translations.js).
      const apiBase = /^(localhost|127\.0\.0\.1)/.test(location.hostname) ? 'https://merlin.adaptiv.systems' : '';
      const res = await fetch(`${apiBase}/api/translate`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'markdown',
          target_lang: lang,
          texts: [draft.title_en || '', draft.blurb_en || '', draft.body || ''],
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          j.error === 'rate_limited'
            ? 'Translation rate limit hit — wait a minute and retry.'
            : `Translation failed (${res.status}).`,
        );
      }
      const { translations } = await res.json();
      const [tTr, bTr, bodyTr] = translations || [];
      if (tTr != null) set(K.title, tTr);
      if (bTr != null) set(K.blurb, bTr);
      if (bodyTr != null) set(K.body, bodyTr);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      {/* Metadata bar */}
      <div
        style={{
          padding: '14px 20px',
          display: 'grid',
          gridTemplateColumns: '2fr 1fr auto auto auto',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <Field label={`Title (${lang.toUpperCase()})`}>
          <input
            value={draft[K.title] || ''}
            onChange={(e) => set(K.title, e.target.value)}
            placeholder={lang === 'en' ? 'Page title' : draft.title_en || 'Page title'}
            style={inputStyle}
          />
        </Field>
        <Field label="Section">
          <select value={draft.section_id} onChange={(e) => set('section_id', e.target.value)} style={inputStyle}>
            <option value="">— pick —</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title_en}
              </option>
            ))}
          </select>
        </Field>
        <LangToggle lang={lang} setLang={setLang} />
        <button
          onClick={() => set('published', !draft.published)}
          title="Toggle published / draft"
          style={{
            ...chip,
            color: draft.published ? 'var(--ok)' : 'var(--warn)',
            borderColor: draft.published
              ? 'color-mix(in oklch, var(--ok) 30%, transparent)'
              : 'color-mix(in oklch, var(--warn) 30%, transparent)',
            background: draft.published
              ? 'color-mix(in oklch, var(--ok) 10%, transparent)'
              : 'color-mix(in oklch, var(--warn) 10%, transparent)',
          }}
        >
          {draft.published ? 'Published' : 'Draft'}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {!draft._isNew && (
            <button onClick={onShowHistory} disabled={busy} style={ghostBtn} title="Edit history">
              <Icon.reload size={12} /> History
            </button>
          )}
          <button onClick={onDelete} disabled={busy} style={ghostBtn}>
            <Icon.close size={11} /> {draft._isNew ? 'Discard' : 'Delete'}
          </button>
          <button
            onClick={onSave}
            disabled={busy || !dirty}
            style={{ ...primaryBtn, opacity: busy || !dirty ? 0.55 : 1 }}
          >
            <Icon.check size={12} /> {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <div
        style={{
          padding: '10px 20px',
          display: 'grid',
          gridTemplateColumns: draft._isNew ? '1fr 1fr' : '1fr',
          gap: 12,
        }}
      >
        {draft._isNew && (
          <Field label="Page id / slug">
            <input
              value={draft.id}
              onChange={(e) => set('id', e.target.value)}
              placeholder={slugify(draft.title_en) || 'auto from title'}
              style={{ ...inputStyle, fontFamily: 'var(--mono)' }}
            />
          </Field>
        )}
        <Field label={`Nav blurb (${lang.toUpperCase()})`}>
          <input
            value={draft[K.blurb] || ''}
            onChange={(e) => set(K.blurb, e.target.value)}
            placeholder="One-line summary in the nav"
            style={inputStyle}
          />
        </Field>
      </div>

      {/* Body: editor | live preview */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          padding: '12px 20px 16px',
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--surface)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                flex: 1,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
              }}
            >
              Markdown · {lang.toUpperCase()}
            </div>
            {lang !== 'en' && (
              <>
                <button
                  onClick={generateTr}
                  disabled={generating}
                  style={{ ...primaryBtn, padding: '5px 10px', opacity: generating ? 0.6 : 1 }}
                  title={`Translate the English title, nav blurb, and body to ${lang.toUpperCase()} with Merlin (Claude). Review before saving.`}
                >
                  <Icon.sparkle size={12} /> {generating ? 'Generating…' : `Generate ${lang.toUpperCase()}`}
                </button>
                <button
                  onClick={copyFromEn}
                  disabled={!trPending || generating}
                  style={{ ...ghostBtn, padding: '5px 10px', opacity: trPending && !generating ? 1 : 0.5 }}
                  title={`Copy the English text verbatim into empty ${lang.toUpperCase()} fields (no translation) — a free starting point`}
                >
                  <Icon.paper size={12} /> Copy from EN
                </button>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              onChange={onPickImage}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ ...ghostBtn, padding: '5px 10px' }}
              title="Upload an image and insert it at the cursor"
            >
              <Icon.camera size={12} /> {uploading ? 'Uploading…' : 'Image'}
            </button>
          </div>
          <textarea
            ref={bodyRef}
            value={draft[K.body] || ''}
            onChange={(e) => set(K.body, e.target.value)}
            spellCheck={false}
            placeholder={lang === 'en' ? 'Markdown body' : 'Translated Markdown — leave empty to fall back to English'}
            style={{
              flex: 1,
              minHeight: 0,
              resize: 'none',
              border: 'none',
              outline: 'none',
              padding: '14px 16px',
              fontFamily: 'var(--mono)',
              fontSize: 12.5,
              lineHeight: 1.6,
              color: 'var(--text)',
              background: 'var(--surface)',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--surface)',
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              padding: '8px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            Preview
          </div>
          <div
            style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '18px 22px', fontSize: 14, lineHeight: 1.65 }}
          >
            <DocMarkdown
              src={draft[K.body] || ''}
              onLinkClick={(href, e) => {
                e.preventDefault();
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function HistoryModal({ pageId, current, onClose, onRestore }) {
  const { revisions, loading } = useRevisions(pageId);
  const [sel, setSel] = useState(null);
  const [preview, setPreview] = useState('en');
  const [mode, setMode] = useState('rendered'); // 'rendered' | 'diff'
  const rev = revisions.find((r) => r.id === sel) || revisions[0];
  const fmt = (ts) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };
  const bodyOf = (row) => (preview === 'en' ? row?.body || '' : row?.[`body_${preview}`] || row?.body || '');
  const canDiff = !!current;
  // Diff this version against the CURRENT live body: del = removed since this
  // version, add = added since. `pick` is inlined (not the bodyOf closure) so the
  // memo's deps are exactly [mode, rev, current, preview].
  const diff = useMemo(() => {
    if (mode !== 'diff' || !rev || !current) return null;
    const pick = (row) => (preview === 'en' ? row?.body || '' : row?.[`body_${preview}`] || row?.body || '');
    return diffLines(pick(rev), pick(current));
  }, [mode, rev, current, preview]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(0,0,0,0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(960px, 94vw)',
          height: 'min(680px, 88vh)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          display: 'grid',
          gridTemplateRows: '52px minmax(0,1fr)',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 18px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.reload size={15} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 14, fontWeight: 800 }}>Edit history</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {revisions.length} {revisions.length === 1 ? 'version' : 'versions'}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={ghostBtn}>
            <Icon.close size={12} /> Close
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', minHeight: 0 }}>
          <div
            style={{
              borderRight: '1px solid var(--border)',
              overflow: 'auto',
              padding: 10,
              background: 'var(--surface-2)',
            }}
          >
            {loading ? (
              <div style={{ padding: 16, fontSize: 12.5, color: 'var(--text-dim)' }}>Loading…</div>
            ) : revisions.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12.5, color: 'var(--text-dim)' }}>No saved versions yet.</div>
            ) : (
              revisions.map((r, i) => {
                const active = rev?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSel(r.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'block',
                      padding: '8px 10px',
                      marginBottom: 4,
                      background: active ? 'var(--accent-soft)' : 'transparent',
                      border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text)' }}>
                      {fmt(r.created_at)}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>
                      {i === 0 ? 'Latest' : `${i} version${i === 1 ? '' : 's'} ago`}
                      {r.published === false ? ' · draft' : ''}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {!rev ? (
              <div style={{ padding: 24, fontSize: 13, color: 'var(--text-dim)' }}>Select a version to preview it.</div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 18px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: 700,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {preview === 'en' ? rev.title_en : rev[`title_${preview}`] || rev.title_en}
                  </div>
                  {canDiff && (
                    <div
                      style={{
                        display: 'inline-flex',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        overflow: 'hidden',
                      }}
                    >
                      {[
                        ['rendered', 'Rendered'],
                        ['diff', 'Diff vs current'],
                      ].map(([m, label]) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          style={{
                            padding: '5px 10px',
                            fontSize: 10.5,
                            fontWeight: 700,
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                            border: 'none',
                            background: mode === m ? 'var(--accent)' : 'var(--surface)',
                            color: mode === m ? '#fff' : 'var(--text-dim)',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'inline-flex',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    {EDITOR_LANGS.map((l) => (
                      <button
                        key={l}
                        onClick={() => setPreview(l)}
                        style={{
                          padding: '5px 10px',
                          fontSize: 10.5,
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          border: 'none',
                          background: preview === l ? 'var(--accent)' : 'var(--surface)',
                          color: preview === l ? '#fff' : 'var(--text-dim)',
                        }}
                      >
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => onRestore(rev)}
                    style={primaryBtn}
                    title="Load this version into the editor (then Save to publish)"
                  >
                    <Icon.reload size={12} /> Restore
                  </button>
                </div>
                {mode === 'diff' && diff ? (
                  <DiffView ops={diff} />
                ) : (
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflow: 'auto',
                      padding: '18px 24px',
                      fontSize: 14,
                      lineHeight: 1.65,
                    }}
                  >
                    <DocMarkdown
                      src={bodyOf(rev)}
                      onLinkClick={(href, e) => {
                        e.preventDefault();
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Nav badge: a quiet tag listing the translation bodies a page is still MISSING
// (e.g. "FR DE", "DE"). Those readers see the English body. A page translated
// into every language shows nothing (no badge = the goal state).
function TrBadge({ page }) {
  const missing = TR_LANGS.filter((l) => !(page[`body_${l}`] && String(page[`body_${l}`]).trim()));
  if (missing.length === 0) return null;
  const labels = missing.map((l) => l.toUpperCase());
  return (
    <span
      title={`No ${labels.join(' / ')} body yet — those readers see the English text`}
      style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-faint)' }}
    >
      {labels.join(' ')}
    </span>
  );
}

// Line-level diff renderer for the edit-history "Diff vs current" view.
function DiffView({ ops }) {
  const { add, del } = diffStat(ops);
  const tone = {
    eq: { bg: 'transparent', mark: ' ', color: 'var(--text-soft)' },
    add: { bg: 'color-mix(in oklch, var(--ok) 12%, transparent)', mark: '+', color: 'var(--text)' },
    del: { bg: 'color-mix(in oklch, var(--risk) 12%, transparent)', mark: '−', color: 'var(--text)' },
  };
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '6px 18px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-faint)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <span>Changes since this version</span>
        <span style={{ color: 'var(--ok)' }}>+{add}</span>
        <span style={{ color: 'var(--risk)' }}>
          {'−'}
          {del}
        </span>
        {add === 0 && del === 0 && (
          <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>· identical to current</span>
        )}
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '10px 0',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          lineHeight: 1.55,
        }}
      >
        {ops.map((op, i) => {
          const t = tone[op.type];
          return (
            <div key={i} style={{ display: 'flex', background: t.bg, padding: '0 18px' }}>
              <span style={{ width: 14, flexShrink: 0, color: 'var(--text-faint)', userSelect: 'none' }}>{t.mark}</span>
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: t.color }}>{op.text || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Results of a "Check links" scan — broken internal links grouped by page, each
// page-title clickable to jump straight to that page in the editor.
function LinkCheckModal({ findings, pages, onClose, onOpenPage }) {
  const titleById = Object.fromEntries(pages.map((p) => [p.id, p.title_en || p.id]));
  const byPage = {};
  for (const f of findings) (byPage[f.pageId] ||= []).push(f);
  const pageIds = Object.keys(byPage);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(0,0,0,0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 94vw)',
          maxHeight: '82vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 18px',
            height: 52,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.search size={15} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 14, fontWeight: 800 }}>Link check</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {findings.length === 0 ? 'all good' : `${findings.length} broken`}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={ghostBtn}>
            <Icon.close size={12} /> Close
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 14 }}>
          {findings.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
              <Icon.check size={26} style={{ color: 'var(--ok)' }} />
              <div style={{ marginTop: 8, fontWeight: 700, color: 'var(--text)' }}>No broken internal links</div>
              <div style={{ marginTop: 4 }}>
                Every <code>.md</code> and <code>#anchor</code> link resolves.
              </div>
            </div>
          ) : (
            pageIds.map((pid) => (
              <div key={pid} style={{ marginBottom: 14 }}>
                <button
                  onClick={() => onOpenPage(pid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    padding: '2px 0',
                    color: 'var(--accent)',
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  {titleById[pid] || pid} <Icon.chevR size={11} />
                </button>
                {byPage[pid].map((f, i) => (
                  <div
                    key={i}
                    style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0 4px 10px', fontSize: 12 }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: f.lang !== 'en' ? 'var(--warn)' : 'var(--text-faint)',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                      }}
                    >
                      {f.lang}
                    </span>
                    <code style={{ color: 'var(--risk)', wordBreak: 'break-all' }}>{f.href}</code>
                    <span style={{ color: 'var(--text-dim)' }}>— {f.reason}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const primaryBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  padding: '7px 12px',
  borderRadius: 8,
  cursor: 'pointer',
  color: '#fff',
  background: 'var(--accent)',
  border: '1px solid var(--accent)',
  fontFamily: 'inherit',
};
const ghostBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  padding: '7px 12px',
  borderRadius: 8,
  cursor: 'pointer',
  color: 'var(--text-dim)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  fontFamily: 'inherit',
};
const chip = {
  fontSize: 11.5,
  fontWeight: 700,
  padding: '7px 12px',
  borderRadius: 8,
  cursor: 'pointer',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  fontFamily: 'inherit',
};
