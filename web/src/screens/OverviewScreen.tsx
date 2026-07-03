import { AsksPanel } from '../components/AsksPanel';
import { EventsPanel } from '../components/EventsPanel';

export function OverviewScreen() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <div>
          <AsksPanel />
        </div>
        <div>
          <EventsPanel />
        </div>
      </div>
    </div>
  );
}
