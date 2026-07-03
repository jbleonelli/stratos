// Operations → Tickets. The follow-able work-item tracking view a facility
// manager asked for (demo 2026-06-02): "When Merlin sends a message to a
// worker or contractor, how do we follow that?"
//
// Phase 2 = manager-facing tracking. Every agent_escalations row Merlin
// raises auto-creates a ticket (trigger, migration 179); the FM also adds
// manual tickets here. The manager advances status, sets a due date, and
// comments. Phase 3 wires assignee self-update + the notification loop.
//
// Data + mutators live in tickets-data.js. This file is pure presentation.

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card, AdaptivLoader } from './primitives.jsx';
import { useActiveOrg } from './org-data.js';
import { useSession } from './auth.js';
import { useSL } from './servicing-i18n.js';

const FILTER_FR = {
  live: 'En cours',
  all: 'Tous',
  open: 'Ouvert',
  in_progress: 'En traitement',
  done: 'Terminé',
  cancelled: 'Annulé',
};
import {
  useTicketsForOrg,
  useTicketComments,
  useAssignableContractors,
  setTicketStatus,
  assignTicket,
  createManualTicket,
  addTicketComment,
  compareTickets,
  isBreached,
  isTerminalStatus,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
} from './tickets-data.js';

// Status moves an assignee (contractor/worker) can make from a given state.
// Owners get the full TICKET_STATUSES select; assignees get these as buttons.
const ASSIGNEE_NEXT = {
  open: [
    { to: 'acknowledged', label: 'Acknowledge', tone: 'info' },
    { to: 'in_progress', label: 'Start', tone: 'accent' },
  ],
  acknowledged: [
    { to: 'in_progress', label: 'Start', tone: 'accent' },
    { to: 'blocked', label: 'Block', tone: 'risk' },
  ],
  in_progress: [
    { to: 'done', label: 'Mark done', tone: 'ok' },
    { to: 'blocked', label: 'Block', tone: 'risk' },
  ],
  blocked: [
    { to: 'in_progress', label: 'Resume', tone: 'accent' },
    { to: 'done', label: 'Mark done', tone: 'ok' },
  ],
  done: [],
  cancelled: [],
};

const STATUS_TONE = {
  open: 'neutral',
  acknowledged: 'info',
  in_progress: 'accent',
  blocked: 'risk',
  done: 'ok',
  cancelled: 'neutral',
};
const STATUS_LABEL = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
};
const PRIORITY_DOT = {
  urgent: 'var(--risk)',
  high: 'var(--warn)',
  normal: 'var(--text-faint)',
  low: 'var(--border-strong, var(--border))',
};

function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const fmt = (n, u) => `${n}${u}`;
  let s;
  if (mins < 1) s = 'now';
  else if (mins < 60) s = fmt(mins, 'm');
  else if (mins < 1440) s = fmt(Math.round(mins / 60), 'h');
  else s = fmt(Math.round(mins / 1440), 'd');
  if (s === 'now') return 'just now';
  return diff >= 0 ? `${s} ago` : `in ${s}`;
}

const FILTERS = [
  { id: 'live', label: 'Live' },
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
  { id: 'cancelled', label: 'Cancelled' },
];

function matchesFilter(t, filter) {
  if (filter === 'all') return true;
  if (filter === 'live') return !isTerminalStatus(t.status);
  if (filter === 'open') return t.status === 'open';
  if (filter === 'in_progress') return t.status === 'in_progress' || t.status === 'acknowledged';
  if (filter === 'done') return t.status === 'done';
  if (filter === 'cancelled') return t.status === 'cancelled';
  return true;
}

export function TicketsPage({ building }) {
  const sl = useSL();
  const activeOrg = useActiveOrg();
  const session = useSession();
  const orgId = activeOrg?.id || null;
  const isPlatformAdmin = !!session?.isPlatformAdmin;
  // A contractor org is on the receiving end — they see work dispatched to
  // them and advance it. A real_estate (FM) org owns + assigns. Platform
  // admin sees everything with owner controls.
  const isContractorView = activeOrg?.kind === 'contractor' && !isPlatformAdmin;
  const tickets = useTicketsForOrg(orgId);
  const contractors = useAssignableContractors(isContractorView ? null : orgId);
  const [filter, setFilter] = useState('live');
  const [scopeBuilding, setScopeBuilding] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const buildingId = building?.id || null;
  const inBuilding = (loc) => {
    if (!scopeBuilding || !buildingId) return true;
    if (!loc) return false;
    return loc === buildingId || loc.startsWith(buildingId + '-');
  };

  const visible = useMemo(() => {
    return tickets
      .filter((t) => matchesFilter(t, filter) && inBuilding(t.location_id))
      .slice()
      .sort(compareTickets);
  }, [tickets, filter, scopeBuilding, buildingId]);

  const counts = useMemo(() => {
    const live = tickets.filter((t) => !isTerminalStatus(t.status)).length;
    const breached = tickets.filter((t) => isBreached(t)).length;
    return { live, breached, total: tickets.length };
  }, [tickets]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', minWidth: 0, scrollbarGutter: 'stable both-edges' }}>
      {/* Full-width ticket list with a solid 12px side margin owned by the
          padding (not the scrollbar gutter — overlay scrollbars reserve 0 width
          and would collapse it to 6px). scrollbarGutter on the parent keeps a
          classic scrollbar from shifting content. */}
      <div style={{ padding: '12px 12px 60px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
              <Icon.paper size={18} style={{ color: 'var(--accent)' }} />
              Tickets
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '4px 0 0' }}>
              {isContractorView
                ? 'Work dispatched to your team — acknowledge it, mark it in progress, and close it out.'
                : 'Follow every task Merlin dispatches to a worker or contractor — through acknowledge, in progress, and done.'}
            </p>
          </div>
          {!isContractorView && (
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                background: showNew ? 'var(--surface-3)' : 'var(--accent)',
                color: showNew ? 'var(--text-soft)' : 'var(--accent-fg, #fff)',
                border: `1px solid ${showNew ? 'var(--border)' : 'var(--accent-line)'}`,
                borderRadius: 7,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Icon.plus size={13} /> {showNew ? 'Close' : 'New ticket'}
            </button>
          )}
        </div>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 8, margin: '12px 0 14px', flexWrap: 'wrap' }}>
          <Pill tone="accent">{counts.live} live</Pill>
          {counts.breached > 0 && <Pill tone="risk">{counts.breached} overdue</Pill>}
          <Pill tone="neutral">{counts.total} total</Pill>
        </div>

        {showNew && !isContractorView && (
          <NewTicketForm
            orgId={orgId}
            building={building}
            authorLabel={session?.name}
            onClose={() => setShowNew(false)}
          />
        )}

        {/* Filter strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                style={{
                  padding: '5px 11px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {sl(f.label, FILTER_FR[f.id] || f.label)}
              </button>
            );
          })}
          {buildingId && (
            <button
              type="button"
              onClick={() => setScopeBuilding((v) => !v)}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                background: scopeBuilding ? 'var(--accent-soft)' : 'transparent',
                color: scopeBuilding ? 'var(--accent)' : 'var(--text-dim)',
                border: `1px solid ${scopeBuilding ? 'var(--accent-line)' : 'var(--border)'}`,
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Icon.floor size={11} /> {scopeBuilding ? building?.name || 'This building' : 'All buildings'}
            </button>
          )}
        </div>

        {/* List */}
        {!tickets.loaded ? (
          <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
            <AdaptivLoader size="md" label="Loading tickets…" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {visible.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                orgId={orgId}
                viewerOrgId={orgId}
                isPlatformAdmin={isPlatformAdmin}
                contractors={contractors}
                authorLabel={session?.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ filter }) {
  const sl = useSL();
  return (
    <Card style={{ textAlign: 'center', padding: '40px 24px' }}>
      <Icon.paper size={26} style={{ color: 'var(--text-faint)', marginBottom: 10 }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {filter === 'done'
          ? sl('No completed tickets yet', 'Aucun ticket terminé')
          : filter === 'cancelled'
            ? sl('No cancelled tickets', 'Aucun ticket annulé')
            : sl('No tickets to follow', 'Aucun ticket à suivre')}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-dim)', maxWidth: 380, margin: '0 auto' }}>
        {sl(
          'When Merlin escalates a task to a worker or contractor it appears here automatically. You can also raise one yourself with “New ticket”.',
          'Quand Merlin transmet une tâche à un employé ou prestataire, elle apparaît ici automatiquement. Vous pouvez aussi en créer une avec « Nouveau ticket ».',
        )}
      </div>
    </Card>
  );
}

function TicketCard({ ticket: t, orgId, viewerOrgId, isPlatformAdmin, contractors = [], authorLabel }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const breached = isBreached(t);
  const fromMerlin = t.origin === 'agent';

  // Owner (FM org / platform admin) gets full control + assignment.
  // Assignee (contractor org the ticket is dispatched to) can only advance
  // status. The DB field-guard enforces this regardless of the UI.
  const isOwner = isPlatformAdmin || viewerOrgId === t.organization_id;
  const isAssignee = !isOwner && viewerOrgId === t.assignee_org_id;

  const onStatus = async (e) => {
    const status = e.target.value;
    setBusy(true);
    try {
      await setTicketStatus(t.id, status);
    } catch {
      /* realtime will reconcile */
    }
    setBusy(false);
  };
  const advance = async (to) => {
    setBusy(true);
    try {
      await setTicketStatus(t.id, to);
    } catch {
      /* realtime reconciles */
    }
    setBusy(false);
  };
  const onAssign = async (e) => {
    const id = e.target.value || null;
    const match = contractors.find((c) => c.id === id);
    setBusy(true);
    try {
      await assignTicket(t.id, { orgId: id, label: match?.name || null });
    } catch {
      /* noop */
    }
    setBusy(false);
  };

  return (
    <Card pad={false} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 11, padding: '12px 14px' }}>
        {/* Priority rail */}
        <div style={{ flexShrink: 0, paddingTop: 3 }}>
          <span
            style={{
              display: 'inline-block',
              width: 9,
              height: 9,
              borderRadius: 999,
              background: PRIORITY_DOT[t.priority] || PRIORITY_DOT.normal,
            }}
            title={`${t.priority} priority`}
          />
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{t.title}</span>
            {fromMerlin && (
              <Pill tone="accent" style={{ fontSize: 10 }}>
                <Icon.sparkle size={9} /> From Merlin
              </Pill>
            )}
          </div>

          {t.body && (
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.45 }}>{t.body}</div>
          )}

          {/* Meta row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 8,
              flexWrap: 'wrap',
              fontSize: 11.5,
              color: 'var(--text-dim)',
            }}
          >
            {t.location_label && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon.pin size={11} /> {t.location_label}
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon.people size={11} /> {t.assignee_label || 'Unassigned'}
            </span>
            {t.due_at && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: breached ? 'var(--risk)' : 'inherit',
                  fontWeight: breached ? 700 : 400,
                }}
              >
                <Icon.bell size={11} /> {breached ? 'Overdue' : 'Due'} {relTime(t.due_at)}
              </span>
            )}
            <span style={{ color: 'var(--text-faint)' }}>· raised {relTime(t.created_at)}</span>
          </div>
        </div>

        {/* Status control — role-aware */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 7,
            minWidth: 132,
          }}
        >
          <Pill tone={STATUS_TONE[t.status] || 'neutral'}>{STATUS_LABEL[t.status] || t.status}</Pill>

          {isOwner && (
            <>
              <select
                value={t.status}
                onChange={onStatus}
                disabled={busy}
                aria-label="Set status"
                style={{
                  fontSize: 11.5,
                  fontFamily: 'inherit',
                  color: 'var(--text-soft)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '4px 6px',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s] || s}
                  </option>
                ))}
              </select>
              {contractors.length > 0 && (
                <select
                  value={t.assignee_org_id || ''}
                  onChange={onAssign}
                  disabled={busy}
                  aria-label="Assign to contractor"
                  title={
                    !t.assignee_org_id && t.assignee_label ? `Currently: ${t.assignee_label}` : 'Assign to a contractor'
                  }
                  style={{
                    fontSize: 11,
                    fontFamily: 'inherit',
                    color: t.assignee_org_id ? 'var(--accent)' : 'var(--text-dim)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '4px 6px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <option value="">
                    {t.assignee_label && !t.assignee_org_id ? `${t.assignee_label} — assign…` : 'Unassigned'}
                  </option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}

          {isAssignee && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'flex-end' }}>
              {(ASSIGNEE_NEXT[t.status] || []).map((a) => {
                const tones = {
                  info: { bg: 'var(--info)' },
                  accent: { bg: 'var(--accent)' },
                  ok: { bg: 'var(--ok)' },
                  risk: { bg: 'var(--risk)' },
                };
                const c = tones[a.tone] || tones.accent;
                return (
                  <button
                    key={a.to}
                    type="button"
                    onClick={() => advance(a.to)}
                    disabled={busy}
                    style={{
                      padding: '4px 9px',
                      fontSize: 11,
                      fontWeight: 600,
                      background: c.bg,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 5,
                      cursor: busy ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {a.label}
                  </button>
                );
              })}
              {isTerminalStatus(t.status) && (
                <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>No actions</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer: comments toggle + provenance */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 14px',
          borderTop: '1px solid var(--border)',
          background: 'color-mix(in oklch, var(--surface-2) 50%, transparent)',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--text-dim)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: 0,
          }}
        >
          <Icon.chat size={12} />{' '}
          {t.comment_count > 0 ? `${t.comment_count} note${t.comment_count === 1 ? '' : 's'}` : 'Add note'}
          <Icon.chevD size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
        <div style={{ flex: 1 }} />
        {t.source_action_table && (
          <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
            {t.source_action_table === 'agent_escalations' ? 'Escalation' : t.source_action_table}
          </span>
        )}
      </div>

      {open && <CommentThread ticketId={t.id} orgId={orgId} authorLabel={authorLabel} />}
    </Card>
  );
}

function CommentThread({ ticketId, orgId, authorLabel }) {
  const { rows, loaded } = useTicketComments(ticketId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await addTicketComment(ticketId, body, { authorOrgId: orgId, authorLabel });
      setDraft('');
    } catch {
      /* noop */
    }
    setSending(false);
  };

  return (
    <div style={{ padding: '10px 14px 12px', borderTop: '1px solid var(--border)' }}>
      {!loaded ? (
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Loading notes…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 8 }}>No notes yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {rows.map((c) => (
            <div key={c.id} style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-soft)' }}>{c.author_label || 'Someone'}</span>
              <span style={{ color: 'var(--text-faint)', marginLeft: 6, fontSize: 10.5 }}>{relTime(c.created_at)}</span>
              <div style={{ color: 'var(--text-dim)', marginTop: 1, lineHeight: 1.45 }}>{c.body}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Add a note…"
          style={{
            flex: 1,
            fontSize: 12,
            fontFamily: 'inherit',
            color: 'var(--text)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 9px',
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !draft.trim()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 11px',
            fontSize: 12,
            fontWeight: 600,
            background: draft.trim() ? 'var(--accent)' : 'var(--surface-3)',
            color: draft.trim() ? 'var(--accent-fg, #fff)' : 'var(--text-faint)',
            border: '1px solid var(--accent-line)',
            borderRadius: 6,
            cursor: draft.trim() ? 'pointer' : 'default',
            fontFamily: 'inherit',
          }}
        >
          <Icon.send size={12} /> Send
        </button>
      </div>
    </div>
  );
}

function NewTicketForm({ orgId, building, onClose }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('normal');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !orgId) return;
    setSaving(true);
    try {
      await createManualTicket({
        organizationId: orgId,
        locationId: building?.id || null,
        locationLabel: building?.name || null,
        title: title.trim(),
        body: body.trim() || null,
        priority,
        assigneeLabel: assignee.trim() || null,
        dueAt: due ? new Date(due).toISOString() : null,
      });
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    fontSize: 12.5,
    fontFamily: 'inherit',
    color: 'var(--text)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '7px 9px',
    boxSizing: 'border-box',
  };

  return (
    <Card accent style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        style={inputStyle}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Details (optional)"
        rows={2}
        style={{ ...inputStyle, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11.5, color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
          >
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label
          style={{
            fontSize: 11.5,
            color: 'var(--text-dim)',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            flex: 1,
            minWidth: 140,
          }}
        >
          Assignee (who)
          <input
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="e.g. Night crew"
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11.5, color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          Due
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '7px 12px',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--text-dim)',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 7,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !title.trim()}
          style={{
            padding: '7px 14px',
            fontSize: 12.5,
            fontWeight: 600,
            background: title.trim() ? 'var(--accent)' : 'var(--surface-3)',
            color: title.trim() ? 'var(--accent-fg, #fff)' : 'var(--text-faint)',
            border: '1px solid var(--accent-line)',
            borderRadius: 7,
            cursor: title.trim() ? 'pointer' : 'default',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Creating…' : 'Create ticket'}
        </button>
      </div>
    </Card>
  );
}
