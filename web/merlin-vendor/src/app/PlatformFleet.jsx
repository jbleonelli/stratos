// Platform → Devices · Fleet (phase 1a, read-only).
// Every Adaptiv-built device, in any state, in one paginated table.
// Search by serial; filter by state and SKU. Querystring drives state +
// SKU filters so Inventory page cells deep-link in.

import React, { useEffect, useState } from 'react';
import { Card, Pill } from './primitives.jsx';
import { Icon } from './icons.jsx';
import { useDeviceCatalog, useFleet } from './devices-platform-data.js';
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

const STATE_TONES = {
  manufactured: 'neutral',
  received: 'info',
  qc_passed: 'info',
  firmware_updated: 'info',
  configured: 'accent',
  shipped: 'accent',
  delivered: 'accent',
  installed: 'ok',
  service: 'warn',
  rma_inbound: 'warn',
  rma_received: 'warn',
  refurb: 'warn',
  decommissioned: 'risk',
};

const ALL_STATES = Object.keys(STATE_LABEL_KEYS);
const PAGE_SIZE = 100;

export function PlatformFleetPage() {
  const t = useT();
  const initial = readQuery();
  const [stateFilter, setStateFilter] = useState(initial.state || '');
  const [skuFilter, setSkuFilter] = useState(initial.sku || '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Reflect filters into the URL so deep links work.
  useEffect(() => {
    const params = new URLSearchParams();
    if (stateFilter) params.set('state', stateFilter);
    if (skuFilter) params.set('sku', skuFilter);
    const next = '/platform/fleet' + (params.toString() ? `?${params.toString()}` : '');
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState({}, '', next);
    }
  }, [stateFilter, skuFilter]);

  const { skus } = useDeviceCatalog();
  const { rows, ready, error } = useFleet({
    state: stateFilter || null,
    skuId: skuFilter || null,
    search,
  });

  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero total={rows.length} ready={ready} />

      <Card pad={false}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}
        >
          <Search
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder={t('platform.fleet.search_placeholder')}
          />
          <Select
            value={stateFilter}
            onChange={(v) => {
              setStateFilter(v);
              setPage(0);
            }}
          >
            <option value="">{t('platform.fleet.filter.all_states')}</option>
            {ALL_STATES.map((s) => (
              <option key={s} value={s}>
                {t(STATE_LABEL_KEYS[s])}
              </option>
            ))}
          </Select>
          <Select
            value={skuFilter}
            onChange={(v) => {
              setSkuFilter(v);
              setPage(0);
            }}
          >
            <option value="">{t('platform.fleet.filter.all_skus')}</option>
            {skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {ready ? t('platform.fleet.count', { n: rows.length.toLocaleString() }) : t('platform.fleet.loading')}
          </div>
        </div>

        {ready && error && <div style={{ padding: 24, color: 'var(--risk)', fontSize: 12 }}>{error}</div>}
        {ready && !error && rows.length === 0 && (
          <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.fleet.empty')}</div>
        )}
        {ready && !error && rows.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(140px, 200px) minmax(180px, 240px) minmax(110px, 130px) minmax(180px, 1fr) minmax(140px, 180px)',
              fontSize: 12,
            }}
          >
            <Header>{t('platform.fleet.col.serial')}</Header>
            <Header>{t('platform.fleet.col.sku')}</Header>
            <Header>{t('platform.fleet.col.state')}</Header>
            <Header>{t('platform.fleet.col.assigned_org')}</Header>
            <Header>{t('platform.fleet.col.last_transition')}</Header>
            {visible.map((r, i) => (
              <React.Fragment key={r.id}>
                <Cell first={i === 0} mono>
                  {r.serial}
                </Cell>
                <Cell first={i === 0}>
                  <div>{r.sku_name}</div>
                  {r.sku_family && <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{r.sku_family}</div>}
                </Cell>
                <Cell first={i === 0}>
                  <Pill tone={STATE_TONES[r.state] || 'neutral'}>{t(STATE_LABEL_KEYS[r.state] || r.state)}</Pill>
                </Cell>
                <Cell first={i === 0}>{r.org_name || <span style={{ color: 'var(--text-faint)' }}>—</span>}</Cell>
                <Cell first={i === 0} mono>
                  {formatLastTransition(r)}
                </Cell>
              </React.Fragment>
            ))}
          </div>
        )}

        {ready && rows.length > PAGE_SIZE && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}
      </Card>
    </div>
  );
}

function Hero({ total, ready }) {
  const t = useT();
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
      <div style={{ padding: 'var(--pad)', position: 'relative' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            fontWeight: 700,
          }}
        >
          {t('platform.fleet.eyebrow')}
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
          {t('platform.fleet.title')}{' '}
          <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>· {ready ? total.toLocaleString() : '…'}</span>
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>{t('platform.fleet.body')}</p>
      </div>
    </Card>
  );
}

function Search({ value, onChange, placeholder }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        minWidth: 240,
      }}
    >
      <Icon.search size={12} style={{ color: 'var(--text-dim)' }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          color: 'var(--text)',
          fontSize: 12,
          outline: 'none',
        }}
      />
    </div>
  );
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '5px 8px',
        border: '1px solid var(--border)',
        background: 'var(--surface-2)',
        color: 'var(--text)',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </select>
  );
}

function Pagination({ page, totalPages, onPage }) {
  const t = useT();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderTop: '1px solid var(--border)',
      }}
    >
      <button disabled={page === 0} onClick={() => onPage(page - 1)} style={pagerBtn(page === 0)}>
        ← {t('platform.fleet.prev')}
      </button>
      <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
        {t('platform.fleet.page_of', { p: page + 1, total: totalPages })}
      </span>
      <button
        disabled={page >= totalPages - 1}
        onClick={() => onPage(page + 1)}
        style={pagerBtn(page >= totalPages - 1)}
      >
        {t('platform.fleet.next')} →
      </button>
    </div>
  );
}

function pagerBtn(disabled) {
  return {
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    background: disabled ? 'transparent' : 'var(--surface-2)',
    color: disabled ? 'var(--text-faint)' : 'var(--text-soft)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function Header({ children }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.15,
        textTransform: 'uppercase',
        color: 'var(--text-faint)',
        background: 'var(--surface-2)',
      }}
    >
      {children}
    </div>
  );
}

function Cell({ children, mono, first }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: first ? 'none' : '1px solid var(--border)',
        color: 'var(--text-soft)',
        fontFamily: mono ? 'var(--mono)' : undefined,
        fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
}

function formatLastTransition(r) {
  // Pick the latest non-null transition timestamp.
  const candidates = [
    ['decommissioned_at', r.decommissioned_at],
    ['installed_at', r.installed_at],
    ['delivered_at', r.delivered_at],
    ['shipped_at', r.shipped_at],
    ['configured_at', r.configured_at],
    ['firmware_updated_at', r.firmware_updated_at],
    ['qc_passed_at', r.qc_passed_at],
    ['received_at', r.received_at],
    ['manufactured_at', r.manufactured_at],
  ].filter(([, v]) => v);
  if (candidates.length === 0) return '—';
  const ts = new Date(candidates[0][1]);
  return ts.toLocaleDateString();
}

function readQuery() {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  return { state: p.get('state'), sku: p.get('sku') };
}
