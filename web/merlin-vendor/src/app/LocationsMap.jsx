// Phase 14g — geographic view of the location tree.
// A Leaflet map with a marker per location that has lat/lng set. Buildings
// use one tone, ecosystems (grouping nodes) use another. Locations missing
// coordinates are listed in a sidebar so admins know what's unplotted.
// The map view shares the search filter from LocationsSection via the
// `filter` prop — when a filter is active, only matching locations render.
//
// Clustering is deferred. 4–20 demo markers render fine without it; once
// a customer has hundreds, we'll add react-leaflet-markercluster.

import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useT } from './i18n.js';

// Global ish bounds used when nothing is plotted — falls back to US
// roughly so the initial frame isn't the entire world.
const FALLBACK_BOUNDS = [
  [25.0, -125.0],
  [49.5, -66.0],
];

export function LocationsMap({ buildings, filter }) {
  const t = useT();
  const items = Object.values(buildings);
  // Respect the LocationsSection search/kind filter. If null, everything
  // qualifies. If set, only plot nodes in the visible set.
  const visible = (l) => !filter || filter.visible.has(l.id);
  const plotted = items.filter((l) => visible(l) && l.latitude != null && l.longitude != null);
  const unplotted = items.filter((l) => visible(l) && (l.latitude == null || l.longitude == null));

  const isDark =
    typeof document !== 'undefined' &&
    (document.body.classList.contains('dark') || document.body.classList.contains('bold-variant'));

  // Frame the map around the actual plotted points when we have some;
  // otherwise fall back to the US bounds so the map isn't the whole globe.
  const bounds = useMemo(() => {
    if (plotted.length === 0) return FALLBACK_BOUNDS;
    const lats = plotted.map((p) => Number(p.latitude));
    const lngs = plotted.map((p) => Number(p.longitude));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    // Pad a little so markers near the edges aren't right at the frame.
    const latPad = Math.max(0.2, (maxLat - minLat) * 0.15);
    const lngPad = Math.max(0.2, (maxLng - minLng) * 0.15);
    return [
      [minLat - latPad, minLng - lngPad],
      [maxLat + latPad, maxLng + lngPad],
    ];
  }, [plotted]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: 12, marginTop: 4 }}>
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 10',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <MapContainer
          bounds={bounds}
          boundsOptions={{ padding: [20, 20] }}
          minZoom={2}
          maxZoom={14}
          scrollWheelZoom
          zoomControl={false}
          attributionControl
          style={{ height: '100%', width: '100%', background: isDark ? '#0a0d14' : '#e9edf5' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={
              isDark
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            }
            subdomains="abcd"
          />
          {plotted.map((l) => {
            const isEco = l.kind === 'ecosystem';
            const color = isEco ? '#2185D0' : '#FF00B2';
            return (
              <CircleMarker
                key={l.id}
                center={[Number(l.latitude), Number(l.longitude)]}
                radius={isEco ? 9 : 6}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.85,
                  weight: 1.5,
                  opacity: 1,
                }}
              >
                <Popup closeButton={false}>
                  <div style={{ fontFamily: 'inherit', fontSize: 12.5, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{l.name}</div>
                    <div style={{ color: '#666', fontSize: 11 }}>{l.addr || '—'}</div>
                    <div
                      style={{
                        color: '#888',
                        fontSize: 10.5,
                        marginTop: 4,
                        textTransform: 'uppercase',
                        letterSpacing: 0.2,
                      }}
                    >
                      {isEco ? t('locmap.popup.ecosystem') : t('locmap.popup.building')}
                      {l.floors
                        ? l.floors === 1
                          ? t('locmap.popup.floors_suffix_one', { n: l.floors })
                          : t('locmap.popup.floors_suffix', { n: l.floors })
                        : ''}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
          <ZoomControl position="bottomright" />
        </MapContainer>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 12,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: 0.2,
          }}
        >
          {t('locmap.plotted', { n: plotted.length })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
          <span
            style={{ width: 10, height: 10, background: '#FF00B2', borderRadius: '50%', display: 'inline-block' }}
          />
          {t('locmap.legend.buildings')}
          <span
            style={{
              marginLeft: 8,
              width: 12,
              height: 12,
              background: '#2185D0',
              borderRadius: '50%',
              display: 'inline-block',
            }}
          />
          {t('locmap.legend.ecosystems')}
        </div>
        {unplotted.length > 0 && (
          <>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: 0.2,
                marginTop: 8,
              }}
            >
              {t('locmap.unplotted', { n: unplotted.length })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{t('locmap.unplotted_hint')}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {unplotted.slice(0, 10).map((l) => (
                <li
                  key={l.id}
                  style={{
                    fontSize: 11.5,
                    color: 'var(--text-soft)',
                    padding: '4px 6px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l.name}
                </li>
              ))}
              {unplotted.length > 10 && (
                <li style={{ fontSize: 10.5, color: 'var(--text-faint)', padding: '2px 6px' }}>
                  {t('locmap.unplotted_more', { n: unplotted.length - 10 })}
                </li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
