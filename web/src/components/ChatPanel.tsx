import { useState } from 'react';
import { AsksPanel } from './AsksPanel';
import { MerlinChat } from './MerlinChat';
import { Icon } from '../ui/icons';
import { IconBtn } from '../ui/primitives';

const CHAT_WIDTH = 360;

type ChatTab = 'chat' | 'asks';

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<ChatTab>('chat');

  if (!open) return null;

  return (
    <aside
      data-testid="merlin-chat-panel"
      style={{
        width: CHAT_WIDTH,
        flexShrink: 0,
        marginTop: 4,
        marginBottom: 12,
        marginRight: 12,
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'color-mix(in oklch, var(--surface) 80%, transparent)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            <Icon.agent size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Merlin</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Supervised decisions</div>
          </div>
        </div>
        <IconBtn title="Close chat" onClick={onClose}>
          <Icon.close size={16} />
        </IconBtn>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '8px 14px 0', flexShrink: 0 }}>
        {(['chat', 'asks'] as const).map((t) => (
          <button
            key={t}
            type="button"
            data-testid={`merlin-tab-${t}`}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              background: tab === t ? 'var(--accent-soft)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-dim)',
            }}
          >
            {t === 'chat' ? 'Chat' : 'Asks'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 14 }}>
        {tab === 'chat' ? <MerlinChat /> : <AsksPanel />}
      </div>
    </aside>
  );
}
