// /platform/internal/translations — Adaptiv-side editor for the dynamic
// French translation layer.
//
// Two tabs:
//   Cache    — table of text_translations rows. Edit / delete inline.
//              Use when a specific phrase came out wrong and needs
//              correcting (or when you want Haiku to retry under a
//              new glossary by deleting the cached row).
//   Glossary — single-textarea editor for the SYSTEM_PROMPT vocab line.
//              Use to stop the next translation from being wrong, e.g.
//              "Use 'non-conformité' for breach in cold-chain context".
//
// Together they let an admin fix wrong translations end-to-end:
// glossary stops future bad translations, cache cleanup wipes the old
// ones so Haiku regenerates under the new vocab.

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Pill } from './primitives.jsx';
import { useTranslationsCache, upsertTranslation, deleteTranslation } from './translations-data.js';
import { useGlossary, saveGlossary, DEFAULT_GLOSSARY_LINE } from './translation-glossary.js';
import { confirmDialog, alertDialog } from './dialogs.jsx';

export function PlatformTranslationsPage() {
  const [tab, setTab] = useState('cache');
  return (
    <div style={{ padding: 24, paddingBottom: 96, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Translations</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Edit the dynamic French translation layer. Fixes here flow through <code>/api/translate</code> to every client
          on next read.
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: 3,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          alignSelf: 'flex-start',
        }}
      >
        <TabBtn active={tab === 'cache'} onClick={() => setTab('cache')}>
          Cache
        </TabBtn>
        <TabBtn active={tab === 'glossary'} onClick={() => setTab('glossary')}>
          Glossary
        </TabBtn>
      </div>

      {tab === 'cache' ? <CacheTab /> : <GlossaryTab />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Cache tab
// ────────────────────────────────────────────────────────────────────

function CacheTab() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(q.trim());
      setOffset(0);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const { rows, total, loading, error, refresh } = useTranslationsCache({
    q: debounced,
    lang: 'fr',
    limit: LIMIT,
    offset,
  });

  const [showAdd, setShowAdd] = useState(false);

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(total, offset + rows.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="search"
          placeholder="Search source text or translation…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ ...textInput, flex: 1, maxWidth: 400 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? 'Loading…' : `${pageStart}–${pageEnd} of ${total}`}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={refresh} disabled={loading} style={btnSubtle}>
          Refresh
        </button>
        <button onClick={() => setShowAdd(true)} style={btnPrimary}>
          + Add override
        </button>
      </div>

      {error && (
        <Card>
          <div style={{ padding: 12, color: 'var(--risk, #c33)', fontSize: 13 }}>{error}</div>
        </Card>
      )}

      <Card>
        {rows.length === 0 && !loading ? (
          <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            {debounced ? `No matches for "${debounced}".` : 'Cache is empty.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={th}>Source (EN)</th>
                <th style={th}>Translation (FR)</th>
                <th style={th}>Model</th>
                <th style={{ ...th, textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <CacheRow key={`${row.text_hash}|${row.target_lang}`} row={row} onChanged={refresh} />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {total > LIMIT && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            disabled={offset === 0 || loading}
            style={btnSubtle}
          >
            ← Prev
          </button>
          <button
            onClick={() => setOffset(offset + LIMIT)}
            disabled={offset + LIMIT >= total || loading}
            style={btnSubtle}
          >
            Next →
          </button>
        </div>
      )}

      {showAdd && (
        <AddDialog
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function CacheRow({ row, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.translated);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await upsertTranslation(row.source_text, draft.trim(), row.target_lang);
      setEditing(false);
      onChanged();
    } catch (e) {
      alertDialog(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    if (
      !(await confirmDialog({
        body: `Delete this cached translation? On next read, Haiku will regenerate it.\n\n${row.source_text}\n→ ${row.translated}`,
        danger: true,
      }))
    )
      return;
    setBusy(true);
    try {
      await deleteTranslation(row.text_hash, row.target_lang);
      onChanged();
    } catch (e) {
      alertDialog(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td style={{ ...td, maxWidth: 320, wordBreak: 'break-word' }}>{row.source_text}</td>
      <td style={{ ...td, maxWidth: 320, wordBreak: 'break-word' }}>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(2, Math.ceil(draft.length / 60))}
            style={{ ...textInput, width: '100%', resize: 'vertical' }}
            autoFocus
          />
        ) : (
          row.translated
        )}
      </td>
      <td style={{ ...td, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {row.model === 'manual-override' ? <Pill tone="info">override</Pill> : row.model || '—'}
      </td>
      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {editing ? (
          <>
            <button
              onClick={() => {
                setEditing(false);
                setDraft(row.translated);
              }}
              disabled={busy}
              style={btnSubtle}
            >
              Cancel
            </button>{' '}
            <button onClick={save} disabled={busy || !draft.trim()} style={btnPrimary}>
              Save
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} disabled={busy} style={btnSubtle}>
              Edit
            </button>{' '}
            <button onClick={remove} disabled={busy} style={btnDanger}>
              Delete
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

function AddDialog({ onClose, onSaved }) {
  const [source, setSource] = useState('');
  const [translated, setTranslated] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    if (!source.trim() || !translated.trim()) return;
    setBusy(true);
    setError('');
    try {
      await upsertTranslation(source.trim(), translated.trim(), 'fr');
      onSaved();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          width: 520,
          maxWidth: 'calc(100vw - 32px)',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Add translation override</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 12 }}>
          Pre-seeds the cache so Haiku is never called for this exact source string.
        </p>

        <label style={fieldLabel}>Source (English)</label>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={2}
          style={{ ...textInput, width: '100%', marginBottom: 12 }}
          placeholder="e.g. HACCP cold-chain · breach in 22m"
        />

        <label style={fieldLabel}>Translation (French)</label>
        <textarea
          value={translated}
          onChange={(e) => setTranslated(e.target.value)}
          rows={2}
          style={{ ...textInput, width: '100%', marginBottom: 12 }}
          placeholder="e.g. Chaîne du froid HACCP · non-conformité dans 22 min"
        />

        {error && <div style={{ color: 'var(--risk, #c33)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={busy} style={btnSubtle}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !source.trim() || !translated.trim()} style={btnPrimary}>
            {busy ? 'Saving…' : 'Save override'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Glossary tab
// ────────────────────────────────────────────────────────────────────

function GlossaryTab() {
  const { glossary, ready } = useGlossary();
  const [draft, setDraft] = useState(glossary.glossary_line);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setDraft(glossary.glossary_line);
  }, [glossary.glossary_line]);

  const effective = useMemo(() => (draft.trim() ? draft.trim() : DEFAULT_GLOSSARY_LINE), [draft]);
  const dirty = (glossary.glossary_line || '') !== draft;

  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    setOk(false);
    try {
      await saveGlossary(draft);
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDraft('');
    setOk(false);
    setError('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>System-prompt vocab line</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.5 }}>
            One free-form sentence injected into <code>/api/translate</code>'s system prompt. Tells Haiku which French
            terms to prefer in this context. Affects only <strong>new</strong> translations — existing cache entries
            stay until you edit or delete them in the Cache tab.
          </p>

          <label style={fieldLabel}>Override (leave empty for default)</label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder={DEFAULT_GLOSSARY_LINE}
            disabled={!ready}
            style={{ ...textInput, width: '100%', resize: 'vertical' }}
          />

          <details>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
              Effective vocab line Haiku will see
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                fontSize: 12,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {effective}
            </pre>
          </details>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            {ok && <span style={{ color: 'var(--ok, #0a0)', fontSize: 13 }}>Saved</span>}
            {error && <span style={{ color: 'var(--risk, #c33)', fontSize: 13 }}>{error}</span>}
            <div style={{ flex: 1 }} />
            <button onClick={reset} disabled={busy || !draft} style={btnSubtle}>
              Reset to default
            </button>
            <button onClick={save} disabled={busy || !dirty || !ready} style={btnPrimary}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: 16, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Tip:</strong> after editing the glossary, clear the wrong cached
          translations from the <em>Cache</em> tab so Haiku regenerates them under the new vocab. Otherwise the cache
          keeps serving the old translations until you fix or delete them one by one.
        </div>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-dim)',
        border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
        borderRadius: 6,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

const fieldLabel = { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 };
const textInput = {
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface-2, #fafafa)',
  fontFamily: 'inherit',
  fontSize: 13,
  color: 'var(--text)',
  boxSizing: 'border-box',
};
const th = { padding: '10px 14px', fontWeight: 600, fontSize: 12, letterSpacing: 0.2, textTransform: 'uppercase' };
const td = { padding: '10px 14px', verticalAlign: 'top' };
const btnSubtle = {
  padding: '6px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
};
const btnPrimary = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 6,
  background: 'var(--accent)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
};
const btnDanger = {
  padding: '6px 12px',
  border: '1px solid color-mix(in oklch, var(--risk, #c33) 50%, var(--border))',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--risk, #c33)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
};
