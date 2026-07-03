import { useMemo, useState } from 'react';
import { useDevices, useLocations } from '../queries/useData';
import type { DeviceStatus } from '../api/types';
import { Card, DataError, Dot, PanelHead, Pill, TextInput } from '../ui/primitives';

const statusTone = (s: DeviceStatus): 'ok' | 'warn' | 'risk' =>
  s === 'online' ? 'ok' : s === 'maintenance' ? 'warn' : 'risk';

const STATUSES: Array<DeviceStatus | 'all'> = ['all', 'online', 'offline', 'maintenance'];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 11px',
        borderRadius: 999,
        border: `1px solid ${on ? 'var(--accent-line)' : 'var(--border)'}`,
        background: on ? 'var(--accent-soft)' : 'var(--surface)',
        color: on ? 'var(--accent)' : 'var(--text-soft)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

export function DevicesScreen({ initialLocationId = null }: { initialLocationId?: string | null }) {
  const { data: devices = [], isLoading, isError, refetch } = useDevices();
  const { data: locations = [] } = useLocations();
  const [locationFilter, setLocationFilter] = useState<string | 'all'>(initialLocationId ?? 'all');
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  const locName = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of locations) m.set(l.id, l.name);
    return m;
  }, [locations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((d) => {
      if (locationFilter !== 'all' && d.locationId !== locationFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (q && !(d.name.toLowerCase().includes(q) || d.kind.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [devices, locationFilter, statusFilter, query]);

  if (isError) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <DataError message="Couldn’t load devices." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <TextInput value={query} onChange={setQuery} placeholder="Search devices…" ariaLabel="Search devices" />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <Chip key={s} on={statusFilter === s} onClick={() => setStatusFilter(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          <Chip on={locationFilter === 'all'} onClick={() => setLocationFilter('all')}>
            All locations
          </Chip>
          {locations.map((l) => (
            <Chip key={l.id} on={locationFilter === l.id} onClick={() => setLocationFilter(l.id)}>
              {l.name}
            </Chip>
          ))}
        </div>
      </Card>

      <Card>
        <PanelHead
          title="Fleet"
          right={<Pill tone="neutral">{filtered.length} shown</Pill>}
        />
        {isLoading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '6px 2px' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: 'var(--text-faint)', textAlign: 'center', padding: 24, fontSize: 13 }}>
            No devices match.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((d) => (
              <li
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  animation: 'ds-fade-in .2s ease',
                }}
              >
                <Dot tone={statusTone(d.status)} size={9} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{locName.get(d.locationId) ?? '—'}</div>
                </div>
                <Pill tone="neutral">{d.kind}</Pill>
                <Pill tone={statusTone(d.status)}>{d.status}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
