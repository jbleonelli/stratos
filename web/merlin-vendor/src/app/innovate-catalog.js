// Innovate marketplace — taxonomy + helpers.
//
// As of migration 072, vendor records live in the marketplace_vendors
// Supabase table and are read via vendors-data.js → useVendors().
// This file holds only the static configuration that wraps them:
//
//   - Adaptiv first-party hardware projection (still hardcoded — sourced
//     from devices-data.js so SKU/uplink/power stay single-source-of-truth)
//   - Region taxonomy (REGIONS / REGION_META)
//   - UI mapping tables (STATUS_TONE / STATUS_LABEL_KEY / DEPLOY_TYPE_LABEL_KEY)
//   - Filter helpers (vendorsByCategory / vendorsByRegion / filterVendors)
//   - Featured resolver — picks featured vendors out of the live DB list
//     and mixes them with a hand-curated Adaptiv featured slot
//
// Status taxonomy:
//   - 'available'   — listed and integration-ready (default assumption)
//   - 'beta'        — listed but integration is in pilot / early access
//   - 'coming-soon' — placeholder card, not yet onboarded
//
// Deploy type taxonomy:
//   - 'sensor'   — physical sensing hardware
//   - 'hardware' — non-sensor physical kit (cameras, controllers, …)
//   - 'service'  — managed/professional service
//   - 'software' — pure software / SaaS
//
// Optional vendor detail fields (rendered by VendorDetailDrawer when
// present; drawer gracefully degrades when missing):
//   - longDesc:    2-3 sentence overview (falls back to `desc`)
//   - keyFeatures: array of short bullet strings
//   - products:    [{ name, desc }] — solutions in the vendor's catalog
//   - integration: 1-2 sentence note on how it plugs into Merlin
//   - pricing:     short tag ("SaaS", "Per-sensor", "Custom")

// ────── UI mapping tables

export const STATUS_TONE = {
  available: 'ok',
  beta: 'warn',
  'coming-soon': 'off',
};

export const STATUS_LABEL_KEY = {
  available: 'innovate.status.available',
  beta: 'innovate.status.beta',
  'coming-soon': 'innovate.status.coming_soon',
};

export const DEPLOY_TYPE_LABEL_KEY = {
  sensor: 'innovate.deploy.sensor',
  hardware: 'innovate.deploy.hardware',
  service: 'innovate.deploy.service',
  software: 'innovate.deploy.software',
};

// ────── Region taxonomy
//
// 'global' = worldwide product (default). 'fr' / 'eu' / 'us' / 'uk' /
// 'apac' = regionally focused. Add a new region here when you onboard
// a vendor that targets a specific market.

export const REGIONS = [
  { id: 'global', flag: '🌍', labelKey: 'innovate.region.global' },
  { id: 'us', flag: '🇺🇸', labelKey: 'innovate.region.us' },
  { id: 'eu', flag: '🇪🇺', labelKey: 'innovate.region.eu' },
  { id: 'fr', flag: '🇫🇷', labelKey: 'innovate.region.fr' },
  { id: 'uk', flag: '🇬🇧', labelKey: 'innovate.region.uk' },
  { id: 'apac', flag: '🌏', labelKey: 'innovate.region.apac' },
];

export const REGION_META = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

// ────── Filter helpers (operate on the live vendor list from useVendors)

export function vendorsByCategory(catalogue, categoryId) {
  if (!categoryId || categoryId === 'all') return catalogue;
  return catalogue.filter((v) => v.categoryId === categoryId);
}

export function vendorsByRegion(catalogue, regionId) {
  if (!regionId || regionId === 'all') return catalogue;
  return catalogue.filter((v) => (v.region || 'global') === regionId);
}

export function countByRegion(catalogue, regionId) {
  return vendorsByRegion(catalogue, regionId).length;
}

export function filterVendors(catalogue, { categoryId = 'all', regionId = 'all' } = {}) {
  return catalogue.filter(
    (v) =>
      (categoryId === 'all' || v.categoryId === categoryId) &&
      (regionId === 'all' || (v.region || 'global') === regionId),
  );
}

// ────── Vertical filter (per active building variant)
//
// Returns vendors whose `verticals` array contains `verticalId`. Used
// by Innovate to surface a "Recommended for your warehouse" / "…your
// clinic" shelf when the active building has a matching variant.
// Generic vendors (empty verticals) are NOT returned here — this
// helper specifically pulls the vertical-tagged subset.

export function vendorsByVertical(catalogue, verticalId) {
  if (!verticalId) return [];
  return catalogue.filter((v) => Array.isArray(v.verticals) && v.verticals.includes(verticalId));
}
