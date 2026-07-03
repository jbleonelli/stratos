// IMF ecosystem map — DC-scoped Leaflet view with HQ1 + HQ2 markers.
import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Dot } from './primitives.jsx';
import { IMF_SITES } from './imf-data.js';
import { useFleetViewModel } from './devices-store.js';
import { useT } from './i18n.js';

// Tight DC bounds centered on IMF campus (Foggy Bottom / Pennsylvania Ave).
const DC_BOUNDS = [
  [38.886, -77.06],
  [38.912, -77.028],
];

export function ImfMap({ building }) {
  const t = useT();
  const { fleet } = useFleetViewModel(building);
  const isDark =
    typeof document !== 'undefined' &&
    (document.body.classList.contains('dark') || document.body.classList.contains('bold-variant'));

  // Group the REAL device fleet per IMF site. A device belongs to a site when
  // its location_id starts with the site id (e.g. 'imf-hq1-f10' → 'imf-hq1').
  // 'provisioning' devices are counted in the site total but not in the 4
  // status rows (not yet reporting).
  const sitesEnriched = useMemo(() => {
    return IMF_SITES.map((s) => {
      const siteDevices = (fleet || []).filter(
        (d) => typeof d.location_id === 'string' && (d.location_id === s.id || d.location_id.startsWith(s.id + '-')),
      );
      const counts = { online: 0, degraded: 0, offline: 0, updating: 0 };
      siteDevices.forEach((d) => {
        if (counts[d.status] != null) counts[d.status] += 1;
      });
      const displays = siteDevices.filter((d) => d.type === 'smart_display_classic').length;
      const counters = siteDevices.filter((d) => d.type === 'people_counter_basic').length;
      return { ...s, devices: siteDevices.length, displays, counters, counts };
    });
  }, [fleet]);

  // Legend totals derived from the real fleet.
  const fleetTotals = useMemo(() => {
    const totals = { total: (fleet || []).length, online: 0, degraded: 0, offline: 0, updating: 0 };
    sitesEnriched.forEach((s) => {
      totals.online += s.counts.online;
      totals.degraded += s.counts.degraded;
      totals.offline += s.counts.offline;
      totals.updating += s.counts.updating;
    });
    return totals;
  }, [fleet, sitesEnriched]);

  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '800 / 480',
        background: 'var(--surface-2)',
        overflow: 'hidden',
      }}
    >
      <MapContainer
        bounds={DC_BOUNDS}
        boundsOptions={{ padding: [30, 30] }}
        minZoom={12}
        maxZoom={18}
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

        {sitesEnriched.map((site) => {
          const reporting = site.counts.online + site.counts.degraded + site.counts.offline + site.counts.updating;
          const worst =
            reporting === 0
              ? 'none'
              : site.counts.offline > 0
                ? 'offline'
                : site.counts.degraded > 0
                  ? 'degraded'
                  : site.counts.updating > 0
                    ? 'updating'
                    : 'online';
          const color = {
            online: '#10b981',
            degraded: '#f59e0b',
            offline: '#ef4444',
            updating: '#2185D0',
            none: '#9ca3af',
          }[worst];
          return (
            <CircleMarker
              key={site.id}
              center={[site.lat, site.lng]}
              radius={14}
              pathOptions={{
                color: '#fff',
                fillColor: color,
                fillOpacity: 0.92,
                weight: 3,
                opacity: 1,
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -16]} opacity={1}>
                <span style={{ fontFamily: 'var(--font)', fontSize: 11, fontWeight: 700 }}>{site.name}</span>
              </Tooltip>
              <Popup closeButton={false}>
                <SitePopup site={site} />
              </Popup>
            </CircleMarker>
          );
        })}

        <ZoomControl position="bottomright" />
      </MapContainer>

      {/* Legend overlay */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 500,
          padding: '10px 12px',
          background: 'color-mix(in oklch, var(--surface) 90%, transparent)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          fontSize: 11,
          minWidth: 200,
          fontFamily: 'var(--font)',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.12,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            marginBottom: 6,
          }}
        >
          {t('imfmap.eyebrow')}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
          {fleetTotals.total}
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500, marginLeft: 6 }}>
            {t('imfmap.devices_2_buildings')}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>{t('imfmap.subtitle')}</div>
        <LegendRow label={t('status.online')} value={fleetTotals.online} tone="ok" />
        <LegendRow label={t('status.degraded')} value={fleetTotals.degraded} tone="warn" />
        <LegendRow label={t('status.offline')} value={fleetTotals.offline} tone="risk" pulse />
        <LegendRow label={t('status.updating')} value={fleetTotals.updating} tone="info" />
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 500,
          padding: '6px 10px',
          background: 'color-mix(in oklch, var(--surface) 80%, transparent)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontFamily: 'var(--font)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {t('imfmap.hint')}
      </div>
    </div>
  );
}

function LegendRow({ label, value, tone, pulse }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: 11 }}>
      <Dot tone={tone} size={6} pulse={pulse && value > 0} />
      <span style={{ color: 'var(--text-soft)', flex: 1 }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: `var(--${tone})` }}>{value}</span>
    </div>
  );
}

function SitePopup({ site: s }) {
  const t = useT();
  return (
    <div style={{ fontFamily: 'var(--font)', minWidth: 260, padding: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span
          style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.12, textTransform: 'uppercase', color: '#777' }}
        >
          {s.short}
        </span>
        <span style={{ fontSize: 10.5, color: '#aaa', marginLeft: 'auto' }}>{t('imfmap.floors', { n: s.floors })}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{s.name}</div>
      <div style={{ fontSize: 11.5, color: '#666', marginBottom: 6 }}>
        {s.addr} · {s.city} {s.zip}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          padding: 6,
          background: '#f5f5f7',
          borderRadius: 6,
        }}
      >
        <Stat label={t('imfmap.popup.displays')} value={s.displays} />
        <Stat label={t('imfmap.popup.counters')} value={s.counters} />
        <Stat label={t('imfmap.popup.online')} value={s.counts.online} color="#10b981" />
      </div>
      {s.counts.offline + s.counts.degraded > 0 && (
        <div style={{ marginTop: 6, display: 'flex', gap: 6, fontSize: 10.5 }}>
          {s.counts.offline > 0 && (
            <span style={{ color: '#ef4444', fontWeight: 700 }}>
              {t('imfmap.popup.offline_count', { n: s.counts.offline })}
            </span>
          )}
          {s.counts.degraded > 0 && (
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>
              {t('imfmap.popup.degraded_count', { n: s.counts.degraded })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#888', fontWeight: 700, letterSpacing: 0.12, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color || '#111' }}>{value}</div>
    </div>
  );
}
