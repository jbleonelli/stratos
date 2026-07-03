// Hypervisor location tree — Building → Floor → Room hierarchy from
// public.locations.parent_id. Replaces (Phase H-6) the floor-plan-only
// view as the primary navigator: every building gets a tree, even
// those without authored floor-plan geometry. Spatial views (floor
// plan, photos) still show on the right when available for the
// selected node.
//
// Lazy fetch: pulls only the descendants needed to render expanded
// branches. The full Meridian HQ tree is 411 nodes — small enough to
// fetch in one go, but keeping fetch-on-expand keeps it responsive
// for future buildings with deeper structures.

import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot } from './primitives.jsx';
import { useT } from './i18n.js';
import { createChildLocation, updateLocation, deleteLocation } from './custom-locations.js';
import { confirmDialog } from './dialogs.jsx';
import { useRoomContext } from './room-context.js';
import { createZone, updateZone, deleteZone, ZONE_KINDS } from './zones-data.js';
import { useLocationGrants, addLocationGrant, removeLocationGrant } from './location-grants.js';
import { useOrgMembers, useIsOrgAdmin } from './org-data.js';
import { useSession } from './auth.js';
import { useDeviceEvents, useCrewByBadge, describeDeviceEvent } from './device-events.js';
import { navigateTo } from './use-route.js';
import { useRouteDetail } from './route-detail.js';
import { useLocationTree } from './queries/location-tree.ts';

const KIND_ICON = {
  building: 'building',
  floor: 'floor',
  restroom: 'air',
  meeting_room: 'room',
  conference_room: 'room',
  training_room: 'room',
  boardroom: 'room',
  lounge: 'room',
  lobby: 'people',
  dock: 'ship',
  mailroom: 'supply',
  cafeteria: 'supply',
  amenity: 'supply',
  auditorium: 'people',
  server_room: 'shield',
};

// Pretty kind label for the right-pane "Type" line — translated at render time.
const KIND_LABEL_KEYS = {
  building: 'loctree.kind.building',
  floor: 'loctree.kind.floor',
  restroom: 'loctree.kind.restroom',
  meeting_room: 'loctree.kind.meeting_room',
  conference_room: 'loctree.kind.conference_room',
  training_room: 'loctree.kind.training_room',
  boardroom: 'loctree.kind.boardroom',
  lounge: 'loctree.kind.lounge',
  lobby: 'loctree.kind.lobby',
  dock: 'loctree.kind.dock',
  mailroom: 'loctree.kind.mailroom',
  cafeteria: 'loctree.kind.cafeteria',
  amenity: 'loctree.kind.amenity',
  auditorium: 'loctree.kind.auditorium',
  server_room: 'loctree.kind.server_room',
};

// Derive a numeric sort key from a location name. Floors sort by
// number ('Floor 1', 'Floor 10' → 1, 10). Rooms get a quadrant
// preference (NW < NE < SW < SE) so restrooms cluster sensibly,
// otherwise alphabetic.
function sortKey(node) {
  const m = node.name.match(/Floor (\d+)/);
  if (m && node.kind === 'floor') return [0, parseInt(m[1], 10)];
  const quad = (node.name.match(/\b(NW|NE|SW|SE)\b/) || [])[1];
  const qOrder = { NW: 0, NE: 1, SW: 2, SE: 3 }[quad];
  if (qOrder != null) return [1, qOrder, node.name];
  return [2, node.name];
}
function compareNodes(a, b) {
  const ka = sortKey(a),
    kb = sortKey(b);
  for (let i = 0; i < Math.min(ka.length, kb.length); i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

// Allowable child kinds when admins create a new node under an
// existing one. Keeps the kind picker tight per parent. Phase 2 of
// the Hypervisor admin rework reads this map.
const CHILD_KIND_OPTIONS = {
  ecosystem: ['building', 'ecosystem'],
  building: ['floor', 'zone'],
  floor: [
    'restroom',
    'meeting_room',
    'conference_room',
    'training_room',
    'boardroom',
    'lounge',
    'lobby',
    'cafeteria',
    'amenity',
    'auditorium',
    'server_room',
    'mailroom',
    'dock',
    'zone',
  ],
  zone: [
    'restroom',
    'meeting_room',
    'conference_room',
    'training_room',
    'boardroom',
    'lounge',
    'lobby',
    'cafeteria',
    'amenity',
    'auditorium',
    'server_room',
    'position',
  ],
  restroom: ['position'],
  meeting_room: ['position'],
  conference_room: ['position'],
  training_room: ['position'],
  boardroom: ['position'],
  lounge: ['position'],
  lobby: ['position'],
  cafeteria: ['position'],
  amenity: ['position'],
  auditorium: ['position'],
  server_room: ['position'],
  mailroom: ['position'],
  dock: ['position'],
};
function childKindsFor(parentKind) {
  return CHILD_KIND_OPTIONS[parentKind] || ['zone', 'position'];
}

// Stable empty references so the derived `nodes` / `devicesByLocation` keep a
// constant identity before the query resolves — avoids re-running the
// childrenById useMemo and onSummary useEffect on every render.
const EMPTY_NODES = {};
const EMPTY_DEVICES = {};

export function LocationTree({
  rootId,
  orgId,
  selectedId,
  onSelect,
  includeDevices = false,
  editable = false,
  onSummary,
  refreshSignal = 0,
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(() => new Set([rootId]));
  // Phase 2: bumped after every mutation (create/rename/delete) so the
  // tree read re-runs and reflects the new state without a full page
  // reload. Cheap because Meridian-scale (~411 nodes + ~800 devices) is
  // well under the PostgREST cap.
  // Phase 4: the read also re-runs whenever a parent passes a new
  // refreshSignal (e.g. after a CSV bulk-load). Same read, two trigger
  // sources — both fold into the query key below.
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = () => setRefreshTick((n) => n + 1);

  // First load: fetch the entire org's tree in one go. Per the
  // Meridian HQ doc the worst case is 411 rows — well below the
  // PostgREST 1000 cap. If a future building blows past that we'll
  // switch to fetch-on-expand keyed by parent_id. refreshTick /
  // refreshSignal are in the query key so a bump of either refetches.
  const { data: treeData, isLoading } = useLocationTree(orgId, includeDevices, refreshTick, refreshSignal);
  // Flat map of all loaded nodes by id. Children are derived on demand.
  const nodes = treeData?.nodes ?? EMPTY_NODES;
  // Devices keyed by location_id. Empty unless includeDevices=true
  // (Hypervisor admin tree).
  const devicesByLocation = treeData?.devicesByLocation ?? EMPTY_DEVICES;
  const loading = isLoading;

  // Phase 4: emit a summary (counts by kind + total devices) so the
  // host page can show a load-progress strip. Counts only descend
  // from the rendered root subtree to keep multi-building tenants
  // honest — if the user has Meridian selected we only count
  // Meridian's nodes.
  useEffect(() => {
    if (!onSummary) return;
    const stack = [rootId];
    const seen = new Set();
    const byKind = {};
    let deviceCount = 0;
    while (stack.length) {
      const id = stack.pop();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const n = nodes[id];
      if (!n) continue;
      byKind[n.kind] = (byKind[n.kind] || 0) + 1;
      if (devicesByLocation[id]) deviceCount += devicesByLocation[id].length;
      // Push descendants
      for (const m of Object.values(nodes)) {
        if (m.parent_id === id) stack.push(m.id);
      }
    }
    onSummary({ byKind, deviceCount, totalNodes: seen.size });
  }, [nodes, devicesByLocation, rootId, onSummary]);

  // Build childrenById map once per nodes change.
  const childrenById = useMemo(() => {
    const out = {};
    for (const n of Object.values(nodes)) {
      if (!n.parent_id) continue;
      if (!out[n.parent_id]) out[n.parent_id] = [];
      out[n.parent_id].push(n);
    }
    for (const k of Object.keys(out)) out[k].sort(compareNodes);
    return out;
  }, [nodes]);

  const root = nodes[rootId];

  if (loading && !root) {
    return <div style={{ padding: 16, fontSize: 12, color: 'var(--text-dim)' }}>{t('loctree.loading')}</div>;
  }
  if (!root) {
    return <div style={{ padding: 16, fontSize: 12, color: 'var(--text-dim)' }}>{t('loctree.empty')}</div>;
  }

  return (
    <div style={{ padding: '8px 0', fontSize: 12.5 }}>
      <TreeNode
        node={root}
        depth={0}
        childrenById={childrenById}
        devicesByLocation={devicesByLocation}
        expanded={expanded}
        onToggle={(id) =>
          setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        selectedId={selectedId}
        onSelect={onSelect}
        editable={editable}
        onRefresh={refresh}
        onAfterCreate={(id) => setExpanded((prev) => new Set([...prev, id]))}
      />
    </div>
  );
}

function TreeNode({
  node,
  depth,
  childrenById,
  devicesByLocation,
  expanded,
  onToggle,
  selectedId,
  onSelect,
  editable,
  onRefresh,
  onAfterCreate,
}) {
  const t = useT();
  const kids = childrenById[node.id] || [];
  // Devices that live AT this location (Hypervisor admin tree only —
  // devicesByLocation is empty / undefined for the regular drawer
  // navigator). Render them as terminal leaves under the location.
  const devices = (devicesByLocation && devicesByLocation[node.id]) || [];
  const hasKids = kids.length > 0;
  const hasDevices = devices.length > 0;
  const expandable = hasKids || hasDevices;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const IconC = Icon[KIND_ICON[node.kind] || 'room'] || Icon.room;
  // Phase 2 admin state: hover surfaces actions, click opens
  // create/rename inline; row stays in editing mode until submit/
  // cancel. menuOpen is a small popover with rename / delete.
  const [hover, setHover] = useState(false);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Whether this node accepts child creation. Tree-leaf kinds (e.g.
  // 'position' isn't in CHILD_KIND_OPTIONS, building→floor only) are
  // skipped via childKindsFor returning the default fallback. We keep
  // the affordance visible for any node whose parent-allowlist isn't
  // empty so admins can still nest zones / positions deeper if needed.
  const canAddChild = editable && childKindsFor(node.kind).length > 0;
  // Root building/ecosystem isn't safely deletable from the tree —
  // it's the workspace's home. Block the action there.
  const canDelete = editable && depth > 0;
  const canRename = editable;

  async function handleRename(nextName) {
    setBusy(true);
    setErr('');
    try {
      await updateLocation(node.id, { name: nextName });
      setRenaming(false);
      onRefresh?.();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!(await confirmDialog({ body: `Delete "${node.name}"? This cannot be undone.`, danger: true }))) return;
    setBusy(true);
    setErr('');
    try {
      await deleteLocation(node.id);
      onRefresh?.();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  }

  return (
    <div>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={(e) => {
          if (renaming) return;
          e.stopPropagation();
          onSelect?.(node);
          if (expandable) onToggle(node.id);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px 4px ' + (10 + depth * 14) + 'px',
          cursor: renaming ? 'default' : 'pointer',
          background: isSelected ? 'var(--accent-soft)' : hover && editable ? 'var(--surface-2)' : 'transparent',
          color: isSelected ? 'var(--accent)' : 'var(--text-soft)',
          borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
          position: 'relative',
        }}
      >
        {expandable ? (
          <Icon.chevD
            size={9}
            style={{
              transform: isOpen ? 'none' : 'rotate(-90deg)',
              transition: 'transform .15s',
              color: 'var(--text-faint)',
              flexShrink: 0,
            }}
          />
        ) : (
          <span style={{ width: 9, flexShrink: 0 }} />
        )}
        <IconC size={11} style={{ color: isSelected ? 'var(--accent)' : 'var(--text-dim)', flexShrink: 0 }} />
        {renaming ? (
          <RenameInput
            initial={node.name}
            onSubmit={handleRename}
            onCancel={() => {
              setRenaming(false);
              setErr('');
            }}
            busy={busy}
          />
        ) : (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: expandable ? 600 : 500,
            }}
          >
            {node.name}
          </span>
        )}
        {!renaming && expandable && (
          <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
            {kids.length + devices.length}
          </span>
        )}
        {/* Hover affordances — only render in editable mode so the
            crew-side / drawer use of the tree stays clean. */}
        {editable && hover && !renaming && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {canAddChild && (
              <ActionPill
                title={t('hyper.tree.add_child')}
                onClick={() => {
                  setAdding(true);
                  if (!isOpen && expandable) onToggle(node.id);
                }}
              >
                <Icon.plus size={10} />
              </ActionPill>
            )}
            <ActionPill title={t('hyper.tree.menu')} onClick={() => setMenuOpen((v) => !v)}>
              <Icon.dots size={10} />
            </ActionPill>
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 6,
                  zIndex: 20,
                  background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  padding: 4,
                  minWidth: 140,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                }}
              >
                {canRename && (
                  <MenuItem
                    onClick={() => {
                      setRenaming(true);
                      setMenuOpen(false);
                    }}
                  >
                    {t('hyper.tree.rename')}
                  </MenuItem>
                )}
                {canDelete && (
                  <MenuItem onClick={handleDelete} tone="risk">
                    {t('hyper.tree.delete')}
                  </MenuItem>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {err && (
        <div style={{ padding: '2px 12px 4px ' + (10 + depth * 14) + 'px', fontSize: 10.5, color: 'var(--risk)' }}>
          {err}
        </div>
      )}
      {adding && editable && (
        <CreateChildInline
          parent={node}
          depth={depth + 1}
          onDone={(createdId) => {
            setAdding(false);
            if (createdId) {
              onAfterCreate?.(node.id);
              onRefresh?.();
            }
          }}
        />
      )}
      {isOpen && expandable && (
        <div>
          {kids.map((kid) => (
            <TreeNode
              key={kid.id}
              node={kid}
              depth={depth + 1}
              childrenById={childrenById}
              devicesByLocation={devicesByLocation}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
              editable={editable}
              onRefresh={onRefresh}
              onAfterCreate={onAfterCreate}
            />
          ))}
          {/* Devices render after location children so the room-then-device
              hierarchy reads naturally even at deep nodes. */}
          {devices.map((dev) => (
            <DeviceLeaf
              key={`dev-${dev.id}`}
              device={dev}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Phase 2 helpers — small inline UI primitives for the admin tree.
function ActionPill({ children, title, onClick }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={title}
      style={{
        width: 22,
        height: 22,
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: 'var(--text-dim)',
        border: '1px solid transparent',
        borderRadius: 5,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-3)';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.color = 'var(--text)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
        e.currentTarget.style.color = 'var(--text-dim)';
      }}
    >
      {children}
    </button>
  );
}

function MenuItem({ children, onClick, tone }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'block',
        textAlign: 'left',
        padding: '7px 10px',
        fontSize: 12,
        fontWeight: 600,
        color: tone === 'risk' ? 'var(--risk)' : 'var(--text-soft)',
        background: 'transparent',
        border: 'none',
        borderRadius: 5,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function RenameInput({ initial, onSubmit, onCancel, busy }) {
  const [val, setVal] = useState(initial || '');
  return (
    <input
      autoFocus
      value={val}
      disabled={busy}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (val.trim() && val.trim() !== initial) onSubmit(val.trim());
          else onCancel();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={() => {
        if (val.trim() && val.trim() !== initial) onSubmit(val.trim());
        else onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--surface)',
        border: '1px solid var(--accent-line)',
        color: 'var(--text)',
        fontSize: 12.5,
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: 4,
        fontFamily: 'inherit',
        outline: 'none',
      }}
    />
  );
}

// Inline form for creating a new child location under `parent`.
// Renders below the parent row at the same depth as a future child.
// Uses childKindsFor() to scope the kind dropdown.
function CreateChildInline({ parent, depth, onDone }) {
  const t = useT();
  const opts = childKindsFor(parent.kind);
  const [kind, setKind] = useState(opts[0]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr('');
    try {
      const created = await createChildLocation({ parentId: parent.id, kind, name: name.trim() });
      onDone(created?.id || true);
    } catch (e) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        padding: '6px 10px 6px ' + (10 + depth * 14) + 'px',
        background: 'color-mix(in oklch, var(--accent) 5%, transparent)',
        borderLeft: '2px solid var(--accent-line)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ width: 9, flexShrink: 0 }} />
        <Icon.plus size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          disabled={busy}
          style={{
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontSize: 11,
            padding: '2px 4px',
            fontFamily: 'inherit',
          }}
        >
          {opts.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          autoFocus
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('hyper.tree.name_ph')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onDone(null);
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--surface)',
            border: '1px solid var(--accent-line)',
            color: 'var(--text)',
            fontSize: 12,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button onClick={submit} disabled={busy || !name.trim()} style={createBtn(busy || !name.trim())}>
          {busy ? '…' : t('hyper.tree.create')}
        </button>
        <button onClick={() => onDone(null)} disabled={busy} style={cancelBtn(busy)}>
          {t('hyper.tree.cancel')}
        </button>
      </div>
      {err && <div style={{ fontSize: 10.5, color: 'var(--risk)' }}>{err}</div>}
    </div>
  );
}

function createBtn(disabled) {
  return {
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
    background: disabled ? 'var(--surface-2)' : 'var(--accent)',
    color: disabled ? 'var(--text-faint)' : '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
  };
}
function cancelBtn(disabled) {
  return {
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    background: 'transparent',
    color: 'var(--text-dim)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
  };
}

// Terminal leaf for a device under its owning location. Rendered
// only in the Hypervisor admin tree (includeDevices=true). Selecting
// it surfaces the device metadata in the right detail pane via the
// shared LocationDetail (which detects __device shape).
function DeviceLeaf({ device, depth, selectedId, onSelect }) {
  const isSelected = selectedId === `device:${device.id}`;
  // Map device kind → icon. Falls back to a generic display icon.
  const IconC = Icon[DEVICE_KIND_ICON[device.kind] || 'display'] || Icon.display;
  // Wrap the device row in a node-shape the parent's onSelect can
  // pass straight to LocationDetail. The id prefix lets the detail
  // pane branch on shape without sniffing every field.
  const nodeShape = {
    id: `device:${device.id}`,
    name: device.name || device.external_id || device.kind,
    kind: '__device',
    __device: device,
  };
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(nodeShape);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px 4px ' + (10 + depth * 14) + 'px',
        cursor: 'pointer',
        background: isSelected ? 'var(--accent-soft)' : 'transparent',
        color: isSelected ? 'var(--accent)' : 'var(--text-soft)',
        borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
      }}
    >
      <span style={{ width: 9, flexShrink: 0 }} />
      <IconC size={11} style={{ color: isSelected ? 'var(--accent)' : 'var(--text-faint)', flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}
      >
        {device.name || device.external_id}
      </span>
      <span
        style={{
          fontSize: 9.5,
          color: 'var(--text-faint)',
          fontFamily: 'var(--mono)',
          flexShrink: 0,
          textTransform: 'uppercase',
          letterSpacing: 0.2,
        }}
      >
        {device.kind}
      </span>
    </div>
  );
}

// Device-kind → icon map. Mirrors the device-class taxonomy in
// data.js; falls back to `display` for unknown kinds.
const DEVICE_KIND_ICON = {
  smart_display: 'display',
  people_counter: 'people',
  smart_logger: 'badge',
  parking_spot_sensor: 'pin',
  ev_charger: 'bolt',
  bacnet_thermostat: 'hvac',
  onvif_camera: 'camera',
  iclass_reader: 'shield',
};

// Detail pane shown to the right of the tree. Renders the selected
// node's metadata + a child summary; spatial views (floor plan, etc.)
// are wired in by the host page when geometry exists for the node.
// Phase 1 Hypervisor: also handles device leaves (kind='__device')
// surfaced from the admin tree — same card shape, device-flavored
// fields (external_id, location_id back-ref) instead of the
// location metadata block.
export function LocationDetail({ node, childrenCount, onAskMerlin, onSelectRoute, editable = false }) {
  const t = useT();
  if (!node) {
    return (
      <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12, textAlign: 'center' }}>
        <Icon.room size={20} style={{ opacity: 0.5 }} />
        <div style={{ marginTop: 10, lineHeight: 1.5 }}>{t('loctree.select_node')}</div>
      </div>
    );
  }
  // Device leaf shape (Hypervisor admin tree) — render the device card.
  if (node.kind === '__device' && node.__device) {
    return <DeviceDetailCard device={node.__device} onAskMerlin={onAskMerlin} t={t} />;
  }
  const IconC = Icon[KIND_ICON[node.kind] || 'room'] || Icon.room;
  const kindLabel = KIND_LABEL_KEYS[node.kind] ? t(KIND_LABEL_KEYS[node.kind]) : node.kind;
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconC size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>{node.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{kindLabel}</div>
        </div>
      </div>
      {childrenCount > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
          <Pill tone="accent">{childrenCount}</Pill>{' '}
          {childrenCount === 1 ? t('loctree.direct_child') : t('loctree.direct_children')}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>
        {t('loctree.id', { id: node.id })}
      </div>
      {/* Phase 3 — local-admin grants. Visible on building +
          ecosystem nodes (the "container" kinds you'd assign a
          per-customer admin to). Org owners/admins can add or
          revoke. Non-admins see the read-only list. */}
      {(node.kind === 'building' || node.kind === 'ecosystem') && <LocationGrantsSection node={node} />}
      {/* Operational context — devices in the room (when applicable),
          zones on the floor, routes serving those zones. Skipped only
          for building / ecosystem / __device nodes; floors now flow
          through so picking a floor surfaces every route serving it. */}
      {!['building', 'ecosystem', '__device'].includes(node.kind) && (
        <RoomContextSection node={node} onSelectRoute={onSelectRoute} editable={editable} />
      )}
      {onAskMerlin && (
        <button
          onClick={() => onAskMerlin(t('loctree.ask_prompt', { name: node.name }))}
          style={{
            // alignSelf:flex-start keeps the button from stretching
            // to the full pane width (parent is a flex column with
            // the default align-items:stretch). The previous
            // inline-flex display alone wasn't enough.
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          <Icon.sparkle size={12} /> {t('action.ask_merlin')}
        </button>
      )}
    </div>
  );
}

// Operational context for a room — devices, zones, routes. Pulled
// from useRoomContext (room-context.js), which derives the floor +
// building from the parent chain and queries the four backing tables.
// Hidden when the data hasn't loaded yet OR when nothing matches —
// avoids showing three empty headers on a brand-new room.
function RoomContextSection({ node, onSelectRoute, editable = false }) {
  const t = useT();
  const { devices, zones, routes, buildingRootId, floorNumber, ready, refresh } = useRoomContext(node);
  if (!ready) return null;
  // editable + on a floor with a resolved buildingRootId → the zones
  // block surfaces with a CRUD UI, even if there are no zones yet.
  // Otherwise keep the old behavior: hide blocks that have nothing.
  const canEditZones = editable && !!buildingRootId && !!floorNumber;
  const showZonesBlock = zones.length > 0 || canEditZones;
  const hasAny = devices.length > 0 || showZonesBlock || routes.length > 0;
  if (!hasAny) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
      {devices.length > 0 && <DevicesBlock devices={devices} t={t} />}
      {showZonesBlock && (
        <ZonesBlock
          zones={zones}
          t={t}
          editable={canEditZones}
          buildingRootId={buildingRootId}
          floor={floorNumber}
          onChanged={refresh}
        />
      )}
      {routes.length > 0 && <RoutesBlock routes={routes} t={t} onSelectRoute={onSelectRoute} />}
    </div>
  );
}

function ContextBlockHeader({ icon, label, count }) {
  const IconC = Icon[icon] || Icon.grid;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <IconC size={11} style={{ color: 'var(--accent)' }} />
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{count}</span>
    </div>
  );
}

function DevicesBlock({ devices, t }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <ContextBlockHeader icon="gateway" label={t('loctree.ctx.devices')} count={devices.length} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {devices.map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 600 }}>{kindReadable(d.kind)}</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
              {d.external_id || d.id.slice(0, 8)}
            </span>
            {d.model && <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>· {d.model}</span>}
            {d.last_seen && (
              <span
                style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}
              >
                {new Date(d.last_seen).toISOString().slice(0, 10)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ZonesBlock({ zones, t, editable = false, buildingRootId, floor, onChanged }) {
  // Single source of truth: the prop. We track local "draft" rows for
  // the create form + the per-row edit/delete confirmation states.
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ContextBlockHeader icon="map" label={t('loctree.ctx.zones')} count={zones.length} />
        {editable && (
          <button
            onClick={() => {
              setAdding(true);
              setErr(null);
            }}
            disabled={adding}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              fontSize: 10.5,
              fontWeight: 700,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
              borderRadius: 5,
              cursor: adding ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: adding ? 0.5 : 1,
            }}
          >
            <Icon.plus size={9} /> {t('loctree.ctx.zone_add')}
          </button>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{t('loctree.ctx.zones_hint')}</div>
      {err && (
        <div
          style={{
            padding: '5px 8px',
            fontSize: 10.5,
            borderRadius: 5,
            background: 'color-mix(in oklch, var(--risk) 10%, transparent)',
            color: 'var(--risk)',
            fontFamily: 'var(--mono)',
          }}
        >
          {err}
        </div>
      )}
      {adding && (
        <ZoneEditor
          mode="create"
          t={t}
          onSubmit={async (patch) => {
            try {
              await createZone({ locationId: buildingRootId, floor, ...patch });
              setAdding(false);
              setErr(null);
              onChanged?.();
            } catch (e) {
              setErr(e?.message || String(e));
              throw e;
            }
          }}
          onCancel={() => {
            setAdding(false);
            setErr(null);
          }}
        />
      )}
      {zones.length === 0 && !adding ? (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>
          {t('loctree.ctx.zone_empty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {zones.map((z) =>
            editingId === z.id ? (
              <ZoneEditor
                key={z.id}
                mode="edit"
                zone={z}
                t={t}
                onSubmit={async (patch) => {
                  try {
                    await updateZone(z.id, patch);
                    setEditingId(null);
                    setErr(null);
                    onChanged?.();
                  } catch (e) {
                    setErr(e?.message || String(e));
                    throw e;
                  }
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ZonePillRow
                key={z.id}
                zone={z}
                editable={editable}
                busy={busyId === z.id}
                onEdit={() => {
                  setEditingId(z.id);
                  setErr(null);
                }}
                onDelete={async () => {
                  if (
                    !(await confirmDialog({
                      body: t('loctree.ctx.zone_delete_confirm', { name: z.name }),
                      danger: true,
                    }))
                  )
                    return;
                  setBusyId(z.id);
                  setErr(null);
                  try {
                    await deleteZone(z.id, buildingRootId);
                    onChanged?.();
                  } catch (e) {
                    setErr(e?.message || String(e));
                  } finally {
                    setBusyId(null);
                  }
                }}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

// Inline pill row for an existing zone — read-only label + (when
// editable) Edit / Delete icons that appear inline. Keeps the
// compact look of the read-only Pills but exposes affordances on
// hover.
function ZonePillRow({ zone, editable, busy, onEdit, onDelete }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 6px',
        borderRadius: 6,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          padding: '1px 6px',
          borderRadius: 4,
          fontSize: 10.5,
          fontWeight: 700,
          background: 'var(--surface-2)',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.15,
        }}
      >
        {zone.kind || 'other'}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 600 }}>{zone.name}</span>
      {zone.code && (
        <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{zone.code}</span>
      )}
      {editable && (
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
          <button
            onClick={onEdit}
            disabled={busy}
            title="Edit"
            style={{
              padding: 4,
              background: 'transparent',
              border: 'none',
              cursor: busy ? 'default' : 'pointer',
              color: 'var(--text-dim)',
              display: 'inline-flex',
              alignItems: 'center',
              opacity: busy ? 0.4 : 1,
            }}
          >
            <Icon.cog size={10} />
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            title="Delete"
            style={{
              padding: 4,
              background: 'transparent',
              border: 'none',
              cursor: busy ? 'default' : 'pointer',
              color: 'var(--risk)',
              display: 'inline-flex',
              alignItems: 'center',
              opacity: busy ? 0.4 : 1,
            }}
          >
            <Icon.close size={10} />
          </button>
        </span>
      )}
    </div>
  );
}

// Inline form for create + edit. Same shape both ways; the parent
// passes onSubmit (which patches or inserts) + onCancel. busy flag
// only fires while the parent's async submit is pending.
function ZoneEditor({ mode, zone, t, onSubmit, onCancel }) {
  const [name, setName] = useState(zone?.name || '');
  const [kind, setKind] = useState(zone?.kind || 'other');
  const [code, setCode] = useState(zone?.code || '');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), kind, code: code.trim() || null });
    } catch {
      setBusy(false); // keep editor open so user can fix + retry
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 120px 100px auto',
        gap: 6,
        padding: '6px 8px',
        background: 'var(--surface)',
        border: '1px solid var(--accent-line)',
        borderRadius: 6,
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('loctree.ctx.zone_name_ph')}
        disabled={busy}
        style={inlineInputStyle()}
      />
      <select value={kind} onChange={(e) => setKind(e.target.value)} disabled={busy} style={inlineInputStyle()}>
        {ZONE_KINDS.map((k) => (
          <option key={k.id} value={k.id}>
            {k.label}
          </option>
        ))}
      </select>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={t('loctree.ctx.zone_code_ph')}
        disabled={busy}
        style={inlineInputStyle()}
      />
      <div style={{ display: 'inline-flex', gap: 4 }}>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 700,
            background: busy || !name.trim() ? 'var(--surface-3)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 5,
            cursor: busy || !name.trim() ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {busy
            ? mode === 'create'
              ? '…'
              : '…'
            : mode === 'create'
              ? t('loctree.ctx.zone_save_new')
              : t('loctree.ctx.zone_save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          style={{
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--text-soft)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t('loctree.ctx.zone_cancel')}
        </button>
      </div>
    </form>
  );
}

function inlineInputStyle() {
  return {
    padding: '4px 7px',
    fontSize: 11.5,
    background: 'var(--surface-2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    fontFamily: 'inherit',
    minWidth: 0,
  };
}

function RoutesBlock({ routes, t, onSelectRoute }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <ContextBlockHeader icon="people" label={t('loctree.ctx.routes')} count={routes.length} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {routes.map((r) => {
          const clickable = typeof onSelectRoute === 'function';
          const handleClick = clickable ? () => onSelectRoute(r.id) : undefined;
          return (
            <div
              key={r.id}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={handleClick}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick();
                      }
                    }
                  : undefined
              }
              style={{
                padding: '8px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                cursor: clickable ? 'pointer' : 'default',
                transition: 'border-color 120ms, background 120ms',
              }}
              onMouseEnter={
                clickable
                  ? (e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-line)';
                    }
                  : undefined
              }
              onMouseLeave={
                clickable
                  ? (e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }
                  : undefined
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{r.name}</span>
                <Pill tone="accent">{kindReadable(r.service_type)}</Pill>
                <Pill tone="info">{r.cadence}</Pill>
                {r.expected_start_time && (
                  <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                    {String(r.expected_start_time).slice(0, 5)}
                  </span>
                )}
                {clickable && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      color: 'var(--text-faint)',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    <Icon.chevR size={11} />
                  </span>
                )}
              </div>
              {r.assignments.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                  {t('loctree.ctx.routes_assigned')}{' '}
                  {r.assignments.map((a, i) => (
                    <span key={i}>
                      {i > 0 ? ', ' : ''}
                      <b style={{ color: 'var(--text)' }}>{a.member?.name || '—'}</b>
                      {a.role !== 'primary' && <span style={{ color: 'var(--text-dim)' }}> ({a.role})</span>}
                    </span>
                  ))}
                </div>
              )}
              {r.zones.length > 0 && (
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                  {t('loctree.ctx.routes_covers', {
                    zones: r.zones
                      .slice(0, 4)
                      .map((z) => z.name)
                      .join(', '),
                  })}
                  {r.zones.length > 4 ? t('loctree.ctx.routes_covers_more', { n: r.zones.length - 4 }) : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function kindReadable(s) {
  if (!s) return '';
  return String(s)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Local-admin grants for a building/ecosystem node. Phase 3 of the
// Hypervisor admin rework. Lists current grants + lets org owners/
// admins add new ones via a member picker. RLS handles the write
// authorization (is_org_admin); we just gate the UI to match.
function LocationGrantsSection({ node }) {
  const t = useT();
  const session = useSession();
  const orgId = session?.organizationId || null;
  const members = useOrgMembers();
  const isOrgAdmin = useIsOrgAdmin();
  const { grants, loaded, refresh } = useLocationGrants(node.id, orgId);
  const [picking, setPicking] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');

  // Surface a name for each grant. organization_members carries
  // user_id + a `profile` blob in some setups; we look up by user_id
  // against `members` and fall back to the bare uuid otherwise.
  const memberNameById = (id) => {
    const m = members.find((x) => x.user_id === id);
    return m?.profile?.name || m?.profile?.full_name || m?.email || id?.slice(0, 8) || '—';
  };
  // Members who don't already have a grant on this node — pickable
  // candidates for the "add admin" flow.
  const grantedIds = new Set(grants.map((g) => g.user_id));
  const candidates = members.filter((m) => m.user_id && !grantedIds.has(m.user_id));

  async function handleAdd(userId) {
    setBusyId(userId);
    setErr('');
    try {
      await addLocationGrant({ userId, locationId: node.id, orgId });
      refresh();
      setPicking(false);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }
  async function handleRemove(grantId) {
    setBusyId(grantId);
    setErr('');
    try {
      await removeLocationGrant(grantId);
      refresh();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      style={{
        marginTop: 4,
        padding: 10,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon.shield size={11} style={{ color: 'var(--accent)' }} />
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
          }}
        >
          {t('hyper.grants.title')}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{grants.length}</span>
      </div>
      {!loaded && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{t('hyper.grants.loading')}</div>}
      {loaded && grants.length === 0 && !picking && (
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>{t('hyper.grants.empty')}</div>
      )}
      {grants.map((g) => (
        <div
          key={g.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 8px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
        >
          <Icon.people size={11} style={{ color: 'var(--text-dim)' }} />
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {memberNameById(g.user_id)}
          </span>
          {isOrgAdmin && (
            <button
              onClick={() => handleRemove(g.id)}
              disabled={busyId === g.id}
              style={{
                background: 'transparent',
                color: 'var(--risk)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 10.5,
                fontWeight: 600,
                cursor: busyId === g.id ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {busyId === g.id ? '…' : t('hyper.grants.revoke')}
            </button>
          )}
        </div>
      ))}
      {picking && isOrgAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {candidates.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>
              {t('hyper.grants.no_candidates')}
            </div>
          )}
          {candidates.map((m) => (
            <button
              key={m.user_id}
              onClick={() => handleAdd(m.user_id)}
              disabled={busyId === m.user_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                textAlign: 'left',
                padding: '5px 8px',
                background: 'var(--surface)',
                border: '1px solid var(--accent-line)',
                borderRadius: 6,
                fontSize: 12,
                color: 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-soft)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface)';
              }}
            >
              <Icon.plus size={10} style={{ color: 'var(--accent)' }} />
              <span style={{ flex: 1, fontWeight: 600 }}>
                {m.profile?.name || m.profile?.full_name || m.email || m.user_id?.slice(0, 8)}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--mono)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.15,
                }}
              >
                {m.role}
              </span>
            </button>
          ))}
          <button
            onClick={() => {
              setPicking(false);
              setErr('');
            }}
            style={{
              alignSelf: 'flex-start',
              background: 'transparent',
              color: 'var(--text-dim)',
              border: 'none',
              padding: '2px 4px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('hyper.grants.cancel')}
          </button>
        </div>
      )}
      {!picking && isOrgAdmin && (
        <button
          onClick={() => {
            setPicking(true);
            setErr('');
          }}
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '1px solid var(--accent-line)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Icon.plus size={10} />
          {t('hyper.grants.add')}
        </button>
      )}
      {err && <div style={{ fontSize: 10.5, color: 'var(--risk)' }}>{err}</div>}
    </div>
  );
}

// Device-leaf detail card. Mirrors the location card's shape so the
// pane swap reads consistently. Header → status pill → meta rows →
// actions → recent activity feed driven by useDeviceEvents (same
// hook the standalone DeviceDetailPage uses).
function DeviceDetailCard({ device, onAskMerlin, t }) {
  const IconC = Icon[DEVICE_KIND_ICON_DETAIL[device.kind] || 'display'] || Icon.display;
  const { events, loaded: eventsLoaded } = useDeviceEvents(device.id, 12);
  const crewByBadge = useCrewByBadge();

  const status = device.status || 'unknown';
  const tone = DEVICE_STATUS_TONE[status] || 'info';
  const kindLabelRaw = t(`loctree.devkind.${device.kind}`);
  const kindLabel = kindLabelRaw === `loctree.devkind.${device.kind}` ? device.kind : kindLabelRaw;
  const statusLabelRaw = t(`device.status.${status}`);
  const statusLabel = statusLabelRaw === `device.status.${status}` ? status : statusLabelRaw;

  const displayName = device.name || device.external_id || device.kind;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header: icon + name + kind + status pill */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconC size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25, wordBreak: 'break-word' }}>{displayName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{kindLabel}</div>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 999,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            fontSize: 10.5,
            fontWeight: 600,
            color: 'var(--text-soft)',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <Dot tone={tone} size={5} pulse={status === 'online'} />
          {statusLabel}
        </span>
      </div>

      {/* Meta rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <MetaRow
          label={t('hyper.device.last_seen')}
          value={device.last_seen ? deviceRelTime(device.last_seen, t) : t('hyper.device.never_seen')}
        />
        {device.model && <MetaRow label={t('hyper.device.model')} value={device.model} />}
        {device.external_id && <MetaRow label={t('hyper.device.id')} value={device.external_id} mono />}
        {device.location_id && <MetaRow label={t('hyper.device.location')} value={device.location_id} mono />}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {device.external_id && (
          <button
            onClick={() => navigateTo(`/device/${device.external_id}`)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '7px 12px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            {t('hyper.device.open_full')} <Icon.chevR size={11} />
          </button>
        )}
        {onAskMerlin && (
          <button
            onClick={() => onAskMerlin(t('loctree.ask_prompt', { name: displayName }))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '7px 12px',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            <Icon.sparkle size={11} /> {t('action.ask_merlin')}
          </button>
        )}
      </div>

      {/* Recent activity */}
      <DeviceActivityCard events={events} loaded={eventsLoaded} crewByBadge={crewByBadge} t={t} />
    </div>
  );
}

// Compact label · value row used in the device detail card.
function MetaRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11 }}>
      <div style={{ color: 'var(--text-dim)', minWidth: 70, flexShrink: 0 }}>{label}</div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          color: 'var(--text)',
          fontFamily: mono ? 'var(--mono)' : 'inherit',
          wordBreak: 'break-all',
          fontWeight: mono ? 500 : 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// Recent-events feed mirroring DeviceDetailPage.ActivityCard at a
// tighter scale to fit the Hypervisor right pane.
function DeviceActivityCard({ events, loaded, crewByBadge, t }) {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <Icon.sparkle size={11} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 11.5, fontWeight: 700 }}>{t('hyper.device.recent_activity')}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
          {loaded ? events.length : '…'}
        </span>
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {!loaded && (
          <div style={{ padding: 12, fontSize: 11, color: 'var(--text-dim)' }}>
            {t('hyper.device.activity_loading')}
          </div>
        )}
        {loaded && events.length === 0 && (
          <div style={{ padding: 12, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {t('hyper.device.activity_empty')}
          </div>
        )}
        {events.map((event, i) => {
          const desc = describeDeviceEvent(event, { crewByBadge });
          const IconComp = Icon[desc.iconKey] || Icon.dots;
          return (
            <div
              key={event.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 12px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  flexShrink: 0,
                  background: 'var(--surface)',
                  color: 'var(--text-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconComp size={9} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>{desc.title}</div>
                {desc.hint && (
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1, fontFamily: 'var(--mono)' }}>
                    {desc.hint}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  color: 'var(--text-dim)',
                  flexShrink: 0,
                  marginTop: 2,
                  fontFamily: 'var(--mono)',
                }}
              >
                {deviceRelTime(event.occurred_at, t)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Status → Dot tone mapping. Mirrors DeviceDetailPage's STATUS_TONE.
const DEVICE_STATUS_TONE = {
  online: 'ok',
  degraded: 'warn',
  offline: 'risk',
  updating: 'info',
  provisioning: 'info',
};

// Compact relative time helper — local copy of DeviceDetailPage's
// relTime() so we don't have to widen its export surface.
function deviceRelTime(iso, t) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return t('ddp.rel.just_now');
  if (sec < 3600) return t('ddp.rel.min_ago', { n: Math.floor(sec / 60) });
  const hr = Math.floor(sec / 3600);
  if (hr < 48) return t('ddp.rel.hour_ago', { n: hr });
  return t('ddp.rel.day_ago', { n: Math.floor(hr / 24) });
}

// Same as DEVICE_KIND_ICON, kept independent so the leaf-row icon set
// can stay tight while the detail-card icon set can diverge later if
// we want a richer set.
const DEVICE_KIND_ICON_DETAIL = {
  smart_display: 'display',
  people_counter: 'people',
  smart_logger: 'badge',
  parking_spot_sensor: 'pin',
  ev_charger: 'bolt',
  bacnet_thermostat: 'hvac',
  onvif_camera: 'camera',
  iclass_reader: 'shield',
};

// ──── Route detail card ────
// Renders in the Hypervisor right pane when a routeId is selected.
// Pulls the full route detail + a derived audit feed (device_events
// on devices that live on any floor the route covers — best-effort
// until route_runs lands).
export function RouteDetailCard({ routeId, onBack }) {
  const t = useT();
  const crewByBadge = useCrewByBadge();
  const { route, zones, assignments, activity, floors, deviceCount, ready, error } = useRouteDetail(routeId);

  if (!ready) {
    return (
      <div style={{ padding: 24, fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
        <Icon.sparkle size={16} style={{ opacity: 0.6 }} />
        <div style={{ marginTop: 10 }}>{t('hyper.route.loading')}</div>
      </div>
    );
  }
  if (error || !route) {
    return (
      <div
        style={{
          padding: 24,
          fontSize: 12,
          color: 'var(--text-dim)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <div>{error || t('hyper.route.not_found')}</div>
        {onBack && (
          <button onClick={onBack} style={backButtonStyles}>
            <Icon.chevR size={11} style={{ transform: 'rotate(180deg)' }} /> {t('hyper.route.back')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {onBack && (
        <button onClick={onBack} style={backButtonStyles}>
          <Icon.chevR size={11} style={{ transform: 'rotate(180deg)' }} /> {t('hyper.route.back')}
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon.people size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25, wordBreak: 'break-word' }}>{route.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            <Pill tone="accent">{kindReadable(route.service_type)}</Pill>
            <Pill tone="info">{route.cadence}</Pill>
            {!route.active && <Pill tone="neutral">{t('hyper.route.inactive')}</Pill>}
          </div>
        </div>
      </div>

      {route.description && (
        <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5 }}>{route.description}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {route.expected_start_time && (
          <MetaRow label={t('hyper.route.starts_at')} value={String(route.expected_start_time).slice(0, 5)} />
        )}
        {route.expected_duration_min != null && (
          <MetaRow
            label={t('hyper.route.duration')}
            value={t('hyper.route.minutes', { n: route.expected_duration_min })}
          />
        )}
        {route.cadence === 'custom' && route.cadence_days?.length > 0 && (
          <MetaRow label={t('hyper.route.days')} value={(route.cadence_days || []).map(dowLabel).join(' · ')} />
        )}
        <MetaRow
          label={t('hyper.route.coverage')}
          value={t('hyper.route.coverage_summary', {
            floors: floors.length,
            zones: zones.length,
            devices: deviceCount,
          })}
        />
      </div>

      {zones.length > 0 && (
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <Icon.map size={11} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 11.5, fontWeight: 700 }}>{t('hyper.route.zones')}</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{zones.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {zones.map((z, i) => (
              <div
                key={z.id}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  padding: '6px 12px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)', minWidth: 24 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                  {z.name}
                </span>
                {z.floor && (
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>F{z.floor}</span>
                )}
                {z.code && (
                  <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{z.code}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {assignments.length > 0 && (
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <Icon.people size={11} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 11.5, fontWeight: 700 }}>{t('hyper.route.assignments')}</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
              {assignments.length}
            </span>
          </div>
          <div>
            {assignments.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    flexShrink: 0,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9.5,
                    fontWeight: 700,
                    border: '1px solid var(--border)',
                  }}
                >
                  {a.member?.initials || (a.member?.name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{a.member?.name || '—'}</div>
                  {a.member?.role && <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{a.member.role}</div>}
                </div>
                <Pill tone={a.role === 'primary' ? 'accent' : 'neutral'}>{t(`hyper.route.role.${a.role}`)}</Pill>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Derived audit feed. */}
      <div
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <Icon.sparkle size={11} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 11.5, fontWeight: 700 }}>{t('hyper.route.recent_activity')}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{activity.length}</span>
        </div>
        <div
          style={{
            padding: '8px 12px',
            fontSize: 10,
            color: 'var(--text-dim)',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            lineHeight: 1.5,
          }}
        >
          {t('hyper.route.activity_hint')}
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {activity.length === 0 && (
            <div style={{ padding: 12, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              {t('hyper.route.activity_empty')}
            </div>
          )}
          {activity.map((event, i) => {
            const desc = describeDeviceEvent(event, { crewByBadge });
            const IconComp = Icon[desc.iconKey] || Icon.dots;
            return (
              <div
                key={event.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '8px 12px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    flexShrink: 0,
                    background: 'var(--surface)',
                    color: 'var(--text-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconComp size={9} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>{desc.title}</div>
                  {desc.hint && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1, fontFamily: 'var(--mono)' }}>
                      {desc.hint}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 9.5,
                    color: 'var(--text-dim)',
                    flexShrink: 0,
                    marginTop: 2,
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {deviceRelTime(event.occurred_at, t)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const backButtonStyles = {
  alignSelf: 'flex-start',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 10px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-soft)',
  cursor: 'pointer',
  fontFamily: 'var(--font)',
};

function dowLabel(d) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d] || String(d);
}
