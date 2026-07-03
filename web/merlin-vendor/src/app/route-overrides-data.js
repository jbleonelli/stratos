// Route overrides — Phase 8d. Records human or Merlin deviations
// from a route's recurring assignment for a given day. Append-only
// audit log: to "cancel" an override, insert a later one that
// reverses it. Postgres-backed with localStorage cache.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { getSession } from './auth.js';
import { fetchAllPaginated } from './pagination.js';
import { registerAuthAwareCache } from './use-auth-aware-cache.js';

const CACHE_KEY = 'merlin-route-overrides';

export const OVERRIDE_ACTIONS = [
  { id: 'reassign', label: 'Reassign' },
  { id: 'skip', label: 'Skip' },
  { id: 'extra', label: 'Extra run' },
  { id: 'note', label: 'Note' },
];

// ────── cache

let cache = []; // array of override rows (all of them — small demo-scale volume)
const listeners = new Set();
function emit() {
  listeners.forEach((fn) => fn(cache.slice()));
}

function loadCache() {
  if (typeof window === 'undefined') return;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]') || [];
  } catch {
    cache = [];
  }
}
function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

loadCache();

// ────── hydration

let hydrated = false;
let hydratingPromise = null;

async function hydrateOnce() {
  if (hydrated) return;
  if (hydratingPromise) return hydratingPromise;
  hydratingPromise = (async () => {
    // Paginated past PostgREST's 1000-row cap. route_overrides is the
    // worst offender — every override on every route accumulates,
    // so a busy tenant crosses 1000 in a few weeks.
    // Platform admins bypass per-org RLS (is_platform_admin) and would pull
    // EVERY tenant's overrides into this shared cache. Scope them to the active
    // org. Non-admins (customers + contractors) are already correctly scoped by
    // RLS — must NOT filter them or contractor cross-org reads break.
    const orgId = getSession()?.organizationId || null;
    const scopeAdmin = (q) => (getSession()?.isPlatformAdmin && orgId ? q.eq('organization_id', orgId) : q);
    let data = null,
      error = null;
    try {
      // rls-perf-ok: customers rely on RLS scoping; the table is kept small by
      // cron-route-override-prune (deletes non-permanent rows >7d old, #1045),
      // so the whole-table read stays bounded — see engineering_gotchas.
      data = await fetchAllPaginated(() =>
        scopeAdmin(supabase.from('route_overrides').select('*').order('created_at', { ascending: false })),
      );
    } catch (e) {
      error = e;
      captureException(e, { where: 'hydrateOnce' });
    }
    hydrated = true;
    if (!error && data) {
      cache = data;
      saveCache();
      emit();
    }
  })();
  return hydratingPromise;
}

// Drop stale cache when the active user changes — otherwise a previous
// user's overrides leak into the next user's view on the same browser.
registerAuthAwareCache({
  resetHydrate: () => {
    hydrated = false;
    hydratingPromise = null;
  },
  onSignOut: () => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
    cache = [];
    emit();
  },
  onSignIn: () => hydrateOnce(),
});

export function useOverrides() {
  const [rows, setRows] = useState(() => cache.slice());
  useEffect(() => {
    const fn = (next) => setRows(next);
    listeners.add(fn);
    hydrateOnce();
    return () => listeners.delete(fn);
  }, []);
  return rows;
}

// Overrides applicable to a route on a given date. A row applies if
// - its date matches exactly (one-off), OR
// - permanent=true and its date <= target date (effective forever after).
// Returned newest-first so the caller can treat the first row as the
// "winning" effective state.
export function overridesForRouteOnDate(routeId, dateStr) {
  return cache
    .filter((o) => o.route_id === routeId && (o.date === dateStr || (o.permanent && o.date <= dateStr)))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

// Single "effective override" for a route on a date — the newest row
// that applies. Null if none. This is what the UI shows as the
// active deviation.
export function effectiveOverride(routeId, dateStr) {
  const list = overridesForRouteOnDate(routeId, dateStr);
  // Skip "note" overrides — they're informational, not a state change.
  for (const o of list) {
    if (o.action !== 'note') return o;
  }
  return null;
}

// ────── writes

export async function createOverride({
  route_id,
  date,
  permanent,
  action,
  from_member_id,
  to_member_id,
  reason,
  source,
}) {
  if (!route_id || !date || !action) throw new Error('route_id, date, and action are required.');
  const session = getSession();
  const row = {
    route_id,
    date,
    permanent: !!permanent,
    action,
    from_member_id: from_member_id || null,
    to_member_id: to_member_id || null,
    reason: reason?.trim() || null,
    source: source || 'human',
    created_by: session?.userId || null,
    organization_id: session?.organizationId || null,
  };
  const { data, error } = await supabase.from('route_overrides').insert(row).select().single();
  if (error) throw new Error(error.message);
  cache = [data, ...cache];
  saveCache();
  emit();
  return data;
}

export async function deleteOverride(id) {
  const { error } = await supabase.from('route_overrides').delete().eq('id', id);
  if (error) throw new Error(error.message);
  cache = cache.filter((o) => o.id !== id);
  saveCache();
  emit();
}

// ────── date helpers

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function dowOf(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay();
}
