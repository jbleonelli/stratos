// Full-page device detail view — type-aware rendering.
import React, { useState, useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card } from './primitives.jsx';
import { DEVICE_TYPES, FIRMWARES } from './devices-data.js';
import { useLiveState } from './simulator.js';
import { useT, useLanguage, t as tPlain } from './i18n.js';
import { useDeviceMessages } from './device-events.js';
import { DeviceMessagesCard } from './DeviceDetailPage.jsx';
import {
  HistSummary,
  SectionTitle,
  KV,
  UptimeStrip,
  BarChart,
  BatteryChart,
  RatingBars,
  ActivityRow,
  MerlinStrip,
} from './device-view-primitives.jsx';
import {
  AirQualityReadings,
  LeakEvents,
  BeaconMovement,
  OccupancyPatterns,
  CameraFeed,
  BadgeAccess,
  DeviceFeedback,
  DeviceCleaningLog,
  DeviceButtonEvents,
  DeviceSignals,
} from './device-view-telemetry.jsx';

function deviceSeedFor(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return Math.abs(h);
}

// IMF is the live device pilot: these devices report real telemetry through the
// device webhook and have no demo fixtures. For them we must NOT fabricate any
// seeded-random history/readings — every other org (Meridian/FEB/PSG demos)
// keeps the mock behavior. Gate is the `imf*` location_id prefix.
function isLiveDevice(device) {
  return typeof device?.location_id === 'string' && device.location_id.startsWith('imf');
}

function deviceTelemetry(device) {
  // Live IMF devices: return a safe-empty object of the exact same shape so no
  // consumer crashes, but nothing is fabricated. Must come before any rng use.
  if (isLiveDevice(device)) {
    return {
      cleanLog: [],
      buttonEvents: [],
      ratings: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      ratingTotal: 0,
      avgRating: '—',
      uptime24: [],
      interactions30d: [],
      airq24h: [],
      packets24h: [],
      battery90d: [],
      einkRefreshes: [],
    };
  }
  const seed = deviceSeedFor(device.id);
  const rng = (() => {
    let s = seed;
    return () => {
      s = Math.imul(s ^ (s >>> 15), s | 1);
      s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
      return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const ri = (min, max) => Math.floor(min + rng() * (max - min));
  const pick = (a) => a[ri(0, a.length)];

  const crew = ['Maria C.', 'Priya S.', 'Diego R.', 'Thandi O.', 'Abe K.'];
  const ago = [6, 164, 312, 490, 720];
  const durations = [4, 6, 5, 8, 5];
  const cleanLog = ago.map((m, i) => ({
    crew: pick(crew),
    start: fmtAgo(m + durations[i]),
    end: fmtAgo(m),
    durationMin: durations[i],
    nfcIn: true,
    nfcOut: true,
    incidentClosed: i === 0 ? tPlain('dv.tel.incident.voc') : i === 2 ? tPlain('dv.tel.incident.tp') : null,
  }));

  const buttonEvents = [
    {
      t: fmtAgo(8),
      kind: tPlain('dv.tel.btn.ask_cleaning'),
      icon: 'supply',
      tone: 'warn',
      sub: tPlain('dv.tel.sub.before_voc'),
    },
    {
      t: fmtAgo(42),
      kind: tPlain('dv.tel.btn.tp_low'),
      icon: 'supply',
      tone: 'warn',
      sub: tPlain('dv.tel.sub.handled_by'),
    },
    {
      t: fmtAgo(185),
      kind: tPlain('dv.tel.btn.rate', { n: 4 }),
      icon: 'check',
      tone: 'ok',
      sub: tPlain('dv.tel.sub.after_maria'),
    },
    {
      t: fmtAgo(204),
      kind: tPlain('dv.tel.btn.soap_missing'),
      icon: 'supply',
      tone: 'warn',
      sub: tPlain('dv.tel.sub.refilled'),
    },
    {
      t: fmtAgo(330),
      kind: tPlain('dv.tel.btn.rate', { n: 3 }),
      icon: 'sla',
      tone: 'warn',
      sub: tPlain('dv.tel.sub.flagged'),
    },
    {
      t: fmtAgo(412),
      kind: tPlain('dv.tel.btn.rate', { n: 5 }),
      icon: 'check',
      tone: 'ok',
      sub: tPlain('dv.tel.sub.after_deep'),
    },
    {
      t: fmtAgo(610),
      kind: tPlain('dv.tel.btn.leak_reported'),
      icon: 'warn',
      tone: 'risk',
      sub: tPlain('dv.tel.sub.escalated'),
    },
    { t: fmtAgo(890), kind: tPlain('dv.tel.btn.rate', { n: 5 }), icon: 'check', tone: 'ok', sub: '' },
  ];

  const ratings = { 5: 42 + ri(0, 20), 4: 18 + ri(0, 8), 3: 6 + ri(0, 4), 2: 2 + ri(0, 2), 1: 1 + ri(0, 1) };
  const ratingTotal = Object.values(ratings).reduce((a, b) => a + b, 0);
  const avgRating = (
    (5 * ratings[5] + 4 * ratings[4] + 3 * ratings[3] + 2 * ratings[2] + 1 * ratings[1]) /
    ratingTotal
  ).toFixed(2);

  const uptime24 = Array.from({ length: 48 }, () => {
    const r = rng();
    return r < 0.02 ? 'offline' : r < 0.06 ? 'degraded' : 'online';
  });

  const interactions30d = Array.from({ length: 30 }, () => 40 + ri(0, 120));

  const airq24h = Array.from({ length: 48 }, (_, i) => {
    const isWorkHrs = i > 16 && i < 40;
    const base = isWorkHrs ? 1.0 : 0.4;
    return {
      t: i,
      tvoc: Math.round((180 + rng() * 420) * base),
      co2: Math.round(420 + rng() * 700 * base),
      pm: +(2 + rng() * 18 * base).toFixed(1),
      humid: +(34 + rng() * 20).toFixed(0),
      temp: +(19 + rng() * 5).toFixed(1),
    };
  });

  const packets24h = Array.from({ length: 48 }, () => ri(4, 40));
  const battery90d = Array.from({ length: 90 }, (_, i) => {
    const end = device.battery ?? 100;
    const drift = (90 - i) * 0.18;
    return Math.min(100, Math.max(0, end + drift));
  });
  const einkRefreshes = Array.from({ length: 24 }, () => ri(0, 8));

  return {
    cleanLog,
    buttonEvents,
    ratings,
    ratingTotal,
    avgRating,
    uptime24,
    interactions30d,
    airq24h,
    packets24h,
    battery90d,
    einkRefreshes,
  };
}

function fmtAgo(minutes) {
  if (minutes < 1) return tPlain('dv.rel.just_now');
  if (minutes < 60) return tPlain('dv.rel.min_ago', { n: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m ? tPlain('dv.rel.hour_min_ago', { h, m }) : tPlain('dv.rel.hour_ago', { h });
  const d = Math.floor(h / 24);
  return tPlain('dv.rel.day_ago', { d, h: h % 24 });
}

export function DeviceView({ device, onBack, onAskMerlin, onReorder }) {
  const t = useT();
  const lang = useLanguage();
  const telemetry = useMemo(() => deviceTelemetry(device), [device.id, lang]);
  const type = DEVICE_TYPES[device.type];
  // FIRMWARES only covers the original 10 Adaptiv-made kinds. Newer
  // Adaptiv kinds (SDC / PCB / SLB / PSS) and every third-party kind
  // (bacnet_thermostat / onvif_camera / hid_badge_reader / ev_charger)
  // would crash on `fw.rolling` without this default. Null/null collapses
  // every downstream `fw.rolling` / `fw.stable` guard to "no upgrade
  // path", which is the truthful UX for kinds Adaptiv doesn't manage.
  const fw = FIRMWARES[device.type] || { stable: null, rolling: null };
  const canUpgrade = fw.rolling && device.firmware !== fw.rolling;
  const statusTone = { online: 'ok', degraded: 'warn', offline: 'risk', updating: 'info', provisioning: 'info' }[
    device.status
  ];

  const lblOverview = t('dv.tab.overview');
  const lblFeedback = t('dv.tab.feedback');
  const lblCleaning = t('dv.tab.cleaning');
  const lblButtons = t('dv.tab.buttons');
  const lblAggregator = t('dv.tab.aggregator');
  const lblEmbedded = t('dv.tab.embedded');
  const lblSignals = t('dv.tab.signals');
  const lblHistory = t('dv.tab.history');
  const lblFirmware = t('dv.tab.firmware');
  const lblOcc = t('dv.tab.occupancy');
  const lblAirq = t('dv.tab.airq');
  const lblLeak = t('dv.tab.leak');
  const lblMovement = t('dv.tab.movement');
  const lblFeed = t('dv.tab.feed');
  const lblAccess = t('dv.tab.access');
  const starSuffix = telemetry.avgRating + '\u2605';

  const tabsByType = {
    display_touch: [
      { id: 'overview', label: lblOverview },
      { id: 'feedback', label: lblFeedback, sub: starSuffix },
      { id: 'cleaning', label: lblCleaning, sub: telemetry.cleanLog.length },
      { id: 'buttons', label: lblButtons, sub: telemetry.buttonEvents.length },
      { id: 'aggregator', label: lblAggregator, sub: device.ble_children || 0 },
      { id: 'embedded', label: lblEmbedded },
      { id: 'signals', label: lblSignals },
      { id: 'history', label: lblHistory },
      { id: 'firmware', label: lblFirmware },
    ],
    display_eink: [
      { id: 'overview', label: lblOverview },
      { id: 'feedback', label: lblFeedback, sub: starSuffix },
      { id: 'cleaning', label: lblCleaning, sub: telemetry.cleanLog.length },
      { id: 'buttons', label: lblButtons, sub: telemetry.buttonEvents.length },
      { id: 'aggregator', label: lblAggregator, sub: device.ble_children || 0 },
      { id: 'embedded', label: lblEmbedded },
      { id: 'signals', label: lblSignals },
      { id: 'history', label: lblHistory },
      { id: 'firmware', label: lblFirmware },
    ],
    display_sdg: [
      { id: 'overview', label: lblOverview },
      { id: 'feedback', label: lblFeedback, sub: starSuffix },
      { id: 'cleaning', label: lblCleaning, sub: telemetry.cleanLog.length },
      { id: 'buttons', label: lblButtons, sub: telemetry.buttonEvents.length },
      { id: 'embedded', label: lblEmbedded },
      { id: 'signals', label: lblSignals },
      { id: 'history', label: lblHistory },
      { id: 'firmware', label: lblFirmware },
    ],
    pc_counter: [
      { id: 'overview', label: lblOverview },
      { id: 'occ', label: lblOcc },
      { id: 'signals', label: lblSignals },
      { id: 'history', label: lblHistory },
      { id: 'firmware', label: lblFirmware },
    ],
    airq: [
      { id: 'overview', label: lblOverview },
      { id: 'airq', label: lblAirq },
      { id: 'signals', label: lblSignals },
      { id: 'history', label: lblHistory },
      { id: 'firmware', label: lblFirmware },
    ],
    leak: [
      { id: 'overview', label: lblOverview },
      { id: 'leak', label: lblLeak },
      { id: 'signals', label: lblSignals },
      { id: 'history', label: lblHistory },
      { id: 'firmware', label: lblFirmware },
    ],
    beacon: [
      { id: 'overview', label: lblOverview },
      { id: 'movement', label: lblMovement },
      { id: 'signals', label: lblSignals },
      { id: 'history', label: lblHistory },
      { id: 'firmware', label: lblFirmware },
    ],
    occupancy: [
      { id: 'overview', label: lblOverview },
      { id: 'occ', label: lblOcc },
      { id: 'signals', label: lblSignals },
      { id: 'history', label: lblHistory },
      { id: 'firmware', label: lblFirmware },
    ],
    camera: [
      { id: 'overview', label: lblOverview },
      { id: 'feed', label: lblFeed },
      { id: 'signals', label: lblSignals },
      { id: 'history', label: lblHistory },
      { id: 'firmware', label: lblFirmware },
    ],
    badge: [
      { id: 'overview', label: lblOverview },
      { id: 'access', label: lblAccess },
      { id: 'signals', label: lblSignals },
      { id: 'history', label: lblHistory },
      { id: 'firmware', label: lblFirmware },
    ],
  };
  // Every raw uplink this device has sent (public.events, source_ref=device:uuid).
  const { messages, loaded: messagesLoaded } = useDeviceMessages(device.uuid);
  let tabs = tabsByType[device.type] || tabsByType.airq;
  // Live IMF devices only get tabs backed by real data; mock-only tabs are
  // dropped because their telemetry is empty and per-tab empty-states are risky.
  // The Messages tab IS real data (the uplink stream), so add it for live devices.
  if (isLiveDevice(device)) {
    const liveAllow = ['overview', 'history', 'firmware'];
    tabs = tabs.filter((x) => liveAllow.includes(x.id));
    const msgTab = { id: 'messages', label: t('ddp.tab.messages'), sub: messages.length || null };
    const oi = tabs.findIndex((x) => x.id === 'overview');
    tabs = oi >= 0 ? [...tabs.slice(0, oi + 1), msgTab, ...tabs.slice(oi + 1)] : [msgTab, ...tabs];
  }
  const [tab, setTab] = useState(tabs[0].id);
  // If the active tab was filtered out (e.g. device became live), fall back to overview.
  const activeTab = tabs.some((x) => x.id === tab) ? tab : 'overview';

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Always-visible top: breadcrumb + hero + tabs */}
      <div
        style={{
          padding: 'var(--pad) var(--pad) 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--pad)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}>
          <button
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-soft)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Icon.chevR size={9} style={{ transform: 'rotate(180deg)' }} /> {t('dv.back_to_fleet')}
          </button>
          <Icon.chevR size={10} />
          <span>{t('dv.crumb.devices')}</span>
          <Icon.chevR size={10} />
          <span>{type.label}</span>
          <Icon.chevR size={10} />
          <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--mono)' }}>{device.id}</span>
        </div>

        <DeviceHero
          device={device}
          type={type}
          telemetry={telemetry}
          statusTone={statusTone}
          onAskMerlin={onAskMerlin}
          onReorder={onReorder}
          canUpgrade={canUpgrade}
          fw={fw}
        />

        <div
          style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginTop: -8, flexWrap: 'wrap' }}
        >
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '10px 14px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-dim)',
                  border: 'none',
                  borderBottom: '2px solid ' + (active ? 'var(--accent)' : 'transparent'),
                  cursor: 'pointer',
                  marginBottom: -1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
                {t.sub != null && (
                  <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 500 }}>{t.sub}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable tab content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--pad)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--pad)',
        }}
      >
        {activeTab === 'overview' && (
          <OverviewTab device={device} type={type} telemetry={telemetry} onAskMerlin={onAskMerlin} />
        )}
        {activeTab === 'feedback' && <DeviceFeedback telemetry={telemetry} />}
        {activeTab === 'cleaning' && <DeviceCleaningLog telemetry={telemetry} />}
        {activeTab === 'buttons' && <DeviceButtonEvents telemetry={telemetry} />}
        {activeTab === 'aggregator' && <DisplayAggregatorTab device={device} />}
        {activeTab === 'embedded' && <DisplayEmbeddedSensors device={device} />}
        {activeTab === 'airq' && <AirQualityReadings telemetry={telemetry} />}
        {activeTab === 'leak' && <LeakEvents device={device} />}
        {activeTab === 'movement' && <BeaconMovement device={device} />}
        {activeTab === 'occ' && <OccupancyPatterns />}
        {activeTab === 'feed' && <CameraFeed />}
        {activeTab === 'access' && <BadgeAccess />}
        {activeTab === 'signals' && <DeviceSignals device={device} />}
        {activeTab === 'messages' && <DeviceMessagesCard messages={messages} loaded={messagesLoaded} />}
        {activeTab === 'history' && <DeviceHistory device={device} fw={fw} />}
        {activeTab === 'firmware' && (
          <DeviceFirmware device={device} fw={fw} canUpgrade={canUpgrade} onReorder={onReorder} />
        )}
      </div>
    </main>
  );
}

function uplinkSummary(device) {
  if (device.type === 'display_touch' || device.type === 'display_eink') return tPlain('dv.uplink.lte_ble');
  if (device.type === 'display_sdg' || device.type === 'pc_counter') return tPlain('dv.uplink.lte_cellular');
  if (device.uplink === 'LTE') return tPlain('dv.uplink.lte');
  return tPlain('dv.uplink.ble');
}

function DeviceHero({ device, type, telemetry, statusTone, onAskMerlin, onReorder, canUpgrade, fw }) {
  const t = useT();
  const isDisplay = device.type === 'display_touch' || device.type === 'display_eink' || device.type === 'display_sdg';
  const isCounter = device.type === 'pc_counter';

  let stats;
  if (isDisplay) {
    const rsrp = device.lte?.rsrp;
    const lteTone = rsrp == null ? 'risk' : rsrp > -85 ? 'ok' : rsrp > -100 ? 'warn' : 'risk';
    const hasBle = device.type === 'display_touch' || device.type === 'display_eink';
    stats = [
      {
        label: t('dv.hero.stat.avg_rating'),
        value: `${telemetry.avgRating}\u2605`,
        sub: t('dv.hero.stat.avg_rating_sub', { n: telemetry.ratingTotal }),
        tone: 'accent',
      },
      {
        label: t('dv.hero.stat.lte_signal'),
        value: rsrp != null ? `${rsrp} dBm` : '\u2014',
        sub: device.lte?.carrier || t('dv.hero.stat.lte_offline'),
        tone: lteTone,
      },
      hasBle
        ? {
            label: t('dv.hero.stat.ble_children'),
            value: device.ble_children || 0,
            sub: t('dv.hero.stat.ble_children_sub'),
            tone: 'info',
          }
        : {
            label: t('dv.hero.stat.uplink'),
            value: t('dv.uplink.lte'),
            sub: device.lte?.band || t('dv.hero.stat.uplink_sub'),
            tone: 'info',
          },
      {
        label: t('dv.hero.stat.battery'),
        value: `${device.battery}%`,
        sub: t('dv.hero.stat.battery_sub', { n: device.battery_days_remaining }),
        tone: device.battery < 20 ? 'risk' : device.battery < 40 ? 'warn' : 'ok',
      },
      {
        label: t('dv.hero.stat.last_clean'),
        value: telemetry.cleanLog[0]?.end || '—',
        sub: telemetry.cleanLog[0]?.crew || '—',
        tone: 'ok',
      },
    ];
  } else if (isCounter) {
    const rsrp = device.lte?.rsrp;
    const lteTone = rsrp == null ? 'risk' : rsrp > -85 ? 'ok' : rsrp > -100 ? 'warn' : 'risk';
    stats = [
      {
        label: t('dv.hero.stat.entries_today'),
        value: device.embedded?.count_today ?? '\u2014',
        sub: t('dv.hero.stat.entries_today_sub'),
        tone: 'accent',
      },
      {
        label: t('dv.hero.stat.lte_signal'),
        value: rsrp != null ? `${rsrp} dBm` : '\u2014',
        sub: device.lte?.carrier || t('dv.hero.stat.lte_offline'),
        tone: lteTone,
      },
      {
        label: t('dv.hero.stat.uplink'),
        value: t('dv.uplink.lte'),
        sub: device.lte?.band || t('dv.hero.stat.uplink_sub'),
        tone: 'info',
      },
      {
        label: t('dv.hero.stat.battery'),
        value: `${device.battery}%`,
        sub: t('dv.hero.stat.battery_sub', { n: device.battery_days_remaining }),
        tone: device.battery < 20 ? 'risk' : device.battery < 40 ? 'warn' : 'ok',
      },
      {
        label: t('dv.hero.stat.firmware'),
        value: device.firmware,
        sub: canUpgrade ? t('dv.hero.stat.fw_update') : t('dv.hero.stat.fw_uptodate'),
        tone: canUpgrade ? 'warn' : 'ok',
      },
    ];
  } else if (device.type === 'airq') {
    const last = telemetry.airq24h[47] || {};
    stats = [
      {
        label: t('dv.hero.stat.tvoc_now'),
        value: last.tvoc != null ? `${last.tvoc} ppb` : '—',
        sub: last.tvoc > 400 ? t('dv.hero.stat.tvoc_high') : t('dv.hero.stat.tvoc_ok'),
        tone: last.tvoc > 400 ? 'warn' : 'ok',
      },
      {
        label: t('dv.hero.stat.co2'),
        value: last.co2 != null ? `${last.co2} ppm` : '—',
        sub: last.co2 > 1000 ? t('dv.hero.stat.co2_high') : t('dv.hero.stat.co2_ok'),
        tone: last.co2 > 1000 ? 'warn' : 'ok',
      },
      {
        label: t('dv.hero.stat.uplink_via'),
        value: t('dv.hero.stat.ble_to_agg'),
        sub: device.aggregator_id || '\u2014',
        tone: 'info',
      },
      {
        label: t('dv.hero.stat.battery'),
        value: `${device.battery}%`,
        sub: t('dv.hero.stat.battery_sub', { n: device.battery_days_remaining }),
        tone: device.battery < 20 ? 'risk' : 'ok',
      },
    ];
  } else
    stats = [
      {
        label: t('dv.hero.stat.uplink'),
        value: t('dv.hero.stat.ble_to_agg'),
        sub: device.aggregator_id || t('dv.hero.stat.none'),
        tone: 'info',
      },
      {
        label: t('dv.hero.stat.signal'),
        value: device.rssi ? `${device.rssi} dBm` : '\u2014',
        sub: (device.rssi || 0) > -75 ? t('dv.hero.stat.signal_strong') : t('dv.hero.stat.signal_weak'),
        tone: (device.rssi || 0) > -85 ? 'ok' : 'warn',
      },
      {
        label: t('dv.hero.stat.battery'),
        value: device.battery != null ? `${device.battery}%` : '\u2014',
        sub:
          device.battery_days_remaining != null
            ? t('dv.hero.stat.battery_sub', { n: device.battery_days_remaining })
            : '\u2014',
        tone: (device.battery ?? 100) < 20 ? 'risk' : (device.battery ?? 100) < 40 ? 'warn' : 'ok',
      },
      {
        label: t('dv.hero.stat.firmware'),
        value: device.firmware,
        sub: canUpgrade ? t('dv.hero.stat.fw_update') : t('dv.hero.stat.fw_uptodate'),
        tone: canUpgrade ? 'warn' : 'ok',
      },
    ];

  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ padding: 'var(--pad)', display: 'flex', gap: 20, alignItems: 'flex-start', position: 'relative' }}>
        <DeviceIconTile type={type} tone={statusTone} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Dot tone={statusTone} pulse={device.status !== 'online'} />
            <span
              style={{
                fontSize: 11,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
              }}
            >
              {type.label} · {t(`ddp.status.${device.status}`) || device.status} · {uplinkSummary(device)} ·{' '}
              {t('dv.uplink.battery_powered')}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: -0.01 }}>{device.room}</h1>
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginTop: 6,
              flexWrap: 'wrap',
              fontSize: 12.5,
              color: 'var(--text-dim)',
            }}
          >
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 }}>
              {device.id}
            </span>
            <Dot tone="info" size={4} />
            <span>{device.location}</span>
            <Dot tone="info" size={4} />
            <span>{t('dv.hero.sku', { sku: type.sku })}</span>
            <Dot tone="info" size={4} />
            <span>{t('dv.hero.installed', { date: device.install_date })}</span>
          </div>

          <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
            {stats.map((s, i) => (
              <HeadlineStat key={i} {...s} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, minWidth: 170 }}>
          <button
            onClick={() => onAskMerlin?.(t('dv.ask.tell_about', { id: device.id, room: device.room }))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px 14px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Icon.sparkle size={13} /> {t('dv.btn.ask_merlin')}
          </button>
          {canUpgrade && (
            <button
              style={{
                padding: '8px 14px',
                background: 'var(--surface-3)',
                color: 'var(--text-soft)',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('dv.btn.push_firmware', { v: fw.rolling })}
            </button>
          )}
          <button
            onClick={onReorder}
            style={{
              padding: '8px 14px',
              background: 'var(--surface-2)',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <Icon.ship size={12} /> {t('dv.btn.reorder_clone')}
          </button>
          {device.battery != null && (
            <button
              style={{
                padding: '8px 14px',
                background: 'transparent',
                color: 'var(--text-dim)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t('dv.btn.schedule_battery_swap')}
            </button>
          )}
          <button
            style={{
              padding: '8px 14px',
              background: 'transparent',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('dv.btn.download_diagnostics')}
          </button>
        </div>
      </div>
    </Card>
  );
}

function DeviceIconTile({ type, tone }) {
  const IconC = Icon[type.icon] || Icon.grid;
  const c = { ok: 'var(--ok)', warn: 'var(--warn)', risk: 'var(--risk)', info: 'var(--info)' }[tone] || 'var(--accent)';
  return (
    <div
      style={{
        width: 140,
        height: 140,
        borderRadius: 18,
        flexShrink: 0,
        background: `linear-gradient(135deg, color-mix(in oklch, ${c} 18%, var(--surface-2)), var(--surface-3))`,
        boxShadow: 'inset 0 0 0 1px var(--border)',
        display: 'flex',
        flexDirection: 'column',
        color: c,
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconC size={56} />
      </div>
      <div
        style={{
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.12,
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
      >
        {type.sku}
      </div>
    </div>
  );
}

function HeadlineStat({ label, value, sub, tone }) {
  const color =
    { ok: 'var(--ok)', risk: 'var(--risk)', warn: 'var(--warn)', info: 'var(--info)', accent: 'var(--accent)' }[tone] ||
    'var(--text)';
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color,
          letterSpacing: -0.01,
          marginTop: 2,
          fontFamily: typeof value === 'string' && /^-?\d/.test(value) ? 'var(--mono)' : 'var(--font)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{sub}</div>
    </div>
  );
}

function OverviewTab({ device, telemetry, onAskMerlin }) {
  // Live IMF devices: render ONLY real, reported fields — no seeded-random charts,
  // ratings, or button-event fabrication (telemetry is empty for these).
  if (isLiveDevice(device)) return <LiveDeviceOverview device={device} onAskMerlin={onAskMerlin} />;
  if (device.type === 'display_touch' || device.type === 'display_eink' || device.type === 'display_sdg')
    return <TouchDisplayOverview device={device} telemetry={telemetry} onAskMerlin={onAskMerlin} />;
  if (device.type === 'pc_counter')
    return <PeopleCounterOverview device={device} telemetry={telemetry} onAskMerlin={onAskMerlin} />;
  if (device.type === 'airq') return <AirqOverview device={device} telemetry={telemetry} onAskMerlin={onAskMerlin} />;
  return <GenericOverview device={device} telemetry={telemetry} onAskMerlin={onAskMerlin} />;
}

// Real-data-only overview for live (IMF) devices. References no telemetry.* array
// and no fabricated lifecycle fields — every value is a reported view-model field.
function LiveDeviceOverview({ device, onAskMerlin }) {
  const t = useT();
  const dash = '—';
  const statusTone = { online: 'ok', degraded: 'warn', offline: 'risk', updating: 'info', provisioning: 'info' }[
    device.status
  ];
  const statusLabel = t(`ddp.status.${device.status}`) || device.status;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--pad)' }}>
      <Card style={{ gridColumn: '1 / -1' }}>
        <SectionTitle icon="sla" title={t('dv.ov.live_status')} sub={t('dv.ov.live_status_sub')} />
        <div style={{ marginTop: 8 }}>
          <KV k={t('dv.kv.status')} v={statusLabel} tone={statusTone} />
          <KV k={t('dv.hist.summary.battery')} v={device.battery != null ? `${device.battery}%` : dash} />
          <KV k={t('dv.hist.summary.firmware')} v={device.firmware || dash} />
          <KV k={t('dv.kv.uplink')} v={device.uplink || dash} />
          <KV
            k={t('dv.hist.summary.last_seen')}
            v={device.last_seen ? fmtHistoryRelative(new Date(device.last_seen)) : dash}
          />
          <KV k={t('dv.kv.commissioned')} v={device.install_date || dash} last />
        </div>
      </Card>
      <MerlinStrip
        onAskMerlin={onAskMerlin}
        questions={[t('dv.q.healthy'), t('dv.q.plan_swap'), t('dv.q.show_uplink')]}
        style={{ gridColumn: '1 / -1' }}
      />
    </div>
  );
}

function TouchDisplayOverview({ device, telemetry, onAskMerlin }) {
  const t = useT();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--pad)' }}>
      <Card>
        <SectionTitle icon="sla" title={t('dv.ov.uptime_24h')} sub={t('dv.ov.uptime_24h_sub_static')} />
        <UptimeStrip data={telemetry.uptime24} />
      </Card>
      <Card>
        <SectionTitle
          icon="grid"
          title={t('dv.ov.interactions_30d')}
          sub={t('dv.ov.events_count', { n: telemetry.interactions30d.reduce((a, b) => a + b, 0).toLocaleString() })}
        />
        <BarChart data={telemetry.interactions30d} />
      </Card>
      <Card>
        <SectionTitle
          icon="check"
          title={t('dv.ov.latest_feedback')}
          sub={t('dv.ov.latest_feedback_sub', { rating: telemetry.avgRating, n: telemetry.ratingTotal })}
        />
        <RatingBars ratings={telemetry.ratings} total={telemetry.ratingTotal} />
      </Card>
      <Card>
        <SectionTitle
          icon="bolt"
          title={t('dv.ov.battery_90d')}
          sub={t('dv.ov.battery_90d_sub', {
            pct: device.battery,
            days: device.battery_days_remaining,
            chem: device.battery_chemistry,
          })}
        />
        <BatteryChart data={telemetry.battery90d} />
      </Card>
      <Card style={{ gridColumn: '1 / -1' }}>
        <SectionTitle icon="bell" title={t('dv.ov.recent_activity')} sub={t('dv.ov.recent_activity_sub')} />
        <div style={{ marginTop: 6 }}>
          {telemetry.buttonEvents.slice(0, 5).map((e, i) => (
            <ActivityRow key={i} e={e} last={i === 4} />
          ))}
        </div>
      </Card>
      <MerlinStrip
        onAskMerlin={onAskMerlin}
        questions={
          device.type === 'display_sdg'
            ? [t('dv.q.flag_3star'), t('dv.q.cycle_trend'), t('dv.q.last_nfc'), t('dv.q.battery_swap')]
            : [t('dv.q.flag_3star'), t('dv.q.cycle_trend'), t('dv.q.ble_routed'), t('dv.q.battery_swap')]
        }
      />
    </div>
  );
}

function PeopleCounterOverview({ device, telemetry, onAskMerlin }) {
  const t = useT();
  const entriesToday = device.embedded?.count_today ?? 0;
  // Synthesize an hourly entry curve from the device seed (reuses existing telemetry arrays).
  const hourly = telemetry.packets24h.map((v) =>
    Math.round(
      v *
        (entriesToday /
          Math.max(
            1,
            telemetry.packets24h.reduce((a, b) => a + b, 0),
          )),
    ),
  );
  const peakHour = hourly.indexOf(Math.max(...hourly));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--pad)' }}>
      <Card>
        <SectionTitle
          icon="sla"
          title={t('dv.ov.uptime_24h')}
          sub={t('dv.ov.uptime_24h_sub', { pct: device.uptime })}
        />
        <UptimeStrip data={telemetry.uptime24} />
      </Card>
      <Card>
        <SectionTitle
          icon="grid"
          title={t('dv.ov.entries_24h')}
          sub={t('dv.ov.entries_24h_sub', { n: entriesToday.toLocaleString(), hh: String(peakHour).padStart(2, '0') })}
        />
        <BarChart data={hourly} />
      </Card>
      <Card>
        <SectionTitle
          icon="people"
          title={t('dv.ov.daily_traffic_30d')}
          sub={t('dv.ov.entries_count', { n: telemetry.interactions30d.reduce((a, b) => a + b, 0).toLocaleString() })}
        />
        <BarChart data={telemetry.interactions30d} />
      </Card>
      <Card>
        <SectionTitle
          icon="bolt"
          title={t('dv.ov.battery_90d')}
          sub={t('dv.ov.battery_90d_sub', {
            pct: device.battery,
            days: device.battery_days_remaining,
            chem: device.battery_chemistry,
          })}
        />
        <BatteryChart data={telemetry.battery90d} />
      </Card>
      <MerlinStrip
        onAskMerlin={onAskMerlin}
        questions={[t('dv.q.peak_threshold'), t('dv.q.run_hot'), t('dv.q.battery_swap'), t('dv.q.compare_floor')]}
        style={{ gridColumn: '1 / -1' }}
      />
    </div>
  );
}

function AirqOverview({ device, telemetry, onAskMerlin }) {
  const t = useT();
  const last = telemetry.airq24h[47] || {};
  const dash = '\u2014';
  const metrics = [
    { k: t('dv.airq.tvoc'), v: last.tvoc != null ? `${last.tvoc}` : dash, unit: 'ppb', max: 800, warn: 400 },
    { k: t('dv.airq.co2'), v: last.co2 != null ? `${last.co2}` : dash, unit: 'ppm', max: 2000, warn: 1000 },
    { k: t('dv.airq.pm'), v: last.pm != null ? `${last.pm}` : dash, unit: '\u00b5g/m\u00b3', max: 30, warn: 12 },
    { k: t('dv.airq.humidity'), v: last.humid != null ? `${last.humid}` : dash, unit: '%', max: 100, warn: 60 },
    { k: t('dv.airq.temp'), v: last.temp != null ? `${last.temp}` : dash, unit: '\u00b0C', max: 30, warn: 26 },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--pad)' }}>
      <Card style={{ gridColumn: '1 / -1' }}>
        <SectionTitle icon="air" title={t('dv.airq.current_readings')} sub={t('dv.airq.current_readings_sub')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 14 }}>
          {metrics.map((m) => {
            const pct = Math.min(100, (parseFloat(m.v) / m.max) * 100);
            const tone = parseFloat(m.v) > m.warn ? 'warn' : 'ok';
            return (
              <div
                key={m.k}
                style={{
                  padding: 12,
                  background: 'var(--surface-2)',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text-dim)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.12,
                  }}
                >
                  {m.k}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    marginTop: 4,
                    color: `var(--${tone})`,
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {m.v}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.unit}</div>
                <div
                  style={{
                    height: 4,
                    background: 'var(--surface-3)',
                    borderRadius: 2,
                    marginTop: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ height: '100%', width: `${pct}%`, background: `var(--${tone})` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle icon="sla" title={t('dv.ov.uptime_24h')} />
        <UptimeStrip data={telemetry.uptime24} />
      </Card>
      <Card>
        <SectionTitle
          icon="bolt"
          title={t('dv.ov.battery_90d')}
          sub={t('dv.airq.battery_sub', {
            pct: device.battery,
            days: device.battery_days_remaining,
            chem: device.battery_chemistry,
          })}
        />
        <BatteryChart data={telemetry.battery90d} />
      </Card>

      <MerlinStrip
        onAskMerlin={onAskMerlin}
        questions={[t('dv.q.airq_trend'), t('dv.q.last_recal'), t('dv.q.co2_occupancy'), t('dv.q.escalate_hvac')]}
      />
    </div>
  );
}

function GenericOverview({ device, telemetry, onAskMerlin }) {
  const t = useT();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--pad)' }}>
      <Card>
        <SectionTitle icon="sla" title={t('dv.ov.uptime_24h')} />
        <UptimeStrip data={telemetry.uptime24} />
      </Card>
      <Card>
        <SectionTitle icon="grid" title={t('dv.ov.ble_packet_24h')} sub={t('dv.ov.ble_packet_24h_sub')} />
        <BarChart data={telemetry.packets24h} scaleMax={50} />
      </Card>
      {device.battery != null && (
        <Card style={{ gridColumn: '1 / -1' }}>
          <SectionTitle
            icon="bolt"
            title={t('dv.ov.battery_90d')}
            sub={t('dv.ov.battery_90d_sub_long', {
              pct: device.battery,
              days: device.battery_days_remaining,
              chem: device.battery_chemistry,
            })}
          />
          <BatteryChart data={telemetry.battery90d} />
        </Card>
      )}
      <MerlinStrip
        onAskMerlin={onAskMerlin}
        questions={[t('dv.q.healthy'), t('dv.q.plan_swap'), t('dv.q.show_uplink')]}
        style={{ gridColumn: '1 / -1' }}
      />
    </div>
  );
}

function DisplayAggregatorTab({ device }) {
  const tT = useT();
  const live = useLiveState();
  const children = live.fleet.filter((d) => d.aggregator_id === device.id);
  const byType = {};
  children.forEach((c) => {
    byType[c.type] = (byType[c.type] || 0) + 1;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--pad)' }}>
      <Card>
        <SectionTitle icon="gateway" title={tT('dv.agg.role')} sub={tT('dv.agg.role_sub')} />
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <KV k={tT('dv.agg.kv.children')} v={children.length} tone="info" />
          <KV k={tT('dv.agg.kv.role')} v={tT('dv.agg.kv.role_value')} />
          <KV k={tT('dv.agg.kv.scan')} v={tT('dv.agg.kv.scan_value')} />
          <KV k={tT('dv.agg.kv.mesh')} v={tT('dv.agg.kv.mesh_value')} />
          <KV k={tT('dv.agg.kv.power')} v={device.battery_chemistry} />
          <KV
            k={tT('dv.agg.kv.battery')}
            v={tT('dv.agg.kv.battery_value', { pct: device.battery, days: device.battery_days_remaining })}
            tone={device.battery < 20 ? 'risk' : 'ok'}
            last
          />
        </div>
        <div
          style={{
            marginTop: 18,
            padding: 12,
            background: 'var(--surface-2)',
            borderRadius: 8,
            fontSize: 11.5,
            color: 'var(--text-soft)',
            lineHeight: 1.5,
            border: '1px solid var(--border)',
          }}
        >
          <b>{tT('dv.agg.howit')}</b>
          {tT('dv.agg.howit_body')}
        </div>
      </Card>

      <Card>
        <SectionTitle
          icon="grid"
          title={tT('dv.agg.connected')}
          sub={tT('dv.agg.connected_sub', { n: children.length })}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          {Object.entries(byType).map(([key, n]) => {
            const typeDef = DEVICE_TYPES[key];
            const IconC = Icon[typeDef.icon] || Icon.grid;
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                <IconC size={11} style={{ color: 'var(--text-dim)' }} />
                {typeDef.label} · <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{n}</span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 100px 90px 80px',
            gap: 0,
            fontSize: 10.5,
            color: 'var(--text-dim)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.12,
            padding: '8px 8px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span>{tT('dv.agg.col.device')}</span>
          <span>{tT('dv.agg.col.last_packet')}</span>
          <span>{tT('dv.agg.col.rssi')}</span>
          <span>{tT('dv.agg.col.battery')}</span>
          <span>{tT('dv.agg.col.status')}</span>
        </div>
        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          {children.slice(0, 60).map((c) => {
            const td = DEVICE_TYPES[c.type];
            const IconC = Icon[td.icon] || Icon.grid;
            const tone = { online: 'ok', degraded: 'warn', offline: 'risk', updating: 'info', provisioning: 'accent' }[
              c.status
            ];
            return (
              <div
                key={c.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 100px 90px 80px',
                  padding: '8px 8px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <IconC size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>{c.id}</div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: 'var(--text-dim)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.room}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                  {c.status === 'offline' ? '\u2014' : tT('dv.agg.row.s_ago', { n: c.last_packet_s })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-soft)', fontFamily: 'var(--mono)' }}>
                  {c.rssi ? `${c.rssi}` : '\u2014'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-soft)', fontFamily: 'var(--mono)' }}>
                  {c.battery != null ? `${c.battery}%` : '\u2014'}
                </div>
                <div>
                  <Pill tone={tone}>{tT(`ddp.status.${c.status}`) || c.status}</Pill>
                </div>
              </div>
            );
          })}
          {children.length > 60 && (
            <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
              {tT('dv.agg.more', { n: children.length - 60 })}
            </div>
          )}
          {children.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
              {tT('dv.agg.empty')}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function DisplayEmbeddedSensors({ device }) {
  const t = useT();
  const e = device.embedded || {};
  const isTouch = device.type === 'display_touch' || device.type === 'display_eink';
  const sensors = [
    {
      k: t('dv.emb.temperature'),
      v: e.temp_c != null ? `${e.temp_c} \u00b0C` : '\u2014',
      sub: t('dv.emb.temperature_sub'),
      icon: 'air',
    },
    {
      k: t('dv.emb.noise'),
      v: e.noise_db != null ? `${e.noise_db} dB` : '\u2014',
      sub: t('dv.emb.noise_sub'),
      icon: 'bell',
    },
    {
      k: t('dv.emb.light'),
      v: e.light_lux != null ? `${e.light_lux} lux` : '\u2014',
      sub: t('dv.emb.light_sub'),
      icon: 'check',
    },
    {
      k: t('dv.emb.accel'),
      v: e.accel_g != null ? `${e.accel_g} g` : '\u2014',
      sub: t('dv.emb.accel_sub'),
      icon: 'shield',
    },
    {
      k: t('dv.emb.nfc'),
      v: e.nfc ? t('dv.emb.nfc_online') : t('dv.emb.nfc_offline'),
      sub: t('dv.emb.nfc_sub'),
      icon: 'shield',
    },
    isTouch ? { k: t('dv.emb.touch'), v: t('dv.emb.touch_value'), sub: t('dv.emb.touch_sub'), icon: 'grid' } : null,
  ].filter(Boolean);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--pad)' }}>
      {sensors.map((s) => {
        const IconC = Icon[s.icon] || Icon.bell;
        return (
          <Card key={s.k}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconC size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.12,
                  }}
                >
                  {s.k}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    marginTop: 2,
                    fontFamily: /^-?\d/.test(s.v) ? 'var(--mono)' : 'var(--font)',
                  }}
                >
                  {s.v}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.45 }}>{s.sub}</div>
              </div>
            </div>
          </Card>
        );
      })}
      <Card style={{ gridColumn: '1 / -1', background: 'color-mix(in oklch, var(--accent) 4%, var(--surface))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon.sparkle size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('dv.emb.callout_title')}</div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-soft)', marginTop: 8, lineHeight: 1.55 }}>
          {t('dv.emb.callout_pre')}
          <b>{t('dv.emb.callout_bold')}</b>
          {t('dv.emb.callout_mid')}
          <i>{t('dv.emb.callout_italic')}</i>
          {t('dv.emb.callout_post')}
        </div>
      </Card>
    </div>
  );
}

function DeviceFirmware({ device, fw, canUpgrade, onReorder }) {
  const t = useT();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--pad)' }}>
      <Card>
        <SectionTitle icon="sparkle" title={t('dv.fw.title')} />
        <KV k={t('dv.fw.kv.running')} v={device.firmware} tone="ok" />
        <KV k={t('dv.fw.kv.stable')} v={fw.stable} />
        <KV k={t('dv.fw.kv.rolling')} v={fw.rolling || t('dv.fw.kv.rolling_none')} />
        <KV k={t('dv.fw.kv.last_updated')} v={t('dv.fw.kv.last_updated_value')} last />
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          {canUpgrade ? (
            <button
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('dv.fw.btn.push', { v: fw.rolling })}
            </button>
          ) : (
            <button
              disabled
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'var(--surface-3)',
                color: 'var(--text-dim)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              {t('dv.fw.btn.uptodate')}
            </button>
          )}
          <button
            style={{
              padding: '10px 14px',
              background: 'var(--surface-2)',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('dv.fw.btn.changelog')}
          </button>
        </div>
      </Card>
      <Card>
        <SectionTitle icon="ship" title={t('dv.fw.lifecycle')} />
        <KV k={t('dv.fw.kv.sku')} v={DEVICE_TYPES[device.type].sku} />
        <KV k={t('dv.fw.kv.serial')} v={device.id.replace('ADX-', '')} />
        <KV k={t('dv.fw.kv.installed')} v={device.install_date} />
        <KV k={t('dv.fw.kv.warranty')} v={t('dv.fw.kv.warranty_value')} tone="ok" />
        <KV
          k={t('dv.fw.kv.replacement')}
          v={t('dv.fw.kv.replacement_value', { sku: DEVICE_TYPES[device.type].sku })}
          last
        />
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button
            onClick={onReorder}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'var(--surface-3)',
              color: 'var(--text)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <Icon.ship size={12} /> {t('dv.fw.btn.reorder')}
          </button>
          <button
            style={{
              padding: '10px 14px',
              background: 'transparent',
              color: 'var(--risk)',
              border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('dv.fw.btn.decommission')}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DEVICE HISTORY — manufactured → installed → FW updates → now
// ══════════════════════════════════════════════════════════════

function buildDeviceHistory(device, fw) {
  const rng = (() => {
    let s = deviceSeedFor(device.id);
    return () => {
      s = Math.imul(s ^ (s >>> 15), s | 1);
      s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
      return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const ri = (min, max) => Math.floor(min + rng() * (max - min));
  const pick = (arr) => arr[ri(0, arr.length)];

  const installers = [
    tPlain('dv.hist.installer.priya'),
    tPlain('dv.hist.installer.marcus'),
    tPlain('dv.hist.installer.alicia'),
  ];
  const factoryBatches = ['B-2403-A', 'B-2403-B', 'B-2404-A', 'B-2404-B', 'B-2405-A'];

  // Live IMF devices: return ONLY real entries — no manufactured/QC/delivered/
  // fw-update/battery-swap/recal/support/reorder fabrication.
  if (isLiveDevice(device)) {
    const liveEvents = [];
    // Commissioned/installed — only if we actually know the install date.
    // No invented installer: room/floor context only.
    if (device.install_date) {
      const floorLabel = device.floor === 0 ? tPlain('dv.hist.evt.installed_floor_g') : device.floor;
      liveEvents.push({
        date: new Date(device.install_date + 'T09:00:00'),
        icon: 'play',
        tone: 'accent',
        title: tPlain('dv.hist.evt.installed'),
        desc:
          device.room != null
            ? tPlain('dv.hist.summary.live_installed_loc', { room: device.room, floor: floorLabel })
            : null,
      });
    }
    // Current state — real last_seen (or now), real status/battery/firmware.
    liveEvents.push({
      date: device.last_seen ? new Date(device.last_seen) : new Date(),
      icon: device.status === 'online' ? 'check' : device.status === 'offline' ? 'warn' : 'sparkle',
      tone:
        device.status === 'online'
          ? 'ok'
          : device.status === 'offline'
            ? 'risk'
            : device.status === 'degraded'
              ? 'warn'
              : 'info',
      title: tPlain('dv.hist.evt.current', { status: tPlain(`ddp.status.${device.status}`) || device.status }),
      desc: tPlain('dv.hist.evt.current_desc_live', {
        batt: device.battery != null ? device.battery + '%' : '—',
        fw: device.firmware,
      }),
      current: true,
    });
    liveEvents.sort((a, b) => b.date - a.date);
    return liveEvents;
  }

  const install = new Date(device.install_date + 'T09:00:00');
  const today = new Date('2026-04-22T14:00:00');
  const daysSinceInstall = Math.max(30, Math.floor((today - install) / 86400000));

  const events = [];
  const addDaysFromInstall = (days) => {
    const d = new Date(install);
    d.setDate(d.getDate() + days);
    return d;
  };

  // Manufactured
  events.push({
    date: addDaysFromInstall(-(45 + ri(0, 20))),
    icon: 'ship',
    tone: 'info',
    title: tPlain('dv.hist.evt.manufactured'),
    desc: tPlain('dv.hist.evt.manufactured_desc', { sku: DEVICE_TYPES[device.type].sku, batch: pick(factoryBatches) }),
  });

  // QC / provisioned
  events.push({
    date: addDaysFromInstall(-(21 + ri(0, 7))),
    icon: 'check',
    tone: 'ok',
    title: tPlain('dv.hist.evt.qc'),
    desc: device.lte
      ? tPlain('dv.hist.evt.qc_desc_lte', { fw: fw.stable })
      : tPlain('dv.hist.evt.qc_desc', { fw: fw.stable }),
  });

  // Delivered
  events.push({
    date: addDaysFromInstall(-(3 + ri(0, 4))),
    icon: 'ship',
    tone: 'info',
    title: tPlain('dv.hist.evt.delivered'),
    desc: tPlain('dv.hist.evt.delivered_desc'),
  });

  // Installed + commissioned
  events.push({
    date: install,
    icon: 'play',
    tone: 'accent',
    title: tPlain('dv.hist.evt.installed'),
    desc: tPlain('dv.hist.evt.installed_desc', {
      room: device.room,
      floor: device.floor === 0 ? tPlain('dv.hist.evt.installed_floor_g') : device.floor,
      by: pick(installers),
    }),
  });

  // Firmware updates over its lifetime (every ~120 days)
  const fwVersions = [fw.stable];
  if (fw.rolling) fwVersions.push(fw.rolling);
  let fwIdx = 0;
  for (let d = 110 + ri(0, 20); d < daysSinceInstall - 7; d += 105 + ri(0, 35)) {
    fwIdx = (fwIdx + 1) % fwVersions.length;
    events.push({
      date: addDaysFromInstall(d),
      icon: 'sparkle',
      tone: 'info',
      title: tPlain('dv.hist.evt.fw_update', { v: fwVersions[fwIdx] || fw.stable }),
      desc: tPlain('dv.hist.evt.fw_update_desc'),
    });
  }

  // Battery swap: only for swappable chemistries AND if install was long enough ago
  if (device.battery_swappable && daysSinceInstall > 400 && rng() < 0.45) {
    events.push({
      date: addDaysFromInstall(daysSinceInstall - Math.floor(60 + rng() * 180)),
      icon: 'bolt',
      tone: 'warn',
      title: tPlain('dv.hist.evt.battery_swap'),
      desc: tPlain('dv.hist.evt.battery_swap_desc', { old: 6 + ri(0, 4) }),
    });
  }

  // Recalibration intervention (some sensors)
  if (['airq', 'occupancy', 'leak'].includes(device.type) && rng() < 0.5) {
    events.push({
      date: addDaysFromInstall(Math.floor(daysSinceInstall * (0.4 + rng() * 0.3))),
      icon: 'hvac',
      tone: 'info',
      title: tPlain('dv.hist.evt.recal'),
      desc:
        device.type === 'airq'
          ? tPlain('dv.hist.evt.recal_airq')
          : device.type === 'leak'
            ? tPlain('dv.hist.evt.recal_leak')
            : tPlain('dv.hist.evt.recal_other'),
    });
  }

  // Support visit for any device once in a while
  if (rng() < 0.4) {
    events.push({
      date: addDaysFromInstall(Math.floor(daysSinceInstall * (0.25 + rng() * 0.5))),
      icon: 'reload',
      tone: 'info',
      title: tPlain('dv.hist.evt.support'),
      desc: pick([
        tPlain('dv.hist.evt.support.antenna'),
        tPlain('dv.hist.evt.support.dust'),
        tPlain('dv.hist.evt.support.bracket'),
        tPlain('dv.hist.evt.support.nfc'),
        tPlain('dv.hist.evt.support.cable'),
      ]),
    });
  }

  // Replacement event (rare): device was itself a clone replacing a broken one
  if (rng() < 0.15) {
    events.push({
      date: addDaysFromInstall(-ri(1, 3)),
      icon: 'cart',
      tone: 'accent',
      title: tPlain('dv.hist.evt.reorder'),
      desc: tPlain('dv.hist.evt.reorder_desc'),
    });
  }

  // Low battery warning — only if current battery is actually low
  if (device.battery != null && device.battery < 25) {
    events.push({
      date: addDaysFromInstall(daysSinceInstall - ri(3, 14)),
      icon: 'warn',
      tone: 'warn',
      title: tPlain('dv.hist.evt.low_batt'),
      desc: tPlain('dv.hist.evt.low_batt_desc', { pct: device.battery + ri(2, 6) }),
    });
  }

  // Recent status event (if degraded/offline/updating)
  if (device.status === 'offline') {
    events.push({
      date: addDaysFromInstall(daysSinceInstall - Math.floor(rng() * 2)),
      icon: 'warn',
      tone: 'risk',
      title: tPlain('dv.hist.evt.offline'),
      desc: device.error ? `${device.error.code} \u00b7 ${device.error.msg}` : tPlain('dv.hist.evt.offline_default'),
    });
  } else if (device.status === 'degraded') {
    events.push({
      date: addDaysFromInstall(daysSinceInstall - Math.floor(rng() * 3)),
      icon: 'warn',
      tone: 'warn',
      title: tPlain('dv.hist.evt.degraded'),
      desc: device.error ? `${device.error.code} \u00b7 ${device.error.msg}` : tPlain('dv.hist.evt.degraded_default'),
    });
  } else if (device.status === 'updating') {
    events.push({
      date: today,
      icon: 'sparkle',
      tone: 'info',
      title: tPlain('dv.hist.evt.updating'),
      desc: tPlain('dv.hist.evt.updating_desc', {
        from: device.firmware,
        to: device.fw_latest,
        pct: device.fw_progress,
      }),
    });
  }

  // Current state — always last
  events.push({
    date: today,
    icon: device.status === 'online' ? 'check' : device.status === 'offline' ? 'warn' : 'sparkle',
    tone:
      device.status === 'online'
        ? 'ok'
        : device.status === 'offline'
          ? 'risk'
          : device.status === 'degraded'
            ? 'warn'
            : 'info',
    title: tPlain('dv.hist.evt.current', { status: tPlain(`ddp.status.${device.status}`) || device.status }),
    desc: tPlain('dv.hist.evt.current_desc', {
      batt: device.battery != null ? device.battery + '%' : '\u2014',
      rem:
        device.battery_days_remaining != null
          ? tPlain('dv.hist.evt.current_days', { n: device.battery_days_remaining })
          : '',
      fw: device.firmware,
    }),
    current: true,
  });

  // Sort descending (most recent first)
  events.sort((a, b) => b.date - a.date);
  return events;
}

function fmtHistoryDate(d) {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtHistoryRelative(d, today = new Date()) {
  const days = Math.round((today - d) / 86400000);
  if (days <= 0) return tPlain('dv.histrel.today');
  if (days === 1) return tPlain('dv.histrel.yesterday');
  if (days < 14) return tPlain('dv.histrel.day_ago', { n: days });
  if (days < 60) return tPlain('dv.histrel.week_ago', { n: Math.round(days / 7) });
  if (days < 730) return tPlain('dv.histrel.month_ago', { n: Math.round(days / 30) });
  return tPlain('dv.histrel.year_ago', { n: Math.round(days / 365) });
}

function DeviceHistory({ device, fw }) {
  const t = useT();
  const lang = useLanguage();
  const events = useMemo(
    () => buildDeviceHistory(device, fw),
    [device.id, device.status, device.battery, device.firmware, device.fw_progress, lang],
  );

  // Summary counts — match against translated titles emitted by buildDeviceHistory
  const installedTitle = tPlain('dv.hist.evt.installed');
  const manufacturedTitle = tPlain('dv.hist.evt.manufactured');
  const installDate = events.find((e) => e.title === installedTitle)?.date;
  const mfgDate = events.find((e) => e.title === manufacturedTitle)?.date;
  const fwUpdatePrefix = tPlain('dv.hist.evt.fw_update', { v: '' }).replace(/\s*$/, '');
  const fwUpdates = events.filter((e) => e.title.startsWith(fwUpdatePrefix)).length;
  const interventionTitles = new Set([
    tPlain('dv.hist.evt.support'),
    tPlain('dv.hist.evt.battery_swap'),
    tPlain('dv.hist.evt.recal'),
  ]);
  const interventions = events.filter((e) => interventionTitles.has(e.title)).length;

  // Live devices: honest "in service" date from real install_date / created_at only.
  const liveServiceRaw = device.install_date || device.created_at;
  const liveServiceDate = liveServiceRaw ? new Date(liveServiceRaw) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      {/* Summary strip */}
      <Card>
        {isLiveDevice(device) ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <HistSummary
              label={t('dv.hist.summary.in_service')}
              value={fmtHistoryRelative(liveServiceDate || new Date())}
              sub={liveServiceDate ? fmtHistoryDate(liveServiceDate) : '—'}
              tone="accent"
            />
            <HistSummary
              label={t('dv.hist.summary.last_seen')}
              value={device.last_seen ? fmtHistoryRelative(new Date(device.last_seen)) : '—'}
              sub={t('dv.hist.summary.last_seen_sub')}
              tone="info"
            />
            <HistSummary
              label={t('dv.hist.summary.firmware')}
              value={device.firmware || '—'}
              sub={t('dv.hist.summary.firmware_sub')}
              tone="ok"
            />
            <HistSummary
              label={t('dv.hist.summary.battery')}
              value={device.battery != null ? `${device.battery}%` : '—'}
              sub={t('dv.hist.summary.battery_sub')}
              tone="warn"
            />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <HistSummary
              label={t('dv.hist.summary.in_service')}
              value={fmtHistoryRelative(installDate || new Date())}
              sub={fmtHistoryDate(installDate || new Date())}
              tone="accent"
            />
            <HistSummary
              label={t('dv.hist.summary.manufactured')}
              value={fmtHistoryDate(mfgDate || new Date())}
              sub={t('dv.hist.summary.manufactured_sub')}
              tone="info"
            />
            <HistSummary
              label={t('dv.hist.summary.fw_updates')}
              value={fwUpdates}
              sub={t('dv.hist.summary.fw_updates_sub')}
              tone="ok"
            />
            <HistSummary
              label={t('dv.hist.summary.interventions')}
              value={interventions}
              sub={t('dv.hist.summary.interventions_sub')}
              tone="warn"
            />
          </div>
        )}
      </Card>

      {/* Timeline */}
      <Card>
        <SectionTitle icon="sla" title={t('dv.hist.timeline')} sub={t('dv.hist.timeline_sub')} />
        <div style={{ marginTop: 14, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 13, top: 10, bottom: 10, width: 2, background: 'var(--border)' }} />
          {events.map((e, i) => {
            const IconC = Icon[e.icon] || Icon.check;
            return (
              <div key={i} style={{ position: 'relative', display: 'flex', gap: 14, padding: '8px 0 12px' }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: `color-mix(in oklch, var(--${e.tone}) 16%, var(--surface))`,
                    color: `var(--${e.tone})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `inset 0 0 0 1.5px color-mix(in oklch, var(--${e.tone}) 50%, transparent)`,
                    zIndex: 1,
                  }}
                >
                  <IconC size={13} />
                </div>
                <div
                  style={{
                    width: 110,
                    flexShrink: 0,
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    fontFamily: 'var(--mono)',
                    paddingTop: 5,
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--text-soft)' }}>{fmtHistoryDate(e.date)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>
                    {fmtHistoryRelative(e.date)}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{e.title}</span>
                    {e.current && (
                      <Pill tone="ok">
                        <Dot tone="ok" size={4} pulse /> {t('dv.hist.pill_current')}
                      </Pill>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>{e.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
