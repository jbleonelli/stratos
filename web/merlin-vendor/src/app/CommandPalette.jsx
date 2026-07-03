// Global command palette — opens via ⌘K / Ctrl+K or clicking the
// topbar search bar. Searches across rooms / floors / buildings /
// devices / people / SLAs / routes / zones in the active org via
// the searchEntities helper.
//
// Result selection routing:
//   device → navigateTo(/device/<external_id>)
//   room/floor/building/zone → set merlinHyperPending + go home
//     (HypervisorPage consumes the hint on mount)
//   route → set merlinHyperPending with routeId + go home
//   sla/person → set merlinView ('insights' / 'admin') + go home
//
// Open/close + keyboard nav state is local to this component. The
// useCommandPalette hook below exposes a stable {open, setOpen}
// pair and the global ⌘K listener for the topbar trigger.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { useT } from './i18n.js';
import { useSession } from './auth.js';
import { navigateTo } from './use-route.js';
import { searchEntities, flattenResults, totalCount, kindLabel } from './command-palette-data.js';

// One module-level latch — multiple App.jsx instances should share
// the same open state across re-renders.
const subscribers = new Set();
let openState = false;
function emit() {
  for (const fn of subscribers) fn(openState);
}

export function openCommandPalette() {
  if (openState) return;
  openState = true;
  emit();
}
export function closeCommandPalette() {
  if (!openState) return;
  openState = false;
  emit();
}

// React hook exposing the open state + a global keydown listener.
// Mount this once at the App.jsx root so ⌘K / Ctrl+K always works
// regardless of which view is rendered. The keystrokes don't fire
// when focus is in an input/textarea elsewhere unless meta/ctrl is
// held — so typing 'k' in an input won't pop the palette open.
export function useCommandPalette() {
  const [open, setOpen] = useState(openState);
  useEffect(() => {
    const fn = (next) => setOpen(next);
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }, []);
  useEffect(() => {
    function onKey(e) {
      // ⌘K (mac) or Ctrl+K (everywhere else). e.metaKey is the
      // Command key on mac; e.ctrlKey is Control elsewhere.
      const cmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (cmdK) {
        e.preventDefault();
        if (openState) closeCommandPalette();
        else openCommandPalette();
        return;
      }
      // ESC closes — bind globally (not just on the input) so the
      // palette still closes if the user clicked away from the input
      // before hitting ESC. Only when open, so we don't intercept
      // ESC for unrelated UI (modals, drawers, etc.).
      if (e.key === 'Escape' && openState) {
        e.preventDefault();
        closeCommandPalette();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, openPalette: openCommandPalette, closePalette: closeCommandPalette };
}

const DEBOUNCE_MS = 200;

export function CommandPalette({ open, onClose, onSetView }) {
  const t = useT();
  const session = useSession();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  // Reset state on open so the palette doesn't reopen with stale
  // results from a previous session.
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setSelectedIdx(0);
      // Autofocus after the modal mounts.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced search. Cancels prior in-flight result if a newer
  // keystroke arrives by ignoring stale resolutions via the latch.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await searchEntities(trimmed, { orgId: session?.organizationId });
      if (cancelled) return;
      setResults(res);
      setSelectedIdx(0);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, session?.organizationId]);

  const flat = useMemo(() => flattenResults(results), [results]);
  const total = useMemo(() => totalCount(results), [results]);

  const handleNavigate = useCallback(
    (item) => {
      if (!item) return;
      const n = item.navigate || {};
      if (n.type === 'url') {
        navigateTo(n.url);
      } else if (n.type === 'view') {
        // App.jsx owns the `view` React state; calling onSetView from
        // here moves it immediately. localStorage is set as a bonus so
        // the next reload starts on the same surface.
        try {
          localStorage.setItem('merlinView', n.view);
        } catch {}
        onSetView?.(n.view);
      } else if (n.type === 'hyper') {
        // Hint payload picked up by HypervisorPage on mount. Three
        // possible keys; all optional. buildingId opens that building
        // in the picker; selectId pre-selects a tree node; routeId
        // opens the RouteDetailCard.
        //
        // Route via `view='hypervisor'` (not 'operations') because
        // App.jsx's OperationsPage call only passes initialSection
        // when view !== 'operations'.
        try {
          const hint = {
            buildingId: n.buildingId || null,
            selectId: n.selectId || null,
            routeId: n.routeId || null,
            ts: Date.now(),
          };
          localStorage.setItem('merlinHyperPending', JSON.stringify(hint));
          localStorage.setItem('merlinView', 'hypervisor');
        } catch {}
        onSetView?.('hypervisor');
      }
      onClose();
    },
    [onClose],
  );

  // Arrow-up/down + Enter shortcuts. ESC closes (delegated via the
  // modal's overlay click but bound here too for input-focus case).
  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, Math.max(0, flat.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleNavigate(flat[selectedIdx]);
    }
  }

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'color-mix(in oklch, #000 38%, transparent)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '12vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 92%)',
          maxHeight: '72vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 18px 60px rgba(0,0,0,0.32)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.search size={14} style={{ color: 'var(--text-dim)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder={t('palette.placeholder')}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          />
          {loading && (
            <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
              {t('palette.loading')}
            </span>
          )}
          <kbd
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--text-dim)',
              background: 'var(--surface-3)',
              border: '1px solid var(--border)',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            esc
          </kbd>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Empty: no query yet — show a hint of what's searchable.
              Below-empty: query has results — render them grouped.
              Bottom: query but no matches. */}
          {!query.trim() && <EmptyHint t={t} />}
          {query.trim() && results && total === 0 && !loading && (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5 }}>
              {t('palette.no_results', { q: query.trim() })}
            </div>
          )}
          {results && total > 0 && (
            <ResultGroups
              results={results}
              flat={flat}
              selectedIdx={selectedIdx}
              setSelectedIdx={setSelectedIdx}
              onSelect={handleNavigate}
              t={t}
            />
          )}
        </div>

        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 10.5,
            color: 'var(--text-dim)',
          }}
        >
          <FooterHint label="↑↓" text={t('palette.foot.nav')} />
          <FooterHint label="↵" text={t('palette.foot.open')} />
          <FooterHint label="esc" text={t('palette.foot.close')} />
          <div style={{ flex: 1 }} />
          {total > 0 && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{t('palette.count', { n: total })}</span>}
        </div>
      </div>
    </div>
  );
}

function FooterHint({ label, text }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <kbd
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--text-dim)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          padding: '1px 5px',
          borderRadius: 3,
        }}
      >
        {label}
      </kbd>
      <span>{text}</span>
    </span>
  );
}

function EmptyHint({ t }) {
  const items = [
    { icon: 'building', label: t('palette.hint.rooms') },
    { icon: 'gateway', label: t('palette.hint.devices') },
    { icon: 'people', label: t('palette.hint.people') },
    { icon: 'shield', label: t('palette.hint.slas') },
    { icon: 'map', label: t('palette.hint.routes') },
  ];
  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.15,
        }}
      >
        {t('palette.hint.heading')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map((it) => {
          const IconC = Icon[it.icon] || Icon.search;
          return (
            <span
              key={it.icon}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 9px',
                borderRadius: 999,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                fontSize: 11,
                color: 'var(--text-soft)',
              }}
            >
              <IconC size={10} style={{ color: 'var(--accent)' }} />
              {it.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ResultGroups({ results, selectedIdx, setSelectedIdx, onSelect, t }) {
  // Compose ordered groups; skip empties. Track the offset into
  // `flat` so each row knows its global index for keyboard nav.
  const groups = [
    { id: 'rooms', label: t('palette.group.rooms'), items: results.rooms, icon: 'building' },
    { id: 'devices', label: t('palette.group.devices'), items: results.devices, icon: 'gateway' },
    { id: 'people', label: t('palette.group.people'), items: results.people, icon: 'people' },
    { id: 'slas', label: t('palette.group.slas'), items: results.slas, icon: 'shield' },
    { id: 'routes', label: t('palette.group.routes'), items: results.routes, icon: 'map' },
    { id: 'zones', label: t('palette.group.zones'), items: results.zones, icon: 'map' },
  ].filter((g) => g.items.length > 0);

  let cursor = 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {groups.map((g) => {
        const IconC = Icon[g.icon] || Icon.search;
        const rows = g.items.map((it) => {
          const myIdx = cursor++;
          return { it, myIdx };
        });
        return (
          <div key={g.id}>
            <div
              style={{
                padding: '8px 14px 4px',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: 0.15,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <IconC size={9} />
              {g.label}
              <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{g.items.length}</span>
            </div>
            {rows.map(({ it, myIdx }) => (
              <ResultRow
                key={it.id}
                item={it}
                active={selectedIdx === myIdx}
                onHover={() => setSelectedIdx(myIdx)}
                onClick={() => onSelect(it)}
                t={t}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ResultRow({ item, active, onHover, onClick }) {
  return (
    <button
      onMouseEnter={onHover}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 14px',
        background: active ? 'var(--accent-soft)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text)',
        fontFamily: 'inherit',
        textAlign: 'left',
        borderLeft: `3px solid ${active ? 'var(--accent)' : 'transparent'}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {item.title}
        </span>
        {item.subtitle && <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{item.subtitle}</span>}
      </div>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: 0.15,
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          padding: '1px 6px',
          borderRadius: 4,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}
      >
        {kindLabel(item.kind)}
      </span>
    </button>
  );
}
