// Per-building Setup state — the data layer behind Admin → Setup.
// PRD: docs/architecture/building-setup.md. State lives in
// locations.setup_progress (jsonb, mig 170); writes go through the
// SECURITY DEFINER set_building_setup RPC (server-side jsonb merge).
//
// setup_progress shape (per section id):
//   { profile: { done: true, updated_at }, contracts: { done: false, count: 0 }, ... }

import { supabase } from './supabase.js';

// The setup sections, in display order. `phase` documents which delivery
// phase ships the section's deep panel (PRD §8); the hub renders all of
// them from day one. `optionalForVerticals` lets readiness skip sections
// that don't apply to a given building vertical.
export const SETUP_SECTIONS = [
  {
    id: 'profile',
    labelKey: 'setup.section.profile.label',
    descKey: 'setup.section.profile.desc',
    icon: 'building',
    phase: 1,
  },
  {
    id: 'spatial',
    labelKey: 'setup.section.spatial.label',
    descKey: 'setup.section.spatial.desc',
    icon: 'floor',
    phase: 1,
  },
  {
    id: 'devices',
    labelKey: 'setup.section.devices.label',
    descKey: 'setup.section.devices.desc',
    icon: 'grid',
    phase: 1,
  },
  {
    id: 'agents',
    labelKey: 'setup.section.agents.label',
    descKey: 'setup.section.agents.desc',
    icon: 'sparkle',
    phase: 1,
  },
  {
    id: 'contracts',
    labelKey: 'setup.section.contracts.label',
    descKey: 'setup.section.contracts.desc',
    icon: 'shield',
    phase: 2,
  },
  {
    id: 'workforce',
    labelKey: 'setup.section.workforce.label',
    descKey: 'setup.section.workforce.desc',
    icon: 'people',
    phase: 3,
  },
  {
    id: 'coverage',
    labelKey: 'setup.section.coverage.label',
    descKey: 'setup.section.coverage.desc',
    icon: 'people',
    phase: 4,
  },
  {
    id: 'consumables',
    labelKey: 'setup.section.consumables.label',
    descKey: 'setup.section.consumables.desc',
    icon: 'cart',
    phase: 4,
  },
  {
    id: 'suppliers',
    labelKey: 'setup.section.suppliers.label',
    descKey: 'setup.section.suppliers.desc',
    icon: 'ship',
    phase: 4,
  },
  {
    id: 'knowledge',
    labelKey: 'setup.section.knowledge.label',
    descKey: 'setup.section.knowledge.desc',
    icon: 'panel',
    phase: 4,
  },
];

// Read a building's raw setup_progress jsonb. Returns {} when unset.
export async function fetchSetupProgress(locationId) {
  if (!locationId) return {};
  const { data, error } = await supabase.from('locations').select('setup_progress').eq('id', locationId).single();
  if (error) throw new Error(error.message);
  return data?.setup_progress || {};
}

// Merge a patch into a building's setup_progress via the RPC. Returns the
// new merged jsonb. `patch` is keyed by section id, e.g.
//   { contracts: { done: true, count: 2 } }
export async function setBuildingSetup(locationId, patch) {
  const { data, error } = await supabase.rpc('set_building_setup', {
    p_location_id: locationId,
    p_patch: patch,
  });
  if (error) throw new Error(error.message);
  return data || {};
}

// Convenience: flip a single section's `done` flag (merging any extra meta).
export function markSection(locationId, sectionId, done, meta = {}) {
  return setBuildingSetup(locationId, {
    [sectionId]: { ...meta, done, updated_at: new Date().toISOString() },
  });
}

// Which sections apply to a building. Hook for vertical-conditional
// readiness (PRD §9.5) — today every section applies; the predicate is
// here so later we can drop e.g. restroom consumables for a warehouse.
export function applicableSections(/* building */) {
  return SETUP_SECTIONS;
}

// Readiness = completed applicable sections / total. `progress` is the
// raw setup_progress jsonb.
export function computeReadiness(progress, building) {
  const sections = applicableSections(building);
  const total = sections.length;
  const done = sections.filter((s) => progress?.[s.id]?.done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// ── Phase 2: document extraction (contracts) ────────────────────────

const VALID_CONTRACT_KINDS = new Set([
  'cleaning',
  'maintenance',
  'hvac',
  'electrical',
  'plumbing',
  'security',
  'waste',
  'pest_control',
  'landscaping',
  'other',
]);

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s); // strip the data: prefix
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// Upload a document to /api/extract → returns { fields, model }. Merlin
// (server-side, key never exposed) parses the PDF into structured fields
// via a forced tool call. The caller reviews `fields` before saving.
export async function extractDocument(kind, file) {
  const fileBase64 = await fileToBase64(file);
  const headers = { 'content-type': 'application/json' };
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) headers.authorization = `Bearer ${session.access_token}`;
  } catch {
    /* proceed unauthenticated — only cost attribution suffers */
  }
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers,
    body: JSON.stringify({ kind, fileBase64, mediaType: file.type || 'application/pdf', fileName: file.name }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `extraction failed (${res.status})`);
  }
  return res.json();
}

// Persist a (human-reviewed) extracted contract → contracts + contract_locations.
// The full extraction is kept on `extraction` for traceability; promoted
// scalar/jsonb columns power querying + billing/monitoring later.
export async function saveExtractedContract(orgId, locationId, fields) {
  const annual = Number(fields.total_annual_value);
  const row = {
    manager_org_id: orgId,
    name: (fields.name || '').trim() || 'Untitled contract',
    service_kind: VALID_CONTRACT_KINDS.has(fields.service_kind) ? fields.service_kind : 'other',
    status: 'active',
    start_date: fields.start_date || null,
    end_date: fields.end_date || null,
    auto_renew: typeof fields.auto_renew === 'boolean' ? fields.auto_renew : null,
    notice_period_days: Number.isFinite(Number(fields.notice_period_days)) ? Number(fields.notice_period_days) : null,
    monthly_value: Number.isFinite(annual) && annual > 0 ? Math.round(annual / 12) : null,
    currency: fields.currency || null,
    rate_card: Array.isArray(fields.rate_card) && fields.rate_card.length ? fields.rate_card : null,
    penalties: Array.isArray(fields.penalties) && fields.penalties.length ? fields.penalties : null,
    terms: fields.summary || null,
    extraction: { ...fields, _extractedAt: new Date().toISOString() },
  };
  const { data, error } = await supabase.from('contracts').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  if (locationId) {
    const { error: linkErr } = await supabase
      .from('contract_locations')
      .insert({ contract_id: data.id, location_id: locationId });
    if (linkErr) throw new Error(linkErr.message);
  }
  return data.id;
}

// ── Phase 3: workforce Excel import ─────────────────────────────────

// Case-insensitive header → field aliases. The uploaded sheet's columns
// are matched loosely so operators don't have to use exact names.
const WORKFORCE_ALIASES = {
  name: ['name', 'worker', 'full name', 'employee'],
  firm: ['firm', 'contractor', 'company', 'employer'],
  trade: ['trade', 'service', 'discipline'],
  role: ['role', 'position', 'title'],
  email: ['email', 'e-mail'],
  phone: ['phone', 'mobile', 'tel'],
  start_date: ['start date', 'start', 'hired', 'joined'],
  employment_status: ['status', 'employment status'],
  sites: ['sites', 'site', 'buildings', 'locations'],
  cert_type: ['certification', 'cert', 'certification type', 'qualification', 'licence', 'license'],
  cert_issued: ['issued', 'issue date', 'cert issued'],
  cert_expiry: ['expiry', 'expires', 'expiry date', 'cert expiry'],
};

function pickField(row, keys) {
  const lc = {};
  for (const k of Object.keys(row)) lc[String(k).trim().toLowerCase()] = row[k];
  for (const alias of keys) {
    const v = lc[alias];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function initialsOf(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// Best-effort date coercion — only keep a value that parses to a real date.
function isoDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Map raw sheet rows (header→value objects) to the team_members shape.
// Skips rows with no name. One optional certification per row.
export function normalizeWorkforceRows(rawRows) {
  const out = [];
  for (const r of rawRows || []) {
    const name = pickField(r, WORKFORCE_ALIASES.name);
    if (!name) continue;
    const sitesRaw = pickField(r, WORKFORCE_ALIASES.sites);
    const certType = pickField(r, WORKFORCE_ALIASES.cert_type);
    out.push({
      name,
      firm: pickField(r, WORKFORCE_ALIASES.firm) || null,
      trade: pickField(r, WORKFORCE_ALIASES.trade) || null,
      role: pickField(r, WORKFORCE_ALIASES.role) || null,
      email: pickField(r, WORKFORCE_ALIASES.email) || null,
      phone: pickField(r, WORKFORCE_ALIASES.phone) || null,
      start_date: pickField(r, WORKFORCE_ALIASES.start_date) || null,
      employment_status: pickField(r, WORKFORCE_ALIASES.employment_status) || 'active',
      sites: sitesRaw
        ? sitesRaw
            .split(/[;,]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : null,
      certifications: certType
        ? [
            {
              doc_type: certType,
              issue_date: pickField(r, WORKFORCE_ALIASES.cert_issued) || null,
              expiry_date: pickField(r, WORKFORCE_ALIASES.cert_expiry) || null,
            },
          ]
        : null,
    });
  }
  return out;
}

// Bulk-insert normalized workforce rows into team_members. Returns the count.
export async function saveWorkforce(orgId, rows) {
  if (!rows?.length) return 0;
  const payload = rows.map((w) => ({
    organization_id: orgId,
    name: w.name,
    initials: initialsOf(w.name),
    team: w.trade || null,
    role: w.role || null,
    firm: w.firm || null,
    trade: w.trade || null,
    email: w.email || null,
    phone: w.phone || null,
    start_date: isoDateOrNull(w.start_date),
    employment_status: w.employment_status || 'active',
    active: (w.employment_status || 'active') === 'active',
    sites: w.sites || null,
    certifications: w.certifications
      ? w.certifications.map((c) => ({
          ...c,
          issue_date: isoDateOrNull(c.issue_date),
          expiry_date: isoDateOrNull(c.expiry_date),
        }))
      : null,
  }));
  const { error } = await supabase.from('team_members').insert(payload);
  if (error) throw new Error(error.message);
  return payload.length;
}
