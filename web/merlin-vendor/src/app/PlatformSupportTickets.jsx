// /platform/support/tickets — Adaptiv help-desk triage queue (support Phase 2).
//
// Reads public.support_tickets + public.support_messages (migration 221). RLS
// gates everything to platform admins, so direct supabase-js reads/updates
// work without an API — except sending a reply, which goes through
// /api/platform/support/reply (server-side Resend + threading).
//
// Tickets are born from inbound email via /api/inbound/support. Here staff
// triage them: read the email thread, reply (emails the requester, threads
// back), set status/priority, assign to themselves.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { supabase } from './supabase.js';
import { useT } from './i18n.js';
import {
  useSupportOrgs,
  useSupportConfig,
  useSupportThread,
  usePatchSupportTicket,
  useSaveSupportConfig,
} from './queries/support.ts';

const STATUS_ORDER = ['open', 'pending', 'resolved', 'closed'];
const STATUS_TONE = { open: 'accent', pending: 'warn', resolved: 'ok', closed: 'neutral' };
const PRIORITY_TONE = { low: 'neutral', normal: 'neutral', high: 'warn', urgent: 'risk' };

async function authedFetch(path, init = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
      ...(init.headers || {}),
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
  return payload;
}

export function PlatformSupportTicketsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('open');
  const [selectedId, setSelectedId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Ticket queue — in-place realtime read. The list itself is keyed only on
  // ['support-tickets']; the status filter is applied client-side below (we
  // always pull the full queue so the per-status counts stay accurate).
  const ticketsQ = useQuery({
    queryKey: ['support-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, org:organizations(name)')
        .order('last_message_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });
  const rows = useMemo(() => ticketsQ.data ?? [], [ticketsQ.data]);
  const loading = ticketsQ.isPending;
  const err = ticketsQ.error ? ticketsQ.error.message : '';

  // Org list for the "link unmapped ticket → org" picker.
  const orgsQ = useSupportOrgs();
  const orgs = orgsQ.data ?? [];

  // Patch (status/priority/assignee/org) — refreshed by realtime, no invalidate.
  const patchMut = usePatchSupportTicket();
  const [patchErr, setPatchErr] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));
    // Realtime: any ticket or message change re-pulls the queue (cheap at this
    // volume; last_message_at re-sorts the list and refreshes the open detail).
    const ch = supabase
      .channel('platform-support-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () =>
        qc.invalidateQueries({ queryKey: ['support-tickets'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () =>
        qc.invalidateQueries({ queryKey: ['support-tickets'] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const counts = useMemo(() => {
    const c = { all: rows.length };
    for (const s of STATUS_ORDER) c[s] = 0;
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  async function patchTicket(id, patch) {
    setPatchErr('');
    try {
      await patchMut.mutateAsync({ id, patch });
      // No manual refresh: the realtime subscription re-pulls the queue.
    } catch (e) {
      setPatchErr(e.message);
    }
  }

  const banner = err || patchErr;

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
            {t('platform.tickets.eyebrow')}
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700 }}>{t('platform.tickets.heading')}</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-dim)', maxWidth: 720 }}>
            {t('platform.tickets.subheading')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          style={{
            ...ghostBtn,
            ...(showSettings
              ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-line)' }
              : null),
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
          }}
        >
          <Icon.cog size={13} />
          {t('platform.tickets.settings.open')}
        </button>
      </div>

      {showSettings && <SupportSettings t={t} onClose={() => setShowSettings(false)} />}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {STATUS_ORDER.map((s) => (
          <FilterPill
            key={s}
            label={t(`platform.tickets.filter.${s}`)}
            count={counts[s] || 0}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          />
        ))}
        <FilterPill
          label={t('platform.tickets.filter.all')}
          count={counts.all}
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
      </div>

      {banner && (
        <Card>
          <div style={{ color: 'var(--risk)', fontSize: 13 }}>{banner}</div>
        </Card>
      )}

      {loading ? (
        <Card>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{t('platform.tickets.loading')}</div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{t('platform.tickets.empty')}</div>
        </Card>
      ) : (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((r) => (
              <Row key={r.id} row={r} active={r.id === selectedId} onClick={() => setSelectedId(r.id)} t={t} />
            ))}
          </div>
        </Card>
      )}

      {selected && (
        <Detail
          ticket={selected}
          userId={userId}
          orgs={orgs}
          t={t}
          onClose={() => setSelectedId(null)}
          onPatch={(patch) => patchTicket(selected.id, patch)}
          onReplied={async () => {
            // The reply inserted a support_messages row + bumped the ticket's
            // last_message_at. Realtime usually catches this, but invalidate
            // both reads eagerly so the thread/list refresh the moment the API
            // returns (the thread re-keys off the bumped last_message_at).
            await qc.invalidateQueries({ queryKey: ['support-tickets'] });
            await qc.invalidateQueries({ queryKey: ['support-thread'] });
          }}
        />
      )}
    </div>
  );
}

// Defaults mirror the webhook's SUPPORT_ACK_DEFAULTS (api/inbound/support.ts)
// so the editor pre-fills with the same copy the server would otherwise send.
const ACK_DEFAULTS = {
  ack_subject: "We've received your request — {{ref}}",
  ack_eyebrow: 'ADAPTIV · SUPPORT',
  ack_heading: 'Your request has been received',
  ack_chip_label: 'Ticket',
  ack_body: [
    'Hi {{name}},',
    '',
    "Thank you for contacting Adaptiv Support. We've received your message and opened a ticket — your reference is {{ref}}.",
    '',
    'Our team is reviewing it now and will get back to you as soon as possible. You can reply directly to this email to add anything further; keeping {{ref}} in the subject line keeps everything on the same ticket.',
    '',
    'Kind regards,',
    'The Adaptiv Support team',
  ].join('\n'),
  ack_footer: 'Please keep {{ref}} in the subject line when replying so we can track your ticket.',
  ack_brand_text: 'Adaptiv',
  ack_brand_url: 'https://adaptiv.systems',
  ack_color_1: '#FF00B2',
  ack_color_2: '#20286D',
  copy_from: '',
  copy_subject: '[{{ref}}] {{subject}}',
  copy_body: [
    'New support ticket {{ref}}.',
    '',
    'From:    {{from}}',
    'Org:     {{org}}',
    'Subject: {{subject}}',
    '',
    '{{body}}',
    '',
    '— Triage at {{triage_url}}',
    'Reply to this email to reach {{from_email}} directly.',
  ].join('\n'),
};

function SupportSettings({ t, onClose }) {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState(null);
  const [note, setNote] = useState('');

  const configQ = useSupportConfig();
  const saveMut = useSaveSupportConfig();
  const saving = saveMut.isPending;

  // Seed the editable form from the fetched support_config blob, once it lands.
  // Keeps form-state separate from the query cache (the user edits a draft).
  useEffect(() => {
    if (!configQ.isSuccess || cfg) return;
    const v = configQ.data || {};
    setCfg({
      ack_enabled: v.ack_enabled !== false,
      from_address: v.from_address || '',
      copy_to: Array.isArray(v.copy_to) ? v.copy_to.join('\n') : '',
      ack_subject: v.ack_subject || ACK_DEFAULTS.ack_subject,
      ack_eyebrow: v.ack_eyebrow || ACK_DEFAULTS.ack_eyebrow,
      ack_heading: v.ack_heading || ACK_DEFAULTS.ack_heading,
      ack_chip_label: v.ack_chip_label || ACK_DEFAULTS.ack_chip_label,
      ack_body: v.ack_body || ACK_DEFAULTS.ack_body,
      ack_footer: v.ack_footer || ACK_DEFAULTS.ack_footer,
      ack_brand_text: v.ack_brand_text || ACK_DEFAULTS.ack_brand_text,
      ack_brand_url: v.ack_brand_url || ACK_DEFAULTS.ack_brand_url,
      ack_color_1: v.ack_color_1 || ACK_DEFAULTS.ack_color_1,
      ack_color_2: v.ack_color_2 || ACK_DEFAULTS.ack_color_2,
      copy_from: v.copy_from || '',
      copy_subject: v.copy_subject || ACK_DEFAULTS.copy_subject,
      copy_body: v.copy_body || ACK_DEFAULTS.copy_body,
    });
  }, [configQ.isSuccess, configQ.data, cfg]);

  async function save() {
    if (saving) return;
    setNote('');
    const copy_to = cfg.copy_to
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
    const value = {
      ack_enabled: cfg.ack_enabled,
      from_address: cfg.from_address.trim(),
      copy_to,
      ack_subject: cfg.ack_subject.trim() || ACK_DEFAULTS.ack_subject,
      ack_eyebrow: cfg.ack_eyebrow,
      ack_heading: cfg.ack_heading,
      ack_chip_label: cfg.ack_chip_label,
      ack_body: cfg.ack_body,
      ack_footer: cfg.ack_footer,
      ack_brand_text: cfg.ack_brand_text,
      ack_brand_url: cfg.ack_brand_url.trim(),
      ack_color_1: cfg.ack_color_1,
      ack_color_2: cfg.ack_color_2,
      copy_from: cfg.copy_from.trim(),
      copy_subject: cfg.copy_subject.trim() || ACK_DEFAULTS.copy_subject,
      copy_body: cfg.copy_body,
    };
    try {
      await saveMut.mutateAsync(value);
    } catch (e) {
      setNote(`${t('platform.tickets.reply.error')}: ${e.message}`);
      return;
    }
    // Refresh the non-realtime config read so a later re-open shows saved copy.
    await qc.invalidateQueries({ queryKey: ['support-config'] });
    setCfg((c) => ({ ...c, copy_to: copy_to.join('\n') }));
    setNote(t('platform.tickets.settings.saved'));
  }

  const loading = configQ.isPending;
  if (loading || !cfg) {
    return (
      <Card>
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{t('platform.tickets.loading')}</div>
      </Card>
    );
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: 'var(--font)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--surface-2)',
    color: 'var(--text)',
  };
  // Bind a config key to an <input>/<textarea>.
  const bind = (key) => ({ value: cfg[key], onChange: (e) => setCfg((c) => ({ ...c, [key]: e.target.value })) });
  const ackStyle = { marginTop: 12, opacity: cfg.ack_enabled ? 1 : 0.5 };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon.cog size={14} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('platform.tickets.settings.title')}</div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onClose}
          style={{ all: 'unset', cursor: 'pointer', padding: 4, color: 'var(--text-dim)' }}
        >
          <Icon.close size={14} />
        </button>
      </div>

      {/* Send from — applies to the acknowledgement AND staff replies.
          autoComplete/ignore attrs keep password managers from hijacking this
          email-shaped field (they were intercepting keystrokes). */}
      <div style={{ marginTop: 14 }}>
        <label style={fieldLabel}>{t('platform.tickets.settings.from')}</label>
        <input
          {...bind('from_address')}
          type="text"
          name="support-send-from"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          placeholder="Adaptiv Support <support@adaptiv.systems>"
          style={inputStyle}
        />
        <div style={fieldHint}>{t('platform.tickets.settings.from_hint')}</div>
      </div>

      {/* Copy incoming emails to */}
      <div style={{ marginTop: 14 }}>
        <label style={fieldLabel}>{t('platform.tickets.settings.copy_to')}</label>
        <textarea
          {...bind('copy_to')}
          rows={3}
          placeholder={'ops@adaptiv.systems\njb@adaptiv.systems'}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        <div style={fieldHint}>{t('platform.tickets.settings.copy_to_hint')}</div>
      </div>

      {/* Forwarded-copy email — from + subject + body */}
      <div style={{ marginTop: 12 }}>
        <label style={fieldLabel}>{t('platform.tickets.settings.copy_from')}</label>
        <input
          {...bind('copy_from')}
          type="text"
          name="support-copy-from"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          placeholder="Adaptiv Support <noreply@adaptiv.systems>"
          style={inputStyle}
        />
        <div style={fieldHint}>{t('platform.tickets.settings.copy_from_hint')}</div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={fieldLabel}>{t('platform.tickets.settings.copy_subject')}</label>
        <input {...bind('copy_subject')} style={inputStyle} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={fieldLabel}>{t('platform.tickets.settings.copy_body')}</label>
        <textarea {...bind('copy_body')} rows={8} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        <div style={fieldHint}>{t('platform.tickets.settings.copy_placeholders')}</div>
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 18,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <input
          type="checkbox"
          checked={cfg.ack_enabled}
          onChange={(e) => setCfg((c) => ({ ...c, ack_enabled: e.target.checked }))}
        />
        {t('platform.tickets.settings.ack_enabled')}
      </label>

      <div style={ackStyle}>
        <label style={fieldLabel}>{t('platform.tickets.settings.ack_subject')}</label>
        <input {...bind('ack_subject')} disabled={!cfg.ack_enabled} style={inputStyle} />
      </div>

      <div style={{ ...ackStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={fieldLabel}>{t('platform.tickets.settings.ack_eyebrow')}</label>
          <input {...bind('ack_eyebrow')} disabled={!cfg.ack_enabled} style={inputStyle} />
        </div>
        <div>
          <label style={fieldLabel}>{t('platform.tickets.settings.ack_chip')}</label>
          <input {...bind('ack_chip_label')} disabled={!cfg.ack_enabled} style={inputStyle} />
        </div>
      </div>

      <div style={ackStyle}>
        <label style={fieldLabel}>{t('platform.tickets.settings.ack_heading')}</label>
        <input {...bind('ack_heading')} disabled={!cfg.ack_enabled} style={inputStyle} />
      </div>

      <div style={ackStyle}>
        <label style={fieldLabel}>{t('platform.tickets.settings.ack_body')}</label>
        <textarea
          {...bind('ack_body')}
          disabled={!cfg.ack_enabled}
          rows={8}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
        <div style={fieldHint}>{t('platform.tickets.settings.placeholders')}</div>
      </div>

      <div style={ackStyle}>
        <label style={fieldLabel}>{t('platform.tickets.settings.ack_footer')}</label>
        <textarea
          {...bind('ack_footer')}
          disabled={!cfg.ack_enabled}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
        <div style={fieldHint}>{t('platform.tickets.settings.branded_note')}</div>
      </div>

      <div style={{ ...ackStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={fieldLabel}>{t('platform.tickets.settings.brand_text')}</label>
          <input {...bind('ack_brand_text')} disabled={!cfg.ack_enabled} style={inputStyle} />
        </div>
        <div>
          <label style={fieldLabel}>{t('platform.tickets.settings.brand_url')}</label>
          <input
            {...bind('ack_brand_url')}
            disabled={!cfg.ack_enabled}
            placeholder="https://adaptiv.systems"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ ...ackStyle, display: 'flex', gap: 24, alignItems: 'flex-end' }}>
        <div>
          <label style={fieldLabel}>{t('platform.tickets.settings.color_1')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="color" {...bind('ack_color_1')} disabled={!cfg.ack_enabled} style={swatchStyle} />
            <input {...bind('ack_color_1')} disabled={!cfg.ack_enabled} style={{ ...inputStyle, width: 96 }} />
          </div>
        </div>
        <div>
          <label style={fieldLabel}>{t('platform.tickets.settings.color_2')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="color" {...bind('ack_color_2')} disabled={!cfg.ack_enabled} style={swatchStyle} />
            <input {...bind('ack_color_2')} disabled={!cfg.ack_enabled} style={{ ...inputStyle, width: 96 }} />
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            width: 64,
            height: 32,
            borderRadius: 8,
            alignSelf: 'flex-end',
            background: `linear-gradient(90deg, ${cfg.ack_color_1}, ${cfg.ack_color_2})`,
            border: '1px solid var(--border)',
          }}
          title="stripe preview"
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding: '7px 14px',
            fontSize: 12.5,
            fontWeight: 700,
            background: saving ? 'var(--surface-3)' : 'var(--accent)',
            color: saving ? 'var(--text-faint)' : '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? t('platform.tickets.settings.saving') : t('platform.tickets.settings.save')}
        </button>
        {note && (
          <span
            style={{
              fontSize: 12,
              color: note.startsWith(t('platform.tickets.reply.error')) ? 'var(--risk)' : 'var(--ok)',
            }}
          >
            {note}
          </span>
        )}
      </div>
    </Card>
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

function Row({ row, active, onClick, t }) {
  const org = row.org?.name;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '92px 84px minmax(0, 1fr) auto',
        gap: 12,
        padding: '10px 8px',
        alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        background: active ? 'var(--surface-2)' : 'transparent',
      }}
    >
      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
        {row.ref_code}
      </span>
      <Pill tone={STATUS_TONE[row.status]}>{t(`platform.tickets.status.${row.status}`)}</Pill>
      <div style={{ minWidth: 0 }}>
        <div
          style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {row.subject}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.requester_name ? `${row.requester_name} · ` : ''}
          {row.requester_email}
          {org ? ` · ${org}` : ''}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'right' }}>{fmtWhen(row.last_message_at)}</div>
    </button>
  );
}

function Detail({ ticket, userId, orgs = [], t, onClose, onPatch, onReplied }) {
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');
  const threadEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const canned = useMemo(() => cannedResponses(t), [t]);

  // Thread (messages + attachments) — re-fetches when a new message lands, since
  // last_message_at bumps on insert and is part of the query key.
  const threadQ = useSupportThread(ticket.id, ticket.last_message_at);
  const messages = threadQ.data?.messages ?? [];
  const attByMsg = threadQ.data?.attByMsg ?? {};
  const loadingMsgs = threadQ.isPending;

  async function downloadAttachment(id) {
    try {
      const { url } = await authedFetch(`/api/platform/support/attachment?id=${encodeURIComponent(id)}`);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setNote(`${t('platform.tickets.reply.error')}: ${e.message}`);
    }
  }

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  async function sendReply() {
    const body = draft.trim();
    if ((!body && files.length === 0) || sending) return;
    setSending(true);
    setNote('');
    try {
      let attachments;
      if (files.length) {
        const total = files.reduce((s, f) => s + f.size, 0);
        if (total > 4_000_000) throw new Error(t('platform.tickets.attach.too_big'));
        attachments = await Promise.all(
          files.map(async (f) => ({
            filename: f.name,
            contentType: f.type || null,
            contentBase64: await fileToBase64(f),
          })),
        );
      }
      await authedFetch('/api/platform/support/reply', {
        method: 'POST',
        body: JSON.stringify({ ticket_id: ticket.id, body_text: body, attachments }),
      });
      setDraft('');
      setFiles([]);
      setNote(t('platform.tickets.reply.sent'));
      await onReplied();
    } catch (e) {
      setNote(`${t('platform.tickets.reply.error')}: ${e.message}`);
    } finally {
      setSending(false);
    }
  }

  const org = ticket.org?.name;
  const assignedToMe = ticket.assigned_to_user_id && ticket.assigned_to_user_id === userId;

  return (
    <Card>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>{ticket.ref_code}</span>
            <Pill tone={STATUS_TONE[ticket.status]}>{t(`platform.tickets.status.${ticket.status}`)}</Pill>
            {ticket.priority !== 'normal' && (
              <Pill tone={PRIORITY_TONE[ticket.priority]}>{t(`platform.tickets.priority.${ticket.priority}`)}</Pill>
            )}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{ticket.subject}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            {ticket.requester_name ? `${ticket.requester_name} · ` : ''}
            <a href={`mailto:${ticket.requester_email}`} style={{ color: 'var(--accent)' }}>
              {ticket.requester_email}
            </a>
            {' · '}
            {org || t('platform.tickets.unmapped')}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ all: 'unset', cursor: 'pointer', padding: 4, color: 'var(--text-dim)' }}
        >
          <Icon.close size={14} />
        </button>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14, alignItems: 'flex-end' }}>
        <Control label={t('platform.tickets.set_status')}>
          <Segmented
            options={STATUS_ORDER.map((s) => ({ value: s, label: t(`platform.tickets.status.${s}`) }))}
            value={ticket.status}
            onChange={(v) => onPatch({ status: v })}
          />
        </Control>
        <Control label={t('platform.tickets.kv.priority')}>
          <select value={ticket.priority} onChange={(e) => onPatch({ priority: e.target.value })} style={selectStyle}>
            {['low', 'normal', 'high', 'urgent'].map((p) => (
              <option key={p} value={p}>
                {t(`platform.tickets.priority.${p}`)}
              </option>
            ))}
          </select>
        </Control>
        <Control label={t('platform.tickets.kv.assignee')}>
          {assignedToMe ? (
            <button type="button" onClick={() => onPatch({ assigned_to_user_id: null })} style={ghostBtn}>
              {t('platform.tickets.assigned_you')} · {t('platform.tickets.unassign')}
            </button>
          ) : (
            <button type="button" onClick={() => onPatch({ assigned_to_user_id: userId })} style={ghostBtn}>
              {ticket.assigned_to_user_id ? t('platform.tickets.assigned_other') + ' · ' : ''}
              {t('platform.tickets.assign_me')}
            </button>
          )}
        </Control>
        <Control label={t('platform.tickets.kv.org')}>
          <select
            value={ticket.organization_id || ''}
            onChange={(e) => onPatch({ organization_id: e.target.value || null })}
            style={selectStyle}
          >
            <option value="">{t('platform.tickets.org.none')}</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Control>
      </div>

      {/* Meta */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 16 }}
      >
        <KV label={t('platform.tickets.kv.opened')} value={fmtWhen(ticket.created_at)} />
        <KV label={t('platform.tickets.kv.last_activity')} value={fmtWhen(ticket.last_message_at)} />
        <KV
          label={t('platform.tickets.kv.first_response')}
          value={ticket.first_response_at ? fmtWhen(ticket.first_response_at) : '—'}
        />
      </div>

      {/* Thread */}
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loadingMsgs ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{t('platform.tickets.loading')}</div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{t('platform.tickets.thread.empty')}</div>
        ) : (
          messages.map((m) => (
            <Bubble key={m.id} msg={m} attachments={attByMsg[m.id] || []} onDownload={downloadAttachment} t={t} />
          ))
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Reply composer */}
      <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.2,
              fontWeight: 700,
            }}
          >
            {t('platform.tickets.reply.title')}
          </span>
          <div style={{ flex: 1 }} />
          <select
            value=""
            onChange={(e) => {
              const c = canned.find((x) => x.id === e.target.value);
              if (c) setDraft((prev) => (prev.trim() ? `${prev}\n\n${c.body}` : c.body));
              e.target.value = '';
            }}
            style={selectStyle}
          >
            <option value="">{t('platform.tickets.canned.choose')}</option>
            {canned.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('platform.tickets.reply.placeholder')}
          rows={4}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            padding: 10,
            fontSize: 13,
            fontFamily: 'var(--font)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--surface-2)',
            color: 'var(--text)',
          }}
        />
        {files.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {files.map((f, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 6px 3px 8px',
                  fontSize: 11.5,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                }}
              >
                <Icon.paper size={11} style={{ color: 'var(--text-dim)' }} />
                {f.name} · {fmtBytes(f.size)}
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  style={{ all: 'unset', cursor: 'pointer', color: 'var(--text-dim)', display: 'inline-flex' }}
                >
                  <Icon.close size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            setFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
            e.target.value = '';
          }}
        />
        {(() => {
          const disabled = (!draft.trim() && files.length === 0) || sending;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={sendReply}
                disabled={disabled}
                style={{
                  padding: '7px 14px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  background: disabled ? 'var(--surface-3)' : 'var(--accent)',
                  color: disabled ? 'var(--text-faint)' : '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: disabled ? 'default' : 'pointer',
                }}
              >
                {sending ? t('platform.tickets.reply.sending') : t('platform.tickets.reply.send')}
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} style={ghostBtn}>
                <Icon.paper size={12} style={{ marginRight: 4 }} />
                {t('platform.tickets.attach.add')}
              </button>
              {note && (
                <span
                  style={{
                    fontSize: 12,
                    color: note.startsWith(t('platform.tickets.reply.error')) ? 'var(--risk)' : 'var(--ok)',
                  }}
                >
                  {note}
                </span>
              )}
            </div>
          );
        })()}
      </div>
    </Card>
  );
}

function Bubble({ msg, attachments = [], onDownload, t }) {
  const inbound = msg.direction === 'inbound';
  return (
    <div
      style={{
        alignSelf: inbound ? 'flex-start' : 'flex-end',
        maxWidth: '82%',
        background: inbound ? 'var(--surface-2)' : 'var(--accent-soft)',
        border: '1px solid ' + (inbound ? 'var(--border)' : 'var(--accent-line)'),
        borderRadius: 10,
        padding: '10px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: inbound ? 'var(--text-dim)' : 'var(--accent)' }}>
          {inbound
            ? msg.from_name || msg.from_email || t('platform.tickets.thread.client')
            : t('platform.tickets.thread.staff')}
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{fmtWhen(msg.created_at)}</span>
      </div>
      <div
        style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}
      >
        {msg.body_text || stripHtml(msg.body_html) || '—'}
      </div>
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {attachments.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onDownload?.(a.id)}
              title={t('platform.tickets.download')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                fontSize: 11.5,
                fontWeight: 600,
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              <Icon.paper size={12} style={{ color: 'var(--text-dim)' }} />
              {a.filename}
              {a.size_bytes ? ` · ${fmtBytes(a.size_bytes)}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Lightweight reply templates (canned responses). Static + i18n'd — staff
// pick one to seed/append the composer, then edit before sending.
function cannedResponses(t) {
  return [
    { id: 'ack', title: t('platform.tickets.canned.ack.title'), body: t('platform.tickets.canned.ack.body') },
    { id: 'info', title: t('platform.tickets.canned.info.title'), body: t('platform.tickets.canned.info.body') },
    {
      id: 'resolved',
      title: t('platform.tickets.canned.resolved.title'),
      body: t('platform.tickets.canned.resolved.body'),
    },
  ];
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function Control({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 10.5,
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          letterSpacing: 0.2,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 2,
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            padding: '4px 9px',
            fontSize: 11.5,
            fontWeight: 600,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            background: value === o.value ? 'var(--surface)' : 'transparent',
            color: value === o.value ? 'var(--text)' : 'var(--text-dim)',
            boxShadow: value === o.value ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          letterSpacing: 0.2,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2 }}>{value ?? '—'}</div>
    </div>
  );
}

const selectStyle = {
  padding: '5px 8px',
  fontSize: 12,
  fontWeight: 600,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
};
const ghostBtn = {
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 600,
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  cursor: 'pointer',
  fontFamily: 'var(--font)',
};
const fieldLabel = {
  display: 'block',
  fontSize: 11,
  color: 'var(--text-dim)',
  textTransform: 'uppercase',
  letterSpacing: 0.2,
  fontWeight: 700,
  marginBottom: 5,
};
const fieldHint = { fontSize: 11.5, color: 'var(--text-faint)', marginTop: 5, lineHeight: 1.5 };
const swatchStyle = {
  width: 40,
  height: 32,
  padding: 2,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface-2)',
  cursor: 'pointer',
};

function fmtWhen(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
