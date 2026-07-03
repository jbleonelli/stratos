// /platform/marketing/sales — sales-inquiry inbox for the Adaptiv team.
//
// Reads from public.sales_inquiries (migration 125). RLS gates SELECT/
// UPDATE/DELETE to platform admins, so a direct supabase-js read works
// without going through an API endpoint.
//
// Capabilities:
//   - List inquiries newest-first, filtered by status pill
//   - Click a row to see full message + edit status / add note
//   - Mailto reply opens the user's mail client with the inquirer's
//     email pre-filled (single-click follow-up workflow)
//
// Status workflow:
//   new → in_review → contacted → won | lost
//   any → spam (one-way; rows tagged spam are filtered from defaults)

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useSalesInquiries, useUpdateSalesInquiry } from './queries/sales.ts';
import { useT } from './i18n.js';

const STATUS_ORDER = ['new', 'in_review', 'contacted', 'won', 'lost', 'spam'];
const STATUS_TONE = {
  new: 'accent',
  in_review: 'warn',
  contacted: 'neutral',
  won: 'accent',
  lost: 'risk',
  spam: 'risk',
};

export function PlatformSalesPage() {
  const t = useT();
  const { data: rows = [], isLoading: loading, error } = useSalesInquiries();
  const updateMut = useUpdateSalesInquiry();
  const [statusFilter, setStatusFilter] = useState('open'); // 'open' = new+in_review, 'all' = everything, or specific status
  const [selected, setSelected] = useState(null);
  const err = error?.message || updateMut.error?.message || '';

  const counts = useMemo(() => {
    const c = { all: rows.length, open: 0 };
    for (const s of STATUS_ORDER) c[s] = 0;
    for (const r of rows) {
      c[r.status] = (c[r.status] || 0) + 1;
      if (r.status === 'new' || r.status === 'in_review') c.open += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return rows;
    if (statusFilter === 'open') return rows.filter((r) => r.status === 'new' || r.status === 'in_review');
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  return (
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
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{t('platform.sales.title')}</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>{t('platform.sales.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <FilterPill
          label={t('platform.sales.filter.open')}
          count={counts.open}
          active={statusFilter === 'open'}
          onClick={() => setStatusFilter('open')}
        />
        <FilterPill
          label={t('platform.sales.filter.all')}
          count={counts.all}
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        {STATUS_ORDER.map((s) => (
          <FilterPill
            key={s}
            label={t(`platform.sales.status.${s}`)}
            count={counts[s] || 0}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          />
        ))}
      </div>

      {err && (
        <Card>
          <div style={{ color: 'var(--risk)', fontSize: 13 }}>{err}</div>
        </Card>
      )}

      {loading ? (
        <Card>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{t('platform.sales.loading')}</div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{t('platform.sales.empty')}</div>
        </Card>
      ) : (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {filtered.map((r) => (
              <Row key={r.id} row={r} onClick={() => setSelected(r)} t={t} />
            ))}
          </div>
        </Card>
      )}

      {selected && (
        <Detail
          inquiry={selected}
          onClose={() => setSelected(null)}
          onUpdate={async (patch) => {
            try {
              await updateMut.mutateAsync({ id: selected.id, patch });
              setSelected((prev) => ({ ...prev, ...patch }));
            } catch {
              /* surfaced via updateMut.error */
            }
          }}
          t={t}
        />
      )}
    </div>
  );
}

function FilterPill({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 11,
          color: active ? 'var(--accent)' : 'var(--text-faint)',
          background: active ? 'transparent' : 'var(--surface-2)',
          padding: '0 6px',
          borderRadius: 999,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function Row({ row, onClick, t }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '110px minmax(0, 1fr) auto auto',
        gap: 12,
        padding: '10px 4px',
        alignItems: 'center',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <Pill tone={STATUS_TONE[row.status]}>{t(`platform.sales.status.${row.status}`)}</Pill>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{row.company}</div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.contact_name ? `${row.contact_name} · ` : ''}
          {row.email}
          {row.buildings_est != null ? ` · ${row.buildings_est} bldg` : ''}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
        {row.country || ''}
        {row.city ? ` · ${row.city}` : ''}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
        {new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </div>
    </button>
  );
}

function Detail({ inquiry, onClose, onUpdate, t }) {
  const [noteDraft, setNoteDraft] = useState('');
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.2,
              fontWeight: 700,
            }}
          >
            {t('platform.sales.detail.title')}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{inquiry.company}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            {inquiry.contact_name ? `${inquiry.contact_name} · ` : ''}
            <a href={`mailto:${inquiry.email}`} style={{ color: 'var(--accent)' }}>
              {inquiry.email}
            </a>
            {inquiry.phone ? ` · ${inquiry.phone}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            all: 'unset',
            cursor: 'pointer',
            padding: 4,
            color: 'var(--text-dim)',
          }}
        >
          <Icon.close size={14} />
        </button>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 16 }}
      >
        <KV label={t('platform.sales.kv.role')} value={inquiry.role} />
        <KV label={t('platform.sales.kv.vertical')} value={inquiry.vertical} />
        <KV label={t('platform.sales.kv.buildings')} value={inquiry.buildings_est} />
        <KV label={t('platform.sales.kv.source')} value={inquiry.source} />
        <KV label={t('platform.sales.kv.locale')} value={inquiry.locale} />
        <KV
          label={t('platform.sales.kv.location')}
          value={[inquiry.city, inquiry.country].filter(Boolean).join(', ')}
        />
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          background: 'var(--surface-2)',
          borderRadius: 8,
          border: '1px solid var(--border)',
          whiteSpace: 'pre-wrap',
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        {inquiry.message}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginRight: 4 }}>
          {t('platform.sales.detail.status_label')}
        </div>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onUpdate({ status: s })}
            disabled={inquiry.status === s}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid ' + (inquiry.status === s ? 'var(--accent)' : 'var(--border)'),
              background: inquiry.status === s ? 'var(--accent-soft)' : 'transparent',
              color: inquiry.status === s ? 'var(--accent)' : 'var(--text)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: inquiry.status === s ? 'default' : 'pointer',
            }}
          >
            {t(`platform.sales.status.${s}`)}
          </button>
        ))}
      </div>

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
          {t('platform.sales.detail.notes_toggle')}
        </summary>
        <div style={{ marginTop: 8 }}>
          <textarea
            value={noteDraft || JSON.stringify(inquiry.notes || {}, null, 2)}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              fontSize: 12,
              fontFamily: 'var(--mono)',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
          />
          <button
            type="button"
            onClick={() => {
              try {
                const parsed = JSON.parse(noteDraft);
                onUpdate({ notes: parsed });
              } catch {
                // ignore parse error — surface inline would be nicer but
                // this is platform-admin tooling, JSON is fine.
              }
            }}
            style={{
              marginTop: 8,
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'transparent',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {t('platform.sales.detail.save_notes')}
          </button>
        </div>
      </details>
    </Card>
  );
}

function KV({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          letterSpacing: 0.2,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, marginTop: 2 }}>{String(value)}</div>
    </div>
  );
}
