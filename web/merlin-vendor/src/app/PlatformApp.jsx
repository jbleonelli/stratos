// Adaptiv Platform — back-office shell (SaaS v1, phase 3).
// Full-shell takeover at /platform/* for users where session.isPlatformAdmin
// is true. Distinct from per-workspace Admin: this is Adaptiv-side, for
// managing the SaaS platform itself (tenants today; audit log + ads catalog
// in later phases). The customer-side workspace picker is intentionally
// absent — back-office is global, not org-scoped.
//
// Sub-routes:
//   /platform                       → tenants list
//   /platform/tenants               → tenants list
//   /platform/tenants/<uuid>        → tenant detail

import React from 'react';
import { Icon } from './icons.jsx';
import { WORDMARK_URL } from './brand-assets.js';
import { useSession, logout as doLogout, initialsOf } from './auth.js';
import { navigateTo, matchPlatformRoute, useRoute } from './use-route.js';
import { FloatingMenu, AdaptivAIcon } from './FloatingMenu.jsx';
import { PlatformTenantsPage } from './PlatformTenants.jsx';
import { PlatformTenantDetailPage } from './PlatformTenantDetail.jsx';
import { PlatformAuditPage } from './PlatformAudit.jsx';
import { PlatformAdsPage } from './PlatformAds.jsx';
import { PlatformMarketplacePage } from './PlatformMarketplace.jsx';
import { PlatformCostsPage } from './PlatformCosts.jsx';
import { PlatformCatalogPage } from './PlatformCatalog.jsx';
import { PlatformInventoryPage } from './PlatformInventory.jsx';
import { PlatformFleetPage } from './PlatformFleet.jsx';
import { PlatformDeviceKeysPage } from './PlatformDeviceKeys.jsx';
import { PlatformExperimentalPage } from './PlatformExperimental.jsx';
import { PlatformContentPage } from './PlatformContent.jsx';
import { PlatformPerformancePage } from './PlatformPerformance.jsx';
import { PlatformSupportGuidesPage } from './PlatformSupport.jsx';
import { PlatformDocsPage } from './PlatformDocs.jsx';
import { PlatformSupportTicketsPage } from './PlatformSupportTickets.jsx';
import { PlatformStatusPage } from './PlatformStatus.jsx';
import { PlatformUsersPage } from './PlatformUsers.jsx';
import { PlatformStripePage } from './PlatformStripe.jsx';
import { PlatformStripeProductsPage } from './PlatformStripeProducts.jsx';
import { PlatformSamsicCrmPage } from './PlatformSamsicCrm.jsx';
import { PlatformTeamActivityPage } from './PlatformTeamActivity.jsx';
import { PlatformDemoPage, PlatformDemosListPage, PlatformDemosSentPage } from './PlatformDemo.jsx';
import { PlatformPricingPage } from './PlatformPricing.jsx';
import { PlatformPromoCodesPage } from './PlatformPromoCodes.jsx';
import { PlatformSalesPage } from './PlatformSales.jsx';
import { PlatformTranslationsPage } from './PlatformTranslations.jsx';
import { useT } from './i18n.js';

// Top-level pillars (mirroring the customer app's MONITOR/OPERATE/…
// pattern). The rail shows one icon per pillar; sub-items render as a
// horizontal pill-row sub-nav above the page body whenever the active
// pillar has more than one item. Pillar.icon is the rail glyph;
// items[*].icon is the strip glyph. Per docs/architecture/platform-vision.md.
//
// `minTier` on each item declares the minimum platformRole that may see
// the surface. Hierarchy: owner > super_admin > admin > normal_user.
// PILLARS_FOR_SESSION below filters items + drops empty pillars.
//   - super_admin: Stripe, Costs, Pricing (financial / billing)
//   - admin:       most platform surfaces except financial
//   - normal_user: only Customers, Devices, Support
const PILLARS = [
  {
    id: 'overview',
    labelKey: 'platform.group.overview',
    icon: 'grid',
    items: [
      {
        id: 'performance',
        labelKey: 'platform.section.performance',
        icon: 'grid',
        path: '/platform/performance',
        minTier: 'admin',
      },
      {
        id: 'internal-status',
        labelKey: 'platform.section.internal_status',
        icon: 'beacon',
        path: '/platform/internal/status',
        minTier: 'admin',
      },
      // Costs is super-admin-only (financial data).
      {
        id: 'costs',
        labelKey: 'platform.section.costs',
        icon: 'bolt',
        path: '/platform/costs',
        minTier: 'super_admin',
      },
    ],
  },
  {
    id: 'customers',
    labelKey: 'platform.group.customers',
    icon: 'people',
    items: [
      {
        id: 'tenants',
        labelKey: 'platform.section.tenants',
        icon: 'building',
        path: '/platform/tenants',
        minTier: 'normal_user',
      },
      {
        id: 'users',
        labelKey: 'platform.section.users',
        icon: 'people',
        path: '/platform/users',
        minTier: 'normal_user',
      },
    ],
  },
  {
    // Sales pillar (formerly Payments, renamed 2026-05-19). Section
    // id + URL path stay as `payments` for inbound-link continuity;
    // the user-facing label resolves via platform.group.payments.
    id: 'payments',
    labelKey: 'platform.group.payments',
    icon: 'cart',
    items: [
      {
        id: 'stripe',
        labelKey: 'platform.section.stripe',
        icon: 'cart',
        path: '/platform/stripe',
        minTier: 'super_admin',
      },
      {
        id: 'stripe-products',
        labelKey: 'platform.section.stripe_products',
        icon: 'grid',
        path: '/platform/stripe/products',
        minTier: 'super_admin',
      },
      {
        id: 'samsic-crm',
        labelKey: 'platform.section.samsic_crm',
        icon: 'panel',
        path: '/platform/payments/samsic-crm',
        minTier: 'super_admin',
      },
    ],
  },
  {
    id: 'devices',
    labelKey: 'platform.group.devices',
    icon: 'gateway',
    items: [
      {
        id: 'inventory',
        labelKey: 'platform.section.inventory',
        icon: 'supply',
        path: '/platform/inventory',
        minTier: 'normal_user',
      },
      {
        id: 'fleet',
        labelKey: 'platform.section.fleet',
        icon: 'gateway',
        path: '/platform/fleet',
        minTier: 'normal_user',
      },
      {
        id: 'device-keys',
        labelKey: 'platform.section.device_keys',
        icon: 'shield',
        path: '/platform/device-keys',
        minTier: 'admin',
      },
    ],
  },
  {
    // Demos: promoted out of Marketing 2026-05-27 to its own pillar.
    // Three sub-sections:
    //   - Demos list  → catalog of available bundles (browse)
    //   - Invite      → the send form (action)
    //   - Sent        → audit table of past invites (history)
    // The sub-nav strip surfaces all three since the pillar has >1 item.
    // Restricted to JB's personal email (jb@leonelli.net) — this is the
    // founder's outbound-prospect workflow, not a back-office surface
    // every admin should see. The pillar disappears entirely for other
    // admins since pillarsForSession drops empty pillars.
    id: 'demos',
    labelKey: 'platform.group.demos',
    icon: 'play',
    items: [
      {
        id: 'demos-list',
        labelKey: 'platform.section.demos_list',
        icon: 'sparkle',
        path: '/platform/demos/list',
        minTier: 'admin',
        visibleToEmails: ['jb@leonelli.net'],
      },
      {
        id: 'demos-invite',
        labelKey: 'platform.section.demos_invite',
        icon: 'play',
        path: '/platform/demos/invite',
        minTier: 'admin',
        visibleToEmails: ['jb@leonelli.net'],
      },
      {
        id: 'demos-sent',
        labelKey: 'platform.section.demos_sent',
        icon: 'people',
        path: '/platform/demos/sent',
        minTier: 'admin',
        visibleToEmails: ['jb@leonelli.net'],
      },
    ],
  },
  {
    id: 'marketing',
    labelKey: 'platform.group.marketing',
    icon: 'beacon',
    items: [
      {
        id: 'marketplace',
        labelKey: 'platform.section.marketplace',
        icon: 'sparkle',
        path: '/platform/marketplace',
        minTier: 'admin',
      },
      { id: 'ads', labelKey: 'platform.section.ads', icon: 'beacon', path: '/platform/ads', minTier: 'admin' },
      {
        id: 'catalog',
        labelKey: 'platform.section.catalog',
        icon: 'cart',
        path: '/platform/catalog',
        minTier: 'admin',
      },
      {
        id: 'marketing-promo',
        labelKey: 'platform.section.marketing_promo',
        icon: 'sparkle',
        path: '/platform/marketing/promo',
        minTier: 'admin',
      },
      {
        id: 'marketing-sales',
        labelKey: 'platform.section.marketing_sales',
        icon: 'people',
        path: '/platform/marketing/sales',
        minTier: 'admin',
      },
      // Pricing seeds Stripe-facing tier copy — super-admin-only.
      {
        id: 'pricing',
        labelKey: 'platform.section.pricing',
        icon: 'cart',
        path: '/platform/pricing',
        minTier: 'super_admin',
      },
    ],
  },
  {
    id: 'support',
    labelKey: 'platform.group.support',
    icon: 'help',
    items: [
      {
        id: 'support-guides',
        labelKey: 'platform.section.support_guides',
        icon: 'help',
        path: '/platform/support/guides',
        minTier: 'normal_user',
      },
      { id: 'docs', labelKey: 'platform.section.docs', icon: 'paper', path: '/platform/docs', minTier: 'admin' },
      {
        id: 'support-tickets',
        labelKey: 'platform.section.support_tickets',
        icon: 'chat',
        path: '/platform/support/tickets',
        minTier: 'normal_user',
      },
    ],
  },
  {
    // Internal pillar — founder-only surface (logins audit, in-app
    // translation editor, full audit log, experimental feature flags).
    // Restricted to JB's personal email via the same visibleToEmails
    // gate the Demos pillar uses; pillarsForSession drops the whole
    // pillar for other admins since every item is gated.
    id: 'internal',
    labelKey: 'platform.group.internal',
    icon: 'cog',
    items: [
      {
        id: 'team-activity',
        labelKey: 'platform.section.team_activity',
        icon: 'people',
        path: '/platform/team-activity',
        minTier: 'admin',
        visibleToEmails: ['jb@leonelli.net'],
      },
      {
        id: 'internal-translations',
        labelKey: 'platform.section.internal_translations',
        icon: 'chat',
        path: '/platform/internal/translations',
        minTier: 'admin',
        visibleToEmails: ['jb@leonelli.net'],
      },
      {
        id: 'audit',
        labelKey: 'platform.section.audit',
        icon: 'shield',
        path: '/platform/audit',
        minTier: 'admin',
        visibleToEmails: ['jb@leonelli.net'],
      },
      {
        id: 'experimental',
        labelKey: 'platform.section.experimental',
        icon: 'sparkle',
        path: '/platform/experimental',
        minTier: 'admin',
        visibleToEmails: ['jb@leonelli.net'],
      },
      {
        id: 'content',
        labelKey: 'platform.section.content',
        icon: 'paper',
        path: '/platform/content',
        minTier: 'admin',
        visibleToEmails: ['jb@leonelli.net'],
      },
    ],
  },
];

// Tier hierarchy as numeric ranks for comparison. Higher number = more
// privilege. Sessions pre-migration-131 (cached without platformRole)
// fall through to super_admin via the auth.js fallback so they don't
// suddenly lose access during the rollout window.
const TIER_RANK = { owner: 4, super_admin: 3, admin: 2, normal_user: 1 };

export function sessionMeetsTier(session, minTier) {
  if (!session) return false;
  const myRank = session.isMerlinOwner ? 4 : TIER_RANK[session.platformRole] || 0;
  return myRank >= (TIER_RANK[minTier] || 0);
}

// Per-item allow-list of emails. When an item declares
// `visibleToEmails: ['a@x.com', 'b@y.com']` it only shows up for those
// exact email addresses (case-insensitive). Use sparingly — most
// gating should happen via `minTier`. This is for surfaces tied to a
// specific operator (e.g. Demos is JB's personal back-office tool).
function sessionMatchesItemEmail(session, item) {
  if (!Array.isArray(item.visibleToEmails) || item.visibleToEmails.length === 0) return true;
  const mine = (session?.email || '').toLowerCase();
  if (!mine) return false;
  return item.visibleToEmails.some((e) => String(e || '').toLowerCase() === mine);
}

// Return the PILLARS list filtered down to what the current session can
// see. Items below the user's tier or outside their email allow-list
// are dropped; pillars with no remaining items are dropped entirely.
function pillarsForSession(session) {
  return PILLARS.map((p) => ({
    ...p,
    items: p.items.filter((it) => sessionMeetsTier(session, it.minTier) && sessionMatchesItemEmail(session, it)),
  })).filter((p) => p.items.length > 0);
}

function pillarForSection(sectionId, pillars = PILLARS) {
  return pillars.find((p) => p.items.some((it) => it.id === sectionId)) || pillars[0];
}

export function PlatformApp() {
  // App.jsx is the single source of truth for the /platform gate —
  // it only renders this component when session.isPlatformAdmin is
  // true. No defensive redirect needed here.
  const session = useSession();
  const path = useRoute();
  const route = matchPlatformRoute(path);

  // Tier-filtered pillar list (migration 131). Hides Stripe + Costs
  // from Admin, hides Marketing + Operations + Internal + Overview from
  // Normal User. The PILLARS source is unchanged; this is the per-session
  // projection that the UI renders against.
  const visiblePillars = pillarsForSession(session);
  const visibleSectionIds = new Set(visiblePillars.flatMap((p) => p.items.map((i) => i.id)));

  const activeSection =
    route?.sub === 'audit'
      ? 'audit'
      : route?.sub === 'ads'
        ? 'ads'
        : route?.sub === 'costs'
          ? 'costs'
          : route?.sub === 'performance'
            ? 'performance'
            : route?.sub === 'catalog'
              ? 'catalog'
              : route?.sub === 'inventory'
                ? 'inventory'
                : route?.sub === 'fleet'
                  ? 'fleet'
                  : route?.sub === 'device-keys'
                    ? 'device-keys'
                    : route?.sub === 'marketplace'
                      ? 'marketplace'
                      : route?.sub === 'experimental'
                        ? 'experimental'
                        : route?.sub === 'content'
                          ? 'content'
                          : route?.sub === 'support-guides'
                            ? 'support-guides'
                            : route?.sub === 'support-tickets'
                              ? 'support-tickets'
                              : route?.sub === 'docs'
                                ? 'docs'
                                : route?.sub === 'users'
                                  ? 'users'
                                  : route?.sub === 'stripe'
                                    ? 'stripe'
                                    : route?.sub === 'stripe-products'
                                      ? 'stripe-products'
                                      : route?.sub === 'samsic-crm'
                                        ? 'samsic-crm'
                                        : // Demos pillar (promoted out of Marketing). Three sub-sections:
                                          // list (catalog), invite (send form), sent (audit). Legacy routes
                                          // (`marketing-demo`, `demo`) resolve to the Invite tab so any
                                          // emailed/bookmarked link still lands on the send-a-bundle form.
                                          route?.sub === 'demos-list'
                                          ? 'demos-list'
                                          : route?.sub === 'demos-sent'
                                            ? 'demos-sent'
                                            : route?.sub === 'demos-invite' ||
                                                route?.sub === 'demo' ||
                                                route?.sub === 'marketing-demo'
                                              ? 'demos-invite'
                                              : route?.sub === 'marketing-promo'
                                                ? 'marketing-promo'
                                                : route?.sub === 'marketing-sales'
                                                  ? 'marketing-sales'
                                                  : route?.sub === 'pricing'
                                                    ? 'pricing'
                                                    : route?.sub === 'team-activity'
                                                      ? 'team-activity'
                                                      : route?.sub === 'internal-status'
                                                        ? 'internal-status'
                                                        : route?.sub === 'internal-translations'
                                                          ? 'internal-translations'
                                                          : 'tenants';

  // Route guard: if the user typed a URL for a section their tier
  // can't see, soft-redirect to Tenants (visible to every tier
  // including Normal User). Prevents direct-URL bypass of the sidebar
  // gating without throwing in their face.
  const finalSection = visibleSectionIds.has(activeSection) ? activeSection : 'tenants';

  return (
    <div
      className="screen-h"
      style={{
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        color: 'var(--text)',
      }}
    >
      <PlatformTopBar session={session} />
      {/* Viewport-fixed Adaptiv wordmark — literal match for the
          platform sign-in page's wordmark position (PlatformAuth.jsx
          LeftWordmarkWhite at `bottom: 48, left: 44`). Renders on top
          of the sidebar's empty bottom-left area so the brand stays in
          the same place across signed-out → signed-in surfaces.
          pointerEvents: none so the sidebar's clickable area underneath
          is unaffected. */}
      <PlatformWordmark />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <PlatformSidebar activeSection={finalSection} pillars={visiblePillars} />
        <main style={{ flex: 1, overflow: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <PlatformSubNav activeSection={finalSection} pillars={visiblePillars} />
          {finalSection === 'audit' ? (
            <PlatformAuditPage />
          ) : finalSection === 'marketplace' ? (
            <PlatformMarketplacePage />
          ) : finalSection === 'ads' ? (
            <PlatformAdsPage />
          ) : finalSection === 'costs' ? (
            <PlatformCostsPage />
          ) : finalSection === 'catalog' ? (
            <PlatformCatalogPage />
          ) : finalSection === 'inventory' ? (
            <PlatformInventoryPage />
          ) : finalSection === 'fleet' ? (
            <PlatformFleetPage />
          ) : finalSection === 'device-keys' ? (
            <PlatformDeviceKeysPage />
          ) : finalSection === 'experimental' ? (
            <PlatformExperimentalPage />
          ) : finalSection === 'content' ? (
            <PlatformContentPage />
          ) : finalSection === 'performance' ? (
            <PlatformPerformancePage />
          ) : finalSection === 'support-guides' ? (
            <PlatformSupportGuidesPage />
          ) : finalSection === 'docs' ? (
            <PlatformDocsPage />
          ) : finalSection === 'support-tickets' ? (
            <PlatformSupportTicketsPage />
          ) : finalSection === 'users' ? (
            <PlatformUsersPage />
          ) : finalSection === 'stripe' ? (
            <PlatformStripePage />
          ) : finalSection === 'stripe-products' ? (
            <PlatformStripeProductsPage />
          ) : finalSection === 'samsic-crm' ? (
            <PlatformSamsicCrmPage />
          ) : finalSection === 'team-activity' ? (
            <PlatformTeamActivityPage />
          ) : finalSection === 'internal-status' ? (
            <PlatformStatusPage />
          ) : finalSection === 'internal-translations' ? (
            <PlatformTranslationsPage />
          ) : finalSection === 'demos-list' ? (
            <PlatformDemosListPage />
          ) : finalSection === 'demos-sent' ? (
            <PlatformDemosSentPage />
          ) : finalSection === 'demos-invite' ? (
            <PlatformDemoPage />
          ) : finalSection === 'marketing-promo' ? (
            <PlatformPromoCodesPage />
          ) : finalSection === 'marketing-sales' ? (
            <PlatformSalesPage />
          ) : finalSection === 'pricing' ? (
            <PlatformPricingPage />
          ) : route?.tenantId ? (
            <PlatformTenantDetailPage tenantId={route.tenantId} />
          ) : (
            <PlatformTenantsPage />
          )}
        </main>
      </div>
    </div>
  );
}

function PlatformTopBar({ session }) {
  const t = useT();
  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 20px',
        // borderBottom intentionally removed — matches the customer-app
        // pattern where the icon bar's vertical wordmark + topbar form
        // one continuous brand surface (see PRs #141-#155).
        background: 'color-mix(in oklch, var(--surface) 80%, transparent)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      }}
    >
      {/* EXCALIBUR wordmark — gradient-filled text using the same brand
          ramp as the vertical Adaptiv wordmark (pink → indigo). This is
          the back-office's own brand mark; the customer Merlin app
          carries the Adaptiv wordmark instead. */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 1.2,
            lineHeight: 1,
            display: 'inline-block',
            background: 'linear-gradient(135deg, #FF00B2, #20286D)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          }}
        >
          EXCALIBUR
        </div>
      </div>
      {/* No "Back to workspace" link — customer and platform have
          isolated Supabase sessions (see supabase.js). Crossing surfaces
          requires a full URL navigation, not an in-app button. */}
      {session && (
        <FloatingMenu
          icon={<AdaptivAIcon />}
          currentPath={typeof window !== 'undefined' ? window.location.pathname : ''}
          items={[
            { label: 'Tenants', href: '/platform/tenants' },
            { label: 'Users', href: '/platform/users' },
            { label: 'Logins', href: '/platform/team-activity' },
            { label: 'Stripe', href: '/platform/stripe' },
            { label: 'Audit', href: '/platform/audit' },
          ]}
          cta={{ label: 'Open dashboard', href: '/platform/overview' }}
          positionStyle={{ position: 'relative', top: 'auto', right: 'auto', width: 47, height: 47, marginTop: 31 }}
          panelPositionStyle={{ top: 80 }}
          eyebrow="// Platform"
          headerSlot={<UserAccountCard session={session} t={t} />}
        />
      )}
    </header>
  );
}

// User profile card rendered inside the FloatingMenu's popup. Shows
// picture (or initial fallback), display name, email, and a sign-out
// button. Replaces the previous inline user info + sign-out chevron
// that lived in the top-right of the platform header — same actions,
// now consolidated into the menu popup so the header chrome is just
// the brand block + the floating button.
function UserAccountCard({ session, t }) {
  const handleSignOut = async () => {
    // Full page navigation after signOut so supabase.js re-bootstraps
    // with the platform storageKey and the user lands on
    // PlatformLoginPage (not the Merlin customer login). See
    // supabase.js for the session-isolation rationale.
    await doLogout();
    window.location.assign('/platform');
  };
  return (
    <div
      style={{
        padding: '12px 20px 16px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: session.picture ? 'var(--surface-2)' : undefined,
          backgroundImage: session.picture ? `url(${session.picture})` : 'linear-gradient(135deg, #FF00B2, #20286D)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {!session.picture && initialsOf(session.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {session.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            fontFamily: 'var(--mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {session.email}
        </div>
      </div>
      <button
        onClick={handleSignOut}
        title={t('platform.signout_title')}
        style={{
          flexShrink: 0,
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--risk)',
          background: 'transparent',
          border: '1px solid color-mix(in oklch, var(--risk) 32%, transparent)',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {t('platform.signout_title')}
      </button>
    </div>
  );
}

// Horizontal pill-row sub-nav rendered at the top of the main content
// area. Shows the items of the active pillar so users can hop between
// them without going back to the rail. Hidden when the active pillar
// has only one item (no second-level navigation needed — OVERVIEW and
// SUPPORT today). Style mirrors the OPERATE sub-nav strip in
// Operations.jsx so the navigation language is consistent across the
// customer + platform shells.
function PlatformSubNav({ activeSection, pillars = PILLARS }) {
  const t = useT();
  const pillar = pillarForSection(activeSection, pillars);
  if (!pillar || pillar.items.length <= 1) return null;
  return (
    <div
      style={{
        height: 40,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 20px',
        background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          fontWeight: 700,
        }}
      >
        {t(pillar.labelKey)}
      </span>
      <Icon.chevR size={9} style={{ color: 'var(--text-faint)' }} />
      <div
        style={{
          display: 'flex',
          gap: 2,
          background: 'var(--surface-2)',
          padding: 2,
          borderRadius: 7,
          border: '1px solid var(--border)',
        }}
      >
        {pillar.items.map((s) => {
          const IconC = Icon[s.icon] || Icon.grid;
          const active = s.id === activeSection;
          return (
            <button
              key={s.id}
              onClick={() => navigateTo(s.path)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 600,
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-dim)',
                border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                borderRadius: 5,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <IconC size={11} />
              {t(s.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Icon-only left rail — mirrors the customer-app sidebar (Sidebar.jsx,
// collapsed variant). 52px wide, glassy backdrop, one icon per PILLAR
// (not per item). Clicking a pillar jumps to its first item; the active
// pillar is whichever one contains activeSection. Sub-items render as a
// horizontal pill-row above the page body — see PlatformSubNav.
// Vertical Adaptiv wordmark anchored to the bottom via marginTop:auto +
// the same CSS-mask + gradient pattern as Sidebar.jsx.
function PlatformSidebar({ activeSection, pillars = PILLARS }) {
  const t = useT();
  const activePillarId = pillarForSection(activeSection, pillars).id;
  return (
    <aside
      style={{
        width: 196,
        flexShrink: 0,
        // Floating-card sidebar — tight against the topbar above, with
        // 12px breathing room on the other three sides. JB asked for the
        // EXCALIBUR wordmark to sit close to the sidebar's top edge
        // 2026-05-22, so top margin is 2 (just enough to keep the
        // rounded corner visible) while right/bottom/left preserve the
        // "lifted card" look.
        margin: '2px 12px 12px 12px',
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'color-mix(in oklch, var(--surface) 80%, transparent)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        boxShadow: '0 6px 24px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 10px 12px',
        gap: 2,
        overflow: 'hidden',
      }}
    >
      {pillars.map((p) => {
        const IconC = Icon[p.icon] || Icon.sparkle;
        const active = p.id === activePillarId;
        // Clicking a pillar lands on its first item's path. The sub-nav
        // strip then makes the rest of the items in that pillar reachable.
        const landing = p.items[0]?.path || '/platform';
        return (
          <button
            key={p.id}
            onClick={() => navigateTo(landing)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              fontSize: 13,
              fontWeight: active ? 700 : 600,
              background: active ? 'var(--accent-soft)' : 'transparent',
              color: active ? 'var(--accent-pink)' : 'var(--text)',
              border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
              borderRadius: 8,
              cursor: 'pointer',
              textAlign: 'left',
              minHeight: 36,
            }}
          >
            <IconC size={16} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t(p.labelKey)}
            </span>
          </button>
        );
      })}

      {/* Wordmark moved out of the sidebar — now rendered as a
          viewport-fixed element by <PlatformWordmark /> in PlatformApp,
          at the exact position used by the platform sign-in page. */}
    </aside>
  );
}

// Viewport-fixed Adaptiv wordmark matching the platform sign-in page's
// position + size exactly (PlatformAuth.jsx:LeftWordmarkWhite anchors
// at bottom:48, left:44). Lives outside the sidebar's flex column so
// the wordmark is positioned against the viewport directly — no flex /
// padding / clamp-vs-overflow surprises. pointerEvents:none so the
// sidebar's clickable area underneath is unaffected.
function PlatformWordmark() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 48,
        left: 44,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 'clamp(60px, 9.6vh, 96px)',
          height: 'clamp(200px, 32vh, 320px)',
          marginLeft: -12,
        }}
      >
        <div
          role="img"
          aria-label="Adaptiv"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 'clamp(200px, 32vh, 320px)',
            height: 'clamp(60px, 9.6vh, 96px)',
            transform: 'translate(-50%, -50%) rotate(-90deg)',
            transformOrigin: 'center center',
            background: 'linear-gradient(135deg, #FF00B2, #20286D)',
            maskImage: `url(${WORDMARK_URL})`,
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskImage: `url(${WORDMARK_URL})`,
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
          }}
        />
      </div>
    </div>
  );
}
