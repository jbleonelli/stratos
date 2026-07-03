import { useEffect, useRef, useState } from 'react';
import { useBuilding } from '../context/BuildingContext';
import { Icon } from '../ui/icons';
import { Pill } from '../ui/primitives';

export function BuildingSwitcher({ compact = true }: { compact?: boolean }) {
  const { locations, selectedLocation, selectedLocationId, setSelectedLocationId, multiLocation } = useBuilding();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!selectedLocation) {
    return (
      <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>No building</span>
    );
  }

  if (!multiLocation) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: compact ? '6px 12px' : '8px 14px',
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: 'color-mix(in oklch, var(--surface) 80%, transparent)',
          maxWidth: 280,
        }}
      >
        <Icon.building size={14} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selectedLocation.name}
        </span>
        <Pill tone="neutral">{selectedLocation.kind}</Pill>
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: compact ? '6px 12px' : '8px 14px',
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: open ? 'var(--accent-soft)' : 'color-mix(in oklch, var(--surface) 80%, transparent)',
          color: 'var(--text)',
          cursor: 'pointer',
          maxWidth: 280,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <Icon.building size={14} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLocation.name}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 240,
            maxWidth: 320,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-lg, 0 8px 32px rgba(0,0,0,.12))',
            zIndex: 100,
            padding: 6,
          }}
        >
          {locations.map((loc) => {
            const on = loc.id === selectedLocationId;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  setSelectedLocationId(loc.id);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  borderRadius: 8,
                  background: on ? 'var(--accent-soft)' : 'transparent',
                  color: on ? 'var(--accent)' : 'var(--text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  fontWeight: on ? 700 : 500,
                }}
              >
                <span>{loc.name}</span>
                <Pill tone="neutral">{loc.kind}</Pill>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
