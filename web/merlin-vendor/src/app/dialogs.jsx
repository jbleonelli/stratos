// dialogs.jsx — app-wide imperative dialogs (confirm / alert / prompt), rendered
// as branded Merlin modals. Replaces native window.confirm/alert/prompt, which
// paint browser chrome ("merlin.adaptiv.systems says…") that breaks the app look.
//
// One <DialogHost/> mounts once near the app root; the imperative helpers return
// a Promise that resolves when the user responds — so a call site is a one-line
// swap that keeps the existing control flow:
//
//   if (!(await confirmDialog('Delete this? This cannot be undone.'))) return;
//   await alertDialog(err.message);
//   const name = await promptDialog({ title: 'Trigger name', defaultValue: '' });
//
// Each helper accepts a plain string (used as the body) or an options object:
//   { title, body, confirmLabel, cancelLabel, danger, defaultValue, placeholder }
// confirm → Promise<boolean> · alert → Promise<void> · prompt → Promise<string|null>.

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MerlinAvatar } from './primitives.jsx';
import { useT } from './i18n.js';

// ── Module-level queue (so calls work even before the host mounts) ──
const subscribers = new Set();
const pending = [];
let current = null;
let _seq = 0;

function emit() {
  subscribers.forEach((fn) => fn());
}
function promote() {
  current = pending.shift() || null;
  emit();
}
function request(spec) {
  return new Promise((resolve) => {
    pending.push({ ...spec, resolve, id: ++_seq });
    if (!current) promote();
    else emit();
  });
}
function respond(value) {
  const c = current;
  current = null;
  if (c) c.resolve(value);
  promote();
}

const norm = (arg) => (typeof arg === 'string' ? { body: arg } : arg || {});

export function confirmDialog(arg) {
  return request({ kind: 'confirm', ...norm(arg) });
}
export function alertDialog(arg) {
  return request({ kind: 'alert', ...norm(arg) });
}
export function promptDialog(arg) {
  return request({ kind: 'prompt', ...norm(arg) });
}

// ── The single mounted host — renders the active dialog, branded ──
export function DialogHost() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subscribers.add(fn);
    if (current || pending.length) fn();
    return () => subscribers.delete(fn);
  }, []);
  if (!current) return null;
  // Keyed so prompt input state resets between dialogs.
  return <DialogView key={current.id} d={current} />;
}

function DialogView({ d }) {
  const t = useT();
  const [value, setValue] = useState(d.kind === 'prompt' ? (d.defaultValue ?? '') : '');

  const cancelVal = d.kind === 'confirm' ? false : d.kind === 'prompt' ? null : undefined;
  const cancel = () => respond(cancelVal);
  const accept = () => respond(d.kind === 'confirm' ? true : d.kind === 'prompt' ? value : undefined);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') cancel();
      // Enter accepts on confirm/alert; on prompt the Enter is handled by the input.
      else if (e.key === 'Enter' && d.kind !== 'prompt') accept();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.id, value]);

  const confirmLabel = d.confirmLabel || (d.kind === 'alert' ? t('dialog.ok') : t('dialog.confirm'));
  const showCancel = d.kind !== 'alert';
  const danger = !!d.danger;

  const node = (
    <div
      onMouseDown={cancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10010,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}
    >
      <div
        role="alertdialog"
        aria-label={d.title || d.body || 'Dialog'}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--surface)',
          border: '1px solid var(--accent)',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.28), 0 0 0 2px color-mix(in oklch, var(--accent) 12%, transparent)',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <MerlinAvatar size={32} />
          <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)', lineHeight: 1.3 }}>
            {d.title || d.body}
          </div>
        </div>
        {d.title && d.body && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>{d.body}</div>
        )}

        {d.kind === 'prompt' && (
          <input
            autoFocus
            value={value}
            placeholder={d.placeholder || ''}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') accept();
            }}
            style={{
              width: '100%',
              marginTop: 14,
              padding: '9px 11px',
              fontSize: 13,
              border: '1px solid var(--border)',
              borderRadius: 9,
              background: 'var(--surface-2)',
              color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          {showCancel && (
            <button
              onClick={cancel}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 9,
                cursor: 'pointer',
              }}
            >
              {d.cancelLabel || t('action.cancel')}
            </button>
          )}
          <button
            onClick={accept}
            autoFocus={d.kind !== 'prompt'}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              background: danger ? 'var(--risk)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(node, document.body);
}
