// Device detail view — telemetry / per-type panel sub-components.
// Extracted from DeviceView.jsx (Phase 3 god-file decomposition). Each exported
// component is rendered by DeviceView's tab dispatch; Lte*/BleAggregatorCard are
// module-local helpers. Depends only on leaf primitives + i18n + UI atoms.
import React from 'react';
import { Icon } from './icons.jsx';
import { Dot, Card } from './primitives.jsx';
import { useT } from './i18n.js';
import { SectionTitle, KV, RatingBars, ActivityRow } from './device-view-primitives.jsx';

// Duplicated tiny pure helper (kept local to avoid a parent<->child import cycle;
// identical to the copy in DeviceView.jsx).
function deviceSeedFor(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return Math.abs(h);
}

export function AirQualityReadings({ telemetry }) {
  const t = useT();
  const series = [
    { key: 'tvoc', label: t('dv.aqr.tvoc'), color: 'var(--warn)', max: 800 },
    { key: 'co2', label: t('dv.aqr.co2'), color: 'var(--info)', max: 2000 },
    { key: 'pm', label: t('dv.aqr.pm'), color: 'var(--accent)', max: 30 },
    { key: 'humid', label: t('dv.aqr.humidity'), color: 'var(--ok)', max: 100 },
    { key: 'temp', label: t('dv.aqr.temp'), color: 'var(--risk)', max: 30 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      {series.map((s) => {
        const values = telemetry.airq24h.map((p) => p[s.key]);
        const maxV = Math.max(...values);
        return (
          <Card key={s.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {t('dv.aqr.now')}{' '}
                <b style={{ color: s.color, fontFamily: 'var(--mono)' }}>{values[values.length - 1]}</b> ·{' '}
                {t('dv.aqr.peak_24h')} <b style={{ fontFamily: 'var(--mono)' }}>{maxV}</b>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 2, height: 60, marginTop: 10, alignItems: 'flex-end' }}>
              {values.map((v, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${(v / s.max) * 100}%`,
                    minHeight: 2,
                    background: s.color,
                    opacity: 0.7,
                    borderRadius: 2,
                  }}
                />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function LeakEvents() {
  const t = useT();
  return (
    <Card>
      <SectionTitle icon="droplet" title={t('dv.leak.title')} sub={t('dv.leak.sub')} />
      <div
        style={{
          marginTop: 12,
          padding: 24,
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontSize: 12.5,
          background: 'var(--surface-2)',
          borderRadius: 8,
          border: '1px dashed var(--border)',
        }}
      >
        {t('dv.leak.empty_pre')}
        <b style={{ color: 'var(--ok)', fontFamily: 'var(--mono)' }}>{t('dv.leak.empty_value')}</b>
      </div>
    </Card>
  );
}
export function BeaconMovement({ device }) {
  const t = useT();
  return (
    <Card>
      <SectionTitle icon="beacon" title={t('dv.bea.title')} sub={t('dv.bea.sub')} />
      <div
        style={{
          marginTop: 12,
          padding: 32,
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontSize: 12.5,
          background: 'var(--surface-2)',
          borderRadius: 8,
          border: '1px dashed var(--border)',
        }}
      >
        {t('dv.bea.last_pre')}
        <b>{t('dv.bea.floor_room', { floor: device.floor, room: device.location })}</b>
        <br />
        {t('dv.bea.heatmap')}
      </div>
    </Card>
  );
}
export function OccupancyPatterns() {
  const t = useT();
  return (
    <Card>
      <SectionTitle icon="people" title={t('dv.occ.title')} sub={t('dv.occ.sub')} />
      <div
        style={{
          marginTop: 12,
          padding: 32,
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontSize: 12.5,
          background: 'var(--surface-2)',
          borderRadius: 8,
          border: '1px dashed var(--border)',
        }}
      >
        {t('dv.occ.placeholder')}
      </div>
    </Card>
  );
}
export function CameraFeed() {
  const t = useT();
  return (
    <Card>
      <SectionTitle icon="camera" title={t('dv.cam.title')} sub={t('dv.cam.sub')} />
      <div
        style={{
          marginTop: 12,
          aspectRatio: '16/9',
          background: '#0b0f1a',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 12.5,
        }}
      >
        {t('dv.cam.placeholder')}
      </div>
    </Card>
  );
}
export function BadgeAccess() {
  const t = useT();
  return (
    <Card>
      <SectionTitle icon="badge" title={t('dv.bdg.title')} />
      <div
        style={{
          marginTop: 12,
          padding: 32,
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontSize: 12.5,
          background: 'var(--surface-2)',
          borderRadius: 8,
          border: '1px dashed var(--border)',
        }}
      >
        {t('dv.bdg.placeholder')}
      </div>
    </Card>
  );
}

export function DeviceFeedback({ telemetry }) {
  const t = useT();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--pad)' }}>
      <Card>
        <SectionTitle icon="check" title={t('dv.fb.overall')} sub={t('dv.fb.overall_sub')} />
        <div style={{ textAlign: 'center', padding: '18px 0 8px' }}>
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -0.02, color: 'var(--accent)' }}>
            {telemetry.avgRating}
          </div>
          <div style={{ fontSize: 18, color: 'var(--warn)', marginTop: -4 }}>★★★★☆</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            {t('dv.fb.ratings_count', { n: telemetry.ratingTotal })}
          </div>
        </div>
        <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10, marginTop: 4 }}>
          <RatingBars ratings={telemetry.ratings} total={telemetry.ratingTotal} />
        </div>
      </Card>
      <Card>
        <SectionTitle icon="bell" title={t('dv.fb.triggers')} sub={t('dv.fb.triggers_sub')} />
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6, fontSize: 12 }}>
          <thead>
            <tr
              style={{
                textAlign: 'left',
                color: 'var(--text-dim)',
                fontSize: 10.5,
                textTransform: 'uppercase',
                letterSpacing: 0.12,
                fontWeight: 700,
              }}
            >
              <th style={{ padding: '8px 6px' }}>{t('dv.fb.col.time')}</th>
              <th style={{ padding: '8px 6px' }}>{t('dv.fb.col.rating')}</th>
              <th style={{ padding: '8px 6px' }}>{t('dv.fb.col.action')}</th>
              <th style={{ padding: '8px 6px' }}>{t('dv.fb.col.response')}</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                t: t('dv.fb.t.12m'),
                rating: 2,
                color: 'risk',
                action: t('dv.fb.act.maria'),
                resp: t('dv.fb.resp.eta'),
              },
              {
                t: t('dv.fb.t.2h'),
                rating: 3,
                color: 'warn',
                action: t('dv.fb.act.sweep'),
                resp: t('dv.fb.resp.pulled'),
              },
              {
                t: t('dv.fb.t.4h'),
                rating: 5,
                color: 'ok',
                action: t('dv.fb.act.logged_pos'),
                resp: t('dv.fb.resp.dash'),
              },
              { t: t('dv.fb.t.6h'), rating: 4, color: 'ok', action: t('dv.fb.act.logged'), resp: t('dv.fb.resp.dash') },
              {
                t: t('dv.fb.t.9h'),
                rating: 2,
                color: 'risk',
                action: t('dv.fb.act.priya'),
                resp: t('dv.fb.resp.resolved'),
              },
              {
                t: t('dv.fb.t.yesterday'),
                rating: 5,
                color: 'ok',
                action: t('dv.fb.act.logged'),
                resp: t('dv.fb.resp.dash'),
              },
              {
                t: t('dv.fb.t.yesterday'),
                rating: 1,
                color: 'risk',
                action: t('dv.fb.act.escalated'),
                resp: t('dv.fb.resp.audited'),
              },
            ].map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 6px', color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                  {r.t}
                </td>
                <td style={{ padding: '10px 6px' }}>
                  <span style={{ color: `var(--${r.color})`, fontWeight: 700 }}>{r.rating}★</span>
                </td>
                <td style={{ padding: '10px 6px' }}>{r.action}</td>
                <td style={{ padding: '10px 6px', color: 'var(--text-dim)' }}>{r.resp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function DeviceCleaningLog({ telemetry }) {
  const t = useT();
  return (
    <Card>
      <SectionTitle icon="shield" title={t('dv.cln.title')} sub={t('dv.cln.sub')} />
      <div style={{ marginTop: 12 }}>
        {telemetry.cleanLog.map((c, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 180px 180px',
              gap: 12,
              padding: '12px 8px',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
              {c.end}
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.crew}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                {t('dv.cln.duration', { m: c.durationMin })} ·{' '}
                {c.incidentClosed ? (
                  <>
                    {t('dv.cln.closed_pre')}
                    <b style={{ color: 'var(--warn)' }}>{c.incidentClosed}</b>
                  </>
                ) : (
                  t('dv.cln.routine')
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
              <Dot tone="ok" size={6} />
              <span>{t('dv.cln.nfc_in')}</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-soft)' }}>{c.start}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
              <Dot tone="ok" size={6} />
              <span>{t('dv.cln.nfc_out')}</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-soft)' }}>{c.end}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DeviceButtonEvents({ telemetry }) {
  const t = useT();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--pad)' }}>
      <Card>
        <SectionTitle icon="bell" title={t('dv.btnev.taxonomy')} sub={t('dv.btnev.taxonomy_sub')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {[
            { label: t('dv.btnev.lbl.need_clean'), icon: 'supply', tone: 'warn', count: 3 },
            { label: t('dv.btnev.lbl.tp_low'), icon: 'supply', tone: 'warn', count: 2 },
            { label: t('dv.btnev.lbl.soap'), icon: 'supply', tone: 'warn', count: 1 },
            { label: t('dv.btnev.lbl.leak'), icon: 'warn', tone: 'risk', count: 1 },
            { label: t('dv.btnev.lbl.4star'), icon: 'check', tone: 'ok', count: 18 },
          ].map((b, i) => {
            const IconC = Icon[b.icon] || Icon.bell;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  background: 'var(--surface-2)',
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    flexShrink: 0,
                    background: `color-mix(in oklch, var(--${b.tone}) 16%, transparent)`,
                    color: `var(--${b.tone})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconC size={13} />
                </div>
                <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{b.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontWeight: 700 }}>
                  {b.count}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <SectionTitle icon="bell" title={t('dv.btnev.stream')} sub={t('dv.btnev.stream_sub')} />
        <div style={{ marginTop: 6 }}>
          {telemetry.buttonEvents.map((e, i) => (
            <ActivityRow key={i} e={e} last={i === telemetry.buttonEvents.length - 1} wide />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function DeviceSignals({ device }) {
  const t = useT();
  const isDisplay = device.type === 'display_touch' || device.type === 'display_eink';
  const isLteOnly = device.type === 'display_sdg' || device.type === 'pc_counter';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--pad)' }}>
      {isDisplay ? (
        <>
          <LteSignalCard lte={device.lte} />
          <BleAggregatorCard device={device} />
        </>
      ) : isLteOnly ? (
        <LteSignalCard lte={device.lte} />
      ) : (
        <Card>
          <SectionTitle icon="gateway" title={t('dv.sig.uplink_ble')} sub={t('dv.sig.uplink_ble_sub')} />
          <KV k={t('dv.sig.kv.aggregator')} v={device.aggregator_id || '\u2014'} tone="info" />
          <KV k={t('dv.sig.kv.ble_version')} v={t('dv.sig.kv.ble_version_value')} />
          <KV k={t('dv.sig.kv.tx_interval')} v={t('dv.sig.kv.tx_interval_value')} />
          <KV
            k={t('dv.sig.kv.rssi')}
            v={device.rssi ? `${device.rssi} dBm` : '\u2014'}
            tone={(device.rssi || 0) > -85 ? 'ok' : 'warn'}
          />
          <KV k={t('dv.sig.kv.path_loss')} v={device.rssi ? `${Math.abs(device.rssi) - 40} dB` : '\u2014'} />
          <KV k={t('dv.sig.kv.advertising')} v={t('dv.sig.kv.advertising_value')} last />
        </Card>
      )}

      <Card style={isDisplay ? { gridColumn: '1 / -1' } : {}}>
        <SectionTitle icon="bolt" title={t('dv.sig.power')} />
        <KV k={t('dv.sig.kv.power_source')} v={t('dv.sig.kv.power_value')} tone="info" />
        <KV k={t('dv.sig.kv.chemistry')} v={device.battery_chemistry || '\u2014'} />
        <KV
          k={t('dv.sig.kv.battery')}
          v={device.battery != null ? `${device.battery}%` : '\u2014'}
          tone={(device.battery ?? 100) < 20 ? 'risk' : (device.battery ?? 100) < 40 ? 'warn' : 'ok'}
        />
        <KV
          k={t('dv.sig.kv.remaining')}
          v={
            device.battery_days_remaining != null
              ? t('dv.sig.kv.remaining_value', { n: device.battery_days_remaining })
              : '\u2014'
          }
          tone={(device.battery_days_remaining ?? 999) < 14 ? 'warn' : 'ok'}
        />
        <KV
          k={t('dv.sig.kv.swappable')}
          v={device.battery_swappable ? t('dv.sig.kv.swappable_yes') : t('dv.sig.kv.swappable_no')}
        />
        <KV
          k={t('dv.sig.kv.temperature')}
          v={
            device.temp_c != null
              ? `${device.temp_c} \u00b0C`
              : device.embedded?.temp_c != null
                ? `${device.embedded.temp_c} \u00b0C`
                : '\u2014'
          }
          tone="ok"
        />
        <KV k={t('dv.sig.kv.os')} v={t('dv.sig.kv.os_value')} last />
      </Card>

      <Card style={{ gridColumn: '1 / -1' }}>
        <SectionTitle icon="sla" title={t('dv.sig.uptime_90d')} sub={t('dv.sig.uptime_90d_sub')} />
        <div style={{ display: 'flex', gap: 2, height: 24, marginTop: 10 }}>
          {Array.from({ length: 90 }, (_, i) => {
            const r = (deviceSeedFor(device.id + i) % 100) / 100;
            const s = r < 0.015 ? 'risk' : r < 0.05 ? 'warn' : 'ok';
            return (
              <div
                key={i}
                style={{ flex: 1, borderRadius: 2, background: `color-mix(in oklch, var(--${s}) 70%, transparent)` }}
              />
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── LTE uplink card (displays only) ───
function LteSignalCard({ lte }) {
  const t = useT();
  if (!lte) return null;
  const rsrpTone = lte.rsrp == null ? 'risk' : lte.rsrp > -85 ? 'ok' : lte.rsrp > -100 ? 'warn' : 'risk';
  const sinrTone = lte.sinr == null ? 'risk' : lte.sinr > 10 ? 'ok' : lte.sinr > 0 ? 'warn' : 'risk';
  const rsrqTone = lte.rsrq == null ? 'risk' : lte.rsrq > -10 ? 'ok' : lte.rsrq > -15 ? 'warn' : 'risk';
  return (
    <Card>
      <SectionTitle icon="wifi" title={t('dv.lte.title')} sub={t('dv.lte.sub')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '12px 0' }}>
        <LteMetric
          label="RSRP"
          value={lte.rsrp != null ? `${lte.rsrp} dBm` : '\u2014'}
          tone={rsrpTone}
          scale={lte.rsrp != null ? Math.max(0, Math.min(100, ((lte.rsrp + 115) / 45) * 100)) : 0}
        />
        <LteMetric
          label="RSRQ"
          value={lte.rsrq != null ? `${lte.rsrq} dB` : '\u2014'}
          tone={rsrqTone}
          scale={lte.rsrq != null ? Math.max(0, Math.min(100, ((lte.rsrq + 20) / 17) * 100)) : 0}
        />
        <LteMetric
          label="SINR"
          value={lte.sinr != null ? `${lte.sinr} dB` : '\u2014'}
          tone={sinrTone}
          scale={lte.sinr != null ? Math.max(0, Math.min(100, ((lte.sinr + 5) / 30) * 100)) : 0}
        />
      </div>
      <KV k={t('dv.lte.kv.carrier')} v={lte.carrier} tone="info" />
      <KV k={t('dv.lte.kv.tech')} v={lte.tech} />
      <KV k={t('dv.lte.kv.band')} v={lte.band} />
      <KV k={t('dv.lte.kv.apn')} v={lte.apn} />
      <KV k={t('dv.lte.kv.ip')} v={lte.ip || t('dv.lte.kv.ip_disconnected')} tone={lte.online ? 'ok' : 'risk'} />
      <KV k={t('dv.lte.kv.cell_id')} v={lte.cell_id || '\u2014'} />
      <KV k={t('dv.lte.kv.tac')} v={lte.tac || '\u2014'} />
      <KV k={t('dv.lte.kv.imei')} v={lte.imei} />
      <KV k={t('dv.lte.kv.iccid')} v={lte.iccid} />
      <KV
        k={t('dv.lte.kv.data_mtd')}
        v={t('dv.lte.kv.data_mtd_value', { mb: lte.data_mb_mtd })}
        tone={lte.data_mb_mtd > 40 ? 'warn' : 'ok'}
      />
      <KV
        k={t('dv.lte.kv.last_connect')}
        v={
          lte.last_connect_s < 60
            ? t('dv.lte.kv.s_ago', { n: lte.last_connect_s })
            : lte.last_connect_s < 3600
              ? t('dv.lte.kv.m_ago', { n: Math.round(lte.last_connect_s / 60) })
              : t('dv.lte.kv.h_ago', { n: Math.round(lte.last_connect_s / 3600) })
        }
        tone={lte.online ? 'ok' : 'risk'}
        last
      />
    </Card>
  );
}

function LteMetric({ label, value, tone, scale }) {
  return (
    <div style={{ padding: 10, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-dim)',
          fontWeight: 700,
          letterSpacing: 0.12,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: `var(--${tone})`, marginTop: 2, fontFamily: 'var(--mono)' }}>
        {value}
      </div>
      <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${scale}%`, background: `var(--${tone})`, transition: 'width .3s' }} />
      </div>
    </div>
  );
}

// ─── BLE aggregator card (displays only) ───
function BleAggregatorCard({ device }) {
  const t = useT();
  return (
    <Card>
      <SectionTitle icon="gateway" title={t('dv.ble.title')} sub={t('dv.ble.sub')} />
      <KV k={t('dv.ble.kv.role')} v={t('dv.ble.kv.role_value')} tone="info" />
      <KV k={t('dv.ble.kv.version')} v={t('dv.ble.kv.version_value')} />
      <KV k={t('dv.ble.kv.scan')} v={t('dv.ble.kv.scan_value')} />
      <KV k={t('dv.ble.kv.relay')} v={t('dv.ble.kv.relay_value')} />
      <KV k={t('dv.ble.kv.children')} v={device.ble_children || 0} tone="info" />
      <KV k={t('dv.ble.kv.hop')} v={t('dv.ble.kv.hop_value')} last />
    </Card>
  );
}
