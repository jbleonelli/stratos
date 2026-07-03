// BuildingPage — MONITOR → Building. A factual fact-sheet for the active
// building: address, surface, floors, rooms (with a per-kind spaces breakdown),
// installed devices, coordinates, and a live occupancy strip — everything we
// know about the building as fact. Works for any user, incl. a contractor
// viewing a client building (the location tree is RLS-readable). Photo is a
// placeholder for now.

import React, { useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { useSL } from './servicing-i18n.js';
import { useRoomKindCounts, useBuildingRecord } from './custom-locations.js';
import { useSession } from './auth.js';
import { useBuildingSensorReadings } from './servicing-data.js';

// Average of a Map<locationId, { value }> sensor-readings map → rounded percent
// (mirrors KpiCockpit's avgOfMap). null when there are no readings.
function avgReadings(m) {
  if (!m || m.size === 0) return null;
  let sum = 0;
  let n = 0;
  for (const v of m.values()) {
    if (v?.value != null && !Number.isNaN(v.value)) {
      sum += v.value;
      n += 1;
    }
  }
  return n ? Math.round(sum / n) : null;
}

// Readable, localized labels for the room/space kinds in the tree. Unknown
// kinds fall back to a humanized version of the raw key.
const KIND_LABEL = {
  restroom: ['Restrooms', 'Sanitaires'],
  meeting_room: ['Meeting rooms', 'Salles de réunion'],
  conference_room: ['Conference rooms', 'Salles de conférence'],
  training_room: ['Training rooms', 'Salles de formation'],
  lounge: ['Lounges', 'Salons'],
  lobby: ['Lobby', 'Hall'],
  amenity: ['Amenities', 'Commodités'],
  cafeteria: ['Cafeteria', 'Cafétéria'],
  dock: ['Loading docks', 'Quais de chargement'],
  boardroom: ['Boardrooms', 'Salles du conseil'],
  mailroom: ['Mailroom', 'Salle du courrier'],
  auditorium: ['Auditoriums', 'Auditoriums'],
  server_room: ['Server rooms', 'Salles serveurs'],
  office: ['Offices', 'Bureaux'],
  warehouse: ['Warehouses', 'Entrepôts'],
  zone: ['Zones', 'Zones'],
};

function kindLabel(kind, sl) {
  const m = KIND_LABEL[kind];
  if (m) return sl(m[0], m[1]);
  const s = (kind || '').replace(/_/g, ' ');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : kind;
}

const fmtInt = (n) => (n == null ? '—' : Number(n).toLocaleString());

function FactRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span
        style={{
          fontSize: 11.5,
          color: 'var(--text-faint)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function StatTile({ icon, label, value, sub }) {
  const I = Icon[icon] || Icon.building;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 14,
        borderRadius: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <I size={14} style={{ color: 'var(--accent)' }} />
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{sub}</div> : null}
    </div>
  );
}

function LiveStat({ label, pct }) {
  if (pct == null) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{pct}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: 'var(--accent)' }} />
      </div>
    </div>
  );
}

// Reusable building fact-sheet body (no page header). Rendered standalone by
// BuildingPage and inline by the expanded LocationsPage card (MONITOR →
// Locations now owns the building detail — the Building tab was merged in).
// `compact` drops the big photo placeholder for the embedded (card) use.
export function BuildingDetails({ building: buildingProp, compact = false }) {
  const sl = useSL();
  const counts = useRoomKindCounts(buildingProp?.id);
  // Prefer the authoritative cache record (full DB row, incl. coordinates) over
  // the prop, which for a contractor is a static template missing some facts.
  const rec = useBuildingRecord(buildingProp?.id);
  const building = useMemo(() => ({ ...(buildingProp || {}), ...(rec || {}) }), [buildingProp, rec]);

  // LIVE occupancy from the occupancy sensors (same RPC the Cockpit/Hypervisor
  // use; drifts with the replay), with the static building.occupancy as fallback
  // when no readings are available.
  const session = useSession();
  const orgId = session?.organizationId || null;
  const { byFloor: occByFloor } = useBuildingSensorReadings(building, orgId, 'occupancy');
  const liveOcc = useMemo(() => avgReadings(occByFloor), [occByFloor]);

  const floors = counts?.floors ?? (building?.floors || null);
  const totalRooms = counts?.totalRooms ?? null;
  const occPct =
    liveOcc != null ? liveOcc : building?.occupancy != null ? Math.round(Number(building.occupancy) * 100) : null;
  // No sensor time-series for a true daily max, so derive a believable peak a
  // step above the live reading (≈the 1.3× ratio of the seed data); fall back to
  // the static peakToday when occupancy isn't live.
  const peakPct =
    liveOcc != null
      ? Math.min(100, Math.round(liveOcc * 1.3))
      : building?.peakToday != null
        ? Math.round(Number(building.peakToday) * 100)
        : null;
  const hasGeo = building?.latitude != null && building?.longitude != null;
  const mapUrl = hasGeo ? `https://www.google.com/maps?q=${building.latitude},${building.longitude}` : null;
  const surface = building?.sqft && building.sqft !== '—' ? building.sqft : null;

  const kinds = useMemo(() => {
    const by = counts?.byKind || {};
    return Object.entries(by).sort((a, b) => b[1] - a[1]);
  }, [counts]);

  if (!buildingProp?.id) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Hero — photo placeholder (full page only) + identity facts */}
      <Card pad style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {compact ? null : (
            <div
              style={{
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background:
                  'linear-gradient(135deg, color-mix(in oklch, var(--accent) 12%, var(--surface)), var(--surface))',
              }}
            >
              <Icon.building size={42} style={{ color: 'var(--accent)', opacity: 0.55 }} />
              <div style={{ fontSize: 12.5, color: 'var(--text-dim)', fontWeight: 600 }}>
                {sl('Building photo', 'Photo du bâtiment')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {sl('No photo on file yet', 'Aucune photo pour le moment')}
              </div>
            </div>
          )}
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 13, justifyContent: 'center' }}>
            <FactRow label={sl('Address', 'Adresse')} value={building.addr || '—'} />
            <FactRow label={sl('Surface', 'Surface')} value={surface || '—'} />
            <FactRow label={sl('Floors', 'Étages')} value={fmtInt(floors)} />
            <FactRow
              label={sl('Rooms & spaces', 'Pièces et espaces')}
              value={totalRooms != null ? fmtInt(totalRooms) : '…'}
            />
            <FactRow
              label={sl('Coordinates', 'Coordonnées')}
              value={
                hasGeo ? (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                  >
                    {Number(building.latitude).toFixed(4)}, {Number(building.longitude).toFixed(4)}
                    <Icon.map size={12} style={{ marginLeft: 5, verticalAlign: '-1px' }} />
                  </a>
                ) : (
                  '—'
                )
              }
            />
          </div>
        </div>
      </Card>

      {/* Factual stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <StatTile icon="floor" label={sl('Floors', 'Étages')} value={fmtInt(floors)} />
        <StatTile
          icon="room"
          label={sl('Rooms & spaces', 'Pièces')}
          value={totalRooms != null ? fmtInt(totalRooms) : '…'}
          sub={sl('across the building', 'dans le bâtiment')}
        />
        <StatTile icon="grid" label={sl('Surface', 'Surface')} value={surface || '—'} />
        <StatTile icon="display" label={sl('Displays', 'Écrans')} value={fmtInt(building.displays)} />
        <StatTile icon="beacon" label={sl('Sensors', 'Capteurs')} value={fmtInt(building.sensors)} />
      </div>

      {/* Live occupancy */}
      {occPct != null || peakPct != null ? (
        <Card pad style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Icon.people size={15} style={{ color: 'var(--accent)' }} />
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
              }}
            >
              {sl('PEOPLE · LIVE NOW', 'PERSONNES · EN DIRECT')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
            <LiveStat label={sl('Occupancy', 'Occupation')} pct={occPct} />
            <LiveStat label={sl('Peak today', 'Pic du jour')} pct={peakPct} />
          </div>
        </Card>
      ) : null}

      {/* Spaces breakdown */}
      {kinds.length > 0 ? (
        <Card pad style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              marginBottom: 12,
            }}
          >
            {sl('SPACES', 'ESPACES')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            {kinds.map(([kind, n]) => (
              <div
                key={kind}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 9,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{kindLabel(kind, sl)}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{fmtInt(n)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

// Standalone full page (header + details). Kept for any deep-link to the old
// Building view; the MONITOR nav no longer shows it (merged into Locations).
export function BuildingPage({ building }) {
  const sl = useSL();
  if (!building?.id) return null;
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
            {sl('BUILDING', 'BÂTIMENT')}
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
            {building.name}
          </h1>
          {building.addr ? (
            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--text-soft)' }}>
              <Icon.pin size={13} style={{ color: 'var(--text-dim)', marginRight: 6, verticalAlign: '-1px' }} />
              {building.addr}
            </p>
          ) : null}
        </div>
        <BuildingDetails building={building} />
      </div>
    </main>
  );
}
