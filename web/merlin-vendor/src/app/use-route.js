// @ts-check
// Minimal URL routing primitive for the standalone device-detail page
// (Track L-1.6) and any future deep-linkable surface. Intentionally
// no react-router dep — we only need: read the current path, navigate
// programmatically, re-render when the user clicks back/forward or
// our nav helper fires.
//
// Usage:
//   const path = useRoute();
//   const externalId = matchDeviceRoute(path);   // null if no match
//   if (externalId) return <DeviceDetailPage external_id={externalId} />;
//
//   <button onClick={() => navigateTo('/device/SDC-000042')}>Open</button>

import { useEffect, useState } from 'react';

function readPath() {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

export function useRoute() {
  const [path, setPath] = useState(readPath);
  useEffect(() => {
    const onChange = () => setPath(readPath());
    window.addEventListener('popstate', onChange);
    // Custom event fired by navigateTo() — pushState alone doesn't
    // dispatch popstate, so we synthesize one for the in-app subscriber.
    window.addEventListener('merlin:navigate', onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('merlin:navigate', onChange);
    };
  }, []);
  return path;
}

export function navigateTo(path) {
  if (typeof window === 'undefined') return;
  if (path === window.location.pathname + window.location.search) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event('merlin:navigate'));
}

// Route matchers — keep them here so the parsing rules live in one
// place. Add more `match*Route` functions as new deep-linkable
// surfaces appear.
export function matchDeviceRoute(path) {
  const m = (path || '').match(/^\/device\/([A-Za-z0-9_-]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Print-friendly report view (Phase 8.6). Renders a single
// contract_report without app chrome so the browser's native Print
// dialog produces a clean PDF. UUIDs only — the path is otherwise
// unauthenticated to anyone with the URL + a session for the right
// org (RLS gates the actual fetch).
export function matchPrintReportRoute(path) {
  const m = (path || '').match(/^\/print\/report\/([0-9a-fA-F-]{36})\/?$/);
  return m ? m[1] : null;
}

// Stripe Checkout redirect targets. Two flows (Phase C, migration 119):
//   ORDER flow (hardware commerce):
//     /checkout/success?session_id=…&order_id=…
//     /checkout/cancel?order_id=…
//   SUBSCRIPTION flow (Pro plan):
//     /checkout/success?session_id=…&kind=subscription
//     /checkout/cancel?kind=subscription
// CheckoutResultPage polls device_orders for the order flow and
// organizations.subscription_status for the subscription flow.
export function matchCheckoutRoute(path) {
  const m = (path || '').match(/^\/checkout\/(success|cancel)\/?$/);
  if (!m) return null;
  const params = new URLSearchParams(window.location.search);
  return {
    kind: m[1],
    orderId: params.get('order_id'),
    flow: params.get('kind') === 'subscription' ? 'subscription' : 'order',
  };
}

// Public pricing page (Phase A of the 3-plan rollout). Fully
// unauthenticated — anyone can hit /pricing without a session and
// see the 3-card layout with the manager/contractor toggle. CTAs
// route to /signup with ?plan + ?audience query params (Phase B
// will read those on the signup form).
export function matchPricingRoute(path) {
  return /^\/pricing\/?$/.test(path || '');
}

// Public Enterprise contact form. Same auth model as /pricing — fully
// unauthenticated. Powers the Enterprise-tier CTA on the pricing cards
// (replaces the old `mailto:` link with a structured intake form).
export function matchPricingContactRoute(path) {
  return /^\/pricing\/contact\/?$/.test(path || '');
}

// Print-friendly user guide. Reachable at /print/guide/<slug> where
// <slug> matches a markdown file in docs/guides/. Renders the guide
// chrome-less so the browser's Print dialog produces a clean PDF.
// Unauthenticated — the guides are static markdown, not tenant data.
export function matchPrintGuideRoute(path) {
  const m = (path || '').match(/^\/print\/guide\/([a-z0-9_-]+)\/?$/);
  return m ? m[1] : null;
}

// Back-office takeover (SaaS v1, phases 3/4/6). Returns:
//   - null                                    when path doesn't start with /platform
//   - { sub: 'tenants', tenantId: null }      for /platform or /platform/tenants
//   - { sub: 'tenants', tenantId: '<uuid>' }  for /platform/tenants/<uuid>
//   - { sub: 'audit',   tenantId: null }      for /platform/audit
//   - { sub: 'ads',     tenantId: null }      for /platform/ads
//   - { sub: 'costs',   tenantId: null }      for /platform/costs
export function matchPlatformRoute(path) {
  if (!/^\/platform(\/|$)/.test(path || '')) return null;
  if (/^\/platform\/audit\/?$/.test(path)) return { sub: 'audit', tenantId: null };
  if (/^\/platform\/ads\/?$/.test(path)) return { sub: 'ads', tenantId: null };
  if (/^\/platform\/costs\/?$/.test(path)) return { sub: 'costs', tenantId: null };
  if (/^\/platform\/performance\/?$/.test(path)) return { sub: 'performance', tenantId: null };
  if (/^\/platform\/catalog\/?$/.test(path)) return { sub: 'catalog', tenantId: null };
  if (/^\/platform\/inventory\/?$/.test(path)) return { sub: 'inventory', tenantId: null };
  if (/^\/platform\/fleet\/?$/.test(path)) return { sub: 'fleet', tenantId: null };
  if (/^\/platform\/device-keys\/?$/.test(path)) return { sub: 'device-keys', tenantId: null };
  if (/^\/platform\/marketplace\/?$/.test(path)) return { sub: 'marketplace', tenantId: null };
  // Demos pillar (promoted from Marketing → its own top-level pillar).
  // Two sub-pages: list (audit history) + invite (send form). Legacy
  // /platform/demo and /platform/marketing/demo land on the invite
  // tab so existing bookmarks + emailed prospect-invite links don't
  // 404. /platform/demos with no sub-segment also defaults to invite
  // since that was historically the only surface.
  if (/^\/platform\/demos\/list\/?$/.test(path)) return { sub: 'demos-list', tenantId: null };
  if (/^\/platform\/demos\/invite\/?$/.test(path)) return { sub: 'demos-invite', tenantId: null };
  if (/^\/platform\/demos\/sent\/?$/.test(path)) return { sub: 'demos-sent', tenantId: null };
  if (/^\/platform\/demos\/?$/.test(path)) return { sub: 'demos-list', tenantId: null };
  if (/^\/platform\/demo\/?$/.test(path)) return { sub: 'demo', tenantId: null };
  if (/^\/platform\/marketing\/demo\/?$/.test(path)) return { sub: 'marketing-demo', tenantId: null };
  if (/^\/platform\/marketing\/promo\/?$/.test(path)) return { sub: 'marketing-promo', tenantId: null };
  if (/^\/platform\/marketing\/sales\/?$/.test(path)) return { sub: 'marketing-sales', tenantId: null };
  if (/^\/platform\/pricing\/?$/.test(path)) return { sub: 'pricing', tenantId: null };
  if (/^\/platform\/experimental\/?$/.test(path)) return { sub: 'experimental', tenantId: null };
  if (/^\/platform\/content\/?$/.test(path)) return { sub: 'content', tenantId: null };
  if (/^\/platform\/support\/guides\/?$/.test(path)) return { sub: 'support-guides', tenantId: null };
  if (/^\/platform\/support\/tickets\/?$/.test(path)) return { sub: 'support-tickets', tenantId: null };
  if (/^\/platform\/docs\/?$/.test(path)) return { sub: 'docs', tenantId: null };
  if (/^\/platform\/users\/?$/.test(path)) return { sub: 'users', tenantId: null };
  if (/^\/platform\/stripe\/products\/?$/.test(path)) return { sub: 'stripe-products', tenantId: null };
  if (/^\/platform\/stripe\/?$/.test(path)) return { sub: 'stripe', tenantId: null };
  if (/^\/platform\/payments\/samsic-crm\/?$/.test(path)) return { sub: 'samsic-crm', tenantId: null };
  if (/^\/platform\/team-activity\/?$/.test(path)) return { sub: 'team-activity', tenantId: null };
  if (/^\/platform\/internal\/status\/?$/.test(path)) return { sub: 'internal-status', tenantId: null };
  if (/^\/platform\/internal\/translations\/?$/.test(path)) return { sub: 'internal-translations', tenantId: null };
  const tenantMatch = (path || '').match(/^\/platform\/tenants\/([0-9a-fA-F-]{36})\/?$/);
  if (tenantMatch) return { sub: 'tenants', tenantId: tenantMatch[1] };
  return { sub: 'tenants', tenantId: null };
}
