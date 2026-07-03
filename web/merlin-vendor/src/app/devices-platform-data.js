// Platform-side device data layer (phase 1a/1b).
//
// Reads device_skus / device_profiles / device_profile_items / inventory_devices
// for the back-office Catalog, Inventory, and Fleet pages. All four tables
// are RLS-gated to platform admins; mounting these hooks inside /platform
// is the only authorization plumbing needed.
//
// One-shot fetch on mount, no realtime subscriptions — back-office writers
// are a small pool and pages are explicitly refreshed after edits.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { fetchAllPaginated } from './pagination.js';

// ────── Catalog (SKUs + Profiles)

export function useDeviceCatalog() {
  const [skus, setSkus] = useState([]);
  const [profiles, setProfiles] = useState([]); // each carries .items: [{sku_id, qty, sku_name}]
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [skusRes, profilesRes, itemsRes] = await Promise.all([
          supabase.from('device_skus').select('*').order('family').order('name'),
          supabase.from('device_profiles').select('*').order('recommended', { ascending: false }).order('name'),
          supabase.from('device_profile_items').select('*'),
        ]);
        if (skusRes.error) throw skusRes.error;
        if (profilesRes.error) throw profilesRes.error;
        if (itemsRes.error) throw itemsRes.error;
        const skuById = new Map((skusRes.data || []).map((s) => [s.id, s]));
        const itemsByProfile = new Map();
        for (const it of itemsRes.data || []) {
          if (!itemsByProfile.has(it.profile_id)) itemsByProfile.set(it.profile_id, []);
          const sku = skuById.get(it.sku_id);
          itemsByProfile.get(it.profile_id).push({
            sku_id: it.sku_id,
            qty: it.qty,
            sku_name: sku?.name || it.sku_id,
            sku_family: sku?.family,
            sku_kind: sku?.kind,
          });
        }
        const profilesEnriched = (profilesRes.data || []).map((p) => ({
          ...p,
          items: itemsByProfile.get(p.id) || [],
        }));
        if (!alive) return;
        setSkus(skusRes.data || []);
        setProfiles(profilesEnriched);
        setReady(true);
        setError(null);
      } catch (err) {
        if (!alive) return;
        captureException(err, { where: 'useDeviceCatalog' });
        // eslint-disable-next-line no-console
        console.warn('[devices-platform-data] catalog fetch failed:', err.message);
        setError(err.message);
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  const refresh = () => setTick((n) => n + 1);
  return { skus, profiles, ready, error, refresh };
}

// ────── Mutations (platform-admin gated by RLS in migration 075)

const SKU_FIELDS = [
  'id',
  'name',
  'family',
  'kind',
  'description',
  'default_firmware',
  'manufacturer',
  'list_price_cents',
  'msrp_cents',
  'currency',
  'hero_image_url',
  'short_description',
  'long_description',
  'active',
];

export async function saveSku(sku, { isNew }) {
  // Coerce numeric strings + drop fields not in the column list.
  const row = {};
  for (const k of SKU_FIELDS) {
    let v = sku[k];
    if (v === '' || v === undefined) v = null;
    if (k === 'list_price_cents' || k === 'msrp_cents') v = v == null ? null : Number(v);
    row[k] = v;
  }
  // Defaults that the DB also enforces but client should send explicitly.
  if (row.currency == null) row.currency = 'USD';
  if (row.active == null) row.active = true;

  if (isNew) {
    const { error } = await supabase.from('device_skus').insert(row);
    if (error) throw error;
  } else {
    const { id, ...rest } = row;
    const { error } = await supabase.from('device_skus').update(rest).eq('id', id);
    if (error) throw error;
  }
}

export async function setSkuActive(id, active) {
  const { error } = await supabase.from('device_skus').update({ active }).eq('id', id);
  if (error) throw error;
}

const PROFILE_FIELDS = [
  'id',
  'name',
  'use_case',
  'description',
  'list_price_cents',
  'currency',
  'hero_image_url',
  'recommended',
  'active',
  'estimated_install_minutes',
];

export async function saveProfile(profile, items, { isNew }) {
  const row = {};
  for (const k of PROFILE_FIELDS) {
    let v = profile[k];
    if (v === '' || v === undefined) v = null;
    if (k === 'list_price_cents' || k === 'estimated_install_minutes') v = v == null ? null : Number(v);
    row[k] = v;
  }
  if (row.currency == null) row.currency = 'USD';
  if (row.active == null) row.active = true;
  if (row.recommended == null) row.recommended = false;

  if (isNew) {
    const { error } = await supabase.from('device_profiles').insert(row);
    if (error) throw error;
  } else {
    const { id, ...rest } = row;
    const { error } = await supabase.from('device_profiles').update(rest).eq('id', id);
    if (error) throw error;
  }

  // Replace the BOM: delete existing rows for this profile, insert the new set.
  // Two queries — risk of partial state on failure is minimal in single-writer
  // back-office context. If this becomes an issue, wrap in a SECURITY DEFINER
  // function with set-based replace.
  await supabase.from('device_profile_items').delete().eq('profile_id', row.id);
  if (items && items.length > 0) {
    const rows = items
      .filter((it) => it.sku_id && Number(it.qty) > 0)
      .map((it) => ({ profile_id: row.id, sku_id: it.sku_id, qty: Number(it.qty) }));
    if (rows.length > 0) {
      const { error } = await supabase.from('device_profile_items').insert(rows);
      if (error) throw error;
    }
  }
}

export async function setProfileActive(id, active) {
  const { error } = await supabase.from('device_profiles').update({ active }).eq('id', id);
  if (error) throw error;
}

// ────── Inventory rollup (count of inventory_devices by SKU × state)

const ALL_STATES = [
  'manufactured',
  'received',
  'qc_passed',
  'firmware_updated',
  'configured',
  'shipped',
  'delivered',
  'installed',
  'service',
  'rma_inbound',
  'rma_received',
  'refurb',
  'decommissioned',
];

export function useInventoryRollup() {
  const [rows, setRows] = useState([]); // [{ sku_id, state, count }]
  const [skus, setSkus] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rollupRes, skusRes] = await Promise.all([
          supabase.from('inventory_state_rollup').select('*'),
          supabase.from('device_skus').select('id, name, family, kind').order('family').order('name'),
        ]);
        if (rollupRes.error) throw rollupRes.error;
        if (skusRes.error) throw skusRes.error;
        if (!alive) return;
        setRows(rollupRes.data || []);
        setSkus(skusRes.data || []);
        setReady(true);
        setError(null);
      } catch (err) {
        if (!alive) return;
        captureException(err, { where: 'useInventoryRollup' });
        // eslint-disable-next-line no-console
        console.warn('[devices-platform-data] inventory fetch failed:', err.message);
        setError(err.message);
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Materialise a (sku × state) matrix the UI can render directly.
  const matrix = skus.map((sku) => {
    const byState = Object.fromEntries(ALL_STATES.map((s) => [s, 0]));
    let total = 0;
    for (const r of rows) {
      if (r.sku_id !== sku.id) continue;
      const n = Number(r.count) || 0;
      byState[r.state] = (byState[r.state] || 0) + n;
      total += n;
    }
    return { ...sku, byState, total };
  });

  // Column totals.
  const columnTotals = Object.fromEntries(ALL_STATES.map((s) => [s, 0]));
  for (const r of rows) {
    columnTotals[r.state] = (columnTotals[r.state] || 0) + (Number(r.count) || 0);
  }
  const grandTotal = Object.values(columnTotals).reduce((a, b) => a + b, 0);

  return { matrix, columnTotals, grandTotal, states: ALL_STATES, ready, error };
}

// ────── Fleet (paginated table of every inventory_device)

export function useFleet({ state = null, skuId = null, search = '', orgId = null } = {}) {
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Resolve org names + SKU names in one shot for display.
        const [skusRes, orgsRes] = await Promise.all([
          supabase.from('device_skus').select('id, name, family, kind'),
          supabase.from('organizations').select('id, name'),
        ]);
        if (skusRes.error) throw skusRes.error;
        if (orgsRes.error) throw orgsRes.error;
        const skuById = new Map((skusRes.data || []).map((s) => [s.id, s]));
        const orgById = new Map((orgsRes.data || []).map((o) => [o.id, o]));

        const data = await fetchAllPaginated((from, to) => {
          let q = supabase
            .from('inventory_devices')
            .select(
              'id, serial, mac, sku_id, state, assigned_org_id, device_id, manufacturer, manufactured_at, received_at, qc_passed_at, firmware_updated_at, configured_at, shipped_at, delivered_at, installed_at, decommissioned_at, created_at, updated_at',
            )
            .order('created_at', { ascending: false })
            .range(from, to);
          if (state) q = q.eq('state', state);
          if (skuId) q = q.eq('sku_id', skuId);
          if (orgId) q = q.eq('assigned_org_id', orgId);
          if (search && search.trim()) q = q.ilike('serial', `%${search.trim()}%`);
          return q;
        });

        if (!alive) return;
        const enriched = data.map((r) => ({
          ...r,
          sku_name: skuById.get(r.sku_id)?.name || r.sku_id,
          sku_family: skuById.get(r.sku_id)?.family,
          org_name: r.assigned_org_id
            ? orgById.get(r.assigned_org_id)?.name || r.assigned_org_id.slice(0, 8) + '…'
            : null,
        }));
        setRows(enriched);
        setReady(true);
        setError(null);
      } catch (err) {
        if (!alive) return;
        captureException(err, { where: 'useFleet' });
        // eslint-disable-next-line no-console
        console.warn('[devices-platform-data] fleet fetch failed:', err.message);
        setError(err.message);
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [state, skuId, search, orgId]);

  return { rows, ready, error };
}
