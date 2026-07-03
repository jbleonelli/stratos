import type { ReactNode } from 'react';
import type { Organization } from '../api/types';
import type { Session } from '../queries/useSession';
import { Icon } from '../ui/icons';
import { IconBtn, Pill, Wordmark } from '../ui/primitives';
import { useTheme } from '../ui/useTheme';

export interface NavItem {
  id: string;
  label: string;
  icon: (p: { size?: number }) => ReactNode;
}

const lifecycleTone = (s?: string) =>
  s === 'active' ? 'ok' : s === 'trial' ? 'warn' : s === 'suspended' || s === 'deleted' ? 'risk' : 'neutral';

export function AppShell({
  nav,
  active,
  onNavigate,
  title,
  org,
  session,
  signOut,
  children,
}: {
  nav: NavItem[];
  active: string;
  onNavigate: (id: string) => void;
  title: string;
  org?: Organization | null;
  session?: Session;
  signOut: () => void;
  children: ReactNode;
}) {
  const { theme, toggle } = useTheme();

  return (
    <div className="screen-h" style={{ display: 'flex', width: '100vw' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 'var(--sidebar-w)',
          flexShrink: 0,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 8px 22px' }}>
          <Wordmark height={20} />
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map((item) => {
            const on = active === item.id;
            return (
              <button
                key={item.id}
                className="ds-nav-row"
                onClick={() => onNavigate(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${on ? 'var(--accent-line)' : 'transparent'}`,
                  background: on ? 'var(--accent-soft)' : 'transparent',
                  color: on ? 'var(--accent)' : 'var(--text-soft)',
                  cursor: 'pointer',
                  fontSize: 13.5,
                  fontWeight: on ? 700 : 600,
                  textAlign: 'left',
                }}
              >
                <item.icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 8px 4px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <IconBtn title={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggle}>
            {theme === 'dark' ? <Icon.sun size={17} /> : <Icon.moon size={17} />}
          </IconBtn>
          <button
            onClick={signOut}
            className="ds-nav-row"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-soft)',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <Icon.signout size={15} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 24px',
            height: 60,
            flexShrink: 0,
            borderBottom: '1px solid var(--border)',
            background: 'color-mix(in oklch, var(--surface) 55%, transparent)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text)' }}>{title}</span>
            {org ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text-dim)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {org.name}
                </span>
                <Pill tone={lifecycleTone(org.lifecycleState)}>{org.lifecycleState}</Pill>
              </span>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>—</span>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {session?.platformRole === 'platform_admin' && <Pill tone="accent">platform</Pill>}
            {session?.email && <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{session.email}</span>}
          </div>
        </header>

        <div id="content-scroll" style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
