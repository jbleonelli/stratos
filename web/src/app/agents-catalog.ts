// Merlin agent catalog (reference snapshot 659d224) — static roster until
// agent entitlements land in AppSync.

export interface AgentDef {
  id: string;
  name: string;
  tag: string;
  group: 'operations' | 'environment' | 'compliance';
}

export const AGENT_GROUPS: { id: AgentDef['group']; label: string }[] = [
  { id: 'operations', label: 'Operations' },
  { id: 'environment', label: 'Environment' },
  { id: 'compliance', label: 'Compliance & safety' },
];

export const AGENTS: AgentDef[] = [
  { id: 'cleaning', name: 'Cleaning & Hygiene', tag: 'Cleaning routes + restroom hygiene SLAs', group: 'operations' },
  { id: 'hvac', name: 'HVAC & Comfort', tag: 'Setpoints + comfort optimization', group: 'environment' },
  { id: 'space', name: 'Space Management', tag: 'Occupancy + ghost-booking recovery', group: 'operations' },
  { id: 'supply', name: 'Supplies & Stock', tag: 'Stock counts + automatic reorder', group: 'operations' },
  { id: 'compliance', name: 'Compliance', tag: 'NFC audit trail + evidence capture', group: 'compliance' },
  { id: 'energy', name: 'Energy', tag: 'Consumption + baseline anomalies', group: 'environment' },
  { id: 'security', name: 'Security & Safety', tag: 'Badge + after-hours access monitoring', group: 'compliance' },
  { id: 'servicing', name: 'Servicing & SLAs', tag: 'Cleaning / security / hospitality SLAs', group: 'operations' },
];

export const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a])) as Record<string, AgentDef>;

export const AGENT_ACCENT: Record<string, string> = {
  cleaning: '#10b981',
  hvac: '#3b82f6',
  space: '#8b5cf6',
  supply: '#f59e0b',
  compliance: '#6366f1',
  energy: '#14b8a6',
  security: '#ef4444',
  servicing: '#ec4899',
};

/** Match agent id from free-text rationale / question. */
export function inferAgentId(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const a of AGENTS) {
    if (lower.includes(a.id)) return a.id;
  }
  return null;
}
