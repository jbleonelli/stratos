// Query hooks for the /platform demo back-office.
import { useQuery } from '@tanstack/react-query';
import { sb } from '../db-client';

// Recent demo invites enriched with each bundle's sign-in summary (earliest /
// latest sign-in across the users an invite created). Two reads — invites, then
// one batched user_sign_ins lookup — aggregated client-side.
export function useDemoInvitesSent() {
  return useQuery({
    queryKey: ['demo-invites-sent'],
    queryFn: async () => {
      const { data: invites, error } = await sb
        .from('demo_invites')
        .select(
          'id, demo_slug, language, sent_to_email, sent_to_name, sent_by_email, status, error_message, created_users, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(100);
      if (error || !invites) return [];

      const allUserIds = new Set<string>();
      for (const inv of invites) {
        for (const u of (inv.created_users as Array<{ user_id?: string }> | null) || []) {
          if (u?.user_id) allUserIds.add(u.user_id);
        }
      }

      const signInsByUser = new Map<string, { first: number; last: number }>();
      if (allUserIds.size > 0) {
        const { data: signIns } = await sb
          .from('user_sign_ins')
          .select('user_id, signed_in_at')
          .in('user_id', Array.from(allUserIds));
        for (const s of signIns || []) {
          if (!s.user_id || !s.signed_in_at) continue;
          const cur = signInsByUser.get(s.user_id);
          const ts = new Date(s.signed_in_at).getTime();
          if (!cur) signInsByUser.set(s.user_id, { first: ts, last: ts });
          else {
            if (ts < cur.first) cur.first = ts;
            if (ts > cur.last) cur.last = ts;
          }
        }
      }

      return invites.map((inv) => {
        let first: number | null = null;
        let last: number | null = null;
        for (const u of (inv.created_users as Array<{ user_id?: string }> | null) || []) {
          const s = u?.user_id ? signInsByUser.get(u.user_id) : null;
          if (!s) continue;
          if (first === null || s.first < first) first = s.first;
          if (last === null || s.last > last) last = s.last;
        }
        return { ...inv, sign_in_summary: { first, last } };
      });
    },
  });
}
