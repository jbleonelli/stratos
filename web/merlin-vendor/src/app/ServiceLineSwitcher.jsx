// ServiceLineSwitcher — top-bar control that lets a MULTI-SERVICE contractor
// (e.g. Apex Facilities Group, holding cleaning + security + maintenance +
// hospitality) flip the active service line. Switching it re-tailors the
// agent grid and Merlin's chat persona to that discipline.
//
// Rendered only for contractor orgs with MORE THAN ONE service line; single-
// service contractors are auto-pinned to their one line (see
// useContractorServiceLines) and this control hides.

import React, { useState, useEffect } from 'react';
import { Icon } from './icons.jsx';
import { useActiveOrg } from './org-data.js';
import { useSL } from './servicing-i18n.js';
import { useServiceLine, setServiceLine, useContractorServiceLines } from './service-line.js';

const META = {
  cleaning: { label: ['Cleaning', 'Nettoyage'], icon: 'sparkle' },
  security: { label: ['Security', 'Sécurité'], icon: 'shield' },
  maintenance: { label: ['Maintenance', 'Maintenance'], icon: 'cog' },
  hospitality: { label: ['Hospitality', 'Hôtellerie'], icon: 'badge' },
};

export function ServiceLineSwitcher({ hideControl = false }) {
  const sl = useSL();
  const activeOrg = useActiveOrg();
  const orgId = activeOrg?.id || null;
  const orgKind = activeOrg?.kind || null;
  const lines = useContractorServiceLines(orgId, orgKind);
  const current = useServiceLine();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const timer = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
    };
  }, [open]);

  // Only multi-service contractors get the switcher. `hideControl` suppresses
  // the visible control on views where a per-line filter is meaningless (e.g.
  // My Day, which is a whole-portfolio briefing across every line) — but we
  // keep the hooks above running so the service-line init (useContractorServiceLines)
  // still fires there.
  if (hideControl || orgKind !== 'contractor' || lines.length <= 1) return null;

  const curMeta = META[current] || META.cleaning;
  const CurIcon = Icon[curMeta.icon] || Icon.sparkle;
  const labelFor = (m, fallback) => (Array.isArray(m?.label) ? sl(m.label[0], m.label[1]) : m?.label || fallback);

  return (
    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={sl('Service line', 'Métier')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '5px 10px',
          background: 'color-mix(in oklch, var(--surface) 80%, transparent)',
          border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: 8,
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <CurIcon size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{labelFor(curMeta)}</span>
        <Icon.chevD
          size={11}
          style={{
            color: 'var(--text-dim)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 200,
            padding: 6,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: '8px 10px 4px',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.15,
            }}
          >
            {sl('Service line', 'Métier')}
          </div>
          {lines.map((line) => {
            const m = META[line] || { label: line, icon: 'sparkle' };
            const LineIcon = Icon[m.icon] || Icon.sparkle;
            const isActive = line === current;
            return (
              <button
                key={line}
                onClick={() => {
                  setServiceLine(line);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 7,
                  marginBottom: 2,
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-soft)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <LineIcon size={14} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: isActive ? 700 : 600 }}>{labelFor(m, line)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
