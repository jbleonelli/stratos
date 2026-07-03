// platform_settings — small cross-tenant settings store. RLS lets any
// authenticated user read every row; only platform admins can write.
// Specific rows are also readable by anon for pre-signin needs:
//   - 'feature_flags'    (migration 102) — signupEnabled gates the
//                                          login page itself.
//   - 'maintenance_mode' (migration 163) — pre-signin MaintenancePage
//                                          needs to know enabled state
//                                          before any session exists.
//   - 'pricing_content'  — public /pricing page.
// Other rows (e.g. the ads kill switch, demo_email_overrides) stay
// authenticated-only.
//
// First user: the "hide ads everywhere" kill switch. Customer-side
// product-ads.js consults useAdsGloballyHidden() before fetching the
// catalog so disabling here suppresses ads on every tenant immediately.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const ADS_KEY = 'ads_globally_hidden';
const MAINTENANCE_KEY = 'maintenance_mode';

// ────── Read

export async function fetchPlatformSetting(key) {
  const { data, error } = await supabase.from('platform_settings').select('value').eq('key', key).maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[platform-settings] fetch failed:', error.message);
    return null;
  }
  return data?.value ?? null;
}

export function useAdsGloballyHidden() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchPlatformSetting(ADS_KEY).then((v) => {
      if (!alive) return;
      setEnabled(v?.enabled === true);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { enabled, ready };
}

// ────── Maintenance mode (Merlin Owner only via UI gate; RLS still enforces server-side)
//
// When enabled, the Auth page shows a MaintenancePage instead of the
// login form, and any active sign-in attempt from non-owners gets
// rejected post-auth (App.jsx forces logout). Existing logged-in
// sessions are NOT disrupted — flipping this on only affects new
// sign-ins. Disable when the update window is over.
//
// Shape of platform_settings.maintenance_mode.value:
//   { enabled: bool, message: string|null, enabled_at: ISO|null,
//     enabled_by_email: string|null }
//
// The Merlin Owner UI gate is in PlatformExperimental.jsx; this
// helper itself doesn't enforce it (RLS does, since only platform
// admins / owners can write to platform_settings).

// ────── Maintenance mode — module-scope cache + subscriber fanout
//
// One realtime subscription per browser session (set up lazily on
// first useMaintenanceMode() consumer), no matter how many hooks /
// components consume it. Same pattern as agent-runs.js. Avoids the
// "cannot add postgres_changes callbacks" trap when multiple consumers
// would otherwise subscribe to the same channel topic.

let maintenanceState = { enabled: false, message: null, enabledAt: null, enabledByEmail: null, ready: false };
const maintenanceListeners = new Set();
let maintenanceHydrated = false;
let maintenanceChannel = null;

function notifyMaintenanceListeners() {
  maintenanceListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

async function hydrateMaintenance() {
  const v = await fetchPlatformSetting(MAINTENANCE_KEY);
  maintenanceState = {
    enabled: v?.enabled === true,
    message: v?.message ?? null,
    enabledAt: v?.enabled_at ?? null,
    enabledByEmail: v?.enabled_by_email ?? null,
    ready: true,
  };
  notifyMaintenanceListeners();
}

function ensureMaintenanceChannel() {
  if (maintenanceChannel) return;
  // Module-scope channel — exactly one subscription per browser tab,
  // regardless of how many components mount the hook.
  maintenanceChannel = supabase
    .channel('maintenance-mode')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'platform_settings', filter: `key=eq.${MAINTENANCE_KEY}` },
      () => {
        hydrateMaintenance();
      },
    )
    .subscribe();
}

export function useMaintenanceMode() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    maintenanceListeners.add(listener);
    // Lazy hydrate on first consumer; subsequent consumers reuse the
    // already-cached state and just hook into the listener set.
    if (!maintenanceHydrated) {
      maintenanceHydrated = true;
      hydrateMaintenance();
      ensureMaintenanceChannel();
    }
    return () => {
      maintenanceListeners.delete(listener);
    };
  }, []);

  return maintenanceState;
}

export async function setMaintenanceMode({ enabled, message, enabledByEmail }) {
  const value = {
    enabled: !!enabled,
    message: enabled ? message || null : null,
    enabled_at: enabled ? new Date().toISOString() : null,
    enabled_by_email: enabled ? enabledByEmail || null : null,
  };
  const { error } = await supabase
    .from('platform_settings')
    .upsert({ key: MAINTENANCE_KEY, value }, { onConflict: 'key' });
  if (error) throw error;

  // Optimistic local update + listener notify so the writer's UI
  // reflects the change instantly, without waiting for the realtime
  // postgres_changes echo to round-trip. Realtime will arrive in a
  // tick and re-set the same values — idempotent.
  maintenanceState = {
    enabled: !!enabled,
    message: value.message,
    enabledAt: value.enabled_at,
    enabledByEmail: value.enabled_by_email,
    ready: true,
  };
  notifyMaintenanceListeners();
}

// ────── Write (platform admin only — RLS-enforced)

export async function setAdsGloballyHidden(enabled) {
  const value = { enabled: !!enabled };
  const { error } = await supabase.from('platform_settings').upsert({ key: ADS_KEY, value }, { onConflict: 'key' });
  if (error) throw error;
}

// ────── My Day visibility (founder kill switch) ──────────────────────
//
// platform_settings key 'myday_hidden' = { hidden: bool }. When hidden,
// the customer app drops the "My day" (briefing) tab from the MONITOR
// sub-nav and redirects anyone landing on it to "Now". Toggled from
// /platform/experimental (founder-only UI gate; RLS still enforces
// platform-admin write server-side). Same module-scope cache + single
// realtime subscription pattern as maintenance mode, so every signed-in
// user reflects the flip without a reload.

const MYDAY_KEY = 'myday_hidden';
let mydayState = { hidden: false, ready: false };
const mydayListeners = new Set();
let mydayHydrated = false;
let mydayChannel = null;

function notifyMydayListeners() {
  mydayListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

async function hydrateMyday() {
  const v = await fetchPlatformSetting(MYDAY_KEY);
  mydayState = { hidden: v?.hidden === true, ready: true };
  notifyMydayListeners();
}

function ensureMydayChannel() {
  if (mydayChannel) return;
  mydayChannel = supabase
    .channel('myday-hidden')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'platform_settings', filter: `key=eq.${MYDAY_KEY}` },
      () => {
        hydrateMyday();
      },
    )
    .subscribe();
}

export function useMyDayHidden() {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    mydayListeners.add(listener);
    if (!mydayHydrated) {
      mydayHydrated = true;
      hydrateMyday();
      ensureMydayChannel();
    }
    return () => {
      mydayListeners.delete(listener);
    };
  }, []);
  return mydayState;
}

export async function setMyDayHidden(hidden) {
  const value = { hidden: !!hidden };
  const { error } = await supabase.from('platform_settings').upsert({ key: MYDAY_KEY, value }, { onConflict: 'key' });
  if (error) throw error;
  mydayState = { hidden: !!hidden, ready: true };
  notifyMydayListeners();
}

// ────── AI model defaults (platform-wide)
// platform_settings key 'model_defaults' = { fast?: string, thoughtful?: string }.
// Empty/missing per role = fall back to the hardcoded default in claude-client.ts.
// Read per-request server-side by resolveOrgLlm() (cached 60s); this is the
// Super-Admin editor for it.
const MODEL_DEFAULTS_KEY = 'model_defaults';

export async function fetchModelDefaults() {
  const value = await fetchPlatformSetting(MODEL_DEFAULTS_KEY);
  return { fast: value?.fast || '', thoughtful: value?.thoughtful || '' };
}

export async function setModelDefaults({ fast, thoughtful }) {
  const value = { fast: fast || null, thoughtful: thoughtful || null };
  const { error } = await supabase
    .from('platform_settings')
    .upsert({ key: MODEL_DEFAULTS_KEY, value }, { onConflict: 'key' });
  if (error) throw error;
}
