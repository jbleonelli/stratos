// Graphic Metrics widgets — pure SVG, no chart lib. Each widget is a
// self-contained Card that fetches its own data; the WidgetGrid passes
// in `ctx` (orgId, building, role, etc.) so widgets opt in to what
// they need.
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Pill, Dot } from './primitives.jsx';
import { Icon } from './icons.jsx';
import { useT } from './i18n.js';
import { supabase } from './supabase.js';
import { useEventFirehose, SOURCE_TONES } from './event-firehose.js';
import { useSlaPerformance } from './slas-data.js';
import { useSession } from './auth.js';
import { getSpec, subscribe as subscribeSpecs } from './metrics-spec-store.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Per-widget settings (hook + UI primitives + panels) split out 2026-06-05
// into metrics-widget-settings.jsx (a leaf, so widget files can depend on it
// without a cycle). useWidgetSettings is used by the widgets below; the full
// settings API is re-exported so Dashboard / MetricsLayout imports are unchanged.
import {
  useWidgetSettings,
  SettingsBack,
  SettingsRow,
  SettingsSeg,
  NoSettingsPanel,
  GradientAreaSettings,
  LiveStreamSettings,
  WeatherSettings,
} from './metrics-widget-settings.jsx';
export {
  useWidgetSettings,
  SettingsBack,
  SettingsRow,
  SettingsSeg,
  NoSettingsPanel,
  GradientAreaSettings,
  LiveStreamSettings,
  WeatherSettings,
};
// Weather + map widgets split out 2026-06-05 into their own modules.
// Re-exported here so Dashboard's import sites are unchanged.
export { WeatherWidget } from './metrics-weather-widget.jsx';
export { EcosystemMapWidget, BuildingMapWidget } from './metrics-map-widgets.jsx';
// Note: full Leaflet maps (EcosystemMap, ImfMap) intentionally NOT
// imported here — they crash when mounted into the 380px metrics
// cell. The big-page versions remain available in Hypervisor.

// ─────────────────────────────────────────────────────────────────
// 1. AnimatedKpiRing — big circular gauge that counts up on mount
//    Reads SLA average compliance. Hides if no SLAs.
// ─────────────────────────────────────────────────────────────────
export function KpiRingWidget({ ctx }) {
  const t = useT();
  const { slas, perf, loaded } = useSlaPerformance(ctx.orgId);
  const target = useMemo(() => {
    if (!loaded || !slas?.length) return null;
    const vals = slas
      .map((s) => perf[s.id])
      .filter((p) => p?.computable && typeof p.current === 'number')
      .map((p) => p.current);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [slas, perf, loaded]);

  const animated = useCountUp(target ?? 0, target == null ? 0 : 1100);
  // Show "Loading…" while SLA performance is still resolving; only
  // truly hide (return null) when the workspace has no SLAs at all.
  if (!loaded) return <LoadingCard titleKey="widget.kpi_ring.title_short" />;
  if (!slas?.length) return null;
  if (target == null) return null;

  const tone = animated >= 95 ? 'ok' : animated >= 85 ? 'warn' : 'risk';
  const ringColor = tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : 'var(--risk)';

  const W = 220;
  const r = 92,
    cx = W / 2,
    cy = W / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (animated / 100);

  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(420px 200px at 92% 0%, color-mix(in oklch, ${ringColor} 18%, transparent), transparent 60%)`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ padding: 'var(--pad)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Icon.sla size={13} style={{ color: ringColor }} />
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}
          >
            {t('widget.kpi_ring.eyebrow')}
          </span>
          <Pill tone={tone}>{t(`widget.kpi_ring.${tone}`)}</Pill>
        </div>
        <h2 style={{ margin: '4px 0 12px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          {t('widget.kpi_ring.title', { n: slas.length })}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ position: 'relative', width: W, height: W, flexShrink: 0 }}>
            <svg width={W} height={W} style={{ transform: 'rotate(-90deg)' }}>
              <defs>
                <linearGradient id="kpi-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={ringColor} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={ringColor} />
                </linearGradient>
              </defs>
              <circle cx={cx} cy={cy} r={r} stroke="var(--surface-3)" strokeWidth={14} fill="none" />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                stroke="url(#kpi-ring-grad)"
                strokeWidth={14}
                fill="none"
                strokeDasharray={`${dash} ${c}`}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 8px color-mix(in oklch, ${ringColor} 50%, transparent))` }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 700,
                  color: 'var(--text)',
                  letterSpacing: -0.02,
                  lineHeight: 1,
                  fontFamily: 'var(--font)',
                }}
              >
                {animated.toFixed(1)}
                <span style={{ fontSize: 22, color: 'var(--text-dim)' }}>%</span>
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.15,
                  fontWeight: 700,
                }}
              >
                {t('widget.kpi_ring.label')}
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {slas.slice(0, 5).map((s) => {
              const p = perf[s.id];
              const v = p?.computable && typeof p.current === 'number' ? p.current : null;
              const tgt = s.target_value ?? 95;
              const ok = v != null && v >= tgt;
              const lateral = v != null ? (v / 100) * 100 : 0;
              return (
                <div key={s.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Dot tone={ok ? 'ok' : v == null ? 'off' : 'warn'} size={6} />
                    <span
                      style={{
                        fontSize: 11.5,
                        color: 'var(--text-soft)',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: 'var(--mono)',
                        fontWeight: 700,
                        color: ok ? 'var(--ok)' : v == null ? 'var(--text-faint)' : 'var(--warn)',
                      }}
                    >
                      {v != null ? `${v.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${lateral}%`,
                        background: ok ? 'var(--ok)' : 'var(--warn)',
                        borderRadius: 2,
                        transition: 'width 1.1s cubic-bezier(.22,.61,.36,1)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// 2. GradientAreaWidget — 14-day rolling event volume with animated
//    path-draw + gradient fill. Reads incident_actions counts.
// ─────────────────────────────────────────────────────────────────
function useDailyEventCounts(orgId, days = 14) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['metrics-daily-events', orgId, days],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      since.setHours(0, 0, 0, 0);
      // Mirror the firehose: events come from BOTH incident_actions
      // (legacy spine) AND device_events (Adaptiv smart-display events).
      const [iaRes, deRes] = await Promise.all([
        supabase
          .from('incident_actions')
          .select('created_at, incident_priority')
          .eq('organization_id', orgId)
          .gte('created_at', since.toISOString())
          .limit(5000),
        supabase
          .from('device_events')
          .select('created_at, event_type')
          .eq('organization_id', orgId)
          .gte('created_at', since.toISOString())
          .limit(5000),
      ]);

      const buckets = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        buckets.push({ date: d, label: `${d.getMonth() + 1}/${d.getDate()}`, total: 0, critical: 0 });
      }
      const startMs = buckets[0].date.getTime();
      const dayMs = 24 * 60 * 60 * 1000;

      for (const r of iaRes.data || []) {
        const ms = new Date(r.created_at).getTime();
        const idx = Math.floor((ms - startMs) / dayMs);
        if (idx < 0 || idx >= buckets.length) continue;
        buckets[idx].total += 1;
        if (r.incident_priority === 'critical' || r.incident_priority === 'high') buckets[idx].critical += 1;
      }
      for (const r of deRes.data || []) {
        const ms = new Date(r.created_at).getTime();
        const idx = Math.floor((ms - startMs) / dayMs);
        if (idx < 0 || idx >= buckets.length) continue;
        buckets[idx].total += 1;
        if (r.event_type && r.event_type.startsWith('request_')) buckets[idx].critical += 1;
      }
      return buckets;
    },
  });

  // Live: refetch on new incident_actions / device_events for this org.
  useEffect(() => {
    if (!orgId) return undefined;
    const inval = () => qc.invalidateQueries({ queryKey: ['metrics-daily-events', orgId, days] });
    const chIA = supabase
      .channel(`metrics_daily_ia_${orgId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incident_actions', filter: `organization_id=eq.${orgId}` },
        inval,
      )
      .subscribe();
    const chDE = supabase
      .channel(`metrics_daily_de_${orgId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'device_events', filter: `organization_id=eq.${orgId}` },
        inval,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(chIA);
      supabase.removeChannel(chDE);
    };
  }, [orgId, days, qc]);

  return q.data ?? null;
}

export function GradientAreaWidget({ ctx }) {
  const t = useT();
  const [settings] = useWidgetSettings('gradient-area', { days: 14, showCritical: true });
  const series = useDailyEventCounts(ctx.orgId, settings.days || 14);
  const drawProgress = useDrawAnimation(series ? series.length : 0);
  // Measure the wrapper's actual content width so 1 viewBox unit == 1 CSS px
  // (no stretching, no overflow). Start at W=0 + don't render the SVG until
  // we have a real measurement — defaulting to a fat number caused the SVG
  // to overflow the card on first paint, which confused the layout pass.
  const wrapRef = useRef(null);
  const [W, setW] = useState(0);

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const measure = () => {
      // clientWidth includes padding; subtract our padding (24) AND
      // a small safety margin (4) so the rightmost dot (at W - PAD_R)
      // plus its stroke-half can never visually touch the card border.
      const cw = (el.clientWidth || 0) - 24 - 4;
      if (cw > 0) setW(cw);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!series) return <LoadingCard titleKey="widget.area.title" />;

  // Empty workspace (e.g., adaptiv platform org, brand-new tenant) —
  // hide the cell entirely instead of rendering an axis-only chart
  // with gridlines and zero data. Mirrors agent-donut's behavior so
  // the widget grid stays clean when the workspace has no events yet.
  const total = series.reduce((s, d) => s + d.total, 0);
  if (total === 0) return null;

  // If measurement hasn't landed yet (clientWidth was 0 / RO hasn't
  // fired), fall back to a sensible default. CSS maxWidth:100% on the
  // SVG below clamps it to the wrapper, so a too-wide fallback never
  // visually overflows.
  const effectiveW = W > 0 ? W : 600;
  const H = 220,
    PAD_L = 24,
    PAD_R = 16,
    PAD_T = 16,
    PAD_B = 28;
  const chartW = Math.max(60, effectiveW - PAD_L - PAD_R);
  const chartH = H - PAD_T - PAD_B;
  const max = Math.max(1, ...series.map((d) => d.total));
  const totalCrit = series.reduce((s, d) => s + d.critical, 0);

  const xs = series.map((_, i) => PAD_L + (i / Math.max(1, series.length - 1)) * chartW);
  const ys = series.map((d) => PAD_T + chartH - (d.total / max) * chartH);
  const yc = series.map((d) => PAD_T + chartH - (d.critical / max) * chartH);

  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const areaPath = `${linePath} L${xs[xs.length - 1]},${PAD_T + chartH} L${xs[0]},${PAD_T + chartH} Z`;
  const critPath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${yc[i]}`).join(' ');

  const strokeLen = chartW * 1.6 + 200;

  return (
    <Card pad={false}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <Icon.bolt size={13} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('widget.area.title')}</div>
        <Pill tone="accent">{t('widget.area.total', { n: total.toLocaleString() })}</Pill>
        {settings.showCritical !== false && totalCrit > 0 && (
          <Pill tone="risk">{t('widget.area.critical', { n: totalCrit.toLocaleString() })}</Pill>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
          {t('widget.area.range', { days: settings.days || 14 })}
        </span>
      </div>
      <div
        ref={wrapRef}
        style={{
          padding: 12,
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          minHeight: H,
        }}
      >
        <svg
          width={effectiveW}
          height={H}
          viewBox={`0 0 ${effectiveW} ${H}`}
          preserveAspectRatio="xMinYMid meet"
          overflow="hidden"
          style={{ display: 'block', maxWidth: '100%' }}
        >
          <defs>
            <linearGradient id="metrics-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.42} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Y-axis gridlines */}
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <line
              key={p}
              x1={PAD_L}
              x2={effectiveW - PAD_R}
              y1={PAD_T + chartH * (1 - p)}
              y2={PAD_T + chartH * (1 - p)}
              stroke="var(--border)"
              strokeDasharray="2 4"
              strokeWidth={0.6}
            />
          ))}

          {/* Area under main */}
          <path
            d={areaPath}
            fill="url(#metrics-area-grad)"
            style={{ opacity: drawProgress, transition: 'opacity 1.2s ease' }}
          />

          {/* Critical line (risk) — toggled by per-widget settings */}
          {settings.showCritical !== false && (
            <path
              d={critPath}
              fill="none"
              stroke="var(--risk)"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.7}
              strokeDasharray={`${strokeLen} ${strokeLen}`}
              strokeDashoffset={strokeLen * (1 - drawProgress)}
              style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.22,.61,.36,1)' }}
            />
          )}

          {/* Main line (accent) */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${strokeLen} ${strokeLen}`}
            strokeDashoffset={strokeLen * (1 - drawProgress)}
            style={{
              transition: 'stroke-dashoffset 1.6s cubic-bezier(.22,.61,.36,1)',
              filter: 'drop-shadow(0 1px 2px color-mix(in oklch, var(--accent) 60%, transparent))',
            }}
          />

          {/* Dots */}
          {xs.map((x, i) => (
            <circle
              key={i}
              cx={x}
              cy={ys[i]}
              r={3.2}
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth={1.6}
              style={{ opacity: drawProgress, transition: 'opacity 1s ease' }}
            >
              <title>
                {series[i].label}: {series[i].total} events · {series[i].critical} critical
              </title>
            </circle>
          ))}

          {/* X labels */}
          {xs.map(
            (x, i) =>
              i % 2 === 0 && (
                <text
                  key={i}
                  x={x}
                  y={H - 8}
                  textAnchor="middle"
                  style={{ fontSize: 9, fontFamily: 'var(--mono)', fill: 'var(--text-faint)' }}
                >
                  {series[i].label}
                </text>
              ),
          )}
        </svg>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// 3. BranchHeatmapWidget — NY state map with branch bubbles colored by
//    last-24h cleaning status. Bank-only.
// ─────────────────────────────────────────────────────────────────
function useBranchGeoStatus(orgId) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['metrics-branch-geo', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data: devices } = await supabase.from('devices').select('id, telemetry').eq('organization_id', orgId);
      const bank = (devices || []).filter(
        (d) => d?.telemetry?.service_policy && d.telemetry.branch_lat && d.telemetry.branch_lng,
      );
      if (bank.length === 0) return [];

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const ids = bank.map((d) => d.id);
      const { data: sessions } = await supabase
        .from('device_service_sessions')
        .select('device_id, ended_at, started_at')
        .eq('organization_id', orgId)
        .in('device_id', ids)
        .gte('started_at', since);

      const cleaned = new Set();
      const overstayed = new Set();
      for (const s of sessions || []) {
        cleaned.add(s.device_id);
        if (s.ended_at) {
          const end = new Date(s.ended_at);
          const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false,
          });
          const parts = fmt.formatToParts(end);
          const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
          const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
          if (h * 60 + m > 20 * 60) overstayed.add(s.device_id);
        }
      }
      return bank.map((d) => ({
        id: d.id,
        lat: d.telemetry.branch_lat,
        lng: d.telemetry.branch_lng,
        region: d.telemetry.branch_region || '',
        status: !cleaned.has(d.id) ? 'missed' : overstayed.has(d.id) ? 'overstayed' : 'cleaned',
      }));
    },
  });

  useEffect(() => {
    if (!orgId) return undefined;
    const channel = supabase
      .channel(`metrics_branch_geo_${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_service_sessions', filter: `organization_id=eq.${orgId}` },
        () => qc.invalidateQueries({ queryKey: ['metrics-branch-geo', orgId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);

  return q.data ?? null;
}

export function BranchHeatmapWidget({ ctx }) {
  const t = useT();
  const branches = useBranchGeoStatus(ctx.orgId);

  if (!branches) return <LoadingCard titleKey="widget.heatmap.title_short" />;
  if (branches.length === 0) return null; // workspace has no bank devices — silent.

  const counts = { cleaned: 0, missed: 0, overstayed: 0 };
  for (const b of branches) counts[b.status] += 1;

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
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <Icon.map size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('widget.heatmap.title', { n: branches.length })}</div>
        <div style={{ flex: 1 }} />
        <Pill tone="ok">{t('widget.heatmap.cleaned', { n: counts.cleaned })}</Pill>
        {counts.overstayed > 0 && <Pill tone="warn">{t('widget.heatmap.overstayed', { n: counts.overstayed })}</Pill>}
        {counts.missed > 0 && <Pill tone="risk">{t('widget.heatmap.missed', { n: counts.missed })}</Pill>}
      </div>
      <BranchServiceMap branches={branches} />
    </Card>
  );
}

// Vanilla-Leaflet renderer for the branch service heatmap. Same pattern
// as EcosystemMap: monochrome CARTO tiles + circleMarkers coloured by
// status. Realtime updates rebuild the marker layer in place; the map
// fits bounds on first data only so user pan/zoom survives refreshes.
function BranchServiceMap({ branches }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedRef = useRef(false);

  // Init once.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || mapRef.current) return;

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
    mapRef.current = map;
    node.style.touchAction = 'pan-y';

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
      className: 'merlin-mono-tiles',
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);

    setTimeout(() => map.invalidateSize(), 0);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(node);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Sync markers whenever the data changes (realtime refresh / first load).
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !branches?.length) return;

    layer.clearLayers();

    // CARTO tiles are gray; status dots use brand-aligned hex literals
    // because Leaflet path strokes don't resolve CSS variables.
    const STYLE = {
      cleaned: { color: '#10b981', radius: 3.0, fillOpacity: 0.55 },
      overstayed: { color: '#f59e0b', radius: 4.5, fillOpacity: 0.85 },
      missed: { color: '#ef4444', radius: 5.0, fillOpacity: 0.9 },
    };

    // Render cleaned first (under), issues on top so they read clearly.
    const order = ['cleaned', 'overstayed', 'missed'];
    for (const status of order) {
      for (const b of branches) {
        if (b.status !== status) continue;
        const s = STYLE[status];
        L.circleMarker([b.lat, b.lng], {
          radius: s.radius,
          color: '#ffffff',
          weight: 1.2,
          fillColor: s.color,
          fillOpacity: s.fillOpacity,
          opacity: 0.95,
        }).addTo(layer);
      }
    }

    // Fit only on first batch — preserves user pan/zoom across realtime updates.
    if (!fittedRef.current) {
      const bounds = L.latLngBounds(branches.map((b) => [b.lat, b.lng]));
      map.fitBounds(bounds, { padding: [16, 16] });
      fittedRef.current = true;
    }
  }, [branches]);

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
// 4. AgentDonutWidget — donut chart of last-24h events grouped by
//    source (Sensor / Operator / System / Simulator). Animated arcs.
// ─────────────────────────────────────────────────────────────────
export function AgentDonutWidget({ ctx }) {
  const t = useT();
  const { rows } = useEventFirehose(ctx.orgId, ctx.building?.id);
  const draw = useDrawAnimation(rows.length);

  // Tally by source, last 24h.
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const tally = { Sensor: 0, Operator: 0, System: 0, Simulator: 0 };
  for (const r of rows) {
    const ms = new Date(r.created_at).getTime();
    if (ms < since) continue;
    if (tally[r.source] != null) tally[r.source] += 1;
  }
  const order = ['Sensor', 'Operator', 'System', 'Simulator'];
  const total = order.reduce((s, k) => s + tally[k], 0);

  if (total === 0) return null;

  const W = 220,
    R_OUT = 88,
    R_IN = 56,
    cx = W / 2,
    cy = W / 2;
  let angle = -Math.PI / 2; // start at 12 o'clock
  const arcs = order.map((source) => {
    const pct = tally[source] / total;
    const sweep = pct * Math.PI * 2;
    const a0 = angle,
      a1 = angle + sweep;
    angle = a1;
    return { source, pct, count: tally[source], a0, a1, sweep };
  });

  const toneColor = (source) => {
    const tone = SOURCE_TONES[source] || 'off';
    return {
      ok: 'var(--ok)',
      warn: 'var(--warn)',
      risk: 'var(--risk)',
      accent: 'var(--accent)',
      info: 'var(--info)',
      off: 'var(--text-faint)',
    }[tone];
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon.bolt size={13} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('widget.donut.title')}</div>
        <div style={{ flex: 1 }} />
        <Pill tone="info">{t('widget.donut.total', { n: total.toLocaleString() })}</Pill>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative', width: W, height: W, flexShrink: 0 }}>
          <svg width={W} height={W}>
            <circle
              cx={cx}
              cy={cy}
              r={(R_OUT + R_IN) / 2}
              stroke="var(--surface-3)"
              strokeWidth={R_OUT - R_IN}
              fill="none"
            />
            {arcs.map((a, i) => {
              const color = toneColor(a.source);
              const path = donutArcPath(cx, cy, R_OUT, R_IN, a.a0, a.a1);
              return (
                <path
                  key={i}
                  d={path}
                  fill={color}
                  style={{ opacity: draw, transition: `opacity .8s ease ${i * 120}ms` }}
                >
                  <title>
                    {a.source}: {a.count} ({Math.round(a.pct * 100)}%)
                  </title>
                </path>
              );
            })}
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: -0.02,
                lineHeight: 1,
                fontFamily: 'var(--font)',
              }}
            >
              {total.toLocaleString()}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: 0.15,
                fontWeight: 700,
                marginTop: 4,
              }}
            >
              {t('widget.donut.label')}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {arcs
            .filter((a) => a.count > 0)
            .map((a) => (
              <div key={a.source} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: toneColor(a.source) }} />
                <span style={{ fontSize: 12, color: 'var(--text-soft)', flex: 1 }}>{a.source}</span>
                <span style={{ fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--text)', fontWeight: 700 }}>
                  {a.count}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontFamily: 'var(--mono)',
                    color: 'var(--text-dim)',
                    width: 38,
                    textAlign: 'right',
                  }}
                >
                  {Math.round(a.pct * 100)}%
                </span>
              </div>
            ))}
        </div>
      </div>
    </Card>
  );
}

function donutArcPath(cx, cy, rOut, rIn, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const x0o = cx + rOut * Math.cos(a0),
    y0o = cy + rOut * Math.sin(a0);
  const x1o = cx + rOut * Math.cos(a1),
    y1o = cy + rOut * Math.sin(a1);
  const x0i = cx + rIn * Math.cos(a1),
    y0i = cy + rIn * Math.sin(a1);
  const x1i = cx + rIn * Math.cos(a0),
    y1i = cy + rIn * Math.sin(a0);
  return `M ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o} L ${x0i} ${y0i} A ${rIn} ${rIn} 0 ${large} 0 ${x1i} ${y1i} Z`;
}

// ─────────────────────────────────────────────────────────────────
// 5. LiveStreamWidget — animated feed of last 12 events with shimmer
//    on new rows. New rows fade-in + slide-down.
// ─────────────────────────────────────────────────────────────────
export function LiveStreamWidget({ ctx }) {
  const t = useT();
  const [settings] = useWidgetSettings('live-stream', { cap: 100, source: 'all' });
  const { rows, todayCount } = useEventFirehose(ctx.orgId, ctx.building?.id);
  // Filter by source if user picked one in settings, then cap.
  const filtered =
    settings.source && settings.source !== 'all' ? rows.filter((r) => r.source === settings.source) : rows;
  const cap = Math.max(1, Math.min(200, settings.cap || 100));
  const visible = filtered.slice(0, cap);

  return (
    // Card fills the cell (380px); header is fixed-height; body
    // takes the remaining space and scrolls vertically.
    <Card
      pad={false}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
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
        <Dot tone="ok" pulse size={6} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('widget.stream.title')}</div>
        <Pill tone="info">{t('widget.stream.today', { n: todayCount.toLocaleString() })}</Pill>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
          {t('widget.stream.live')}
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
        }}
      >
        {visible.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
            {t('widget.stream.empty')}
          </div>
        )}
        {visible.map((r, i) => (
          <StreamRow key={`${r.created_at}-${r.id || i}`} row={r} index={i} />
        ))}
      </div>
    </Card>
  );
}

function StreamRow({ row: r, index }) {
  return (
    <div
      key={r.id}
      style={{
        display: 'grid',
        gridTemplateColumns: '70px 80px 1fr 80px',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        background:
          index === 0
            ? 'linear-gradient(90deg, color-mix(in oklch, var(--accent) 14%, transparent), transparent 60%)'
            : 'transparent',
        animation: index === 0 ? 'merlinFadeIn .55s cubic-bezier(.22,.61,.36,1)' : 'none',
        fontSize: 11.5,
      }}
    >
      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-faint)' }}>{fmtClock(r.created_at)}</span>
      <Pill tone={SOURCE_TONES[r.source] || 'off'}>{r.source}</Pill>
      <span style={{ color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.title || r.action || '—'}
      </span>
      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-faint)', textAlign: 'right', fontSize: 10.5 }}>
        {r.actor_name || ''}
      </span>
    </div>
  );
}

function fmtClock(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Generic loading skeleton. Used while a data widget is fetching its
// initial payload — replaces the silent `return null` so users don't
// see a blank cell during cold start. Renders a card-shaped shimmer
// with a soft pulsing accent dot + label so the cell looks intentional.
// Exported so the legacy bank widgets in Dashboard.jsx (SlaBreachStrip,
// BankComplianceCard, BankFinesTrendCard, BankBranchStatusPanel) can
// reuse the same skeleton.
export function LoadingCard({ titleKey }) {
  const t = useT();
  return (
    <Card pad={false} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <Dot tone="accent" pulse size={6} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-soft)' }}>
          {titleKey ? t(titleKey) : t('widget.loading.title')}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div className="merlin-thinking" style={{ fontSize: 18, color: 'var(--accent)' }}>
          <span />
          <span />
          <span />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('widget.loading.subtitle')}</div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// 6. CustomChartWidget — generative widget driven by a Merlin-authored
//    spec from the chat smart-picker. Reads the spec via the per-user
//    metrics-spec-store, builds a Supabase query inside a small
//    whitelist, aggregates client-side, and renders area/line/bar.
//    The id format is `cust:<slug>` and resolves through the store.
// ─────────────────────────────────────────────────────────────────

const ALLOWED_SOURCES = new Set([
  'device_events',
  'incident_actions',
  'device_service_sessions',
  'merlin_asks',
  'agent_runs',
]);

const ALLOWED_METRICS = new Set(['count', 'count_distinct', 'avg', 'sum']);
const ALLOWED_BUCKETS = new Set(['hour', 'day', 'week']);
const ALLOWED_OPS = new Set(['eq', 'gte', 'lte', 'in']);
const ALLOWED_CHARTS = new Set(['area', 'line', 'bar']);

function useCustomSpec(userId, orgId, customId) {
  const [, bump] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    const off = subscribeSpecs(({ userId: u, orgId: o }) => {
      if (u === userId && o === orgId) bump();
    });
    return off;
  }, [userId, orgId]);
  return getSpec(userId, orgId, customId);
}

function readJsonPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function specIsValid(spec) {
  if (!spec || typeof spec !== 'object') return false;
  if (!ALLOWED_SOURCES.has(spec.source)) return false;
  if (!ALLOWED_METRICS.has(spec.metric)) return false;
  if (!ALLOWED_BUCKETS.has(spec.bucket)) return false;
  if (typeof spec.days !== 'number' || spec.days < 1 || spec.days > 365) return false;
  if (
    (spec.metric === 'avg' || spec.metric === 'sum' || spec.metric === 'count_distinct') &&
    (!spec.field || typeof spec.field !== 'string')
  )
    return false;
  if (spec.chart_type && !ALLOWED_CHARTS.has(spec.chart_type)) return false;
  if (spec.filter && !Array.isArray(spec.filter)) return false;
  for (const f of spec.filter || []) {
    if (!f || typeof f.field !== 'string' || !ALLOWED_OPS.has(f.op)) return false;
  }
  return true;
}

// Bucket setup. Each bucket is a [start, end) ms range plus a label.
function makeBuckets(bucketKind, days) {
  const out = [];
  if (bucketKind === 'hour') {
    const total = Math.min(days * 24, 24 * 14); // cap at ~14d for hour resolution
    const now = new Date();
    now.setMinutes(0, 0, 0);
    for (let i = total - 1; i >= 0; i--) {
      const start = new Date(now);
      start.setHours(now.getHours() - i);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);
      out.push({
        start: start.getTime(),
        end: end.getTime(),
        label: `${start.getMonth() + 1}/${start.getDate()} ${String(start.getHours()).padStart(2, '0')}:00`,
      });
    }
  } else if (bucketKind === 'week') {
    const totalWeeks = Math.ceil(days / 7);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = totalWeeks - 1; i >= 0; i--) {
      const start = new Date(today);
      start.setDate(today.getDate() - i * 7 - 6);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      out.push({ start: start.getTime(), end: end.getTime(), label: `${start.getMonth() + 1}/${start.getDate()}` });
    }
  } else {
    // day (default)
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const end = new Date(d);
      end.setDate(d.getDate() + 1);
      out.push({ start: d.getTime(), end: end.getTime(), label: `${d.getMonth() + 1}/${d.getDate()}` });
    }
  }
  return out;
}

function applyMetric(metric, values, distinctSet) {
  if (metric === 'count') return values.length;
  if (metric === 'count_distinct') return distinctSet.size;
  if (values.length === 0) return 0;
  const sum = values.reduce((s, v) => s + v, 0);
  if (metric === 'sum') return sum;
  if (metric === 'avg') return sum / values.length;
  return 0;
}

function useCustomChartData(spec, orgId) {
  const qc = useQueryClient();
  // Stringify so the query key is stable for the same logical spec
  // (specs come from a localStorage read that yields fresh objects).
  const specKey = useMemo(() => (spec ? JSON.stringify(spec) : ''), [spec]);
  const enabled = Boolean(spec && orgId && specIsValid(spec));

  const q = useQuery({
    queryKey: ['custom-chart', orgId, specKey],
    enabled,
    queryFn: async () => {
      const { source, metric, field, bucket, days, filter } = spec;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      since.setHours(0, 0, 0, 0);

      // created_at + the field root + every filter root for JSON-path predicates.
      const cols = new Set(['created_at']);
      if (field) cols.add(field.split('.')[0]);
      for (const f of filter || []) cols.add(f.field.split('.')[0]);

      // Dynamic table name (allowlisted by specIsValid) — keep the untyped
      // client; the typed client requires a literal table.
      let qy = supabase
        .from(source)
        .select(Array.from(cols).join(','))
        .eq('organization_id', orgId)
        .gte('created_at', since.toISOString())
        .limit(8000);

      for (const f of filter || []) {
        if (f.field.includes('.')) continue;
        if (f.op === 'eq') qy = qy.eq(f.field, f.value);
        else if (f.op === 'gte') qy = qy.gte(f.field, f.value);
        else if (f.op === 'lte') qy = qy.lte(f.field, f.value);
        else if (f.op === 'in') qy = qy.in(f.field, f.value);
      }

      const { data, error } = await qy;
      if (error || !data) return [];

      const postFilters = (filter || []).filter((f) => f.field.includes('.'));
      let rows = data;
      if (postFilters.length) {
        rows = rows.filter((r) =>
          postFilters.every((f) => {
            const v = readJsonPath(r, f.field);
            if (f.op === 'eq') return v == f.value; // eslint-disable-line eqeqeq
            if (f.op === 'gte') return v >= f.value;
            if (f.op === 'lte') return v <= f.value;
            if (f.op === 'in') return Array.isArray(f.value) && f.value.includes(v);
            return false;
          }),
        );
      }

      const buckets = makeBuckets(bucket, days);
      const samples = buckets.map(() => ({ values: [], distinct: new Set() }));

      for (const r of rows) {
        const ts = new Date(r.created_at).getTime();
        let idx = -1;
        for (let i = 0; i < buckets.length; i++) {
          if (ts >= buckets[i].start && ts < buckets[i].end) {
            idx = i;
            break;
          }
        }
        if (idx < 0) continue;
        if (metric === 'count') {
          samples[idx].values.push(1);
          continue;
        }
        const v = field ? readJsonPath(r, field) : null;
        if (metric === 'count_distinct') {
          if (v != null) samples[idx].distinct.add(v);
        } else if (typeof v === 'number') {
          samples[idx].values.push(v);
        }
      }

      return buckets.map((b, i) => ({
        label: b.label,
        value: applyMetric(metric, samples[i].values, samples[i].distinct),
        n: samples[i].values.length || samples[i].distinct.size,
      }));
    },
  });

  // Realtime: refetch on any new row landing on this source for the active org.
  useEffect(() => {
    if (!enabled) return undefined;
    const channel = supabase
      .channel(`custom_chart_${spec.id}_${orgId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: spec.source, filter: `organization_id=eq.${orgId}` },
        () => qc.invalidateQueries({ queryKey: ['custom-chart', orgId, specKey] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, spec, orgId, specKey, qc]);

  return q.data ?? null;
}

const ACCENT_COLOR = {
  accent: 'var(--accent)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  risk: 'var(--risk)',
  info: 'var(--info)',
};

export function CustomChartWidget({ ctx, customId }) {
  const t = useT();
  const session = useSession();
  const spec = useCustomSpec(session?.userId, ctx?.orgId, customId);
  const series = useCustomChartData(spec, ctx?.orgId);
  const drawProgress = useDrawAnimation(series ? series.length : 0);

  const wrapRef = useRef(null);
  const [W, setW] = useState(0);
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const measure = () => {
      const cw = (el.clientWidth || 0) - 24 - 4;
      if (cw > 0) setW(cw);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!spec) {
    return (
      <Card>
        <div style={{ padding: 16, fontSize: 12, color: 'var(--text-dim)' }}>{t('widget.custom.spec_missing')}</div>
      </Card>
    );
  }
  if (!specIsValid(spec)) {
    return (
      <Card>
        <div style={{ padding: 16, fontSize: 12, color: 'var(--risk)' }}>{t('widget.custom.spec_invalid')}</div>
      </Card>
    );
  }
  if (!series) return <LoadingCard titleKey="widget.custom.loading" />;

  const accent = ACCENT_COLOR[spec.accent] || ACCENT_COLOR.accent;
  const effectiveW = W > 0 ? W : 600;
  const H = 220,
    PAD_L = 28,
    PAD_R = 16,
    PAD_T = 16,
    PAD_B = 28;
  const chartW = Math.max(60, effectiveW - PAD_L - PAD_R);
  const chartH = H - PAD_T - PAD_B;
  const max = Math.max(1, ...series.map((d) => d.value));
  const last = series.length ? series[series.length - 1].value : 0;
  const labelEvery = series.length > 28 ? Math.ceil(series.length / 14) : 2;
  const chartType = spec.chart_type || 'area';

  const xs = series.map((_, i) => PAD_L + (i / Math.max(1, series.length - 1)) * chartW);
  const ys = series.map((d) => PAD_T + chartH - (d.value / max) * chartH);

  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const areaPath = `${linePath} L${xs[xs.length - 1]},${PAD_T + chartH} L${xs[0]},${PAD_T + chartH} Z`;
  const strokeLen = chartW * 1.6 + 200;

  const fmtValue = (v) => {
    if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString();
    if (Math.abs(v) >= 10) return v.toFixed(1);
    return v.toFixed(2);
  };

  return (
    <Card pad={false} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <Icon.sparkle size={13} style={{ color: accent }} />
        <div style={{ fontSize: 13, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {spec.title || customId}
        </div>
        <Pill tone={spec.accent || 'accent'}>{fmtValue(last)}</Pill>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
          {t('widget.custom.range', { days: spec.days, bucket: spec.bucket })}
        </span>
      </div>
      <div
        ref={wrapRef}
        style={{
          padding: 12,
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          flex: 1,
          minHeight: 0,
        }}
      >
        <svg
          width={effectiveW}
          height={H}
          viewBox={`0 0 ${effectiveW} ${H}`}
          preserveAspectRatio="xMinYMid meet"
          overflow="hidden"
          style={{ display: 'block', maxWidth: '100%' }}
        >
          <defs>
            <linearGradient id={`custom-grad-${customId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.42} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75, 1].map((p) => (
            <line
              key={p}
              x1={PAD_L}
              x2={effectiveW - PAD_R}
              y1={PAD_T + chartH * (1 - p)}
              y2={PAD_T + chartH * (1 - p)}
              stroke="var(--border)"
              strokeDasharray="2 4"
              strokeWidth={0.6}
            />
          ))}

          {chartType === 'area' && (
            <path
              d={areaPath}
              fill={`url(#custom-grad-${customId})`}
              style={{ opacity: drawProgress, transition: 'opacity 1.2s ease' }}
            />
          )}
          {chartType === 'bar' &&
            series.map((d, i) => {
              const w = (chartW / series.length) * 0.7;
              const cx = xs[i];
              const h = (d.value / max) * chartH;
              return (
                <rect
                  key={i}
                  x={cx - w / 2}
                  y={PAD_T + chartH - h}
                  width={w}
                  height={h}
                  fill={accent}
                  rx={2}
                  style={{ opacity: drawProgress, transition: `opacity .8s ease ${(i % 20) * 30}ms` }}
                >
                  <title>
                    {d.label}: {fmtValue(d.value)}
                  </title>
                </rect>
              );
            })}
          {chartType !== 'bar' && (
            <path
              d={linePath}
              fill="none"
              stroke={accent}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${strokeLen} ${strokeLen}`}
              strokeDashoffset={strokeLen * (1 - drawProgress)}
              style={{
                transition: 'stroke-dashoffset 1.6s cubic-bezier(.22,.61,.36,1)',
                filter: `drop-shadow(0 1px 2px color-mix(in oklch, ${accent} 60%, transparent))`,
              }}
            />
          )}

          {chartType !== 'bar' &&
            xs.map((x, i) => (
              <circle
                key={i}
                cx={x}
                cy={ys[i]}
                r={2.6}
                fill="var(--surface)"
                stroke={accent}
                strokeWidth={1.5}
                style={{ opacity: drawProgress, transition: 'opacity 1s ease' }}
              >
                <title>
                  {series[i].label}: {fmtValue(series[i].value)}
                </title>
              </circle>
            ))}

          {xs.map(
            (x, i) =>
              i % labelEvery === 0 && (
                <text
                  key={`l-${i}`}
                  x={x}
                  y={H - 8}
                  textAnchor="middle"
                  style={{ fontSize: 9, fontFamily: 'var(--mono)', fill: 'var(--text-faint)' }}
                >
                  {series[i].label}
                </text>
              ),
          )}
        </svg>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// Animation hooks
// ─────────────────────────────────────────────────────────────────
function useCountUp(target, durationMs = 900) {
  const [v, setV] = useState(0);
  const start = useRef(null);
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
    start.current = null;
    let raf = 0;
    const step = (ts) => {
      if (!start.current) start.current = ts;
      const elapsed = ts - start.current;
      const p = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;
      const eased = 1 - Math.pow(1 - p, 3);
      setV(targetRef.current * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}

function useDrawAnimation(triggerKey) {
  // returns 0 → 1 over ~one tick, mounted-first.
  const [p, setP] = useState(0);
  useEffect(() => {
    setP(0);
    const id = requestAnimationFrame(() => setP(1));
    return () => cancelAnimationFrame(id);
  }, [triggerKey]);
  return p;
}
