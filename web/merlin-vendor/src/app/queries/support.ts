// React Query hooks for the /platform/support/tickets help-desk surface.
//
// The realtime ticket *list* (public.support_tickets, with a supabase.channel
// subscription) stays in-place in PlatformSupportTickets.jsx using the untyped
// `supabase` client. This module holds the cleaner non-realtime reads (org
// picker, the per-ticket message thread + attachments, the support_config
// settings blob) plus the two non-list writes (settings upsert, ticket patch).
//
// Reads use the typed `sb` client. The `support_tickets` UPDATE feeds the
// realtime list → it intentionally carries NO invalidateQueries (the channel
// re-pulls). The `platform_settings` upsert feeds the non-realtime settings
// read → its caller invalidates ['support-config'] on success.
import { useMutation, useQuery } from '@tanstack/react-query';
import { sb } from '../db-client';
import type { Json, TablesInsert, TablesUpdate } from '../../types/db';

// Org list for the "link unmapped ticket → org" picker. Stable across the
// session, so a single fetch with no realtime is fine.
export function useSupportOrgs() {
  return useQuery({
    queryKey: ['support-orgs'],
    queryFn: async () => {
      const { data, error } = await sb.from('organizations').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

// The support_config settings blob (platform_settings key='support_config').
// Returns the raw `value` object (or {} when unset) — the SupportSettings
// editor maps it onto its form defaults.
export function useSupportConfig() {
  return useQuery({
    queryKey: ['support-config'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('platform_settings')
        .select('value')
        .eq('key', 'support_config')
        .maybeSingle();
      if (error) throw error;
      return (data?.value ?? {}) as Record<string, unknown>;
    },
  });
}

export type SupportThread = {
  messages: Array<Record<string, unknown>>;
  attByMsg: Record<string, Array<Record<string, unknown>>>;
};

// The full message thread + attachments for one ticket. Keyed on
// (ticketId, lastMessageAt) so a new inbound/outbound message (which bumps
// last_message_at on the ticket) re-fetches the thread.
export function useSupportThread(ticketId: string | null, lastMessageAt: string | null) {
  return useQuery({
    queryKey: ['support-thread', ticketId, lastMessageAt],
    enabled: Boolean(ticketId),
    queryFn: async (): Promise<SupportThread> => {
      const [{ data: msgs, error: msgErr }, { data: atts, error: attErr }] = await Promise.all([
        sb.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
        sb
          .from('support_attachments')
          .select('id, message_id, filename, content_type, size_bytes')
          .eq('ticket_id', ticketId),
      ]);
      if (msgErr) throw msgErr;
      if (attErr) throw attErr;
      const attByMsg: SupportThread['attByMsg'] = {};
      for (const a of atts ?? []) {
        (attByMsg[a.message_id] ||= []).push(a);
      }
      return { messages: msgs ?? [], attByMsg };
    },
  });
}

// Patch one support ticket by id (status / priority / assignee / org link).
// NO onSuccess invalidation: the support_tickets list this feeds is realtime-
// subscribed in PlatformSupportTickets.jsx, so it re-pulls itself the instant
// the write lands. mutateAsync rejects with the PostgrestError on failure,
// preserving the caller's existing setErr-then-stop semantics.
export function usePatchSupportTicket() {
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<'support_tickets'> }) => {
      const { error } = await sb.from('support_tickets').update(patch).eq('id', id);
      if (error) throw error;
    },
  });
}

// Upsert the support_config settings blob. Feeds the non-realtime
// useSupportConfig read → the caller invalidates ['support-config'] onSuccess.
export function useSaveSupportConfig() {
  return useMutation({
    mutationFn: async (value: Json) => {
      const row: TablesInsert<'platform_settings'> = { key: 'support_config', value };
      const { error } = await sb.from('platform_settings').upsert(row, { onConflict: 'key' });
      if (error) throw error;
    },
  });
}
