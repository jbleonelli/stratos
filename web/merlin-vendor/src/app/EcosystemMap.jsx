// Ecosystem view — interactive Leaflet map of NY with 578 branch dots.
// Real tile map (OpenStreetMap via CARTO), zoom/pan, click for branch popup.
import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Dot } from './primitives.jsx';
import { BRANCHES } from './ecosystem-data.js';
import { useT } from './i18n.js';

const STATUS_META = {
  online: { color: '#10b981', labelKey: 'status.online', r: 4 },
  degraded: { color: '#f59e0b', labelKey: 'status.degraded', r: 5 },
  offline: { color: '#ef4444', labelKey: 'status.offline', r: 6 },
  updating: { color: '#2185D0', labelKey: 'status.updating', r: 5 },
};

// NY State bounds for initial framing.
const NY_BOUNDS = [
  [40.45, -79.8],
  [45.05, -71.8],
];

export function EcosystemMap() {
  const t = useT();
  const counts = useMemo(() => {
    const c = { total: BRANCHES.length, online: 0, degraded: 0, offline: 0, updating: 0 };
    BRANCHES.forEach((b) => {
      c[b.status] = (c[b.status] || 0) + 1;
    });
    return c;
  }, []);

  // Detect the active theme so we can pick a matching tile layer.
  const isDark =
    typeof document !== 'undefined' &&
    (document.body.classList.contains('dark') || document.body.classList.contains('bold-variant'));

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
        bounds={NY_BOUNDS}
        boundsOptions={{ padding: [20, 20] }}
        minZoom={6}
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

        {/* Render offline first so they sit under online for hover priority. */}
        {BRANCHES.map((b) => {
          const m = STATUS_META[b.status] || STATUS_META.online;
          return (
            <CircleMarker
              key={b.id}
              center={[b.lat, b.lng]}
              radius={m.r}
              pathOptions={{
                color: m.color,
                fillColor: m.color,
                fillOpacity: 0.85,
                weight: 1.2,
                opacity: 0.95,
              }}
            >
              <Popup closeButton={false}>
                <BranchPopup branch={b} />
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
          minWidth: 180,
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
          {t('ecomap.eyebrow')}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
          {counts.total.toLocaleString()}
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500, marginLeft: 6 }}>
            {t('ecomap.branches_suffix')}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>{t('ecomap.subtitle')}</div>
        <LegendRow label={t('status.online')} value={counts.online} tone="ok" />
        <LegendRow label={t('status.degraded')} value={counts.degraded} tone="warn" />
        <LegendRow label={t('status.offline')} value={counts.offline} tone="risk" pulse />
        <LegendRow label={t('status.updating')} value={counts.updating} tone="info" />
      </div>

      {/* Hint */}
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
        {t('ecomap.hint')}
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

function BranchPopup({ branch: b }) {
  const t = useT();
  const m = STATUS_META[b.status] || STATUS_META.online;
  return (
    <div style={{ fontFamily: 'var(--font)', minWidth: 240, padding: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: m.color }} />
        <span
          style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.12, textTransform: 'uppercase', color: '#777' }}
        >
          {t(m.labelKey)}
        </span>
        <span style={{ fontSize: 10.5, color: '#aaa', fontFamily: 'var(--mono)', marginLeft: 'auto' }}>{b.id}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{b.name}</div>
      <div style={{ fontSize: 11.5, color: '#666', marginBottom: 6 }}>
        {b.address} · {b.city}, NY {b.zip}
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
        <PopupStat label={t('ecomap.popup.display')} value={b.display_id.split('-').pop()} mono />
        <PopupStat label={t('ecomap.popup.battery')} value={`${b.battery}%`} mono />
        <PopupStat label={t('ecomap.popup.rating')} value={`${b.rating}★`} />
      </div>
    </div>
  );
}

function PopupStat({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#888', fontWeight: 700, letterSpacing: 0.12, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#111', fontFamily: mono ? 'var(--mono)' : 'var(--font)' }}>
        {value}
      </div>
    </div>
  );
}
