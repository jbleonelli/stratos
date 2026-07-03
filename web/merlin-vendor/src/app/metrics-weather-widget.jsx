// Weather widget — current conditions + 12-hour + 6-day forecast for the
// selected building (Open-Meteo, no API key). Extracted from MetricsWidgets.jsx
// (2026-06-05) to break up a 2.5k-line file. Imports useWidgetSettings from the
// settings leaf (no cycle); exports WeatherWidget (re-exported by MetricsWidgets
// for Dashboard) and coordsForBuilding (used by MetricsWidgets' BuildingMapWidget).

import React, { useState, useEffect } from 'react';
import { Card } from './primitives.jsx';
import { Icon } from './icons.jsx';
import { useT } from './i18n.js';
import { useWidgetSettings } from './metrics-widget-settings.jsx';

// ─────────────────────────────────────────────────────────────────
// 6. WeatherWidget — current conditions + 12-hour forecast for the
//    selected building. Free Open-Meteo API (no key, CORS-friendly,
//    no rate-limiting at our usage). Renders nothing for ecosystems
//    so the EcosystemMap widget covers those.
// ─────────────────────────────────────────────────────────────────

// Hardcoded coords for the seeded buildings/orgs. New buildings
// fall through to a small city → coords lookup, and finally to null
// (widget hides). Adding lat/lng to BUILDINGS later would obsolete
// this table.
const BUILDING_COORDS = {
  hq: { lat: 37.7864, lng: -122.3892, label: 'San Francisco, CA' }, // Meridian HQ
  hospital: { lat: 37.8044, lng: -122.2712, label: 'Oakland, CA' }, // St. Mary's
  nybank: { lat: 40.7128, lng: -74.006, label: 'New York, NY' }, // First Empire Bank fleet center
  imf: { lat: 38.899, lng: -77.042, label: 'Washington, DC' }, // IMF HQ1+HQ2
  feb: { lat: 40.7128, lng: -74.006, label: 'New York, NY' },
  feb2: { lat: 40.7128, lng: -74.006, label: 'New York, NY' },
  sparkleco: { lat: 40.7128, lng: -74.006, label: 'New York, NY' },
};

function coordsForBuilding(building) {
  if (!building) return null;
  const direct = BUILDING_COORDS[building.id];
  if (direct) return direct;
  // Best-effort: parse "City, ST" out of the addr string.
  const addr = (building.addr || '').toLowerCase();
  if (addr.includes('san francisco')) return { lat: 37.7749, lng: -122.4194, label: 'San Francisco, CA' };
  if (addr.includes('oakland')) return { lat: 37.8044, lng: -122.2712, label: 'Oakland, CA' };
  if (addr.includes('new york')) return { lat: 40.7128, lng: -74.006, label: 'New York, NY' };
  if (addr.includes('washington')) return { lat: 38.9072, lng: -77.0369, label: 'Washington, DC' };
  return null;
}

// Open-Meteo `weather_code` → human label + glyph picker. Codes per
// https://open-meteo.com/en/docs (WMO weather interpretation).
const WEATHER_GROUPS = [
  { codes: [0], group: 'clear' },
  { codes: [1, 2], group: 'partly' },
  { codes: [3], group: 'cloudy' },
  { codes: [45, 48], group: 'fog' },
  { codes: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], group: 'rain' },
  { codes: [71, 73, 75, 77, 85, 86], group: 'snow' },
  { codes: [95, 96, 99], group: 'storm' },
];
function weatherGroup(code) {
  for (const g of WEATHER_GROUPS) if (g.codes.includes(code)) return g.group;
  return 'cloudy';
}

function WeatherGlyph({ group, size = 64 }) {
  // Minimal pictogram set — flat, gradient-tinted.
  const sun = (
    <g>
      <circle cx="32" cy="32" r="13" fill="#FFD75A" />
      <g stroke="#FFD75A" strokeWidth={2.4} strokeLinecap="round">
        <line x1="32" y1="6" x2="32" y2="14" />
        <line x1="32" y1="50" x2="32" y2="58" />
        <line x1="6" y1="32" x2="14" y2="32" />
        <line x1="50" y1="32" x2="58" y2="32" />
        <line x1="13" y1="13" x2="19" y2="19" />
        <line x1="45" y1="45" x2="51" y2="51" />
        <line x1="13" y1="51" x2="19" y2="45" />
        <line x1="45" y1="19" x2="51" y2="13" />
      </g>
    </g>
  );
  const cloud = (
    <g>
      <ellipse cx="22" cy="36" rx="10" ry="9" fill="#cbd2dc" />
      <ellipse cx="36" cy="32" rx="14" ry="12" fill="#dde3ec" />
      <ellipse cx="48" cy="38" rx="9" ry="8" fill="#cbd2dc" />
      <rect x="14" y="38" width="38" height="10" rx="5" fill="#dde3ec" />
    </g>
  );
  const rain = (
    <g>
      <ellipse cx="22" cy="28" rx="10" ry="9" fill="#9aa6b8" />
      <ellipse cx="36" cy="24" rx="14" ry="12" fill="#aab5c6" />
      <ellipse cx="48" cy="30" rx="9" ry="8" fill="#9aa6b8" />
      <rect x="14" y="30" width="38" height="10" rx="5" fill="#aab5c6" />
      <g stroke="#5da9e8" strokeWidth={2.4} strokeLinecap="round">
        <line x1="22" y1="46" x2="20" y2="54" />
        <line x1="32" y1="46" x2="30" y2="54" />
        <line x1="42" y1="46" x2="40" y2="54" />
      </g>
    </g>
  );
  const snow = (
    <g>
      <ellipse cx="22" cy="28" rx="10" ry="9" fill="#cbd2dc" />
      <ellipse cx="36" cy="24" rx="14" ry="12" fill="#dde3ec" />
      <ellipse cx="48" cy="30" rx="9" ry="8" fill="#cbd2dc" />
      <rect x="14" y="30" width="38" height="10" rx="5" fill="#dde3ec" />
      <g fill="#ffffff" stroke="#6b95c5" strokeWidth={1}>
        <circle cx="22" cy="50" r="2.4" />
        <circle cx="32" cy="52" r="2.4" />
        <circle cx="42" cy="50" r="2.4" />
      </g>
    </g>
  );
  const storm = (
    <g>
      <ellipse cx="22" cy="26" rx="10" ry="9" fill="#5d6573" />
      <ellipse cx="36" cy="22" rx="14" ry="12" fill="#6e7785" />
      <ellipse cx="48" cy="28" rx="9" ry="8" fill="#5d6573" />
      <rect x="14" y="28" width="38" height="10" rx="5" fill="#6e7785" />
      <polygon points="32,40 26,52 32,52 28,60 40,46 34,46 38,40" fill="#FFD75A" />
    </g>
  );
  const fog = (
    <g stroke="#aab5c6" strokeWidth={4} strokeLinecap="round">
      <line x1="10" y1="22" x2="50" y2="22" />
      <line x1="14" y1="32" x2="54" y2="32" />
      <line x1="10" y1="42" x2="50" y2="42" />
      <line x1="16" y1="52" x2="46" y2="52" />
    </g>
  );
  const partly = (
    <g>
      <circle cx="22" cy="22" r="10" fill="#FFD75A" />
      <ellipse cx="32" cy="36" rx="12" ry="10" fill="#dde3ec" />
      <ellipse cx="44" cy="38" rx="10" ry="9" fill="#cbd2dc" />
    </g>
  );
  const map = { clear: sun, partly, cloudy: cloud, fog, rain, snow, storm };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
      {map[group] || cloud}
    </svg>
  );
}

function useWeather(coords) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!coords) {
      setData(null);
      return;
    }
    let cancelled = false;
    // Two parallel calls: forecast (current + hourly + daily) and
    // air-quality (US AQI + PM2.5 + PM10). Both timezone=auto so
    // local-time fields don't need client-side conversion.
    const fcastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code,uv_index,is_day` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max` +
      `&forecast_days=7&timezone=auto`;
    const aqUrl =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.lat}&longitude=${coords.lng}` +
      `&current=us_aqi,pm10,pm2_5&timezone=auto`;

    function fetchAll() {
      Promise.all([
        fetch(fcastUrl)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(aqUrl)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]).then(([fcast, aq]) => {
        if (cancelled) return;
        // Merge air quality into the forecast object under `air`.
        // Falls back to null if the AQ endpoint is down — widget
        // hides the AQI pill but still renders the rest.
        if (fcast) {
          setData({ ...fcast, air: aq?.current || null });
        } else {
          setData(null);
        }
      });
    }
    fetchAll();
    // Refresh every 15 min so the panel stays current on long-lived sessions.
    const id = setInterval(fetchAll, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [coords?.lat, coords?.lng]);
  return data;
}

export function WeatherWidget({ ctx }) {
  const t = useT();
  const [settings] = useWidgetSettings('weather', { units: 'celsius' });
  const coords = coordsForBuilding(ctx?.building);
  const data = useWeather(coords);
  const isF = settings.units === 'fahrenheit';
  const cToShown = (c) => (isF ? Math.round((c * 9) / 5 + 32) : Math.round(c));
  const unitLabel = isF ? '°F' : '°C';

  // Hide for ecosystems — the EcosystemMapWidget covers those.
  if (!ctx?.building || ctx.building.kind === 'ecosystem') return null;
  if (!coords) return null;
  if (!data || !data.current) {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon.bolt size={13} style={{ color: 'var(--text-dim)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('widget.weather.title')}</div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)' }}>{t('widget.weather.loading')}</div>
      </Card>
    );
  }

  const cur = data.current;
  const daily = data.daily || {};
  const hourly = data.hourly || {};
  const air = data.air || null;
  const group = weatherGroup(cur.weather_code);
  const temp = cToShown(cur.temperature_2m);
  const feels = cToShown(cur.apparent_temperature);
  const humidity = Math.round(cur.relative_humidity_2m);
  const wind = Math.round(cur.wind_speed_10m);
  const windDir = Math.round(cur.wind_direction_10m || 0);
  const uv = Math.round(cur.uv_index ?? 0);
  const aqi = air && Number.isFinite(air.us_aqi) ? Math.round(air.us_aqi) : null;
  // Today's forecast: high/low/sunrise/sunset come back as arrays
  // keyed by date in `daily`. Index 0 is today.
  const todayHi = daily.temperature_2m_max ? cToShown(daily.temperature_2m_max[0]) : null;
  const todayLo = daily.temperature_2m_min ? cToShown(daily.temperature_2m_min[0]) : null;
  const sunrise = daily.sunrise ? new Date(daily.sunrise[0]) : null;
  const sunset = daily.sunset ? new Date(daily.sunset[0]) : null;
  const fmtTime = (d) =>
    d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '—';

  // Pull next 12 hourly forecast points starting from "now".
  const nowIso = new Date(cur.time).toISOString().slice(0, 13);
  let startIdx = (hourly.time || []).findIndex((h) => h.startsWith(nowIso));
  if (startIdx < 0) startIdx = 0;
  const hours = (hourly.time || []).slice(startIdx, startIdx + 12).map((iso, i) => ({
    iso,
    hour: new Date(iso).getHours(),
    temp: cToShown(hourly.temperature_2m[startIdx + i]),
    code: hourly.weather_code[startIdx + i],
    pop: hourly.precipitation_probability ? Math.round(hourly.precipitation_probability[startIdx + i] || 0) : 0,
  }));

  // 7-day daily forecast (skip index 0 — that's today, already
  // surfaced in the hero pill). Keep raw Celsius alongside the
  // display value so the temperature-range bar can colour-grade
  // independently of the user's chosen units.
  const days = (daily.time || []).slice(1, 7).map((iso, i) => ({
    iso,
    label: new Date(iso).toLocaleDateString(undefined, { weekday: 'short' }),
    hi: cToShown(daily.temperature_2m_max[i + 1]),
    lo: cToShown(daily.temperature_2m_min[i + 1]),
    hiC: daily.temperature_2m_max[i + 1],
    loC: daily.temperature_2m_min[i + 1],
    code: daily.weather_code[i + 1],
    pop: daily.precipitation_probability_max ? Math.round(daily.precipitation_probability_max[i + 1] || 0) : 0,
    sunrise: daily.sunrise ? new Date(daily.sunrise[i + 1]) : null,
    sunset: daily.sunset ? new Date(daily.sunset[i + 1]) : null,
  }));
  // Week-wide hi/lo so each row's bar sits at the right horizontal
  // offset (cooler days slide left, warmer days slide right).
  const weekMin = days.length ? Math.min(...days.map((d) => d.lo)) : 0;
  const weekMax = days.length ? Math.max(...days.map((d) => d.hi)) : 1;

  // Hero gradient + matching text colour. Day vs night vs golden-hour
  // baked in — see pickTint() below.
  const isDay = cur.is_day !== 0; // Open-Meteo: 1 = day, 0 = night
  const localHour = (() => {
    // Open-Meteo's `current.time` is local-tz ISO without offset
    // when timezone=auto, so parsing as Date and taking getHours()
    // returns local hour reliably enough for golden-hour gating.
    try {
      return new Date(cur.time).getHours();
    } catch {
      return 12;
    }
  })();
  const tint = pickTint(group, isDay, localHour);

  // Ops implication line — rule-based for now; cheap, deterministic,
  // works offline. Picks the single most relevant signal for a
  // facility manager: HVAC load, outdoor work feasibility, security
  // / safety, or a calm "standard ops" baseline. Future pass: have
  // Merlin generate this via the chat backend with building context.
  const opsHint = pickOpsHint({
    todayHi,
    todayLo,
    daily,
    current: cur,
    aqi,
    t,
  });

  return (
    <Card pad={false} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          position: 'relative',
          background: `linear-gradient(135deg, ${tint.from} 0%, ${tint.to} 100%)`,
          padding: '12px 14px',
          color: tint.fg,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* Animated overlay (clouds, rain, snow, stars, lightning) —
            sits ABOVE the gradient and BELOW the text, no pointer
            events so it never blocks the chrome buttons. */}
        <WeatherOverlay group={group} isDay={isDay} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* City sits left-aligned next to the bolt icon. We dropped
              the decorative "WEATHER NOW" eyebrow — the giant temp +
              weather glyph + condition copy below already make it
              obvious this is the weather widget, and reclaiming that
              ~110px lets long city names ("San Francisco") render in
              full even on narrow third-width cells. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
              minWidth: 0,
              // Reserve room on the right for the hover-revealed chrome
              // (cog + close pill ≈ 52 px) so the label never slides
              // under it when the user hovers the cell.
              paddingRight: 56,
            }}
          >
            {/* Pin (not bolt — bolt reads as "thunderstorm warning"
                on a weather widget). The icon labels the *location*;
                the actual weather is conveyed by the big glyph + temp
                below. */}
            <Icon.pin size={13} style={{ flexShrink: 0 }} />
            <span
              title={coords.label}
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                minWidth: 0,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {coords.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <WeatherGlyph group={group} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  letterSpacing: -0.02,
                  lineHeight: 1,
                  fontFamily: 'var(--font)',
                }}
              >
                {temp}
                <span style={{ fontSize: 20 }}>{unitLabel}</span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.78, marginTop: 3 }}>
                {t(`widget.weather.cond.${group}`)} · {t('widget.weather.feels', { n: feels })}
              </div>
            </div>
            {/* Today's high / low pill */}
            {todayHi != null && todayLo != null && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 2,
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.88,
                }}
              >
                <span>↑ {todayHi}°</span>
                <span>↓ {todayLo}°</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ops implication — single line that reads weather + AQI and
          tells the facility manager what to plan for today.
          Sparkle icon + accent left border so it reads as Merlin's
          interpretation rather than raw data. */}
      {opsHint && (
        <div
          style={{
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            fontSize: 11.5,
            color: 'var(--text-soft)',
            background: 'color-mix(in oklch, var(--accent) 6%, var(--surface))',
            borderBottom: '1px solid var(--border)',
            borderLeft: '3px solid var(--accent)',
            flexShrink: 0,
            lineHeight: 1.4,
          }}
        >
          <Icon.sparkle size={12} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <span>
            <b style={{ color: 'var(--text)' }}>{opsHint.title}</b>
            {opsHint.detail ? ` · ${opsHint.detail}` : ''}
          </span>
        </div>
      )}

      {/* Stats strip — humidity, wind (with direction arrow), UV,
          AQI, sunrise/sunset. All compact so the row fits on one line
          on most viewports; wraps on very narrow third-width cells. */}
      <div
        style={{
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 10.5,
          color: 'var(--text-dim)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <span>
          <b style={{ color: 'var(--text-soft)' }}>{humidity}%</b> {t('widget.weather.humidity')}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <WindArrow deg={windDir} />
          <b style={{ color: 'var(--text-soft)' }}>{wind} km/h</b> {t('widget.weather.wind')}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <UvDot value={uv} />
          <b style={{ color: 'var(--text-soft)' }}>UV {uv}</b>
        </span>
        {aqi != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AqiDot value={aqi} />
            <b style={{ color: 'var(--text-soft)' }}>AQI {aqi}</b>
          </span>
        )}
        {sunrise && <span>↑ {fmtTime(sunrise)}</span>}
        {sunset && <span>↓ {fmtTime(sunset)}</span>}
      </div>

      {/* 12-hour strip with precipitation probability indicator
          beneath each hour (rendered only when ≥ 20% so the row stays
          calm on dry days). */}
      <div style={{ padding: '6px 6px 8px', overflowX: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
        {hours.map((h, i) => (
          <div
            key={h.iso}
            style={{
              flex: '0 0 auto',
              minWidth: 38,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '6px 4px',
              borderRadius: 8,
              background: i === 0 ? 'var(--accent-soft)' : 'transparent',
              border: i === 0 ? '1px solid var(--accent-line)' : '1px solid transparent',
            }}
          >
            <span style={{ fontSize: 9.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
              {i === 0 ? t('widget.weather.now') : `${h.hour}h`}
            </span>
            <WeatherGlyph group={weatherGroup(h.code)} size={22} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{h.temp}°</span>
            <span
              style={{
                fontSize: 9,
                fontFamily: 'var(--mono)',
                color: h.pop >= 20 ? '#5da9e8' : 'transparent',
                minHeight: 11,
              }}
            >
              {h.pop >= 20 ? `💧${h.pop}%` : '·'}
            </span>
          </div>
        ))}
      </div>

      {/* 7-day strip — small horizontal cards, weekday + glyph + hi/lo
          and a thin temperature span bar so trends are scannable.
          Sits at the bottom of the card; flex:1 + overflow:auto so
          short cells still scroll instead of clipping. */}
      <div
        style={{
          padding: '6px 14px 10px',
          flex: 1,
          minHeight: 0,
          borderTop: '1px solid var(--border)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: 0.12,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            margin: '4px 0 6px',
          }}
        >
          {t('widget.weather.next_days')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {days.map((d) => (
            <DailyRow key={d.iso} day={d} weekMin={weekMin} weekMax={weekMax} unitLabel={unitLabel} />
          ))}
        </div>
      </div>
    </Card>
  );
}

// Hero gradient picker. Day/night swaps + a golden-hour shift for
// clear weather (peachy at sunrise, deep orange-pink at sunset).
// Returns { from, to, fg } so the text colour stays readable
// regardless of the gradient's brightness.
function pickTint(group, isDay, hour) {
  if (group === 'clear' && isDay) {
    if (hour >= 5 && hour < 8) return { from: '#FFD9A8', to: '#FF8B6B', fg: '#1a1f2c' }; // sunrise
    if (hour >= 17 && hour < 20) return { from: '#FFB347', to: '#E0623E', fg: '#1a1f2c' }; // sunset
  }
  if (isDay) {
    return (
      {
        clear: { from: '#FFE38A', to: '#FFB347', fg: '#1a1f2c' },
        partly: { from: '#D8E6F4', to: '#9EC5E8', fg: '#1a1f2c' },
        cloudy: { from: '#D8DEE6', to: '#9AA6B8', fg: '#1a1f2c' },
        fog: { from: '#E5E8ED', to: '#B5BCC6', fg: '#1a1f2c' },
        rain: { from: '#A8C8E8', to: '#5D8AB6', fg: '#10131c' },
        snow: { from: '#EAF1F8', to: '#BCD2EA', fg: '#1a1f2c' },
        storm: { from: '#7C8294', to: '#494E5C', fg: '#ffffff' },
      }[group] || { from: '#D8DEE6', to: '#9AA6B8', fg: '#1a1f2c' }
    );
  }
  // Night palettes — deeper, cooler. Light text everywhere.
  return (
    {
      clear: { from: '#1a2150', to: '#0a0d22', fg: '#e8eef8' },
      partly: { from: '#252b48', to: '#0e1228', fg: '#e8eef8' },
      cloudy: { from: '#2a2f3e', to: '#171a26', fg: '#e8eef8' },
      fog: { from: '#3a3e4a', to: '#1f222b', fg: '#e8eef8' },
      rain: { from: '#1f3658', to: '#0a1628', fg: '#e8eef8' },
      snow: { from: '#2a3550', to: '#161e30', fg: '#e8eef8' },
      storm: { from: '#3a3f50', to: '#10131c', fg: '#ffffff' },
    }[group] || { from: '#2a2f3e', to: '#171a26', fg: '#e8eef8' }
  );
}

// Animated overlay layer for the hero. Drifting clouds, falling
// rain streaks, falling snowflakes, twinkling stars on clear nights,
// occasional lightning flash on storms. Pure SVG + CSS keyframes
// from tokens.css; pointer-events:none so the chrome icons above
// remain clickable.
function WeatherOverlay({ group, isDay }) {
  const baseStyle = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  };

  // Clear-night → twinkling star field.
  if (group === 'clear' && !isDay) {
    const stars = Array.from({ length: 24 });
    return (
      <div style={baseStyle}>
        {stars.map((_, i) => {
          const x = (i * 53) % 100;
          const y = (i * 37) % 70;
          const r = ((i % 3) + 1) * 0.6;
          const delay = ((i * 0.31) % 4).toFixed(2);
          return (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: r,
                height: r,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: `0 0 ${r * 2}px #fff`,
                animation: `merlinTwinkle 3s ease-in-out ${delay}s infinite`,
              }}
            />
          );
        })}
      </div>
    );
  }

  // Partly cloudy / cloudy → drifting cloud silhouettes.
  if (group === 'cloudy' || group === 'partly' || group === 'fog') {
    const clouds = [
      { top: '12%', size: 60, opacity: 0.35, delay: '0s', dur: '60s' },
      { top: '40%', size: 80, opacity: 0.28, delay: '-25s', dur: '80s' },
      { top: '68%', size: 50, opacity: 0.4, delay: '-12s', dur: '50s' },
    ];
    return (
      <div style={baseStyle}>
        {clouds.map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: c.top,
              left: 0,
              opacity: c.opacity,
              animation: `merlinDrift ${c.dur} linear ${c.delay} infinite`,
            }}
          >
            <CloudSilhouette size={c.size} fill={isDay ? '#ffffff' : '#cdd5e3'} />
          </div>
        ))}
      </div>
    );
  }

  // Rain → diagonal streaks falling.
  if (group === 'rain') {
    const drops = Array.from({ length: 28 });
    return (
      <div style={baseStyle}>
        {drops.map((_, i) => {
          const x = (i * 43) % 100;
          const delay = ((i * 0.13) % 1.4).toFixed(2);
          const dur = (0.7 + (i % 5) * 0.18).toFixed(2);
          return (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: -20,
                width: 1.2,
                height: 14,
                background: isDay ? 'rgba(255,255,255,0.55)' : 'rgba(180,210,250,0.65)',
                transform: 'rotate(15deg)',
                animation: `merlinRainFall ${dur}s linear ${delay}s infinite`,
              }}
            />
          );
        })}
      </div>
    );
  }

  // Snow → drifting flakes.
  if (group === 'snow') {
    const flakes = Array.from({ length: 22 });
    return (
      <div style={baseStyle}>
        {flakes.map((_, i) => {
          const x = (i * 47) % 100;
          const size = 2 + (i % 3);
          const delay = ((i * 0.19) % 3).toFixed(2);
          const dur = (4 + (i % 4) * 1.5).toFixed(2);
          return (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: -10,
                width: size,
                height: size,
                borderRadius: '50%',
                background: '#fff',
                opacity: 0.85,
                animation: `merlinSnowFall ${dur}s linear ${delay}s infinite`,
              }}
            />
          );
        })}
      </div>
    );
  }

  // Storm → background drops + a faint full-canvas lightning flash.
  if (group === 'storm') {
    const drops = Array.from({ length: 32 });
    return (
      <div style={baseStyle}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255, 255, 220, 0.6)',
            opacity: 0,
            animation: 'merlinLightning 8s linear infinite',
          }}
        />
        {drops.map((_, i) => {
          const x = (i * 41) % 100;
          const delay = ((i * 0.11) % 1.2).toFixed(2);
          const dur = (0.55 + (i % 4) * 0.16).toFixed(2);
          return (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: -20,
                width: 1.4,
                height: 16,
                background: 'rgba(220,230,250,0.55)',
                transform: 'rotate(20deg)',
                animation: `merlinRainFall ${dur}s linear ${delay}s infinite`,
              }}
            />
          );
        })}
      </div>
    );
  }

  return null;
}

// A simple SVG cloud blob used by the WeatherOverlay drift animation.
function CloudSilhouette({ size, fill }) {
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 120 66" style={{ display: 'block' }}>
      <ellipse cx="34" cy="42" rx="20" ry="15" fill={fill} />
      <ellipse cx="58" cy="32" rx="28" ry="22" fill={fill} />
      <ellipse cx="88" cy="42" rx="22" ry="17" fill={fill} />
      <rect x="20" y="42" width="80" height="14" rx="7" fill={fill} />
    </svg>
  );
}

// Compass arrow rotated by wind direction (Open-Meteo convention:
// "from" direction in degrees, 0° = North; arrow points where the
// wind is GOING, so we rotate by deg + 180).
function WindArrow({ deg }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      style={{ transform: `rotate(${deg + 180}deg)`, transition: 'transform .3s' }}
    >
      <path d="M6 1 L9 9 L6 7 L3 9 Z" fill="var(--text-soft)" />
    </svg>
  );
}

// UV-index dot — colour scale matches WHO bands (low / moderate /
// high / very high / extreme). Tiny dot so it fits inline with the
// stats row.
function UvDot({ value }) {
  const color =
    value < 3 ? '#22A65A' : value < 6 ? '#FFD75A' : value < 8 ? '#FF9A3C' : value < 11 ? '#E0623E' : '#A062E0';
  return <span style={{ width: 8, height: 8, borderRadius: 4, background: color, display: 'inline-block' }} />;
}

// US AQI dot — EPA categories. Same shape as UvDot for visual
// consistency in the stats row.
function AqiDot({ value }) {
  const color =
    value <= 50
      ? '#22A65A' // good
      : value <= 100
        ? '#FFD75A' // moderate
        : value <= 150
          ? '#FF9A3C' // unhealthy for sensitive groups
          : value <= 200
            ? '#E0623E' // unhealthy
            : value <= 300
              ? '#A062E0' // very unhealthy
              : '#7E1A1A'; // hazardous
  return <span style={{ width: 8, height: 8, borderRadius: 4, background: color, display: 'inline-block' }} />;
}

// Rule-based ops-implication picker. Returns { title, detail } where
// title is the bold lead and detail is the supporting clause. Picks
// the single most relevant signal in this priority order:
//   1. Severe weather (storm / very high wind)
//   2. Air quality (only when AQI > 100 — actionable for HVAC fresh-air strategy)
//   3. Sub-zero temps (frost protection)
//   4. High heat (HVAC peak load)
//   5. Heavy rain / snow forecast (outdoor crew planning)
//   6. Very high UV (PPE for outdoor crews)
//   7. Otherwise → calm "standard ops" baseline
function pickOpsHint({ todayHi, todayLo, daily, current, aqi, t }) {
  const popMax = (daily.precipitation_probability_max && daily.precipitation_probability_max[0]) || 0;
  const windMax = (daily.wind_speed_10m_max && daily.wind_speed_10m_max[0]) || (current?.wind_speed_10m ?? 0);
  const code = current?.weather_code ?? 0;
  const uvMax = Math.round((daily.uv_index_max && daily.uv_index_max[0]) ?? current?.uv_index ?? 0);

  // 1. Severe weather — thunderstorms or very high wind.
  if (code >= 95 || windMax > 60) {
    return { title: t('widget.weather.ops.severe.title'), detail: t('widget.weather.ops.severe.detail') };
  }
  // 2. Air quality — only flag when actionable (>100 = unhealthy for sensitive).
  if (aqi != null && aqi > 100) {
    return { title: t('widget.weather.ops.aqi.title', { n: aqi }), detail: t('widget.weather.ops.aqi.detail') };
  }
  // 3. Frost protection — sub-zero (Celsius).
  if (todayLo != null && todayLo <= 0) {
    return { title: t('widget.weather.ops.frost.title'), detail: t('widget.weather.ops.frost.detail') };
  }
  // 4. Heat — HVAC peak.
  if (todayHi != null && todayHi >= 30) {
    return { title: t('widget.weather.ops.heat.title', { n: todayHi }), detail: t('widget.weather.ops.heat.detail') };
  }
  // 5. Rain / snow — heavy or moderate.
  if (popMax >= 70) {
    return {
      title: t('widget.weather.ops.rain_heavy.title', { n: Math.round(popMax) }),
      detail: t('widget.weather.ops.rain_heavy.detail'),
    };
  }
  if (popMax >= 40) {
    return {
      title: t('widget.weather.ops.rain_moderate.title', { n: Math.round(popMax) }),
      detail: t('widget.weather.ops.rain_moderate.detail'),
    };
  }
  // 6. Very high UV.
  if (uvMax >= 8) {
    return { title: t('widget.weather.ops.uv.title', { n: uvMax }), detail: t('widget.weather.ops.uv.detail') };
  }
  // 7. Calm baseline.
  return { title: t('widget.weather.ops.calm.title'), detail: t('widget.weather.ops.calm.detail') };
}

// Single row in the 7-day forecast — iOS Weather-style. Layout:
//   weekday | glyph | rain% | [— ███████ —] | hi / lo
// The temperature-range bar is the visual anchor: each day's bar
// occupies a horizontal slice scaled against the WEEK'S overall
// hi/lo, so warmer days literally sit further right than cooler
// ones. The bar is filled with a hue gradient driven by the day's
// raw Celsius (cool blue → warm red), so a glance gives both range
// AND magnitude. A second small line shows day length (sunrise →
// sunset spread) when the data is available, which helps with
// shift / lighting planning.
function DailyRow({ day, weekMin, weekMax }) {
  const span = Math.max(1, weekMax - weekMin);
  const startPct = ((day.lo - weekMin) / span) * 100;
  const widthPct = Math.max(8, ((day.hi - day.lo) / span) * 100); // min 8% so single-temp days still show a sliver
  const colorLo = tempToColor(day.loC);
  const colorHi = tempToColor(day.hiC);
  const dayLengthMin = day.sunrise && day.sunset ? Math.round((day.sunset - day.sunrise) / 60000) : null;
  const fmtTime = (d) =>
    d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 20px 32px 1fr 64px',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        padding: '2px 0',
      }}
    >
      <span style={{ color: 'var(--text-soft)', fontWeight: 700 }}>{day.label}</span>
      <WeatherGlyph group={weatherGroup(day.code)} size={18} />
      <span style={{ fontSize: 9.5, color: day.pop >= 20 ? '#5da9e8' : 'transparent', fontFamily: 'var(--mono)' }}>
        {day.pop >= 20 ? `💧${day.pop}%` : '·'}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Temperature range bar — the headline visual. */}
        <div
          style={{
            position: 'relative',
            height: 6,
            background: 'color-mix(in oklch, var(--surface-3) 80%, transparent)',
            borderRadius: 3,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: `${startPct}%`,
              width: `${widthPct}%`,
              top: 0,
              bottom: 0,
              background: `linear-gradient(90deg, ${colorLo} 0%, ${colorHi} 100%)`,
              borderRadius: 3,
              boxShadow: `0 0 6px ${colorHi}66`,
            }}
          />
        </div>
        {/* Tiny secondary line: sunrise → sunset compact. */}
        {dayLengthMin != null && (
          <div
            style={{
              fontSize: 9,
              color: 'var(--text-faint)',
              fontFamily: 'var(--mono)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>↑ {fmtTime(day.sunrise)}</span>
            <span style={{ opacity: 0.6 }}>
              {Math.floor(dayLengthMin / 60)}h{String(dayLengthMin % 60).padStart(2, '0')}
            </span>
            <span>↓ {fmtTime(day.sunset)}</span>
          </div>
        )}
      </div>
      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', textAlign: 'right' }}>
        <span style={{ fontWeight: 700 }}>{day.hi}°</span>
        <span style={{ color: 'var(--text-dim)' }}> / {day.lo}°</span>
      </span>
    </div>
  );
}

// Map a raw Celsius value to a colour on a cool-to-warm gradient.
// Driven by Celsius regardless of the user's display unit so the
// bar reads consistently across °C / °F preferences.
function tempToColor(c) {
  // Anchor stops in HSL so interpolation tracks perceptually.
  // -10°C → cold deep blue; 0 → blue; 10 → cyan/teal; 20 → yellow;
  // 30 → orange; 40+ → red.
  const stops = [
    { t: -10, h: 222, s: 70, l: 55 },
    { t: 5, h: 200, s: 65, l: 60 },
    { t: 15, h: 175, s: 55, l: 58 },
    { t: 22, h: 60, s: 78, l: 60 },
    { t: 30, h: 25, s: 82, l: 58 },
    { t: 40, h: 0, s: 78, l: 52 },
  ];
  if (!Number.isFinite(c)) return 'var(--accent)';
  if (c <= stops[0].t) return `hsl(${stops[0].h}, ${stops[0].s}%, ${stops[0].l}%)`;
  if (c >= stops[stops.length - 1].t) {
    const last = stops[stops.length - 1];
    return `hsl(${last.h}, ${last.s}%, ${last.l}%)`;
  }
  let i = 0;
  while (i < stops.length - 2 && stops[i + 1].t < c) i++;
  const a = stops[i],
    b = stops[i + 1];
  const localT = (c - a.t) / Math.max(0.0001, b.t - a.t);
  const h = a.h + (b.h - a.h) * localT;
  const s = a.s + (b.s - a.s) * localT;
  const l = a.l + (b.l - a.l) * localT;
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

// Used by MetricsWidgets' BuildingMapWidget (single-building map pin).
export { coordsForBuilding };
