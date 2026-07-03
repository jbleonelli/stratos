// Query hooks for the /platform back-office.
import { useQuery } from '@tanstack/react-query';
import { useT } from '../i18n.js';
// eslint-disable-next-line import/extensions
import { supabase } from '../supabase.js';

const POLL_MS = 60_000;

// Provider status snapshot from /api/platform/status (bearer-authed). A plain
// REST fetch — shows React Query isn't only for Supabase: it folds the manual
// busy flag, refreshedAt, poll interval, and refresh button into one hook
// (isFetching / dataUpdatedAt / refetchInterval / refetch).
export function usePlatformStatus() {
  const t = useT();
  return useQuery({
    queryKey: ['platform-status'],
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error(t('platform.status.err.no_session'));
      const r = await fetch('/api/platform/status', {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(payload.error || t('platform.status.err.fetch'));
      return payload as { providers?: Array<{ indicator?: string; [k: string]: unknown }>; [k: string]: unknown };
    },
  });
}
