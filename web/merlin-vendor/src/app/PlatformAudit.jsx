// Platform → Audit log (SaaS v1, phase 4).
// Chronological list of every back-office mutation. Reads platform_audit_log
// (RLS-gated to platform admins). Filters by action; expand a row to see
// payload + actor details. Pagination is intentionally absent in v1 —
// volume is low. Add it when the table grows past a few hundred rows.

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { navigateTo } from './use-route.js';
import { useAuditLog, refreshAuditLog, ACTION_LABELS, ACTION_TONES } from './platform-data.js';
import { useT } from './i18n.js';

const ACTION_FILTER_OPTIONS = [
  { id: 'all', labelKey: 'platform.audit.action.all' },
  { id: 'tenant_create', labelKey: 'platform.audit.action.tenant_create' },
  { id: 'tenant_suspend', labelKey: 'platform.audit.action.tenant_suspend' },
  { id: 'tenant_unsuspend', labelKey: 'platform.audit.action.tenant_unsuspend' },
  { id: 'tenant_soft_delete', labelKey: 'platform.audit.action.tenant_soft_delete' },
  { id: 'tenant_update_contact', labelKey: 'platform.audit.action.tenant_update_contact' },
];

export function PlatformAuditPage() {
  const t = useT();
  const { rows, ready } = useAuditLog();
  const [actionFilter, setActionFilter] = useState('all');
  const [expanded, setExpanded] = useState(() => new Set());

  const filtered = useMemo(() => {
    if (actionFilter === 'all') return rows;
    return rows.filter((r) => r.action === actionFilter);
  }, [rows, actionFilter]);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero count={rows.length} onRefresh={() => refreshAuditLog()} />

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
          <label
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}
          >
            {t('platform.audit.action_label')}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{
                padding: '5px 8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {ACTION_FILTER_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {ready
              ? t('platform.audit.count', { n: filtered.length, total: rows.length })
              : t('platform.audit.loading')}
          </div>
        </div>
        {!ready && (
          <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.audit.loading')}</div>
        )}
        {ready && filtered.length === 0 && (
          <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>
            {rows.length === 0 ? t('platform.audit.empty') : t('platform.audit.empty_filter')}
          </div>
        )}
        {ready &&
          filtered.map((row) => (
            <AuditRow key={row.id} row={row} expanded={expanded.has(row.id)} onToggle={() => toggle(row.id)} />
          ))}
      </Card>
    </div>
  );
}

function Hero({ count, onRefresh }) {
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
      <div style={{ padding: 'var(--pad)', position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 700,
            }}
          >
            {t('platform.audit.eyebrow')}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
            {t('platform.audit.title')} <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>· {count}</span>
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>{t('platform.audit.body')}</p>
        </div>
        <button
          onClick={onRefresh}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'var(--surface-2)',
            color: 'var(--text-soft)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Icon.sparkle size={12} />
          {t('platform.audit.refresh')}
        </button>
      </div>
    </Card>
  );
}

function AuditRow({ row, expanded, onToggle }) {
  const t = useT();
  const label = ACTION_LABELS[row.action] || row.action;
  const tone = ACTION_TONES[row.action] || 'neutral';
  const ts = row.createdAt ? new Date(row.createdAt) : null;
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          gap: 12,
          padding: '12px 14px',
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface-2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <div style={{ flex: '0 0 130px', fontSize: 11, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
          {ts ? ts.toLocaleString() : '—'}
        </div>
        <div style={{ flex: '0 0 160px' }}>
          <Pill tone={tone}>{label}</Pill>
        </div>
        <div
          style={{
            flex: '1 1 200px',
            minWidth: 0,
            fontSize: 12.5,
            color: 'var(--text-soft)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.targetOrgId ? (
            <a
              onClick={(e) => {
                e.stopPropagation();
                navigateTo(`/platform/tenants/${row.targetOrgId}`);
              }}
              style={{
                color: 'var(--accent)',
                cursor: 'pointer',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              {row.targetOrgName || row.targetOrgId.slice(0, 8) + '…'}
            </a>
          ) : (
            <span style={{ color: 'var(--text-faint)' }}>—</span>
          )}
          {row.targetOrgSlug && (
            <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 11.5, marginLeft: 6 }}>
              {row.targetOrgSlug}
            </span>
          )}
        </div>
        <div
          style={{
            flex: '0 1 200px',
            fontSize: 12,
            color: 'var(--text-soft)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {t('platform.audit.row.by')}
          <strong style={{ color: 'var(--text)' }}>{row.actorName}</strong>
        </div>
        <Icon.chevD
          size={11}
          style={{
            color: 'var(--text-dim)',
            flexShrink: 0,
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform .12s',
          }}
        />
      </button>
      {expanded && (
        <div
          style={{
            padding: '10px 14px 14px 142px',
            background: 'var(--surface-2)',
            borderTop: '1px solid var(--border)',
            fontSize: 11.5,
            fontFamily: 'var(--mono)',
            color: 'var(--text-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <Detail label={t('platform.audit.row.action_key')}>{row.action}</Detail>
          {row.actorEmail && <Detail label={t('platform.audit.row.actor_email')}>{row.actorEmail}</Detail>}
          {row.targetUserId && <Detail label={t('platform.audit.row.target_user')}>{row.targetUserId}</Detail>}
          <Detail label={t('platform.audit.row.payload')}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, lineHeight: 1.45 }}>
              {Object.keys(row.payload || {}).length === 0 ? '{}' : JSON.stringify(row.payload, null, 2)}
            </pre>
          </Detail>
          <Detail label={t('platform.audit.row.event_id')}>{row.id}</Detail>
        </div>
      )}
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div
        style={{
          flex: '0 0 90px',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          paddingTop: 1,
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
