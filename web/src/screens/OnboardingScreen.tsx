import { useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAcceptOrgInvite,
  useCreateOrganization,
  useMyPendingInvites,
} from '../queries/useData';
import { Button, Card, PanelHead, TextInput, Wordmark } from '../ui/primitives';

export function OnboardingScreen({ signOut }: { signOut: () => void }) {
  const qc = useQueryClient();
  const createOrg = useCreateOrganization();
  const acceptInvite = useAcceptOrgInvite();
  const { data: pending = [] } = useMyPendingInvites();
  const [company, setCompany] = useState('');
  const [token, setToken] = useState('');

  const refreshSession = async () => {
    await fetchAuthSession({ forceRefresh: true });
    await qc.invalidateQueries({ queryKey: ['session'] });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'var(--bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <Wordmark height={28} />
          <h1 style={{ margin: '16px 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
            Welcome to Stratos
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-dim)' }}>
            Create your organization or accept an invite to get started.
          </p>
        </div>

        <Card>
          <PanelHead title="Create organization" />
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!company.trim()) return;
              createOrg.mutate({ companyName: company.trim() }, { onSuccess: () => refreshSession() });
            }}
          >
            <TextInput value={company} onChange={setCompany} ariaLabel="Company name" />
            <Button type="submit" disabled={createOrg.isPending}>
              {createOrg.isPending ? '…' : 'Create organization'}
            </Button>
          </form>
        </Card>

        <Card>
          <PanelHead title="Accept invite" />
          {pending.length > 0 && (
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-soft)' }}>
              You have {pending.length} pending invite{pending.length === 1 ? '' : 's'} for {pending[0].email}.
            </p>
          )}
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!token.trim()) return;
              acceptInvite.mutate(
                { token: token.trim() },
                {
                  onSuccess: async () => {
                    await refreshSession();
                  },
                },
              );
            }}
          >
            <TextInput value={token} onChange={setToken} ariaLabel="Invite token" />
            <Button type="submit" disabled={acceptInvite.isPending}>
              {acceptInvite.isPending ? '…' : 'Accept invite'}
            </Button>
          </form>
        </Card>

        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
