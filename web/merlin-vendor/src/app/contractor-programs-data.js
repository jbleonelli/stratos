// contractor-programs-data.js — data hooks for the two contractor "programs":
// FM quality-control inspections (mig 228) and improvement/wellbeing
// suggestions (mig 229). Both are contractor-org-scoped, RLS-guarded reads;
// the suggestion send/dismiss action goes through the party-guarded RPC.

import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';

// ── FM quality-control inspections ──────────────────────────────────
export function useInspections(orgId) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(true);
      return;
    }
    let alive = true;
    setLoaded(false);
    (async () => {
      const { data } = await supabase
        .from('inspections')
        .select(
          'id, service_kind, scheduled_for, status, score, result, inspector, inspection_type, corrective_action, findings',
        )
        .eq('organization_id', orgId)
        .order('scheduled_for', { ascending: false });
      if (!alive) return;
      setRows(data || []);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [orgId, tick]);
  return { inspections: rows, loaded, refresh: () => setTick((n) => n + 1) };
}

// ── Improvement / wellbeing suggestions ─────────────────────────────
export function useContractorSuggestions(orgId) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(true);
      return;
    }
    let alive = true;
    setLoaded(false);
    (async () => {
      const { data } = await supabase
        .from('contractor_suggestions')
        .select('id, manager_org_id, category, title, body, impact, status, source, created_at, decided_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (!alive) return;
      setRows(data || []);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [orgId, tick]);
  return { suggestions: rows, loaded, refresh: () => setTick((n) => n + 1) };
}

// Contractor send / dismiss / un-send (party-guarded RPC, mig 229).
export async function setSuggestionStatus(id, status) {
  const { error } = await supabase.rpc('set_suggestion_status', { p_id: id, p_status: status });
  if (error) throw error;
}

// ── Manager / FM side (#2) — the client viewing & deciding on the contractors
// it works with. Reads admitted by the inspections / contractor_suggestions
// read policies (manager_org_id = current_user_org()). Contractor names come
// from the manager's own contracts (party read), so no cross-org org-table read.
async function contractorNameMap(managerOrgId) {
  try {
    const { data } = await supabase
      .from('contracts')
      .select('contractor_org_id, contractor:organizations!contracts_contractor_org_id_fkey(name)')
      .eq('manager_org_id', managerOrgId);
    const m = {};
    for (const c of data || []) {
      if (c.contractor_org_id) m[c.contractor_org_id] = c.contractor?.name || null;
    }
    return m;
  } catch (e) {
    captureException(e, { where: 'contractorNameMap' });
    return {};
  }
}

// ── Manager / FM view of the contracts it holds, with SLA penalty terms ──
// Admitted by the contracts read policy (manager_org_id = current_user_org()).
// Carries each contract's penalty terms (jsonb) so the FM can author them.
export function useManagerContracts(orgId) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(true);
      return;
    }
    let alive = true;
    setLoaded(false);
    (async () => {
      const { data } = await supabase
        .from('contracts')
        .select(
          'id, name, status, service_kind, monthly_value, currency, penalties, contractor_org_id, contractor:organizations!contracts_contractor_org_id_fkey(name)',
        )
        .eq('manager_org_id', orgId)
        .eq('status', 'active')
        .order('service_kind', { ascending: true });
      if (!alive) return;
      setRows((data || []).map((r) => ({ ...r, contractor: r.contractor?.name || 'Contractor' })));
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [orgId, tick]);
  return { contracts: rows, loaded, refresh: () => setTick((n) => n + 1) };
}

export function useManagerInspections(orgId) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(true);
      return;
    }
    let alive = true;
    setLoaded(false);
    (async () => {
      const { data } = await supabase
        .from('inspections')
        .select(
          'id, organization_id, service_kind, scheduled_for, status, score, result, inspector, inspection_type, corrective_action, findings',
        )
        .eq('manager_org_id', orgId)
        .order('scheduled_for', { ascending: false });
      const names = await contractorNameMap(orgId);
      if (!alive) return;
      setRows((data || []).map((r) => ({ ...r, contractor: names[r.organization_id] || 'Contractor' })));
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [orgId, tick]);
  return { inspections: rows, loaded, refresh: () => setTick((n) => n + 1) };
}

export function useManagerSuggestions(orgId) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(true);
      return;
    }
    let alive = true;
    setLoaded(false);
    (async () => {
      const { data } = await supabase
        .from('contractor_suggestions')
        .select('id, organization_id, category, title, body, impact, status, created_at, decided_at')
        .eq('manager_org_id', orgId)
        .order('created_at', { ascending: false });
      const names = await contractorNameMap(orgId);
      if (!alive) return;
      setRows((data || []).map((r) => ({ ...r, contractor: names[r.organization_id] || 'Contractor' })));
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [orgId, tick]);
  return { suggestions: rows, loaded, refresh: () => setTick((n) => n + 1) };
}

// Manager adopt / decline (manager-party-guarded RPC, mig 230).
export async function setSuggestionDecision(id, status) {
  const { error } = await supabase.rpc('set_suggestion_decision', { p_id: id, p_status: status });
  if (error) throw error;
}
