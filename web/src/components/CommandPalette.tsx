import { useEffect, useMemo, useRef, useState } from 'react';
import { useAsks, useDevices, useLocations } from '../queries/useData';
import {
  kindLabel,
  searchPalette,
  type PaletteResult,
} from '../app/command-palette-data';
import type { ViewId } from '../app/pillar-subnav';
import { Icon } from '../ui/icons';

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onSelectLocation,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: ViewId, agentId?: string) => void;
  onSelectLocation: (locationId: string) => void;
}) {
  const { data: locations = [] } = useLocations();
  const { data: devices = [] } = useDevices();
  const { data: asks = [] } = useAsks();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(
    () => searchPalette(query, { locations, devices, asks }),
    [query, locations, devices, asks],
  );

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const go = (item: PaletteResult) => {
    const nav = item.navigate;
    if (nav.type === 'location') {
      onSelectLocation(nav.locationId);
      onNavigate('locations');
    } else if (nav.view === 'agent-detail' && nav.agentId) {
      onNavigate('agent-detail', nav.agentId);
    } else {
      onNavigate(nav.view);
    }
    onClose();
  };

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[selectedIdx];
      if (item) go(item);
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'color-mix(in oklch, #000 38%, transparent)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '12vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 92%)',
          maxHeight: '72vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong, var(--border))',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 18px 60px rgba(0,0,0,0.32)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Icon.search size={18} style={{ color: 'var(--text-dim)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search pages, locations, devices, asks…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              color: 'var(--text)',
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              color: 'var(--text-dim)',
            }}
          >
            esc
          </kbd>
        </div>

        <div style={{ overflow: 'auto', flex: 1, padding: 6 }}>
          {results.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
              No matches.
            </div>
          ) : (
            results.map((item, idx) => {
              const active = idx === selectedIdx;
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={() => go(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '10px 12px',
                    border: 'none',
                    borderRadius: 8,
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.3,
                      color: 'var(--text-faint)',
                      width: 64,
                      flexShrink: 0,
                      textTransform: 'uppercase',
                    }}
                  >
                    {kindLabel(item.kind)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {item.title}
                    </span>
                    {item.subtitle && (
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                        {item.subtitle}
                      </span>
                    )}
                  </span>
                  {item.meta && (
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>{item.meta}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text-faint)',
            display: 'flex',
            gap: 16,
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>⌘K toggle</span>
        </div>
      </div>
    </div>
  );
}
