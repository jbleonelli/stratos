import { useLocations } from '../queries/useData';
import type { Location, LocationKind } from '../api/types';
import { Card, DataError, Pill } from '../ui/primitives';
import { Icon } from '../ui/icons';

const kindTone = (k: LocationKind) => (k === 'building' ? 'accent' : k === 'floor' ? 'info' : 'neutral');

function LocationCard({ loc, onOpen }: { loc: Location; onOpen: (id: string) => void }) {
  return (
    <Card interactive style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'ds-fade-in .2s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          <Icon.building size={20} />
        </div>
        <Pill tone={kindTone(loc.kind)}>{loc.kind}</Pill>
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{loc.name}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>
          {loc.deviceCount} {loc.deviceCount === 1 ? 'device' : 'devices'}
        </div>
      </div>

      <button
        onClick={() => onOpen(loc.id)}
        className="ds-nav-row"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          padding: '6px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-soft)',
          cursor: 'pointer',
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        <Icon.device size={14} /> View devices
      </button>
    </Card>
  );
}

export function LocationsScreen({ onOpenDevices }: { onOpenDevices: (locationId: string) => void }) {
  const { data: locations = [], isLoading, isError, refetch } = useLocations();

  if (isError) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <DataError message="Couldn’t load locations." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {isLoading ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
      ) : locations.length === 0 ? (
        <Card>
          <div style={{ color: 'var(--text-faint)', textAlign: 'center', padding: 28, fontSize: 13 }}>
            No locations yet.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {locations.map((loc) => (
            <LocationCard key={loc.id} loc={loc} onOpen={onOpenDevices} />
          ))}
        </div>
      )}
    </div>
  );
}
