// Tweaks panel
import React from 'react';
import { Icon } from './icons.jsx';

export function TweaksPanel({ tweaks, onChange, visible }) {
  if (!visible) return null;

  const Seg = ({ label, keyName, options }) => (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.6)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.06)', padding: 3, borderRadius: 7 }}>
        {options.map(([v, l]) => (
          <button
            key={v}
            onClick={() => onChange({ [keyName]: v })}
            style={{
              flex: 1,
              padding: '5px 6px',
              fontSize: 10.5,
              fontWeight: 600,
              background: tweaks[keyName] === v ? 'rgba(255,255,255,0.18)' : 'transparent',
              color: tweaks[keyName] === v ? '#fff' : 'rgba(255,255,255,0.7)',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
            }}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        width: 260,
        zIndex: 1000,
        background: 'rgba(12, 14, 22, 0.92)',
        color: '#fff',
        borderRadius: 14,
        padding: '14px 16px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 48px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        fontFamily: 'var(--font)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Icon.sparkle size={12} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2, textTransform: 'uppercase' }}>Tweaks</div>
      </div>
      <Seg
        label="Variant"
        keyName="variant"
        options={[
          ['conservative', 'Conservative'],
          ['bold', 'Bold'],
        ]}
      />
      <Seg
        label="Theme"
        keyName="theme"
        options={[
          ['light', 'Light'],
          ['dark', 'Dark'],
        ]}
      />
      <Seg
        label="Accent"
        keyName="accent"
        options={[
          ['pink', 'Pink'],
          ['indigo', 'Indigo'],
          ['blue', 'Blue'],
        ]}
      />
      <Seg
        label="Sidebar"
        keyName="sidebar"
        options={[
          ['wide', 'Wide'],
          ['collapsed', 'Icons'],
        ]}
      />
      <Seg
        label="Density"
        keyName="density"
        options={[
          ['comfortable', 'Comfort'],
          ['compact', 'Compact'],
        ]}
      />
      <Seg
        label="Merlin's tone"
        keyName="tone"
        options={[
          ['friendly', 'Friendly'],
          ['formal', 'Formal'],
          ['terse', 'Terse'],
        ]}
      />
      <Seg
        label="Building"
        keyName="building"
        options={[
          ['hq', 'HQ'],
          ['hospital', 'Hospital'],
        ]}
      />
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0 12px' }} />
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.45)',
          marginBottom: 8,
        }}
      >
        Devices page
      </div>
      <Seg
        label="Fleet layout"
        keyName="devicesLayout"
        options={[
          ['cards', 'Cards'],
          ['map', 'Map'],
        ]}
      />
      <Seg
        label="Rollouts view"
        keyName="deployView"
        options={[
          ['rail', 'Timeline'],
          ['list', 'List'],
        ]}
      />
    </div>
  );
}
