import { useMemo, useState } from 'react';
import { useAsks, useIncidents } from '../queries/useData';
import type { Event, EventSeverity } from '../api/types';
import { prettyPayload, timeAgo } from '../components/format';
import { Card, DataError, Dot, PanelHead, Pill } from '../ui/primitives';
import { Icon } from '../ui/icons';

const sevTone = (s: EventSeverity): 'risk' | 'warn' => (s === 'critical' ? 'risk' : 'warn');

const sevBg = (s: EventSeverity) =>
  s === 'critical' ? 'color-mix(in oklch, var(--risk) 14%, transparent)' : 'color-mix(in oklch, var(--warn) 14%, transparent)';

const sevFg = (s: EventSeverity) => (s === 'critical' ? 'var(--risk)' : 'var(--warn)');

function IncidentRow({ event, askText }: { event: Event; askText?: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="ds-nav-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '12px 4px',
          border: 'none',
          background: expanded ? 'var(--surface-2)' : 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: 'grid',
            placeItems: 'center',
            background: sevBg(event.severity),
            color: sevFg(event.severity),
            flexShrink: 0,
          }}
        >
          <Icon.incident size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{event.kind.replace(/_/g, ' ')}</span>
            <Pill tone={sevTone(event.severity)}>{event.severity}</Pill>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {prettyPayload(event.payload)}
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0 }}>{timeAgo(event.createdAt)}</span>
      </button>

      {expanded && (
        <div
          style={{
            padding: '0 4px 14px 50px',
            animation: 'ds-fade-in .15s ease',
          }}
        >
          <div style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--text-dim)' }}>Signal</strong>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, marginTop: 4 }}>{prettyPayload(event.payload)}</div>
          </div>
          {askText && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--text-dim)' }}>Open ask</strong>
              <div style={{ marginTop: 4 }}>{askText}</div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function IncidentsScreen() {
  const { data: incidents = [], isLoading, isError, refetch } = useIncidents();
  const { data: asks = [] } = useAsks('open');

  const askByEvent = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of asks) if (a.eventId) m.set(a.eventId, a.question);
    return m;
  }, [asks]);

  if (isError) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <DataError message="Couldn’t load incidents." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card pad={false}>
        <div style={{ padding: 'var(--pad)' }}>
          <PanelHead
            title="Incidents"
            right={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Dot tone={incidents.length ? 'warn' : 'off'} pulse={incidents.length > 0} size={7} />
                <Pill tone={incidents.length ? 'warn' : 'neutral'}>{incidents.length} open</Pill>
              </span>
            }
          />
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Warning and critical signals that need operator attention.
          </p>
        </div>

        {isLoading ? (
          <div style={{ padding: '0 var(--pad) var(--pad)', color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
        ) : incidents.length === 0 ? (
          <div style={{ padding: '8px var(--pad) 28px', color: 'var(--text-faint)', textAlign: 'center', fontSize: 13 }}>
            No incidents — all clear.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: '0 var(--pad) var(--pad)' }}>
            {incidents.map((e) => (
              <IncidentRow key={e.id} event={e} askText={askByEvent.get(e.id)} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
