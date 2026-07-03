// Standalone device-detail page (Track L-1.6).
//
// Mounted at /device/<external_id>. SDC-only first cut: layout +
// language are tuned for the Smart Display Classic (e-ink, 4 buttons,
// NFC, restroom or meeting-room mode). Other device kinds get a
// minimal fallback panel so the URL doesn't 404; the right detail
// page for them lands when each kind needs its own surface.

import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card, AdaptivLoader } from './primitives.jsx';
import { useSession } from './auth.js';
import { useDevice, useUpdateDevice } from './queries/devices.ts';
import {
  useDeviceEvents,
  useDeviceMessages,
  useDeviceCleanings,
  useDeviceServiceSessions,
  useCrewByBadge,
  describeDeviceEvent,
} from './device-events.js';
import { useT } from './i18n.js';

const KIND_LABEL = {
  smart_display_classic: 'Smart Display Classic',
  people_counter_basic: 'People Counter Basic',
  smart_logger_basic: 'Smart Logger Basic',
  display_touch: 'Smart Display Touch',
  display_eink: 'Smart Display E-ink',
  display_sdg: 'Smart Display SDG',
  airq: 'Air Quality Sensor',
  occupancy: 'Occupancy Sensor',
  pc_counter: 'People Counter',
  camera: 'Camera',
  badge: 'Badge Reader',
  leak: 'Leak Sensor',
  beacon: 'BLE Beacon',
};

const STATUS_TONE = {
  online: 'ok',
  degraded: 'warn',
  offline: 'risk',
  updating: 'info',
  provisioning: 'info',
};

export function DeviceDetailPage({ externalId, onBack }) {
  const t = useT();
  const session = useSession();
  const { data: device, isLoading, isFetched } = useDevice(session?.organizationId, externalId);
  // Mirror the prior one-shot read: show the loader until the fetch resolves,
  // and only flag "not found" once a real fetch has come back empty.
  const loading = isLoading;
  const notFound = isFetched && !device;

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 'var(--pad)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pad)',
      }}
    >
      <Breadcrumb externalId={externalId} onBack={onBack} />

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <AdaptivLoader size="sm" />
        </div>
      )}
      {notFound && <NotFoundCard externalId={externalId} onBack={onBack} />}
      {device && device.kind === 'smart_display_classic' && <SmartDisplayClassicPanels device={device} />}
      {device && device.kind === 'people_counter_basic' && <PeopleCounterBasicPanels device={device} />}
      {device && device.kind === 'smart_logger_basic' && <SmartLoggerBasicPanels device={device} />}
      {device &&
        device.kind !== 'smart_display_classic' &&
        device.kind !== 'people_counter_basic' &&
        device.kind !== 'smart_logger_basic' && (
          <PlaceholderCard text={t('ddp.no_detail_yet', { kind: device.kind })} />
        )}
    </main>
  );
}

// ───────── shared bits

function Breadcrumb({ externalId, onBack }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-dim)' }}>
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          background: 'var(--surface-2)',
          color: 'var(--text-soft)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 11.5,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <Icon.chevD size={11} style={{ transform: 'rotate(90deg)' }} />
        {t('ddp.back')}
      </button>
      <span>{t('tab.devices')}</span>
      <span style={{ color: 'var(--text-faint)' }}>›</span>
      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-soft)' }}>{externalId}</span>
    </div>
  );
}

function PlaceholderCard({ text }) {
  return (
    <Card pad style={{ padding: 'var(--pad)', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
      {text}
    </Card>
  );
}

// Phase H-10: shared tab strip used by SDC / PCB / SLB detail pages.
// Sits below the hero (which stays always-visible) and above the
// active tab's content. `tabs` is [{ id, label, sub? }] — `sub` is a
// small dim count rendered next to the label (e.g. event count).
function DeviceTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '10px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              background: 'transparent',
              color: isActive ? 'var(--text)' : 'var(--text-dim)',
              border: 'none',
              borderBottom: '2px solid ' + (isActive ? 'var(--accent)' : 'transparent'),
              cursor: 'pointer',
              marginBottom: -1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font)',
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
  );
}

function NotFoundCard({ externalId, onBack }) {
  const t = useT();
  return (
    <Card pad>
      <div style={{ padding: 'var(--pad)' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t('device.not_found')}</h2>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.5 }}>
          {(() => {
            const tmpl = t('ddp.not_found_body', { id: 'XIDX' });
            const [pre, post = ''] = tmpl.split('XIDX');
            return (
              <>
                {pre}
                <span style={{ fontFamily: 'var(--mono)' }}>{externalId}</span>
                {post}
              </>
            );
          })()}
        </p>
        <button
          onClick={onBack}
          style={{
            marginTop: 14,
            padding: '8px 14px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('ddp.back_to_devices')}
        </button>
      </div>
    </Card>
  );
}

// ───────── Smart Display Classic — the L-1 fleet

function SmartDisplayClassicPanels({ device }) {
  const t = useT();
  const tel = device.telemetry || {};
  const mode = tel.mode || 'restroom';
  const statusTone = STATUS_TONE[device.status] || 'info';
  const fwBehind = device.firmware && device.firmware_latest && device.firmware !== device.firmware_latest;

  const { events, loaded: eventsLoaded } = useDeviceEvents(device.id, 80);
  const { messages, loaded: messagesLoaded } = useDeviceMessages(device.id);
  const { cleanings } = useDeviceCleanings(device.id, 5);
  const lastClean = cleanings[0]?.ended_at || null;
  const [tab, setTab] = useState('overview');

  return (
    <>
      {/* Hero */}
      <Card pad={false} style={{ position: 'relative' }}>
        {/* Phase H-9 fix: previously used overflow: hidden on the Card
            to clip the gradient at the rounded corners, but that also
            clipped tall headers (status pills could fall outside the
            card's content box and disappear). Move the corner-clip to
            the gradient overlay itself via borderRadius: inherit so
            the gradient stays bounded while flow content stays free. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(500px 240px at 90% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)',
            borderRadius: 'inherit',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{ padding: 'var(--pad)', position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 20 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              flexShrink: 0,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon.display size={26} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: 'var(--text-dim)' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.15, textTransform: 'uppercase' }}>
                {KIND_LABEL[device.kind]} · {device.model || t('ddp.unknown_model')}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)' }}>
              {device.external_id}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-soft)' }}>
              {device.room || '—'} · {t('ddp.floor_label', { n: device.floor ?? '—' })}
            </p>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Pill tone={statusTone}>
                <Dot tone={statusTone} size={5} pulse={device.status === 'online'} />{' '}
                {t(`ddp.status.${device.status}`) || device.status}
              </Pill>
              <Pill tone="info">{mode === 'restroom' ? t('ddp.mode.restroom') : t('ddp.mode.meeting')}</Pill>
              <Pill tone="off">{t('ddp.sku', { sku: device.sku || '—' })}</Pill>
              {fwBehind && <Pill tone="warn">{t('device.firmware_behind')}</Pill>}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs (Phase H-10): hero stays always-visible; the cards
          below get split into Overview / Activity / Hardware tabs so
          the page reads at a glance and details are one click away. */}
      <DeviceTabs
        tabs={[
          { id: 'overview', label: t('ddp.tab.overview') },
          { id: 'activity', label: t('ddp.tab.activity'), sub: events.length || null },
          { id: 'hardware', label: t('ddp.tab.hardware') },
          { id: 'messages', label: t('ddp.tab.messages'), sub: messages.length || null },
          { id: 'firmware', label: t('ddp.tab.firmware') },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 'var(--pad)' }}>
          <TelemetryCard device={device} lastClean={lastClean} />
          <ScreenPreview mode={mode} device={device} cleanings={cleanings} />
        </div>
      )}
      {tab === 'activity' && <ActivityCard events={events} loaded={eventsLoaded} />}
      {tab === 'messages' && <DeviceMessagesCard messages={messages} loaded={messagesLoaded} />}
      {tab === 'hardware' && <HardwareCard />}
      {tab === 'firmware' && <FirmwareCard device={device} />}
    </>
  );
}

function TelemetryCard({ device, lastClean }) {
  const t = useT();
  return (
    <Card pad={false}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('device.telemetry')}</div>
      </div>
      <div
        style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}
      >
        <Stat
          label={t('ddp.stat.battery')}
          value={device.battery_pct != null ? `${device.battery_pct}%` : '—'}
          hint={
            device.battery_chemistry
              ? t('ddp.battery.hint', {
                  chem: device.battery_chemistry,
                  kind: device.battery_swappable ? t('ddp.battery.swappable') : t('ddp.battery.fixed'),
                })
              : null
          }
          tone={
            device.battery_pct == null
              ? 'off'
              : device.battery_pct < 25
                ? 'risk'
                : device.battery_pct < 50
                  ? 'warn'
                  : 'ok'
          }
        />
        <Stat label={t('ddp.stat.last_seen')} value={relTime(device.last_seen, t)} />
        <Stat
          label={t('ddp.stat.firmware')}
          value={device.firmware || '—'}
          hint={
            device.firmware_latest && device.firmware !== device.firmware_latest
              ? t('ddp.firmware.latest_x', { v: device.firmware_latest })
              : t('ddp.firmware.on_latest')
          }
          tone={device.firmware_latest && device.firmware !== device.firmware_latest ? 'warn' : 'ok'}
        />
        <Stat label={t('ddp.stat.uplink')} value={(device.uplink || '—').toUpperCase()} />
        <Stat label={t('ddp.stat.installed')} value={device.install_date || '—'} />
        <Stat
          label={t('ddp.stat.last_clean')}
          value={lastClean ? relTime(lastClean, t) : t('ddp.last_clean.never')}
          hint={lastClean ? null : t('ddp.last_clean.no_checkout')}
        />
      </div>
    </Card>
  );
}

function Stat({ label, value, hint, tone }) {
  const color =
    tone === 'ok'
      ? 'var(--ok)'
      : tone === 'warn'
        ? 'var(--warn)'
        : tone === 'risk'
          ? 'var(--risk)'
          : tone === 'off'
            ? 'var(--text-dim)'
            : 'var(--text)';
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.12,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'var(--mono)', lineHeight: 1.1 }}>{value}</div>
      {hint && <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

// Firmware tab content (Phase H-11). Reads firmware fields directly
// from the device row — current version, latest available, in-flight
// update progress, and the update path (which is per-device-class +
// per-variant for PCB). The update-path note is what tells users
// whether they can roll the firmware out remotely or need a service
// truck — non-trivial for fleet planning.
function FirmwareCard({ device }) {
  const t = useT();
  const cur = device.firmware || '—';
  const latest = device.firmware_latest || cur;
  const onLatest = !device.firmware_latest || cur === latest;
  const updating = !!device.firmware_updating;
  const progress = device.firmware_progress_pct ?? 0;
  // Per-class update path. Adaptiv devices: SDC is manual-only, SLB
  // is manual-only, PCB depends on variant (V1B BLE-updatable vs V1L
  // manual-only). Third-party devices route through the vendor.
  const updatePath = (() => {
    const tel = device.telemetry || {};
    if (device.kind === 'people_counter_basic') {
      return tel.variant === 'ble'
        ? { mode: t('ddp.fw.path.ble_updatable'), detail: t('ddp.fw.path.ble_detail') }
        : { mode: t('ddp.fw.path.manual'), detail: t('ddp.fw.path.pcb_l_detail') };
    }
    if (device.kind === 'smart_display_classic') {
      return { mode: t('ddp.fw.path.manual'), detail: t('ddp.fw.path.sdc_detail') };
    }
    if (device.kind === 'smart_logger_basic') {
      return { mode: t('ddp.fw.path.manual'), detail: t('ddp.fw.path.slb_detail') };
    }
    if (device.kind === 'bacnet_thermostat' || device.kind === 'onvif_camera' || device.kind === 'hid_badge_reader') {
      return { mode: t('ddp.fw.path.vendor'), detail: t('ddp.fw.path.vendor_detail') };
    }
    return { mode: '—', detail: null };
  })();
  const tone = updating ? 'info' : onLatest ? 'ok' : 'warn';
  const banner = updating
    ? t('ddp.firmware.updating_to', { v: latest })
    : onLatest
      ? t('ddp.firmware.on_latest_banner')
      : t('ddp.firmware.update_available', { v: latest });
  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('device.firmware')}</div>
        <Pill tone={tone}>
          <Dot tone={tone} size={5} pulse={updating} /> {banner}
        </Pill>
      </div>
      <div
        style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}
      >
        <Stat label={t('ddp.stat.installed')} value={cur} tone={onLatest ? 'ok' : 'warn'} />
        <Stat
          label="Latest"
          value={latest}
          hint={onLatest ? 'on latest' : 'release available'}
          tone={onLatest ? 'ok' : 'warn'}
        />
        <Stat label="Update path" value={updatePath.mode} hint={updatePath.detail} />
        <Stat label="Install date" value={device.install_date || '—'} />
      </div>
      {updating && (
        <div style={{ padding: '0 16px 14px' }}>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--info)',
              fontWeight: 600,
              marginBottom: 4,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{t('ddp.firmware.updating_arrow', { v: latest })}</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{ width: `${progress}%`, height: '100%', background: 'var(--info)', transition: 'width .3s' }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function HardwareCard() {
  const t = useT();
  const specs = [
    [t('ddp.hw.row.display'), t('ddp.hw.sdc.display')],
    [t('ddp.hw.row.input'), t('ddp.hw.sdc.input')],
    [t('ddp.hw.row.nfc'), t('ddp.hw.sdc.nfc')],
    [t('ddp.hw.row.backhaul'), t('ddp.hw.lte')],
    [t('ddp.hw.row.power'), t('ddp.hw.power_3y')],
    [t('ddp.hw.row.sensors'), t('ddp.hw.sdc.sensors')],
    [t('ddp.hw.row.firmware'), t('ddp.hw.sdc.firmware')],
  ];
  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon.gateway size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('device.hardware')}</div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{t('ddp.hardware.adaptiv_catalog')}</span>
      </div>
      <div style={{ padding: 12 }}>
        {specs.map(([k, v], i) => (
          <div
            key={k}
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr',
              gap: 12,
              padding: '6px 4px',
              borderBottom: i < specs.length - 1 ? '1px dashed var(--border)' : 'none',
              fontSize: 12,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.1,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
              }}
            >
              {k}
            </div>
            <div style={{ color: 'var(--text-soft)' }}>{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ActivityCard({ events, loaded }) {
  const t = useT();
  const crewByBadge = useCrewByBadge();
  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon.sparkle size={13} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('device.recent_activity')}</div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
          {loaded
            ? t(events.length === 1 ? 'ddp.activity.events_one' : 'ddp.activity.events_many', { n: events.length })
            : t('ddp.activity.loading')}
        </span>
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {loaded && events.length === 0 && (
          <div style={{ padding: 'var(--pad)', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            {t('ddp.activity.empty')}
          </div>
        )}
        {events.map((event, i) => {
          const desc = describeDeviceEvent(event, { crewByBadge });
          const IconComp = Icon[desc.iconKey] || Icon.dots;
          return (
            <div
              key={event.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 16px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  flexShrink: 0,
                  background: 'var(--surface-2)',
                  color: 'var(--text-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconComp size={11} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{desc.title}</div>
                {desc.hint && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1, fontFamily: 'var(--mono)' }}>
                    {desc.hint}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--text-dim)',
                  flexShrink: 0,
                  marginTop: 2,
                  fontFamily: 'var(--mono)',
                }}
              >
                {relTime(event.occurred_at, t)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Messages tab: every raw uplink the device has sent ──────────────
// Reads public.events (source_ref='device:<id>') — the table the live
// /api/devices/uplink webhook actually writes to. Searchable (kind / badge /
// any payload field) + filterable by message type, newest first, each row
// expandable to the full JSON payload + LoRa frame id.
function fmtMsgTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
// Render the payload as key→value pairs, skipping the title/sub we already show.
function payloadEntries(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const SKIP = new Set(['title', 'sub', 'legacy_emit', 'replay', 'raw']);
  return Object.entries(payload).filter(([k, v]) => !SKIP.has(k) && v !== null && v !== undefined && v !== '');
}
const MSG_SEVERITY_TONE = { info: 'off', medium: 'info', high: 'warn', critical: 'risk' };

export function DeviceMessagesCard({ messages, loaded }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [openId, setOpenId] = useState(null);

  const kinds = useMemo(() => Array.from(new Set(messages.map((m) => m.kind).filter(Boolean))).sort(), [messages]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return messages.filter((m) => {
      if (kindFilter !== 'all' && m.kind !== kindFilter) return false;
      if (!needle) return true;
      const hay = `${m.kind} ${m.external_id} ${m.severity} ${JSON.stringify(m.payload || {})}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [messages, q, kindFilter]);

  const inputStyle = {
    fontFamily: 'inherit',
    fontSize: 12,
    color: 'var(--text)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '7px 10px',
    outline: 'none',
  };

  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <Icon.bolt size={13} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('ddp.tab.messages')}</div>
        <div style={{ flex: 1, minWidth: 12 }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('ddp.msg.search')}
          style={{ ...inputStyle, width: 240, maxWidth: '40vw' }}
        />
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="all">{t('ddp.msg.all_types')}</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <span
          style={{ fontSize: 10.5, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
        >
          {loaded ? t('ddp.msg.showing', { n: filtered.length, total: messages.length }) : '…'}
        </span>
      </div>

      {/* Column header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '170px 150px 1fr 70px 16px',
          gap: 10,
          padding: '7px 16px',
          borderBottom: '1px solid var(--border)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}
      >
        <span>{t('ddp.msg.col_time')}</span>
        <span>{t('ddp.msg.col_type')}</span>
        <span>{t('ddp.msg.col_detail')}</span>
        <span style={{ textAlign: 'right' }}>{t('ddp.msg.col_battery')}</span>
        <span />
      </div>

      <div style={{ maxHeight: 520, overflowY: 'auto' }}>
        {loaded && messages.length === 0 && (
          <div style={{ padding: 'var(--pad)', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            {t('ddp.msg.empty')}
          </div>
        )}
        {loaded && messages.length > 0 && filtered.length === 0 && (
          <div style={{ padding: 'var(--pad)', fontSize: 12, color: 'var(--text-dim)' }}>
            {t('ddp.msg.empty_filtered')}
          </div>
        )}
        {filtered.map((m) => {
          const p = m.payload || {};
          const open = openId === m.id;
          const tone = MSG_SEVERITY_TONE[m.severity] || 'off';
          const detail = [p.title, p.sub].filter(Boolean).join(' · ') || m.kind;
          return (
            <div key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
              <div
                onClick={() => setOpenId(open ? null : m.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '170px 150px 1fr 70px 16px',
                  gap: 10,
                  padding: '9px 16px',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{ fontSize: 11, color: 'var(--text-soft)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}
                >
                  {fmtMsgTime(m.created_at)}
                </span>
                <span>
                  <Pill tone={tone}>{m.kind}</Pill>
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {detail}
                </span>
                <span
                  style={{ fontSize: 11.5, color: 'var(--text-soft)', fontFamily: 'var(--mono)', textAlign: 'right' }}
                >
                  {p.battery_pct != null ? `${p.battery_pct}%` : '—'}
                </span>
                <Icon.chevD
                  size={11}
                  style={{
                    color: 'var(--text-faint)',
                    transform: open ? 'none' : 'rotate(-90deg)',
                    transition: 'transform .15s',
                  }}
                />
              </div>
              {open && (
                <div style={{ padding: '0 16px 12px 16px', background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 0' }}>
                    {payloadEntries(p).map(([k, v]) => (
                      <span
                        key={k}
                        style={{
                          fontSize: 10.5,
                          fontFamily: 'var(--mono)',
                          color: 'var(--text-soft)',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '3px 7px',
                        }}
                      >
                        <b style={{ color: 'var(--text-dim)' }}>{k}</b>{' '}
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </span>
                    ))}
                  </div>
                  {m.external_id && (
                    <div
                      style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)', marginBottom: 8 }}
                    >
                      {t('ddp.msg.frame')}: {m.external_id}
                    </div>
                  )}
                  {/* The JSON as the device sent it (payload.raw = the MessageV3),
                      falling back to the stored payload for older messages. */}
                  {(() => {
                    const json = JSON.stringify(p.raw ?? p, null, 2);
                    return (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: 0.4,
                              textTransform: 'uppercase',
                              color: 'var(--text-faint)',
                            }}
                          >
                            {p.raw ? t('ddp.msg.received_json') : t('ddp.msg.payload_json')}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              try {
                                navigator.clipboard?.writeText(json);
                              } catch {
                                /* ignore */
                              }
                            }}
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: 'var(--text-soft)',
                              cursor: 'pointer',
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 5,
                              padding: '2px 7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {t('ddp.msg.copy')}
                          </button>
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            padding: '8px 10px',
                            maxHeight: 240,
                            overflow: 'auto',
                            fontSize: 11,
                            lineHeight: 1.5,
                            fontFamily: 'var(--mono)',
                            color: 'var(--text)',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            whiteSpace: 'pre',
                            wordBreak: 'normal',
                          }}
                        >
                          {json}
                        </pre>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Visual mock of the device's screen, in the appropriate mode.
function ScreenPreview({ mode, device, cleanings }) {
  const t = useT();
  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon.display size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('ddp.scr.whats_on')}</div>
        <div style={{ flex: 1 }} />
        <Pill tone="info">{mode === 'restroom' ? t('ddp.mode.restroom') : t('ddp.mode.meeting')}</Pill>
      </div>
      <div style={{ padding: 14 }}>
        <DeviceFrame mode={mode} device={device} cleanings={cleanings} />
        <p style={{ margin: '12px 2px 0', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('ddp.scr.preview_hint')}
        </p>
      </div>
    </Card>
  );
}

function DeviceFrame({ mode, device, cleanings }) {
  // Faux-physical bezel + 4 dots representing the side buttons.
  return (
    <div
      style={{
        background: 'var(--surface-3)',
        border: '2px solid var(--border-strong)',
        borderRadius: 14,
        padding: 12,
        display: 'grid',
        gridTemplateColumns: '1fr 12px',
        gap: 10,
      }}
    >
      <ScreenContent mode={mode} device={device} cleanings={cleanings} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center' }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: 'var(--text-dim)',
              opacity: 0.6,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ScreenContent({ mode, device, cleanings }) {
  const t = useT();
  const list = cleanings || [];
  return (
    <div
      style={{
        background: '#f1ede5', // e-ink-ish off-white
        color: '#1a1a1a',
        borderRadius: 7,
        padding: 12,
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        fontFamily: 'var(--mono)',
      }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.1, textTransform: 'uppercase', color: '#666' }}>
        {device.room || t('ddp.scr.room_fallback')}
      </div>

      {mode === 'restroom' ? (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#444', marginTop: 4 }}>{t('ddp.scr.last_5')}</div>
          {list.length === 0 ? (
            <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>{t('ddp.scr.no_records')}</div>
          ) : (
            <div style={{ fontSize: 11, color: '#555', lineHeight: 1.6 }}>
              {list.map((v) => (
                <div key={v.id}>· {formatScreenTime(v.ended_at)}</div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#444', marginTop: 4 }}>
            {t('ddp.scr.last_cleaned')}
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>
            {list[0] ? formatScreenTime(list[0].ended_at) : <span style={{ fontStyle: 'italic' }}>—</span>}
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {mode === 'restroom' ? (
          <>
            <ScreenButton label={t('ddp.scr.btn_request')} hotkey="▷" />
            <ScreenButton label={t('ddp.scr.btn_rate')} hotkey="▷" />
          </>
        ) : (
          <>
            <ScreenButton label={t('ddp.scr.btn_maintenance')} hotkey="▷" />
            <ScreenButton label={t('ddp.scr.btn_rate')} hotkey="▷" />
          </>
        )}
      </div>
    </div>
  );
}

// Format a clean visit's ended_at the way an occupant would see it on
// the e-ink screen — short date + 24h time, not relative ("3h ago").
// Real devices show absolute timestamps because relative drift is
// confusing on a panel that updates only on event.
function formatScreenTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const mon = d.toLocaleDateString(undefined, { month: 'short' });
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${mon} ${day} · ${hh}:${mm}`;
}

function ScreenButton({ label, hotkey }) {
  return (
    <div
      style={{
        padding: '7px 9px',
        border: '1.5px solid #1a1a1a',
        borderRadius: 4,
        fontSize: 11.5,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fff',
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 11, color: '#888' }}>{hotkey}</span>
    </div>
  );
}

// ───────── People Counter Basic — the L-3 fleet
//
// PCB has no on-device display, so the right column carries the
// operator-editable Configuration card instead of an e-ink mockup.
// Telemetry surfaces the latest count_report value so the panel
// reads "alive" even when activity is sparse.

function PeopleCounterBasicPanels({ device }) {
  const t = useT();
  const tel = device.telemetry || {};
  const variant = tel.variant === 'ble' ? 'ble' : 'lte_only';
  const statusTone = STATUS_TONE[device.status] || 'info';
  const fwBehind = device.firmware && device.firmware_latest && device.firmware !== device.firmware_latest;

  const { events, loaded: eventsLoaded } = useDeviceEvents(device.id, 80);
  const { messages, loaded: messagesLoaded } = useDeviceMessages(device.id);
  const latestCount = events.find((e) => e.event_type === 'count_report' || e.event_type === 'count_threshold');
  const [tab, setTab] = useState('overview');

  return (
    <>
      {/* Hero */}
      <Card pad={false} style={{ position: 'relative' }}>
        {/* Phase H-9 fix: previously used overflow: hidden on the Card
            to clip the gradient at the rounded corners, but that also
            clipped tall headers (status pills could fall outside the
            card's content box and disappear). Move the corner-clip to
            the gradient overlay itself via borderRadius: inherit so
            the gradient stays bounded while flow content stays free. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(500px 240px at 90% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)',
            borderRadius: 'inherit',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{ padding: 'var(--pad)', position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 20 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              flexShrink: 0,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon.people size={26} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: 'var(--text-dim)' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.15, textTransform: 'uppercase' }}>
                {KIND_LABEL[device.kind]} · {device.model || t('ddp.unknown_model')}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)' }}>
              {device.external_id}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-soft)' }}>
              {device.room || '—'} · {t('ddp.floor_label', { n: device.floor ?? '—' })}
            </p>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Pill tone={statusTone}>
                <Dot tone={statusTone} size={5} pulse={device.status === 'online'} />{' '}
                {t(`ddp.status.${device.status}`) || device.status}
              </Pill>
              <Pill tone="info">{variant === 'ble' ? t('ddp.variant.ble') : t('ddp.variant.manual')}</Pill>
              <Pill tone="off">{t('ddp.sku', { sku: device.sku || '—' })}</Pill>
              {fwBehind && <Pill tone="warn">{t('device.firmware_behind')}</Pill>}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs (Phase H-10): hero stays always-visible; detail cards
          live under Overview / Activity / Hardware / Configuration. */}
      <DeviceTabs
        tabs={[
          { id: 'overview', label: t('ddp.tab.overview') },
          { id: 'activity', label: t('ddp.tab.activity'), sub: events.length || null },
          { id: 'hardware', label: t('ddp.tab.hardware') },
          { id: 'config', label: t('ddp.tab.config') },
          { id: 'messages', label: t('ddp.tab.messages'), sub: messages.length || null },
          { id: 'firmware', label: t('ddp.tab.firmware') },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && <PCBTelemetryCard device={device} latestCount={latestCount} />}
      {tab === 'activity' && <ActivityCard events={events} loaded={eventsLoaded} />}
      {tab === 'messages' && <DeviceMessagesCard messages={messages} loaded={messagesLoaded} />}
      {tab === 'hardware' && <PCBHardwareCard variant={variant} />}
      {tab === 'config' && <PCBConfigurationCard device={device} />}
      {tab === 'firmware' && <FirmwareCard device={device} />}
    </>
  );
}

function PCBTelemetryCard({ device, latestCount }) {
  const t = useT();
  return (
    <Card pad={false}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('device.telemetry')}</div>
      </div>
      <div
        style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}
      >
        <Stat
          label={t('ddp.stat.battery')}
          value={device.battery_pct != null ? `${device.battery_pct}%` : '—'}
          hint={
            device.battery_chemistry
              ? t('ddp.battery.hint', {
                  chem: device.battery_chemistry,
                  kind: device.battery_swappable ? t('ddp.battery.swappable') : t('ddp.battery.fixed'),
                })
              : null
          }
          tone={
            device.battery_pct == null
              ? 'off'
              : device.battery_pct < 25
                ? 'risk'
                : device.battery_pct < 50
                  ? 'warn'
                  : 'ok'
          }
        />
        <Stat label={t('ddp.stat.last_seen')} value={relTime(device.last_seen, t)} />
        <Stat
          label={t('ddp.stat.firmware')}
          value={device.firmware || '—'}
          hint={
            device.firmware_latest && device.firmware !== device.firmware_latest
              ? t('ddp.firmware.latest_x', { v: device.firmware_latest })
              : t('ddp.firmware.on_latest')
          }
          tone={device.firmware_latest && device.firmware !== device.firmware_latest ? 'warn' : 'ok'}
        />
        <Stat label={t('ddp.stat.uplink')} value={(device.uplink || '—').toUpperCase()} />
        <Stat label={t('ddp.stat.installed')} value={device.install_date || '—'} />
        <Stat
          label={t('ddp.stat.latest_count')}
          value={latestCount ? String(latestCount.payload?.count ?? '—') : '—'}
          hint={
            latestCount
              ? t('ddp.pcb.event_at', {
                  kind:
                    latestCount.event_type === 'count_threshold'
                      ? t('ddp.pcb.threshold_trip')
                      : t('ddp.pcb.interval_report'),
                  when: relTime(latestCount.occurred_at, t),
                })
              : t('ddp.pcb.no_count_events')
          }
        />
      </div>
    </Card>
  );
}

function PCBHardwareCard({ variant }) {
  const t = useT();
  const fwLine = variant === 'ble' ? t('ddp.hw.pcb.fw_ble') : t('ddp.hw.pcb.fw_manual');
  const specs = [
    [t('ddp.hw.row.sensor'), t('ddp.hw.pcb.sensor')],
    [t('ddp.hw.row.backhaul'), t('ddp.hw.lte')],
    [t('ddp.hw.row.power'), t('ddp.hw.power_3y')],
    [t('ddp.hw.row.variant'), variant === 'ble' ? t('ddp.hw.pcb.variant_ble') : t('ddp.hw.pcb.variant_lte')],
    [t('ddp.hw.row.firmware'), fwLine],
  ];
  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon.gateway size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('device.hardware')}</div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{t('ddp.hardware.adaptiv_catalog')}</span>
      </div>
      <div style={{ padding: 12 }}>
        {specs.map(([k, v], i) => (
          <div
            key={k}
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr',
              gap: 12,
              padding: '6px 4px',
              borderBottom: i < specs.length - 1 ? '1px dashed var(--border)' : 'none',
              fontSize: 12,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.1,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
              }}
            >
              {k}
            </div>
            <div style={{ color: 'var(--text-soft)' }}>{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const REPORTING_INTERVAL_OPTIONS = [
  { value: 5, labelKey: 'ddp.pcb.cfg.5min' },
  { value: 15, labelKey: 'ddp.pcb.cfg.15min' },
  { value: 30, labelKey: 'ddp.pcb.cfg.30min' },
  { value: 60, labelKey: 'ddp.pcb.cfg.1hour' },
];

function PCBConfigurationCard({ device }) {
  const t = useT();
  const updateDevice = useUpdateDevice();
  const cfg = device.telemetry?.config || {};
  const persistedThreshold = Number.isInteger(cfg.threshold) ? cfg.threshold : 30;
  const persistedMode = cfg.reporting_mode === 'threshold' ? 'threshold' : 'interval';
  const persistedInterval = REPORTING_INTERVAL_OPTIONS.find((o) => o.value === cfg.reporting_interval_min)?.value ?? 30;

  const [draftThreshold, setDraftThreshold] = useState(persistedThreshold);
  const [draftMode, setDraftMode] = useState(persistedMode);
  const [draftInterval, setDraftInterval] = useState(persistedInterval);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDraftThreshold(persistedThreshold);
  }, [persistedThreshold]);
  useEffect(() => {
    setDraftMode(persistedMode);
  }, [persistedMode]);
  useEffect(() => {
    setDraftInterval(persistedInterval);
  }, [persistedInterval]);

  const dirty =
    draftThreshold !== persistedThreshold || draftMode !== persistedMode || draftInterval !== persistedInterval;

  const thresholdParsed = parseInt(draftThreshold, 10);
  const thresholdValid = Number.isInteger(thresholdParsed) && thresholdParsed >= 0 && thresholdParsed <= 9999;
  const canSave = dirty && thresholdValid && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const nextTelemetry = {
      ...(device.telemetry || {}),
      config: {
        threshold: thresholdParsed,
        reporting_mode: draftMode,
        reporting_interval_min: draftInterval,
      },
    };
    try {
      await updateDevice.mutateAsync({ id: device.id, patch: { telemetry: nextTelemetry } });
    } catch (err) {
      setSaving(false);
      setError(err.message);
      return;
    }
    setSaving(false);
  };

  const discard = () => {
    setDraftThreshold(persistedThreshold);
    setDraftMode(persistedMode);
    setDraftInterval(persistedInterval);
    setError(null);
  };

  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon.cog size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('device.configuration')}</div>
        {dirty && <Pill tone="info">{t('ddp.config.unsaved')}</Pill>}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{t('ddp.config.operator_editable')}</span>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Reporting mode toggle */}
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.18,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              marginBottom: 6,
            }}
          >
            {t('ddp.pcb.cfg.reporting_mode')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { id: 'interval', label: t('ddp.pcb.cfg.interval'), desc: t('ddp.pcb.cfg.interval_desc') },
              { id: 'threshold', label: t('ddp.pcb.cfg.threshold'), desc: t('ddp.pcb.cfg.threshold_desc') },
            ].map((opt) => {
              const active = draftMode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setDraftMode(opt.id)}
                  style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                    color: active ? 'var(--accent)' : 'var(--text-soft)',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                    borderRadius: 7,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{opt.label}</span>
                  <span
                    style={{ fontSize: 10.5, color: active ? 'var(--accent)' : 'var(--text-dim)', lineHeight: 1.35 }}
                  >
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Threshold value */}
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.18,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              marginBottom: 6,
            }}
          >
            {t('ddp.pcb.cfg.threshold_value')}
          </div>
          <input
            type="number"
            min={0}
            max={9999}
            value={draftThreshold}
            onChange={(e) => setDraftThreshold(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              border: `1px solid ${thresholdValid ? 'var(--border)' : 'var(--risk)'}`,
              borderRadius: 7,
              fontSize: 14,
              fontFamily: 'var(--mono)',
              fontWeight: 700,
              outline: 'none',
            }}
          />
          <div
            style={{
              marginTop: 4,
              fontSize: 10.5,
              color: thresholdValid ? 'var(--text-dim)' : 'var(--risk)',
              lineHeight: 1.45,
            }}
          >
            {draftMode === 'threshold'
              ? t('ddp.pcb.cfg.threshold_desc_threshold')
              : t('ddp.pcb.cfg.threshold_desc_interval')}
          </div>
        </div>

        {/* Reporting interval */}
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.18,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              marginBottom: 6,
            }}
          >
            {t('ddp.pcb.cfg.reporting_interval')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
            {REPORTING_INTERVAL_OPTIONS.map((opt) => {
              const active = draftInterval === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setDraftInterval(opt.value)}
                  style={{
                    padding: '8px 10px',
                    textAlign: 'center',
                    background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                    color: active ? 'var(--accent)' : 'var(--text-soft)',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                    borderRadius: 7,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--risk)',
              padding: 8,
              background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
              border: '1px solid color-mix(in oklch, var(--risk) 28%, transparent)',
              borderRadius: 7,
            }}
          >
            {t('ddp.config.save_failed', { err: error })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {dirty && (
            <button
              onClick={discard}
              disabled={saving}
              style={{
                padding: '7px 14px',
                background: 'transparent',
                color: 'var(--text-soft)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: saving ? 'default' : 'pointer',
              }}
            >
              {t('ddp.config.discard')}
            </button>
          )}
          <button
            onClick={save}
            disabled={!canSave}
            style={{
              padding: '7px 14px',
              background: canSave ? 'var(--accent)' : 'var(--surface-2)',
              color: canSave ? '#fff' : 'var(--text-dim)',
              border: canSave ? 'none' : '1px solid var(--border)',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              cursor: canSave ? 'pointer' : 'default',
              opacity: canSave ? 1 : 0.7,
            }}
          >
            {saving
              ? t('ddp.config.saving')
              : !dirty
                ? t('ddp.config.saved')
                : !thresholdValid
                  ? t('ddp.config.fix_threshold')
                  : t('ddp.config.save')}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ───────── Smart Logger Basic — the L-3.4 fleet
//
// 6-button NFC service logger operated by crews (cleaning + security).
// No on-device display, so the right column carries the operator-
// editable Configuration card (scenario + 4 service-button labels)
// — same pattern as PCB but with different knobs.
//
// "Latest session" tile reads from device_service_sessions so the
// panel stays alive between events; the Activity card below it
// shows raw service_started + service_completed events with crew
// names resolved via useCrewByBadge.

function SmartLoggerBasicPanels({ device }) {
  const t = useT();
  const tel = device.telemetry || {};
  const scenario = tel.scenario === 'security' ? 'security' : 'cleaning';
  const statusTone = STATUS_TONE[device.status] || 'info';
  const fwBehind = device.firmware && device.firmware_latest && device.firmware !== device.firmware_latest;

  const { events, loaded: eventsLoaded } = useDeviceEvents(device.id, 80);
  const { messages, loaded: messagesLoaded } = useDeviceMessages(device.id);
  const { sessions } = useDeviceServiceSessions(device.id, 10);
  const crewByBadge = useCrewByBadge();
  const latestSession = sessions[0] || null;
  const [tab, setTab] = useState('overview');

  return (
    <>
      {/* Hero */}
      <Card pad={false} style={{ position: 'relative' }}>
        {/* Phase H-9 fix: previously used overflow: hidden on the Card
            to clip the gradient at the rounded corners, but that also
            clipped tall headers (status pills could fall outside the
            card's content box and disappear). Move the corner-clip to
            the gradient overlay itself via borderRadius: inherit so
            the gradient stays bounded while flow content stays free. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(500px 240px at 90% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)',
            borderRadius: 'inherit',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{ padding: 'var(--pad)', position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 20 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              flexShrink: 0,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon.badge size={26} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: 'var(--text-dim)' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.15, textTransform: 'uppercase' }}>
                {KIND_LABEL[device.kind]} · {device.model || t('ddp.unknown_model')}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)' }}>
              {device.external_id}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-soft)' }}>
              {device.room || '—'} · {t('ddp.floor_label', { n: device.floor ?? '—' })}
            </p>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Pill tone={statusTone}>
                <Dot tone={statusTone} size={5} pulse={device.status === 'online'} />{' '}
                {t(`ddp.status.${device.status}`) || device.status}
              </Pill>
              <Pill tone="info">
                {scenario === 'security' ? t('ddp.scenario.security') : t('ddp.scenario.cleaning')}
              </Pill>
              <Pill tone="off">{t('ddp.sku', { sku: device.sku || '—' })}</Pill>
              {fwBehind && <Pill tone="warn">{t('device.firmware_behind')}</Pill>}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs (Phase H-10): hero stays always-visible; detail cards
          live under Overview / Activity / Hardware / Configuration. */}
      <DeviceTabs
        tabs={[
          { id: 'overview', label: t('ddp.tab.overview') },
          { id: 'activity', label: t('ddp.tab.activity'), sub: events.length || null },
          { id: 'hardware', label: t('ddp.tab.hardware') },
          { id: 'config', label: t('ddp.tab.config') },
          { id: 'messages', label: t('ddp.tab.messages'), sub: messages.length || null },
          { id: 'firmware', label: t('ddp.tab.firmware') },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <SLBTelemetryCard device={device} latestSession={latestSession} crewByBadge={crewByBadge} />
      )}
      {tab === 'activity' && <ActivityCard events={events} loaded={eventsLoaded} />}
      {tab === 'messages' && <DeviceMessagesCard messages={messages} loaded={messagesLoaded} />}
      {tab === 'hardware' && <SLBHardwareCard />}
      {tab === 'config' && <SLBConfigurationCard device={device} />}
      {tab === 'firmware' && <FirmwareCard device={device} />}
    </>
  );
}

function SLBTelemetryCard({ device, latestSession, crewByBadge }) {
  const t = useT();
  const sessionLine = latestSession
    ? formatSessionLine(latestSession, crewByBadge, t)
    : { primary: '—', secondary: t('ddp.slb.no_sessions') };
  return (
    <Card pad={false}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('device.telemetry')}</div>
      </div>
      <div
        style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}
      >
        <Stat
          label={t('ddp.stat.battery')}
          value={device.battery_pct != null ? `${device.battery_pct}%` : '—'}
          hint={
            device.battery_chemistry
              ? t('ddp.battery.hint', {
                  chem: device.battery_chemistry,
                  kind: device.battery_swappable ? t('ddp.battery.swappable') : t('ddp.battery.fixed'),
                })
              : null
          }
          tone={
            device.battery_pct == null
              ? 'off'
              : device.battery_pct < 25
                ? 'risk'
                : device.battery_pct < 50
                  ? 'warn'
                  : 'ok'
          }
        />
        <Stat label={t('ddp.stat.last_seen')} value={relTime(device.last_seen, t)} />
        <Stat
          label={t('ddp.stat.firmware')}
          value={device.firmware || '—'}
          hint={
            device.firmware_latest && device.firmware !== device.firmware_latest
              ? t('ddp.firmware.latest_x', { v: device.firmware_latest })
              : t('ddp.firmware.on_latest')
          }
          tone={device.firmware_latest && device.firmware !== device.firmware_latest ? 'warn' : 'ok'}
        />
        <Stat label={t('ddp.stat.uplink')} value={(device.uplink || '—').toUpperCase()} />
        <Stat label={t('ddp.stat.installed')} value={device.install_date || '—'} />
        <Stat label={t('ddp.stat.latest_session')} value={sessionLine.primary} hint={sessionLine.secondary} />
      </div>
    </Card>
  );
}

function SLBHardwareCard() {
  const t = useT();
  const specs = [
    [t('ddp.hw.row.form_factor'), t('ddp.hw.slb.form_factor')],
    [t('ddp.hw.row.display'), t('ddp.hw.slb.display')],
    [t('ddp.hw.row.input'), t('ddp.hw.slb.input')],
    [t('ddp.hw.row.nfc'), t('ddp.hw.slb.nfc')],
    [t('ddp.hw.row.backhaul'), t('ddp.hw.lte')],
    [t('ddp.hw.row.power'), t('ddp.hw.power_3y')],
    [t('ddp.hw.row.firmware'), t('ddp.hw.slb.firmware')],
  ];
  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon.gateway size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('device.hardware')}</div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{t('ddp.hardware.adaptiv_catalog')}</span>
      </div>
      <div style={{ padding: 12 }}>
        {specs.map(([k, v], i) => (
          <div
            key={k}
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr',
              gap: 12,
              padding: '6px 4px',
              borderBottom: i < specs.length - 1 ? '1px dashed var(--border)' : 'none',
              fontSize: 12,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.1,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
              }}
            >
              {k}
            </div>
            <div style={{ color: 'var(--text-soft)' }}>{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const SLB_DEFAULT_BUTTONS = {
  cleaning: [
    { id: 1, code: 'RESTROOM', label: 'Restroom check' },
    { id: 2, code: 'FLOOR_SWEEP', label: 'Floor sweep' },
    { id: 3, code: 'TRASH', label: 'Trash collection' },
    { id: 4, code: 'DEEP_CLEAN', label: 'Deep clean' },
  ],
  security: [
    { id: 1, code: 'PATROL', label: 'Patrol' },
    { id: 2, code: 'INCIDENT_CHECK', label: 'Incident check' },
    { id: 3, code: 'ESCORT', label: 'Escort' },
    { id: 4, code: 'LOCKUP', label: 'Lockup' },
  ],
};

// Derive a stable simulator-friendly code from a button label so the
// operator only has to think about the human-readable text. Codes feed
// the simulator's payload + the firehose's formatServiceCode lookup.
function deriveServiceCode(label) {
  return (
    String(label || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'BUTTON'
  );
}

function SLBConfigurationCard({ device }) {
  const t = useT();
  const updateDevice = useUpdateDevice();
  const cfg = device.telemetry?.config || {};
  const persistedScenario = device.telemetry?.scenario === 'security' ? 'security' : 'cleaning';
  const persistedButtons =
    Array.isArray(cfg.buttons) && cfg.buttons.length === 4 ? cfg.buttons : SLB_DEFAULT_BUTTONS[persistedScenario];

  const [draftScenario, setDraftScenario] = useState(persistedScenario);
  const [draftLabels, setDraftLabels] = useState(persistedButtons.map((b) => b.label));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDraftScenario(persistedScenario);
  }, [persistedScenario]);
  useEffect(() => {
    setDraftLabels(persistedButtons.map((b) => b.label));
  }, [device.id]);

  const dirty = draftScenario !== persistedScenario || draftLabels.some((l, i) => l !== persistedButtons[i]?.label);

  const labelsValid = draftLabels.every((l) => l && l.trim().length > 0 && l.length <= 40);
  const canSave = dirty && labelsValid && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const nextButtons = draftLabels.map((label, i) => ({
      id: i + 1,
      code: deriveServiceCode(label),
      label,
    }));
    const nextTelemetry = {
      ...(device.telemetry || {}),
      scenario: draftScenario,
      config: {
        ...(device.telemetry?.config || {}),
        buttons: nextButtons,
      },
    };
    try {
      await updateDevice.mutateAsync({ id: device.id, patch: { telemetry: nextTelemetry } });
    } catch (err) {
      setSaving(false);
      setError(err.message);
      return;
    }
    setSaving(false);
  };

  const discard = () => {
    setDraftScenario(persistedScenario);
    setDraftLabels(persistedButtons.map((b) => b.label));
    setError(null);
  };

  // Switching scenario reseeds the draft labels with that scenario's
  // defaults — gives the operator a sensible starting point for the
  // new audience without nuking unsaved work silently.
  const switchScenario = (s) => {
    setDraftScenario(s);
    setDraftLabels(SLB_DEFAULT_BUTTONS[s].map((b) => b.label));
  };

  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon.cog size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('device.configuration')}</div>
        {dirty && <Pill tone="info">{t('ddp.config.unsaved')}</Pill>}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{t('ddp.config.operator_editable')}</span>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Scenario picker */}
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.18,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              marginBottom: 6,
            }}
          >
            {t('ddp.slb.cfg.scenario')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { id: 'cleaning', label: t('ddp.slb.cfg.cleaning'), desc: t('ddp.slb.cfg.cleaning_desc') },
              { id: 'security', label: t('ddp.slb.cfg.security'), desc: t('ddp.slb.cfg.security_desc') },
            ].map((opt) => {
              const active = draftScenario === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => switchScenario(opt.id)}
                  style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                    color: active ? 'var(--accent)' : 'var(--text-soft)',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                    borderRadius: 7,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{opt.label}</span>
                  <span
                    style={{ fontSize: 10.5, color: active ? 'var(--accent)' : 'var(--text-dim)', lineHeight: 1.35 }}
                  >
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Service buttons */}
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.18,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              marginBottom: 6,
            }}
          >
            {t('ddp.slb.cfg.service_buttons')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {draftLabels.map((label, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    flexShrink: 0,
                    background: 'var(--surface-2)',
                    color: 'var(--text-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {idx + 1}
                </div>
                <input
                  type="text"
                  maxLength={40}
                  value={label}
                  onChange={(e) => {
                    const next = draftLabels.slice();
                    next[idx] = e.target.value;
                    setDraftLabels(next);
                  }}
                  placeholder={t('ddp.slb.cfg.button_n_ph', { n: idx + 1 })}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    border: `1px solid ${label && label.trim().length > 0 ? 'var(--border)' : 'var(--risk)'}`,
                    borderRadius: 7,
                    fontSize: 12.5,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {(() => {
              const tmpl = t('ddp.slb.cfg.codes_hint', { code: 'XCODEX' });
              const [pre, post = ''] = tmpl.split('XCODEX');
              return (
                <>
                  {pre}
                  <span style={{ fontFamily: 'var(--mono)' }}>FLOOR_SWEEP</span>
                  {post}
                </>
              );
            })()}
          </div>
        </div>

        {error && (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--risk)',
              padding: 8,
              background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
              border: '1px solid color-mix(in oklch, var(--risk) 28%, transparent)',
              borderRadius: 7,
            }}
          >
            {t('ddp.config.save_failed', { err: error })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {dirty && (
            <button
              onClick={discard}
              disabled={saving}
              style={{
                padding: '7px 14px',
                background: 'transparent',
                color: 'var(--text-soft)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: saving ? 'default' : 'pointer',
              }}
            >
              {t('ddp.config.discard')}
            </button>
          )}
          <button
            onClick={save}
            disabled={!canSave}
            style={{
              padding: '7px 14px',
              background: canSave ? 'var(--accent)' : 'var(--surface-2)',
              color: canSave ? '#fff' : 'var(--text-dim)',
              border: canSave ? 'none' : '1px solid var(--border)',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              cursor: canSave ? 'pointer' : 'default',
              opacity: canSave ? 1 : 0.7,
            }}
          >
            {saving
              ? t('ddp.config.saving')
              : !dirty
                ? t('ddp.config.saved')
                : !labelsValid
                  ? t('ddp.config.fix_labels')
                  : t('ddp.config.save')}
          </button>
        </div>
      </div>
    </Card>
  );
}

// "Latest session" tile content. Open session shows duration so far
// (e.g. "Restroom check · 12m in"); closed session shows the full
// duration (e.g. "Restroom check · 47m"). Crew name resolution uses
// the same useCrewByBadge map the Activity card uses.
function formatSessionLine(session, crewByBadge, t) {
  const code = session?.service_code || '';
  const known = code ? t(`ddp.slb.svc.${code}`) : '';
  const knownLabel =
    known && known !== `ddp.slb.svc.${code}`
      ? known
      : code
        ? code
            .toLowerCase()
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
        : '—';
  const startMs = new Date(session.started_at).getTime();
  const endMs = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  const min = Math.max(0, Math.round((endMs - startMs) / 60000));
  const durationLabel = min < 1 ? t('ddp.slb.session.lt_min') : t('ddp.slb.session.min_suffix', { n: min });
  const crew = crewByBadge?.get?.(session.badge_uid)?.name;
  const primary = `${knownLabel} · ${session.ended_at ? durationLabel : t('ddp.slb.session.in_suffix', { dur: durationLabel })}`;
  const secondary = crew
    ? t('ddp.slb.session.by', { name: crew })
    : session.badge_uid
      ? t('ddp.slb.session.badge', { id: session.badge_uid })
      : null;
  return { primary, secondary };
}

// Compact relative time — same shape as the firehose's, kept here
// to avoid pulling in event-firehose just for one helper.
function relTime(iso, t) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (!t) {
    if (sec < 60) return 'just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    const hr0 = Math.floor(sec / 3600);
    if (hr0 < 48) return `${hr0}h ago`;
    return `${Math.floor(hr0 / 24)}d ago`;
  }
  if (sec < 60) return t('ddp.rel.just_now');
  if (sec < 3600) return t('ddp.rel.min_ago', { n: Math.floor(sec / 60) });
  const hr = Math.floor(sec / 3600);
  if (hr < 48) return t('ddp.rel.hour_ago', { n: hr });
  return t('ddp.rel.day_ago', { n: Math.floor(hr / 24) });
}
