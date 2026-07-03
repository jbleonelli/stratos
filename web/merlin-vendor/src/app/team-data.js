// Team members + weekly availability — Phase 8a.
// Postgres-backed with a localStorage cache so reads are synchronous on
// mount. Writes go through the superadmin/facility RLS policy.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { getSession } from './auth.js';
import { fetchAllPaginated } from './pagination.js';
import { registerAuthAwareCache } from './use-auth-aware-cache.js';

const CACHE_KEY = 'merlin-team';

// ────── in-memory cache

let cache = {
  members: [],
  availabilityByMember: {}, // memberId → [{ dow, start_time, end_time, kind }]
};
const listeners = new Set();
function emit() {
  listeners.forEach((fn) => fn(snapshot()));
}
function snapshot() {
  return { members: cache.members.slice(), availabilityByMember: { ...cache.availabilityByMember } };
}

function loadCache() {
  if (typeof window === 'undefined') return;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '') || cache;
  } catch {}
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
    // Defensive paging — these tables are small per-tenant today (a
    // few dozen members + their availability rows) but unbounded in
    // theory.
    // Platform admins bypass per-org RLS (is_platform_admin) and would pull
    // EVERY tenant's roster into this shared cache (the badge_uid → member map
    // collapses across orgs). Scope them to the active org. Non-admins are
    // already correctly scoped by RLS.
    const orgId = getSession()?.organizationId || null;
    const scopeAdmin = (q) => (getSession()?.isPlatformAdmin && orgId ? q.eq('organization_id', orgId) : q);
    let members, avail;
    try {
      [members, avail] = await Promise.all([
        fetchAllPaginated(() => scopeAdmin(supabase.from('team_members').select('*').order('team').order('name'))),
        fetchAllPaginated(() => scopeAdmin(supabase.from('team_availability').select('*').order('member_id'))),
      ]);
    } catch (e) {
      captureException(e, { where: 'hydrateOnce' });
      // eslint-disable-next-line no-console
      console.warn('[team-data] hydrate failed:', e.message);
      hydrated = true;
      return;
    }
    hydrated = true;
    cache.members = members || [];
    cache.availabilityByMember = {};
    for (const row of avail || []) {
      (cache.availabilityByMember[row.member_id] ||= []).push(row);
    }
    saveCache();
    emit();
  })();
  return hydratingPromise;
}

// Drop stale cache when the active user changes — otherwise a previous
// user's team membership leaks into the next user's view on the same browser.
registerAuthAwareCache({
  resetHydrate: () => {
    hydrated = false;
    hydratingPromise = null;
  },
  onSignOut: () => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
    cache = { members: [], availabilityByMember: {} };
    emit();
  },
  onSignIn: () => hydrateOnce(),
});

export function useTeam() {
  const [state, setState] = useState(() => snapshot());
  useEffect(() => {
    const fn = (next) => setState(next);
    listeners.add(fn);
    hydrateOnce();
    return () => listeners.delete(fn);
  }, []);
  return state;
}

export function availabilityFor(memberId) {
  return cache.availabilityByMember[memberId] || [];
}

// ────── writes

export async function createMember({ name, team, role, initials, email, phone }) {
  if (!name || !team) throw new Error('Name and team are required.');
  const row = {
    name: name.trim(),
    team,
    role: role?.trim() || null,
    initials: initials?.trim().slice(0, 3).toUpperCase() || null,
    email: email?.trim() || null,
    phone: phone?.trim() || null,
    organization_id: getSession()?.organizationId || null,
  };
  const { data, error } = await supabase.from('team_members').insert(row).select().single();
  if (error) throw new Error(error.message);
  cache.members = [...cache.members, data];
  saveCache();
  emit();
  return data;
}

export async function updateMember(id, patch) {
  const clean = {};
  for (const k of ['name', 'team', 'role', 'initials', 'email', 'phone', 'active']) {
    if (patch[k] !== undefined) clean[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k];
  }
  const { data, error } = await supabase.from('team_members').update(clean).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  cache.members = cache.members.map((m) => (m.id === id ? data : m));
  saveCache();
  emit();
  return data;
}

export async function deleteMember(id) {
  const { error } = await supabase.from('team_members').delete().eq('id', id);
  if (error) throw new Error(error.message);
  cache.members = cache.members.filter((m) => m.id !== id);
  delete cache.availabilityByMember[id];
  saveCache();
  emit();
}

// Replace a member's availability for a single day-of-week. `windows` is
// an array of { start_time, end_time } — we delete all existing rows
// for that dow and insert the new set. Empty array → clear the day.
export async function setAvailability(memberId, dow, windows) {
  const del = await supabase.from('team_availability').delete().eq('member_id', memberId).eq('dow', dow);
  if (del.error) throw new Error(del.error.message);

  let inserted = [];
  if (windows.length > 0) {
    const orgId = getSession()?.organizationId || null;
    const rows = windows.map((w) => ({
      member_id: memberId,
      dow,
      start_time: w.start_time,
      end_time: w.end_time,
      kind: w.kind || 'work',
      organization_id: orgId,
    }));
    const { data, error } = await supabase.from('team_availability').insert(rows).select();
    if (error) throw new Error(error.message);
    inserted = data;
  }

  cache.availabilityByMember[memberId] = [
    ...(cache.availabilityByMember[memberId] || []).filter((w) => w.dow !== dow),
    ...inserted,
  ];
  saveCache();
  emit();
  return inserted;
}

// ────── display helpers

export const DAY_LABELS = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon-first week layout

// Summarise a member's week as a compact text: "Mon–Fri 06–14 · Sat 06–10"
export function describeWeek(memberId) {
  const byDow = {};
  for (const w of availabilityFor(memberId)) {
    if (w.kind !== 'work') continue;
    (byDow[w.dow] ||= []).push(w);
  }
  const parts = [];
  for (const dow of DAY_ORDER) {
    const ws = byDow[dow] || [];
    if (ws.length === 0) continue;
    const win = ws.map((w) => `${w.start_time.slice(0, 5)}–${w.end_time.slice(0, 5)}`).join(', ');
    parts.push(`${DAY_LABELS[dow]} ${win}`);
  }
  return parts.join(' · ') || 'Off all week';
}
