import { useMemo, useState } from 'react';
import {
  useContractorOrganizations,
  useCreateServiceContract,
  useLocations,
  useMe,
  useOrganization,
  useServiceContracts,
  useUpdateContractStatus,
} from '../queries/useData';
import type { ContractStatus, ServiceContract } from '../api/types';
import { Button, Card, DataError, PanelHead, Pill, TextInput } from '../ui/primitives';

const statusTone = (s: ContractStatus) =>
  s === 'active' ? 'ok' : s === 'draft' ? 'neutral' : s === 'suspended' ? 'warn' : 'risk';

function ContractCard({
  contract,
  canManage,
  onActivate,
  busy,
}: {
  contract: ServiceContract;
  canManage: boolean;
  onActivate: (id: string) => void;
  busy: boolean;
}) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{contract.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>
            {contract.customerOrgName} → {contract.contractorOrgName}
          </div>
        </div>
        <Pill tone={statusTone(contract.status)}>{contract.status}</Pill>
      </div>
      {contract.referenceCode && <Pill tone="neutral">{contract.referenceCode}</Pill>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {contract.slaRules.map((r) => (
          <Pill key={r.severity} tone={r.severity === 'critical' ? 'risk' : r.severity === 'warning' ? 'warn' : 'neutral'}>
            {r.severity}: {r.responseMinutes}m
          </Pill>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
        {contract.locationIds.length} location{contract.locationIds.length === 1 ? '' : 's'} ·{' '}
        {contract.assigneeUserIds.length} assignee{contract.assigneeUserIds.length === 1 ? '' : 's'}
      </div>
      {canManage && contract.status === 'draft' && (
        <Button disabled={busy} onClick={() => onActivate(contract.id)}>
          Activate contract
        </Button>
      )}
    </Card>
  );
}

export function ContractsScreen() {
  const { data: org } = useOrganization();
  const { data: me } = useMe();
  const { data: contracts = [], isLoading, isError, refetch } = useServiceContracts();
  const { data: contractors = [] } = useContractorOrganizations();
  const { data: locations = [] } = useLocations();
  const createContract = useCreateServiceContract();
  const updateStatus = useUpdateContractStatus();
  const [name, setName] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [locationId, setLocationId] = useState('');

  const canManage = me?.orgRole === 'owner' || me?.orgRole === 'admin';
  const isCustomer = org?.kind === 'customer';
  const portfolioLabel = isCustomer ? 'Service contracts' : 'Assigned contracts';

  const locOptions = useMemo(() => locations.filter((l) => l.organizationId === org?.id), [locations, org?.id]);

  if (isError) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <DataError message="Couldn’t load contracts." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <PanelHead title={portfolioLabel} right={<Pill tone="neutral">{contracts.length}</Pill>} />
        {isLoading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
        ) : contracts.length === 0 ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>No contracts yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {contracts.map((c) => (
              <ContractCard
                key={c.id}
                contract={c}
                canManage={canManage && isCustomer}
                busy={updateStatus.isPending}
                onActivate={(id) => updateStatus.mutate({ id, status: 'active' })}
              />
            ))}
          </div>
        )}
      </Card>

      {canManage && isCustomer && (
        <Card>
          <PanelHead title="New contract" />
          <form
            style={{ display: 'grid', gap: 10 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !contractorId || !locationId) return;
              createContract.mutate(
                {
                  name: name.trim(),
                  contractorOrgId: contractorId,
                  locationIds: [locationId],
                  slaRules: [
                    { severity: 'critical', responseMinutes: 60 },
                    { severity: 'warning', responseMinutes: 240 },
                  ],
                },
                {
                  onSuccess: () => {
                    setName('');
                    setLocationId('');
                  },
                },
              );
            }}
          >
            <TextInput value={name} onChange={setName} ariaLabel="Contract name" />
            <select
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
              style={{ fontFamily: 'inherit', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
            >
              <option value="">Select contractor…</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              style={{ fontFamily: 'inherit', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
            >
              <option value="">Select location…</option>
              {locOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={createContract.isPending}>
              {createContract.isPending ? '…' : 'Create draft contract'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
