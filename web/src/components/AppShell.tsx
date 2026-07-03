import type { ReactNode } from 'react';
import type { Organization } from '../api/types';
import type { Session } from '../queries/useSession';
import type { PillarId, ViewId } from '../app/pillar-subnav';
import { pillarForView } from '../app/pillar-subnav';
import { ChatPanel } from './ChatPanel';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell({
  view,
  org,
  session,
  signOut,
  chatOpen,
  onToggleChat,
  onOpenPalette,
  onView,
  onPillar,
  children,
}: {
  view: ViewId;
  org?: Organization | null;
  session?: Session;
  signOut: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  onOpenPalette: () => void;
  onView: (view: ViewId, agentId?: string) => void;
  onPillar: (pillar: PillarId) => void;
  children: ReactNode;
}) {
  const activePillar = pillarForView(view);

  return (
    <div className="screen-h" style={{ display: 'flex', width: '100vw', background: 'var(--bg)' }}>
      <Sidebar
        view={view}
        activePillar={activePillar}
        chatOpen={chatOpen}
        onPillar={onPillar}
        onView={onView}
        onToggleChat={onToggleChat}
        onSignOut={signOut}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <TopBar view={view} org={org} session={session} onView={onView} onOpenPalette={onOpenPalette} />

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              minWidth: 0,
              minHeight: 0,
              marginTop: 4,
              marginBottom: 12,
              marginRight: chatOpen ? 0 : 12,
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'color-mix(in oklch, var(--surface) 80%, transparent)',
              backdropFilter: 'blur(30px) saturate(180%)',
              WebkitBackdropFilter: 'blur(30px) saturate(180%)',
              overflow: 'hidden',
            }}
          >
            <div id="content-scroll" style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: 20 }}>
              {children}
            </div>
          </div>
          <ChatPanel open={chatOpen} onClose={onToggleChat} />
        </div>
      </div>
    </div>
  );
}
