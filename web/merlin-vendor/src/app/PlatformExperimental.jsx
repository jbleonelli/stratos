// /platform/experimental — Adaptiv-side governance of experimental
// feature flags. Migrated 2026-05-12 from per-tenant Admin → Features
// to platform-wide control: a flag is either on for everyone or off
// for everyone, decided by Adaptiv. The legacy merlin_config rows
// (per-org) still exist but are no longer read.
//
// Storage: public.platform_settings, key='feature_flags' (same table
// the ads kill switch uses, migration 076). RLS lets any authed user
// read but only platform admins write — perfect fit for "every
// tenant reads what Adaptiv set."
//
// Adding a new flag:
//   1. New default in DEFAULT_FEATURE_FLAGS in feature-flags.js
//   2. Read it via useFeatureFlags().<flag> in the consuming code
//   3. Add a FLAG_DEFINITIONS entry below for the toggle UI

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { useT } from './i18n.js';
import { useFeatureFlags, saveFeatureFlags, DEFAULT_FEATURE_FLAGS } from './feature-flags.js';
import {
  useMaintenanceMode,
  setMaintenanceMode,
  useMyDayHidden,
  setMyDayHidden,
  fetchModelDefaults,
  setModelDefaults,
} from './platform-settings.js';
import { AI_MODEL_OPTIONS } from './platform-data.js';
import { useSession } from './auth.js';
import { MaintenancePage } from './MaintenancePage.jsx';

// One row per flag in DEFAULT_FEATURE_FLAGS. Drives the toggle UI.
// Keep the order intentional — most-recent / most-experimental at
// top so platform admins see what's in flux first.
const FLAG_DEFINITIONS = [
  {
    key: 'signupEnabled',
    title: 'Public sign-up on the login page',
    body: 'Show the "Create a new account" link + OR divider on the login page. Defaults on. Flip off to make Merlin invite-only — the login form still works for existing tenants, and bookmarked /signup URLs surface a friendly "sign-up is closed" notice instead of the form.',
  },
];

export function PlatformExperimentalPage() {
  const t = useT();
  const flags = useFeatureFlags();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Local mirror so we can do staged toggles (flip → unsaved pill →
  // Save / Cancel). Same pattern as the ads kill switch.
  const [local, setLocal] = useState(flags);
  useEffect(() => {
    setLocal(flags);
  }, [flags]);

  const dirty = JSON.stringify(local) !== JSON.stringify(flags);

  function flip(key) {
    if (busy) return;
    setLocal((prev) => ({ ...prev, [key]: !prev[key] }));
    setErr('');
  }
  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    setErr('');
    try {
      await saveFeatureFlags(local);
    } catch (e) {
      setLocal(flags);
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    if (busy) return;
    setLocal(flags);
    setErr('');
  }

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero />
      <Card pad>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Icon.bolt size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('platform.experimental.title')}</div>
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
              {t('platform.experimental.unsaved')}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {dirty && (
            <>
              <button onClick={cancel} disabled={busy} style={ghostBtn}>
                {t('platform.experimental.cancel')}
              </button>
              <button onClick={save} disabled={busy} style={primaryBtn}>
                {busy ? t('platform.experimental.saving') : t('platform.experimental.save')}
              </button>
            </>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
          {t('platform.experimental.body')}
        </div>
        {FLAG_DEFINITIONS.map((def, i) => (
          <FlagRow
            key={def.key}
            def={def}
            value={!!local[def.key]}
            defaultValue={!!DEFAULT_FEATURE_FLAGS[def.key]}
            onChange={() => flip(def.key)}
            busy={busy}
            isFirst={i === 0}
          />
        ))}
        {err && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 10px',
              background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
              color: 'var(--risk)',
              border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            {err}
          </div>
        )}
      </Card>

      {/* Maintenance mode — Merlin Owner only. Renders null for
          everyone else (platform admins included). The setting itself
          is in platform_settings; UI gate is just so non-owners don't
          even see the toggle. */}
      <MaintenanceModeCard />

      <MyDayVisibilityCard />

      <AiModelDefaultsCard />
    </div>
  );
}

// Platform-wide default LLM models (Super-Admin only). Writes platform_settings
// key 'model_defaults'; resolveOrgLlm() applies it to any org without a per-org
// override. Empty = the hardcoded default in claude-client.ts.
function AiModelDefaultsCard() {
  const t = useT();
  const session = useSession();

  const [fast, setFast] = useState('');
  const [thoughtful, setThoughtful] = useState('');
  const [loaded, setLoaded] = useState({ fast: '', thoughtful: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchModelDefaults()
      .then((d) => {
        if (cancelled) return;
        setFast(d.fast);
        setThoughtful(d.thoughtful);
        setLoaded(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Super-Admin-only — early return AFTER hooks (rules-of-hooks).
  if (!session?.isSuperAdmin) return null;

  const dirty = fast !== loaded.fast || thoughtful !== loaded.thoughtful;

  const save = async () => {
    setErr('');
    setBusy(true);
    try {
      await setModelDefaults({ fast, thoughtful });
      setLoaded({ fast, thoughtful });
    } catch {
      setErr(t('platform.experimental.aimodels.err'));
    } finally {
      setBusy(false);
    }
  };

  const selectStyle = {
    padding: '8px 10px',
    fontSize: 12.5,
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    fontFamily: 'inherit',
    minWidth: 260,
  };

  return (
    <Card pad>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon.cog size={14} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('platform.experimental.aimodels.title')}</div>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 14px', maxWidth: 640 }}>
        {t('platform.experimental.aimodels.subtitle')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 150 }}>
            {t('platform.experimental.aimodels.role.fast')}
          </span>
          <select value={fast} disabled={busy} onChange={(e) => setFast(e.target.value)} style={selectStyle}>
            <option value="">{t('platform.experimental.aimodels.code_default')}</option>
            {AI_MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 150 }}>
            {t('platform.experimental.aimodels.role.thoughtful')}
          </span>
          <select
            value={thoughtful}
            disabled={busy}
            onChange={(e) => setThoughtful(e.target.value)}
            style={selectStyle}
          >
            <option value="">{t('platform.experimental.aimodels.code_default')}</option>
            {AI_MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        onClick={save}
        disabled={!dirty || busy}
        style={{
          padding: '8px 16px',
          fontSize: 12.5,
          fontWeight: 700,
          background: dirty ? 'var(--accent)' : 'var(--surface-2)',
          color: dirty ? '#fff' : 'var(--text-dim)',
          border: '1px solid ' + (dirty ? 'var(--accent)' : 'var(--border)'),
          borderRadius: 8,
          cursor: dirty && !busy ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
        }}
      >
        {busy ? t('platform.experimental.aimodels.saving') : t('platform.experimental.aimodels.save')}
      </button>

      {err && <div style={{ fontSize: 12, color: 'var(--risk)', marginTop: 10 }}>{err}</div>}
    </Card>
  );
}

function MaintenanceModeCard() {
  const t = useT();
  const session = useSession();
  const maintenance = useMaintenanceMode();
  const [customMessage, setCustomMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [previewing, setPreviewing] = useState(false);
  // Two-step confirm for the OFF→ON transition only. Flipping ON
  // signs everyone except the Owner out of every tenant, so make the
  // Owner explicitly acknowledge it. OFF transitions are safe and
  // skip the confirm.
  const [confirmingEnable, setConfirmingEnable] = useState(false);

  useEffect(() => {
    setCustomMessage(maintenance.message || '');
  }, [maintenance.message]);

  // Hard gate — Merlin Owner only.
  if (!session?.isMerlinOwner) return null;
  if (!maintenance.ready) return null;

  async function toggle(next) {
    setBusy(true);
    setErr('');
    try {
      await setMaintenanceMode({
        enabled: next,
        message: next ? customMessage.trim() || null : null,
        enabledByEmail: session?.email || null,
      });
      setConfirmingEnable(false);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  // Click handler for the main toggle button. Disable path runs
  // immediately; enable path opens the confirmation modal first.
  function onToggleClick() {
    if (busy) return;
    if (enabled) {
      toggle(false);
    } else {
      setErr('');
      setConfirmingEnable(true);
    }
  }

  // Update just the message while maintenance is already on, without
  // toggling state. Useful when JB realizes mid-window he wants to
  // update the explanation text shown to users.
  async function updateMessageOnly() {
    setBusy(true);
    setErr('');
    try {
      await setMaintenanceMode({
        enabled: true,
        message: customMessage.trim() || null,
        enabledByEmail: maintenance.enabledByEmail || session?.email || null,
      });
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const enabled = maintenance.enabled;
  // Whether the text in the textarea differs from what's persisted.
  const messageDirty = (customMessage || '') !== (maintenance.message || '');

  return (
    <Card pad>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Icon.shield size={14} style={{ color: enabled ? 'var(--risk)' : 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('platform.experimental.maintenance.title')}</div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            padding: '2px 8px',
            background: enabled
              ? 'color-mix(in oklch, var(--risk) 14%, transparent)'
              : 'color-mix(in oklch, var(--ok) 12%, transparent)',
            border: enabled
              ? '1px solid color-mix(in oklch, var(--risk) 38%, transparent)'
              : '1px solid color-mix(in oklch, var(--ok) 32%, transparent)',
            color: enabled ? 'var(--risk)' : 'var(--ok)',
            borderRadius: 999,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          {enabled ? 'ENABLED' : 'OFF'}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.55 }}>
        {t('platform.experimental.maintenance.body')}
      </div>

      <div style={{ fontSize: 12, marginBottom: 12, color: enabled ? 'var(--risk)' : 'var(--text-dim)' }}>
        {enabled ? t('platform.experimental.maintenance.toggle_on') : t('platform.experimental.maintenance.toggle_off')}
      </div>

      {/* Custom message — always editable, regardless of toggle state.
          When OFF, edits are saved on Enable click. When ON, a separate
          "Save message" button appears when the textarea is dirty so
          you can update the displayed text mid-window. */}
      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            marginBottom: 6,
          }}
        >
          <span>{t('platform.experimental.maintenance.message_label')}</span>
          <button
            onClick={() => setPreviewing(true)}
            disabled={busy}
            style={{
              ...ghostBtn,
              fontSize: 10,
              padding: '3px 8px',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            👁 {t('platform.experimental.maintenance.button_preview')}
          </button>
        </label>
        <textarea
          rows={4}
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder={t('platform.experimental.maintenance.message_placeholder')}
          disabled={busy}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 12,
            lineHeight: 1.5,
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        {enabled && messageDirty && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={updateMessageOnly}
              disabled={busy}
              style={{
                ...primaryBtn,
                fontSize: 11,
                padding: '5px 11px',
                opacity: busy ? 0.6 : 1,
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              {busy ? '…' : t('platform.experimental.maintenance.button_update_msg')}
            </button>
          </div>
        )}
      </div>

      {enabled && maintenance.enabledAt && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            marginBottom: 12,
            padding: '8px 10px',
            background: 'var(--surface-2, color-mix(in oklch, var(--bg) 60%, transparent))',
            borderRadius: 6,
          }}
        >
          {t('platform.experimental.maintenance.enabled_at', {
            when: new Date(maintenance.enabledAt).toLocaleString(),
            email: maintenance.enabledByEmail || '—',
          })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onToggleClick}
          disabled={busy}
          style={{
            ...(enabled ? dangerBtn : primaryBtn),
            opacity: busy ? 0.6 : 1,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy
            ? '…'
            : enabled
              ? t('platform.experimental.maintenance.button_disable')
              : t('platform.experimental.maintenance.button_enable')}
        </button>
        <div style={{ fontSize: 10.5, color: 'var(--warn)', flex: 1, lineHeight: 1.4 }}>
          {t('platform.experimental.maintenance.warning')}
        </div>
      </div>

      {err && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 10px',
            background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
            color: 'var(--risk)',
            border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          {err}
        </div>
      )}

      {/* Confirmation modal — only shown on OFF→ON transition. Forces
          the Owner to acknowledge that enabling will sign every other
          user out of every tenant. Cancel just dismisses; Enable runs
          the actual toggle. */}
      {confirmingEnable &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 20100,
              background: 'rgba(0, 0, 0, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !busy) setConfirmingEnable(false);
            }}
          >
            <div
              style={{
                maxWidth: 460,
                width: '100%',
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 22,
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Icon.shield size={16} style={{ color: 'var(--risk)' }} />
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {t('platform.experimental.maintenance.confirm_title')}
                </div>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-soft)', marginBottom: 18 }}>
                {t('platform.experimental.maintenance.confirm_body')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  onClick={() => {
                    if (!busy) setConfirmingEnable(false);
                  }}
                  disabled={busy}
                  style={{ ...ghostBtn, cursor: busy ? 'default' : 'pointer' }}
                >
                  {t('platform.experimental.maintenance.confirm_cancel')}
                </button>
                <button
                  onClick={() => toggle(true)}
                  disabled={busy}
                  style={{
                    ...dangerBtn,
                    opacity: busy ? 0.6 : 1,
                    cursor: busy ? 'default' : 'pointer',
                  }}
                >
                  {busy ? '…' : t('platform.experimental.maintenance.confirm_button')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Full-screen preview overlay — renders the actual MaintenancePage
          with the current textarea text (NOT the persisted text), so JB
          can iterate on copy before hitting Enable. Doesn't touch live
          state. Click "Close preview" to return. */}
      {previewing &&
        createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 20000 }}>
            <MaintenancePage customMessage={customMessage.trim() || null} />
            <div
              style={{
                position: 'absolute',
                top: 24,
                right: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '4px 10px',
                  background: 'color-mix(in oklch, var(--warn) 18%, transparent)',
                  color: 'var(--warn)',
                  border: '1px solid color-mix(in oklch, var(--warn) 45%, transparent)',
                  borderRadius: 999,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                {t('platform.experimental.maintenance.preview_banner')}
              </div>
              <button
                onClick={() => setPreviewing(false)}
                style={{
                  ...primaryBtn,
                  fontSize: 12,
                  padding: '6px 14px',
                }}
              >
                {t('platform.experimental.maintenance.preview_close')}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </Card>
  );
}

function FlagRow({ def, value, defaultValue, onChange, busy, isFirst }) {
  const t = useT();
  return (
    <div
      style={{
        borderTop: isFirst ? 'none' : '1px solid var(--border)',
        padding: '14px 0',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{def.title}</div>
          {value !== defaultValue && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                padding: '1px 6px',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-line)',
                borderRadius: 999,
                letterSpacing: 0.2,
                textTransform: 'uppercase',
              }}
            >
              {t('platform.experimental.overridden')}
            </span>
          )}
        </div>
        <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>{def.body}</div>
        <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
          key: {def.key} · default: {String(defaultValue)}
        </div>
      </div>
      <button
        onClick={onChange}
        disabled={busy}
        aria-pressed={value}
        style={{
          flexShrink: 0,
          width: 44,
          height: 24,
          borderRadius: 999,
          background: value ? 'var(--accent)' : 'var(--surface-3)',
          border: '1px solid ' + (value ? 'var(--accent)' : 'var(--border)'),
          position: 'relative',
          cursor: busy ? 'wait' : 'pointer',
          padding: 0,
          transition: 'background .12s, border-color .12s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 1,
            left: value ? 21 : 1,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left .14s',
          }}
        />
      </button>
    </div>
  );
}

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
          {t('platform.experimental.eyebrow')}
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
          {t('platform.experimental.heading')}
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 720, lineHeight: 1.55 }}>
          {t('platform.experimental.subheading')}
        </p>
      </div>
    </Card>
  );
}

// Founder kill switch for the customer-app "My Day" (MONITOR → Briefing)
// surface. Reachable only via the /platform/experimental section, which is
// itself gated to jb@leonelli.net in PlatformApp's PILLARS — so effectively
// only JB sees/flips this. Writes are RLS-gated to platform admins too.
function MyDayVisibilityCard() {
  const session = useSession();
  const myday = useMyDayHidden();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!session?.isMerlinOwner) return null;
  if (!myday.ready) return null;

  const hidden = myday.hidden;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await setMyDayHidden(!hidden);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card pad>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Icon.sparkle size={14} style={{ color: hidden ? 'var(--risk)' : 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>My Day visibility</div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            padding: '2px 8px',
            background: hidden
              ? 'color-mix(in oklch, var(--risk) 14%, transparent)'
              : 'color-mix(in oklch, var(--ok) 12%, transparent)',
            border: hidden
              ? '1px solid color-mix(in oklch, var(--risk) 38%, transparent)'
              : '1px solid color-mix(in oklch, var(--ok) 32%, transparent)',
            color: hidden ? 'var(--risk)' : 'var(--ok)',
            borderRadius: 999,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          {hidden ? 'HIDDEN' : 'VISIBLE'}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.55 }}>
        Hides the <strong>My day</strong> tab (MONITOR → Briefing) for <strong>all users across every tenant</strong>.
        Anyone who lands on it — default landing, saved view, or a fresh sign-in — is redirected to <strong>Now</strong>
        . The page isn&apos;t deleted; flip this back to restore it instantly. Applies in realtime, no reload needed.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={toggle}
          disabled={busy}
          style={{
            ...(hidden ? primaryBtn : dangerBtn),
            opacity: busy ? 0.6 : 1,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? '…' : hidden ? 'Show My Day' : 'Hide My Day'}
        </button>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', flex: 1, lineHeight: 1.4 }}>
          Affects every signed-in user immediately.
        </div>
      </div>
      {err && <div style={{ marginTop: 10, fontSize: 11, color: 'var(--risk)' }}>{err}</div>}
    </Card>
  );
}

const ghostBtn = {
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  background: 'transparent',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const primaryBtn = {
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--accent)',
  color: '#fff',
  border: '1px solid var(--accent)',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const dangerBtn = {
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--risk, #DC2626)',
  color: '#fff',
  border: '1px solid var(--risk, #DC2626)',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
