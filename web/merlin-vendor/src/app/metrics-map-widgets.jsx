// Map widgets — EcosystemMapWidget (multi-site OSM tile map) and
// BuildingMapWidget (single-building pin), plus their OSM tile helpers.
// Extracted from MetricsWidgets.jsx (2026-06-05). Self-contained; imports
// coordsForBuilding from the weather module. MetricsWidgets re-exports both
// widgets so Dashboard's import site is unchanged.

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, Pill } from './primitives.jsx';
import { Icon } from './icons.jsx';
import { useT } from './i18n.js';
import { FEB_BRANCH_POINTS } from './data/feb-branches.js';
import { coordsForBuilding } from './metrics-weather-widget.jsx';

// ─────────────────────────────────────────────────────────────────
// 7. EcosystemMapWidget — wraps the existing EcosystemMap / ImfMap
//    leaflet renderers in a card-sized container. Hidden for
//    single-building workspaces (the WeatherWidget covers those).
// ─────────────────────────────────────────────────────────────────

// EcosystemMapWidget — multi-site map. Renders raw OSM tiles (no
// react-leaflet, no MapContainer hooks — same pattern that
// BuildingMapWidget proved out in tight 380px cells) and overlays
// every branch as a pulsing pink dot at its real lat/lng. Pre-2026-05-10
// this used a hand-drawn NY silhouette + synthetic dots; replaced
// with real geography after JB flagged it.
//
// IMF variant (HQ1 + HQ2 in DC) keeps its abstract two-squares render
// since there's no branch-fixture file for it yet.
export function EcosystemMapWidget({ ctx }) {
  const t = useT();
  const building = ctx?.building;
  if (!building || building.kind !== 'ecosystem') return null;

  const branchCount = building.branches || (building.variant === 'imf' ? 2 : 0);
  const showOsm = building.variant !== 'imf' && FEB_BRANCH_POINTS.length > 0;

  return (
    <Card
      pad={false}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <Icon.map size={13} style={{ color: 'var(--accent)' }} />
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {t('widget.ecomap.title', { name: building.name })}
        </div>
        <div style={{ flex: 1 }} />
        {branchCount > 0 && <Pill tone="info">{branchCount}</Pill>}
      </div>
      {showOsm ? (
        <EcosystemOsmMap points={FEB_BRANCH_POINTS} />
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'radial-gradient(420px 200px at 50% 50%, color-mix(in oklch, var(--accent) 14%, transparent), transparent 70%)',
          }}
        >
          <ImfSilhouette />
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              right: 12,
              fontSize: 11,
              color: 'var(--text-dim)',
              textAlign: 'center',
            }}
          >
            {t('widget.ecomap.subtitle', { addr: building.addr || '' })}
          </div>
        </div>
      )}
    </Card>
  );
}

// IMF: two side-by-side rounded squares for HQ1+HQ2.
function ImfSilhouette() {
  return (
    <svg viewBox="0 0 220 120" width="80%" style={{ display: 'block', maxHeight: 200 }}>
      <rect
        x="20"
        y="30"
        width="80"
        height="60"
        rx="10"
        fill="color-mix(in oklch, var(--accent) 14%, var(--surface-2))"
        stroke="var(--accent)"
        strokeWidth={1.5}
      />
      <text x="60" y="65" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--text-soft)' }}>
        HQ1
      </text>
      <rect
        x="120"
        y="30"
        width="80"
        height="60"
        rx="10"
        fill="color-mix(in oklch, var(--accent) 14%, var(--surface-2))"
        stroke="var(--accent)"
        strokeWidth={1.5}
      />
      <text x="160" y="65" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--text-soft)' }}>
        HQ2
      </text>
    </svg>
  );
}

// Vanilla Leaflet (no react-leaflet — react-leaflet's hook usage was
// what crashed in the 380px cell pre-PR-#79). Imperative L.map in a
// useEffect: zoom controls + drag pan + scroll-wheel zoom out of the
// box. CARTO light_all tiles + a CSS grayscale filter render
// monochrome. ResizeObserver triggers invalidateSize() so the map
// repaints when the cell or the dock toggles.
function EcosystemOsmMap({ points }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || mapRef.current) return;

    // bbox for fitBounds.
    let minLat = 90,
      maxLat = -90;
    let minLng = 180,
      maxLng = -180;
    for (const [lat, lng] of points) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    const bounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng]);

    // Defensive: turn off every Leaflet handler that could hijack the
    // page's scroll/zoom gestures. The Metrics grid is the dominant
    // interaction model — the user must always be able to scroll past
    // the widget. Drag-pan stays on; zoom happens via the +/- buttons,
    // mac trackpad pinch (a wheel+ctrl event that scrollWheelZoom: false
    // already blocks), or double-click on the zoom buttons.
    const map = L.map(node, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      minZoom: 4,
      maxZoom: 14,
      worldCopyJump: true,
    });
    // Belt + braces: explicitly let trackpad / touch vertical scroll
    // pass through the map container even on browsers that interpret
    // those as touch events. Default Leaflet sets `touch-action: none`
    // when both dragging + touchZoom are on — touchZoom is now off, but
    // we override the container directly so drag-pan stays click-only.
    node.style.touchAction = 'pan-y';
    mapRef.current = map;
    map.fitBounds(bounds, { padding: [16, 16] });

    // Monochrome basemap. CARTO light_all is already minimal; the
    // grayscale filter (applied via CSS class on the tile pane) takes
    // it the rest of the way to true B/W.
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
      className: 'merlin-mono-tiles',
    });
    tiles.addTo(map);

    // Branch dots — circleMarker so they don't scale on zoom (kept at a
    // constant pixel radius) while still hugging their lat/lng anchor.
    const dotLayer = L.layerGroup();
    for (const [lat, lng] of points) {
      L.circleMarker([lat, lng], {
        radius: 3.5,
        color: '#ffffff',
        weight: 1.2,
        fillColor: '#FF00B2',
        fillOpacity: 0.85,
        opacity: 0.95,
      }).addTo(dotLayer);
    }
    dotLayer.addTo(map);

    // Leaflet sometimes mounts before the parent flex layout settles —
    // forcing invalidateSize after layout + on subsequent resize keeps
    // the tile grid aligned with the actual container box.
    setTimeout(() => map.invalidateSize(), 0);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(node);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // points is the stable import from data/feb-branches.js — safe to
    // omit from deps. Re-creating the map on every render would be wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        background: 'var(--surface-2)',
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// 8. BuildingMapWidget — single-building location map. Counterpart
//    to EcosystemMapWidget: hidden on multi-site workspaces. Uses
//    raw OpenStreetMap tiles via <img> (no react-leaflet, no hook
//    invariants in tight cells), with a pin layered at the exact
//    lat/lng pixel position so the building sits dead-centre.
// ─────────────────────────────────────────────────────────────────

const OSM_TILE_SIZE = 256;
const OSM_ZOOM = 15;

// Slippy-map projection — lat/lng → world pixel at the chosen zoom.
function lngLatToWorldPx(lng, lat, z) {
  const worldSize = OSM_TILE_SIZE * Math.pow(2, z);
  const x = ((lng + 180) / 360) * worldSize;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * worldSize;
  return { x, y };
}

export function BuildingMapWidget({ ctx }) {
  const t = useT();
  const building = ctx?.building;
  if (!building || building.kind !== 'building') return null;
  const coords = coordsForBuilding(building);
  if (!coords) return null;

  // Compute the 2×2 tile grid that puts the building closest to the
  // visual centre. Pick whichever pair of horizontal / vertical
  // tiles flanks the building's lat/lng.
  const { x: xWorld, y: yWorld } = lngLatToWorldPx(coords.lng, coords.lat, OSM_ZOOM);
  const tileX = Math.floor(xWorld / OSM_TILE_SIZE);
  const tileY = Math.floor(yWorld / OSM_TILE_SIZE);
  const pxInTileX = xWorld - tileX * OSM_TILE_SIZE;
  const pxInTileY = yWorld - tileY * OSM_TILE_SIZE;
  const ax = pxInTileX < OSM_TILE_SIZE / 2 ? tileX - 1 : tileX;
  const ay = pxInTileY < OSM_TILE_SIZE / 2 ? tileY - 1 : tileY;
  const pinGridX = (tileX - ax) * OSM_TILE_SIZE + pxInTileX;
  const pinGridY = (tileY - ay) * OSM_TILE_SIZE + pxInTileY;

  const tiles = [];
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      tiles.push({
        url: `https://tile.openstreetmap.org/${OSM_ZOOM}/${ax + dx}/${ay + dy}.png`,
        x: dx * OSM_TILE_SIZE,
        y: dy * OSM_TILE_SIZE,
        key: `${ax + dx}-${ay + dy}`,
      });
    }
  }

  // Click-through to OpenStreetMap so users can pan / zoom around.
  const osmHref = `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=${OSM_ZOOM}/${coords.lat}/${coords.lng}`;

  return (
    <Card
      pad={false}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <Icon.map size={13} style={{ color: 'var(--accent)' }} />
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {building.name}
          </div>
          {building.addr && (
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--text-dim)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {building.addr}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <a
          href={osmHref}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}
        >
          {t('widget.bldgmap.open')} ↗
        </a>
      </div>

      {/* Tile container — translates the 512×512 grid so the pin
          lands at the centre of whatever cell width we have. */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          background: 'var(--surface-2)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 2 * OSM_TILE_SIZE,
            height: 2 * OSM_TILE_SIZE,
            transform: `translate(-${pinGridX}px, -${pinGridY}px)`,
          }}
        >
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              loading="lazy"
              draggable={false}
              style={{
                position: 'absolute',
                left: tile.x,
                top: tile.y,
                width: OSM_TILE_SIZE,
                height: OSM_TILE_SIZE,
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          ))}
        </div>

        {/* Pin — sits at the exact lat/lng centre of the visible
            window. Pulsing accent ring so it reads even on a busy
            tile background. */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <MapPin />
        </div>

        {/* Attribution — required by OSM tile policy. Tiny + pinned
            bottom-right; the chrome (top-right) sits above it. */}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          style={{
            position: 'absolute',
            bottom: 4,
            right: 6,
            fontSize: 9,
            color: 'var(--text-dim)',
            background: 'color-mix(in oklch, var(--surface) 80%, transparent)',
            padding: '1px 5px',
            borderRadius: 4,
            textDecoration: 'none',
          }}
        >
          © OpenStreetMap
        </a>
      </div>
    </Card>
  );
}

// Pin marker rendered above the map tiles. Tear-drop body + pulsing
// accent halo so it reads at a glance on any map background.
function MapPin() {
  return (
    <div style={{ position: 'relative', width: 28, height: 36 }}>
      <span
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translate(-50%, 60%)',
          width: 22,
          height: 8,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.25)',
          filter: 'blur(2px)',
        }}
      />
      <svg
        width={28}
        height={36}
        viewBox="0 0 28 36"
        style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))' }}
      >
        <path
          d="M14 2 C7 2 2 7 2 14 c0 8 12 19 12 19 s12-11 12-19 c0-7-5-12-12-12 z"
          fill="var(--accent)"
          stroke="#ffffff"
          strokeWidth={1.5}
        />
        <circle cx={14} cy={14} r={4.2} fill="#ffffff" />
      </svg>
      {/* Pulsing halo at the pin tip. */}
      <span
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translate(-50%, 50%)',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: 'var(--accent)',
          opacity: 0.5,
          animation: 'merlinPulse 1.8s ease-out infinite',
        }}
      />
    </div>
  );
}
