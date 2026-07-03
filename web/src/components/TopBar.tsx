import type { Organization } from '../api/types';
import type { Session } from '../queries/useSession';
import {
  PILLAR_LABELS,
  PILLAR_SUBNAV,
  activeSubNavId,
  pillarForView,
  type ViewId,
} from '../app/pillar-subnav';
import { BuildingSwitcher } from './BuildingSwitcher';
import { Icon, type IconKey } from '../ui/icons';
import { Pill } from '../ui/primitives';

export function TopBar({
  view,
  org,
  session,
  onView,
  onOpenPalette,
}: {
  view: ViewId;
  org?: Organization | null;
  session?: Session;
  onView: (view: ViewId) => void;
  onOpenPalette?: () => void;
}) {
  const pillar = pillarForView(view);
  const subNavItems = pillar ? PILLAR_SUBNAV[pillar] : null;
  const activeId = activeSubNavId(view, subNavItems);

  return (
    <div
      style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 12px 0 0',
        background: 'transparent',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <BuildingSwitcher compact />

        {pillar && (
          <span
            data-testid="topbar-pillar-label"
            style={{
              fontSize: 13,
              letterSpacing: 0.3,
              fontWeight: 700,
              color: 'var(--accent-pink)',
              flexShrink: 0,
            }}
          >
            {PILLAR_LABELS[pillar]}
          </span>
        )}

        {subNavItems && subNavItems.length > 0 && (
          <div style={{ display: 'flex', gap: 2, minWidth: 0, overflow: 'auto' }}>
            {subNavItems.map((item) => {
              const IconC = Icon[item.icon as IconKey] ?? Icon.overview;
              const active = item.id === activeId;
              return (
                <button
                  key={item.id}
                  data-testid={`subnav-${item.id}`}
                  onClick={() => onView(item.view)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-dim)',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    flexShrink: 0,
                    opacity: item.implemented === false ? 0.55 : 1,
                  }}
                >
                  <IconC size={14} />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onOpenPalette}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'color-mix(in oklch, var(--surface) 80%, transparent)',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Icon.search size={14} />
          <span>Search</span>
          <kbd style={{ fontSize: 10, opacity: 0.7 }}>⌘K</kbd>
        </button>
        {org && (
          <span style={{ fontSize: 12, color: 'var(--text-faint)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {org.name}
          </span>
        )}
        {session?.platformRole === 'platform_admin' && <Pill tone="accent">platform</Pill>}
        {session?.email && <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{session.email}</span>}
      </div>
    </div>
  );
}
