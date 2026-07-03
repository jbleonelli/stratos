// Merlin Field — the Today tab (the worker's shift for today) + its data hook,
// extracted from MobileApp.jsx (G2 monolith split). Self-contained: receives
// the translator `m` and the `today` snapshot as props; owns RouteCard +
// TaskList, the tap-to-complete checklist that calls worker_complete_route_task.

import React, { useState } from 'react';
import { Icon } from './icons.jsx';
import { Card, Pill, MerlinAvatar } from './primitives.jsx';
import { useSession } from './auth.js';
import { alertDialog } from './dialogs.jsx';
import { hhmm } from './mobile-utils.js';
import { useWorkerMember, useWorkerRoutes, useWorkerRouteTasks, useCompleteRouteTask } from './queries/worker.ts';

// ── data hook ──
// Shared by the Today tab (renders it) and the chat (grounds on it). Mirrors
// WorkerApp.MyShiftsToday: resolve the worker's team_member row, then today's
// assigned + active routes, sorted by start time. Reuses the shared worker
// queries (useWorkerMember → useWorkerRoutes) so the tri-state contract below is
// preserved: member is `undefined` while loading, `null` when the login isn't
// linked, the row when it is.
export function useWorkerToday(session) {
  const { data: member } = useWorkerMember(session?.userId);
  const routesQuery = useWorkerRoutes(member || undefined);
  // Not-linked (member===null) resolves routes to [] immediately; while the
  // member is still loading (undefined) or routes are in flight, keep null.
  const routes = member === null ? [] : (routesQuery.data ?? null);

  return {
    member,
    routes,
    loading: member === undefined || routes === null,
    linked: member !== null && member !== undefined,
  };
}

// ───────────────────────── Today ─────────────────────────
export function TodayTab({ m, today, onAskNow }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <HeroAsk m={m} onAskNow={onAskNow} />

      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          padding: '2px 2px 0',
        }}
      >
        {m('today.shifts')}
      </div>

      {today.loading && (
        <div style={{ textAlign: 'center', padding: 36, color: 'var(--text-dim)', fontSize: 13 }}>
          {m('today.loading')}
        </div>
      )}

      {!today.loading && !today.linked && <UnlinkedCard m={m} />}

      {!today.loading && today.linked && today.routes.length === 0 && (
        <Card>
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
            {m('today.none')}
          </div>
        </Card>
      )}

      {!today.loading && today.linked && today.routes.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {today.routes.map((r) => (
            <RouteCard key={r.id} route={r} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function HeroAsk({ m, onAskNow }) {
  return (
    <button
      onClick={onAskNow}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        border: '1px solid color-mix(in oklch, var(--ok) 35%, var(--border))',
        borderRadius: 16,
        padding: 18,
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, color-mix(in oklch, #10b981 16%, var(--surface)), color-mix(in oklch, #0ea5e9 14%, var(--surface)))',
        color: 'var(--text)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <MerlinAvatar size={30} />
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: 'var(--ok)',
          }}
        >
          {m('today.eyebrow')}
        </div>
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.01, lineHeight: 1.15 }}>{m('today.cta')}</div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--text-soft)', fontSize: 13 }}
      >
        <span>{m('today.cta_sub')}</span>
        <Icon.chevR size={13} />
      </div>
    </button>
  );
}

function UnlinkedCard({ m }) {
  return (
    <Card>
      <div style={{ padding: 30, textAlign: 'center' }}>
        <Icon.people size={26} style={{ color: 'var(--text-faint)' }} />
        <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 10, color: 'var(--text)' }}>
          {m('today.unlinked_t')}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--text-dim)',
            marginTop: 6,
            maxWidth: 320,
            marginInline: 'auto',
            lineHeight: 1.45,
          }}
        >
          {m('today.unlinked_b')}
        </div>
      </div>
    </Card>
  );
}

function RouteCard({ route, m }) {
  const [open, setOpen] = useState(false);
  return (
    <Card pad={false}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'var(--text)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--text-soft)',
            width: 52,
            flexShrink: 0,
          }}
        >
          {route.expected_start_time ? route.expected_start_time.slice(0, 5) : '—'}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {route.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            {route.service_type}
            {route.expected_duration_min ? ` · ${route.expected_duration_min} min` : ''}
            {route.myRole && route.myRole !== 'primary' ? ` · ${route.myRole}` : ''}
          </div>
        </div>
        {route.sla_threshold_min != null && <Pill tone="warn">{`SLA ${route.sla_threshold_min}m`}</Pill>}
        <Icon.chevR
          size={13}
          style={{
            color: 'var(--text-dim)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform .12s',
            flexShrink: 0,
          }}
        />
      </button>
      {open && <TaskList routeId={route.id} m={m} />}
    </Card>
  );
}

function TaskList({ routeId, m }) {
  const session = useSession();
  const { data, isSuccess } = useWorkerRouteTasks(routeId, session?.userId);
  const tasks = isSuccess ? data.tasks : null; // null while loading (preserved contract)
  const doneAt = data?.doneAt ?? {}; // route_task_id → completed_at ISO (this worker, today)
  const completeTask = useCompleteRouteTask(routeId, session?.userId);
  const [busy, setBusy] = useState(() => new Set());

  async function complete(task) {
    if (doneAt[task.id] || busy.has(task.id)) return;
    setBusy((prev) => new Set(prev).add(task.id));
    try {
      // onSuccess patches the cached doneAt so the row checks off instantly.
      await completeTask.mutateAsync(task.id);
    } catch {
      alertDialog({ title: m('today.mark_done'), body: m('today.complete_err') });
    } finally {
      setBusy((prev) => {
        const n = new Set(prev);
        n.delete(task.id);
        return n;
      });
    }
  }

  if (tasks === null) {
    return <div style={{ padding: '8px 14px 14px', color: 'var(--text-dim)', fontSize: 12 }}>{m('today.loading')}</div>;
  }
  if (tasks.length === 0) {
    return (
      <div style={{ padding: '8px 14px 14px', color: 'var(--text-faint)', fontSize: 12, fontStyle: 'italic' }}>
        {m('today.no_tasks')}
      </div>
    );
  }
  const doneCount = tasks.filter((t) => doneAt[t.id]).length;
  return (
    <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--border)' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          padding: '10px 0 8px',
        }}
      >
        {doneCount}/{tasks.length} {m('today.tasks')}
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {tasks.map((task) => {
          const done = !!doneAt[task.id];
          const isBusy = busy.has(task.id);
          return (
            <button
              key={task.id}
              onClick={() => complete(task)}
              disabled={done || isBusy}
              aria-label={m('today.mark_done')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 12px',
                width: '100%',
                textAlign: 'left',
                fontFamily: 'inherit',
                background: done ? 'color-mix(in oklch, var(--ok) 8%, var(--surface-2))' : 'var(--surface-2)',
                border: `1px solid ${done ? 'color-mix(in oklch, var(--ok) 30%, var(--border))' : 'var(--border)'}`,
                borderRadius: 10,
                cursor: done ? 'default' : 'pointer',
                transition: 'background .15s, border-color .15s',
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: done ? 'linear-gradient(135deg, #10b981, #0ea5e9)' : 'var(--surface)',
                  border: done ? 'none' : '2px solid var(--border-strong)',
                  color: '#fff',
                  opacity: isBusy ? 0.5 : 1,
                }}
              >
                {done && <Icon.check size={14} />}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: done ? 'var(--text-dim)' : 'var(--text)',
                    textDecoration: done ? 'line-through' : 'none',
                  }}
                >
                  {task.name}
                </span>
                {(task.description || task.building_zones?.name) && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                    {task.building_zones?.name}
                    {task.building_zones?.name && task.description ? ' · ' : ''}
                    {task.description}
                  </span>
                )}
              </span>
              {done ? (
                <Pill tone="ok">{`${m('today.done')} · ${hhmm(doneAt[task.id])}`}</Pill>
              ) : (
                task.sla_minutes != null && <Pill tone="warn">{`${task.sla_minutes}m`}</Pill>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
