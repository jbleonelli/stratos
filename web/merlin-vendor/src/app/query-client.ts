// Shared TanStack Query client for the frontend data layer.
//
// Phase 2 of the frontend plan: components were each hand-rolling
// useState+useEffect+supabase fetches (38 of them, ~331 useEffects), which meant
// every fetch re-implemented loading/error/refetch and was prone to races and
// missing cleanup. React Query centralises caching, dedup, and request lifecycle
// so a query hook is a one-liner and stale/loading/error are handled once.
//
// Defaults are conservative for a data-heavy dashboard:
//   - staleTime 30s: most dashboard data tolerates being a little stale; avoids
//     refetch storms when components mount/unmount during navigation.
//   - refetchOnWindowFocus off: the app is long-lived in a tab; focus-refetch
//     was a surprising source of flicker. Opt back in per-query where it matters.
//   - retry 1: one retry smooths transient blips without hammering on real errors.
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
