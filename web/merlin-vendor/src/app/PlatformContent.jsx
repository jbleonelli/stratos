// /platform/content — founder-only editor for overridable UI copy.
//
// First (and currently only) surface: the My Day (Briefing) hero card —
// "3 things need your attention, Jamie." and its subtitle. Text is stored
// cross-tenant in platform_settings (key='myday_content', see
// myday-content.js) and read by every tenant's Briefing.jsx with a
// per-field fallback to the built-in i18n string. Clear a field to revert
// it to the default.
//
// Gating: the nav entry is restricted to jb@leonelli.net via
// visibleToEmails in PlatformApp PILLARS; this component re-checks the
// email as defence-in-depth (RLS still enforces platform-admin write).

import React, { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { useT } from './i18n.js';
import { useSession } from './auth.js';
import { useMyDayContent, saveMyDayContent, MYDAY_CONTENT_FIELDS } from './myday-content.js';

const ALLOWED_EMAILS = ['jb@leonelli.net'];

const primaryBtn = {
  fontSize: 12,
  fontWeight: 700,
  padding: '8px 16px',
  borderRadius: 8,
  background: 'var(--accent)',
  color: '#fff',
  border: '1px solid var(--accent)',
  cursor: 'pointer',
};
const ghostBtn = {
  fontSize: 12,
  fontWeight: 700,
  padding: '8px 16px',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  cursor: 'pointer',
};

export function PlatformContentPage() {
  const t = useT();
  const session = useSession();
  const { value, ready } = useMyDayContent();

  const [local, setLocal] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  // Seed the form once the stored value hydrates.
  useEffect(() => {
    const seed = {};
    for (const { id } of MYDAY_CONTENT_FIELDS) seed[id] = value?.[id] ?? '';
    setLocal(seed);
  }, [value]);

  const mine = (session?.email || '').toLowerCase();
  if (!ALLOWED_EMAILS.includes(mine)) {
    return (
      <div style={{ padding: 'var(--pad)' }}>
        <Card pad>
          <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Not available for this account.</div>
        </Card>
      </div>
    );
  }

  const stored = (id) => value?.[id] ?? '';
  const dirty = MYDAY_CONTENT_FIELDS.some(({ id }) => (local[id] ?? '') !== stored(id));

  function setField(id, v) {
    setLocal((p) => ({ ...p, [id]: v }));
    setErr('');
    setSaved(false);
  }

  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    setErr('');
    setSaved(false);
    try {
      await saveMyDayContent(local);
      setSaved(true);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    if (busy) return;
    const seed = {};
    for (const { id } of MYDAY_CONTENT_FIELDS) seed[id] = stored(id);
    setLocal(seed);
    setErr('');
    setSaved(false);
  }

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      {/* Header */}
      <Card pad>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon.paper size={15} style={{ color: 'var(--accent)' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Content</div>
            <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>
              Edit customer-facing copy. Changes apply to every tenant. Clear a field to restore its default.
            </div>
          </div>
        </div>
      </Card>

      {/* My Day hero card */}
      <Card pad>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Icon.monitor size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>My Day — “need your attention” card</div>
          {dirty && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 6px',
                background: 'color-mix(in oklch, var(--warn) 14%, transparent)',
                border: '1px solid color-mix(in oklch, var(--warn) 35%, transparent)',
                color: 'var(--warn)',
                borderRadius: 999,
                letterSpacing: 0.2,
                textTransform: 'uppercase',
              }}
            >
              Unsaved
            </span>
          )}
          {saved && !dirty && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ok, #2a9d6e)' }}>Saved ✓</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 16 }}>
          The hero on MONITOR → My day. Placeholders <code>{'{n}'}</code> (count) and <code>{'{name}'}</code> (first
          name) are filled in automatically.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {MYDAY_CONTENT_FIELDS.map(({ id, i18nKey, label, hint }) => {
            const def = t(i18nKey, { n: 3, name: 'Jamie' });
            return (
              <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{label}</label>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{hint}</div>
                <textarea
                  value={local[id] ?? ''}
                  onChange={(e) => setField(id, e.target.value)}
                  placeholder={def}
                  rows={id === 'eyebrow' || id.includes('title') ? 2 : 3}
                  disabled={busy || !ready}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    lineHeight: 1.5,
                  }}
                />
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                  Default: <span style={{ fontStyle: 'italic' }}>{def}</span>
                </div>
              </div>
            );
          })}
        </div>

        {err && <div style={{ marginTop: 14, fontSize: 12, color: 'var(--danger, #d4453e)' }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={save} disabled={busy || !dirty} style={{ ...primaryBtn, opacity: busy || !dirty ? 0.5 : 1 }}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button onClick={reset} disabled={busy || !dirty} style={{ ...ghostBtn, opacity: busy || !dirty ? 0.5 : 1 }}>
            Reset
          </button>
        </div>
      </Card>
    </div>
  );
}
