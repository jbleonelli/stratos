import type { Ask, Device, Location } from '../api/types';
import type { ViewId } from './pillar-subnav';
import { PILLAR_LABELS, PILLAR_SUBNAV, viewPath } from './pillar-subnav';

export type PaletteNavigate =
  | { type: 'view'; view: ViewId; agentId?: string }
  | { type: 'location'; locationId: string };

export interface PaletteResult {
  kind: 'nav' | 'location' | 'device' | 'ask';
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  navigate: PaletteNavigate;
}

const NAV_COMMANDS: PaletteResult[] = (() => {
  const out: PaletteResult[] = [];
  for (const [pillar, items] of Object.entries(PILLAR_SUBNAV)) {
    if (!items) {
      if (pillar === 'report') {
        out.push({
          kind: 'nav',
          id: 'reports',
          title: 'Reports',
          subtitle: PILLAR_LABELS.report,
          navigate: { type: 'view', view: 'reports' },
        });
      }
      continue;
    }
    for (const item of items) {
      if (item.implemented === false) continue;
      out.push({
        kind: 'nav',
        id: item.view,
        title: item.label,
        subtitle: PILLAR_LABELS[pillar as keyof typeof PILLAR_LABELS],
        navigate: { type: 'view', view: item.view },
      });
    }
  }
  out.push({
    kind: 'nav',
    id: 'agents',
    title: 'AI Agents',
    subtitle: PILLAR_LABELS.monitor,
    navigate: { type: 'view', view: 'agents' },
  });
  out.push({
    kind: 'nav',
    id: 'admin',
    title: 'Admin',
    subtitle: 'Settings',
    navigate: { type: 'view', view: 'admin' },
  });
  return out;
})();

function match(q: string, ...fields: (string | null | undefined)[]) {
  const needle = q.toLowerCase();
  return fields.some((f) => f && f.toLowerCase().includes(needle));
}

export function searchPalette(
  rawQuery: string,
  ctx: {
    locations: Location[];
    devices: Device[];
    asks: Ask[];
  },
  limit = 8,
): PaletteResult[] {
  const q = rawQuery.trim();
  if (!q) return NAV_COMMANDS.slice(0, 12);

  const results: PaletteResult[] = [];

  for (const cmd of NAV_COMMANDS) {
    if (match(q, cmd.title, cmd.subtitle)) results.push(cmd);
  }

  for (const loc of ctx.locations) {
    if (!match(q, loc.name, loc.kind)) continue;
    results.push({
      kind: 'location',
      id: loc.id,
      title: loc.name,
      subtitle: loc.kind,
      meta: `${loc.deviceCount} devices`,
      navigate: { type: 'location', locationId: loc.id },
    });
  }

  for (const dev of ctx.devices) {
    if (!match(q, dev.externalId, dev.kind, dev.name)) continue;
    results.push({
      kind: 'device',
      id: dev.id,
      title: dev.externalId ?? dev.kind,
      subtitle: dev.kind,
      meta: dev.status,
      navigate: { type: 'view', view: 'devices' },
    });
  }

  for (const ask of ctx.asks) {
    if (!match(q, ask.question, ask.status)) continue;
    results.push({
      kind: 'ask',
      id: ask.id,
      title: ask.question.slice(0, 80),
      subtitle: ask.status,
      navigate: { type: 'view', view: 'activity' },
    });
  }

  return results.slice(0, limit);
}

export function kindLabel(kind: PaletteResult['kind']) {
  switch (kind) {
    case 'nav':
      return 'Go to';
    case 'location':
      return 'Location';
    case 'device':
      return 'Device';
    case 'ask':
      return 'Ask';
    default:
      return kind;
  }
}

export function pathForNavigate(nav: PaletteNavigate): string {
  if (nav.type === 'location') return viewPath('locations');
  if (nav.view === 'agent-detail' && nav.agentId) return `/agents/${nav.agentId}`;
  return viewPath(nav.view);
}
