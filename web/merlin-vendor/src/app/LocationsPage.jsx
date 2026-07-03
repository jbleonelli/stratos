// LocationsPage — MONITOR → Locations. A card grid of every building &
// ecosystem in the active workspace. Each building card expands in place to show
// the full building fact-sheet (surface, rooms, coordinates, devices, live
// occupancy/peak, per-kind spaces) — the old MONITOR → Building page is merged
// in here. The active building is expanded by default; clicking a card's header
// toggles its details, and "Work here" focuses it (sets the active building and
// jumps to the Now briefing). This is also the default landing on login when the
// user has more than one location.

import React from 'react';
import { Icon } from './icons.jsx';
import { useSL } from './servicing-i18n.js';
import { useBuildingsForActiveOrg } from './custom-locations.js';
import { BuildingDetails } from './BuildingPage.jsx';

function pickLocation(id, onView) {
  try {
    window.setMerlinTweaks?.({ building: id });
  } catch {
    /* noop */
  }
  onView?.('now');
}

function Chevron({ open }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}
    >
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="var(--text-dim)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LocationCard({ b, active, expanded, onToggle, onView }) {
  const sl = useSL();
  const isEco = b.kind === 'ecosystem';
  const [hover, setHover] = React.useState(false);
  const Glyph = isEco ? Icon.campus : Icon.building2;
  const glyphColor = isEco ? '#2185D0' : 'var(--accent)';
  const occPct = !isEco && b.occupancy != null ? Math.round(Number(b.occupancy) * 100) : null;
  const siteCount = b.branches || (Array.isArray(b.sites) ? b.sites.length : 0);
  const canExpand = !isEco; // the building fact-sheet only applies to buildings

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        gridColumn: expanded ? '1 / -1' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        borderRadius: 14,
        background: active ? 'color-mix(in oklch, var(--accent) 7%, var(--surface))' : 'var(--surface)',
        border: `1px solid ${active ? 'var(--accent)' : hover && !expanded ? 'var(--border-strong)' : 'var(--border)'}`,
        transition: 'border-color .15s, box-shadow .15s',
        boxShadow: hover && !expanded ? '0 8px 24px rgba(0,0,0,0.10)' : 'none',
      }}
    >
      {/* Header — clicking toggles details (buildings) or focuses (ecosystems) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => (canExpand ? onToggle() : pickLocation(b.id, onView))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            canExpand ? onToggle() : pickLocation(b.id, onView);
          }
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Outline chip: no fill — a pink stroke (blue for ecosystems) around
            // the rounded square, with the glyph in the same colour.
            color: glyphColor,
            background: 'transparent',
            border: `1.5px solid ${glyphColor}`,
          }}
        >
          <Glyph size={22} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 15.5,
                fontWeight: 800,
                color: 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {b.name}
            </span>
            {active ? (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: 'var(--accent)',
                  background: 'var(--accent-soft)',
                  padding: '2px 7px',
                  borderRadius: 999,
                  flexShrink: 0,
                }}
              >
                {sl('CURRENT', 'ACTUEL')}
              </span>
            ) : null}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}
          >
            {isEco ? sl('Ecosystem', 'Écosystème') : b.addr || sl('Building', 'Bâtiment')}
          </div>
        </div>
        {canExpand ? <Chevron open={expanded} /> : null}
      </div>

      {/* Collapsed: compact stats + occupancy. Expanded: the full fact-sheet. */}
      {expanded ? (
        <BuildingDetails building={b} compact />
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: 'var(--text-soft)' }}>
            {isEco ? (
              <Stat
                icon="campus"
                value={siteCount}
                label={siteCount === 1 ? sl('site', 'site') : sl('sites', 'sites')}
              />
            ) : (
              <Stat
                icon="floor"
                value={b.floors || 0}
                label={(b.floors || 0) === 1 ? sl('floor', 'étage') : sl('floors', 'étages')}
              />
            )}
            <Stat icon="display" value={b.displays || 0} label={sl('displays', 'écrans')} />
            <Stat icon="beacon" value={b.sensors || 0} label={sl('sensors', 'capteurs')} />
          </div>
          {occPct != null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                  }}
                >
                  {sl('Occupancy · live', 'Occupation · en direct')}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>{occPct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(0, Math.min(100, occPct))}%`,
                    background: 'var(--accent)',
                  }}
                />
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Action — focus this location (set active + go to the Now briefing) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => pickLocation(b.id, onView)}
          style={{
            fontFamily: 'inherit',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 700,
            color: active ? 'var(--accent)' : 'var(--text-soft)',
            background: 'transparent',
            border: 'none',
            padding: '4px 2px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {active ? sl('Open workspace', 'Ouvrir l’espace') : sl('Select location', 'Sélectionner cet emplacement')}
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }) {
  const I = Icon[icon] || Icon.building;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <I size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <span style={{ fontWeight: 700, color: 'var(--text)' }}>{Number(value).toLocaleString()}</span>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
    </span>
  );
}

export function LocationsPage({ building, onView }) {
  const sl = useSL();
  const all = useBuildingsForActiveOrg();
  const activeId = building?.id || null;
  const items = Object.keys(all)
    .filter((k) => k !== '__ready')
    .map((k) => all[k])
    .filter(Boolean)
    .sort((a, b) => {
      // Current building first (top-left), then ecosystems, then alphabetical.
      if ((a.id === activeId) !== (b.id === activeId)) return a.id === activeId ? -1 : 1;
      if ((a.kind === 'ecosystem') !== (b.kind === 'ecosystem')) return a.kind === 'ecosystem' ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

  // All cards COLLAPSED by default (JB 2026-07-03) — this is a location picker;
  // the user expands a card to see its detail. No auto-expand of the active one.
  const [expandedId, setExpandedId] = React.useState(null);

  return (
    <main style={{ flex: 1, overflow: 'auto', background: 'var(--surface)', scrollbarGutter: 'stable both-edges' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 12 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {sl('LOCATIONS', 'EMPLACEMENTS')}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: -0.02,
              lineHeight: 1.15,
              color: 'var(--text)',
            }}
          >
            {items.length === 1
              ? sl('Your workspace', 'Votre espace de travail')
              : sl('Which location do you want to select?', 'Quel emplacement voulez-vous sélectionner ?')}
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--text-soft)' }}>
            {items.length === 1
              ? sl('Everything we know about your building.', 'Tout ce que nous savons sur votre bâtiment.')
              : sl(
                  `${items.length} locations — open one for its full detail, or select one.`,
                  `${items.length} emplacements — ouvrez-en un pour le détail, ou sélectionnez-en un.`,
                )}
          </p>
        </div>

        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-dim)', padding: '8px 0' }}>
            {sl('No locations yet.', 'Aucun emplacement pour le moment.')}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 14,
              alignItems: 'start',
            }}
          >
            {items.map((b) => (
              <LocationCard
                key={b.id}
                b={b}
                active={b.id === activeId}
                expanded={b.id === expandedId}
                onToggle={() => setExpandedId((cur) => (cur === b.id ? null : b.id))}
                onView={onView}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
