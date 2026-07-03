import { useEvents, useIngestEvent } from '../queries/useData';
import { prettyPayload, timeAgo } from './format';
import type { EventSeverity } from '../api/types';
import { Button, Card, DataError, PanelHead, Pill } from '../ui/primitives';
import { Icon } from '../ui/icons';

const sevTone = (s: EventSeverity) => (s === 'critical' ? 'risk' : s === 'warning' ? 'warn' : 'info');

export function EventsPanel() {
  const { data: events = [], isLoading, isError, refetch } = useEvents();
  const ingest = useIngestEvent();

  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <PanelHead
        title="Events"
        right={
          <Button
            variant="ghost"
            disabled={ingest.isPending}
            onClick={() =>
              ingest.mutate({
                kind: 'manual',
                severity: 'info',
                externalId: crypto.randomUUID(),
                payload: JSON.stringify({ source: 'web', at: new Date().toISOString() }),
              })
            }
          >
            <Icon.plus size={14} /> {ingest.isPending ? '…' : 'Test event'}
          </Button>
        }
      />

      {isError ? (
        <DataError message="Couldn’t load events." onRetry={() => refetch()} compact />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((e) => (
            <li
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '9px 12px',
                animation: 'ds-fade-in .2s ease',
              }}
            >
              <Pill tone={sevTone(e.severity)}>{e.severity}</Pill>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{e.kind}</span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: 'var(--mono)',
                  fontSize: 11.5,
                  color: 'var(--text-dim)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {prettyPayload(e.payload)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0 }}>{timeAgo(e.createdAt)}</span>
            </li>
          ))}
          {isLoading && <li style={{ color: 'var(--text-dim)', fontSize: 13, padding: '6px 2px' }}>Loading…</li>}
          {!isLoading && events.length === 0 && (
            <li style={{ color: 'var(--text-faint)', textAlign: 'center', padding: 20, fontSize: 13 }}>No events yet.</li>
          )}
        </ul>
      )}
    </Card>
  );
}
