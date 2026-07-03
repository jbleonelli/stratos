// Innovate marketplace — vendor catalog data layer.
//
// Reads marketplace_vendors from Supabase and projects rows into the
// shape the Innovate page renders (camelCase / nested objects). All
// callers go through useVendors() — no hardcoded VENDORS array.
//
// Writes (used by /platform Marketplace CMS) go through createVendor /
// updateVendor / deleteVendor. RLS in migration 072 enforces that
// only platform admins can write; the client-side calls just propagate
// the Postgres error if a non-admin tries.

import { useState, useEffect, useId } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';

// Module-level snapshot of the loaded vendor list. useVendors() keeps this
// warm so non-React callers (the chat backend's serializeBuilding, which is a
// plain function) can read the marketplace catalog synchronously and feed it
// into Merlin's context. Null until the first load resolves.
let vendorsSnapshot = null;

// Warm the snapshot once on module load so the chat backend has the catalog
// even if the user never opened the Innovate page this session. Best-effort:
// failures leave the snapshot null and vendorDirectory() returns []. Skipped
// if a useVendors() mount already populated it.
let snapshotPrimed = false;
function primeVendorSnapshot() {
  if (snapshotPrimed || Array.isArray(vendorsSnapshot)) return;
  snapshotPrimed = true;
  supabase
    .from('marketplace_vendors')
    .select('*')
    .order('category_id', { ascending: true })
    .order('display_order', { ascending: true })
    .then(({ data, error }) => {
      if (error) captureException(error, { where: 'primeVendorSnapshot' });
      if (!error && data && !Array.isArray(vendorsSnapshot)) {
        vendorsSnapshot = data.map(rowToVendor);
      }
    });
}
primeVendorSnapshot();

// Compact catalog for the chat system prompt — so Merlin can answer "what
// about 75F?" / "what would fit this building?" grounded in the real
// marketplace. One line per vendor: name, category, what it does, and (when
// present) how it plugs into Merlin. Returns [] before the first load.
export function vendorDirectory() {
  if (!Array.isArray(vendorsSnapshot)) return [];
  return vendorsSnapshot.map((v) => ({
    name: v.name,
    category: v.categoryId,
    type: v.deployType,
    summary: v.tagline || v.desc || '',
    integration: v.integration || null,
    verticals: Array.isArray(v.verticals) && v.verticals.length ? v.verticals : null,
  }));
}

// ────── Camel/snake projection
//
// DB columns → JS object keys. The Innovate page reads camelCase
// throughout, including nested arrays (key_features → keyFeatures,
// products → already a JSON array of {name, desc}).

function rowToVendor(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    deployType: row.deploy_type,
    region: row.region || 'global',
    status: row.status || 'available',
    tagline: row.tagline || '',
    desc: row.description || '',
    longDesc: row.long_description || null,
    keyFeatures: Array.isArray(row.key_features) ? row.key_features : [],
    products: Array.isArray(row.products) ? row.products : [],
    integration: row.integration || null,
    pricing: row.pricing || null,
    url: row.url || null,
    icon: row.icon || null,
    isFeatured: !!row.is_featured,
    featuredOrder: row.featured_order ?? null,
    featuredPitch: row.featured_pitch || null,
    displayOrder: row.display_order ?? 100,
    // Verticals (migration 105): array of building-variant tags this
    // vendor targets. Empty = generic, surfaces everywhere. Non-empty
    // = vendor is most relevant when active building.variant matches
    // (e.g. ['warehouse'] for a dock-leveler company).
    verticals: Array.isArray(row.verticals) ? row.verticals : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function vendorToRow(v) {
  return {
    id: v.id,
    name: v.name,
    category_id: v.categoryId,
    deploy_type: v.deployType,
    region: v.region || 'global',
    status: v.status || 'available',
    tagline: v.tagline || null,
    description: v.desc || null,
    long_description: v.longDesc || null,
    key_features: Array.isArray(v.keyFeatures) ? v.keyFeatures : [],
    products: Array.isArray(v.products) ? v.products : [],
    integration: v.integration || null,
    pricing: v.pricing || null,
    url: v.url || null,
    icon: v.icon || null,
    is_featured: !!v.isFeatured,
    featured_order: v.featuredOrder ?? null,
    featured_pitch: v.featuredPitch || null,
    display_order: v.displayOrder ?? 100,
    verticals: Array.isArray(v.verticals) ? v.verticals : [],
  };
}

// ────── Read hook
//
// Live, realtime-subscribed list of vendors. Sorted by category +
// display_order so the Innovate page renders deterministically.

export function useVendors() {
  const [vendors, setVendors] = useState(null);
  // Suffix the channel topic with a unique-per-hook-call id so two
  // simultaneous subscribers (e.g. ProposalVendorPicker + the
  // contractor-recommendations vendor matcher both rendering on
  // Lisa's Contracts page) don't collide on the same topic. Supabase
  // dedupes by topic in v2 — adding a `.on()` callback after the
  // shared channel has already `.subscribe()`d throws "cannot add
  // postgres_changes callbacks ... after subscribe()" and the global
  // ErrorBoundary fallback ("Something broke.") swallows the page.
  const instanceId = useId();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from('marketplace_vendors')
        .select('*')
        .order('category_id', { ascending: true })
        .order('display_order', { ascending: true });
      if (cancelled) return;
      if (error) {
        captureException(error, { where: 'useVendors' });
        console.error('[vendors] load failed', error);
        setVendors([]);
        return;
      }
      const list = (data || []).map(rowToVendor);
      vendorsSnapshot = list; // keep the module snapshot warm for vendorDirectory()
      setVendors(list);
    }

    load();

    // Live updates so CMS edits appear immediately for users with
    // the Innovate tab open (or for the platform admin themselves
    // after a save).
    const channel = supabase
      .channel(`marketplace_vendors_realtime_${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_vendors' }, () => load())
      .subscribe();

    return () => {
      cancelled = true;
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [instanceId]);

  return vendors; // null while loading; [] if empty
}

// ────── Write APIs (platform-admin only — RLS enforces)

export async function createVendor(vendor) {
  const { data, error } = await supabase.from('marketplace_vendors').insert(vendorToRow(vendor)).select().single();
  if (error) throw error;
  return rowToVendor(data);
}

export async function updateVendor(id, patch) {
  const row = vendorToRow({ ...patch, id });
  // id is the primary key — never write it back via update
  delete row.id;
  const { data, error } = await supabase.from('marketplace_vendors').update(row).eq('id', id).select().single();
  if (error) throw error;
  return rowToVendor(data);
}

export async function deleteVendor(id) {
  const { error } = await supabase.from('marketplace_vendors').delete().eq('id', id);
  if (error) throw error;
  return true;
}
