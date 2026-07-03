// Per-pillar sub-nav — aligned with Merlin IA (reference snapshot 659d224).

import type { IconKey } from '../ui/icons';

export type PillarId = 'monitor' | 'operate' | 'report' | 'predict' | 'innovate';

export type ViewId =
  | 'locations'
  | 'briefing'
  | 'now'
  | 'dashboard'
  | 'incidents'
  | 'hypervisor'
  | 'agents'
  | 'agent-detail'
  | 'activity'
  | 'tickets'
  | 'devices'
  | 'contracts'
  | 'insights'
  | 'insights-wellbeing'
  | 'insights-slas'
  | 'reports'
  | 'innovate'
  | 'innovate-catalog'
  | 'admin';

export interface SubNavItem {
  id: string;
  view: ViewId;
  label: string;
  icon: IconKey;
  implemented?: boolean;
}

export interface ParsedRoute {
  view: ViewId;
  agentId?: string;
}

export const PILLAR_LABELS: Record<PillarId, string> = {
  monitor: 'MONITOR',
  operate: 'OPERATE',
  report: 'REPORT',
  predict: 'PREDICT',
  innovate: 'INNOVATE',
};

export const PILLAR_LANDING: Record<PillarId, ViewId> = {
  monitor: 'briefing',
  operate: 'activity',
  report: 'reports',
  predict: 'insights',
  innovate: 'innovate',
};

export const PILLAR_SUBNAV: Record<PillarId, SubNavItem[] | null> = {
  monitor: [
    { id: 'locations', view: 'locations', label: 'Locations', icon: 'building', implemented: true },
    { id: 'briefing', view: 'briefing', label: 'Briefing', icon: 'sparkle', implemented: true },
    { id: 'now', view: 'now', label: 'Now', icon: 'bolt', implemented: true },
    { id: 'hypervisor', view: 'hypervisor', label: 'Hypervisor', icon: 'hypervisor', implemented: true },
    { id: 'metrics', view: 'dashboard', label: 'Metrics', icon: 'metrics', implemented: true },
    { id: 'agents', view: 'agents', label: 'Agents', icon: 'agent', implemented: true },
    { id: 'incidents', view: 'incidents', label: 'Incidents', icon: 'incident', implemented: true },
  ],
  operate: [
    { id: 'activity', view: 'activity', label: 'Activity', icon: 'activity', implemented: true },
    { id: 'tickets', view: 'tickets', label: 'Tickets', icon: 'workOrder', implemented: true },
    { id: 'devices', view: 'devices', label: 'Devices', icon: 'device', implemented: true },
    { id: 'contracts', view: 'contracts', label: 'Contracts', icon: 'contract', implemented: true },
  ],
  predict: [
    { id: 'savings', view: 'insights', label: 'Savings', icon: 'insights', implemented: true },
    { id: 'wellbeing', view: 'insights-wellbeing', label: 'Wellbeing', icon: 'sparkle', implemented: true },
    { id: 'slas', view: 'insights-slas', label: 'SLAs', icon: 'shield', implemented: true },
  ],
  report: null,
  innovate: [
    { id: 'partners', view: 'innovate', label: 'Partners', icon: 'people', implemented: true },
    { id: 'catalog', view: 'innovate-catalog', label: 'Catalog', icon: 'device', implemented: true },
  ],
};

export const PILLARLESS_VIEWS: ViewId[] = ['admin'];

const VIEW_TO_PILLAR: Record<ViewId, PillarId | null> = (() => {
  const map: Partial<Record<ViewId, PillarId | null>> = {};
  for (const [pillar, items] of Object.entries(PILLAR_SUBNAV) as [PillarId, SubNavItem[] | null][]) {
    for (const it of items ?? []) map[it.view] = pillar;
  }
  map.reports = 'report';
  map['agent-detail'] = 'monitor';
  map['innovate-catalog'] = 'innovate';
  for (const v of PILLARLESS_VIEWS) map[v] = null;
  return map as Record<ViewId, PillarId | null>;
})();

export const ROUTABLE_VIEWS = new Set<ViewId>([
  ...Object.keys(VIEW_TO_PILLAR),
  ...PILLARLESS_VIEWS,
] as ViewId[]);

export const LEGACY_PATH_REDIRECTS: Record<string, ViewId> = {
  overview: 'briefing',
};

export function pillarForView(view: ViewId): PillarId | null {
  return VIEW_TO_PILLAR[view] ?? null;
}

export function activeSubNavId(view: ViewId, items: SubNavItem[] | null): string | null {
  if (!items) return null;
  if (view === 'agent-detail') return 'agents';
  for (const it of items) {
    if (it.view === view) return it.id;
  }
  return null;
}

export function viewPath(view: ViewId, agentId?: string): string {
  if (view === 'admin') return '/admin';
  if (view === 'agent-detail' && agentId) return `/agents/${agentId}`;
  if (view === 'agents') return '/agents';
  return `/${view}`;
}

export function parseRoute(pathname: string): ParsedRoute {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (parts.length === 0) return { view: 'briefing' };
  if (parts[0] === 'agents') {
    if (parts[1]) return { view: 'agent-detail', agentId: parts[1] };
    return { view: 'agents' };
  }
  const segment = parts[0];
  if (segment in LEGACY_PATH_REDIRECTS) return { view: LEGACY_PATH_REDIRECTS[segment] };
  if (ROUTABLE_VIEWS.has(segment as ViewId)) return { view: segment as ViewId };
  return { view: 'briefing' };
}

/** @deprecated use parseRoute */
export function parseViewPath(pathname: string): ViewId {
  return parseRoute(pathname).view;
}

export function isViewImplemented(view: ViewId): boolean {
  if (view === 'admin' || view === 'reports' || view === 'agents' || view === 'agent-detail') return true;
  const pillar = pillarForView(view);
  if (!pillar) return false;
  const items = PILLAR_SUBNAV[pillar];
  const item = items?.find((i) => i.view === view);
  if (item) return item.implemented !== false;
  return false;
}

/** Implemented customer routes for smoke / E2E (path + expected pillar label). */
export function smokeRoutes(): Array<{ path: string; pillar: PillarId | null; label: string; id: string }> {
  const seen = new Set<string>();
  const out: Array<{ path: string; pillar: PillarId | null; label: string; id: string }> = [];
  const add = (path: string, pillar: PillarId | null, label: string, id: string) => {
    if (seen.has(path)) return;
    seen.add(path);
    out.push({ path, pillar, label, id });
  };
  for (const [pillar, items] of Object.entries(PILLAR_SUBNAV) as [PillarId, SubNavItem[] | null][]) {
    if (!items) {
      if (pillar === 'report') add(viewPath('reports'), 'report', PILLAR_LABELS.report, 'reports');
      continue;
    }
    for (const item of items) {
      if (item.implemented === false) continue;
      add(viewPath(item.view), pillar, PILLAR_LABELS[pillar], item.id);
    }
  }
  add(viewPath('admin'), null, 'Admin', 'admin');
  return out;
}

export function placeholderTitle(view: ViewId): string {
  const titles: Partial<Record<ViewId, string>> = {
    'insights-wellbeing': 'Wellbeing',
    'insights-slas': 'SLAs',
    innovate: 'Innovate — Partners',
    'innovate-catalog': 'Adaptiv catalog',
    reports: 'Reports',
  };
  return titles[view] ?? 'Coming soon';
}
