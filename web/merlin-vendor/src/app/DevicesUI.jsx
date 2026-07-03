// Device Management — fleet board, card grid, map view, detail drawer, deployments, reorder
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card, IconBtn, Sparkline } from './primitives.jsx';
import { DEVICE_TYPES, ZONES, DEPLOYMENTS } from './devices-data.js';
import { ECOSYSTEM_ZONES } from './ecosystem-data.js';
import { useT } from './i18n.js';
import { useCurrencySymbol } from './locale-format.js';

const ALL_ZONES_INDEX = (() => {
  const m = new Map();
  [...ZONES, ...ECOSYSTEM_ZONES].forEach((z) => m.set(z.id, z));
  return m;
})();
const zoneShort = (id) => ALL_ZONES_INDEX.get(id)?.short;

// H-5: accepts an explicit `rollouts` array from the caller. Falls back
// to the static DEPLOYMENTS so ecosystem/IMF scenarios (which haven't
// been migrated to DB-backed devices yet) keep their hardcoded rail.
// For the single-building DB path, Devices.jsx passes rollouts derived
// from computeActiveRollouts(fleet).
export function DeploymentsSection({ view = 'rail', rollouts = DEPLOYMENTS }) {
  const t = useT();
  const stageOrder = ['planned', 'shipped', 'installing', 'live'];
  const stageColor = {
    planned: 'var(--text-dim)',
    shipped: 'var(--info)',
    installing: 'var(--warn)',
    live: 'var(--ok)',
  };

  const [shown, setShown] = useState(false);
  const [localView, setLocalView] = useState(view);
  useEffect(() => {
    setLocalView(view);
  }, [view]);
  const activeView = localView;

  // Empty state when the caller passed an empty array (no devices with
  // pending firmware work) — collapse the section entirely rather than
  // render a zero-rollout strip.
  if (!rollouts || rollouts.length === 0) return null;

  return (
    <Card pad={false}>
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: shown ? '1px solid var(--border)' : 'none',
        }}
      >
        <Icon.ship size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('deployments.active_rollouts')}</div>
        <Pill>{rollouts.length}</Pill>
        <div style={{ flex: 1 }} />
        {shown && (
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-3)', padding: 2, borderRadius: 7 }}>
            {[
              ['rail', t('devices.dep.view_timeline')],
              ['list', t('devices.dep.view_cards')],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => {
                  setLocalView(k);
                  try {
                    window.setMerlinTweaks?.({ deployView: k });
                  } catch {}
                }}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  background: activeView === k ? 'var(--accent-soft)' : 'transparent',
                  color: activeView === k ? 'var(--accent)' : 'var(--text-dim)',
                  border: `1px solid ${activeView === k ? 'var(--accent-line)' : 'transparent'}`,
                  borderRadius: 5,
                  cursor: 'pointer',
                }}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setShown((s) => !s)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 9px',
            fontSize: 11,
            fontWeight: 600,
            background: 'var(--surface-2)',
            color: 'var(--text-soft)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'inline-block', width: 8, textAlign: 'center', fontWeight: 700 }}>
            {shown ? '−' : '+'}
          </span>
          {shown ? t('devices.dep.hide') : t('devices.dep.show')}
        </button>
      </div>

      {shown &&
        (activeView === 'rail' ? (
          <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {rollouts.map((d) => {
              const total = Object.values(d.stages).reduce((a, b) => a + b, 0);
              // Derived rollouts don't carry owner/eta — show target firmware
              // + scope instead. Static DEPLOYMENTS keep the old meta.
              const typeShort = DEVICE_TYPES[d.type]?.short || d.type;
              const zoneTxt = zoneShort(d.zone) || t('devices.dep.tower_wide');
              const meta = d.owner
                ? `${typeShort} · ${zoneTxt} · ${d.owner}`
                : d.target
                  ? t('devices.dep.devices_target', { type: typeShort, n: d.total || total, v: d.target })
                  : t('devices.dep.devices_rolling', { type: typeShort, n: d.total || total });
              return (
                <div
                  key={d.id}
                  style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px', gap: 16, alignItems: 'center' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{meta}</div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      height: 10,
                      borderRadius: 5,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {stageOrder.map((stage) => {
                      const n = d.stages[stage] || 0;
                      const pct = (n / total) * 100;
                      return (
                        <div
                          key={stage}
                          title={`${stage}: ${n}`}
                          style={{
                            width: `${pct}%`,
                            background: stageColor[stage],
                            opacity: stage === 'planned' ? 0.25 : 0.85,
                            transition: 'width .3s',
                          }}
                        />
                      );
                    })}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-dim)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{Math.round(d.pct * 100)}%</span>
                    <span>{d.eta ? t('devices.dep.eta', { eta: d.eta }) : t('devices.dep.rolling')}</span>
                  </div>
                </div>
              );
            })}
            <div
              style={{
                display: 'flex',
                gap: 14,
                fontSize: 10.5,
                color: 'var(--text-dim)',
                paddingTop: 4,
                borderTop: '1px dashed var(--border)',
                marginTop: 4,
              }}
            >
              {stageOrder.map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      background: stageColor[s],
                      borderRadius: 2,
                      opacity: s === 'planned' ? 0.4 : 0.9,
                    }}
                  />{' '}
                  {t(`devices.dep.stage.${s}`)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 12,
              padding: 14,
            }}
          >
            {rollouts.map((d) => (
              <div
                key={d.id}
                style={{
                  padding: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{d.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  {d.owner
                    ? t('devices.dep.list_meta', { owner: d.owner, eta: d.eta })
                    : t('devices.dep.list_meta_rolling', {
                        n: d.total || Object.values(d.stages).reduce((a, b) => a + b, 0),
                      })}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, fontSize: 10.5 }}>
                  {stageOrder.map((s) => (
                    <div
                      key={s}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '4px 0',
                        background: 'var(--surface)',
                        border: `1px solid ${stageColor[s]}`,
                        color: stageColor[s],
                        borderRadius: 5,
                        fontWeight: 700,
                      }}
                    >
                      {d.stages[s] || 0}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
    </Card>
  );
}

export function FleetBoard({
  fleet,
  total,
  originFilter = 'all',
  onOriginFilter,
  originCounts,
  typeFilter,
  onTypeFilter,
  installedTypes,
  statusFilter,
  onStatusFilter,
  query,
  onQuery,
  layout,
  onSelect,
  onOpen,
  selectedId,
}) {
  const t = useT();
  const handleOpen = onOpen || onSelect;
  // Cards view: let the card fill the remaining viewport height (its grid
  // scrolls internally) so it reaches the 12px bottom margin instead of capping
  // at a fixed height and leaving a gap. Map view keeps its own sizing.
  const fillStyle =
    layout === 'map' ? undefined : { display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 };
  return (
    <Card pad={false} style={fillStyle}>
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        <Icon.grid size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('devices.fleet')}</div>
        <Pill>
          {fleet.length}
          {fleet.length !== total && <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>&nbsp;/ {total}</span>}
        </Pill>

        {/* Phase H-8: origin pills (Adaptiv vs third-party). Hidden if
            the parent didn't supply counts, e.g. legacy ecosystem
            simulator pages that don't carry origin metadata. */}
        {onOriginFilter && originCounts && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
            <OriginPill active={originFilter === 'all'} onClick={() => onOriginFilter('all')}>
              {t('devices.origin.all', { n: originCounts.all || 0 })}
            </OriginPill>
            <OriginPill active={originFilter === 'adaptiv'} onClick={() => onOriginFilter('adaptiv')}>
              {t('devices.origin.adaptiv', { n: originCounts.adaptiv || 0 })}
            </OriginPill>
            <OriginPill active={originFilter === 'third_party'} onClick={() => onOriginFilter('third_party')}>
              {t('devices.origin.third_party', { n: originCounts.third_party || 0 })}
            </OriginPill>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 7,
          }}
        >
          <Icon.search size={12} style={{ color: 'var(--text-dim)' }} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t('devices.search_ph')}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 12,
              color: 'var(--text)',
              outline: 'none',
              width: 170,
              fontFamily: 'var(--font)',
            }}
          />
        </div>

        <select value={typeFilter} onChange={(e) => onTypeFilter(e.target.value)} style={selectStyle}>
          <option value="all">{t('devices.filter.all_types')}</option>
          {Object.entries(DEVICE_TYPES)
            .filter(([k]) => !installedTypes || installedTypes.has(k))
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
        </select>

        <select value={statusFilter} onChange={(e) => onStatusFilter(e.target.value)} style={selectStyle}>
          <option value="all">{t('devices.filter.all_statuses')}</option>
          <option value="online">{t('status.online')}</option>
          <option value="degraded">{t('status.degraded')}</option>
          <option value="offline">{t('status.offline')}</option>
          <option value="updating">{t('status.updating')}</option>
          <option value="provisioning">{t('status.provisioning')}</option>
        </select>
      </div>

      {layout === 'map' ? (
        <FleetMap fleet={fleet} onSelect={handleOpen} selectedId={selectedId} />
      ) : (
        <FleetCards fleet={fleet} onSelect={handleOpen} selectedId={selectedId} />
      )}
    </Card>
  );
}

const selectStyle = {
  padding: '5px 8px',
  fontSize: 11.5,
  fontWeight: 600,
  background: 'var(--surface-2)',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
};

function OriginPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 600,
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-dim)',
        border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
        borderRadius: 999,
        cursor: 'pointer',
        fontFamily: 'var(--font)',
      }}
    >
      {children}
    </button>
  );
}

function FleetCards({ fleet, onSelect, selectedId }) {
  const t = useT();
  if (fleet.length === 0)
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
        {t('devices.cards.empty')}
      </div>
    );
  return (
    <div
      style={{
        padding: 14,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        // Fill the card (flex-column parent) and scroll internally so the card
        // reaches the bottom margin (was a fixed maxHeight:640 → left a gap).
        gap: 10,
        flex: '1 1 0',
        minHeight: 0,
        overflow: 'auto',
        alignContent: 'start',
      }}
    >
      {fleet.slice(0, 120).map((d) => (
        <DeviceCard key={d.id} device={d} onClick={() => onSelect(d.id)} selected={selectedId === d.id} />
      ))}
      {fleet.length > 120 && (
        <div
          style={{
            gridColumn: '1 / -1',
            padding: 14,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-dim)',
            background: 'var(--surface-2)',
            borderRadius: 8,
            border: '1px dashed var(--border)',
          }}
        >
          {t('devices.cards.showing_n_of_total', { n: fleet.length })}
        </div>
      )}
    </div>
  );
}

function DeviceCard({ device: d, onClick, selected }) {
  const tT = useT();
  const t = DEVICE_TYPES[d.type];
  const IconC = Icon[t.icon] || Icon.gateway;
  const statusTone = { online: 'ok', degraded: 'warn', offline: 'risk', updating: 'info', provisioning: 'accent' }[
    d.status
  ];
  const statusLabel = tT(`devices.card.status.${d.status}`);
  const lastSeen =
    d.last_packet_s == null
      ? '—'
      : d.last_packet_s < 60
        ? tT('devices.card.s_ago', { n: d.last_packet_s })
        : d.last_packet_s < 3600
          ? tT('devices.card.m_ago', { n: Math.round(d.last_packet_s / 60) })
          : tT('devices.card.h_ago', { n: Math.round(d.last_packet_s / 3600) });
  const statusVar =
    statusTone === 'ok' ? 'ok' : statusTone === 'risk' ? 'risk' : statusTone === 'warn' ? 'warn' : 'info';
  // Phase H-8: small label so users can tell at a glance whether the
  // device is Adaptiv-built or a third-party integration. Falls back
  // to 'adaptiv' for legacy types that pre-date the `origin` field.
  const origin = t?.origin || 'adaptiv';
  const manufacturer = t?.manufacturer;

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 12,
        borderRadius: 10,
        cursor: 'pointer',
        background: selected ? 'var(--accent-soft)' : 'var(--surface-2)',
        border: `1px solid ${selected ? 'var(--accent-line)' : 'var(--border)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'border-color .12s, background .12s',
        fontFamily: 'var(--font)',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            flexShrink: 0,
            background: `color-mix(in oklch, var(--${statusVar}) 14%, transparent)`,
            color: `var(--${statusVar})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconC size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>
            {d.id}
          </div>
        </div>
        <Pill tone={statusTone}>
          <Dot tone={statusTone} size={5} pulse={d.status === 'offline'} /> {statusLabel}
        </Pill>
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-soft)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ color: 'var(--text-dim)' }}>{zoneShort(d.zone) || tT('devices.card.fl_n', { n: d.floor })}</span>
        <span style={{ color: 'var(--text-faint)' }}>·</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.location}
        </span>
        <span
          title={
            manufacturer ||
            (origin === 'adaptiv' ? tT('devices.card.origin_adaptiv_full') : tT('devices.card.origin_3rd_full'))
          }
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: 0.1,
            textTransform: 'uppercase',
            padding: '1px 6px',
            borderRadius: 3,
            flexShrink: 0,
            background:
              origin === 'adaptiv' ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'var(--surface-3)',
            color: origin === 'adaptiv' ? 'var(--accent)' : 'var(--text-dim)',
            border: '1px solid ' + (origin === 'adaptiv' ? 'var(--accent-line)' : 'var(--border)'),
          }}
        >
          {origin === 'adaptiv' ? tT('devices.card.origin_adaptiv') : tT('devices.card.origin_3rd')}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          paddingTop: 8,
          borderTop: '1px dashed var(--border)',
        }}
      >
        <Metric
          label={tT('devices.card.signal')}
          value={d.rssi ? `${d.rssi}dBm` : '—'}
          tone={!d.rssi ? 'off' : d.rssi < -85 ? 'warn' : 'ok'}
        />
        {d.battery != null ? (
          <Metric
            label={tT('devices.card.battery')}
            value={`${d.battery}%`}
            tone={d.battery < 20 ? 'risk' : d.battery < 40 ? 'warn' : 'ok'}
          />
        ) : (
          <Metric
            label={tT('devices.card.uptime')}
            value={d.uptime != null ? `${d.uptime}%` : '—'}
            tone={d.uptime == null ? 'off' : d.uptime < 90 ? 'risk' : d.uptime < 97 ? 'warn' : 'ok'}
          />
        )}
        <Metric
          label={tT('devices.card.fw')}
          value={d.firmware || '—'}
          tone={d.fw_updating ? 'info' : d.fw_behind ? 'warn' : 'ok'}
          small
        />
      </div>

      {d.error && (
        <div
          style={{
            padding: '6px 8px',
            fontSize: 11,
            fontFamily: 'var(--mono)',
            background: `color-mix(in oklch, var(--${d.status === 'offline' ? 'risk' : 'warn'}) 10%, transparent)`,
            color: `var(--${d.status === 'offline' ? 'risk' : 'warn'})`,
            border: `1px solid color-mix(in oklch, var(--${d.status === 'offline' ? 'risk' : 'warn'}) 30%, transparent)`,
            borderRadius: 5,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <b>{d.error.code}</b>
          <span style={{ opacity: 0.8 }}>{d.error.msg}</span>
        </div>
      )}

      {d.fw_updating && (
        <div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--info)',
              fontWeight: 600,
              marginBottom: 3,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{tT('devices.card.updating_to', { v: d.fw_latest })}</span>
            <span>{d.fw_progress}%</span>
          </div>
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${d.fw_progress}%`, height: '100%', background: 'var(--info)' }} />
          </div>
        </div>
      )}

      {!d.error && !d.fw_updating && (
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{tT('devices.card.last_packet', { ago: lastSeen })}</span>
          <span>—</span>
        </div>
      )}
    </button>
  );
}

function Metric({ label, value, tone = 'ok', small }) {
  const color = {
    ok: 'var(--text)',
    warn: 'var(--warn)',
    risk: 'var(--risk)',
    info: 'var(--info)',
    off: 'var(--text-dim)',
  }[tone];
  return (
    <div>
      <div
        style={{
          fontSize: 9.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          letterSpacing: 0.1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: small ? 11 : 12,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: small ? 'var(--mono)' : 'var(--font)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FleetMap({ fleet, onSelect, selectedId }) {
  const t = useT();
  const byFloor = useMemo(() => {
    const m = new Map();
    for (let fl = 0; fl <= 50; fl++) m.set(fl, []);
    fleet.forEach((d) => {
      const arr = m.get(d.floor) || [];
      arr.push(d);
      m.set(d.floor, arr);
    });
    return m;
  }, [fleet]);

  const maxPerFloor = useMemo(() => {
    let max = 1;
    byFloor.forEach((arr) => {
      if (arr.length > max) max = arr.length;
    });
    return max;
  }, [byFloor]);

  const floors = Array.from({ length: 51 }, (_, i) => 50 - i);

  return (
    <div
      style={{
        padding: 16,
        display: 'grid',
        gridTemplateColumns: '1fr 260px',
        gap: 16,
        background: 'var(--surface-2)',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '14px 16px 14px 54px',
          position: 'relative',
          maxHeight: 640,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--text-dim)',
            fontWeight: 700,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Meridian HQ · 245 Bryant St, San Francisco
        </div>

        {floors.map((fl) => {
          const devs = byFloor.get(fl) || [];
          if (devs.length === 0 && fl > 0 && fl < 50) {
            return <FloorRow key={fl} fl={fl} empty />;
          }
          const worst = devs.some((d) => d.status === 'offline')
            ? 'risk'
            : devs.some((d) => d.status === 'degraded')
              ? 'warn'
              : devs.some((d) => d.status === 'updating')
                ? 'info'
                : 'ok';
          const widthPct = Math.max(8, (devs.length / maxPerFloor) * 100);
          return (
            <FloorRow
              key={fl}
              fl={fl}
              devs={devs}
              worst={worst}
              widthPct={widthPct}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            {t('devices.map.legend')}
          </div>
          {[
            { k: 'online', label: t('status.online'), tone: 'ok' },
            { k: 'degraded', label: t('status.degraded'), tone: 'warn' },
            { k: 'offline', label: t('status.offline'), tone: 'risk' },
            { k: 'updating', label: t('status.updating'), tone: 'info' },
          ].map((l) => (
            <div
              key={l.k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11.5,
                color: 'var(--text-soft)',
                padding: '3px 0',
              }}
            >
              <Dot tone={l.tone} size={7} /> {l.label}
            </div>
          ))}
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px dashed var(--border)',
            }}
          >
            {t('devices.map.legend_hint')}
          </div>
        </div>

        <div style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            {t('devices.map.tower_summary')}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-soft)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row k={t('devices.map.total_devices')} v={<b>{fleet.length}</b>} />
            <Row
              k={t('devices.map.floors_with_issues')}
              v={
                <b>
                  {
                    Array.from(byFloor.values()).filter((arr) =>
                      arr.some((d) => d.status === 'offline' || d.status === 'degraded'),
                    ).length
                  }
                </b>
              }
            />
            <Row
              k={t('devices.map.most_populated')}
              v={
                <b>
                  {t('devices.map.floor_n', {
                    n: (() => {
                      let best = 1,
                        bestN = 0;
                      byFloor.forEach((arr, fl) => {
                        if (fl > 0 && fl < 50 && arr.length > bestN) {
                          bestN = arr.length;
                          best = fl;
                        }
                      });
                      return best;
                    })(),
                  })}
                </b>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FloorRow({ fl, devs = [], worst, widthPct = 0, empty, onSelect, selectedId }) {
  const t = useT();
  const label = fl === 0 ? t('devices.map.floor_g') : fl === 50 ? t('devices.map.floor_roof', { n: 50 }) : `${fl}`;
  const isSpecial = fl === 0 || fl === 50;
  const worstVar = worst === 'ok' ? 'ok' : worst === 'risk' ? 'risk' : worst === 'warn' ? 'warn' : 'info';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: empty ? 14 : 22,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: -46,
          width: 40,
          textAlign: 'right',
          fontSize: 10,
          color: isSpecial ? 'var(--accent)' : 'var(--text-dim)',
          fontFamily: 'var(--mono)',
          fontWeight: isSpecial ? 700 : 500,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>

      {empty ? (
        <div style={{ width: '100%', height: 1, borderTop: '1px dashed var(--border)', opacity: 0.6 }} />
      ) : (
        <div
          style={{
            width: `${widthPct}%`,
            minWidth: 60,
            height: 20,
            borderRadius: 4,
            background: `color-mix(in oklch, var(--${worstVar}) 14%, var(--surface-2))`,
            border: `1px solid color-mix(in oklch, var(--${worstVar}) 35%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '0 4px',
            overflow: 'hidden',
          }}
        >
          {devs.slice(0, 24).map((d) => {
            const tone = { online: 'ok', degraded: 'warn', offline: 'risk', updating: 'info', provisioning: 'accent' }[
              d.status
            ];
            const toneVar = tone === 'ok' ? 'ok' : tone === 'risk' ? 'risk' : tone === 'warn' ? 'warn' : 'info';
            const isSel = selectedId === d.id;
            return (
              <button
                key={d.id}
                onClick={() => onSelect(d.id)}
                title={`${d.id} · ${d.location} · ${d.status}`}
                style={{
                  width: 10,
                  height: 12,
                  borderRadius: 2,
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  background: `var(--${toneVar})`,
                  outline: isSel ? '2px solid var(--accent)' : 'none',
                  outlineOffset: 1,
                  flexShrink: 0,
                }}
              />
            );
          })}
          {devs.length > 24 && (
            <span style={{ fontSize: 9.5, color: 'var(--text-dim)', fontWeight: 700, marginLeft: 4 }}>
              +{devs.length - 24}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function DeviceDetailDrawer({ device, onClose, onAskMerlin, onReorder }) {
  const tT = useT();
  if (!device) return null;
  const t = DEVICE_TYPES[device.type];
  const IconC = Icon[t.icon] || Icon.gateway;
  const tone = { online: 'ok', degraded: 'warn', offline: 'risk', updating: 'info', provisioning: 'accent' }[
    device.status
  ];
  const toneVar = tone === 'ok' ? 'ok' : tone === 'risk' ? 'risk' : tone === 'warn' ? 'warn' : 'info';

  const stream = [420, 480, 510, 560, 540, 600, 620, 580, 610, 640, 600, 590, 650, 680];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.12)',
          zIndex: 40,
          animation: 'merlinFadeIn .12s ease-out',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 440,
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 30px rgba(0,0,0,0.10)',
          zIndex: 41,
          display: 'flex',
          flexDirection: 'column',
          animation: 'merlinSlideIn .18s ease-out',
          fontFamily: 'var(--font)',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: `color-mix(in oklch, var(--${toneVar}) 14%, transparent)`,
              color: `var(--${toneVar})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconC size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{t.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{device.id}</div>
          </div>
          <IconBtn onClick={onClose} title={tT('action.close')}>
            <Icon.close size={13} />
          </IconBtn>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: `color-mix(in oklch, var(--${toneVar}) 10%, transparent)`,
              border: `1px solid color-mix(in oklch, var(--${toneVar}) 28%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Dot tone={tone} pulse={device.status === 'offline'} />
            <div style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>
              <div
                style={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.12,
                  fontSize: 10.5,
                  color: `var(--${toneVar})`,
                }}
              >
                {device.status}
              </div>
              {device.error ? (
                <>
                  {device.error.code} · {device.error.msg}
                </>
              ) : (
                tT('devices.drawer.all_nominal', { loc: device.location })
              )}
            </div>
          </div>

          <Section label={tT('devices.drawer.live_stream')}>
            <div
              style={{
                padding: 12,
                background: 'var(--surface-2)',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  marginBottom: 4,
                }}
              >
                <span>{tT('devices.drawer.bytes_per_sec')}</span>
                <span style={{ color: 'var(--text)', fontWeight: 700 }}>—</span>
              </div>
              <Sparkline data={stream} w={400} h={40} />
              <div
                style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 10, fontSize: 11 }}
              >
                <KV
                  label={tT('devices.drawer.last_packet')}
                  value={tT('devices.drawer.s_ago_value', { n: device.last_packet_s })}
                />
                <KV label={tT('devices.drawer.enclosure_temp')} value={device.temp_c ? `${device.temp_c}°C` : '—'} />
              </div>
            </div>
          </Section>

          <Section label={tT('devices.drawer.connectivity')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <StatTile
                icon="wifi"
                label={tT('devices.drawer.signal_rssi')}
                value={device.rssi ? `${device.rssi} dBm` : tT('devices.drawer.no_link')}
                tone={!device.rssi ? 'risk' : device.rssi < -85 ? 'warn' : 'ok'}
              />
              <StatTile
                icon="sla"
                label={tT('devices.drawer.uptime_30d')}
                value={device.uptime != null ? `${device.uptime}%` : '—'}
                tone={device.uptime == null ? 'off' : device.uptime < 90 ? 'risk' : device.uptime < 97 ? 'warn' : 'ok'}
              />
              {device.battery != null && (
                <StatTile
                  icon="battery"
                  label={tT('devices.drawer.battery')}
                  value={`${device.battery}%`}
                  tone={device.battery < 20 ? 'risk' : device.battery < 40 ? 'warn' : 'ok'}
                  sub={tT('devices.drawer.battery_remaining', { n: device.battery_days_remaining })}
                />
              )}
              <StatTile
                icon="building"
                label={tT('devices.drawer.location')}
                value={device.location}
                sub={device.room}
              />
            </div>
          </Section>

          <Section label={tT('devices.drawer.firmware')}>
            <div
              style={{
                padding: 12,
                background: 'var(--surface-2)',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: 'var(--text-dim)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.1,
                    }}
                  >
                    {tT('devices.drawer.current')}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)' }}>{device.firmware}</div>
                </div>
                {device.fw_behind && (
                  <>
                    <Icon.chevR size={12} style={{ color: 'var(--text-dim)' }} />
                    <div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: 'var(--text-dim)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.1,
                        }}
                      >
                        {tT('devices.drawer.available')}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--info)' }}>
                        {device.fw_latest}
                      </div>
                    </div>
                  </>
                )}
                <div style={{ flex: 1 }} />
                {device.fw_updating ? (
                  <Pill tone="info">
                    <Dot tone="info" size={5} pulse /> {tT('devices.drawer.updating_pct', { n: device.fw_progress })}
                  </Pill>
                ) : device.fw_behind ? (
                  <button style={btnPrimary}>{tT('devices.drawer.update_now')}</button>
                ) : (
                  <Pill tone="ok">{tT('devices.drawer.up_to_date')}</Pill>
                )}
              </div>
            </div>
          </Section>

          <Section label={tT('devices.drawer.identity')}>
            <div style={{ fontSize: 11.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <KV label={tT('devices.drawer.sku')} value={t.sku} mono />
              <KV label={tT('devices.drawer.installed')} value={device.install_date} />
              <KV label={tT('devices.drawer.type')} value={t.desc} wide />
            </div>
          </Section>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              paddingTop: 6,
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              onClick={() =>
                onAskMerlin?.(
                  tT('devices.drawer.diagnose_prompt', {
                    id: device.id,
                    issue: device.error ? device.error.msg : device.status,
                  }),
                )
              }
              style={btnPrimary}
            >
              <Icon.sparkle size={12} /> {tT('devices.drawer.ask_diagnose')}
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button style={btnGhost}>
                <Icon.reload size={11} /> {tT('devices.drawer.restart')}
              </button>
              <button onClick={onReorder} style={btnGhost}>
                <Icon.cart size={11} /> {tT('devices.drawer.reorder')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function KV({ label, value, mono, wide }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : 'auto' }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-dim)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text)',
          fontFamily: mono ? 'var(--mono)' : 'var(--font)',
          fontWeight: mono ? 500 : 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, tone = 'ok', sub }) {
  const IconC = Icon[icon] || Icon.sla;
  const color = { ok: 'var(--ok)', warn: 'var(--warn)', risk: 'var(--risk)', info: 'var(--info)' }[tone];
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10.5,
          color: 'var(--text-dim)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.1,
        }}
      >
        <IconC size={11} /> {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  );
}

const btnPrimary = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '8px 12px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
};
const btnGhost = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '7px 10px',
  background: 'var(--surface-2)',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
};

export function ReorderPanel({ device, onClose }) {
  const tT = useT();
  const cur = useCurrencySymbol();
  const [step, setStep] = useState('cart');
  const [qty, setQty] = useState(1);
  const [shipping, setShipping] = useState('standard');

  useEffect(() => {
    if (device) {
      setStep('cart');
      setQty(1);
      setShipping('standard');
    }
  }, [device?.id]);

  if (!device) return null;
  const t = DEVICE_TYPES[device.type];
  const unitPrice =
    { display_touch: 389, display_eink: 229, airq: 149, occupancy: 89, camera: 429, badge: 219, leak: 59, beacon: 32 }[
      device.type
    ] || 199;
  const shipCost = { standard: 0, expedited: 45, overnight: 120 }[shipping];
  const shipEta = tT(`devices.reorder.eta_full.${shipping}`);
  const total = qty * unitPrice + shipCost;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 60,
          animation: 'merlinFadeIn .12s ease-out',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 460,
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 30px rgba(0,0,0,0.12)',
          zIndex: 61,
          display: 'flex',
          flexDirection: 'column',
          animation: 'merlinSlideIn .18s ease-out',
          fontFamily: 'var(--font)',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Icon.cart size={14} style={{ color: 'var(--accent)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{tT('reorder.title')}</div>
          {/* uses existing reorder.title key */}
          <div style={{ flex: 1 }} />
          <IconBtn onClick={onClose}>
            <Icon.close size={13} />
          </IconBtn>
        </div>

        <div
          style={{
            display: 'flex',
            padding: '8px 16px',
            borderBottom: '1px solid var(--border)',
            gap: 4,
            fontSize: 10.5,
            color: 'var(--text-dim)',
          }}
        >
          {['cart', 'shipping', 'confirm', 'done'].map((s, i, arr) => (
            <React.Fragment key={s}>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  background:
                    step === s ? 'var(--accent)' : arr.indexOf(step) > i ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: step === s ? '#fff' : arr.indexOf(step) > i ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.1,
                }}
              >
                {i + 1}. {tT(`devices.reorder.step.${s}`)}
              </span>
              {i < arr.length - 1 && <span style={{ alignSelf: 'center', color: 'var(--text-faint)' }}>›</span>}
            </React.Fragment>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {step === 'cart' && (
            <>
              <Section label={tT('devices.reorder.replacement_for')}>
                <div
                  style={{
                    padding: 10,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {React.createElement(Icon[t.icon] || Icon.gateway, { size: 16 })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{device.id}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {device.location} · {device.room}
                    </div>
                  </div>
                  <Pill tone={device.status === 'offline' ? 'risk' : 'warn'}>{device.status}</Pill>
                </div>
              </Section>

              <Section label={tT('devices.reorder.item')}>
                <div
                  style={{
                    padding: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, var(--accent-soft), var(--surface))',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)',
                      }}
                    >
                      {React.createElement(Icon[t.icon] || Icon.gateway, { size: 28 })}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{t.sku}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-soft)', marginTop: 4 }}>{t.desc}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>${unitPrice}</div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px dashed var(--border)',
                    }}
                  >
                    <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 600 }}>
                      {tT('devices.reorder.quantity')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => setQty(Math.max(1, qty - 1))} style={qtyBtn}>
                        −
                      </button>
                      <div style={{ minWidth: 32, textAlign: 'center', fontWeight: 700 }}>{qty}</div>
                      <button onClick={() => setQty(qty + 1)} style={qtyBtn}>
                        +
                      </button>
                    </div>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {tT('devices.reorder.preconfigured')}
                    </span>
                  </div>
                </div>
              </Section>

              <Section label={tT('devices.reorder.merlin_recommends')}>
                <div
                  style={{
                    padding: 10,
                    background: 'color-mix(in oklch, var(--accent) 8%, var(--surface))',
                    border: '1px solid var(--accent-line)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--text-soft)',
                  }}
                >
                  <b style={{ color: 'var(--accent)' }}>{tT('devices.reorder.recommend_pre')}</b>
                  {tT('devices.reorder.recommend_post', { label: t.label })}
                </div>
              </Section>
            </>
          )}

          {step === 'shipping' && (
            <>
              <Section label={tT('devices.reorder.ship_to')}>
                <div
                  style={{
                    padding: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{tT('devices.reorder.dock')}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>
                    {tT('devices.reorder.attn')}
                  </div>
                  <button style={{ ...btnGhost, marginTop: 10, fontSize: 11 }}>
                    {tT('devices.reorder.change_address')}
                  </button>
                </div>
              </Section>

              <Section label={tT('devices.reorder.shipping_method')}>
                {[
                  {
                    id: 'standard',
                    label: tT('devices.reorder.opt.standard'),
                    price: 0,
                    eta: tT('devices.reorder.eta.standard'),
                  },
                  {
                    id: 'expedited',
                    label: tT('devices.reorder.opt.expedited'),
                    price: 45,
                    eta: tT('devices.reorder.eta.expedited'),
                  },
                  {
                    id: 'overnight',
                    label: tT('devices.reorder.opt.overnight'),
                    price: 120,
                    eta: tT('devices.reorder.eta.overnight'),
                  },
                ].map((o) => (
                  <label
                    key={o.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      background: shipping === o.id ? 'var(--accent-soft)' : 'var(--surface-2)',
                      border: `1px solid ${shipping === o.id ? 'var(--accent-line)' : 'var(--border)'}`,
                      borderRadius: 7,
                      cursor: 'pointer',
                      marginBottom: 6,
                    }}
                  >
                    <input
                      type="radio"
                      checked={shipping === o.id}
                      onChange={() => setShipping(o.id)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{o.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{o.eta}</div>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {o.price ? `${cur}${o.price}` : tT('devices.reorder.free')}
                    </div>
                  </label>
                ))}
              </Section>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Section label={tT('devices.reorder.summary')}>
                <div
                  style={{
                    padding: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                  }}
                >
                  <Row k={tT('devices.reorder.summary_line', { qty, label: t.label })} v={`${cur}${qty * unitPrice}`} />
                  <Row
                    k={tT('devices.reorder.shipping')}
                    v={shipCost ? `${cur}${shipCost}` : tT('devices.reorder.free')}
                    sub={shipEta}
                  />
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                    <Row
                      k={<span style={{ fontWeight: 700, fontSize: 13 }}>{tT('devices.reorder.total')}</span>}
                      v={
                        <span style={{ fontWeight: 700, fontSize: 14 }}>
                          {cur}
                          {total}
                        </span>
                      }
                    />
                  </div>
                </div>
              </Section>

              <Section label={tT('devices.reorder.billing')}>
                <div
                  style={{
                    padding: 10,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                >
                  {tT('devices.reorder.billing_pre')}
                  <b>{tT('devices.reorder.billing_id')}</b>
                  {tT('devices.reorder.billing_post')}
                </div>
              </Section>
            </>
          )}

          {step === 'done' && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  margin: '0 auto 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon.check size={28} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{tT('devices.reorder.confirmed')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 6 }}>
                {tT('devices.reorder.confirmed_pre')}
                <b>{tT('devices.reorder.confirmed_id')}</b>
                {tT('devices.reorder.confirmed_post')}
                <br />
                {tT('devices.reorder.arriving_pre')}
                <b>{shipEta}</b>
                {tT('devices.reorder.arriving_post')}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-dim)',
                  marginTop: 14,
                  padding: 10,
                  background: 'var(--surface-2)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}
              >
                {tT('devices.reorder.handoff_note')}
              </div>
            </div>
          )}
        </div>

        {step !== 'done' && (
          <div
            style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-dim)' }}>
              {tT('devices.reorder.total_label')}{' '}
              <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14 }}>${total}</span>
            </div>
            {step !== 'cart' && (
              <button onClick={() => setStep(step === 'confirm' ? 'shipping' : 'cart')} style={btnGhost}>
                {tT('devices.reorder.back')}
              </button>
            )}
            <button
              onClick={() => setStep(step === 'cart' ? 'shipping' : step === 'shipping' ? 'confirm' : 'done')}
              style={btnPrimary}
            >
              {step === 'confirm' ? tT('devices.reorder.place_order') : tT('devices.reorder.continue')} →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Row({ k, v, sub }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '5px 0',
        fontSize: 12.5,
      }}
    >
      <div>
        <div>{k}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div>{v}</div>
    </div>
  );
}

const qtyBtn = {
  width: 24,
  height: 24,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text-soft)',
  padding: 0,
};
