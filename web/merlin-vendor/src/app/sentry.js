// Sentry error tracking — Tier 1 hardening for the v1 → 100-tenant ramp.
//
// Sentry is initialized once at app boot from src/main.jsx, before
// React renders. The DSN comes from VITE_SENTRY_DSN; if it's unset
// (local dev with no env var, or build without the var) Sentry stays
// inert — no events sent, no performance hit. Sentry ALSO stays inert
// in `vite dev` (import.meta.env.DEV) even when a DSN is present, so
// Fast-Refresh transients during local editing never pollute the prod
// project with errors that can't recur in a Rollup build.
//
// What we capture: uncaught errors + unhandled promise rejections
// (Sentry's defaults) plus React render errors via ErrorBoundary
// (wired in main.jsx). Performance monitoring (tracesSampleRate) and
// Session Replay (replaysSessionSampleRate) are off — both are
// separately metered features that bite the budget at scale, and
// errors-only is plenty for the v1 → 100-tenant phase.
//
// User context (auth.uid, org id) is attached via setSentryUserContext
// from auth.js whenever the session changes, so each error in Sentry
// shows which user + tenant produced it. Cleared on sign-out.

import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  // Only report from deployed builds. `vite dev` runs with MODE
  // 'development' (import.meta.env.DEV === true) and its Fast Refresh
  // (react-refresh) hot-swaps modules, which can throw transient
  // ReferenceErrors mid-edit that have no analogue in the production
  // bundle. `vite preview` and Vercel builds run with PROD === true,
  // so real deployed environments still report.
  if (import.meta.env.DEV) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    // No DSN configured — running locally without Sentry, or the env
    // var wasn't set on the build. Stay inert. The wrapper components
    // below all gracefully no-op when Sentry isn't initialized.
    return;
  }
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'production',
    // VITE_GIT_SHA is optional — Vercel sets a built-in VERCEL_GIT_COMMIT_SHA
    // that we surface as a Vite env var if needed for source-map matching.
    // Empty string → Sentry uses its own release inference.
    release: import.meta.env.VITE_GIT_SHA || undefined,
    // Errors-only — no Performance Monitoring, no Session Replay.
    // Cheap and covers 90% of the value at our scale.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Filter out known-noisy events. Add to this list as we discover
    // ones that swamp the signal.
    ignoreErrors: [
      // ResizeObserver loop notifications — benign, browser-specific
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Network failures from cancelled fetches when navigating away
      'AbortError',
      'NetworkError when attempting to fetch resource',
    ],
  });
  initialized = true;

  // Synthesize a stack on bare-object Promise rejections BEFORE
  // Sentry's @sentry/react unhandledrejection integration sees them.
  // Without this, throws like `throw { message: 'Bad Request' }` show
  // up as JAVASCRIPT-REACT-17-style "<unknown>" issues with no
  // stacktrace, making them effectively un-debuggable. Mutating the
  // rejected object's `.stack` here gives Sentry's serializer
  // something to attach. The synthesized stack points into the
  // microtask scheduler frames rather than the actual throw site,
  // but it's the best signal available short of code-search at the
  // throw site itself.
  //
  // useCapture=true so we fire before Sentry's listener (which is
  // installed on the bubble phase).
  if (typeof window !== 'undefined') {
    window.addEventListener(
      'unhandledrejection',
      (e) => {
        try {
          const reason = e.reason;
          if (reason && typeof reason === 'object' && !reason.stack) {
            reason.stack = new Error('synthesized at unhandledrejection capture').stack;
            if (!reason.name) reason.name = 'UnhandledRejection';
          }
        } catch {
          /* never block other handlers */
        }
      },
      true,
    );
  }
}

// Attach the signed-in user + active tenant to every event sent
// after this call. Auth.js calls this whenever the session changes;
// signing out passes null to clear.
export function setSentryUserContext(session) {
  if (!initialized) return;
  if (!session) {
    Sentry.setUser(null);
    Sentry.setTag('org_id', null);
    Sentry.setTag('is_platform_admin', null);
    Sentry.setTag('impersonating', null);
    return;
  }
  Sentry.setUser({
    id: session.userId,
    email: session.email,
  });
  Sentry.setTag('org_id', session.organizationId || 'none');
  Sentry.setTag('is_platform_admin', !!session.isPlatformAdmin);
  Sentry.setTag('impersonating', !!session.impersonatingOrgId);
}

// Re-export the React ErrorBoundary so main.jsx can wrap the tree
// without a separate Sentry import. Inert when Sentry isn't init'd
// (the boundary still catches errors and shows the fallback; just
// no event is sent).
export const SentryErrorBoundary = Sentry.ErrorBoundary;

// Manual capture for places where we catch an error and want to log
// it ourselves (instead of letting it bubble). Inert when not init'd.
export function captureException(err, context = {}) {
  if (!initialized) return;
  Sentry.captureException(err, { extra: context });
}
