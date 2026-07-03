// Merlin Field — the Tickets tab (list + raise + detail/comments) extracted from
// MobileApp.jsx (G2 monolith split, after the Today tab). Self-contained: owns
// the ticket-photo upload, the compose + detail sheets, and the generic Sheet
// shell they share. Receives the translator `m`, `org`, and `session` as props.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { Card, Pill, IconBtn } from './primitives.jsx';
import { supabase } from './supabase.js';
import { alertDialog } from './dialogs.jsx';
import { hhmm } from './mobile-utils.js';
import {
  useTicketsForOrg,
  useTicketComments,
  createManualTicket,
  addTicketComment,
  compareTickets,
  isBreached,
  isTerminalStatus,
} from './tickets-data.js';

// Upload a ticket photo to the per-org folder in the public `ticket-photos`
// bucket (mig 254) and return its public URL. Throws on failure.
const PHOTO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};
async function uploadTicketPhoto(orgId, file) {
  const ext = PHOTO_EXT[file.type] || (file.name?.split('.').pop() || 'jpg').toLowerCase();
  const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('ticket-photos')
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if (error) throw error;
  return supabase.storage.from('ticket-photos').getPublicUrl(path).data?.publicUrl || null;
}

// ───────────────────────── Tickets ─────────────────────────
function statusTone(s) {
  if (s === 'done') return 'ok';
  if (s === 'cancelled') return 'neutral';
  if (s === 'blocked') return 'risk';
  if (s === 'in_progress') return 'info';
  return 'warn';
}

export function TicketsTab({ m, org, session }) {
  const tickets = useTicketsForOrg(org?.id);
  const uid = session?.userId;
  const [composing, setComposing] = useState(false);
  const [openTicket, setOpenTicket] = useState(null);

  const { mine, building } = useMemo(() => {
    const sorted = tickets.slice().sort(compareTickets);
    const mineList = sorted.filter((t) => t.assignee_user_id === uid || t.created_by === uid);
    const mineIds = new Set(mineList.map((t) => t.id));
    const rest = sorted.filter((t) => !mineIds.has(t.id) && !isTerminalStatus(t.status));
    return { mine: mineList, building: rest.slice(0, 12) };
  }, [tickets, uid]);

  // Keep the open detail sheet in sync with realtime updates (new comment
  // counts, status changes) by re-reading the live row.
  const liveOpen = openTicket ? tickets.find((t) => t.id === openTicket.id) || openTicket : null;

  if (!tickets.loaded) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim)',
          fontSize: 13,
        }}
      >
        {m('tickets.loading')}
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <button
        onClick={() => setComposing(true)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '13px',
          borderRadius: 12,
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 700,
          border: 'none',
          background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        <Icon.plus size={15} /> {m('tickets.raise')}
      </button>

      <TicketSection
        title={m('tickets.mine')}
        tickets={mine}
        m={m}
        onOpen={setOpenTicket}
        emptyText={m('tickets.none')}
      />
      {building.length > 0 && (
        <TicketSection title={m('tickets.building')} tickets={building} m={m} onOpen={setOpenTicket} />
      )}

      {composing && <TicketComposeSheet m={m} org={org} session={session} onClose={() => setComposing(false)} />}
      {liveOpen && (
        <TicketDetailSheet m={m} org={org} session={session} ticket={liveOpen} onClose={() => setOpenTicket(null)} />
      )}
    </div>
  );
}

function TicketSection({ title, tickets, m, emptyText, onOpen }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          padding: '0 2px',
        }}
      >
        {title}
      </div>
      {tickets.length === 0 && emptyText && (
        <Card>
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>{emptyText}</div>
        </Card>
      )}
      {tickets.map((t) => (
        <TicketRow key={t.id} ticket={t} m={m} onOpen={onOpen} />
      ))}
    </div>
  );
}

function TicketRow({ ticket, m, onOpen }) {
  const breached = isBreached(ticket);
  return (
    <Card pad={false}>
      <button
        onClick={() => onOpen?.(ticket)}
        style={{
          width: '100%',
          textAlign: 'left',
          fontFamily: 'inherit',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text)',
          padding: '13px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0, lineHeight: 1.3 }}>
            {ticket.title}
          </div>
          <Pill tone={statusTone(ticket.status)}>{m(`status.${ticket.status}`)}</Pill>
        </div>
        {ticket.body && (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--text-dim)',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {ticket.body}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {ticket.location_label && (
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{ticket.location_label}</span>
          )}
          {ticket.priority && ticket.priority !== 'normal' && (
            <Pill tone={ticket.priority === 'urgent' || ticket.priority === 'high' ? 'risk' : 'neutral'}>
              {m(`prio.${ticket.priority}`)}
            </Pill>
          )}
          {breached && <Pill tone="risk">{m('tickets.overdue')}</Pill>}
          {ticket.photo_url && <Icon.camera size={12} style={{ color: 'var(--text-faint)' }} />}
          {ticket.comment_count > 0 && (
            <span
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-faint)' }}
            >
              <Icon.chat size={11} /> {ticket.comment_count}
            </span>
          )}
        </div>
      </button>
    </Card>
  );
}

// Full-screen modal, width-clamped to the phone frame. Header + scroll body +
// optional sticky footer (composer). Backdrop tap closes.
function Sheet({ title, onClose, children, footer }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'color-mix(in oklch, var(--shadow, #000) 45%, transparent)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          height: '100%',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            paddingTop: 'env(safe-area-inset-top)',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px' }}>
            <IconBtn onClick={onClose} title="Close">
              <Icon.chevL size={18} />
            </IconBtn>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0 }}>{title}</div>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
        {footer}
      </div>
    </div>
  );
}

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

function TicketComposeSheet({ m, org, session, onClose }) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState('normal');
  const [photo, setPhoto] = useState(null); // { file, preview }
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    return () => {
      if (photo?.preview) URL.revokeObjectURL(photo.preview);
    };
  }, [photo]);

  function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setPhoto((prev) => {
      if (prev?.preview) URL.revokeObjectURL(prev.preview);
      return { file, preview: URL.createObjectURL(file) };
    });
  }

  async function submit() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      let photoUrl = null;
      if (photo?.file) photoUrl = await uploadTicketPhoto(org?.id, photo.file);
      await createManualTicket({
        organizationId: org?.id,
        title: t,
        body: note.trim() || null,
        priority,
        createdBy: session?.userId,
        photoUrl,
      });
      onClose();
    } catch {
      setBusy(false);
      alertDialog({ title: m('tickets.new'), body: m('tickets.err') });
    }
  }

  return (
    <Sheet
      title={m('tickets.new')}
      onClose={onClose}
      footer={
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--border)',
            padding: '10px 14px',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          }}
        >
          <button
            onClick={submit}
            disabled={!title.trim() || busy}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 12,
              border: 'none',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              background: title.trim() && !busy ? 'linear-gradient(135deg, #10b981, #0ea5e9)' : 'var(--surface-3)',
              color: title.trim() && !busy ? '#fff' : 'var(--text-faint)',
              cursor: title.trim() && !busy ? 'pointer' : 'default',
            }}
          >
            {busy ? (photo ? m('tickets.uploading') : m('tickets.sending')) : m('tickets.raise')}
          </button>
        </div>
      }
    >
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={m('tickets.title_ph')}
          autoFocus
          style={{
            width: '100%',
            padding: '13px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={m('tickets.note_ph')}
          rows={4}
          style={{
            width: '100%',
            resize: 'none',
            padding: '13px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            fontSize: 14.5,
            fontFamily: 'inherit',
            lineHeight: 1.4,
            outline: 'none',
          }}
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={pickPhoto}
          style={{ display: 'none' }}
        />
        {photo ? (
          <div
            style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}
          >
            <img
              src={photo.preview}
              alt=""
              style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}
            />
            <button
              onClick={() =>
                setPhoto((p) => {
                  if (p?.preview) URL.revokeObjectURL(p.preview);
                  return null;
                })
              }
              aria-label="Remove"
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 30,
                height: 30,
                borderRadius: 999,
                border: 'none',
                background: 'color-mix(in oklch, #000 55%, transparent)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Icon.close size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '13px',
              borderRadius: 12,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              border: '1px dashed var(--border-strong)',
              background: 'var(--surface-2)',
              color: 'var(--text-soft)',
              cursor: 'pointer',
            }}
          >
            <Icon.camera size={16} /> {m('tickets.add_photo')}
          </button>
        )}

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              marginBottom: 8,
            }}
          >
            {m('tickets.priority')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {PRIORITIES.map((p) => {
              const active = priority === p;
              const danger = p === 'high' || p === 'urgent';
              return (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  style={{
                    padding: '10px 4px',
                    borderRadius: 10,
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: `1px solid ${active ? (danger ? 'var(--risk)' : 'var(--accent, #10b981)') : 'var(--border)'}`,
                    background: active
                      ? danger
                        ? 'color-mix(in oklch, var(--risk) 14%, transparent)'
                        : 'color-mix(in oklch, var(--ok) 14%, transparent)'
                      : 'var(--surface-2)',
                    color: active ? (danger ? 'var(--risk)' : 'var(--ok)') : 'var(--text-dim)',
                  }}
                >
                  {m(`prio.${p}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function TicketDetailSheet({ m, org, session, ticket, onClose }) {
  const { rows: comments, loaded } = useTicketComments(ticket.id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  async function sendComment() {
    const b = text.trim();
    if (!b || sending) return;
    setSending(true);
    try {
      await addTicketComment(ticket.id, b, {
        authorOrgId: org?.id,
        authorUserId: session?.userId,
        authorLabel: session?.name,
      });
      setText('');
    } catch {
      alertDialog({ title: m('tickets.comments'), body: m('tickets.err') });
    }
    setSending(false);
  }

  return (
    <Sheet
      title={ticket.title}
      onClose={onClose}
      footer={
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: '10px 12px',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendComment();
              }
            }}
            placeholder={m('tickets.comment_ph')}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              maxHeight: 120,
              padding: '11px 14px',
              borderRadius: 20,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              fontSize: 15,
              fontFamily: 'inherit',
              lineHeight: 1.35,
              outline: 'none',
            }}
          />
          <button
            onClick={sendComment}
            disabled={sending || !text.trim()}
            aria-label="Send"
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 999,
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: text.trim() && !sending ? 'linear-gradient(135deg, #10b981, #0ea5e9)' : 'var(--surface-3)',
              color: text.trim() && !sending ? '#fff' : 'var(--text-faint)',
              cursor: text.trim() && !sending ? 'pointer' : 'default',
            }}
          >
            <Icon.send size={17} />
          </button>
        </div>
      }
    >
      <div ref={scrollerRef} style={{ height: '100%', overflow: 'auto', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <Pill tone={statusTone(ticket.status)}>{m(`status.${ticket.status}`)}</Pill>
          {ticket.priority && ticket.priority !== 'normal' && (
            <Pill tone={ticket.priority === 'urgent' || ticket.priority === 'high' ? 'risk' : 'neutral'}>
              {m(`prio.${ticket.priority}`)}
            </Pill>
          )}
          {ticket.location_label && (
            <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{ticket.location_label}</span>
          )}
        </div>
        {ticket.body && (
          <div
            style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: 14 }}
          >
            {ticket.body}
          </div>
        )}
        {ticket.photo_url && (
          <a href={ticket.photo_url} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: 18 }}>
            <img
              src={ticket.photo_url}
              alt=""
              style={{
                width: '100%',
                maxHeight: 320,
                objectFit: 'cover',
                borderRadius: 12,
                border: '1px solid var(--border)',
                display: 'block',
              }}
            />
          </a>
        )}

        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            padding: '4px 0 10px',
            borderTop: '1px solid var(--border)',
          }}
        >
          {m('tickets.comments')}
          {comments.length > 0 ? ` · ${comments.length}` : ''}
        </div>

        {loaded && comments.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-faint)', fontStyle: 'italic' }}>
            {m('tickets.no_comments')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {comments.map((c) => {
            const mine = c.author_user_id === session?.userId;
            return (
              <div key={c.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '85%' }}>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: 'var(--text-faint)',
                      marginBottom: 3,
                      textAlign: mine ? 'right' : 'left',
                    }}
                  >
                    {c.author_label || '—'} · {hhmm(c.created_at)}
                  </div>
                  <div
                    style={{
                      padding: '9px 12px',
                      borderRadius: 14,
                      fontSize: 14,
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      background: mine ? 'linear-gradient(135deg, #10b981, #0ea5e9)' : 'var(--surface-2)',
                      color: mine ? '#fff' : 'var(--text)',
                      border: mine ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {c.body}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
