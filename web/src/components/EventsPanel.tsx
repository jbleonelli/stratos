import { useEvents, useIngestEvent } from '../queries/useData';
import { prettyPayload, timeAgo } from './format';

export function EventsPanel() {
  const { data: events = [], isLoading, isError } = useEvents();
  const ingest = useIngestEvent();

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Events</h2>
        <button
          className="btn ghost"
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
          {ingest.isPending ? '…' : 'Ingest test event'}
        </button>
      </div>

      {isLoading && <p className="muted">Loading…</p>}
      {isError && <p className="error">Couldn’t load events.</p>}

      <ul className="list">
        {events.map((e) => (
          <li key={e.id} className="event">
            <span className={`sev sev-${e.severity}`}>{e.severity}</span>
            <span className="event-kind">{e.kind}</span>
            <span className="event-payload muted">{prettyPayload(e.payload)}</span>
            <span className="muted event-time">{timeAgo(e.createdAt)}</span>
          </li>
        ))}
        {!isLoading && events.length === 0 && <li className="empty">No events yet.</li>}
      </ul>
    </section>
  );
}
