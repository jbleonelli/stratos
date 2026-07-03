// Data layer for the new source_catalog + source_connection tables
// introduced in migration 145. Two read hooks (with realtime subscription)
// plus thin write wrappers around supabase.from(...).insert/update/delete.
//
// The legacy merlin_config.data_sources jsonb stays in place untouched
// for v1 — the per-agent picker (resolveDataSource in agentic-data.js)
// continues reading from there. A follow-up PR will migrate the agent
// linking ledger to use source_catalog.id values, after which the
// merlin_config jsonb can be deprecated.

import { useEffect, useId, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';

// ────── useSourceCatalog ────────────────────────────────────────────
//
// Per-building scoping (PR 3, migration 146):
//   buildingId === null     → org-wide only (location_id IS NULL).
//                             Returned rows are visible to every building.
//   buildingId === 'all'    → return every row regardless of scope.
//                             Used by admin surfaces that need to see
//                             the full catalog across all buildings.
//   buildingId === <id>     → merged view: org-wide rows
//                             (location_id IS NULL) AND rows scoped to
//                             this specific building (location_id = id).
//                             This is the default Agentic → Sources
//                             behavior since the user is always viewing
//                             a specific building in that surface.
//
// includePending=true returns contractor-proposed entries whose
// counterparty hasn't accepted yet — used by the Catalog tab so admins
// can see what's pending acceptance. Default false to keep downstream
// consumers (agents, billing) from accidentally counting them.

export function useSourceCatalog(orgId, { buildingId = null, includePending = false } = {}) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    let channel = null;

    async function refresh() {
      let q = supabase
        .from('source_catalog')
        .select('*')
        .eq('organization_id', orgId)
        .eq('active', true)
        .order('display_order', { ascending: true });
      if (!includePending) q = q.not('accepted_at', 'is', null);
      if (buildingId === null) {
        q = q.is('location_id', null);
      } else if (buildingId !== 'all') {
        // Merged: org-wide OR this-building-only.
        q = q.or(`location_id.is.null,location_id.eq.${buildingId}`);
      }
      const { data, error } = await q;
      if (cancelled) return;
      setRows(error || !data ? [] : data);
      setLoaded(true);
    }

    refresh();

    channel = supabase
      .channel(
        `source_catalog_${orgId}_${buildingId || 'orgwide'}_${includePending ? 'all' : 'accepted'}_${instanceId}`,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'source_catalog', filter: `organization_id=eq.${orgId}` },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orgId, buildingId, includePending, instanceId]);

  return { rows, loaded };
}

// ────── useSourceConnections ────────────────────────────────────────
//
// Optional building filter. When building is provided, only return
// connections whose location_id matches the building or one of its
// descendants (dash-bounded prefix match — same pattern as
// devicesForBuilding in devices-store.js).

export function useSourceConnections(orgId, { building = null } = {}) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const instanceId = useId();

  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    let channel = null;

    async function refresh() {
      const { data, error: err } = await supabase
        .from('source_connection')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (err) {
        captureException(err, { where: 'useSourceConnections' });
        setError(err);
      } else setError(null);
      let out = err || !data ? [] : data;
      if (building?.id) {
        out = out.filter((r) => r.location_id === building.id || (r.location_id || '').startsWith(building.id + '-'));
      }
      setRows(out);
      setLoaded(true);
    }

    refresh();

    channel = supabase
      .channel(`source_connection_${orgId}_${building?.id || 'org'}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'source_connection', filter: `organization_id=eq.${orgId}` },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orgId, building?.id, instanceId]);

  return { rows, loaded, error };
}

// ────── Write helpers ───────────────────────────────────────────────
// Thin wrappers over supabase.from(...) so callers don't have to remember
// the table names + can swap implementation later (e.g. for the
// cross-org RPC paths in PR 5).

export async function createCatalogEntry({ orgId, draft, buildingId = null }) {
  // id: bare slug from name (UI lower-cases). Caller is responsible
  // for ensuring uniqueness within their org — server returns a clean
  // error on collision via the PK. Per-building entries get a -bldg
  // suffix so the same name can coexist as both org-wide + per-building.
  const slug = (draft.name || 'entry').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const id = draft.id || `${orgId}-${slug}${buildingId ? `-${buildingId}` : ''}-${Date.now().toString(36)}`;
  const row = {
    ...draft,
    id,
    organization_id: orgId,
    authored_by_org: orgId,
    location_id: buildingId || null,
    provider_kind: draft.provider_kind || 'adaptiv',
    status: 'available',
    active: true,
    display_order: draft.display_order ?? 100,
  };
  const { data, error } = await supabase.from('source_catalog').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCatalogEntry(id, patch) {
  // Strip create-only fields the trigger / RLS would reject anyway.
  const clean = { ...patch };
  delete clean.id;
  delete clean.organization_id;
  delete clean.authored_by_org;
  delete clean.counterparty_org;
  delete clean.contract_id;
  delete clean.accepted_at;
  delete clean.created_by;
  const { error } = await supabase.from('source_catalog').update(clean).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCatalogEntry(id) {
  const { error } = await supabase.from('source_catalog').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function createConnection({ orgId, draft }) {
  // Connection kind drives a few sensible defaults the form would
  // otherwise have to set:
  //   simulated: starts healthy + last_heartbeat_at=now() so the row
  //     goes green immediately instead of waiting a tick for the
  //     simulator cron + sweep to converge. Also writes
  //     metadata.simulator so the tick RPC will keep heartbeats fresh.
  //   external: starts pending + auto-generated webhook token under
  //     metadata.webhook.token. The customer POSTs to
  //     /api/sources/ingest/<token> to advance heartbeat.
  //   adaptiv: status defaults to 'pending' — flips green when the
  //     device trigger fires.
  const isSimulated = !!draft.simulator?.enabled;
  const isExternal = draft.kind === 'external';
  const baseMetadata = draft.metadata || {};
  let metadata = baseMetadata;
  if (isSimulated) {
    metadata = {
      ...metadata,
      simulator: {
        enabled: true,
        interval_min: Math.max(1, Math.min(60, Number(draft.simulator?.interval_min) || 5)),
        payload_profile: draft.simulator?.payload_profile || null,
      },
    };
  }
  if (isExternal) {
    metadata = {
      ...metadata,
      webhook: {
        // crypto.randomUUID is available in every browser we support
        // (and in Node 19+ for the server-side test path, though we
        // never call createConnection from the server).
        token:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      },
    };
  }
  const row = {
    organization_id: orgId,
    catalog_id: draft.catalog_id,
    location_id: draft.location_id,
    external_id: draft.external_id ?? null,
    name: draft.name ?? null,
    device_id: draft.device_id ?? null,
    status: isSimulated ? 'healthy' : draft.status || 'pending',
    last_heartbeat_at: isSimulated ? new Date().toISOString() : null,
    metadata,
  };
  const { data, error } = await supabase.from('source_connection').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// The token for an external connection — caller is responsible for
// composing the full URL with the right origin.
export function webhookTokenForConnection(row) {
  return row?.metadata?.webhook?.token || null;
}

// True when the connection has metadata.simulator.enabled. Helper used
// by ConnectionRow to render the "Simulating · every Xmin" pill.
export function isSimulatedConnection(row) {
  return !!row?.metadata?.simulator?.enabled;
}

export async function updateConnection(id, patch) {
  const clean = { ...patch };
  delete clean.id;
  delete clean.organization_id;
  delete clean.device_id;
  delete clean.created_at;
  const { error } = await supabase.from('source_connection').update(clean).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteConnection(id) {
  const { error } = await supabase.from('source_connection').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ────── Contractor side (PR 5, migration 148) ───────────────────────

// Customer accepts a contractor-proposed catalog entry. Mirrors
// acceptSla — the accepter side stamps accepted_at via a SECURITY
// DEFINER RPC because the RLS UPDATE policy doesn't let the customer
// touch the contractor's pending row directly.
export async function acceptSourceCatalog(catalogId) {
  const { error } = await supabase.rpc('accept_source_catalog', { p_id: catalogId });
  if (error) throw new Error(error.message);
}

// Catalog rows where this contractor org is a party. Mirrors
// useAuthoredAgreements in slas-data.js — used by the contractor's
// Operations → Sources roll-up. RLS already gates the read via
// counterparty_org; this hook just filters + joins the customer org
// name for headering.
export function useContractorAuthoredCatalog(orgId) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    let channel = null;

    async function refresh() {
      const { data, error } = await supabase
        .from('source_catalog')
        .select(
          `
          *,
          customer:organizations!source_catalog_organization_id_fkey(id, name, kind, slug),
          location:locations(id, name)
        `,
        )
        .eq('counterparty_org', orgId)
        .eq('active', true)
        .order('display_order', { ascending: true });
      if (cancelled) return;
      setRows(error || !data ? [] : data);
      setLoaded(true);
    }

    refresh();

    channel = supabase
      .channel(`source_catalog_authored_${orgId}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'source_catalog', filter: `counterparty_org=eq.${orgId}` },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orgId, instanceId]);

  return { rows, loaded };
}

// Compute who the caller is relative to a catalog row. Same shape as
// actorRoleForAgreement in slas-data.js.
//   'author'    — caller's org is authored_by_org (and not the accepter)
//   'accepter'  — caller's org is the OTHER party
//   'both'      — author = accepter (internal source, same-org)
//   'observer'  — neither (defensive)
export function actorRoleForCatalog(row, callerOrgId) {
  if (!row || !callerOrgId) return 'observer';
  const author = row.authored_by_org;
  const accepter = author === row.organization_id ? row.counterparty_org : row.organization_id;
  const isAuthor = callerOrgId === author;
  const isAccepter = callerOrgId === accepter;
  if (isAuthor && isAccepter) return 'both';
  if (isAuthor) return 'author';
  if (isAccepter) return 'accepter';
  return 'observer';
}

// ────── Display constants ───────────────────────────────────────────

export const PROVIDER_KINDS = [
  { id: 'adaptiv', labelKey: 'sources.provider.adaptiv', tone: 'accent' },
  { id: 'third_party', labelKey: 'sources.provider.third_party', tone: 'info' },
  { id: 'contractor', labelKey: 'sources.provider.contractor', tone: 'warn' },
];

export const CATALOG_STATUSES = [
  { id: 'draft', labelKey: 'sources.status.catalog.draft', tone: 'off' },
  { id: 'available', labelKey: 'sources.status.catalog.available', tone: 'ok' },
  { id: 'deprecated', labelKey: 'sources.status.catalog.deprecated', tone: 'warn' },
  { id: 'removed', labelKey: 'sources.status.catalog.removed', tone: 'off' },
];

export const CONNECTION_STATUSES = [
  { id: 'pending', labelKey: 'sources.status.conn.pending', tone: 'off' },
  { id: 'healthy', labelKey: 'sources.status.conn.healthy', tone: 'ok' },
  { id: 'degraded', labelKey: 'sources.status.conn.degraded', tone: 'warn' },
  { id: 'offline', labelKey: 'sources.status.conn.offline', tone: 'risk' },
  { id: 'retired', labelKey: 'sources.status.conn.retired', tone: 'off' },
];

// Client-side mirror of the api/devices/profiles registry. The
// simulator branch of the "+ Connect a source" form lets an admin pick
// which Adaptiv device class the synthetic source should impersonate.
// IDs match api/devices/profiles/index.ts exactly so a future server
// extension can read this metadata.simulator.payload_profile and
// route to the matching profile's emitter without translation.
export const SIMULATOR_PAYLOAD_PROFILES = [
  { id: 'smart_display_classic', label: 'Smart Display Classic' },
  { id: 'people_counter_basic', label: 'People Counter Basic' },
  { id: 'smart_logger_basic', label: 'Smart Logger Basic' },
  { id: 'smart_logger_bank', label: 'Smart Logger (Bank)' },
];

// Map signal_kind to an icon name from icons.jsx. Defensive fallback to
// 'gateway' since signal_kind is free-text in the schema.
export const SIGNAL_KIND_ICON = {
  sensor: 'gauge',
  device: 'grid',
  device_class: 'grid',
  api: 'bolt',
  webhook: 'bolt',
  internal: 'shield',
  ticketing: 'panel',
  derived: 'sparkle',
  metric: 'panel',
  event: 'bolt',
};
