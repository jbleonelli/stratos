// Per-user customisable Metrics layout. Generic over a passed-in
// `catalog`: each entry { id, labelKey, descKey, icon, span, tags,
// Component }. The catalog is owned by Dashboard.jsx so this file
// has no dependency on the wrapped widget components — keeps the
// import graph acyclic.
import React, { useEffect, useState, useMemo } from 'react';
import { Card, Pill, IconBtn } from './primitives.jsx';
import { Icon } from './icons.jsx';
import { useT } from './i18n.js';
import { useSession, updatePreferences } from './auth.js';
import {
  readLayout,
  writeLayout,
  subscribe as subscribeLayout,
  reorderWidget as reorderWidgetStore,
} from './metrics-layout-store.js';
import { CustomChartWidget, NoSettingsPanel } from './MetricsWidgets.jsx';

// Custom (chat-generated) widgets share a single component; the prefix
// lets WidgetGrid spot them without scanning the catalog.
const CUSTOM_PREFIX = 'cust:';
const isCustomId = (id) => typeof id === 'string' && id.startsWith(CUSTOM_PREFIX);

// All widget cells lock to this height so the grid is uniform.
// Tweak in one place if the rows feel too short / tall.
const WIDGET_ROW_HEIGHT = 380;

// ─────────────────────────────────────────────────────────────────
// Layout persistence — read/write goes through metrics-layout-store
// so the hook + the chat-tool path share a single source of truth.
// Layouts are also mirrored to profile.preferences.metricsLayout (per
// orgId) so the order travels with the user across browsers / devices,
// not just the local browser cache.
// ─────────────────────────────────────────────────────────────────
export function useMetricsLayout(userId, orgId, defaults, catalog, profileLayouts) {
  const catalogIds = useMemo(() => new Set(catalog.map((w) => w.id)), [catalog]);
  const [layout, setLayoutState] = useState(() => readLayout(userId, orgId, defaults, catalogIds));
  // The profile snapshot for this org, if the session has one. Used as
  // a tie-breaker on hydrate: if the profile knows the layout, it wins
  // over localStorage (cross-device source of truth).
  const profileLayout = profileLayouts?.[orgId];
  const profileLayoutKey = useMemo(
    () => (Array.isArray(profileLayout) ? profileLayout.join('|') : ''),
    [profileLayout],
  );

  // Reload when identity, catalog, or store-emitted change matches us.
  // If the profile carries a layout for this org, copy it into
  // localStorage first so subsequent reads are consistent.
  useEffect(() => {
    if (Array.isArray(profileLayout) && profileLayout.length) {
      // Only write if it actually differs from what's in localStorage
      // (avoids a redundant write loop after an updatePreferences
      // round-trip).
      const current = readLayout(userId, orgId, defaults, catalogIds);
      const same = current.length === profileLayout.length && current.every((id, i) => id === profileLayout[i]);
      if (!same) writeLayout(userId, orgId, profileLayout);
    }
    setLayoutState(readLayout(userId, orgId, defaults, catalogIds));
    const off = subscribeLayout(({ userId: u, orgId: o }) => {
      if (u === userId && o === orgId) {
        setLayoutState(readLayout(userId, orgId, defaults, catalogIds));
      }
    });
    return off;
  }, [userId, orgId, defaults, catalogIds, profileLayoutKey]);

  const persist = (next) => {
    setLayoutState(next);
    writeLayout(userId, orgId, next);
    // Fire-and-forget profile sync. If it fails (offline, no session,
    // etc.) localStorage stays correct and we'll retry on next change.
    if (userId && orgId) {
      try {
        const all = { ...(profileLayouts || {}), [orgId]: next };
        updatePreferences({ metricsLayout: all }).catch(() => {});
      } catch {
        /* updatePreferences itself threw — ignore */
      }
    }
  };

  return {
    layout,
    addWidget: (id) => {
      if (!layout.includes(id)) persist([...layout, id]);
    },
    removeWidget: (id) => persist(layout.filter((w) => w !== id)),
    moveUp: (id) => {
      const i = layout.indexOf(id);
      if (i <= 0) return;
      const next = layout.slice();
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      persist(next);
    },
    moveDown: (id) => {
      const i = layout.indexOf(id);
      if (i < 0 || i >= layout.length - 1) return;
      const next = layout.slice();
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      persist(next);
    },
    // Drag-to-reorder: move `fromId` to land before/after `toId`.
    // Delegates to the store helper for the localStorage write, then
    // mirrors the new layout to profile.preferences so the order
    // travels with the user across browsers / sessions.
    reorder: (fromId, toId, position = 'before') => {
      const next = reorderWidgetStore(userId, orgId, fromId, toId, position, defaults, catalogIds);
      if (next && userId && orgId) {
        try {
          const all = { ...(profileLayouts || {}), [orgId]: next };
          updatePreferences({ metricsLayout: all }).catch(() => {});
        } catch {
          /* ignore */
        }
      }
    },
    reset: () => persist(defaults.slice()),
  };
}

// ─────────────────────────────────────────────────────────────────
// WidgetGrid — renders the user's chosen widgets with edit chrome
// ─────────────────────────────────────────────────────────────────
export function WidgetGrid({ catalog, defaults, ctx }) {
  const t = useT();
  const session = useSession();
  const userId = session?.userId;
  const orgId = ctx?.orgId;
  // Session-side profile snapshot of layouts (per orgId). Passed
  // through so the hook can prefer it on hydrate AND mirror writes
  // back to it for cross-device persistence.
  const profileLayouts = session?.preferences?.metricsLayout || null;
  const { layout, addWidget, removeWidget, moveUp, moveDown, reorder, reset } = useMetricsLayout(
    userId,
    orgId,
    defaults,
    catalog,
    profileLayouts,
  );
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Drag-to-reorder state. `draggedId` = the widget currently being
  // dragged; `dropTarget` = { id, position: 'before'|'after' } for the
  // widget under the pointer. Both reset on dragend / drop.
  const [draggedId, setDraggedId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  // Flip-card state. The widget id whose settings face is currently
  // showing — null when no widget is flipped. Only one widget can be
  // flipped at a time so we never lose track of which side is up.
  const [flippedId, setFlippedId] = useState(null);
  const toggleFlip = (id) => setFlippedId((cur) => (cur === id ? null : id));

  const catalogById = useMemo(() => Object.fromEntries(catalog.map((w) => [w.id, w])), [catalog]);
  const available = catalog.filter((w) => !layout.includes(w.id));

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 2px',
        }}
      >
        <Icon.grid size={13} style={{ color: 'var(--text-dim)' }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
          }}
        >
          {t('widget.toolbar.title')}
        </span>
        <Pill tone="info">{t('widget.toolbar.count', { n: layout.length })}</Pill>
        <div style={{ flex: 1 }} />
        <button onClick={() => setPickerOpen(true)} style={toolbarBtnStyle(true)}>
          <Icon.plus size={12} />
          {t('widget.toolbar.add')}
        </button>
        <button onClick={() => setEditing((e) => !e)} style={toolbarBtnStyle(editing)}>
          <Icon.cog size={12} />
          {editing ? t('widget.toolbar.done') : t('widget.toolbar.edit')}
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gridAutoRows: WIDGET_ROW_HEIGHT,
          gap: 'var(--pad)',
        }}
      >
        {layout.map((id, idx) => {
          const isCustom = isCustomId(id);
          const def = isCustom ? null : catalogById[id];
          if (!isCustom && (!def || typeof def.Component !== 'function')) return null;
          const Comp = isCustom ? CustomChartWidget : def.Component;
          const span = isCustom ? 'third' : def.span;
          const colSpan = span === 'half' ? 6 : span === 'third' ? 4 : 12;
          const isDragged = draggedId === id;
          const isDropTarget = editing && dropTarget && dropTarget.id === id && draggedId !== id;

          const onDragStart = (e) => {
            if (!editing) return;
            setDraggedId(id);
            // Required for Firefox to actually fire the drag.
            try {
              e.dataTransfer.setData('text/plain', id);
            } catch {}
            e.dataTransfer.effectAllowed = 'move';
          };
          const onDragOver = (e) => {
            if (!editing || !draggedId || draggedId === id) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            // Pick before/after based on which half of the cell the
            // pointer is over (horizontal split because the grid is
            // flow-laid in rows of 3).
            const rect = e.currentTarget.getBoundingClientRect();
            const dx = e.clientX - rect.left;
            const position = dx < rect.width / 2 ? 'before' : 'after';
            if (!dropTarget || dropTarget.id !== id || dropTarget.position !== position) {
              setDropTarget({ id, position });
            }
          };
          const onDrop = (e) => {
            if (!editing || !draggedId) return;
            e.preventDefault();
            const target = dropTarget && dropTarget.id === id ? dropTarget : { id, position: 'after' };
            reorder(draggedId, target.id, target.position);
            setDraggedId(null);
            setDropTarget(null);
          };
          const onDragEnd = () => {
            setDraggedId(null);
            setDropTarget(null);
          };

          // Drop indicator: 3-px accent rule on the side of the cell
          // that the dragged widget would land on. Sits above the
          // widget without taking layout space.
          const indicatorSide = isDropTarget ? dropTarget.position : null;

          const isFlipped = flippedId === id;
          // Resolve the back face. Each catalog entry can opt in via
          // `Settings`; widgets without one fall through to the
          // generic NoSettingsPanel. Custom (chat-generated) charts
          // share the same generic for now.
          const SettingsComp = (!isCustom && def && def.Settings) || NoSettingsPanel;

          return (
            <div
              key={id}
              className={`widget-cell${isFlipped ? ' is-flipped' : ''}`}
              draggable={editing && !isFlipped}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              style={{
                gridColumn: `span ${colSpan} / span ${colSpan}`,
                minWidth: 0,
                // Explicit height so descendants relying on
                // percentage-height (flip stage → front face → Card)
                // resolve cleanly. CSS Grid's `align-self: stretch`
                // can be unreliable when the wrapper also has
                // `perspective` + `position: relative` + a transformed
                // child — content sometimes sees `height: auto` and
                // grows to natural content height (= ~700px for a
                // dense weather widget).
                height: WIDGET_ROW_HEIGHT,
                position: 'relative',
                overflow: 'visible',
                cursor: editing && !isFlipped ? (isDragged ? 'grabbing' : 'grab') : 'default',
                opacity: isDragged ? 0.4 : 1,
                transition: 'opacity .12s, transform .12s',
                transform: isDropTarget ? 'scale(0.99)' : 'none',
                // Perspective gives the flip a real 3D feel.
                perspective: 1200,
              }}
            >
              {indicatorSide && (
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    bottom: 6,
                    [indicatorSide === 'before' ? 'left' : 'right']: -6,
                    width: 4,
                    borderRadius: 4,
                    background: 'var(--accent)',
                    boxShadow: '0 0 12px color-mix(in oklch, var(--accent) 60%, transparent)',
                    zIndex: 10,
                    pointerEvents: 'none',
                  }}
                />
              )}
              {/* Flip-card stage: rotates 180° around Y when flipped. */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  transition: 'transform .55s cubic-bezier(.22, .61, .36, 1)',
                  borderRadius: 'var(--radius)',
                }}
              >
                {/* Front face — the actual widget. */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    display: 'grid',
                    gridTemplateRows: '1fr',
                    overflow: 'hidden',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <WidgetErrorBoundary widgetId={id} onRemove={() => removeWidget(id)}>
                    {isCustom ? <Comp ctx={ctx} customId={id} /> : <Comp ctx={ctx} />}
                  </WidgetErrorBoundary>
                </div>
                {/* Back face — the per-widget settings panel. */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    display: 'grid',
                    gridTemplateRows: '1fr',
                    overflow: 'hidden',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  {/* Mount the settings only when flipped so widgets
                      with state (e.g. data fetchers) don't double-up. */}
                  {isFlipped && <SettingsComp />}
                </div>
              </div>

              {/* Top-right chrome: settings (flips) + close (removes).
                  Always visible; sits on top of either face. */}
              <CardChrome
                isFlipped={isFlipped}
                onToggleSettings={() => toggleFlip(id)}
                onClose={() => removeWidget(id)}
              />
              {editing && !isFlipped && (
                <EditChrome
                  onUp={() => moveUp(id)}
                  onDown={() => moveDown(id)}
                  isFirst={idx === 0}
                  isLast={idx === layout.length - 1}
                />
              )}
            </div>
          );
        })}
      </div>

      {layout.length === 0 && (
        <Card style={{ padding: 32, textAlign: 'center' }}>
          <Icon.grid size={28} style={{ color: 'var(--text-faint)', marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-soft)', marginBottom: 4 }}>
            {t('widget.empty.title')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>{t('widget.empty.body')}</div>
          <button onClick={() => setPickerOpen(true)} style={toolbarBtnStyle(true)}>
            <Icon.plus size={12} />
            {t('widget.toolbar.add')}
          </button>
          <button onClick={reset} style={{ ...toolbarBtnStyle(false), marginLeft: 8 }}>
            <Icon.reload size={12} />
            {t('widget.empty.reset')}
          </button>
        </Card>
      )}

      {pickerOpen && (
        <AddWidgetModal
          available={available}
          onAdd={(id) => {
            addWidget(id);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

function toolbarBtnStyle(active) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    fontSize: 11.5,
    fontWeight: 700,
    background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
    color: active ? 'var(--accent)' : 'var(--text-soft)',
    border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
    borderRadius: 7,
    cursor: 'pointer',
  };
}

// Always-visible top-right chrome. Settings cog flips the card; close
// removes the widget from the layout. Sits above either face and
// matches the surface so it reads as "part of the card", not floating.
function CardChrome({ isFlipped, onToggleSettings, onClose }) {
  const t = useT();
  return (
    <div
      className="widget-chrome"
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 6,
        display: 'inline-flex',
        gap: 2,
        background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: '1px solid color-mix(in oklch, var(--border) 60%, transparent)',
        borderRadius: 8,
        padding: 2,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
      // Stop drag-start when the user grabs a chrome icon (matches the
      // [data-no-drag] convention used elsewhere in the app).
      data-no-drag
      onMouseDown={(e) => e.stopPropagation()}
    >
      <IconBtn
        size={22}
        title={t(isFlipped ? 'widget.chrome.show_widget' : 'widget.chrome.settings')}
        onClick={onToggleSettings}
        active={isFlipped}
      >
        <Icon.cog size={11} />
      </IconBtn>
      <IconBtn size={22} title={t('widget.chrome.remove')} onClick={onClose}>
        <Icon.close size={11} />
      </IconBtn>
    </div>
  );
}

// Edit-mode chrome — keyboard-accessible up/down arrows for users who
// prefer not to drag. Sits at TOP-LEFT so it never collides with
// CardChrome (always at top-right). Drop button is gone — that's now
// the close icon in CardChrome.
function EditChrome({ onUp, onDown, isFirst, isLast }) {
  return (
    <div
      className="widget-chrome"
      data-no-drag
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 6,
        display: 'inline-flex',
        gap: 2,
        background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: '1px solid color-mix(in oklch, var(--border) 60%, transparent)',
        borderRadius: 8,
        padding: 2,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <IconBtn size={22} title="Move up" onClick={onUp} style={{ opacity: isFirst ? 0.35 : 1 }}>
        <svg width={11} height={11} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 12V4M4 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconBtn>
      <IconBtn size={22} title="Move down" onClick={onDown} style={{ opacity: isLast ? 0.35 : 1 }}>
        <svg width={11} height={11} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 4v8M4 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconBtn>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AddWidgetModal — picker overlay listing every catalog entry that
// isn't already in the user's layout.
// ─────────────────────────────────────────────────────────────────
function AddWidgetModal({ available, onAdd, onClose }) {
  const t = useT();
  const [filter, setFilter] = useState('all');
  const tags = ['all', 'featured', 'operational', 'bank', 'live'];

  const filtered = useMemo(
    () => (filter === 'all' ? available : available.filter((w) => w.tags?.includes(filter))),
    [available, filter],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'color-mix(in oklch, black 55%, transparent)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(960px, 96vw)',
          maxHeight: '88vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Icon.grid size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>{t('widget.picker.title')}</div>
          <Pill tone="info">{available.length}</Pill>
          <div style={{ flex: 1 }} />
          <IconBtn size={26} onClick={onClose} title="Close">
            <Icon.close size={12} />
          </IconBtn>
        </div>

        <div
          style={{
            padding: '10px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {tags.map((tg) => {
            const active = filter === tg;
            const n = tg === 'all' ? available.length : available.filter((w) => w.tags?.includes(tg)).length;
            return (
              <button
                key={tg}
                onClick={() => setFilter(tg)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                  borderRadius: 999,
                  cursor: 'pointer',
                }}
              >
                {t(`widget.picker.tag.${tg}`)} <span style={{ opacity: 0.6, fontFamily: 'var(--mono)' }}>{n}</span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            padding: 18,
            overflowY: 'auto',
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {filtered.length === 0 && (
            <div
              style={{ gridColumn: '1 / -1', padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}
            >
              {t('widget.picker.empty')}
            </div>
          )}
          {filtered.map((w) => {
            const Ico = Icon[w.icon] || Icon.panel;
            return (
              <button
                key={w.id}
                onClick={() => {
                  onAdd(w.id);
                }}
                style={{
                  textAlign: 'left',
                  padding: 14,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'border-color .15s, transform .15s, background .15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-line)';
                  e.currentTarget.style.background = 'color-mix(in oklch, var(--accent) 6%, var(--surface-2))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--surface-2)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      borderRadius: 8,
                    }}
                  >
                    <Ico size={14} />
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t(w.labelKey)}</div>
                  <div style={{ flex: 1 }} />
                  {w.tags?.includes('featured') && <Pill tone="accent">{t('widget.picker.tag.featured_pill')}</Pill>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.4 }}>{t(w.descKey)}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                  {(w.tags || [])
                    .filter((tg) => tg !== 'featured')
                    .map((tg) => (
                      <span
                        key={tg}
                        style={{
                          fontSize: 10,
                          padding: '2px 7px',
                          borderRadius: 999,
                          background: 'var(--surface-3)',
                          color: 'var(--text-dim)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {t(`widget.picker.tag.${tg}`)}
                      </span>
                    ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// One bad widget shouldn't take the whole Metrics page down. Wraps
// each cell with a class-component ErrorBoundary so a render-time
// throw renders an inline "broken widget" card with a remove action,
// while every other widget keeps working.
class WidgetErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Surfaces in browser console + Sentry if wired.
    // eslint-disable-next-line no-console
    console.error(`[widget ${this.props.widgetId}] crashed`, error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <Card style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Icon.warn size={13} style={{ color: 'var(--risk)' }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--risk)',
              }}
            >
              Widget error
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 10, lineHeight: 1.4 }}>
            <code style={{ fontFamily: 'var(--mono)' }}>{this.props.widgetId}</code> failed to render. Other widgets are
            unaffected.
          </div>
          {this.props.onRemove && (
            <button
              onClick={this.props.onRemove}
              style={{
                alignSelf: 'flex-start',
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                background: 'var(--surface-2)',
                color: 'var(--text-soft)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
          )}
        </Card>
      );
    }
    return this.props.children;
  }
}
