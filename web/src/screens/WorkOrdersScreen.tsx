import { useMemo, useState } from 'react';
import {
  useCompleteWorkOrder,
  useCreateWorkOrder,
  useLocations,
  useMe,
  useWorkOrders,
} from '../queries/useData';
import type { WorkOrder, WorkOrderStatus } from '../api/types';
import { Button, Card, DataError, PanelHead, Pill, TextInput } from '../ui/primitives';

const statusTone = (s: WorkOrderStatus) =>
  s === 'done' ? 'ok' : s === 'open' ? 'neutral' : s === 'in_progress' ? 'warn' : 'risk';

function WorkOrderCard({
  order,
  locationName,
  onComplete,
  busy,
  canComplete,
}: {
  order: WorkOrder;
  locationName: string | null;
  onComplete: (id: string) => void;
  busy: boolean;
  canComplete: boolean;
}) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{order.title}</div>
          {locationName && (
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>{locationName}</div>
          )}
        </div>
        <Pill tone={statusTone(order.status)}>{order.status.replace('_', ' ')}</Pill>
      </div>
      {order.description && <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.45 }}>{order.description}</div>}
      {order.photoUrl && (
        <a href={order.photoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>
          View completion photo
        </a>
      )}
      {canComplete && order.status !== 'done' && order.status !== 'cancelled' && (
        <Button disabled={busy} onClick={() => onComplete(order.id)}>
          Mark complete
        </Button>
      )}
    </Card>
  );
}

export function WorkOrdersScreen() {
  const { data: me } = useMe();
  const { data: orders = [], isLoading, isError, refetch } = useWorkOrders();
  const { data: locations = [] } = useLocations();
  const createOrder = useCreateWorkOrder();
  const completeOrder = useCompleteWorkOrder();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationId, setLocationId] = useState('');
  const [filter, setFilter] = useState<'all' | WorkOrderStatus>('all');

  const locById = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations]);
  const canCreate = me?.orgRole === 'owner' || me?.orgRole === 'admin' || me?.orgRole === 'member';
  const canComplete = canCreate;

  const visible = useMemo(
    () => (filter === 'all' ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter],
  );

  const openCount = orders.filter((o) => o.status === 'open' || o.status === 'in_progress').length;

  if (isError) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <DataError message="Couldn't load work orders." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <PanelHead
          title="Work orders"
          right={
            <Pill tone={openCount > 0 ? 'warn' : 'ok'}>
              {openCount} open
            </Pill>
          }
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {(['all', 'open', 'in_progress', 'done'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: filter === f ? 'var(--accent-soft)' : 'transparent',
                color: filter === f ? 'var(--accent)' : 'var(--text-soft)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>No work orders in this view.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visible.map((o) => (
              <WorkOrderCard
                key={o.id}
                order={o}
                locationName={o.locationId ? locById.get(o.locationId) ?? null : null}
                onComplete={(id) => completeOrder.mutate({ workOrderId: id })}
                busy={completeOrder.isPending}
                canComplete={canComplete}
              />
            ))}
          </div>
        )}
      </Card>

      {canCreate && (
        <Card>
          <PanelHead title="Create work order" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
            <TextInput placeholder="Title" value={title} onChange={setTitle} ariaLabel="Work order title" />
            <TextInput placeholder="Description (optional)" value={description} onChange={setDescription} ariaLabel="Description" />
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontFamily: 'inherit',
                fontSize: 13,
              }}
            >
              <option value="">No location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <Button
              disabled={!title.trim() || createOrder.isPending}
              onClick={() => {
                createOrder.mutate({
                  title: title.trim(),
                  description: description.trim() || null,
                  locationId: locationId || null,
                });
                setTitle('');
                setDescription('');
                setLocationId('');
              }}
            >
              Create
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
