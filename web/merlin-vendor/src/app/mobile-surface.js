// @ts-check
// Mobile worker surface detection — the third Merlin surface alongside the
// customer app (merlin.) and the back-office (excalibur.).
//
// Plan of record: docs/architecture/mobile-worker-app.md. The real surface is
// `mobile.adaptiv.systems` (its own Vercel alias + PWA manifest + storageKey),
// but the Phase-1 spike fakes it on the existing host with a sticky `?mobile=1`
// query flag so JB can hold it on a phone (merlin.adaptiv.systems/?mobile=1)
// before we wire the subdomain. `?mobile=0` clears the override.
//
// Read once at module scope on the client; the hostname half is stable for the
// page-load and the query half is persisted to sessionStorage so it survives
// in-app SPA navigation (which doesn't re-run this module).

const FORCE_KEY = 'merlin-force-mobile';

function computeIsMobileSurface() {
  if (typeof window === 'undefined') return false;

  // 1. The real thing: the dedicated subdomain.
  const host = (window.location.hostname || '').toLowerCase();
  if (host === 'mobile.adaptiv.systems' || host.startsWith('mobile.')) return true;

  // 2. The spike override: a sticky `?mobile=1` flag for any host.
  try {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('mobile');
    if (flag === '1') {
      sessionStorage.setItem(FORCE_KEY, '1');
      return true;
    }
    if (flag === '0') {
      sessionStorage.removeItem(FORCE_KEY);
      return false;
    }
    if (sessionStorage.getItem(FORCE_KEY) === '1') return true;
  } catch {
    /* sessionStorage blocked (private mode / sandbox) — fall through */
  }

  return false;
}

// Evaluated once. Surface identity must not flip mid-session (it would remount
// the entire shell and reset auth bootstrap), so callers read this constant.
let cached;
export function isMobileSurface() {
  if (cached === undefined) cached = computeIsMobileSurface();
  return cached;
}
