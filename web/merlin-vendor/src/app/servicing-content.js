// Realistic content for the Servicing boards. Each servicing item (a route_tasks
// row → demo_servicing_state row) is a named service LINE; this module supplies
// the human detail the raw aggregate can't: a real location, a one-line
// description, and a deterministic list of individual REQUEST TICKETS (who asked,
// what, when, status, who handled it) for the row's drill-down.
//
// The item names here MUST match route_tasks.name (the board looks up by name).
// Tickets are generated deterministically from a seed (item name) + the live
// metrics (open_count / handles-24h) so the drill-down stays consistent with the
// numbers on the row, and stable across renders. No DB content layer needed.
//
// Adding a domain = add a CONTENT[domain] entry (items + ask phrasings); the
// generator + board wiring are generic. Hospitality is done; Cleaning / Security
// / Maintenance follow.

import { SERVICING_CONTENT, REQUESTERS, HANDLERS, CHANNELS, HQ_FLOORS } from './servicing-content-data.js';

// ── deterministic-generation utilities (used by buildRequests below) ─────────
// FNV-1a seed → xorshift32 generator (mirrors servicing-data.synthTrend so the
// whole board is deterministic the same way).
function seeded(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < (seedStr || '').length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length) % arr.length];
const fmtAgo = (mins) => (mins < 60 ? `${Math.round(mins)}m ago` : `${(mins / 60).toFixed(1)}h ago`);

// Look up an item's static detail (location, description) by domain + name.
export function contentFor(domain, itemName) {
  return SERVICING_CONTENT[domain]?.items?.[itemName] || null;
}

// Flat item-name → catalog location-string lookup, across every domain, built
// once on first use. The viewer RPC (servicing_open_items_for_viewer) returns
// item NAMES but not their location, so the 3D viewer joins back here to place
// each open item spatially (see resolveLocation in hypervisor-3d-utils.js).
// Item names are effectively unique — only "Sky lobby" and "Irrigation system"
// recur, and both collapse to the same zone — so a flat last-wins map is safe.
let _locationByItem = null;
export function locationForItem(itemName) {
  if (!_locationByItem) {
    _locationByItem = new Map();
    for (const domain of Object.values(SERVICING_CONTENT)) {
      for (const [name, def] of Object.entries(domain?.items || {})) {
        if (def?.location) _locationByItem.set(name, def.location);
      }
    }
  }
  return _locationByItem.get(itemName) || null;
}

// Deterministic request tickets for a row's drill-down. Open tickets match the
// live open_count; a sample of recently-handled tickets illustrates the 24h
// throughput. Returns { tickets: [...], moreHandled } where each ticket is
// { id, status:'open'|'done', ago, requester, ask, handler, channel }.
export function buildRequests(domain, itemName, { openCount = 0, handled = 0 } = {}) {
  const domainCfg = SERVICING_CONTENT[domain] || {};
  const cfg = contentFor(domain, itemName);
  if (!cfg) return { tickets: [], moreHandled: 0 };
  const rand = seeded(`${domain}:${itemName}`);
  const asks = cfg.asks && cfg.asks.length ? cfg.asks : ['Request'];
  // Item config wins, else the domain default, else the building default. Lets a
  // domain set requesterFloors / requesterKind / handlers / channels once.
  const floors = cfg.requesterFloors ?? domainCfg.requesterFloors ?? HQ_FLOORS;
  const isVisitor = (cfg.requesterKind ?? domainCfg.requesterKind) === 'visitor';
  const handlers = domainCfg.handlers?.length ? domainCfg.handlers : HANDLERS;
  const channels = domainCfg.channels?.length ? domainCfg.channels : CHANNELS;
  // Some domains are reported by a SOURCE (control room, an alarm, CCTV, a PPM
  // schedule) rather than a person on a floor — a domain can supply a `requesters`
  // pool used verbatim. Falls back to the occupant "Name · Fl N" form.
  const requesters = domainCfg.requesters?.length ? domainCfg.requesters : null;

  const mkRequester = () => {
    if (requesters) return pick(rand, requesters);
    const name = pick(rand, REQUESTERS);
    if (isVisitor) return `Visitor · ${name}`;
    return `${name} · Fl ${1 + Math.floor(rand() * floors)}`;
  };

  const tickets = [];
  // Open first (most urgent), recent-ish times, no handler yet.
  const open = Math.max(0, Math.min(openCount, 6));
  for (let i = 0; i < open; i++) {
    tickets.push({
      id: `o${i}`,
      status: 'open',
      ago: fmtAgo(4 + rand() * 50),
      requester: mkRequester(),
      ask: pick(rand, asks),
      handler: null,
      channel: pick(rand, channels),
    });
  }
  // A sample of handled-today, descending by time.
  const doneShown = Math.max(0, Math.min(handled, 6));
  let t = 18 + rand() * 25; // minutes ago for the first done one
  for (let i = 0; i < doneShown; i++) {
    tickets.push({
      id: `d${i}`,
      status: 'done',
      ago: fmtAgo(t),
      requester: mkRequester(),
      ask: pick(rand, asks),
      handler: pick(rand, handlers),
      channel: pick(rand, channels),
    });
    t += 25 + rand() * 90;
  }
  return { tickets, moreHandled: Math.max(0, handled - doneShown) };
}
