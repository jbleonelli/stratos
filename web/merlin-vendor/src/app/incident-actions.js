// @ts-check
// Incident actions — the first real multi-user event stream. Writes to
// public.incident_actions whenever a human approves / holds / escalates /
// dismisses / pins an incident, and subscribes to live inserts so
// activity from other users appears without a reload.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { getSession } from './auth.js';

// Local cache for the activity feed so the Dashboard renders instantly
// on mount. Gets populated by the first fetch + realtime inserts.
let recentCache = [];
const listeners = new Set();
function emit() {
  listeners.forEach((fn) => fn(recentCache.slice()));
}

let subscribedChannel = null;
let fetchedOnce = false;

async function fetchRecent(limit = 40) {
  // Scope the feed to the VIEWER's own org. Platform admins bypass per-org RLS
  // so an unfiltered read pulls every tenant in. And a contractor's RLS also
  // lets it read the building OWNER's incident_actions (contained reads) — which
  // on its own AI-Agents feed surfaced the FM's internal chiller/cold-storage
  // approvals (cross-context + stale). Filtering to the active org gives each
  // viewer ITS OWN operator-action stream.
  const orgId = getSession()?.organizationId || null;
  let q = supabase.from('incident_actions').select('*').order('created_at', { ascending: false }).limit(limit);
  if (orgId) q = q.eq('organization_id', orgId);
  const { data, error } = await q;
  if (!error && data) {
    recentCache = data;
    emit();
  }
  fetchedOnce = true;
}

function subscribeRealtime() {
  if (subscribedChannel) return;
  subscribedChannel = supabase
    .channel('incident_actions_live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incident_actions' }, (payload) => {
      // Match the fetch scope: only surface inserts for the viewer's own org
      // (a contractor's RLS would otherwise stream in the owner's actions).
      const orgId = getSession()?.organizationId || null;
      if (orgId && payload.new?.organization_id !== orgId) return;
      recentCache = [payload.new, ...recentCache].slice(0, 40);
      emit();
    })
    .subscribe();
}

// Log a human action against an incident. Best-effort — if the write
// fails (network blip, RLS rejection, unauth) we swallow the error so
// the UI action the user already took (e.g. pinning) still feels
// instant. Errors surface in the console for debugging.
export async function logIncidentAction({ incidentId, incidentTitle, incidentPriority, action, note, locationId }) {
  const session = getSession();
  if (!session?.userId) return null;
  const row = {
    incident_id: incidentId,
    incident_title: incidentTitle || null,
    incident_priority: incidentPriority || null,
    action,
    note: note || null,
    location_id: locationId || null, // Phase 10a-2: subtree rollups
    actor_id: session.userId,
    actor_name: session.name || null,
    actor_role: session.role || null,
    organization_id: session.organizationId || null,
  };
  const { data, error } = await supabase.from('incident_actions').insert(row).select().single();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[incident-actions] log failed:', error.message);
    return null;
  }
  // Optimistic-ish: we'll also get the row back over realtime, but
  // inject it now so the local UI updates immediately without waiting
  // for the round-trip through the channel.
  if (!recentCache.find((r) => r.id === data.id)) {
    recentCache = [data, ...recentCache].slice(0, 40);
    emit();
  }
  return data;
}

// React hook for the activity feed. First call triggers the initial
// fetch + realtime subscription; subsequent calls reuse the cache.
export function useRecentActions(limit = 20) {
  const [rows, setRows] = useState(() => recentCache.slice(0, limit));
  useEffect(() => {
    const fn = (next) => setRows(next.slice(0, limit));
    listeners.add(fn);
    if (!fetchedOnce) fetchRecent();
    subscribeRealtime();
    return () => {
      listeners.delete(fn);
    };
  }, [limit]);
  return rows;
}

// Format a timestamp as a relative "2m ago" string for the feed UI.
// Locale-aware: short dense pattern (`2m ago` / `il y a 2 min`) using
// the active language. Re-imports getLanguage at call time so a
// language flip is reflected on the next caller render. The very-
// recent case ("just now") gets its own dictionary entry since
// Intl.RelativeTimeFormat doesn't have a sub-minute literal.
import { getLanguage, t as ti18n } from './i18n.js';

export function relativeTime(ts) {
  const d = new Date(ts).getTime();
  const diff = Math.max(0, Date.now() - d);
  if (diff < 60000) return ti18n('time.just_now');
  const lang = getLanguage();
  const tag = lang === 'fr' ? 'fr-FR' : 'en-US';
  // Short style → "2m ago" / "il y a 2 min". numeric:'always' so we
  // get "2 minutes ago" not "2 minutes ago" → we want compact "2m ago"
  // in EN; Intl can't quite do that, so fall back to the legacy short
  // form for English and Intl for French (which doesn't have the
  // English compact convention).
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const days = Math.floor(h / 24);
  if (lang === 'en') {
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${days}d ago`;
  }
  // French: use Intl.RelativeTimeFormat for proper pluralization +
  // "il y a" prefix. Pick the largest non-zero unit.
  const fmt = new Intl.RelativeTimeFormat(tag, { numeric: 'auto', style: 'short' });
  if (m < 60) return fmt.format(-m, 'minute');
  if (h < 24) return fmt.format(-h, 'hour');
  return fmt.format(-days, 'day');
}
