// Platform → Team activity
//
// Adaptiv-internal view: who's been signing in, when, from where.
// Cohort is Adaptiv staff + the canned demo accounts (Meridian + 4
// contractor demos). Pulls from user_sign_ins (migration 101) which
// is populated by /api/sessions/record after every successful login.
//
// Tracking starts forward from the migration date — no backfill —
// so accounts that haven't logged in since 2026-05-12 will read
// "Never (yet)" for last sign-in.
//
// IP geo (city / region / country / lat / lng) comes from Vercel's
// x-vercel-ip-* request headers; localhost dev sessions don't reach
// the endpoint at all (CORS), so dev logins don't pollute the table.

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card } from './primitives.jsx';
import { useTeamActivity } from './platform-data.js';
import { useT } from './i18n.js';

function fmtRelative(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
function fmtLocation(s) {
  if (!s) return null;
  return [s.city, s.region, s.country].filter(Boolean).join(', ') || s.ip || null;
}

export function PlatformTeamActivityPage() {
  const t = useT();
  const state = useTeamActivity();
  const [cohort, setCohort] = useState('all'); // all | staff | demos
  const [selected, setSelected] = useState(null); // user row for the drawer

  const rows = useMemo(() => {
    if (!state.rows) return [];
    if (cohort === 'staff') return state.rows.filter((r) => r.accountType === 'staff' || r.accountType === 'owner');
    if (cohort === 'demos') return state.rows.filter((r) => r.accountType === 'demo');
    if (cohort === 'real') return state.rows.filter((r) => r.accountType === 'real');
    return state.rows;
  }, [state.rows, cohort]);

  return (
    <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Hero state={state} t={t} />

      <Card pad={false}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}
        >
          <FilterPills value={cohort} onChange={setCohort} state={state} t={t} />
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {state.ready
              ? t('platform.team.count', { n: rows.length, total: state.cohortSize ?? 0 })
              : t('platform.audit.loading')}
          </div>
        </div>
        <ActivityTable rows={rows} ready={state.ready} onSelect={setSelected} t={t} />
      </Card>

      {selected && <UserSignInsDrawer row={selected} onClose={() => setSelected(null)} t={t} />}
    </div>
  );
}

function Hero({ state, t }) {
  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ padding: 'var(--pad)', position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              fontWeight: 700,
            }}
          >
            {t('platform.team.eyebrow')}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
            {t('platform.team.title')}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13, maxWidth: 760 }}>
            {t('platform.team.body')}
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
            marginTop: 4,
          }}
        >
          <StatTile
            label={t('platform.team.stat.cohort')}
            value={state.ready ? String(state.cohortSize ?? 0) : '—'}
            sub={t('platform.team.stat.cohort_sub')}
            tone="accent"
          />
          <StatTile
            label={t('platform.team.stat.staff')}
            value={state.ready ? String(state.adaptivStaffCount ?? 0) : '—'}
            sub={t('platform.team.stat.staff_sub')}
          />
          <StatTile
            label={t('platform.team.stat.demos')}
            value={state.ready ? String(state.demoCount ?? 0) : '—'}
            sub={t('platform.team.stat.demos_sub')}
            tone="warn"
          />
          <StatTile
            label={t('platform.team.stat.real')}
            value={state.ready ? String(state.realCustomerCount ?? 0) : '—'}
            sub={t('platform.team.stat.real_sub')}
            tone="ok"
          />
          <StatTile
            label={t('platform.team.stat.signins')}
            value={state.ready ? String(state.totalSignIns ?? 0) : '—'}
            sub={t('platform.team.stat.signins_sub')}
            tone={state.totalSignIns ? 'info' : 'neutral'}
          />
          <StatTile
            label={t('platform.team.stat.signins_30d')}
            value={state.ready ? String(state.totalSignIns30d ?? 0) : '—'}
            sub={t('platform.team.stat.signins_30d_sub')}
          />
        </div>
      </div>
    </Card>
  );
}

function StatTile({ label, value, sub, tone }) {
  const palette = {
    ok: { fg: 'var(--ok)', bg: 'color-mix(in oklch, var(--ok) 10%, transparent)' },
    warn: { fg: 'var(--warn)', bg: 'color-mix(in oklch, var(--warn) 10%, transparent)' },
    info: { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
    accent: { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
    neutral: { fg: 'var(--text-soft)', bg: 'var(--surface-2)' },
  }[tone] || { fg: 'var(--text-soft)', bg: 'var(--surface-2)' };
  return (
    <div
      style={{
        padding: 12,
        background: palette.bg,
        borderRadius: 8,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--text-dim)',
          letterSpacing: 0.15,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 20, fontWeight: 700, color: palette.fg, lineHeight: 1.1 }}>{value}</span>
      {sub && <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{sub}</span>}
    </div>
  );
}

function FilterPills({ value, onChange, state, t }) {
  const pills = [
    { id: 'all', labelKey: 'platform.team.filter.all', count: state.cohortSize },
    { id: 'staff', labelKey: 'platform.team.filter.staff', count: state.adaptivStaffCount },
    { id: 'demos', labelKey: 'platform.team.filter.demos', count: state.demoCount },
    { id: 'real', labelKey: 'platform.team.filter.real', count: state.realCustomerCount },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {pills.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
              color: active ? 'var(--accent)' : 'var(--text-soft)',
              border: '1px solid ' + (active ? 'var(--accent-line)' : 'var(--border)'),
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t(p.labelKey)}
            {p.count != null && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, opacity: 0.8 }}>{p.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ActivityTable({ rows, ready, onSelect, t }) {
  const cols = [
    { key: 'displayName', label: t('platform.team.col.user'), flex: '1.5 1 220px' },
    { key: 'accountType', label: t('platform.team.col.type'), flex: '0 1 90px' },
    { key: 'primaryOrg', label: t('platform.team.col.primary_org'), flex: '1.5 1 200px' },
    { key: 'role', label: t('platform.team.col.role'), flex: '0 1 120px' },
    { key: 'lastSignIn', label: t('platform.team.col.last_signin'), flex: '1 1 160px' },
    { key: 'location', label: t('platform.team.col.location'), flex: '1 1 180px' },
    { key: 'signInCount30d', label: t('platform.team.col.signins_30d'), flex: '0 1 100px', align: 'right' },
    { key: 'signInCount', label: t('platform.team.col.signins_total'), flex: '0 1 100px', align: 'right' },
  ];
  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '10px 14px',
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--text-dim)',
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
        }}
      >
        {cols.map((c) => (
          <div key={c.key} style={{ flex: c.flex, textAlign: c.align || 'left' }}>
            {c.label}
          </div>
        ))}
      </div>
      {!ready && (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.audit.loading')}</div>
      )}
      {ready && rows.length === 0 && (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 12 }}>{t('platform.team.empty')}</div>
      )}
      {ready && rows.map((r) => <ActivityRow key={r.userId} r={r} cols={cols} onSelect={onSelect} t={t} />)}
    </div>
  );
}

function ActivityRow({ r, cols, onSelect, t }) {
  const lastTs = r.lastSignIn?.signed_in_at;
  const loc = r.lastSignIn ? fmtLocation(r.lastSignIn) : null;
  const isInactive30d = !lastTs || Date.now() - new Date(lastTs).getTime() > 1000 * 60 * 60 * 24 * 30;
  return (
    <button
      onClick={() => onSelect?.(r)}
      title={t('platform.team.open_user')}
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 14px',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        color: 'var(--text)',
        transition: 'background .12s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ flex: cols[0].flex, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {r.displayName}
        </span>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{r.email}</div>
      </div>
      <div style={{ flex: cols[1].flex, display: 'flex', alignItems: 'center' }}>
        <AccountTypePill type={r.accountType} t={t} />
      </div>
      <div style={{ flex: cols[2].flex, minWidth: 0, fontSize: 12.5 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.primaryOrgName || '—'}
        </div>
        {r.primaryOrgKind && (
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1 }}>{r.primaryOrgKind}</div>
        )}
      </div>
      <div style={{ flex: cols[3].flex, fontSize: 11.5 }}>
        {r.profileRole ? (
          <Pill tone="neutral">{r.profileRole}</Pill>
        ) : (
          <span style={{ color: 'var(--text-faint)' }}>—</span>
        )}
      </div>
      <div style={{ flex: cols[4].flex, fontSize: 12 }}>
        {lastTs ? (
          <>
            <div style={{ color: isInactive30d ? 'var(--text-faint)' : 'var(--text)' }}>{fmtRelative(lastTs)}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
              {new Date(lastTs).toISOString().slice(0, 16).replace('T', ' ')}
            </div>
          </>
        ) : (
          <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontStyle: 'italic' }}>
            {t('platform.team.never_yet')}
          </span>
        )}
      </div>
      <div
        style={{
          flex: cols[5].flex,
          fontSize: 12,
          color: 'var(--text-soft)',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={loc || ''}
      >
        {loc || <span style={{ color: 'var(--text-faint)' }}>—</span>}
      </div>
      <div
        style={{
          flex: cols[6].flex,
          textAlign: 'right',
          fontSize: 12.5,
          fontVariantNumeric: 'tabular-nums',
          color: r.signInCount30d > 0 ? 'var(--text)' : 'var(--text-faint)',
        }}
      >
        {r.signInCount30d}
      </div>
      <div
        style={{
          flex: cols[7].flex,
          textAlign: 'right',
          fontSize: 12.5,
          fontVariantNumeric: 'tabular-nums',
          color: r.signInCount > 0 ? 'var(--text-soft)' : 'var(--text-faint)',
        }}
      >
        {r.signInCount}
      </div>
    </button>
  );
}

// OWNER / STAFF / DEMO / REAL pill. Four tones — OWNER is the single
// human "god mode" account (migration 129) and gets the strongest
// visual treatment. The other three match the durable badge color
// convention from session-2026-05-17-handoff.md:
//   OWNER = gold-on-dark (filled, distinct from the other three)
//   STAFF = pink   (var(--accent))  — Adaptiv employees
//   DEMO  = amber  (var(--warn))    — canonical seed/showcase tenants
//   REAL  = green  (var(--ok))      — real paying-customer signups
function AccountTypePill({ type, t }) {
  const palette =
    type === 'owner'
      ? { fg: '#3b2700', bg: '#facc15', line: '#a16207' } // filled gold — singular role
      : type === 'staff'
        ? { fg: 'var(--accent)', bg: 'var(--accent-soft)', line: 'var(--accent-line)' }
        : type === 'demo'
          ? {
              fg: 'var(--warn)',
              bg: 'color-mix(in oklch, var(--warn) 10%, transparent)',
              line: 'color-mix(in oklch, var(--warn) 32%, transparent)',
            }
          : {
              fg: 'var(--ok)',
              bg: 'color-mix(in oklch, var(--ok) 10%, transparent)',
              line: 'color-mix(in oklch, var(--ok) 32%, transparent)',
            };
  const labelKey =
    type === 'owner'
      ? 'platform.team.type.owner'
      : type === 'staff'
        ? 'platform.team.type.staff'
        : type === 'demo'
          ? 'platform.team.type.demo'
          : 'platform.team.type.real';
  return (
    <span
      title={type === 'owner' ? t('platform.team.type.owner_tip') : undefined}
      style={{
        flexShrink: 0,
        padding: '2px 8px',
        fontSize: 10,
        fontWeight: 800,
        color: palette.fg,
        background: palette.bg,
        border: '1px solid ' + palette.line,
        borderRadius: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.15,
      }}
    >
      {t(labelKey)}
    </span>
  );
}

function UserSignInsDrawer({ row, onClose, t }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'color-mix(in oklch, #000 32%, transparent)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
          overflowY: 'auto',
        }}
      >
        <header
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.displayName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-dim)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.email}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
            }}
          >
            <Icon.close size={14} />
          </button>
        </header>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Section title={t('platform.team.drawer.summary')}>
            <SummaryRow label={t('platform.team.drawer.role')} value={row.profileRole || '—'} />
            <SummaryRow
              label={t('platform.team.drawer.org')}
              value={row.primaryOrgName || '—'}
              sub={row.primaryOrgKind}
            />
            <SummaryRow
              label={t('platform.team.drawer.signins')}
              value={`${row.signInCount} ${t('platform.team.drawer.signins_unit')} · ${row.signInCount30d} ${t('platform.team.drawer.signins_30d_unit')}`}
            />
            <SummaryRow
              label={t('platform.team.drawer.last')}
              value={
                row.lastSignIn
                  ? `${fmtRelative(row.lastSignIn.signed_in_at)} · ${fmtLocation(row.lastSignIn) || '—'}`
                  : t('platform.team.never_yet')
              }
            />
          </Section>

          <Section title={t('platform.team.drawer.recent')}>
            {(row.recentSignIns || []).length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                {t('platform.team.drawer.recent_empty')}
              </div>
            )}
            {(row.recentSignIns || []).map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--surface-2)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{new Date(s.signed_in_at).toLocaleString()}</span>
                  <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 10.5 }}>
                    {fmtRelative(s.signed_in_at)}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-soft)' }}>
                  {fmtLocation(s) || (
                    <span style={{ color: 'var(--text-faint)' }}>{t('platform.team.drawer.unknown_location')}</span>
                  )}
                </div>
                {s.user_agent && (
                  <div
                    style={{
                      fontSize: 10.5,
                      color: 'var(--text-faint)',
                      fontFamily: 'var(--mono)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={s.user_agent}
                  >
                    {s.user_agent}
                  </div>
                )}
              </div>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--text-dim)',
          letterSpacing: 0.15,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, sub }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 8,
        padding: '6px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.15,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', textAlign: 'right' }}>
        {value}
        {sub && (
          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 400 }}>{sub}</span>
        )}
      </span>
    </div>
  );
}
