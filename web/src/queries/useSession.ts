// The caller's identity, read from the Cognito token claims that the pre-token
// Lambda injected (organization_id, platform_role) plus email.

import { useQuery } from '@tanstack/react-query';
import { fetchAuthSession } from 'aws-amplify/auth';

export interface Session {
  orgId: string | null;
  platformRole: string | null;
  email: string | null;
}

export function useSession() {
  return useQuery<Session>({
    queryKey: ['session'],
    queryFn: async () => {
      const { tokens } = await fetchAuthSession();
      const claims = (tokens?.idToken?.payload ?? {}) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === 'string' ? v : null);
      return {
        orgId: str(claims.organization_id),
        platformRole: str(claims.platform_role),
        email: str(claims.email),
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
