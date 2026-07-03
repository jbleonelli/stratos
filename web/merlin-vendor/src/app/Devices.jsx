// Device Management page — fleet cards, detail drawer, deployments, reorder panel.
// Phase H-4: swaps the static FLEET import for the DB-backed
// useFleetViewModel hook. DevicesUI + DeviceView still read the flat
// mock shape so we shim via toViewModel in devices-store — rewriting
// ~80 field references in the drawer would be churn for no user-
// visible win. Ecosystem buildings (IMF, NYBank) keep the legacy
// simulator fleet for now; those scenarios haven't been migrated to
// the DB yet.
import React, { useState, useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card } from './primitives.jsx';
import { DEVICE_ALERTS, DEVICE_TYPES } from './devices-data.js';
import { ECOSYSTEM_ZONES, ECOSYSTEM_DEVICE_ALERTS } from './ecosystem-data.js';
import { DeploymentsSection, FleetBoard, DeviceDetailDrawer, ReorderPanel } from './DevicesUI.jsx';
import { DeviceView } from './DeviceView.jsx';
import { useAppData } from './simulator.js';
import { useFleetViewModel, computeActiveRollouts } from './devices-store.js';
import { navigateTo } from './use-route.js';
import { useT } from './i18n.js';

export function DevicesPage({ tweaks, role, building, onOpenChat, onAskMerlin }) {
  const isEcosystem = building?.kind === 'ecosystem';
  const isImf = building?.variant === 'imf';
  // The branch-network ecosystem presentation (NY-State regions, "branch
  // displays" copy, "upstate"/Manhattan alerts) is First Empire Bank-specific.
  // Gate it to FEB ids so OTHER ecosystems (e.g. Campus PSG `psg`) render
  // their own real device view instead of inheriting FEB's framing.
  const isFebEco = isEcosystem && /^feb/.test(building?.id || '');

  // Ecosystems used to fall back universally to the static simulator
  // fleet because pre-DB-seed-era branch networks had no rows in
  // public.devices. Now First Empire Bank's ecosystem (and any future
  // DB-backed ecosystem) carries real devices on its descendant
  // locations — so we use the DB fleet whenever it has data, falling
  // back to the static sim only for legacy ecosystems with no rows
  // (today: IMF only). useDevices walks descendants for ecosystems
  // so the parent picker shows the aggregate of all children.
  const simLive = useAppData(building);
  const dbFleet = useFleetViewModel(building);
  // The static `simLive` fleet for an ecosystem is First Empire Bank's 578
  // branch displays — only a correct fallback for FEB (and IMF, which has no
  // DB rows). For other ecosystems (e.g. Campus PSG) it would flash 578 for a
  // frame before the DB fleet hydrates, so use the DB fleet immediately
  // (empty during load → no foreign flash). EMPTY-not-optimistic pre-hydrate.
  // IMF now carries real DB devices (live pilot), so its ecosystem uses the
  // DB fleet too — no static simulator fallback.
  const useDb = !isEcosystem ? true : isFebEco ? dbFleet.fleet.length > 0 : true;
  const LIVE_FLEET = useDb ? dbFleet.fleet : simLive.fleet;

  const zones = isFebEco ? ECOSYSTEM_ZONES : dbFleet.zoneOptions; // building mode + ecosystems use their real device zones
  // IMF is a live pilot — no canned device alerts; real signal only.
  const deviceAlerts = isImf ? [] : isFebEco ? ECOSYSTEM_DEVICE_ALERTS : isEcosystem ? [] : DEVICE_ALERTS; // non-FEB ecosystem: no canned alerts (DEVICE_ALERTS is a different demo's)
  const [scope, setScope] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  // Phase H-8: split fleet by manufacturer origin (Adaptiv vs third-party).
  // 'all' is the default; pills above the grid let users narrow down.
  const [originFilter, setOriginFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(null);
  const [routedDeviceId, setRoutedDeviceId] = useState(null);
  const [reorderFor, setReorderFor] = useState(null);

  const layout = tweaks?.devicesLayout || 'cards';
  const deployView = tweaks?.deployView || 'rail';
  // Role-based device-type filter only applies to building mode. In the
  // ecosystem every role sees the 578 branch displays — otherwise roles like
  // Security (which allows cameras/badges/beacons but not displays) would
  // render an empty fleet.
  const allowedTypes = isEcosystem ? null : role?.deviceTypes || null;
  const canDeploy = role?.canDeploy !== false;

  const fleet = useMemo(
    () =>
      LIVE_FLEET.filter((d) => {
        if (allowedTypes && !allowedTypes.includes(d.type)) return false;
        if (scope !== 'all' && d.zone !== scope) return false;
        if (typeFilter !== 'all' && d.type !== typeFilter) return false;
        if (statusFilter !== 'all' && d.status !== statusFilter) return false;
        if (originFilter !== 'all') {
          const origin = DEVICE_TYPES[d.type]?.origin || 'adaptiv';
          if (origin !== originFilter) return false;
        }
        if (query) {
          const q = query.toLowerCase();
          if (
            !(
              d.id.toLowerCase().includes(q) ||
              d.location.toLowerCase().includes(q) ||
              d.room.toLowerCase().includes(q)
            )
          )
            return false;
        }
        return true;
      }),
    [LIVE_FLEET, scope, typeFilter, statusFilter, originFilter, query, allowedTypes],
  );

  const fleetAll = useMemo(
    () =>
      LIVE_FLEET.filter((d) => {
        if (allowedTypes && !allowedTypes.includes(d.type)) return false;
        if (scope !== 'all' && d.zone !== scope) return false;
        return true;
      }),
    [LIVE_FLEET, scope, allowedTypes],
  );

  // Origin counts derived from the same scope-filtered set so pill
  // counts match what the grid shows when each pill is selected.
  const originCounts = useMemo(() => {
    const out = { all: fleetAll.length, adaptiv: 0, third_party: 0 };
    for (const d of fleetAll) {
      const o = DEVICE_TYPES[d.type]?.origin || 'adaptiv';
      out[o] = (out[o] || 0) + 1;
    }
    return out;
  }, [fleetAll]);

  const counts = useMemo(() => {
    const c = { total: fleetAll.length, online: 0, degraded: 0, offline: 0, updating: 0, provisioning: 0 };
    fleetAll.forEach((d) => {
      c[d.status] = (c[d.status] || 0) + 1;
    });
    return c;
  }, [fleetAll]);

  // The type filter should only offer device types actually installed in
  // this building/scope — not the full DEVICE_TYPES catalog. Derive from
  // fleetAll (role+scope filtered, but NOT type-filtered, so selecting a
  // type doesn't collapse the dropdown to that single option).
  const installedTypes = useMemo(() => {
    const present = new Set();
    for (const d of fleetAll) present.add(d.type);
    return present;
  }, [fleetAll]);

  const selectedDevice = LIVE_FLEET.find((d) => d.id === sel);
  const routedDevice = LIVE_FLEET.find((d) => d.id === routedDeviceId);

  if (routedDevice) {
    return (
      <DeviceView
        device={routedDevice}
        onBack={() => setRoutedDeviceId(null)}
        onAskMerlin={onAskMerlin}
        onReorder={() => setReorderFor(routedDevice)}
      />
    );
  }

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        // 12px left/right margins owned entirely by the inline padding (don't
        // rely on the scrollbar gutter — overlay scrollbars, e.g. macOS, reserve
        // 0 width so the margin would collapse to 6px). `stable both-edges` stays
        // only to keep a classic scrollbar from shifting content. Bottom margin
        // pinned to 12px (matching the sides) so the fleet card reaches the edge.
        padding: 'var(--pad) 12px 12px',
        scrollbarGutter: 'stable both-edges',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pad)',
      }}
      className="devices-main"
    >
      <style>{`.devices-main > * { flex-shrink: 0; }`}</style>
      <FleetHero
        counts={counts}
        scope={scope}
        onScope={setScope}
        onOpenChat={onOpenChat}
        role={role}
        building={building}
        zones={zones}
        fleet={fleetAll}
      />

      {/* Hide the Merlin Device watch suggestions when there are no
          devices yet — `deviceAlerts` defaults to DEVICE_ALERTS, a
          hardcoded Meridian-flavored fixture ("ADX-AQ-0018", "Floor 24",
          "Lobby + Garage") that reads as noise (or worse, leaked data
          from another org) for a fresh tenant. PRO TEST smoke-test
          2026-05-18. Suggestions about devices only make sense when
          there are devices. */}
      {fleetAll.length > 0 && (
        <MerlinDeviceStrip
          onOpenChat={onOpenChat}
          onReorder={() => setReorderFor(LIVE_FLEET[0])}
          alerts={deviceAlerts}
        />
      )}

      {canDeploy && (
        <DeploymentsSection
          view={deployView}
          rollouts={isFebEco || isImf ? undefined : computeActiveRollouts(fleetAll)}
        />
      )}

      <FleetBoard
        fleet={fleet}
        total={fleetAll.length}
        originFilter={originFilter}
        onOriginFilter={setOriginFilter}
        originCounts={originCounts}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        installedTypes={installedTypes}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        query={query}
        onQuery={setQuery}
        layout={layout}
        onSelect={setSel}
        onOpen={(id) => {
          // L-1.6 / L-3.3: route Adaptiv-manufactured kinds to the
          // standalone /device/<id> page (single canonical, deep-
          // linkable device surface). Other kinds still fall back
          // to the legacy in-page DeviceView until each gets its
          // own detail panel.
          if (typeof id === 'string' && /^(SDC|PCB|SLB)-/i.test(id)) {
            navigateTo(`/device/${id}`);
          } else {
            setRoutedDeviceId(id);
          }
        }}
        selectedId={sel}
      />

      <DeviceDetailDrawer
        device={selectedDevice}
        onClose={() => setSel(null)}
        onAskMerlin={onAskMerlin}
        onReorder={() => setReorderFor(selectedDevice)}
      />

      <ReorderPanel device={reorderFor} onClose={() => setReorderFor(null)} />
    </main>
  );
}

function FleetHero({ counts, scope, onScope, role, building, zones, fleet }) {
  const t = useT();
  const isEcosystem = building?.kind === 'ecosystem';
  const isImf = building?.variant === 'imf';
  // FEB-specific branch-network framing is gated to FEB ids (see DevicesPage).
  const isFebEco = isEcosystem && /^feb/.test(building?.id || '');

  // Derive the display/sensor/logger split from the actual fleet —
  // no more hardcoded 616/3,160 numbers keyed to Meridian.
  const displayKinds = new Set(['display_touch', 'display_eink', 'display_sdg', 'smart_display_classic']);
  const loggerKinds = new Set(['smart_logger_basic']);
  const displayCount = fleet ? fleet.filter((d) => displayKinds.has(d.type)).length : 0;
  const loggerCount = fleet ? fleet.filter((d) => loggerKinds.has(d.type)).length : 0;
  const sensorCount = fleet ? fleet.length - displayCount - loggerCount : 0;

  // Pick the dominant device class to drive the ecosystem copy. With
  // FEB now carrying 581 Smart Loggers (and zero displays), the old
  // "Touch eInk displays" hero text is wrong — derive the language
  // from the actual fleet composition instead.
  const ecosystemDeviceLabel =
    loggerCount > displayCount && loggerCount > sensorCount
      ? t('devices.label.smart_loggers')
      : displayCount > 0
        ? t('devices.label.touch_eink')
        : t('devices.label.devices');

  const healthAside =
    counts.offline + counts.degraded > 0 ? (
      <>
        {t('devices.hero.health_monitoring', { offline: counts.offline, degraded: counts.degraded })}
        {counts.updating > 0 ? t('devices.hero.health_rollout', { n: counts.updating }) : null}.
      </>
    ) : (
      <>{t('devices.hero.health_green')}</>
    );

  const ecoImfTracking =
    counts.offline + counts.degraded > 0 ? (
      <>
        {t('devices.hero.eco_imf_tracking', { offline: counts.offline, degraded: counts.degraded })}
        {counts.updating > 0 ? t('devices.hero.eco_imf_units', { n: counts.updating }) : null}.
      </>
    ) : counts.provisioning > 0 ? (
      <>{t('devices.hero.imf_provisioning', { online: counts.online, provisioning: counts.provisioning })}</>
    ) : (
      <>{t('devices.hero.health_green')}</>
    );
  const ecoBranchTracking =
    counts.offline + counts.degraded > 0 ? (
      <>
        {t('devices.hero.eco_tracking', { offline: counts.offline, degraded: counts.degraded })}
        {counts.updating > 0 ? t('devices.hero.eco_sites', { n: counts.updating }) : null}.
      </>
    ) : (
      <>{t('devices.hero.health_green')}</>
    );

  const ecosystemSub =
    building?.variant === 'imf' ? (
      <>
        {t('devices.hero.eco_imf_intro', {
          total: counts.total,
          building: building.name,
          displays: displayCount,
          sensors: sensorCount,
        })}{' '}
        {ecoImfTracking}
      </>
    ) : (
      <>
        {t('devices.hero.eco_branches', { total: counts.total.toLocaleString(), label: ecosystemDeviceLabel })}{' '}
        {ecoBranchTracking}
      </>
    );

  const buildingFloors = building?.floors || null;
  const facilityCounts =
    loggerCount > 0
      ? t('devices.hero.facility_with_loggers', {
          displays: displayCount.toLocaleString(),
          sensors: sensorCount.toLocaleString(),
          loggers: loggerCount.toLocaleString(),
        })
      : t('devices.hero.facility_short', {
          displays: displayCount.toLocaleString(),
          sensors: sensorCount.toLocaleString(),
        });

  const subByRole = {
    facility:
      counts.total === 0 ? (
        <>{t('devices.hero.no_devices', { building: building?.name || t('devices.hero.this_building') })}</>
      ) : (
        <>
          {facilityCounts}
          {buildingFloors ? t('devices.hero.across_floors', { n: buildingFloors }) : ''}
          {t('devices.hero.facility_tail')} {healthAside}
        </>
      ),
    cleaning: (
      <>
        {t('devices.hero.cleaning')}{' '}
        {counts.offline + counts.degraded > 0
          ? t('devices.hero.cleaning_attention', { n: counts.offline + counts.degraded })
          : t('devices.hero.cleaning_ok')}
      </>
    ),
    maintenance: (
      <>
        {t('devices.hero.maintenance')}{' '}
        {counts.offline + counts.degraded > 0
          ? t('devices.hero.maintenance_status', { offline: counts.offline, degraded: counts.degraded })
          : t('devices.hero.maintenance_ok')}
      </>
    ),
    security: (
      <>
        {t('devices.hero.security')}{' '}
        {counts.degraded > 0
          ? t('devices.hero.security_status', { n: counts.degraded })
          : t('devices.hero.security_ok')}
      </>
    ),
  };

  // FEB/IMF ecosystems use their story-driven hero; other ecosystems (PSG)
  // fall to the generic facility sub/title built from their real fleet.
  const sub = isFebEco || isImf ? ecosystemSub : subByRole[role?.id] || subByRole.facility;
  const buildingName = building?.name || t('devices.hero.this_building');
  const title = isImf
    ? t('devices.title.eco_imf', { n: counts.total.toLocaleString(), building: building.name })
    : isFebEco
      ? t('devices.title.eco_branches', {
          n: counts.total.toLocaleString(),
          label: ecosystemDeviceLabel.toLowerCase(),
          building: building.name,
        })
      : {
          facility: t('devices.title.facility', { n: counts.total.toLocaleString(), building: buildingName }),
          cleaning: t('devices.title.cleaning', { n: counts.total.toLocaleString() }),
          maintenance: t('devices.title.maintenance', { n: counts.total.toLocaleString() }),
          security: t('devices.title.security', { n: counts.total.toLocaleString() }),
        }[role?.id] || t('devices.title.facility', { n: counts.total.toLocaleString(), building: buildingName });

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
      <div style={{ padding: 'var(--pad)', display: 'flex', alignItems: 'flex-start', gap: 20, position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
              }}
            >
              {t('devices.eyebrow', { role: role?.name || t('role.short.facility') })}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.01, color: 'var(--text)' }}>
            {title}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 640 }}>{sub}</p>

          <div
            style={{
              display: 'flex',
              gap: 2,
              background: 'var(--surface-2)',
              padding: 2,
              borderRadius: 8,
              marginTop: 14,
              width: 'fit-content',
            }}
          >
            {zones.map((z) => (
              <button
                key={z.id}
                onClick={() => onScope(z.id)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: scope === z.id ? 'var(--surface)' : 'transparent',
                  color: scope === z.id ? 'var(--text)' : 'var(--text-dim)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  boxShadow: scope === z.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {z.short}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <FleetStat
            label={t('devices.stat.online')}
            value={counts.online}
            sub={t('devices.stat.online_sub', {
              pct: counts.total ? Math.round((counts.online / counts.total) * 100) : 0,
            })}
            tone="ok"
          />
          <FleetStat
            label={t('devices.stat.degraded')}
            value={counts.degraded}
            sub={t('devices.stat.degraded_sub')}
            tone="warn"
          />
          <FleetStat
            label={t('devices.stat.offline')}
            value={counts.offline}
            sub={counts.offline ? t('devices.stat.offline_sub') : '—'}
            tone="risk"
            pulse={counts.offline > 0}
          />
          <FleetStat
            label={t('devices.stat.updating')}
            value={counts.updating}
            sub={t('devices.stat.updating_sub')}
            tone="info"
          />
        </div>
      </div>
    </Card>
  );
}

function FleetStat({ label, value, sub, tone, pulse }) {
  const color =
    { ok: 'var(--ok)', risk: 'var(--risk)', warn: 'var(--warn)', info: 'var(--info)', accent: 'var(--accent)' }[tone] ||
    'var(--text)';
  return (
    <div
      style={{
        minWidth: 132,
        padding: '10px 14px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
        }}
      >
        <Dot tone={tone} size={5} pulse={pulse} /> {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color,
          marginTop: 4,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function MerlinDeviceStrip({ onOpenChat, onReorder, alerts = DEVICE_ALERTS }) {
  const t = useT();
  return (
    <Card
      pad={false}
      accent
      style={{
        background:
          'linear-gradient(135deg, color-mix(in oklch, var(--accent) 8%, var(--surface)) 0%, var(--surface) 60%)',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Icon.sparkle size={14} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('devices.watch.title')}</div>
        <Pill tone="accent">{t('devices.watch.suggestions', { n: alerts.length })}</Pill>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => onOpenChat?.(t('devices.watch.ask_prompt'))}
          style={{
            padding: '4px 10px',
            fontSize: 11.5,
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--accent)',
            border: '1px solid var(--accent-line)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {t('devices.watch.cta')}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${alerts.length}, 1fr)` }}>
        {alerts.map((a, i) => (
          <div
            key={a.id}
            style={{
              padding: '12px 16px',
              borderRight: i < alerts.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Dot tone={a.tone} size={6} pulse={a.tone === 'risk'} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text)',
                  letterSpacing: 0.05,
                  textTransform: 'uppercase',
                }}
              >
                {a.title}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.45 }}>{a.body}</div>
            <button
              onClick={() => {
                if (a.id === 'm-1') onReorder?.();
                else onOpenChat?.(a.body);
              }}
              style={{
                marginTop: 4,
                padding: '5px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              {a.cta} →
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
