// React hooks + mutators over public.tickets / public.ticket_comments
// (migrations 179–181). A ticket is the follow-able work-item that wraps
// a human-dispatched Merlin action (an agent_escalations row auto-creates
// one via trigger) or a manually-created task. The FM org owns the ticket;
// a contractor assignee can advance its status. See 179_tickets.sql.
//
// Shape returned by useTicketsForOrg:
//   Array<{
//     id, organization_id, location_id, location_label,
//     title, body, status, priority, origin,
//     agent_run_id, event_id, source_action_table, source_action_id,
//     assignee_user_id, assignee_org_id, assignee_label,
//     due_at, acknowledged_at, started_at, completed_at,
//     created_by, created_at, updated_at,
//     comment_count,
//   }>  (with a non-enumerable `.loaded` flag, like useEventsForBuilding)

import { useEffect, useId, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';

export const TICKET_STATUSES = ['open', 'acknowledged', 'in_progress', 'blocked', 'done', 'cancelled'];
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

// Rank for default sort: live work first, terminal states last.
const STATUS_RANK = { open: 0, acknowledged: 1, in_progress: 2, blocked: 3, done: 4, cancelled: 5 };
const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

export function isTerminalStatus(s) {
  return s === 'done' || s === 'cancelled';
}

export function isBreached(t, now = Date.now()) {
  if (!t?.due_at || isTerminalStatus(t.status)) return false;
  return new Date(t.due_at).getTime() < now;
}

// Default ordering used by the tracking view.
export function compareTickets(a, b) {
  const sr = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
  if (sr !== 0) return sr;
  const pr = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
  if (pr !== 0) return pr;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

const TICKET_SELECT = `
  id, organization_id, location_id, location_label,
  title, body, status, priority, origin,
  agent_run_id, event_id, source_action_table, source_action_id,
  assignee_user_id, assignee_org_id, assignee_label,
  due_at, acknowledged_at, started_at, completed_at,
  created_by, created_at, updated_at, photo_url,
  ticket_comments(count)
`;

function flatten(r) {
  if (!r) return r;
  return {
    ...r,
    comment_count: r.ticket_comments?.[0]?.count ?? 0,
    ticket_comments: undefined,
  };
}

/**
 * Read all tickets for the active org — rows the org owns (organization_id)
 * plus rows assigned to it (assignee_org_id), so a contractor sees the work
 * dispatched to them and an FM sees everything in their buildings.
 *
 * The org filter is EXPLICIT, not RLS-implicit: a platform admin's RLS can
 * read every org's tickets, so without this filter another org's tickets leak
 * onto the active org's Tickets page. Realtime already pre-filters by org.
 *
 * @param {string} orgId  active org id (scopes the fetch + realtime listener)
 */
export function useTicketsForOrg(orgId) {
  const channelId = useId();
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(true);
      return undefined;
    }
    setLoaded(false);
    let alive = true;

    (async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .or(`organization_id.eq.${orgId},assignee_org_id.eq.${orgId}`)
        .order('created_at', { ascending: false })
        .limit(500);
      if (!alive) return;
      if (error) captureException(error, { where: 'useTicketsForOrg' });
      setRows(error ? [] : (data || []).map(flatten));
      setLoaded(true);
    })();

    const ch = supabase
      .channel(`tickets_${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        // Realtime delivers every org's rows; cheap pre-filter before the
        // RLS-gated refetch. (A row we can't see refetches to null anyway,
        // but skipping the round-trip keeps the listener quiet.)
        if (row.organization_id !== orgId && row.assignee_org_id !== orgId) {
          // Could still be a row we hold whose org fields we can't see in
          // the slim realtime payload — fall through only on DELETE.
          if (payload.eventType !== 'DELETE') return;
        }
        if (payload.eventType === 'DELETE') {
          setRows((prev) => prev.filter((r) => r.id !== row.id));
          return;
        }
        (async () => {
          const { data } = await supabase.from('tickets').select(TICKET_SELECT).eq('id', row.id).maybeSingle();
          if (!data) {
            // No longer visible to us → drop it if we held it.
            setRows((prev) => prev.filter((r) => r.id !== row.id));
            return;
          }
          const f = flatten(data);
          setRows((prev) => [f, ...prev.filter((r) => r.id !== f.id)]);
        })();
      })
      .subscribe();

    return () => {
      alive = false;
      try {
        supabase.removeChannel(ch);
      } catch {
        /* noop */
      }
    };
  }, [orgId, channelId]);

  return useMemo(() => {
    const arr = rows.slice();
    Object.defineProperty(arr, 'loaded', { value: loaded, enumerable: false });
    return arr;
  }, [rows, loaded]);
}

/**
 * Comment thread for one ticket. Lightweight: fetch on open + realtime
 * append. Returns { rows, loaded }.
 */
export function useTicketComments(ticketId) {
  const channelId = useId();
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      setRows([]);
      setLoaded(true);
      return undefined;
    }
    setLoaded(false);
    let alive = true;

    (async () => {
      const { data, error } = await supabase
        .from('ticket_comments')
        .select('id, ticket_id, author_user_id, author_org_id, author_label, body, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (!alive) return;
      if (error) captureException(error, { where: 'useTicketComments' });
      setRows(error ? [] : data || []);
      setLoaded(true);
    })();

    const ch = supabase
      .channel(`ticket_comments_${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          const row = payload.new || payload.old;
          if (!row) return;
          if (payload.eventType === 'DELETE') {
            setRows((prev) => prev.filter((r) => r.id !== row.id));
            return;
          }
          setRows((prev) => {
            if (prev.some((r) => r.id === row.id)) {
              return prev.map((r) => (r.id === row.id ? row : r));
            }
            return [...prev, row].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          });
        },
      )
      .subscribe();

    return () => {
      alive = false;
      try {
        supabase.removeChannel(ch);
      } catch {
        /* noop */
      }
    };
  }, [ticketId, channelId]);

  return { rows, loaded };
}

/**
 * The contractor orgs an FM can assign a ticket to — distinct counterparties
 * on this manager org's contracts. Lightweight one-shot fetch (no realtime;
 * the contractor roster changes rarely and the dropdown re-mounts on nav).
 * Returns Array<{ id, name }>.
 */
export function useAssignableContractors(managerOrgId) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!managerOrgId) {
      setRows([]);
      return undefined;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('contracts')
        .select('contractor_org_id, contractor_org:organizations!contracts_contractor_org_id_fkey(id, name)')
        .eq('manager_org_id', managerOrgId);
      if (!alive) return;
      const seen = new Map();
      for (const c of data || []) {
        const id = c.contractor_org_id;
        if (id && !seen.has(id)) seen.set(id, { id, name: c.contractor_org?.name || 'Contractor' });
      }
      setRows([...seen.values()].sort((a, b) => a.name.localeCompare(b.name)));
    })();
    return () => {
      alive = false;
    };
  }, [managerOrgId]);
  return rows;
}

// ─── Mutators (RLS + field-guard enforce who can change what) ─────────

export async function setTicketStatus(id, status) {
  const { error } = await supabase.from('tickets').update({ status }).eq('id', id);
  if (error) throw error;
}

// Assign (or unassign) a ticket to a contractor org. Setting assignee_org_id
// fires the ticket_assigned notification trigger (migration 179) → the
// contractor's bell. Pass orgId=null to clear the assignment.
export async function assignTicket(id, { orgId, label }) {
  const { error } = await supabase
    .from('tickets')
    .update({ assignee_org_id: orgId || null, assignee_label: label || null })
    .eq('id', id);
  if (error) throw error;
}

export async function createManualTicket({
  organizationId,
  locationId,
  locationLabel,
  title,
  body,
  priority,
  dueAt,
  assigneeLabel,
  createdBy,
  photoUrl,
}) {
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      organization_id: organizationId,
      location_id: locationId || null,
      location_label: locationLabel || null,
      title,
      body: body || null,
      priority: priority || 'normal',
      due_at: dueAt || null,
      assignee_label: assigneeLabel || null,
      origin: 'manual',
      created_by: createdBy || null,
      photo_url: photoUrl || null,
    })
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function addTicketComment(ticketId, body, { authorOrgId, authorLabel, authorUserId } = {}) {
  const trimmed = (body || '').trim();
  if (!trimmed) return;
  const { error } = await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    body: trimmed,
    author_org_id: authorOrgId || null,
    author_user_id: authorUserId || null,
    author_label: authorLabel || null,
  });
  if (error) throw error;
}
