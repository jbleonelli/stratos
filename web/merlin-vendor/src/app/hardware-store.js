// Hardware-store data hooks.
//
// Backs the ContractorApp "Hardware" tab — three things:
//
//   1. Catalog. SKUs + Profiles (kits) + per-profile bill of materials.
//      Loaded once, shared across the tab. Migration 074 already
//      enables read for any authenticated user when `active=true`.
//
//   2. Orders. Every device_orders row for the caller's org, joined
//      with its line items. Drives the Orders sub-tab + order history
//      strip.
//
//   3. Delivered inventory. inventory_devices rows assigned to the
//      caller's org at state='delivered' — what the customer just
//      received and hasn't installed yet.
//
// All three honor RLS: the catalog policies are open to authenticated
// readers on active rows, orders are scoped to current_user_org, and
// the inventory_devices_select_own_org policy added in migration 093
// lets the customer read their own assigned devices.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { getSession } from './auth.js';

// ────── Catalog
export function useDeviceCatalog() {
  const [state, setState] = useState({ skus: [], profiles: [], profile_items: [], loaded: false, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [skusRes, profilesRes, itemsRes] = await Promise.all([
        supabase
          .from('device_skus')
          .select(
            'id, name, family, kind, description, short_description, list_price_cents, currency, hero_image_url, active',
          )
          .eq('active', true)
          .order('family')
          .order('name'),
        supabase
          .from('device_profiles')
          .select(
            'id, name, use_case, description, list_price_cents, currency, recommended, estimated_install_minutes, active',
          )
          .eq('active', true)
          .order('recommended', { ascending: false })
          .order('name'),
        supabase.from('device_profile_items').select('profile_id, sku_id, qty'),
      ]);
      if (cancelled) return;
      if (skusRes.error || profilesRes.error || itemsRes.error) {
        setState({
          skus: [],
          profiles: [],
          profile_items: [],
          loaded: true,
          error: skusRes.error?.message || profilesRes.error?.message || itemsRes.error?.message,
        });
        return;
      }
      setState({
        skus: skusRes.data || [],
        profiles: profilesRes.data || [],
        profile_items: itemsRes.data || [],
        loaded: true,
        error: null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// ────── Orders
export function useDeviceOrders(refreshTick = 0) {
  const [state, setState] = useState({ orders: [], itemsByOrder: {}, loaded: false, error: null });
  const orgId = getSession()?.organizationId;

  useEffect(() => {
    if (!orgId) {
      setState({ orders: [], itemsByOrder: {}, loaded: true, error: null });
      return;
    }
    let cancelled = false;
    (async () => {
      const [oRes, iRes] = await Promise.all([
        supabase
          .from('device_orders')
          .select(
            'id, status, ship_to_name, ship_to_address, ship_to_city, ship_to_region, ship_to_postal_code, ship_to_country, notes, subtotal_cents, tax_cents, shipping_cents, total_cents, currency, placed_at, shipped_at, delivered_at, cancelled_at, created_at, tracking_number, carrier, paid_at, stripe_session_id, last_payment_error, cancellation_reason, refunded_at, refunded_amount_cents, refund_reason',
          )
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false }),
        supabase
          .from('device_order_items')
          .select('id, order_id, sku_id, profile_id, qty, unit_price_cents, line_total_cents'),
      ]);
      if (cancelled) return;
      if (oRes.error) {
        setState({ orders: [], itemsByOrder: {}, loaded: true, error: oRes.error.message });
        return;
      }
      const itemsByOrder = {};
      for (const it of iRes.data || []) {
        if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
        itemsByOrder[it.order_id].push(it);
      }
      setState({ orders: oRes.data || [], itemsByOrder, loaded: true, error: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, refreshTick]);

  return state;
}

// ────── Delivered inventory (assigned to caller's org, state='delivered')
export function useOrgInventory(refreshTick = 0) {
  const [state, setState] = useState({ devices: [], loaded: false, error: null });
  const orgId = getSession()?.organizationId;

  useEffect(() => {
    if (!orgId) {
      setState({ devices: [], loaded: true, error: null });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('inventory_devices')
        .select('id, serial, sku_id, state, assigned_profile_id, delivered_at, installed_at, manufactured_at, metadata')
        .eq('assigned_org_id', orgId)
        .in('state', ['delivered', 'installed', 'service'])
        .order('delivered_at', { ascending: false, nullsFirst: false })
        .limit(500);
      if (cancelled) return;
      if (error) {
        setState({ devices: [], loaded: true, error: error.message });
        return;
      }
      setState({ devices: data || [], loaded: true, error: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, refreshTick]);

  return state;
}

// ────── Place order
// `lines` is an array of either { sku, qty } or { profile, qty } where
// the embedded object is the catalog row (so we capture price-at-time).
export async function placeOrder({ lines, shipTo, notes }) {
  const session = getSession();
  if (!session?.organizationId) throw new Error('no active org');
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('cart is empty');

  // Compute the price snapshot.
  let subtotalCents = 0;
  const rows = [];
  for (const line of lines) {
    if (line.sku) {
      const unit = line.sku.list_price_cents || 0;
      const lineTotal = unit * line.qty;
      subtotalCents += lineTotal;
      rows.push({
        sku_id: line.sku.id,
        profile_id: null,
        qty: line.qty,
        unit_price_cents: unit,
        line_total_cents: lineTotal,
      });
    } else if (line.profile) {
      const unit = line.profile.list_price_cents || 0;
      const lineTotal = unit * line.qty;
      subtotalCents += lineTotal;
      rows.push({
        sku_id: null,
        profile_id: line.profile.id,
        qty: line.qty,
        unit_price_cents: unit,
        line_total_cents: lineTotal,
      });
    }
  }

  // 1. Create the order row in 'placed' state.
  const { data: order, error: orderErr } = await supabase
    .from('device_orders')
    .insert({
      organization_id: session.organizationId,
      placed_by: session.userId,
      status: 'placed',
      placed_at: new Date().toISOString(),
      ship_to_name: shipTo?.name || null,
      ship_to_address: shipTo?.address || null,
      ship_to_city: shipTo?.city || null,
      ship_to_region: shipTo?.region || null,
      ship_to_postal_code: shipTo?.postal_code || null,
      ship_to_country: shipTo?.country || 'US',
      notes: notes || null,
      subtotal_cents: subtotalCents,
      tax_cents: 0,
      shipping_cents: 0,
      total_cents: subtotalCents,
      currency: 'USD',
    })
    .select('id')
    .single();
  if (orderErr || !order) throw new Error(orderErr?.message || 'order insert failed');

  // 2. Insert the line items.
  const itemsToInsert = rows.map((r) => ({ ...r, order_id: order.id }));
  const { error: itemsErr } = await supabase.from('device_order_items').insert(itemsToInsert);
  if (itemsErr) {
    // Roll back the order so we don't leave an orphan with no items.
    await supabase.from('device_orders').delete().eq('id', order.id);
    throw new Error(itemsErr.message);
  }

  return order.id;
}

// ────── Stripe Checkout handoff
// Asks the server to mint a Stripe Checkout Session for an existing
// (status='placed') order, then returns either:
//   { mode: 'stripe', url }  — caller should window.location = url
//   { mode: 'demo' }         — server has no STRIPE_SECRET_KEY; caller
//                              should fall back to simulateFulfill()
//                              (works for platform-admin demo runs).
//
// Auth piggybacks the Supabase access token. Any RLS or business-rule
// failure throws with the server's JSON `error` field.
export async function createCheckoutSession(orderId) {
  if (!orderId) throw new Error('order id required');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('not authenticated');
  const apiBase =
    typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)
      ? 'https://merlin.adaptiv.systems'
      : '';
  const res = await fetch(`${apiBase}/api/checkout/create-session`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ────── Simulate fulfillment (platform-admin demo path)
// Wraps the demo_fulfill_order RPC. Returns the affected order id.
// Migration 097 restricted this to platform admins; the customer-side
// path now goes through Stripe Checkout instead.
export async function simulateFulfill(orderId) {
  if (!orderId) throw new Error('order id required');
  const { error } = await supabase.rpc('demo_fulfill_order', { p_order_id: orderId });
  if (error) throw new Error(error.message);
  return orderId;
}

// ────── Installable locations
// Pulls every location the caller can read (RLS handles own-org +
// contracted-subtree access) and narrows to leaf-ish kinds — the
// ones where it makes sense to physically install a device. Buildings
// and ecosystems are excluded because install_inventory_device
// rejects them anyway. Grouped by the building-id prefix so the
// picker UI can render the "Meridian HQ → Floor 32 → Restroom"
// structure.
export function useInstallableLocations() {
  const [state, setState] = useState({ locations: [], byBuilding: {}, loaded: false, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Scope platform admins to the active org (is_platform_admin RLS bypass
      // would otherwise list every tenant's rooms in the install picker).
      // Non-admins are already correctly scoped by RLS.
      const orgId = getSession()?.organizationId || null;
      // rls-perf-ok: customers rely on RLS scoping; locations_read is hoisted +
      // indexed (mig 265), so the whole-org scan stays well under the 8s timeout.
      let q = supabase
        .from('locations')
        .select('id, name, kind, parent_id, organization_id')
        .not('kind', 'in', '(building,ecosystem)')
        .order('id')
        .limit(2000);
      if (getSession()?.isPlatformAdmin && orgId) q = q.eq('organization_id', orgId);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        setState({ locations: [], byBuilding: {}, loaded: true, error: error.message });
        return;
      }
      const byBuilding = {};
      for (const loc of data || []) {
        const rootId = (loc.id || '').split('-')[0] || 'other';
        if (!byBuilding[rootId]) byBuilding[rootId] = [];
        byBuilding[rootId].push(loc);
      }
      setState({ locations: data || [], byBuilding, loaded: true, error: null });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// ────── Install
// Wraps install_inventory_device RPC. Returns the new device id.
export async function installInventoryDevice({ inventoryId, locationId, name }) {
  if (!inventoryId) throw new Error('inventory id required');
  if (!locationId) throw new Error('location id required');
  const { data, error } = await supabase.rpc('install_inventory_device', {
    p_inventory_id: inventoryId,
    p_location_id: locationId,
    p_device_name: name || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

// ────── Helpers
export function formatCents(cents, currency = 'USD') {
  if (cents == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      cents / 100,
    );
  } catch {
    return `$${(cents / 100).toFixed(0)}`;
  }
}
