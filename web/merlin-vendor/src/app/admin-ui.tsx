// Shared Admin UI primitives.
//
// The styled <input> and the button/form/table style objects below are reused by
// nearly every AdminPage section (Organization, Users, Invites, Locations, SLAs,
// Zones, Agents, Channel…). They were module-local consts in Admin.jsx, which
// blocked pulling any one section into its own file: the extracted section would
// have to import these back from Admin.jsx, forming a cycle (Admin ⇄ section).
//
// Hoisting them into this leaf module — which imports nothing from the app except
// React — lets both Admin.jsx and every per-section module import the primitives
// from one cycle-free place. Behaviour-preserving move; see the god-file recipe.
//
// First file converted to TypeScript (Phase 1 of the frontend-TS migration) — it's
// a dependency-free leaf, so it's the safe pattern to copy: typed props via
// React.InputHTMLAttributes, style objects as React.CSSProperties, importers
// repointed to the `.tsx` path.
import React from 'react';

export function Input({ style = {}, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        padding: '9px 12px',
        fontSize: 12.5,
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        fontFamily: 'inherit',
        color: 'var(--text)',
        minWidth: 0,
        ...style,
      }}
    />
  );
}

export const btnPrimary: React.CSSProperties = {
  padding: '7px 12px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
export const btnGhost: React.CSSProperties = {
  padding: '7px 12px',
  background: 'transparent',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
export const btnDanger: React.CSSProperties = {
  padding: '7px 12px',
  background: 'transparent',
  color: 'var(--risk)',
  border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
export const formStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: 10,
  marginBottom: 14,
  padding: 14,
  background: 'var(--accent-soft)',
  border: '1px solid var(--accent-line)',
  borderRadius: 10,
};
export const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  fontSize: 10.5,
  fontWeight: 700,
  color: 'var(--text-dim)',
  textTransform: 'uppercase',
  letterSpacing: 0.12,
  borderBottom: '1px solid var(--border)',
};
export const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
  fontFamily: 'var(--mono)',
};
