// Admin — Locations / Ecosystem management (tree, map, cards, edit modals) + the
// Zones modal it opens. Extracted from Admin.jsx (G2 split; same recipe as
// AdminSlas.jsx). Zones moves with Locations because LocationCard is its only
// caller — leaving it in Admin.jsx would make Admin ↔ AdminLocations circular.
import React, { useState, useMemo, createContext, useContext } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card, AdaptivLoader } from './primitives.jsx';
import { Input, btnPrimary, btnGhost, btnDanger, formStyle } from './admin-ui.tsx';
import {
  useBuildingsForActiveOrg,
  createBuilding,
  createEcosystem,
  deleteLocation,
  updateLocation,
  getDevicesForLocation,
  breadcrumbFor,
  descendantIds,
  buildTree,
  isAncestor,
  useLocationHistory,
  isDbBacked,
} from './custom-locations.js';
import {
  useZonesForLocation,
  createZone,
  updateZone,
  deleteZone,
  addStandardFloor,
  groupByFloor,
  sortedFloors,
  ZONE_KINDS,
  zoneKindLabel,
  useAllZoneCounts,
} from './zones-data.js';
import { useRoutes, routeRunsOn } from './routes-data.js';
import { useOverrides, todayStr, dowOf } from './route-overrides-data.js';
import { useRecentActions } from './incident-actions.js';
import { LocationsMap } from './LocationsMap.jsx';
import { LocationDrawer } from './LocationDrawer.jsx';
import { confirmDialog, alertDialog } from './dialogs.jsx';
import { useT } from './i18n.js';

// ─────────────────────────── Locations ───────────────────────────

export function LocationsSection() {
  const t = useT();
  // Scope to the active org. Was useAllBuildings() which returns the
  // union of STATIC_BUILDINGS (Meridian/IMF/FEB/MHC — hardcoded demo
  // catalog in data.js) + customCache. JB on PRO TEST owner session
  // saw FEB, IMF, Meridian, and St. Mary's all in his Locations list.
  // useBuildingsForActiveOrg filters static defs to only those with a
  // matching DB row for this org — so demos stay correct (their rows
  // exist) and PRO TEST sees only its own. PRO TEST smoke-test
  // 2026-05-18, same family as #430-443.
  const buildings = useBuildingsForActiveOrg();
  const list = Object.values(buildings);
  const tree = useMemo(() => buildTree(buildings), [buildings]);
  const zoneCounts = useAllZoneCounts();
  const { routes } = useRoutes();
  const overrides = useOverrides();
  const recentActions = useRecentActions(200); // wide window so subtree rollups aren't truncated
  const [mode, setMode] = useState(null);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all'); // 'all' | 'building' | 'ecosystem'
  const [view, setView] = useState('tree'); // 'tree' | 'map' — Phase 14g
  const [draggingId, setDraggingId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const dragCtx = useMemo(() => ({ draggingId, hoverId, setDraggingId, setHoverId }), [draggingId, hoverId]);

  const filter = useMemo(() => computeLocationFilter(tree, search, kindFilter), [tree, search, kindFilter]);
  const filterActive = !!filter;
  const matchCount = filter ? filter.visible.size : list.length;

  const onKey = (e) => {
    if (e.key === 'Escape') {
      setSearch('');
      setKindFilter('all');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon.building size={14} style={{ color: 'var(--text-dim)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.section.locations')}</div>
          <Pill>{filterActive ? `${matchCount} / ${list.length}` : list.length}</Pill>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: 'flex',
              gap: 2,
              background: 'var(--surface-2)',
              padding: 2,
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            {[
              ['tree', 'admin.locations.tree'],
              ['map', 'admin.locations.map'],
            ].map(([v, key]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  background: view === v ? 'var(--surface)' : 'transparent',
                  color: view === v ? 'var(--text)' : 'var(--text-dim)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  boxShadow: view === v ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  textTransform: 'capitalize',
                }}
              >
                {t(key)}
              </button>
            ))}
          </div>
          <button onClick={() => setMode('building')} style={btnGhost}>
            {t('admin.locations.add_building')}
          </button>
          <button onClick={() => setMode('ecosystem')} style={btnPrimary}>
            {t('admin.locations.add_ecosystem')}
          </button>
        </div>

        <LocationSearch
          search={search}
          onSearch={setSearch}
          kindFilter={kindFilter}
          onKind={setKindFilter}
          onKeyDown={onKey}
        />

        {mode === 'building' && <BuildingForm onClose={() => setMode(null)} />}
        {mode === 'ecosystem' && <EcosystemForm onClose={() => setMode(null)} />}

        {view === 'tree' && (
          <DragCtx.Provider value={dragCtx}>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
              {tree.map((node) => (
                <LocationTreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  zoneCounts={zoneCounts}
                  routes={routes}
                  overrides={overrides}
                  actions={recentActions}
                  filter={filter}
                />
              ))}
              {filterActive && matchCount === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)', fontSize: 12.5 }}>
                  {(() => {
                    const tmpl = t('admin.locations.no_match', { clear: 'XCLEARX' });
                    const [pre, post = ''] = tmpl.split('XCLEARX');
                    return (
                      <>
                        {pre}
                        <button
                          onClick={() => {
                            setSearch('');
                            setKindFilter('all');
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: 12.5,
                            fontWeight: 600,
                            padding: 0,
                          }}
                        >
                          {t('admin.locations.clear_filters')}
                        </button>
                        {post}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </DragCtx.Provider>
        )}
        {view === 'map' && <LocationsMap buildings={buildings} filter={filter} />}
      </Card>
    </div>
  );
}

function LocationSearch({ search, onSearch, kindFilter, onKind, onKeyDown }) {
  const t = useT();
  const kinds = [
    { id: 'all', label: t('admin.locations.kind.all') },
    { id: 'building', label: t('admin.locations.kind.buildings') },
    { id: 'ecosystem', label: t('admin.locations.kind.ecosystems') },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}
      >
        <Icon.search size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder={t('admin.locations.search_placeholder')}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={onKeyDown}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--text)',
            fontSize: 12.5,
            fontFamily: 'inherit',
          }}
        />
        {search && (
          <button
            onClick={() => onSearch('')}
            title={t('admin.locations.clear_esc')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              fontSize: 14,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ×
          </button>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 2,
          background: 'var(--surface-2)',
          padding: 2,
          borderRadius: 8,
          border: '1px solid var(--border)',
        }}
      >
        {kinds.map((k) => (
          <button
            key={k.id}
            onClick={() => onKind(k.id)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              background: kindFilter === k.id ? 'var(--surface)' : 'transparent',
              color: kindFilter === k.id ? 'var(--text)' : 'var(--text-dim)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              boxShadow: kindFilter === k.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Computes the set of visible node ids + the set of ancestors that
// should be force-expanded when a filter is active. Returns null when
// no filter applies (empty search, kind = 'all') so callers can skip
// the work entirely. A node is visible if it matches name+kind OR if
// any of its descendants do — ancestors show up to keep the path to
// each match reachable, and get auto-expanded so matches are visible.
function computeLocationFilter(tree, search, kindFilter) {
  const trimmed = (search || '').trim().toLowerCase();
  if (!trimmed && kindFilter === 'all') return null;
  const visible = new Set();
  const forceExpand = new Set();
  const walk = (node, ancestors) => {
    let anyDescMatches = false;
    for (const child of node.children || []) {
      if (walk(child, [...ancestors, node.id])) anyDescMatches = true;
    }
    const matchesName = !trimmed || (node.name || '').toLowerCase().includes(trimmed);
    const matchesKind = kindFilter === 'all' || node.kind === kindFilter;
    const selfMatches = matchesName && matchesKind;
    if (selfMatches || anyDescMatches) {
      visible.add(node.id);
      for (const a of ancestors) {
        visible.add(a);
        forceExpand.add(a);
      }
      return true;
    }
    return false;
  };
  for (const root of tree) walk(root, []);
  return { visible, forceExpand };
}

// Phase 14e: drag-to-reparent context. The LocationsSection owns the
// dragging/hover state and every tree node subscribes via useContext.
// Module-level state would be cheaper but wouldn't re-render hover
// targets — context keeps it declarative.
const DragCtx = createContext({
  draggingId: null,
  hoverId: null,
  setDraggingId: () => {},
  setHoverId: () => {},
});

// Phase 14c: persist expand/collapse choice per-node in localStorage so the
// tree shape survives reloads. Per-browser only — upgrading to
// profile.preferences for cross-device sync is a future phase.
const EXPAND_STATE_KEY = 'merlin-admin-location-expand';
function loadExpandState() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(EXPAND_STATE_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveExpandState(state) {
  try {
    localStorage.setItem(EXPAND_STATE_KEY, JSON.stringify(state));
  } catch {}
}

function LocationTreeNode({ node, depth, zoneCounts, routes, overrides, actions, filter }) {
  const tT = useT();
  // Hydrate initial expand state from localStorage (user's choice) falling
  // back to the default "auto-expand two levels deep" rule for nodes we
  // haven't seen before.
  const [expanded, setExpanded] = useState(() => {
    const saved = loadExpandState();
    return node.id in saved ? !!saved[node.id] : depth < 2;
  });
  const hasChildren = (node.children || []).length > 0;
  const isEco = node.kind === 'ecosystem';

  const toggle = () => {
    setExpanded((v) => {
      const next = !v;
      const current = loadExpandState();
      saveExpandState({ ...current, [node.id]: next });
      return next;
    });
  };

  // useContext must run before any early return (rules-of-hooks) — the filter
  // return just below would otherwise make this hook conditional.
  const drag = useContext(DragCtx);

  // Phase 14b: honor active filter. When the tree is being searched, skip
  // nodes not in the visible set and force-expand ancestors of matches.
  if (filter && !filter.visible.has(node.id)) return null;
  const effectiveExpanded = filter?.forceExpand.has(node.id) ? true : expanded;

  // Phase 14e: drag-to-reparent. A node becomes draggable when its row is
  // DB-backed (so updateLocation will succeed). Only ecosystems accept
  // drops — buildings can't be parents. Validity check blocks both self-
  // and descendant-drops before the drop fires.
  const canDrag = isDbBacked(node.id);
  const canDropHere =
    isEco &&
    isDbBacked(node.id) &&
    drag.draggingId &&
    drag.draggingId !== node.id &&
    !isAncestor(drag.draggingId, node.id);
  const isHovering = canDropHere && drag.hoverId === node.id;

  const onDragStart = (e) => {
    if (!canDrag) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
    drag.setDraggingId(node.id);
  };
  const onDragEnd = () => {
    drag.setDraggingId(null);
    drag.setHoverId(null);
  };
  const onDragOver = (e) => {
    if (!canDropHere) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (drag.hoverId !== node.id) drag.setHoverId(node.id);
  };
  const onDragLeave = () => {
    if (drag.hoverId === node.id) drag.setHoverId(null);
  };
  const onDrop = async (e) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain') || drag.draggingId;
    drag.setDraggingId(null);
    drag.setHoverId(null);
    if (!droppedId || droppedId === node.id) return;
    try {
      await updateLocation(droppedId, { parentId: node.id });
    } catch (ex) {
      alertDialog(ex.message || tT('admin.locations.rehome_failed'));
    }
  };

  return (
    <>
      <div
        style={{
          marginLeft: depth * 20,
          marginBottom: 8,
          outline: isHovering ? '2px dashed var(--accent)' : 'none',
          outlineOffset: 3,
          borderRadius: 10,
          opacity: drag.draggingId === node.id ? 0.5 : 1,
          transition: 'opacity .12s',
        }}
        draggable={canDrag}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {isEco ? (
          <EcosystemTreeHeader
            node={node}
            expanded={effectiveExpanded}
            hasChildren={hasChildren}
            onToggle={toggle}
            zoneCounts={zoneCounts}
            routes={routes}
            overrides={overrides}
            actions={actions}
          />
        ) : (
          <LocationCard building={node} />
        )}
      </div>
      {isEco &&
        effectiveExpanded &&
        (node.children || []).map((child) => (
          <LocationTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            zoneCounts={zoneCounts}
            routes={routes}
            overrides={overrides}
            actions={actions}
            filter={filter}
          />
        ))}
    </>
  );
}

function EcosystemTreeHeader({ node, expanded, hasChildren, onToggle, zoneCounts, routes, overrides, actions }) {
  const t = useT();
  const allBldgs = useBuildingsForActiveOrg();
  const ids = descendantIds(node.id);
  const buildingCount = [...ids].filter((id) => id !== node.id && allBldgs[id]?.kind === 'building').length;
  const zoneSum = [...ids].reduce((sum, id) => sum + (zoneCounts[id] || 0), 0);
  const subtreeRoutes = routes.filter((r) => ids.has(r.location_id));
  const routeCount = subtreeRoutes.length;
  // Today's view: which subtree routes run today, and how many have
  // active overrides (either today-dated or permanent-starting-<=today).
  const today = todayStr();
  const dow = dowOf(today);
  const runningTodayCount = subtreeRoutes.filter((r) => r.active !== false && routeRunsOn(r, dow)).length;
  const subtreeRouteIds = new Set(subtreeRoutes.map((r) => r.id));
  const activeSubtreeOverrides = overrides.filter(
    (o) => subtreeRouteIds.has(o.route_id) && (o.date === today || (o.permanent && o.date <= today)),
  );
  const activeOverrides = activeSubtreeOverrides.length;
  // Phase 14f: SLA-at-risk rollup. A route is "at risk" when it
  //   (a) has a configured SLA threshold (sla_threshold_min set), AND
  //   (b) had today's work dropped or reassigned via a non-note override.
  // The union is what the facility manager actually cares about — work
  // that was supposed to happen under an SLA and got perturbed.
  const slaRouteIds = new Set(subtreeRoutes.filter((r) => r.sla_threshold_min != null).map((r) => r.id));
  const atRiskCount = activeSubtreeOverrides.filter((o) => slaRouteIds.has(o.route_id) && o.action !== 'note').length;
  // Human actions taken today anywhere in the subtree (Phase 10a-2).
  // Pre-Phase-10a-2 rows have location_id = null and are skipped.
  const actionsToday = (actions || []).filter(
    (a) => a.location_id && ids.has(a.location_id) && (a.created_at || '').slice(0, 10) === today,
  ).length;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: 'color-mix(in oklch, var(--accent) 6%, var(--surface-2))',
        border: '1px solid var(--accent-line)',
        borderRadius: 10,
      }}
    >
      <button
        onClick={onToggle}
        disabled={!hasChildren}
        style={{
          width: 20,
          height: 20,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: hasChildren ? 'pointer' : 'default',
          color: hasChildren ? 'var(--text-soft)' : 'var(--text-faint)',
        }}
      >
        <Icon.chevR
          size={11}
          style={{
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform .15s',
            opacity: hasChildren ? 1 : 0.25,
          }}
        />
      </button>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          background: 'linear-gradient(135deg, #2185D0, #20286D)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon.map size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{node.name}</div>
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--text-dim)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.addr || '—'}
        </div>
      </div>
      <Pill tone="info">{t('admin.locations.ecosystem_pill')}</Pill>
      {node.custom && <Pill tone="accent">{t('admin.locations.custom_pill')}</Pill>}
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          fontFamily: 'var(--mono)',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>
          {t(buildingCount === 1 ? 'admin.locations.subtree.buildings_one' : 'admin.locations.subtree.buildings_many', {
            n: buildingCount,
          })}{' '}
          · {t('admin.locations.subtree.zones', { n: zoneSum })} ·{' '}
          {t('admin.locations.subtree.routes', { n: routeCount })}
        </span>
        {runningTodayCount > 0 && (
          <span style={{ color: 'var(--ok)' }}>· {t('admin.locations.subtree.today', { n: runningTodayCount })}</span>
        )}
        {activeOverrides > 0 && (
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
            ·{' '}
            {t(
              activeOverrides === 1
                ? 'admin.locations.subtree.overrides_one'
                : 'admin.locations.subtree.overrides_many',
              { n: activeOverrides },
            )}
          </span>
        )}
        {actionsToday > 0 && (
          <span style={{ color: 'var(--warn)' }}>
            ·{' '}
            {t(actionsToday === 1 ? 'admin.locations.subtree.actions_one' : 'admin.locations.subtree.actions_many', {
              n: actionsToday,
            })}
          </span>
        )}
        {atRiskCount > 0 && (
          <span style={{ color: 'var(--risk)', fontWeight: 700 }}>
            · {t('admin.locations.subtree.at_risk', { n: atRiskCount })}
          </span>
        )}
      </div>
      {isDbBacked(node.id) && <EcosystemInlineActions node={node} />}
    </div>
  );
}

function EcosystemInlineActions({ node }) {
  const t = useT();
  const buildings = useBuildingsForActiveOrg();
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const parents = Object.values(buildings).map((l) => ({ id: l.id, name: l.name, kind: l.kind }));
  // Drawer expects DB-shape fields (parent_id snake_case, addr).
  const dbShape = { ...node, parent_id: node.parentId, addr: node.addr };
  return (
    <>
      <button onClick={() => setEditOpen(true)} style={{ ...btnGhost, padding: '4px 8px', fontSize: 11 }}>
        {t('admin.locations.edit')}
      </button>
      <button
        onClick={async () => {
          if (
            !(await confirmDialog({ body: t('admin.locations.delete_eco_confirm', { name: node.name }), danger: true }))
          )
            return;
          try {
            await deleteLocation(node.id);
          } catch (ex) {
            alertDialog(ex.message || t('admin.locations.delete_failed'));
          }
        }}
        style={{ ...btnDanger, padding: '4px 8px', fontSize: 11 }}
      >
        {t('admin.locations.delete')}
      </button>
      <button onClick={() => setHistoryOpen(true)} style={{ ...btnGhost, padding: '4px 8px', fontSize: 11 }}>
        {t('admin.locations.history')}
      </button>
      {editOpen && (
        <LocationDrawer
          location={dbShape}
          parents={parents}
          isNew={false}
          onUpdate={(id, patch) => updateLocation(id, patch)}
          onDelete={(id) => deleteLocation(id)}
          onClose={() => setEditOpen(false)}
          onChanged={() => setEditOpen(false)}
        />
      )}
      {historyOpen && <HistoryModal location={node} onClose={() => setHistoryOpen(false)} />}
    </>
  );
}

function LocationCard({ building: b }) {
  const t = useT();
  const buildings = useBuildingsForActiveOrg();
  const isEco = b.kind === 'ecosystem';
  const devices = getDevicesForLocation(b.id);
  const zones = useZonesForLocation(isEco ? null : b.id);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const crumbs = breadcrumbFor(b.id).slice(0, -1); // drop `b` itself
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: isEco
              ? 'linear-gradient(135deg, #2185D0, #20286D)'
              : 'linear-gradient(135deg, #FF00B2, #20286D)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isEco ? <Icon.map size={14} /> : <Icon.building size={14} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{b.name}</div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {crumbs.length > 0 && (
              <span style={{ color: 'var(--accent)' }}>{crumbs.map((c) => c.name).join(' › ')} › </span>
            )}
            {b.addr || (crumbs.length > 0 ? '' : '—')}
          </div>
        </div>
        {isEco && <Pill tone="info">{t('admin.locations.ecosystem_pill')}</Pill>}
        {b.custom && <Pill tone="accent">{t('admin.locations.custom_pill')}</Pill>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        {(() => {
          const sitesOrFloors = isEco
            ? t(
                (b.branches || b.sites?.length || 0) === 1
                  ? 'admin.locations.subtree.sites_one'
                  : 'admin.locations.subtree.sites_many',
                { n: b.branches || b.sites?.length || 0 },
              )
            : t((b.floors || 0) === 1 ? 'admin.locations.subtree.floors_one' : 'admin.locations.subtree.floors_many', {
                n: b.floors || 0,
              });
          const displays = (b.displays || 0) + devices.filter((d) => /display|sdg|screen/i.test(d.type || '')).length;
          const sensors = (b.sensors || 0) + devices.filter((d) => !/display|sdg|screen/i.test(d.type || '')).length;
          return (
            <>
              {sitesOrFloors} · {t('admin.locations.subtree.displays', { n: displays })} ·{' '}
              {t(sensors === 1 ? 'admin.locations.subtree.sensors_one' : 'admin.locations.subtree.sensors_many', {
                n: sensors,
              })}
              {!isEco && (
                <>
                  {' '}
                  ·{' '}
                  {t(zones.length === 1 ? 'admin.locations.subtree.zones_one' : 'admin.locations.subtree.zones', {
                    n: zones.length,
                  })}
                </>
              )}
            </>
          );
        })()}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
        {!isEco && (
          <button onClick={() => setZonesOpen(true)} style={{ ...btnGhost, padding: '4px 8px', fontSize: 11 }}>
            {t('admin.locations.manage_zones')}
          </button>
        )}
        {isDbBacked(b.id) && (
          <button onClick={() => setEditOpen(true)} style={{ ...btnGhost, padding: '4px 8px', fontSize: 11 }}>
            {t('admin.locations.edit')}
          </button>
        )}
        {isDbBacked(b.id) && (
          <button
            onClick={async () => {
              if (!(await confirmDialog({ body: t('admin.locations.delete_confirm', { name: b.name }), danger: true })))
                return;
              try {
                await deleteLocation(b.id);
              } catch (ex) {
                alertDialog(ex.message || t('admin.locations.delete_failed'));
              }
            }}
            style={{ ...btnDanger, padding: '4px 8px', fontSize: 11 }}
          >
            {t('admin.locations.delete')}
          </button>
        )}
        {isDbBacked(b.id) && (
          <button onClick={() => setHistoryOpen(true)} style={{ ...btnGhost, padding: '4px 8px', fontSize: 11 }}>
            {t('admin.locations.history')}
          </button>
        )}
      </div>
      {zonesOpen && <ZonesModal building={b} onClose={() => setZonesOpen(false)} />}
      {editOpen && (
        <LocationDrawer
          location={{ ...b, parent_id: b.parentId, addr: b.addr }}
          parents={Object.values(buildings).map((l) => ({ id: l.id, name: l.name, kind: l.kind }))}
          isNew={false}
          onUpdate={(id, patch) => updateLocation(id, patch)}
          onDelete={(id) => deleteLocation(id)}
          onClose={() => setEditOpen(false)}
          onChanged={() => setEditOpen(false)}
        />
      )}
      {historyOpen && <HistoryModal location={b} onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}

// Phase 13a: append-only audit log for a single location.
function HistoryModal({ location, onClose }) {
  const t = useT();
  const { rows, loading } = useLocationHistory(location.id);
  const buildings = useBuildingsForActiveOrg();
  const labelForLocationId = (id) => buildings[id]?.name || id || '—';

  const describe = (r) => {
    switch (r.action) {
      case 'created':
        return (
          <span>
            {t('admin.history.created')} <strong>{r.after_value}</strong>
          </span>
        );
      case 'deleted': {
        const tmpl = t('admin.history.deleted', { prev: 'XPREVX' });
        const [pre, post = ''] = tmpl.split('XPREVX');
        return (
          <span>
            {pre}
            <strong>{r.before_value}</strong>
            {post}
          </span>
        );
      }
      case 'renamed':
        return (
          <span>
            {t('admin.history.renamed')} <strong>{r.before_value || '—'}</strong> → <strong>{r.after_value}</strong>
          </span>
        );
      case 'rehomed':
        return (
          <span>
            {t('admin.history.rehomed')} <strong>{labelForLocationId(r.before_value)}</strong> →{' '}
            <strong>{labelForLocationId(r.after_value)}</strong>
          </span>
        );
      default:
        return <span>{r.action}</span>;
    }
  };
  const actionLabel = (a) => {
    const map = {
      created: 'admin.history.action.created',
      deleted: 'admin.history.action.deleted',
      renamed: 'admin.history.action.renamed',
      rehomed: 'admin.history.action.rehomed',
    };
    return map[a] ? t(map[a]) : a;
  };
  const toneFor = (a) => (a === 'deleted' ? 'risk' : a === 'created' ? 'ok' : a === 'rehomed' ? 'accent' : 'info');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,16,32,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 100%)',
          maxHeight: '80vh',
          overflow: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Icon.building size={14} style={{ color: 'var(--text-dim)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.history.modal_title', { name: location.name })}</div>
          <Pill>{rows.length}</Pill>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={btnGhost}>
            {t('admin.history.close')}
          </button>
        </div>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <AdaptivLoader size="sm" />
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)', fontSize: 12.5 }}>
            {t('admin.history.empty')}
          </div>
        )}
        <div style={{ display: 'grid', gap: 6 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '90px minmax(0, 1fr) auto',
                gap: 10,
                alignItems: 'center',
                padding: '10px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 9,
              }}
            >
              <Pill tone={toneFor(r.action)}>{actionLabel(r.action)}</Pill>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {describe(r)}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>
                  {t('admin.history.by', { actor: r.actor_name || t('admin.history.unknown') })}
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                {new Date(r.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BuildingForm({ onClose }) {
  const t = useT();
  const [form, setForm] = useState({ id: '', name: '', addr: '', floors: 1, displays: 0, sensors: 0, parentId: '' });
  const [err, setErr] = useState('');
  const all = useBuildingsForActiveOrg();
  const ecosystems = Object.values(all).filter((b) => b.kind === 'ecosystem');
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    try {
      await createBuilding({ ...form, parentId: form.parentId || null });
      onClose();
    } catch (ex) {
      setErr(ex.message);
    }
  };
  return (
    <form onSubmit={submit} style={formStyle}>
      <div style={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)' }}>
        {t('admin.bf.title')}
      </div>
      <Input placeholder={t('admin.bf.id_ph')} value={form.id} onChange={upd('id')} required />
      <Input placeholder={t('admin.bf.name_ph')} value={form.name} onChange={upd('name')} required />
      <Input
        placeholder={t('admin.bf.addr_ph')}
        value={form.addr}
        onChange={upd('addr')}
        style={{ gridColumn: 'span 2' }}
      />
      <Input placeholder={t('admin.bf.floors_ph')} value={form.floors} onChange={upd('floors')} type="number" />
      <Input placeholder={t('admin.bf.displays_ph')} value={form.displays} onChange={upd('displays')} type="number" />
      <Input placeholder={t('admin.bf.sensors_ph')} value={form.sensors} onChange={upd('sensors')} type="number" />
      <ParentPicker value={form.parentId} onChange={upd('parentId')} ecosystems={ecosystems} selfId={form.id} />
      {err && <div style={{ gridColumn: '1 / -1', color: 'var(--risk)', fontSize: 12 }}>{err}</div>}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={btnGhost}>
          {t('admin.access.cancel')}
        </button>
        <button type="submit" style={btnPrimary}>
          {t('admin.bf.create')}
        </button>
      </div>
    </form>
  );
}

function EcosystemForm({ onClose }) {
  const t = useT();
  const [form, setForm] = useState({ id: '', name: '', addr: '', parentId: '' });
  const [sites, setSites] = useState([{ name: '', addr: '' }]);
  const [err, setErr] = useState('');
  const all = useBuildingsForActiveOrg();
  const ecosystems = Object.values(all).filter((b) => b.kind === 'ecosystem');
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const updSite = (i, k) => (e) => setSites((s) => s.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
  const addSite = () => setSites((s) => [...s, { name: '', addr: '' }]);
  const removeSite = (i) => setSites((s) => s.filter((_, j) => j !== i));
  const submit = async (e) => {
    e.preventDefault();
    try {
      const withIds = sites
        .filter((s) => s.name)
        .map((s, i) => ({
          id: `${form.id}-${i + 1}`,
          name: s.name,
          addr: s.addr,
          short: s.name.split(/\s+/)[0].toUpperCase(),
        }));
      await createEcosystem({ ...form, sites: withIds, parentId: form.parentId || null });
      onClose();
    } catch (ex) {
      setErr(ex.message);
    }
  };
  return (
    <form onSubmit={submit} style={formStyle}>
      <div style={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 700, color: 'var(--text-soft)' }}>
        {t('admin.ef.title')}
      </div>
      <Input placeholder={t('admin.ef.id_ph')} value={form.id} onChange={upd('id')} required />
      <Input placeholder={t('admin.bf.name_ph')} value={form.name} onChange={upd('name')} required />
      <Input
        placeholder={t('admin.ef.addr_ph')}
        value={form.addr}
        onChange={upd('addr')}
        style={{ gridColumn: 'span 2' }}
      />
      <ParentPicker value={form.parentId} onChange={upd('parentId')} ecosystems={ecosystems} selfId={form.id} />
      <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginTop: 4 }}>
        {t('admin.ef.sites')}
      </div>
      {sites.map((s, i) => (
        <div key={i} style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 6 }}>
          <Input placeholder={t('admin.ef.site_name_ph', { n: i + 1 })} value={s.name} onChange={updSite(i, 'name')} />
          <Input placeholder={t('admin.bf.addr_ph')} value={s.addr} onChange={updSite(i, 'addr')} />
          <button type="button" onClick={() => removeSite(i)} style={btnGhost}>
            ×
          </button>
        </div>
      ))}
      <div style={{ gridColumn: '1 / -1' }}>
        <button type="button" onClick={addSite} style={btnGhost}>
          {t('admin.ef.add_site')}
        </button>
      </div>
      {err && <div style={{ gridColumn: '1 / -1', color: 'var(--risk)', fontSize: 12 }}>{err}</div>}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={btnGhost}>
          {t('admin.access.cancel')}
        </button>
        <button type="submit" style={btnPrimary}>
          {t('admin.ef.create')}
        </button>
      </div>
    </form>
  );
}

function ParentPicker({ value, onChange, ecosystems, selfId }) {
  const t = useT();
  // Build the option list: ecosystems only, excluding self and any
  // descendants. For CREATE forms selfId is the new slug being typed
  // so descendants don't exist yet and the isAncestor check is moot;
  // this keeps the component correct if it's ever reused in an edit
  // context too. Belt-and-braces with the server trigger in 013.
  const options = ecosystems.filter((e) => !selfId || (e.id !== selfId && !isAncestor(selfId, e.id)));
  return (
    <div style={{ gridColumn: 'span 2' }}>
      <select
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          padding: '7px 10px',
          fontSize: 12.5,
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
        }}
      >
        <option value="">{t('admin.parent.placeholder')}</option>
        {options.map((e) => (
          <option key={e.id} value={e.id}>
            {breadcrumbFor(e.id)
              .map((c) => c.name)
              .join(' › ')}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─────────────────────────── Zones Modal ───────────────────────────

function ZonesModal({ building, onClose }) {
  const t = useT();
  const zones = useZonesForLocation(building.id);
  const [err, setErr] = useState(null);
  const [addingFloor, setAddingFloor] = useState(false);
  const [newFloor, setNewFloor] = useState('');

  const floors = sortedFloors(zones);
  const byFloor = groupByFloor(zones);

  const addFloor = async () => {
    setErr(null);
    const f = (newFloor || '').trim();
    if (!f) return;
    try {
      await addStandardFloor(building.id, f);
      setNewFloor('');
      setAddingFloor(false);
    } catch (e) {
      setErr(e.message || t('admin.zones.add_floor_failed'));
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
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
          <div style={{ fontSize: 14, fontWeight: 700 }}>{t('admin.zones.title', { name: building.name })}</div>
          <Pill>{zones.length}</Pill>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              padding: 4,
            }}
          >
            <Icon.close size={14} />
          </button>
        </div>

        <div style={{ padding: 18, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {floors.length === 0 && !addingFloor && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-dim)' }}>
              {t('admin.zones.empty')}
            </div>
          )}

          {floors.map((floor) => (
            <FloorBlock key={floor} locationId={building.id} floor={floor} zones={byFloor[floor]} />
          ))}

          {addingFloor ? (
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                padding: 10,
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>
                {t('admin.zones.floor_label')}
              </span>
              <input
                value={newFloor}
                onChange={(e) => setNewFloor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFloor()}
                autoFocus
                placeholder={t('admin.zones.floor_ph')}
                style={{ ...inputStyle, width: 160 }}
              />
              <button onClick={addFloor} style={btnPrimary}>
                {t('admin.zones.add_zones')}
              </button>
              <button
                onClick={() => {
                  setAddingFloor(false);
                  setNewFloor('');
                }}
                style={btnGhost}
              >
                {t('admin.zones.cancel')}
              </button>
            </div>
          ) : (
            <button onClick={() => setAddingFloor(true)} style={{ ...btnGhost, alignSelf: 'flex-start' }}>
              {t('admin.zones.add_floor')}
            </button>
          )}

          {err && <div style={{ fontSize: 12, color: 'var(--risk)', fontWeight: 600 }}>{err}</div>}
        </div>

        <div
          style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)' }}
        >
          {t('admin.zones.tip')}
        </div>
      </div>
    </div>
  );
}

function FloorBlock({ locationId, floor, zones }) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div
        style={{
          padding: '8px 12px',
          background: 'var(--surface-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-dim)',
            letterSpacing: 0.1,
            textTransform: 'uppercase',
          }}
        >
          {t('admin.zones.floor_n', { n: floor })}
        </div>
        <Pill>{zones.length}</Pill>
        <div style={{ flex: 1 }} />
        <button onClick={() => setAdding(true)} style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }}>
          {t('admin.zones.add_zone')}
        </button>
      </div>
      <div>
        {zones.map((z, i) => (
          <ZoneRow key={z.id} zone={z} last={i === zones.length - 1 && !adding} />
        ))}
        {adding && (
          <ZoneNewRow
            locationId={locationId}
            floor={floor}
            sortOrder={zones.length + 1}
            onCommit={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        )}
      </div>
    </div>
  );
}

function ZoneRow({ zone, last }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: zone.name, kind: zone.kind, code: zone.code || '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateZone(zone.id, draft);
      setEditing(false);
    } catch (e) {
      alertDialog(e.message || t('admin.zones.save_failed'));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!(await confirmDialog({ body: t('admin.zones.remove_confirm', { name: zone.name }), danger: true }))) return;
    try {
      await deleteZone(zone.id, zone.location_id);
    } catch (e) {
      alertDialog(e.message || t('admin.zones.delete_failed'));
    }
  };

  if (editing) {
    return (
      <div
        style={{
          padding: 10,
          background: 'var(--accent-soft)',
          borderBottom: last ? 'none' : '1px solid var(--border)',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          style={{ ...inputStyle, flex: 1 }}
          autoFocus
        />
        <select
          value={draft.kind}
          onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}
          style={{ ...inputStyle, width: 130 }}
        >
          {ZONE_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          value={draft.code}
          onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
          placeholder={t('admin.zones.code_ph')}
          style={{ ...inputStyle, width: 100 }}
        />
        <button onClick={save} disabled={saving} style={{ ...btnPrimary, padding: '5px 10px', fontSize: 11 }}>
          {saving ? '…' : t('admin.zones.save')}
        </button>
        <button onClick={() => setEditing(false)} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>
          {t('admin.zones.cancel_inline')}
        </button>
      </div>
    );
  }
  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{zone.name}</div>
        <Pill tone="info">{zoneKindLabel(zone.kind)}</Pill>
        {zone.code && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--text-dim)' }}>{zone.code}</span>
        )}
      </div>
      <button onClick={() => setEditing(true)} style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }}>
        {t('admin.zones.edit')}
      </button>
      <button onClick={remove} style={{ ...btnDanger, padding: '4px 10px', fontSize: 11 }}>
        {t('admin.zones.remove')}
      </button>
    </div>
  );
}

function ZoneNewRow({ locationId, floor, sortOrder, onCommit, onCancel }) {
  const t = useT();
  const [draft, setDraft] = useState({ name: '', kind: 'restroom', code: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await createZone({ locationId, floor, ...draft, sortOrder });
      onCommit();
    } catch (e) {
      alertDialog(e.message || t('admin.zones.create_failed'));
      setSaving(false);
    }
  };
  return (
    <div style={{ padding: 10, background: 'var(--accent-soft)', display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        autoFocus
        placeholder={t('admin.zones.zone_name_ph')}
        style={{ ...inputStyle, flex: 1 }}
      />
      <select
        value={draft.kind}
        onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}
        style={{ ...inputStyle, width: 130 }}
      >
        {ZONE_KINDS.map((k) => (
          <option key={k.id} value={k.id}>
            {k.label}
          </option>
        ))}
      </select>
      <input
        value={draft.code}
        onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
        placeholder={t('admin.zones.code_optional_ph')}
        style={{ ...inputStyle, width: 130 }}
      />
      <button onClick={save} disabled={saving} style={{ ...btnPrimary, padding: '5px 10px', fontSize: 11 }}>
        {saving ? '…' : t('admin.zones.add')}
      </button>
      <button onClick={onCancel} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>
        {t('admin.zones.cancel_inline')}
      </button>
    </div>
  );
}

const inputStyle = {
  padding: '6px 10px',
  fontSize: 12,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  outline: 'none',
};
