// Live compliance data for the ANTICIPATE → Compliance page. Reads the real
// per-building picture from building_compliance_overview(location_id): every
// catalog obligation/certification that APPLIES to the building (by jurisdiction
// × occupancy × systems), joined to what the building actually holds. Un-held
// applicable rows come back as status='missing' — that's the gap. Merlin-proposed
// rows (source='merlin_proposed', confirmed=false) ride along for the suggest lane.
//
// Replaces the hardcoded predict-compliance.js fixtures. Backed by migrations
// compliance_real_schema / compliance_overview_rpc / compliance_seed_hq_psg.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';

export function useBuildingCompliance(buildingId) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!buildingId) {
      setRows([]);
      setLoaded(true);
      return;
    }
    const { data, error } = await supabase.rpc('building_compliance_overview', { p_location_id: buildingId });
    if (error) captureException(error, { where: 'useBuildingCompliance' });
    setRows(error ? [] : data || []);
    setLoaded(true);
  }, [buildingId]);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  return { rows, loaded, reload: load };
}

// Confirm a Merlin-proposed obligation/cert → it becomes a tracked record
// (leaves the suggest lane, joins the building's real compliance picture).
export async function confirmComplianceItem(bcId) {
  const { error } = await supabase
    .from('building_compliance')
    .update({ confirmed: true, updated_at: new Date().toISOString() })
    .eq('id', bcId);
  if (error) captureException(error, { where: 'confirmComplianceItem' });
  return !error;
}

// Dismiss a Merlin-proposed item → remove it (it was never a real obligation).
export async function dismissComplianceItem(bcId) {
  const { error } = await supabase.from('building_compliance').delete().eq('id', bcId);
  if (error) captureException(error, { where: 'dismissComplianceItem' });
  return !error;
}

// Phase 2b — ask Merlin to RESEARCH the building's profile and propose
// obligations/certs it may be missing (writes merlin_proposed rows into the
// suggest lane; nothing is auto-applied). Server-side LLM call (key + spend
// guard live in /api/compliance-propose). Returns the proposed count.
// Throws on any non-2xx so the caller can surface a branded error.
export async function proposeComplianceItems(buildingId) {
  if (!buildingId) return { proposed: 0 };
  const headers = { 'content-type': 'application/json' };
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) headers.authorization = `Bearer ${session.access_token}`;
  } catch {
    /* proceed without auth — endpoint will 401 */
  }
  const res = await fetch('/api/compliance-propose', {
    method: 'POST',
    headers,
    body: JSON.stringify({ buildingId }),
  });
  if (!res.ok) {
    let code = `propose_failed_${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) code = j.error;
    } catch {
      /* keep status code */
    }
    const err = new Error(code);
    captureException(err, { where: 'proposeComplianceItems', status: res.status });
    throw err;
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Chat grounding. Replaces the static predict-compliance.js directories that
// chatBackend.js used to inline into every building payload (which wrongly fed
// US-office NFPA/ASHRAE/ADA facts to *every* building, PSG included). Pulls the
// SAME building_compliance_overview rows the CompliancePage shows, so Merlin
// speaks to the building's REAL, per-jurisdiction obligations & certifications
// — and refuses (no block) for buildings with no profile, instead of bluffing.
//
// Returns { compliance, certifications } in the compact shapes api/chat.ts's
// complianceSummary()/certificationSummary() expect. Cached per building for a
// short window so back-to-back messages don't each pay an RPC round-trip.
const CHAT_DIR_TTL_MS = 60_000;
const _chatDirCache = new Map(); // buildingId → { at, dirs }

function obligationDetail(r) {
  const base = (r.note || r.description || r.what_it_is || '').trim();
  const due = r.next_due ? ` (next due ${r.next_due})` : '';
  const proposed = r.source === 'merlin_proposed' && !r.confirmed ? 'Merlin-proposed, not yet confirmed — ' : '';
  return `${proposed}${base}${due}`.trim();
}

function certDetail(r) {
  return (r.note || r.description || '').trim();
}

export async function complianceDirectoriesForChat(buildingId) {
  const empty = { compliance: [], certifications: [] };
  if (!buildingId) return empty;

  const cached = _chatDirCache.get(buildingId);
  if (cached && Date.now() - cached.at < CHAT_DIR_TTL_MS) return cached.dirs;

  const { data, error } = await supabase.rpc('building_compliance_overview', { p_location_id: buildingId });
  if (error) {
    captureException(error, { where: 'complianceDirectoriesForChat' });
    return empty; // fail-soft: chat just omits the compliance block
  }
  const rows = data || [];

  const compliance = rows
    .filter((r) => r.scope === 'obligation')
    .map((r) => ({
      framework: r.name,
      area: r.area || '',
      status: r.status, // compliant | review | action | missing
      detail: obligationDetail(r),
    }));

  const certifications = rows
    .filter((r) => r.scope === 'certification')
    .map((r) => ({
      name: r.name,
      org: r.authority || '',
      level: r.level || (r.status === 'missing' ? 'not held' : ''),
      score: r.score || (r.status === 'missing' ? '—' : ''),
      detail: certDetail(r),
    }));

  const dirs = { compliance, certifications };
  _chatDirCache.set(buildingId, { at: Date.now(), dirs });
  return dirs;
}

// ---------------------------------------------------------------------------
// Evidence linking. A compliance item can point to a document in the org's
// sop_documents store (evidence_doc_id) or an external URL (evidence_url) as
// PROOF it's held — surfaced on the page + Reference section. Both writes are
// org-scoped client-side (RLS), same as confirm/dismiss.

// The building's documents (org-scoped by RLS), for the "Link evidence" picker.
// Includes org-wide docs (location_id null) plus this building's own.
export function useBuildingDocuments(buildingId) {
  const [docs, setDocs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      // rls-scope-ok: RLS scopes sop_documents to the org; the building filter is applied client-side below
      .from('sop_documents')
      .select('id, title, category, url, location_id')
      .order('title');
    if (error) captureException(error, { where: 'useBuildingDocuments' });
    const all = error ? [] : data || [];
    // Keep org-wide + this building's docs (RLS already scoped to the org).
    setDocs(all.filter((d) => !d.location_id || d.location_id === buildingId));
    setLoaded(true);
  }, [buildingId]);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  return { docs, loaded, reload: load };
}

// Link evidence to a compliance item — either a stored document (docId) or an
// external URL. Passing neither clears the link. Returns true on success.
export async function linkComplianceEvidence(bcId, { docId = null, url = null } = {}) {
  const { error } = await supabase
    .from('building_compliance')
    .update({ evidence_doc_id: docId, evidence_url: url, updated_at: new Date().toISOString() })
    .eq('id', bcId);
  if (error) captureException(error, { where: 'linkComplianceEvidence' });
  return !error;
}

// ---------------------------------------------------------------------------
// Audit scheduling. Compliance audits reuse the inspections table
// (inspection_type='compliance'), tied to the obligation via building_compliance_id.
// inspections has no client-write RLS by design, so writes go through the
// SECURITY DEFINER RPCs schedule_compliance_audit / cancel_compliance_audit
// (org-guarded server-side). Reads are allowed by the org-scoped SELECT policy.

export function useComplianceAudits(buildingId) {
  const [audits, setAudits] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!buildingId) {
      setAudits([]);
      setLoaded(true);
      return;
    }
    const { data, error } = await supabase
      .from('inspections')
      .select('id, scheduled_for, status, result, inspector, building_compliance_id')
      .eq('location_id', buildingId)
      .eq('inspection_type', 'compliance')
      .order('scheduled_for', { ascending: true });
    if (error) captureException(error, { where: 'useComplianceAudits' });
    setAudits(error ? [] : data || []);
    setLoaded(true);
  }, [buildingId]);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  return { audits, loaded, reload: load };
}

// Schedule an audit for a compliance obligation (date as 'YYYY-MM-DD'). Returns
// the new inspection id, or throws on RLS/validation failure.
export async function scheduleComplianceAudit(bcId, dateStr, inspector) {
  const { data, error } = await supabase.rpc('schedule_compliance_audit', {
    p_bc_id: bcId,
    p_scheduled_for: dateStr,
    p_inspector: inspector || null,
  });
  if (error) {
    captureException(error, { where: 'scheduleComplianceAudit' });
    throw error;
  }
  return data;
}

// Cancel a still-scheduled audit. Returns true on success.
export async function cancelComplianceAudit(inspectionId) {
  const { data, error } = await supabase.rpc('cancel_compliance_audit', { p_inspection_id: inspectionId });
  if (error) captureException(error, { where: 'cancelComplianceAudit' });
  return !error && data === true;
}

// Status → severity tone. A missing OBLIGATION is a real exposure (risk); a
// missing CERTIFICATION is just an opportunity (neutral). Held items carry the
// usual compliant/at-risk/breach reading.
export function complianceTone(status, scope) {
  switch (status) {
    case 'compliant':
    case 'certified':
      return 'ok';
    case 'action':
      return 'risk';
    case 'review':
    case 'in_progress':
      return 'warn';
    case 'missing':
      return scope === 'certification' ? 'info' : 'risk';
    default:
      return 'ok';
  }
}

// Whole days from today until `dueIso` (negative = overdue). null when no date.
export function daysUntil(dueIso) {
  if (!dueIso) return null;
  const due = new Date(dueIso + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due - now) / 86400000);
}
