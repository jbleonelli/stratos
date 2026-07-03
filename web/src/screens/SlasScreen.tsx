import { useMemo } from 'react';
import { useIncidents, useServiceContracts } from '../queries/useData';
import type { EventSeverity, ServiceContract } from '../api/types';
import { AdaptivLoader, Card, DataError, PanelHead, Pill, Ring } from '../ui/primitives';

function adherenceForContract(contract: ServiceContract, incidents: { severity: EventSeverity; locationId: string | null }[]) {
  const locSet = new Set(contract.locationIds);
  const scoped = incidents.filter((i) => !i.locationId || locSet.has(i.locationId));
  if (contract.slaRules.length === 0) return { pct: 100, breaches: 0, target: 95 };

  let breaches = 0;
  for (const inc of scoped) {
    const rule = contract.slaRules.find((r) => r.severity === inc.severity);
    if (rule && (inc.severity === 'critical' || inc.severity === 'warning')) breaches++;
  }
  const totalChecks = Math.max(scoped.length, contract.slaRules.length * 2);
  const pct = Math.max(0, Math.round(((totalChecks - breaches) / totalChecks) * 100));
  const target = 95;
  return { pct, breaches, target };
}

export function SlasScreen() {
  const { data: contracts = [], isLoading, isError, refetch } = useServiceContracts('active');
  const { data: incidents = [] } = useIncidents(100);

  const rows = useMemo(
    () =>
      contracts.map((c) => ({
        contract: c,
        ...adherenceForContract(c, incidents),
      })),
    [contracts, incidents],
  );

  const overall = useMemo(() => {
    if (rows.length === 0) return { pct: 100, breaches: 0 };
    const pct = Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length);
    const breaches = rows.reduce((s, r) => s + r.breaches, 0);
    return { pct, breaches };
  }, [rows]);

  if (isError) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <DataError message="Couldn't load SLA performance." onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', placeItems: 'center', padding: 48 }}>
        <AdaptivLoader size="md" label="Loading SLAs…" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--accent-pink)' }}>PREDICT</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>SLA performance</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-dim)' }}>
          Contract response targets vs open incidents on covered locations.
        </p>
      </div>

      <Card style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Ring
          pct={overall.pct}
          size={64}
          tone={overall.pct >= 95 ? 'ok' : overall.pct >= 80 ? 'warn' : 'risk'}
        />
        <div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{overall.pct}% adherence</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
            {overall.breaches} potential breach{overall.breaches === 1 ? '' : 'es'} across {contracts.length} active contract
            {contracts.length === 1 ? '' : 's'}
          </div>
        </div>
      </Card>

      {contracts.length === 0 ? (
        <Card style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
          No active service contracts — add SLAs under Operate → Contracts.
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(({ contract, pct, breaches, target }) => (
            <Card key={contract.id} style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{contract.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 4 }}>
                    {contract.customerOrgName} → {contract.contractorOrgName}
                  </div>
                </div>
                <Pill tone={pct >= target ? 'ok' : pct >= 80 ? 'warn' : 'risk'}>{pct}% vs {target}% target</Pill>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {contract.slaRules.map((r) => (
                  <Pill key={r.severity} tone={r.severity === 'critical' ? 'risk' : r.severity === 'warning' ? 'warn' : 'neutral'}>
                    {r.severity}: respond in {r.responseMinutes}m
                  </Pill>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
                {contract.locationIds.length} location{contract.locationIds.length === 1 ? '' : 's'} · {breaches} open incident
                {breaches === 1 ? '' : 's'} in scope
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card style={{ padding: 14 }}>
        <PanelHead title="All SLA rules" />
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)' }}>
          Full incident-to-resolution timing and automated breach detection ships with the servicing agent slice.
        </p>
      </Card>
    </div>
  );
}
