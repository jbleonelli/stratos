// Phase G-3b — Worker view.
// Simplified shell for persona === 'worker' (any user with role in
// {cleaning, maintenance, security}). The landing is "My shifts
// today" — routes the worker is assigned to today, each expandable
// to its task list. No admin, no sidebar, no building tree.
//
// Read-only in G-3b. Task completion writes (mark done, bump
// last_completed_at) are deferred to a follow-up phase so the first
// cut doesn't fight RLS policies workers don't have yet. The header
// badge on each task shows its cadence so workers can see monthly
// items lighting up on the right days.

import React, { useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useSession, logout as doLogout } from './auth.js';
import { ROLES } from './roles.js';
import { useActiveOrg } from './org-data.js';
import { useWorkerMember, useWorkerRoutes, useRouteTasks } from './queries/worker.ts';
import { UserMenu, HelpButton } from './UserMenu.jsx';
import { useT } from './i18n.js';

export function WorkerApp({ onOpenHelp }) {
  const session = useSession();
  const org = useActiveOrg();
  const role = ROLES[session?.role] || ROLES.cleaning;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--surface)',
      }}
    >
      <WorkerTopBar session={session} role={role} org={org} onOpenHelp={onOpenHelp} />
      <main style={{ flex: 1, padding: 'var(--pad)', overflow: 'auto' }}>
        <MyShiftsToday session={session} role={role} />
      </main>
    </div>
  );
}

function WorkerTopBar({ session, role, org, onOpenHelp }) {
  const t = useT();
  return (
    <div
      style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 20px',
        borderBottom: '1px solid var(--border)',
        background: 'color-mix(in oklch, var(--surface) 80%, transparent)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon.check size={14} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{org?.name || '—'}</div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--ok)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.15,
            }}
          >
            {t('worker.my_day')}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <HelpButton onOpen={onOpenHelp} />
        {session && <UserMenu session={session} role={role} onLogout={doLogout} />}
      </div>
    </div>
  );
}

function MyShiftsToday({ session, role }) {
  // Dependent chain via React Query: member → today's routes (gated on member).
  const { data: member, isLoading: memberLoading } = useWorkerMember(session?.userId);
  const memberRow = member ?? null; // null = login not linked to a team_member
  const { data: routesData, isLoading: routesLoading } = useWorkerRoutes(memberRow);

  if (!session?.userId || memberLoading) {
    return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-dim)' }}>Loading your shifts…</div>;
  }
  if (!memberRow) {
    return <NoRosterCard />;
  }
  if (routesLoading) {
    return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-dim)' }}>Loading your shifts…</div>;
  }

  const routes = routesData ?? [];
  const displayName = session?.name || memberRow?.name || 'Worker';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero displayName={displayName} role={role} count={routes.length} />
      {routes.length === 0 && <NothingToday />}
      <div style={{ display: 'grid', gap: 12 }}>
        {routes.map((r) => (
          <RouteCard key={r.id} route={r} />
        ))}
      </div>
    </div>
  );
}

function NoRosterCard() {
  const t = useT();
  return (
    <Card>
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Icon.people size={28} style={{ color: 'var(--text-faint)' }} />
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, color: 'var(--text)' }}>
          {t('worker.no_roster_title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, maxWidth: 420, marginInline: 'auto' }}>
          {t('worker.no_roster_body')}
        </div>
      </div>
    </Card>
  );
}

function Hero({ displayName, role, count }) {
  const t = useT();
  const first = displayName.split(/\s+/)[0] || displayName;
  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, var(--ok) 18%, transparent), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ padding: 'var(--pad)', position: 'relative' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            fontWeight: 700,
          }}
        >
          {t('worker.eyebrow', { role: role?.name || t('worker.eyebrow_default_role') })}
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
          {t('worker.greeting', { name: first })}
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 640 }}>
          {count === 0
            ? t('worker.body_zero')
            : count === 1
              ? t('worker.body_one')
              : t('worker.body_many', { n: count })}
        </p>
      </div>
    </Card>
  );
}

function NothingToday() {
  const t = useT();
  return (
    <Card>
      <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
        {t('worker.nothing_today')}
      </div>
    </Card>
  );
}

const SERVICE_KEY = {
  surface_clean: 'worker.svc.surface_clean',
  deep_clean: 'worker.svc.deep_clean',
  empty_bins: 'worker.svc.empty_bins',
  restock: 'worker.svc.restock',
  inspection: 'worker.svc.inspection',
  patrol: 'worker.svc.patrol',
  other: 'worker.svc.other',
};

const CADENCE_KEY = {
  per_run: 'worker.cad.per_run',
  daily: 'worker.cad.daily',
  weekly: 'worker.cad.weekly',
  biweekly: 'worker.cad.biweekly',
  monthly: 'worker.cad.monthly',
  quarterly: 'worker.cad.quarterly',
  on_condition: 'worker.cad.on_condition',
};

function RouteCard({ route }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <Card pad={false}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'grid',
          gridTemplateColumns: '70px minmax(0, 1fr) 160px 28px',
          gap: 12,
          alignItems: 'center',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'var(--text)',
        }}
      >
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-soft)' }}>
          {route.expected_start_time ? route.expected_start_time.slice(0, 5) : '—'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {route.name}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>
            {SERVICE_KEY[route.service_type] ? t(SERVICE_KEY[route.service_type]) : route.service_type}
            {route.expected_duration_min ? ` · ${t('worker.duration_min', { n: route.expected_duration_min })}` : ''}
            {route.myRole !== 'primary' ? ` · ${route.myRole}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {route.sla_threshold_min != null && (
            <Pill tone="warn">{t('worker.sla_min', { n: route.sla_threshold_min })}</Pill>
          )}
        </div>
        <Icon.chevR
          size={12}
          style={{
            color: 'var(--text-dim)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform .12s',
          }}
        />
      </button>
      {open && <TaskList routeId={route.id} />}
    </Card>
  );
}

function TaskList({ routeId }) {
  const t = useT();
  const { data: tasks = null } = useRouteTasks(routeId);

  if (tasks === null) {
    return (
      <div style={{ padding: '10px 16px 14px', color: 'var(--text-dim)', fontSize: 12 }}>
        {t('worker.loading_tasks')}
      </div>
    );
  }
  if (tasks.length === 0) {
    const svcKey = SERVICE_KEY[tasks.service_type];
    return (
      <div style={{ padding: '10px 16px 14px', color: 'var(--text-faint)', fontSize: 12, fontStyle: 'italic' }}>
        {t('worker.no_tasks_pre')}
        {svcKey ? t(svcKey) : t('worker.svc.this_service')}
        {t('worker.no_tasks_post')}
      </div>
    );
  }

  return (
    <div style={{ padding: '2px 16px 14px', borderTop: '1px solid var(--border)', marginTop: -1 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.15,
          padding: '10px 0 6px',
        }}
      >
        {t('worker.tasks_count', { n: tasks.length })}
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '18px minmax(0, 1fr) auto',
              gap: 10,
              alignItems: 'center',
              padding: '8px 10px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 7,
            }}
          >
            {/* placeholder checkbox - click-to-complete ships in a follow-up */}
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: 'var(--surface)',
                border: '1.5px solid var(--border-strong)',
                cursor: 'not-allowed',
              }}
              title={t('worker.task_completion_phase2')}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{task.name}</div>
              {(task.description || task.building_zones?.name) && (
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1 }}>
                  {task.building_zones?.name && <span>{task.building_zones.name}</span>}
                  {task.building_zones?.name && task.description && <span> · </span>}
                  {task.description}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {task.cadence && task.cadence !== 'per_run' && (
                <Pill tone="info">{CADENCE_KEY[task.cadence] ? t(CADENCE_KEY[task.cadence]) : task.cadence}</Pill>
              )}
              {task.sla_minutes != null && <Pill tone="warn">{t('worker.sla_min', { n: task.sla_minutes })}</Pill>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
