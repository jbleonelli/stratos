// @ts-check
// Service-line awareness for contractor workspaces.
//
// A contractor org can hold contracts across several disciplines
// (cleaning / security / maintenance / hospitality). When such a contractor
// is the active workspace, Merlin tailors itself to ONE service line at a
// time — the agent grid, the chat persona, and (Phase 2) the ANTICIPATE view
// all key off the current line. Multi-service contractors (e.g. Apex
// Facilities Group) get a switcher in the top bar; single-service contractors
// are auto-pinned to their one line and the switcher hides.
//
// The current line is module-scope state (mirrors the auth.js / org-data.js
// store pattern) so any component can read it via useServiceLine() without
// prop-threading through the whole shell.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from './supabase.js';

// Canonical, stable display order. contracts.service_kind 'other' is the
// legacy hospitality value (Sequoia, pre-mig-209) — canonicalize it to
// 'hospitality' so the switcher and tailoring read cleanly.
export const SERVICE_LINE_ORDER = ['cleaning', 'security', 'maintenance', 'hospitality'];

export function canonicalServiceLine(kind) {
  return kind === 'other' ? 'hospitality' : kind;
}

let current = null;
const listeners = new Set();
function emit() {
  listeners.forEach((fn) => fn());
}
function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getServiceLine() {
  return current;
}
export function setServiceLine(line) {
  if (line === current) return;
  current = line;
  emit();
}

// Subscribe to the current service line. Returns null when no contractor
// line is active (customer / real_estate orgs).
export function useServiceLine() {
  return useSyncExternalStore(subscribe, getServiceLine, () => null);
}

// Load the distinct service lines a contractor org is on (from its ACTIVE
// contracts), canonicalized + stably ordered. Initializes the current line
// to the first one when unset/invalid. Returns [] for non-contractor orgs.
// RLS: a contractor reads its own contracts (contractor_org_id =
// current_user_org()), so this query is naturally scoped — no leak.
export function useContractorServiceLines(orgId, orgKind) {
  const [lines, setLines] = useState([]);
  useEffect(() => {
    if (orgKind !== 'contractor' || !orgId) {
      setLines([]);
      setServiceLine(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('service_kind')
        .eq('contractor_org_id', orgId)
        .eq('status', 'active');
      if (cancelled || error) return;
      const present = new Set((data || []).map((r) => canonicalServiceLine(r.service_kind)));
      const ordered = SERVICE_LINE_ORDER.filter((l) => present.has(l));
      setLines(ordered);
      const cur = getServiceLine();
      if (!cur || !ordered.includes(cur)) setServiceLine(ordered[0] || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, orgKind]);
  return lines;
}
