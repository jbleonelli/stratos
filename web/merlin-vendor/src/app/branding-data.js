// Tenant branding (white-label) — light, Enterprise-only.
// Migration 133 added the columns and the get_effective_branding(uuid)
// resolver. This module fetches the resolved branding for the active
// org and applies it across the shell:
//
//   --accent CSS var  → tenant's accent_hex (Adaptiv pink by default)
//   <link rel="icon"> → tenant's favicon URL (when set)
//   <Wordmark>        → reads branding.logo_url; falls back to Adaptiv mask
//
// /platform/* is never white-labeled — the App-level effect bails out
// when the active path starts with /platform.
//
// Resolution priority (per migration 133):
//   1. The active org's own branding (if branding_enabled + plan check passed)
//   2. Reseller parent's branding (if parent_org_id is set, parent is_reseller, parent enabled)
//   3. NULL = default Adaptiv shell

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { useSession } from './auth.js';

// In-memory cache: orgId → branding object | null. We re-fetch on
// session/active-org change rather than realtime-subscribing — branding
// flips are rare and only the org's own admins make them.
const cache = new Map();
const listeners = new Set();

async function fetchBrandingForOrg(orgId) {
  if (!orgId) return null;
  if (cache.has(orgId)) return cache.get(orgId);
  const { data, error } = await supabase.rpc('get_effective_branding', { p_org_id: orgId });
  if (error) {
    captureException(error, { where: 'fetchBrandingForOrg' });
    // eslint-disable-next-line no-console
    console.warn('[branding] get_effective_branding failed:', error.message);
    cache.set(orgId, null);
    return null;
  }
  const row = (data && data[0]) || null;
  const resolved =
    row && (row.logo_url || row.accent_hex || row.favicon_url)
      ? {
          sourceOrgId: row.source_org_id || null,
          logoUrl: row.logo_url || null,
          accentHex: row.accent_hex || null,
          faviconUrl: row.favicon_url || null,
          inherited: !!row.inherited,
        }
      : null;
  cache.set(orgId, resolved);
  return resolved;
}

// Invalidate a single org's cache entry. Called by the branding-edit
// UI on successful save so the next read is fresh.
export function invalidateBranding(orgId) {
  if (!orgId) return;
  cache.delete(orgId);
  listeners.forEach((fn) => fn(orgId));
}

// ─────────────────────── customer-side edit helpers ───────────────────────
// These power Admin → Branding. The RLS gate on organizations + the
// check constraint on branding_enabled (migration 133) is the source
// of truth; these helpers are the UI's typed handle.

const BUCKET = 'org-branding';

// Upload an image to org-branding/<org_id>/<kind>-<timestamp>.<ext>.
// kind is 'logo' or 'favicon'. Returns the public URL.
export async function uploadBrandingAsset(orgId, file, kind) {
  if (!orgId) throw new Error('orgId required');
  if (!file) throw new Error('file required');
  if (file.size > 2 * 1024 * 1024) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 2 MB.`);
  }
  const ext = (() => {
    const m = file.type;
    if (m === 'image/svg+xml') return 'svg';
    if (m === 'image/png') return 'png';
    if (m === 'image/jpeg') return 'jpg';
    if (m === 'image/webp') return 'webp';
    if (m === 'image/x-icon' || m === 'image/vnd.microsoft.icon') return 'ico';
    throw new Error(`Unsupported file type: ${m}`);
  })();
  const path = `${orgId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Strip the public-URL prefix to get the storage path, then remove.
// Best-effort — failure (e.g., already removed) is silent.
export async function deleteBrandingAsset(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return;
  const marker = `/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return;
  const path = publicUrl.slice(idx + marker.length).split('?')[0];
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

// Persist branding changes to the organizations row. RLS lets the org
// owner write these columns; the check constraint blocks branding_enabled
// = true unless the gate passes (Enterprise / whitelabel / reseller).
// Invalidates the cached resolution so the shell picks up the change.
export async function saveOrgBranding(orgId, fields) {
  if (!orgId) throw new Error('orgId required');
  const patch = {};
  if (typeof fields.brandingEnabled === 'boolean') patch.branding_enabled = fields.brandingEnabled;
  if ('logoUrl' in fields) patch.branding_logo_url = fields.logoUrl || null;
  if ('accentHex' in fields) patch.branding_accent_hex = fields.accentHex || null;
  if ('faviconUrl' in fields) patch.branding_favicon_url = fields.faviconUrl || null;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from('organizations').update(patch).eq('id', orgId);
  if (error) throw new Error(error.message);
  invalidateBranding(orgId);
}

// React hook — returns the resolved branding object (or null) for the
// active org. Re-fetches when the active org changes.
export function useBranding() {
  const session = useSession();
  // organizationId mirrors current_user_org() — impersonating wins, so
  // Adaptiv staff impersonating a tenant see that tenant's brand.
  const orgId = session?.organizationId || null;
  const [branding, setBranding] = useState(() => cache.get(orgId) || null);

  useEffect(() => {
    let cancelled = false;
    if (!orgId) {
      setBranding(null);
      return undefined;
    }
    fetchBrandingForOrg(orgId).then((b) => {
      if (!cancelled) setBranding(b);
    });
    // Re-fetch when invalidateBranding fires for our org.
    const onInvalidate = (invalidatedOrgId) => {
      if (invalidatedOrgId !== orgId) return;
      fetchBrandingForOrg(orgId).then((b) => {
        if (!cancelled) setBranding(b);
      });
    };
    listeners.add(onInvalidate);
    return () => {
      cancelled = true;
      listeners.delete(onInvalidate);
    };
  }, [orgId]);

  return branding;
}

// App-level side-effect hook. Applies the resolved branding to the
// document — CSS variable + favicon. Call this once at the App root.
// Skips when the current URL is /platform/* (Adaptiv-side surfaces
// never get white-labeled).
export function useApplyBranding() {
  const branding = useBranding();
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onPlatform = window.location.pathname.startsWith('/platform');

    // ── --accent CSS var override ──
    // Only override on customer surfaces. /platform always reads the
    // stylesheet default (Adaptiv pink). On exit (cleanup), remove the
    // override so a sign-out → sign-in as a non-branded user resets.
    if (!onPlatform && branding?.accentHex) {
      document.documentElement.style.setProperty('--accent', branding.accentHex);
    } else {
      document.documentElement.style.removeProperty('--accent');
    }

    // ── favicon swap ──
    // Only on customer surfaces. We mutate the existing <link rel="icon">
    // rather than create a new one — gives us a deterministic reset path.
    if (!onPlatform && branding?.faviconUrl) {
      let link = document.querySelector('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      // Stash the original href once so we can restore on cleanup.
      if (!link.dataset.adaptivDefault) {
        link.dataset.adaptivDefault = link.href || '/favicon.ico';
      }
      link.href = branding.faviconUrl;
    } else {
      const link = document.querySelector('link[rel="icon"]');
      if (link?.dataset.adaptivDefault) {
        link.href = link.dataset.adaptivDefault;
      }
    }

    return undefined;
  }, [branding]);

  return branding;
}
