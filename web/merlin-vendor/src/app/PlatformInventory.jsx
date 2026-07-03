// Platform → Devices · Inventory (phase 1a, read-only).
// Stock matrix: rows = SKUs, columns = lifecycle states. Each cell shows
// the count of inventory_devices in that (sku, state). Click a cell to
// jump to the Fleet page filtered to those devices.

import React from 'react';
import { Card, AdaptivLoader } from './primitives.jsx';
import { navigateTo } from './use-route.js';
import { useInventoryRollup } from './devices-platform-data.js';
import { useT } from './i18n.js';

const STATE_LABEL_KEYS = {
  manufactured: 'platform.fleet.state.manufactured',
  received: 'platform.fleet.state.received',
  qc_passed: 'platform.fleet.state.qc_passed',
  firmware_updated: 'platform.fleet.state.firmware_updated',
  configured: 'platform.fleet.state.configured',
  shipped: 'platform.fleet.state.shipped',
  delivered: 'platform.fleet.state.delivered',
  installed: 'platform.fleet.state.installed',
  service: 'platform.fleet.state.service',
  rma_inbound: 'platform.fleet.state.rma_inbound',
  rma_received: 'platform.fleet.state.rma_received',
  refurb: 'platform.fleet.state.refurb',
  decommissioned: 'platform.fleet.state.decommissioned',
};

// Phase grouping for the column header band — gives the eye a roadmap.
const PHASES = [
  {
    id: 'pre_deploy',
    states: ['manufactured', 'received', 'qc_passed', 'firmware_updated'],
    labelKey: 'platform.inventory.phase.pre_deploy',
  },
  { id: 'in_flight', states: ['configured', 'shipped', 'delivered'], labelKey: 'platform.inventory.phase.in_flight' },
  { id: 'live', states: ['installed', 'service'], labelKey: 'platform.inventory.phase.live' },
  {
    id: 'returns',
    states: ['rma_inbound', 'rma_received', 'refurb', 'decommissioned'],
    labelKey: 'platform.inventory.phase.returns',
  },
];

export function PlatformInventoryPage() {
  const t = useT();
  const { matrix, columnTotals, grandTotal, states, ready, error } = useInventoryRollup();

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero total={grandTotal} columnTotals={columnTotals} states={states} />

      <Card pad={false} style={{ overflow: 'auto' }}>
        {!ready && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <AdaptivLoader size="sm" />
          </div>
        )}
        {ready && error && <div style={{ padding: 24, color: 'var(--risk)', fontSize: 12 }}>{error}</div>}
        {ready && !error && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>{t('platform.inventory.col.sku')}</th>
                {PHASES.map((p) => (
                  <th
                    key={p.id}
                    colSpan={p.states.length}
                    style={{
                      ...thStyle,
                      textAlign: 'center',
                      borderLeft: '1px solid var(--border)',
                      background: 'color-mix(in oklch, var(--surface-2) 92%, transparent)',
                    }}
                  >
                    {t(p.labelKey)}
                  </th>
                ))}
                <th style={{ ...thStyle, textAlign: 'right', borderLeft: '1px solid var(--border)' }}>
                  {t('platform.inventory.col.total')}
                </th>
              </tr>
              <tr>
                <th style={subThStyle}></th>
                {states.map((s, i) => {
                  const isPhaseStart = PHASES.some((p) => p.states[0] === s);
                  return (
                    <th
                      key={s}
                      style={{
                        ...subThStyle,
                        borderLeft: isPhaseStart && i > 0 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: 0.1,
                          textTransform: 'uppercase',
                          color: 'var(--text-faint)',
                        }}
                      >
                        {t(STATE_LABEL_KEYS[s] || s)}
                      </span>
                    </th>
                  );
                })}
                <th style={{ ...subThStyle, borderLeft: '1px solid var(--border)' }}></th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{row.name}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--text-dim)' }}>{row.id}</div>
                  </td>
                  {states.map((s, i) => {
                    const n = row.byState[s] || 0;
                    const isPhaseStart = PHASES.some((p) => p.states[0] === s);
                    return (
                      <td
                        key={s}
                        style={{
                          ...tdStyle,
                          textAlign: 'center',
                          borderLeft: isPhaseStart && i > 0 ? '1px solid var(--border)' : 'none',
                          color: n === 0 ? 'var(--text-faint)' : 'var(--text-soft)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {n > 0 ? (
                          <a
                            onClick={() =>
                              navigateTo(
                                `/platform/fleet?sku=${encodeURIComponent(row.id)}&state=${encodeURIComponent(s)}`,
                              )
                            }
                            style={{
                              color: 'var(--accent)',
                              cursor: 'pointer',
                              fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            {n.toLocaleString()}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontWeight: 700,
                      borderLeft: '1px solid var(--border)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {row.total.toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--surface-2)' }}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{t('platform.inventory.total')}</td>
                {states.map((s, i) => {
                  const isPhaseStart = PHASES.some((p) => p.states[0] === s);
                  const n = columnTotals[s] || 0;
                  return (
                    <td
                      key={s}
                      style={{
                        ...tdStyle,
                        textAlign: 'center',
                        fontWeight: 700,
                        borderLeft: isPhaseStart && i > 0 ? '1px solid var(--border)' : 'none',
                        color: n === 0 ? 'var(--text-faint)' : 'var(--text-soft)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {n > 0 ? n.toLocaleString() : '—'}
                    </td>
                  );
                })}
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    fontWeight: 700,
                    borderLeft: '1px solid var(--border)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {grandTotal.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Hero({ total, columnTotals, states }) {
  const t = useT();
  const live = (columnTotals.installed || 0) + (columnTotals.service || 0);
  const inFlight = (columnTotals.configured || 0) + (columnTotals.shipped || 0) + (columnTotals.delivered || 0);
  const preDeploy = states
    .filter((s) => ['manufactured', 'received', 'qc_passed', 'firmware_updated'].includes(s))
    .reduce((acc, s) => acc + (columnTotals[s] || 0), 0);
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
      <div
        style={{
          padding: 'var(--pad)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 700,
            }}
          >
            {t('platform.inventory.eyebrow')}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
            {t('platform.inventory.title')}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>{t('platform.inventory.body')}</p>
        </div>
        <Stat label={t('platform.inventory.stat.pre_deploy')} value={preDeploy.toLocaleString()} />
        <Stat label={t('platform.inventory.stat.in_flight')} value={inFlight.toLocaleString()} />
        <Stat label={t('platform.inventory.stat.live')} value={live.toLocaleString()} />
        <Stat label={t('platform.inventory.stat.total')} value={total.toLocaleString()} />
      </div>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ minWidth: 110 }}>
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

const thStyle = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.15,
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
  background: 'var(--surface-2)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};
const subThStyle = {
  padding: '6px 8px',
  textAlign: 'center',
  background: 'var(--surface-2)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-soft)',
};
