// Bridge between the in-memory simulator and the public.events table.
// Phase 1 of docs/architecture/events-pipeline.md: every simulator
// incident also writes a row to events so surfaces will eventually
// be able to read one source instead of merging two streams.
//
// Backward compatibility: the in-memory `incidents` array stays the
// authoritative source for existing surfaces. This bridge is fire-
// and-forget side-write. When phase 3 cuts surfaces over to events,
// we'll drop the in-memory array.
//
// Idempotency: each simulator incident has a stable `id` like
// `i-sim-501`. We use that as the event's external_id, so a re-mount
// of this hook doesn't duplicate rows for incidents already seen
// in a previous session. (Same id is unique across the simulator's
// lifetime via a monotonically-incrementing counter.)

import { useEffect, useRef } from 'react';
import { supabase } from './supabase.js';
import { useAppData } from './simulator.js';

// Map simulator incident priorities → events.severity enum values.
function severityFromPriority(priority) {
  if (priority === 'critical') return 'critical';
  if (priority === 'high') return 'high';
  if (priority === 'medium') return 'medium';
  return 'info';
}

// Map simulator icon → events.kind. Best-effort — we use the template
// key on the incident if available (newer incidents carry _statusKey
// which hints at the template, but the actual key isn't preserved on
// the row). Fall back to the icon name.
function kindFor(inc) {
  if (inc?._tplKey) return inc._tplKey;
  if (inc?.icon) return inc.icon;
  return 'sim_event';
}

// Best-guess location: simulator incidents carry params.fl (floor
// number) on most templates. We map to ${building.id}-fl-${fl} which
// is the location_id format the location tree uses. If no fl, fall
// back to the building id (whole-building event).
function locationFor(inc, buildingId) {
  if (!buildingId) return null;
  // Try to extract a floor number from the title — simulator templates
  // interpolate {fl} as "Floor 32" or similar. Match the digits.
  const fl =
    inc?.params?.fl ??
    (typeof inc?.title === 'string' && /\bFloor\s+(\d+)\b/i.test(inc.title)
      ? Number((inc.title.match(/\bFloor\s+(\d+)\b/i) || [])[1])
      : null);
  return Number.isFinite(fl) ? `${buildingId}-fl-${fl}` : buildingId;
}

export function useSimulatorEventsBridge(orgId, building) {
  // What we've already written, by incident id. Survives the hook's
  // lifetime so a re-render doesn't re-insert.
  const writtenRef = useRef(new Set());
  const appData = useAppData(building);
  const incidents = appData?.incidents;

  useEffect(() => {
    if (!orgId || !building?.id || !Array.isArray(incidents)) return;
    // Only HQ-style buildings receive simulator content (useAppData
    // returns empty for non-hq). Skip otherwise to avoid noise.
    if (building.id !== 'hq') return;

    const writeQueue = [];
    for (const inc of incidents) {
      if (!inc?._sim) continue; // only simulator-spawned incidents
      if (!inc.id) continue;
      if (writtenRef.current.has(inc.id)) continue;
      writtenRef.current.add(inc.id);
      writeQueue.push({
        organization_id: orgId,
        location_id: locationFor(inc, building.id),
        source_kind: 'simulator',
        source_ref: `sim:${kindFor(inc)}`,
        kind: kindFor(inc),
        severity: severityFromPriority(inc.priority),
        payload: {
          title: inc.title || null,
          sub: inc.sub || null,
          sla: inc.sla || null,
          status: inc.status || null,
          icon: inc.icon || null,
        },
        external_id: inc.id,
      });
    }
    if (writeQueue.length === 0) return;

    // Fire-and-forget. Authenticated client writes via events_insert_own
    // RLS policy (org-scoped). External_id makes the insert idempotent
    // so cold-start mass-writes of the existing incident pool don't
    // duplicate existing rows from a previous session.
    void supabase.from('events').upsert(writeQueue, {
      onConflict: 'organization_id,external_id',
      ignoreDuplicates: true,
    });
  }, [orgId, building?.id, incidents]);
}
