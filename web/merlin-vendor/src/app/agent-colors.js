// @ts-check
// Single source of truth for the per-agent colour palette.
//
// Previously this 12-entry table was hand-copied into three files
// (HypervisorViewer3D.jsx, MessageDrawer.jsx, Hypervisor.jsx). The
// copies existed ON PURPOSE: the palette used to live inside the
// ~950KB three.js viewer module, so a static import would have dragged
// that whole chunk into any parent bundle and defeated the viewer's
// lazy() split.
//
// This module has ZERO heavy dependencies (pure data + one function),
// so every consumer can now import it statically without pulling the
// viewer chunk — resolving both the bundle concern and the sync hazard.
// Add a new agent here once and all surfaces pick it up.
//
// Each agent type that can produce a pending ask gets its own hue so an
// operator reads the canvas as "Floor 28 has a security + a cleaning
// issue" rather than just "more pink." Unknown / future agents fall
// back to brand pink so they're still visible.
export const AGENT_COLORS = {
  cleaning: '#06b6d4', // cyan
  compliance: '#8b5cf6', // violet
  security: '#ef4444', // red
  'pharmacy-temp': '#f97316', // orange
  supply: '#3b82f6', // blue
  space: '#10b981', // emerald
  energy: '#eab308', // yellow
  'cold-chain': '#0ea5e9', // sky
  hvac: '#f59e0b', // amber
  'crowd-flow': '#6366f1', // indigo
  'concession-demand': '#ec4899', // hot pink
  biosecurity: '#16a34a', // green — health / biosecurity
  servicing: '#14b8a6', // teal — cross-domain servicing / SLAs
};

const AGENT_COLOR_FALLBACK = '#FF00B2'; // brand pink (used by colorForAgent below)

export function colorForAgent(agentId) {
  return AGENT_COLORS[agentId] || AGENT_COLOR_FALLBACK;
}
