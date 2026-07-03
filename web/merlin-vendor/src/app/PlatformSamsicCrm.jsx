// Platform → SAMSIC CRM — Notion-mirrored deal pipeline.
//
// Inline-editable view of public.sales_crm_samsic (migration 153).
// 15-min cron + Sync-now button keep us aligned with Notion (still
// the source of truth). Seven columns are editable inline (Status,
// Priorité, Montant, Pilot Samsic, Date butoir, Date relance,
// Commentaire); the rest stay read-only — click the row title to
// open the Notion page for those.
//
// File-attachment columns (Devis / Facture / Bon cmd / etc.) render
// as small clickable icons that hit /api/notion/file/<pageId>?prop=
// to fetch a fresh signed URL — Notion's signed URLs expire ~hourly,
// so the proxy refreshes on demand.
//
// Conflict handling: each row carries its own notion_last_edited_at
// baseline. Saves send that baseline as expected_last_edited_at; if
// Notion was touched from elsewhere since load, the server returns
// 409 + the live row, and the UI surfaces a "edited in Notion since
// you loaded" banner with refresh / override actions.

import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import {
  useSamsicCrm,
  useNotionUsers,
  useSamsicSav,
  syncSamsicCrmNow,
  updateSamsicCell,
  resolveProxiedFileUrl,
  SAMSIC_STATUS_TONES,
  SAMSIC_PRIORITY_TONES,
  SAMSIC_SAV_STATUS_TONES,
  SAMSIC_STATUS_OPTIONS,
  SAMSIC_PRIORITY_OPTIONS,
} from './platform-data.js';

const FILE_PROPS = [
  { col: 'devis_file', label: 'Devis', prop: 'Devis' },
  { col: 'samsic_order_file', label: 'Bon cmd', prop: 'Bon cmd SAMSIC' },
  { col: 'invoice_file', label: 'Facture', prop: 'Facture' },
  { col: 'colissimo_delivery_file', label: 'BL', prop: 'Bon De Livraison(Colissimo)' },
  { col: 'colissimo_shipment_file', label: 'Expéd.', prop: 'Expédi(Colissimo)' },
  { col: 'setup_xls_file', label: 'Param.', prop: 'Paramétrage (.xls)' },
  { col: 'qrcodes_xls_file', label: 'QR', prop: 'QR Codes(.xls)' },
  { col: 'platine_file', label: 'Platine', prop: 'Platine' },
];

function fmtEuro(n) {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `€${Math.round(n)}`;
  }
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '—';
  }
}

function relSync(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

export function PlatformSamsicCrmPage() {
  const { rows, ready, error, refresh, patchRow } = useSamsicCrm();
  const { byId: usersById } = useNotionUsers();
  const { bySamsicId: savBySamsic } = useSamsicSav();
  const [detailRowId, setDetailRowId] = useState(null);
  const detailRow = useMemo(() => rows.find((r) => r.id === detailRowId) || null, [rows, detailRowId]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'notion_last_edited_at', dir: 'desc' });
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  const filtered = useMemo(() => {
    let list = rows.slice();
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          (r.site_name || '').toLowerCase().includes(q) ||
          (r.samsic_pilot_name || '').toLowerCase().includes(q) ||
          (r.email || '').toLowerCase().includes(q) ||
          (r.comment || '').toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rows, statusFilter, search, sort]);

  const counts = useMemo(() => {
    const out = { all: rows.length, Lead: 0, Qualified: 0, Proposal: 0, Closed: 0, SWITCH: 0, Lost: 0, AO: 0 };
    for (const r of rows) if (r.status && out[r.status] != null) out[r.status] += 1;
    return out;
  }, [rows]);

  const totalAmount = useMemo(() => filtered.reduce((s, r) => s + (Number(r.amount_eur) || 0), 0), [filtered]);

  const onSyncNow = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await syncSamsicCrmNow();
      setSyncMsg(`Synced ${r.upserted} of ${r.fetched} rows${r.errors ? ` · ${r.errors} errors` : ''}`);
      await refresh();
    } catch (e) {
      setSyncMsg(`Sync failed: ${e.message || e}`);
    } finally {
      setSyncing(false);
    }
  };

  const setSortKey = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  return (
    <div style={{ padding: '20px 28px 32px', overflowY: 'auto' }}>
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: 'var(--text-dim)',
            letterSpacing: 0.14,
            textTransform: 'uppercase',
          }}
        >
          Sales · SAMSIC CRM
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.01 }}>SAMSIC CRM</h1>
          <Pill tone="info">{rows.length} rows</Pill>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {ready ? `Last synced ${relSync(rows[0]?.synced_at)}` : 'Loading…'}
          </span>
          <button
            onClick={onSyncNow}
            disabled={syncing}
            style={{
              padding: '6px 12px',
              background: syncing ? 'var(--surface-2)' : 'var(--accent)',
              color: syncing ? 'var(--text-dim)' : '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: syncing ? 'default' : 'pointer',
            }}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-soft)', maxWidth: 720, lineHeight: 1.55 }}>
          Mirror of the SAMSIC CRM Notion database, refreshed every 15 minutes. Click a row to open it in Notion —
          editing happens there. Inline editing arrives in a follow-up.
        </p>
      </div>

      {syncMsg && (
        <div
          style={{
            margin: '8px 0 12px',
            padding: 10,
            fontSize: 12,
            borderRadius: 6,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-soft)',
          }}
        >
          {syncMsg}
        </div>
      )}
      {error && (
        <div
          style={{
            margin: '8px 0 12px',
            padding: 10,
            fontSize: 12,
            borderRadius: 6,
            background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
            border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
            color: 'var(--risk)',
          }}
        >
          {error}
        </div>
      )}

      {/* Filter strip — status pills + search + total amount */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
          All · {counts.all}
        </FilterPill>
        {['Lead', 'Qualified', 'Proposal', 'Closed', 'SWITCH', 'Lost', 'AO'].map(
          (s) =>
            counts[s] > 0 && (
              <FilterPill
                key={s}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
                tone={SAMSIC_STATUS_TONES[s]}
              >
                {s} · {counts[s]}
              </FilterPill>
            ),
        )}
        <div style={{ flex: 1 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search site / pilot / email / comment"
          style={{
            padding: '6px 10px',
            fontSize: 12,
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--surface-2)',
            color: 'var(--text)',
            width: 280,
            outline: 'none',
          }}
        />
        <Pill tone="accent">{fmtEuro(totalAmount)}</Pill>
      </div>

      <Card pad={false}>
        {!ready ? (
          <div style={{ padding: 24, fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
            No rows. {rows.length === 0 && 'Click Sync now to pull from Notion.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <ThSort sort={sort} k="site_name" onClick={setSortKey}>
                    Site
                  </ThSort>
                  <ThSort sort={sort} k="status" onClick={setSortKey}>
                    Status
                  </ThSort>
                  <Th>Priority</Th>
                  <ThSort sort={sort} k="amount_eur" onClick={setSortKey} right>
                    Amount
                  </ThSort>
                  <ThSort sort={sort} k="lead_user_id" onClick={setSortKey}>
                    Lead
                  </ThSort>
                  <ThSort sort={sort} k="samsic_pilot_name" onClick={setSortKey}>
                    Pilot Samsic
                  </ThSort>
                  <ThSort sort={sort} k="deadline_at" onClick={setSortKey}>
                    Deadline
                  </ThSort>
                  <ThSort sort={sort} k="followup_at" onClick={setSortKey}>
                    Followup
                  </ThSort>
                  <Th>SAV</Th>
                  <Th>Files</Th>
                  <ThSort sort={sort} k="notion_last_edited_at" onClick={setSortKey}>
                    Edited
                  </ThSort>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <SamsicRow
                    key={r.id}
                    row={r}
                    patchRow={patchRow}
                    usersById={usersById}
                    savs={savBySamsic[String(r.notion_page_id).replace(/-/g, '')] || []}
                    onOpenDetail={() => setDetailRowId(r.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detailRow && (
        <SamsicDetailDrawer
          row={detailRow}
          usersById={usersById}
          savs={savBySamsic[String(detailRow.notion_page_id).replace(/-/g, '')] || []}
          patchRow={patchRow}
          onClose={() => setDetailRowId(null)}
        />
      )}
    </div>
  );
}

function SamsicRow({ row, patchRow, usersById, savs, onOpenDetail }) {
  const [conflict, setConflict] = useState(null); // { current_last_edited_at, row } when a save 409s

  // Single save path used by every editable cell. Threads
  // expected_last_edited_at and surfaces conflicts up to the row
  // banner. On success, splice the freshly-upserted row into local
  // state via patchRow. On non-conflict failure, throw so cell
  // controls can re-show the old value + error indicator.
  const save = async (column, value) => {
    try {
      const body = await updateSamsicCell({
        page_id: row.notion_page_id,
        column,
        value,
        expected_last_edited_at: row.notion_last_edited_at || null,
      });
      patchRow(body.row);
      setConflict(null);
    } catch (e) {
      if (e?.code === 'conflict') {
        setConflict({ current_last_edited_at: e.current_last_edited_at, row: e.row });
        if (e.row) patchRow(e.row); // refresh the row to the live values so the next save baselines against fresh state
        return;
      }
      throw e;
    }
  };

  return (
    <>
      <tr style={{ borderBottom: conflict ? 'none' : '1px solid var(--border)' }}>
        <td style={{ padding: '8px 10px', maxWidth: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={onOpenDetail}
              title="Open details"
              style={{
                flex: 1,
                minWidth: 0,
                padding: 0,
                background: 'transparent',
                border: 'none',
                color: 'var(--text)',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font)',
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.site_name || '—'}
            </button>
            <a
              href={row.notion_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open in Notion"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                borderRadius: 3,
                color: 'var(--text-dim)',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              <Icon.bolt size={10} />
            </a>
          </div>
          {row.email && (
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{row.email}</div>
          )}
          <CommentLine value={row.comment} onSave={(v) => save('comment', v)} />
        </td>
        <td style={{ padding: '8px 10px' }}>
          <StatusCell value={row.status} onSave={(v) => save('status', v)} />
        </td>
        <td style={{ padding: '8px 10px' }}>
          <PrioritiesCell values={row.priorities || []} onSave={(v) => save('priorities', v)} />
        </td>
        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>
          <AmountCell value={row.amount_eur} onSave={(v) => save('amount_eur', v)} />
        </td>
        <td style={{ padding: '8px 10px' }}>
          <LeadCell userId={row.lead_user_id} usersById={usersById} />
        </td>
        <td style={{ padding: '8px 10px', maxWidth: 160 }}>
          <TextCell value={row.samsic_pilot_name} placeholder="—" onSave={(v) => save('samsic_pilot_name', v)} />
        </td>
        <td style={{ padding: '8px 10px' }}>
          <DateCell value={row.deadline_at} onSave={(v) => save('deadline_at', v)} />
        </td>
        <td style={{ padding: '8px 10px' }}>
          <DateCell value={row.followup_at} onSave={(v) => save('followup_at', v)} />
        </td>
        <td style={{ padding: '8px 10px' }}>
          <SavCell savs={savs} />
        </td>
        <td style={{ padding: '8px 10px' }}>
          <FileChips row={row} />
        </td>
        <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)', color: 'var(--text-dim)', fontSize: 11 }}>
          {relSync(row.notion_last_edited_at)}
        </td>
      </tr>
      {conflict && (
        <tr
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'color-mix(in oklch, var(--warn) 6%, transparent)',
          }}
        >
          <td
            colSpan={11}
            style={{
              padding: '6px 10px',
              fontSize: 11.5,
              color: 'var(--warn)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Icon.warn size={12} />
            <span>
              This row was edited in Notion since you loaded it. The latest values are now shown — your last edit was
              not applied. Retry to overwrite.
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setConflict(null)}
              style={{
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 600,
                background: 'transparent',
                color: 'var(--warn)',
                border: '1px solid color-mix(in oklch, var(--warn) 30%, transparent)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

// ────────────────────── Editable cell components ──────────────────────
//
// Each cell follows the same pattern: a display element that switches
// to an editor on click, autofocuses, and saves on Enter / blur. While
// saving, the cell shows a subtle loading state; on error, it reverts
// to the previous value and surfaces a small error indicator the
// caller can ignore (per-cell errors are usually transient — the row
// banner covers structural conflicts).

function CellShell({ children, editing, saving, onClick, title }) {
  return (
    <div
      onClick={editing || saving ? undefined : onClick}
      title={title}
      style={{
        cursor: editing || saving ? 'default' : 'text',
        opacity: saving ? 0.5 : 1,
        minHeight: 22,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  );
}

function StatusCell({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const onChange = async (next) => {
    if (next === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next || null);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };
  if (editing) {
    return (
      <select
        autoFocus
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        onBlur={() => setEditing(false)}
        disabled={saving}
        style={selectStyle}
      >
        <option value="">—</option>
        {SAMSIC_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  }
  return (
    <CellShell editing={false} saving={saving} onClick={() => setEditing(true)} title="Click to edit">
      {value ? (
        <Pill tone={SAMSIC_STATUS_TONES[value] || 'neutral'}>{value}</Pill>
      ) : (
        <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: 11.5 }}>set status…</span>
      )}
    </CellShell>
  );
}

function PrioritiesCell({ values, onSave }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const popRef = useRef(null);
  // Close on outside click while editing.
  useEffect(() => {
    if (!editing) return;
    const onDown = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setEditing(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [editing]);

  const toggle = async (opt) => {
    const next = values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt];
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <CellShell editing={editing} saving={saving} onClick={() => setEditing(true)} title="Click to edit">
        {values.length === 0 ? (
          <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: 11.5 }}>add tags…</span>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {values.map((p) => (
              <Pill key={p} tone={SAMSIC_PRIORITY_TONES[p] || 'neutral'}>
                {p}
              </Pill>
            ))}
          </div>
        )}
      </CellShell>
      {editing && (
        <div
          ref={popRef}
          style={{
            position: 'absolute',
            zIndex: 10,
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 180,
            padding: 8,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {SAMSIC_PRIORITY_OPTIONS.map((opt) => {
            const active = values.includes(opt);
            return (
              <label
                key={opt}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer' }}
              >
                <input type="checkbox" checked={active} onChange={() => toggle(opt)} disabled={saving} />
                <Pill tone={SAMSIC_PRIORITY_TONES[opt] || 'neutral'}>{opt}</Pill>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AmountCell({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDraft(value == null ? '' : String(value));
  }, [value]);
  const commit = async () => {
    const trimmed = draft.trim();
    const next = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && !Number.isFinite(next)) {
      setDraft(value == null ? '' : String(value));
      setEditing(false);
      return;
    }
    if (next === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
    } catch {
      setDraft(value == null ? '' : String(value));
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        disabled={saving}
        style={{ ...inputStyle, width: 100, textAlign: 'right', fontFamily: 'var(--mono)' }}
      />
    );
  }
  return (
    <CellShell editing={false} saving={saving} onClick={() => setEditing(true)} title="Click to edit">
      <span style={{ width: '100%', textAlign: 'right' }}>{fmtEuro(value)}</span>
    </CellShell>
  );
}

function TextCell({ value, placeholder, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDraft(value || '');
  }, [value]);
  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed === (value || '').trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed || null);
    } catch {
      setDraft(value || '');
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        disabled={saving}
        style={inputStyle}
      />
    );
  }
  return (
    <CellShell editing={false} saving={saving} onClick={() => setEditing(true)} title="Click to edit">
      <span
        style={{
          color: value ? 'var(--text-soft)' : 'var(--text-dim)',
          fontStyle: value ? 'normal' : 'italic',
          fontSize: value ? 12 : 11.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        {value || placeholder}
      </span>
    </CellShell>
  );
}

function DateCell({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDraft(value || '');
  }, [value]);
  const commit = async (next) => {
    if (next === (value || '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next || null);
    } catch {
      setDraft(value || '');
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };
  if (editing) {
    return (
      <input
        autoFocus
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft);
          if (e.key === 'Escape') setEditing(false);
        }}
        disabled={saving}
        style={{ ...inputStyle, fontFamily: 'var(--mono)' }}
      />
    );
  }
  return (
    <CellShell editing={false} saving={saving} onClick={() => setEditing(true)} title="Click to edit">
      <span style={{ fontFamily: 'var(--mono)', color: value ? 'var(--text-soft)' : 'var(--text-dim)' }}>
        {value ? fmtDate(value) : <em style={{ fontStyle: 'italic', fontSize: 11.5 }}>set date…</em>}
      </span>
    </CellShell>
  );
}

// Image renderer used inside the drawer's page-body markdown. When
// the src points at our /api/notion/file/raw proxy (mirrored
// images), resolves to a signed Supabase URL via auth fetch on
// mount + sets that as the actual <img src>. External images
// pass through unchanged.
function ProxiedImage({ src, alt, ...props }) {
  const [resolved, setResolved] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setResolved(null);
      return;
    }
    if (!src.startsWith('/api/notion/file/')) {
      setResolved(src);
      return;
    }
    (async () => {
      try {
        const url = await resolveProxiedFileUrl(src);
        if (!cancelled) setResolved(url);
      } catch (e) {
        if (!cancelled) setErr(e?.message || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (err) {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 8px',
          fontSize: 11,
          color: 'var(--risk)',
          background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
          border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
          borderRadius: 4,
        }}
      >
        Image failed: {err}
      </span>
    );
  }
  if (!resolved) {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 8px',
          fontSize: 11,
          color: 'var(--text-dim)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 4,
        }}
      >
        Loading image…
      </span>
    );
  }
  return (
    <img
      src={resolved}
      alt={alt || ''}
      {...props}
      style={{ maxWidth: '100%', borderRadius: 4, border: '1px solid var(--border)' }}
    />
  );
}

// SAV chip — shows the count of linked Suivi SAV records, click to
// pop a list with status + device kinds + click-through to Notion.
// Read-only in v1; editing SAV records happens in Notion. The chip
// dims to neutral when there are zero linked SAVs (clearer than
// hiding the cell entirely — keeps column alignment stable).
function SavCell({ savs }) {
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!savs || savs.length === 0) {
    return <span style={{ color: 'var(--text-dim)' }}>—</span>;
  }
  const openCount = savs.filter((s) => s.status && s.status !== 'Fini').length;
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={`${savs.length} SAV record${savs.length > 1 ? 's' : ''}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          fontSize: 11,
          fontWeight: 600,
          background: openCount > 0 ? 'color-mix(in oklch, var(--warn) 12%, var(--surface-2))' : 'var(--surface-2)',
          color: openCount > 0 ? 'var(--warn)' : 'var(--text-soft)',
          border: `1px solid ${openCount > 0 ? 'color-mix(in oklch, var(--warn) 30%, transparent)' : 'var(--border)'}`,
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: 'var(--font)',
        }}
      >
        SAV · {savs.length}
        {openCount > 0 ? ` (${openCount} open)` : ''}
      </button>
      {open && (
        <div
          ref={popRef}
          style={{
            position: 'absolute',
            zIndex: 10,
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: 340,
            maxWidth: 480,
            padding: 10,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.12,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}
          >
            Suivi SAV — {savs.length} record{savs.length > 1 ? 's' : ''}
          </div>
          {savs.map((sav) => (
            <a
              key={sav.id}
              href={sav.notion_url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block',
                padding: 8,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                textDecoration: 'none',
                color: 'var(--text)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sav.site_name || sav.adl_number || sav.notion_page_id.slice(0, 8)}
                </div>
                {sav.status && <Pill tone={SAMSIC_SAV_STATUS_TONES[sav.status] || 'neutral'}>{sav.status}</Pill>}
              </div>
              {(sav.device_kinds || []).length > 0 && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                  {sav.device_kinds.map((k) => (
                    <span
                      key={k}
                      style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        color: 'var(--text-soft)',
                      }}
                    >
                      {k}
                    </span>
                  ))}
                </div>
              )}
              {sav.adl_number && (
                <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
                  ADL {sav.adl_number}
                </div>
              )}
              {sav.comment && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-soft)',
                    marginTop: 3,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.35,
                  }}
                >
                  {sav.comment}
                </div>
              )}
              {sav.todo && (
                <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 3, lineHeight: 1.35 }}>
                  TODO: {sav.todo}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// Lead (Adaptiv) display — small circular avatar + first name.
// Read-only in v1; editing person fields requires picking from the
// workspace user list which is a separate UX exercise. The avatar is
// Notion's own avatar_url (CDN-hosted, no expiry on these — they're
// publicly served from notion.so / amazonaws). If absent, render
// initials in a tinted circle.
function LeadCell({ userId, usersById }) {
  if (!userId) return <span style={{ color: 'var(--text-dim)' }}>—</span>;
  const u = usersById[userId];
  if (!u) {
    // Cache miss — the sync hasn't populated this user yet, or the
    // integration can't see them. Show a neutral placeholder + the
    // last 6 chars of the id so JB can grep Notion if needed.
    return (
      <span
        title={userId}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'var(--text-dim)',
          fontFamily: 'var(--mono)',
        }}
      >
        <span style={avatarFallbackStyle}>?</span>…{userId.slice(-6)}
      </span>
    );
  }
  const initials =
    (u.name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase() || '?';
  const first = (u.name || '').split(/\s+/)[0] || u.email?.split('@')[0] || '—';
  return (
    <span
      title={u.name || u.email || userId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--text-soft)',
      }}
    >
      {u.avatar_url ? (
        <img src={u.avatar_url} alt="" width={20} height={20} style={{ borderRadius: '50%', flexShrink: 0 }} />
      ) : (
        <span style={avatarFallbackStyle}>{initials}</span>
      )}
      {first}
    </span>
  );
}

const avatarFallbackStyle = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'color-mix(in oklch, var(--accent) 12%, var(--surface-2))',
  color: 'var(--accent)',
  fontSize: 9,
  fontWeight: 700,
  flexShrink: 0,
};

// Multi-line comment editor — collapsed display under the site name,
// expanded textarea on click. Pads the cell so the row height grows
// naturally with the comment length rather than truncating.
function CommentLine({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDraft(value || '');
  }, [value]);
  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed === (value || '').trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed || null);
    } catch {
      setDraft(value || '');
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };
  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
        }}
        disabled={saving}
        rows={3}
        placeholder="Add a comment… (⌘/Ctrl+Enter to save)"
        style={{
          marginTop: 4,
          width: '100%',
          padding: '5px 7px',
          fontSize: 11.5,
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: '1px solid var(--accent)',
          borderRadius: 4,
          outline: 'none',
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
    );
  }
  return (
    <div
      onClick={() => setEditing(true)}
      title="Click to edit comment"
      style={{
        marginTop: 2,
        fontSize: 11,
        color: value ? 'var(--text-soft)' : 'var(--text-dim)',
        fontStyle: value ? 'normal' : 'italic',
        cursor: saving ? 'default' : 'text',
        opacity: saving ? 0.5 : 1,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: 1.4,
      }}
    >
      {value || 'add comment…'}
    </div>
  );
}

const inputStyle = {
  padding: '4px 6px',
  fontSize: 12,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  outline: 'none',
  width: '100%',
};
const selectStyle = { ...inputStyle, fontSize: 12 };

// ─────────────────── Detail drawer ──────────────────────────────────
//
// Slides in from the right when a row's Site name is clicked. Shows
// the full record — every property + Notion mirror metadata + linked
// SAVs + every file column — with edit affordances reusing the same
// cell components as the table. Reads + writes go through the same
// updateSamsicCell path; conflicts surface inline like the table.
//
// Escape and clicking the backdrop both close. The Notion link
// demotes to a small "Open in Notion ↗" icon in the header so the
// row click muscle memory now leads inward instead of out.

function SamsicDetailDrawer({ row, usersById, savs, patchRow, onClose }) {
  const [conflict, setConflict] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async (column, value) => {
    setSaveError(null);
    try {
      const body = await updateSamsicCell({
        page_id: row.notion_page_id,
        column,
        value,
        expected_last_edited_at: row.notion_last_edited_at || null,
      });
      patchRow(body.row);
      setConflict(null);
    } catch (e) {
      if (e?.code === 'conflict') {
        setConflict({ at: e.current_last_edited_at });
        if (e.row) patchRow(e.row);
        return;
      }
      setSaveError(e?.message || String(e));
    }
  };

  const leadUser = row.lead_user_id ? usersById[row.lead_user_id] : null;
  const fileColumns = [
    { col: 'devis_file', label: 'Devis', prop: 'Devis' },
    { col: 'samsic_order_file', label: 'Bon cmd SAMSIC', prop: 'Bon cmd SAMSIC' },
    { col: 'invoice_file', label: 'Facture', prop: 'Facture' },
    { col: 'colissimo_delivery_file', label: 'Bon de livraison', prop: 'Bon De Livraison(Colissimo)' },
    { col: 'colissimo_shipment_file', label: 'Expédition Colissimo', prop: 'Expédi(Colissimo)' },
    { col: 'setup_xls_file', label: 'Paramétrage (.xls)', prop: 'Paramétrage (.xls)' },
    { col: 'qrcodes_xls_file', label: 'QR Codes (.xls)', prop: 'QR Codes(.xls)' },
    { col: 'platine_file', label: 'Platine', prop: 'Platine' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          background: 'rgba(0,0,0,0.32)',
        }}
      />
      {/* Drawer panel */}
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 91,
          width: 'min(560px, 90vw)',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: 'var(--text-dim)',
                letterSpacing: 0.14,
                textTransform: 'uppercase',
              }}
            >
              SAMSIC CRM record
            </div>
            <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800, lineHeight: 1.25 }}>
              {row.site_name || <em style={{ color: 'var(--text-dim)' }}>untitled</em>}
            </div>
          </div>
          <a
            href={row.notion_url}
            target="_blank"
            rel="noreferrer"
            title="Open in Notion"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-soft)',
              textDecoration: 'none',
              border: '1px solid var(--border)',
              borderRadius: 4,
            }}
          >
            <Icon.bolt size={10} /> Notion
          </a>
          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: 5,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-soft)',
              cursor: 'pointer',
            }}
          >
            <Icon.close size={12} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {conflict && (
            <div
              style={{
                padding: 10,
                fontSize: 11.5,
                color: 'var(--warn)',
                background: 'color-mix(in oklch, var(--warn) 8%, transparent)',
                border: '1px solid color-mix(in oklch, var(--warn) 30%, transparent)',
                borderRadius: 6,
              }}
            >
              This row was edited in Notion since you opened the drawer. Latest values are shown; retry to overwrite.
            </div>
          )}
          {saveError && (
            <div
              style={{
                padding: 10,
                fontSize: 11.5,
                color: 'var(--risk)',
                background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
                border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
                borderRadius: 6,
              }}
            >
              {saveError}
            </div>
          )}

          <DrawerSection title="Pipeline">
            <DrawerField label="Status">
              <StatusCell value={row.status} onSave={(v) => save('status', v)} />
            </DrawerField>
            <DrawerField label="Priorité">
              <PrioritiesCell values={row.priorities || []} onSave={(v) => save('priorities', v)} />
            </DrawerField>
            <DrawerField label="Montant (EUR)">
              <AmountCell value={row.amount_eur} onSave={(v) => save('amount_eur', v)} />
            </DrawerField>
            <DrawerField label="Lead (Adaptiv)">
              {leadUser ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  {leadUser.avatar_url ? (
                    <img src={leadUser.avatar_url} alt="" width={22} height={22} style={{ borderRadius: '50%' }} />
                  ) : (
                    <span style={avatarFallbackStyle}>
                      {(leadUser.name || '?')
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((s) => s[0])
                        .join('')
                        .toUpperCase()}
                    </span>
                  )}
                  {leadUser.name || leadUser.email}
                </span>
              ) : row.lead_user_id ? (
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                  …{row.lead_user_id.slice(-6)}
                </span>
              ) : (
                <span style={{ color: 'var(--text-dim)' }}>—</span>
              )}
            </DrawerField>
          </DrawerSection>

          <DrawerSection title="Contact">
            <DrawerField label="Pilot Samsic">
              <TextCell
                value={row.samsic_pilot_name}
                placeholder="add name…"
                onSave={(v) => save('samsic_pilot_name', v)}
              />
            </DrawerField>
            <DrawerField label="Email">
              <TextCell value={row.email} placeholder="add email…" onSave={(v) => save('email', v)} />
            </DrawerField>
            <DrawerField label="Téléphone">
              <TextCell value={row.phone} placeholder="add phone…" onSave={(v) => save('phone', v)} />
            </DrawerField>
          </DrawerSection>

          <DrawerSection title="Dates">
            <DrawerField label="Date butoir">
              <DateCell value={row.deadline_at} onSave={(v) => save('deadline_at', v)} />
            </DrawerField>
            <DrawerField label="Date relance">
              <DateCell value={row.followup_at} onSave={(v) => save('followup_at', v)} />
            </DrawerField>
            <DrawerField label="Annonce fin abonnement réseau">
              <DateCell value={row.network_end_announce_at} onSave={(v) => save('network_end_announce_at', v)} />
            </DrawerField>
          </DrawerSection>

          <DrawerSection title="Comments + tracking">
            <DrawerField label="Commentaire" stack>
              <CommentLine value={row.comment} onSave={(v) => save('comment', v)} />
            </DrawerField>
            <DrawerField label="Ref Colissimo expédition Jacou">
              <TextCell
                value={row.colissimo_ref_jacou}
                placeholder="add ref…"
                onSave={(v) => save('colissimo_ref_jacou', v)}
              />
            </DrawerField>
          </DrawerSection>

          <DrawerSection title={`Files`}>
            {fileColumns.map((f) => {
              const arr = Array.isArray(row[f.col]) ? row[f.col] : [];
              return (
                <DrawerField key={f.col} label={f.label} stack>
                  {arr.length === 0 ? (
                    <span style={{ color: 'var(--text-dim)', fontSize: 11.5 }}>—</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {arr.map((entry, i) => (
                        <FileChipButton
                          key={i}
                          proxyPath={`/api/notion/file/${row.notion_page_id}?prop=${encodeURIComponent(f.prop)}&i=${i}`}
                          label={entry?.name || `file-${i + 1}`}
                          title={entry?.name || ''}
                          fullWidth
                          mirrored={!!entry?.local}
                        />
                      ))}
                    </div>
                  )}
                </DrawerField>
              );
            })}
          </DrawerSection>

          <DrawerSection title={`Suivi SAV · ${savs.length}`}>
            {savs.length === 0 ? (
              <span style={{ color: 'var(--text-dim)', fontSize: 11.5 }}>No linked SAV records.</span>
            ) : (
              savs.map((sav) => (
                <a
                  key={sav.id}
                  href={sav.notion_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'block',
                    padding: 8,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    textDecoration: 'none',
                    color: 'var(--text)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>
                      {sav.site_name || sav.adl_number || sav.notion_page_id.slice(0, 8)}
                    </div>
                    {sav.status && <Pill tone={SAMSIC_SAV_STATUS_TONES[sav.status] || 'neutral'}>{sav.status}</Pill>}
                  </div>
                  {(sav.device_kinds || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                      {sav.device_kinds.map((k) => (
                        <span
                          key={k}
                          style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 3,
                            color: 'var(--text-soft)',
                          }}
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                  {sav.adl_number && (
                    <div style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
                      ADL {sav.adl_number}
                    </div>
                  )}
                  {sav.comment && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-soft)',
                        marginTop: 3,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.35,
                      }}
                    >
                      {sav.comment}
                    </div>
                  )}
                  {sav.todo && (
                    <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 3, lineHeight: 1.35 }}>
                      TODO: {sav.todo}
                    </div>
                  )}
                </a>
              ))
            )}
          </DrawerSection>

          <DrawerSection title="Page content">
            {row.page_body_markdown ? (
              <div
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: 'var(--text)',
                  padding: 10,
                  background: 'var(--surface-2)',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  maxWidth: '100%',
                  overflowX: 'auto',
                }}
              >
                <div className="md-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      img: ({ node, ...props }) => <ProxiedImage {...props} />,
                      a: ({ node, ...props }) => (
                        <a {...props} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }} />
                      ),
                      table: ({ node, ...props }) => (
                        <table {...props} style={{ borderCollapse: 'collapse', fontSize: 11.5 }} />
                      ),
                      th: ({ node, ...props }) => (
                        <th
                          {...props}
                          style={{
                            border: '1px solid var(--border)',
                            padding: '4px 6px',
                            background: 'var(--surface)',
                          }}
                        />
                      ),
                      td: ({ node, ...props }) => (
                        <td {...props} style={{ border: '1px solid var(--border)', padding: '4px 6px' }} />
                      ),
                      code: ({ node, ...props }) => (
                        <code
                          {...props}
                          style={{ background: 'var(--surface)', padding: '0 4px', borderRadius: 3, fontSize: 11 }}
                        />
                      ),
                    }}
                  >
                    {row.page_body_markdown}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                {row.page_blocks_synced_at ? (
                  <em>No page body content.</em>
                ) : (
                  <em>Page body hasn't been synced yet. The cron will fetch it in the next few minutes.</em>
                )}
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Metadata">
            <DrawerField label="Notion page ID">
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
                {row.notion_page_id}
              </span>
            </DrawerField>
            <DrawerField label="Created in Notion">
              <span style={{ fontSize: 11.5, color: 'var(--text-soft)' }}>
                {row.notion_created_at ? new Date(row.notion_created_at).toLocaleString() : '—'}
              </span>
            </DrawerField>
            <DrawerField label="Last edited in Notion">
              <span style={{ fontSize: 11.5, color: 'var(--text-soft)' }}>
                {row.notion_last_edited_at ? new Date(row.notion_last_edited_at).toLocaleString() : '—'}
              </span>
            </DrawerField>
            <DrawerField label="Last mirror sync">
              <span style={{ fontSize: 11.5, color: 'var(--text-soft)' }}>
                {row.synced_at ? new Date(row.synced_at).toLocaleString() : '—'}
              </span>
            </DrawerField>
          </DrawerSection>
        </div>
      </aside>
    </>
  );
}

function DrawerSection({ title, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--text-dim)',
          letterSpacing: 0.14,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function DrawerField({ label, children, stack = false }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: stack ? 'column' : 'row',
        gap: stack ? 4 : 12,
        alignItems: stack ? 'stretch' : 'center',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          fontWeight: 600,
          minWidth: stack ? undefined : 160,
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function FileChips({ row }) {
  const chips = FILE_PROPS.filter((f) => Array.isArray(row[f.col]) && row[f.col].length > 0);
  if (chips.length === 0) return <span style={{ color: 'var(--text-dim)' }}>—</span>;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {chips.map((f) => (
        <FileChipButton
          key={f.col}
          proxyPath={`/api/notion/file/${row.notion_page_id}?prop=${encodeURIComponent(f.prop)}&i=0`}
          title={`${f.label} — ${row[f.col].length} file${row[f.col].length > 1 ? 's' : ''}`}
          label={f.label}
        />
      ))}
    </div>
  );
}

// Button (not <a>) because the proxy needs an auth header that a
// new-tab navigation can't carry. onClick resolves the proxy URL to
// a signed Supabase URL via fetch + then window.opens that.
function FileChipButton({ proxyPath, title, label, fullWidth, mirrored }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const open = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setLoading(true);
    setErr(null);
    try {
      const url = await resolveProxiedFileUrl(proxyPath);
      window.open(url, '_blank', 'noopener');
    } catch (x) {
      setErr(x?.message || String(x));
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={open}
      disabled={loading}
      title={err || title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        fontSize: 10.5,
        fontWeight: 600,
        background: err ? 'color-mix(in oklch, var(--risk) 12%, var(--surface-2))' : 'var(--surface-2)',
        color: err ? 'var(--risk)' : 'var(--text-soft)',
        border: `1px solid ${err ? 'color-mix(in oklch, var(--risk) 30%, transparent)' : 'var(--border)'}`,
        borderRadius: 4,
        cursor: loading ? 'progress' : 'pointer',
        opacity: loading ? 0.6 : 1,
        fontFamily: 'var(--font)',
        width: fullWidth ? '100%' : undefined,
        justifyContent: fullWidth ? 'flex-start' : 'center',
      }}
    >
      <Icon.paper size={9} />
      <span
        style={{ flex: fullWidth ? 1 : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {label}
      </span>
      {mirrored != null && <Pill tone={mirrored ? 'ok' : 'off'}>{mirrored ? 'mirrored' : 'live'}</Pill>}
    </button>
  );
}

function FilterPill({ active, onClick, tone = 'info', children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 600,
        background: active ? `color-mix(in oklch, var(--${tone}) 14%, var(--surface))` : 'transparent',
        color: active ? `var(--${tone})` : 'var(--text-dim)',
        border: `1px solid ${active ? `color-mix(in oklch, var(--${tone}) 30%, transparent)` : 'var(--border)'}`,
        borderRadius: 999,
        cursor: 'pointer',
        fontFamily: 'var(--font)',
      }}
    >
      {children}
    </button>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        padding: '8px 10px',
        textAlign: 'left',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.12,
        textTransform: 'uppercase',
        color: 'var(--text-dim)',
      }}
    >
      {children}
    </th>
  );
}

function ThSort({ sort, k, onClick, right, children }) {
  const active = sort.key === k;
  return (
    <th
      onClick={() => onClick(k)}
      style={{
        padding: '8px 10px',
        textAlign: right ? 'right' : 'left',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.12,
        textTransform: 'uppercase',
        color: active ? 'var(--text)' : 'var(--text-dim)',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {children}
      {active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );
}
