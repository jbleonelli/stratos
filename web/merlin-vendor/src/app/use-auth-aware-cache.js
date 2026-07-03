// @ts-check
// Auth-aware cache reset — fires the supplied callbacks whenever Supabase
// auth events change the active user identity.
//
// Modules in this codebase use a module-level `hydrated = false` latch
// that gets set to `true` after the first DB read. Without an explicit
// reset on auth change, the latch is sticky across sign-in/sign-out:
//   1. User A signs in, hydrate fires, cache populated with A's RLS-narrowed view.
//   2. User A signs out, signs in as B (or platform admin impersonates).
//   3. `hydrated === true` is still true → no re-fetch → B sees A's cache.
//
// The agentic-data.js module already implements this fix inline. The 7 other
// modules (merlin-asks, route-overrides-data, team-data, slas-data, routes-
// data, custom-locations, event-firehose) used to duplicate the latch
// without the reset. Now they each call `registerAuthAwareCache` once at
// module scope with their own reset hooks.
//
// Usage (at module scope, AFTER hydrated / hydratingPromise / listeners are
// declared, before any export):
//
//   registerAuthAwareCache({
//     resetHydrate: () => { hydrated = false; hydratingPromise = null; },
//     onSignOut:    () => {
//       try { localStorage.removeItem(STORAGE_KEY); } catch {}
//       queue = [];
//       saveCache(queue);
//       listeners.forEach((fn) => fn(queue));
//     },
//     onSignIn:     () => hydrateOnce(),
//   });
//
// SSR-safe — exits without subscribing if `window` is undefined.

import { supabase } from './supabase.js';

export function registerAuthAwareCache({ resetHydrate, onSignOut, onSignIn }) {
  if (typeof window === 'undefined') return;

  let lastUserId = null;
  supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user?.id || null;

    if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !userId)) {
      // Drop stale state so the next sign-in starts clean.
      resetHydrate?.();
      onSignOut?.();
      lastUserId = null;
      return;
    }

    if (userId && userId !== lastUserId) {
      // SIGNED_IN, USER_UPDATED, or first restored TOKEN_REFRESHED with a
      // new identity. Force fresh hydrate.
      resetHydrate?.();
      onSignIn?.();
      lastUserId = userId;
    }
  });
}
