import { useState, type ReactNode } from 'react';
import type { PillarId, ViewId } from '../app/pillar-subnav';
import { PILLAR_LABELS, PILLAR_LANDING } from '../app/pillar-subnav';
import { Icon } from '../ui/icons';
import { IconBtn } from '../ui/primitives';
import { useTheme } from '../ui/useTheme';

const RAIL_WIDTH_COLLAPSED = 52;
const RAIL_MAX_EXPAND_CAP = 360;

const floatingCardStyle: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
  backdropFilter: 'blur(16px) saturate(150%)',
  WebkitBackdropFilter: 'blur(16px) saturate(150%)',
  overflow: 'hidden',
  transition: 'max-width 0.22s ease',
  minWidth: RAIL_WIDTH_COLLAPSED,
};

const PILLARS: { id: PillarId; icon: keyof typeof Icon; label: string }[] = [
  { id: 'monitor', icon: 'monitor', label: PILLAR_LABELS.monitor },
  { id: 'operate', icon: 'operate', label: PILLAR_LABELS.operate },
  { id: 'report', icon: 'report', label: PILLAR_LABELS.report },
  { id: 'predict', icon: 'predict', label: PILLAR_LABELS.predict },
  { id: 'innovate', icon: 'innovate', label: PILLAR_LABELS.innovate },
];

function NavRow({
  expanded,
  label,
  active,
  onClick,
  children,
}: {
  expanded: boolean;
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '4px 8px',
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      {expanded && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.3,
            color: active ? 'var(--accent)' : 'var(--text-soft)',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export function Sidebar({
  view,
  activePillar,
  chatOpen,
  onPillar,
  onView,
  onToggleChat,
  onSignOut,
}: {
  view: ViewId;
  activePillar: PillarId | null;
  chatOpen: boolean;
  onPillar: (pillar: PillarId) => void;
  onView: (view: ViewId) => void;
  onToggleChat: () => void;
  onSignOut: () => void;
}) {
  const [topHovered, setTopHovered] = useState(false);
  const [bottomHovered, setBottomHovered] = useState(false);
  const { theme, toggle } = useTheme();
  const onAdmin = view === 'admin';

  return (
    <div
      style={{
        width: RAIL_WIDTH_COLLAPSED,
        flexShrink: 0,
        margin: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        zIndex: 50,
        gap: 10,
        alignSelf: 'stretch',
      }}
    >
      <aside
        onMouseEnter={() => setTopHovered(true)}
        onMouseLeave={() => setTopHovered(false)}
        style={{
          ...floatingCardStyle,
          maxWidth: topHovered ? RAIL_MAX_EXPAND_CAP : RAIL_WIDTH_COLLAPSED,
          alignSelf: 'flex-start',
        }}
      >
        <NavRow expanded={topHovered} label="Ask Merlin" active={chatOpen} onClick={onToggleChat}>
          <IconBtn
            size={36}
            active={chatOpen}
            onClick={onToggleChat}
            title="Ask Merlin"
            data-testid="ask-merlin"
          >
            <Icon.agent size={18} />
          </IconBtn>
        </NavRow>

        {PILLARS.map((pillar) => {
          const IconC = Icon[pillar.icon];
          const active = activePillar === pillar.id;
          return (
            <NavRow
              key={pillar.id}
              expanded={topHovered}
              label={pillar.label}
              active={active}
              onClick={() => onPillar(pillar.id)}
            >
              <IconBtn
                size={36}
                active={active}
                onClick={() => onPillar(pillar.id)}
                title={pillar.label}
                data-testid={`pillar-${pillar.id}`}
              >
                <IconC size={18} />
              </IconBtn>
            </NavRow>
          );
        })}
      </aside>

      <aside
        onMouseEnter={() => setBottomHovered(true)}
        onMouseLeave={() => setBottomHovered(false)}
        style={{
          ...floatingCardStyle,
          maxWidth: bottomHovered ? RAIL_MAX_EXPAND_CAP : RAIL_WIDTH_COLLAPSED,
          alignSelf: 'flex-start',
          marginTop: 'auto',
        }}
      >
        <NavRow expanded={bottomHovered} label={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggle}>
          <IconBtn size={36} onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? <Icon.sun size={18} /> : <Icon.moon size={18} />}
          </IconBtn>
        </NavRow>
        <NavRow expanded={bottomHovered} label="Admin" active={onAdmin} onClick={() => onView('admin')}>
          <IconBtn size={36} active={onAdmin} onClick={() => onView('admin')} title="Admin">
            <Icon.cog size={18} />
          </IconBtn>
        </NavRow>
        <NavRow expanded={bottomHovered} label="Sign out" onClick={onSignOut}>
          <IconBtn size={36} onClick={onSignOut} title="Sign out">
            <Icon.signout size={18} />
          </IconBtn>
        </NavRow>
      </aside>
    </div>
  );
}

export function pillarLandingView(pillar: PillarId): ViewId {
  return PILLAR_LANDING[pillar];
}
