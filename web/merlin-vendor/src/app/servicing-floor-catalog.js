// servicing-floor-catalog.js — per-building floor routing for the 3D servicing
// viewer (Hypervisor).
//
// WHY THIS EXISTS
// Meridian HQ names its floor rows `${buildingId}-fl-N` (hq-fl-1 … hq-fl-50),
// so the servicing placement can light a real floor just by templating that id
// from a floor NUMBER. Non-Meridian demo buildings (Campus PSG, Hemisphere
// Center) use SEMANTIC floor ids instead — `psg-pro-aquatics`,
// `hem-concourse-north` — and have NO `-fl-N` rows. The shared servicing
// content catalog is Meridian-flavoured ("Fl 50 · Club", "Lobby · …"), so on a
// named-floor building those labels resolve to floor NUMBERS that point at rows
// which don't exist → the tower never lights its floors (only the synthetic
// off-stack roof/basement/perimeter markers showed through).
//
// This module maps a servicing open-item to one of a building's ACTUAL named
// floor rows, by service line, so the right floors light up and drill in.
//
// ADD-A-BUILDING RECIPE
// For a new named-floor building, add an entry keyed by its building id:
//   - `byLine`: service line ('cleaning' | 'security' | 'hospitality' |
//     'maintenance') → ordered list of floor ids that line should land on
//     (most-relevant first). Items within a line are spread deterministically
//     across the list, so list every floor the line plausibly touches.
//   - `default`: fallback ordered floor ids for any line not in `byLine`.
// Floor ids are validated against the live floor rows at call time, so a typo
// or a since-renamed floor is skipped rather than lighting a phantom row. A
// named-floor building with NO catalog entry still lights up — it falls back to
// an ordinal mapping (Meridian floor number clamped into the stack).

// Per-building line → floor-id routing. Floor ids are the seeded `locations.id`
// values (see scripts/seed-campus-psg.sql, scripts/seed-hemisphere-center.sql).
export const FLOOR_CATALOG = Object.freeze({
  // PSG first-team performance building — 5 named floors.
  'psg-pro': {
    byLine: {
      // Cleaning touches every floor — spread across all five.
      cleaning: ['psg-pro-locker', 'psg-pro-aquatics', 'psg-pro-dining', 'psg-pro-medical', 'psg-pro-perf'],
      // Plant-heavy work clusters on the pool hall, gym and kitchen.
      maintenance: ['psg-pro-aquatics', 'psg-pro-perf', 'psg-pro-dining', 'psg-pro-medical', 'psg-pro-locker'],
      // Front-of-house / guest-facing → restaurant + medical reception.
      hospitality: ['psg-pro-dining', 'psg-pro-medical'],
      // Access control / valuables → changing rooms + medical store.
      security: ['psg-pro-locker', 'psg-pro-medical', 'psg-pro-perf'],
    },
    default: ['psg-pro-perf', 'psg-pro-aquatics', 'psg-pro-medical', 'psg-pro-dining', 'psg-pro-locker'],
  },

  // PSG academy residence — two dorm wings.
  'psg-res': {
    default: ['psg-res-wing-a', 'psg-res-wing-b'],
  },

  // PSG academy sports hall — indoor court + training hall.
  'psg-sport': {
    default: ['psg-sport-court', 'psg-sport-hall'],
  },

  // PSG academy education centre — single classrooms floor.
  'psg-edu': {
    default: ['psg-edu-classrooms'],
  },

  // Hemisphere stadium — 10 named decks/zones.
  'hemisphere-stadium': {
    byLine: {
      // Cleaning → spectator-facing concourses, bowls and suites.
      cleaning: [
        'hem-concourse-north',
        'hem-concourse-south',
        'hem-lower-bowl',
        'hem-mid-deck',
        'hem-upper-deck',
        'hem-suites',
      ],
      // Maintenance → field/turf, premium suites, press, service spaces.
      maintenance: ['hem-field', 'hem-suites', 'hem-press-box', 'hem-loading-dock', 'hem-parking'],
      // Hospitality → premium suites, concourses, press box.
      hospitality: ['hem-suites', 'hem-concourse-north', 'hem-concourse-south', 'hem-press-box'],
      // Security → gates/parking, concourses, field, dock.
      security: ['hem-parking', 'hem-concourse-north', 'hem-concourse-south', 'hem-field', 'hem-loading-dock'],
    },
    default: ['hem-concourse-north', 'hem-lower-bowl', 'hem-suites', 'hem-field', 'hem-concourse-south'],
  },
});

// Stable, dependency-free string hash (djb2) → non-negative int. Used to spread
// items deterministically across a line's candidate floors, so the same item
// always lands on the same floor (no Math.random — keeps replay/demo stable).
function hashStr(s) {
  let h = 5381;
  const str = String(s || '');
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

// Resolve a single floor/band open-item to the floor ROW id it should light on
// a named-floor building.
//   - `buildingId`  building whose floors we're placing into
//   - `item`        the open item ({ line, item, hours_over, … })
//   - `floorRows`   the building's ordered floor rows ([{ id, … }], bottom→top)
//   - `ordinal`        the Meridian-derived floor number (used only for the
//                      no-catalog ordinal fallback)
//   - `contentTopFloor` the floor count the content was authored against (50,
//                      Meridian) — scales the ordinal fallback into this
//                      building's shorter stack
// Returns a floor id present in `floorRows`, or null if the building has no
// floors to place into.
export function floorIdForItem(buildingId, item, floorRows, { ordinal = 1, contentTopFloor = 50 } = {}) {
  const ids = (floorRows || []).map((f) => f && f.id).filter(Boolean);
  if (ids.length === 0) return null;
  const idSet = new Set(ids);

  const cfg = FLOOR_CATALOG[buildingId];
  if (cfg) {
    const line = String((item && item.line) || '').toLowerCase();
    let candidates = (cfg.byLine && cfg.byLine[line]) || cfg.default || null;
    if (candidates) candidates = candidates.filter((id) => idSet.has(id));
    if (candidates && candidates.length > 0) {
      const idx = hashStr(`${(item && item.line) || ''}:${(item && item.item) || ''}`) % candidates.length;
      return candidates[idx];
    }
  }

  // No catalog (or none of its ids survive validation): ordinal fallback —
  // scale the Meridian-derived floor number (1..contentTopFloor) into this
  // building's stack so it still lights a real floor.
  const top = Math.max(1, Number(contentTopFloor) || 50);
  const frac = Math.min(1, Math.max(0, (Number(ordinal) || 1) / top));
  const idx = Math.min(ids.length - 1, Math.max(0, Math.round(frac * (ids.length - 1))));
  return ids[idx];
}

// True when a building names its floors `${buildingId}-fl-N` (Meridian-style),
// i.e. the legacy numeric placement applies. A building with no such rows is a
// named-floor building and routes through floorIdForItem().
export function isNumericFloorBuilding(buildingId, floorRows) {
  if (!Array.isArray(floorRows) || floorRows.length === 0) return true; // default to legacy
  const re = new RegExp(`^${String(buildingId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-fl-\\d+$`);
  return floorRows.some((f) => f && re.test(f.id));
}
