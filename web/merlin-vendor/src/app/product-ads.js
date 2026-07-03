// Product ads — Briefing right-rail "featured product" cards.
//
// As of phase 6 (SaaS v1 back-office), the ad catalog is platform-managed:
// one canonical set of cards lives in `platform_product_ads`, edited from
// /platform/ads by Adaptiv staff. Per-tenant settings (display mode, pin,
// per-tenant hide) live in `merlin_config.platform_ads_overrides` and are
// editable from each tenant's Admin → Product ads section.
//
// Two display modes:
//   - 'rotation' (default): all visible-to-this-tenant ads cycle by
//     day-of-year, deterministic across the workspace.
//   - 'pinned': a single chosen ad is shown all the time. Pinned ad
//     ignores the per-tenant hide list (the explicit pick wins).
//
// The shape returned by useProductAdsSettings() stays the same as before
// the refactor so Briefing keeps working unchanged. The `ads` array is
// the full active catalog; `hiddenIds` is the tenant's hide list and is
// applied inside pickActiveAd().
//
// Ad row shape (also used as the editor draft shape):
//   {
//     id:               'sdc',                  // slug, also primary key
//     name:             'Smart Display Classic',
//     spec:             'ADX-SDC-V1 · 7" e-ink · LTE · 3-year battery',
//     pitch:            '…',
//     bullets:          [['display', '7" e-ink…'], …],
//     chatPrompt:       'Tell me more about …',
//     illustrationKey:  'sdc' | 'pcb' | 'slb' | 'generic',
//     imageUrl:         null | 'https://…',     // overrides illustration
//     active:           true,                   // platform-level flag
//   }

import { supabase } from './supabase.js';
import { getSession } from './auth.js';

// ────── Mode + registry constants

export const AD_DISPLAY_MODES = ['rotation', 'pinned'];
export const DEFAULT_AD_MODE = 'rotation';

export const ILLUSTRATION_OPTIONS = [
  { id: 'sdc', label: 'Smart Display Classic — wall-mounted e-ink panel' },
  { id: 'pcb', label: 'People Counter Basic — ceiling PIR puck' },
  { id: 'slb', label: 'Smart Logger Basic — 6-button NFC logger' },
  { id: 'generic', label: 'Generic — Adaptiv badge placeholder' },
];

export const BULLET_ICON_OPTIONS = [
  'display',
  'people',
  'badge',
  'sparkle',
  'wifi',
  'bolt',
  'shield',
  'check',
  'air',
  'supply',
  'beacon',
  'building',
];

// ────── Cache + listeners

function defaultSettings() {
  return {
    mode: DEFAULT_AD_MODE,
    pinnedId: null,
    hiddenIds: [],
    // Start empty — Briefing's ProductShowcase short-circuits on
    // empty ads, so the slot stays blank until hydrateOnce() resolves
    // the platform catalog + kill switch. Seeding with
    // DEFAULT_PRODUCT_ADS here caused a visible flash on every login:
    // the ad rendered for the ~150ms it took the kill switch to load,
    // then disappeared when the real (empty) result landed. JB called
    // it out — losing the in-code fallback is the right trade.
    ads: [],
  };
}
let cache = defaultSettings();
const listeners = new Set();
function emit() {
  for (const fn of listeners) fn(cache);
}

// ────── Load: platform catalog + per-tenant overrides

function normalizePlatformAd(row) {
  return {
    id: row.id,
    name: row.name || '',
    spec: row.spec || '',
    pitch: row.pitch || '',
    bullets: Array.isArray(row.bullets) ? row.bullets : [],
    chatPrompt: row.chat_prompt || '',
    illustrationKey: row.illustration_key || 'generic',
    imageUrl: row.image_url || null,
    active: row.active !== false,
    position: row.position ?? 100,
  };
}

function normalizeOverrides(value) {
  if (!value || typeof value !== 'object') {
    return { mode: DEFAULT_AD_MODE, pinnedId: null, hiddenIds: [] };
  }
  const mode = AD_DISPLAY_MODES.includes(value.mode) ? value.mode : DEFAULT_AD_MODE;
  const pinnedId = typeof value.pinnedId === 'string' && value.pinnedId.trim() ? value.pinnedId.trim() : null;
  const hiddenIds = Array.isArray(value.hiddenIds) ? value.hiddenIds.filter((s) => typeof s === 'string') : [];
  return { mode, pinnedId, hiddenIds };
}

async function loadCatalogAndOverrides() {
  // Catalog is platform-wide — fetch active ads in display order.
  const catalogP = supabase
    .from('platform_product_ads')
    .select('*')
    .eq('active', true)
    .order('position', { ascending: true })
    .order('id', { ascending: true });

  // Overrides are per-tenant. Bail out gracefully if there's no active org
  // (e.g. brand-new sign-up) — defaults are fine.
  const session = getSession();
  const orgId = session?.organizationId;
  const overridesP = orgId
    ? supabase
        .from('merlin_config')
        .select('value')
        .eq('section', 'platform_ads_overrides')
        .eq('organization_id', orgId)
        .maybeSingle()
    : Promise.resolve({ data: null });

  // Platform-wide kill switch (migration 076). When enabled, no ads are
  // shown on any tenant regardless of per-tenant config.
  const killSwitchP = supabase.from('platform_settings').select('value').eq('key', 'ads_globally_hidden').maybeSingle();

  const [catalogRes, overridesRes, killRes] = await Promise.all([catalogP, overridesP, killSwitchP]);
  if (catalogRes.error) {
    // eslint-disable-next-line no-console
    console.warn('[product-ads] catalog fetch failed:', catalogRes.error.message);
    return null;
  }
  const globallyHidden = killRes?.data?.value?.enabled === true;
  const ads = globallyHidden ? [] : (catalogRes.data || []).map(normalizePlatformAd);
  const overrides = normalizeOverrides(overridesRes.data?.value);
  return { ...overrides, ads };
}

// Force a reload — called after the per-tenant overrides change so
// Briefing reflects the new mode/pin/hide without a full page reload.
async function refresh() {
  const next = await loadCatalogAndOverrides();
  if (next) cache = next;
  emit();
}

// ────── Editor scaffolds

export function emptyProductAd() {
  return {
    id: '',
    name: '',
    spec: '',
    pitch: '',
    bullets: [['sparkle', '']],
    chatPrompt: '',
    illustrationKey: 'generic',
    imageUrl: null,
    active: true,
  };
}

// ────── Image upload (used by the platform editor)

export const PRODUCT_ADS_BUCKET = 'product-ads';
export const MAX_AD_IMAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_AD_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']);

function extForMime(mime) {
  return (
    {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/gif': 'gif',
    }[mime] || 'bin'
  );
}

// Path lives under `platform/...` (RLS in migration 062 gates writes
// there to is_platform_admin). Legacy `<org_id>/...` paths from the
// old per-tenant editor remain readable since the bucket is public-read,
// so customer-side rendering of pre-migration uploads keeps working.
export async function uploadProductAdImage(adId, file) {
  if (!file) throw new Error('No file selected');
  if (!ALLOWED_AD_IMAGE_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || 'unknown'}. Use PNG, JPEG, WebP, SVG, or GIF.`);
  }
  if (file.size > MAX_AD_IMAGE_BYTES) {
    throw new Error(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is ${MAX_AD_IMAGE_BYTES / 1024 / 1024} MB.`,
    );
  }
  const ext = extForMime(file.type);
  const safeId =
    (adId || 'ad')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'ad';
  const path = `platform/${safeId}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(PRODUCT_ADS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from(PRODUCT_ADS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteProductAdImage(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return;
  const marker = `/object/public/${PRODUCT_ADS_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return;
  const path = publicUrl.slice(idx + marker.length).split('?')[0];
  if (!path) return;
  await supabase.storage.from(PRODUCT_ADS_BUCKET).remove([path]);
}

// Exposed so /platform/ads can refresh the customer-side cache after
// the platform admin edits the catalog (rather than waiting for the next
// page load).
export async function refreshProductAdsCustomerCache() {
  return refresh();
}
