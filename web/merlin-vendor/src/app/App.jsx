// Top-level app: window chrome, state wiring, tweaks, bold-variant theme
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Icon } from './icons.jsx';
import { LazyFallback, LazyChunkBoundary, MacWindowChrome, ShellFrame } from './AppShell.jsx';
import { TopBar } from './TopBar.jsx';
import { AuthedRoutes } from './AuthedRoutes.jsx';
import { BUILDINGS, AGENTS, TEAM, SLAS, CONVERSATIONS } from './data.js';
import { ROLES, filterIncidentsForRole, filterSlasForRole, filterAgentsForRole } from './roles.js';
import { useAppData } from './simulator.js';
import { useSimulatorEventsBridge } from './simulator-events-bridge.js';
import { useReplayIncidents } from './replay-incidents.js';
import { useApplyBranding } from './branding-data.js';
import { Sidebar } from './Sidebar.jsx';
import { AdaptivLoader } from './primitives.jsx';
import { useBuildingsForActiveOrg } from './custom-locations.js';

// Tier 2.1 of engineering-maturity.md — route-isolated heavy pages
// are lazy-loaded so the cold-load bundle drops. Each becomes its own
// chunk that Vite generates at build time. Named exports get
// wrapped in `.then(m => ({ default: m.X }))` because React.lazy only
// understands default exports.
const PrintReportPage = lazy(() => import('./PrintReportPage.jsx').then((m) => ({ default: m.PrintReportPage })));
const PrintGuidePage = lazy(() => import('./PrintGuidePage.jsx').then((m) => ({ default: m.PrintGuidePage })));
const CheckoutResultPage = lazy(() =>
  import('./CheckoutResultPage.jsx').then((m) => ({ default: m.CheckoutResultPage })),
);
import { ChatPanel } from './Chat.jsx';
import { TweaksPanel } from './Tweaks.jsx';
import { useT, setLanguage, getLanguage, didUserChooseLanguage } from './i18n.js';
import { CommandPalette, useCommandPalette } from './CommandPalette.jsx';
import { WelcomeModal } from './WelcomeModal.jsx';
import { LoginPage, SignupPage, ResetPasswordPage, PasswordRecoveryPage } from './Auth.jsx';
import { MaintenancePage } from './MaintenancePage.jsx';
import { useMaintenanceMode, useMyDayHidden } from './platform-settings.js';
import { useSession, useRecoveryMode, logout as doLogout, onInviteOutcome, updatePreferences } from './auth.js';
import { supabase } from './supabase.js';
import { useActiveOrg, useIsOrgAdmin } from './org-data.js';
import { personaOf, PERSONAS } from './personas.js';
import { isMobileSurface } from './mobile-surface.js';
import { useAgentRuntimeStats, useLatestAgentActions } from './agent-runs.js';
import {
  useRoute,
  navigateTo,
  matchDeviceRoute,
  matchPlatformRoute,
  matchPrintReportRoute,
  matchPrintGuideRoute,
  matchCheckoutRoute,
  matchPricingRoute,
  matchPricingContactRoute,
} from './use-route.js';
import { PricingPage } from './Pricing.jsx';
import { PricingContactPage } from './PricingContact.jsx';
// ContractorApp shell is retired. Contractor managers now use the
// main shell with the Operations → Contracts sub-page (see
// Operations.jsx). The ContractsPage component still lives in
// ContractorApp.jsx and is imported there.
// Both shells are lazy — WorkerApp is only loaded for worker-role
// users, PlatformApp only for is_platform_admin. Keeping them out
// of the cold-load chunk saves ~700KB for the typical FM user.
const WorkerApp = lazy(() => import('./WorkerApp.jsx').then((m) => ({ default: m.WorkerApp })));
// Merlin Mobile — the phone-first worker app. Loaded only on the mobile surface
// (mobile.adaptiv.systems, or the `?mobile=1` spike flag). See mobile-surface.js
// and docs/architecture/mobile-worker-app.md.
const MobileApp = lazy(() => import('./MobileApp.jsx'));
const PlatformApp = lazy(() => import('./PlatformApp.jsx').then((m) => ({ default: m.PlatformApp })));
import { PlatformLoginPage, PlatformAccessDenied } from './PlatformAuth.jsx';
import { SuspendedOrgPage } from './SuspendedOrg.jsx';
import { FirstRunEmpty } from './FirstRunEmpty.jsx';
import { DocsPage } from './DocsPage.jsx';
import {
  useLocalizedIncidents,
  useLocalizedIncident,
  useLocalizedAgents,
  useLocalizedSlas,
  useLocalizedConversations,
} from './localized-data.js';

export default function App() {
  const session = useSession();
  const recoveryMode = useRecoveryMode();
  const path = useRoute();
  const platformRoute = matchPlatformRoute(path);
  // Light white-label (migration 133). Applies the tenant's accent
  // color + favicon when branding_enabled. /platform/* surfaces are
  // skipped inside the hook — Adaptiv staff always see Adaptiv branding.
  // The returned object is consumed by the Sidebar wordmark.
  useApplyBranding();
  const [authView, setAuthView] = useState('login');
  const [tweaks, setTweaks] = useState(window.__MERLIN_TWEAKS__);
  const [inviteBanner, setInviteBanner] = useState(null); // { ok, error }
  // Maintenance mode kill switch (Merlin Owner sets via /platform/experimental).
  // When ON: pre-signin shows MaintenancePage instead of auth form;
  // signed-in users get force-signed-out unless they're Adaptiv staff
  // (Merlin Owner OR any platform admin — same exemption the gate
  // below applies). The Owner reaches /platform/experimental directly
  // to disable maintenance.
  //
  // Staff bypass for the auth form: visiting /?staff=1 reveals the
  // LoginPage during maintenance so Adaptiv staff can sign back into
  // the customer Merlin app to make changes mid-window. The URL only
  // unhides the form — the actual access decision still runs through
  // the post-signin gate below, which checks isPlatformAdmin server-
  // validated. Stashed in sessionStorage so it survives the auth
  // re-renders even if the URL gets cleaned.
  const maintenance = useMaintenanceMode();
  const staffBypass = useStaffBypass();

  useEffect(() => {
    const onUpdate = (next) => setTweaks({ ...next });
    window.__MERLIN_LISTENERS__.add(onUpdate);
    return () => window.__MERLIN_LISTENERS__.delete(onUpdate);
  }, []);

  // Phase 11d: invite outcomes from ?invite=<token> flow bubble up here.
  useEffect(() => {
    return onInviteOutcome((outcome) => {
      setInviteBanner(outcome);
      // Auto-dismiss successes after a few seconds; keep errors pinned.
      if (outcome.ok) setTimeout(() => setInviteBanner(null), 5000);
    });
  }, []);

  useEffect(() => {
    const b = document.body;
    b.classList.toggle('dark', tweaks.theme === 'dark');
    b.classList.toggle('bold-variant', tweaks.variant === 'bold');
  }, [tweaks.theme, tweaks.variant]);

  useEffect(() => {
    if (!session) {
      setAuthView('login');
      // Clear the once-per-session Locations landing flag so the next sign-in
      // lands on the picker again (when the user has multiple locations).
      try {
        sessionStorage.removeItem('merlin-landed');
      } catch {
        /* noop */
      }
    }
  }, [session]);

  // Maintenance enforcement on existing sessions. If a non-staff user
  // is signed in when maintenance flips on, sign them out so the next
  // render hits the gated `if (!session)` branch and they see the
  // maintenance page. Adaptiv staff (Merlin Owner + any platform
  // admin) stay signed in — they need access to the app during the
  // window. Skipped on /platform routes so the back-office stays
  // reachable for ops.
  useEffect(() => {
    if (!maintenance.ready || !maintenance.enabled) return;
    if (!session) return;
    if (session.isMerlinOwner || session.isPlatformAdmin) return;
    if (platformRoute) return;
    // PR #687: the ?staff=1 URL flag now also exempts an existing
    // signed-in session from force-logout. Previously the bypass
    // only revealed the login form pre-signin — if your account
    // wasn't isMerlinOwner / isPlatformAdmin you'd sign in, get
    // kicked out a tick later, redirected to login, repeat. JB hit
    // this and couldn't get back in.
    if (staffBypass) return;
    import('./auth.js').then(({ logout }) => {
      logout();
    });
  }, [maintenance.ready, maintenance.enabled, session, platformRoute, staffBypass]);

  // Pricing-page CTAs (Phase A of the 3-plan rollout) navigate to
  // /?signup=1&plan=…&audience=…. Auto-open the SignupPage when the
  // signup=1 hint is present, and stash plan/audience in
  // sessionStorage for the SignupPage to read in Phase B. Watching
  // `path` (not `[]`) means in-app navigations from /pricing also
  // trigger the swap, not just first-page-load arrivals from a
  // bookmark.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('signup') === '1') {
      setAuthView('signup');
      const plan = sp.get('plan');
      const audience = sp.get('audience');
      const promo = sp.get('promo');
      if (plan) sessionStorage.setItem('merlin-intended-plan', plan);
      if (audience) sessionStorage.setItem('merlin-intended-audience', audience);
      if (promo) sessionStorage.setItem('merlin-intended-promo', promo);
    }
  }, [path]);

  const banner = inviteBanner && <InviteBanner outcome={inviteBanner} onClose={() => setInviteBanner(null)} />;

  // Recovery mode takes precedence — the user just clicked the email
  // link and has a temporary session, but must set a new password
  // before seeing the app. (Applies to both customer + platform users
  // since they share the Supabase auth pool.)
  if (recoveryMode) {
    return (
      <>
        {banner}
        <PasswordRecoveryPage tweaks={tweaks} onDone={() => setAuthView('login')} />
      </>
    );
  }

  // Public pricing page (Phase A of the 3-plan rollout). No auth
  // required — anyone can land on /pricing and see the cards without
  // a session. CTAs route them onward to signup (with ?plan + ?audience
  // params that Phase B will read).
  if (matchPricingContactRoute(path)) {
    return (
      <>
        {banner}
        <PricingContactPage />
      </>
    );
  }
  if (matchPricingRoute(path)) {
    return (
      <>
        {banner}
        <PricingPage />
      </>
    );
  }

  // SaaS v1, phase 6.5: /platform is its own UX surface with its own
  // login. Detection happens before the customer auth path so visiting
  // /platform while signed-out shows the back-office login (not the
  // Merlin customer login). Signed-in but not platform_admin → the
  // dedicated AccessDenied surface so wrong-account clicks are
  // recoverable. The takeover wins early so AuthedApp's customer-app
  // bootstraps (active org, simulator, etc) don't run for back-office
  // users.
  if (platformRoute) {
    if (!session)
      return (
        <>
          {banner}
          <PlatformLoginPage />
        </>
      );
    if (!session.isPlatformAdmin)
      return (
        <>
          {banner}
          <PlatformAccessDenied session={session} />
        </>
      );
    return (
      <>
        {banner}
        <LazyChunkBoundary>
          <Suspense fallback={<LazyFallback />}>
            <PlatformApp />
          </Suspense>
        </LazyChunkBoundary>
      </>
    );
  }

  // Print-friendly contract report (Phase 8.6). Renders chrome-less
  // so the browser's Print dialog produces a clean PDF. RLS gates
  // the actual fetch — both contract parties read; everyone else
  // gets a "Couldn't load report" surface.
  const printReportId = matchPrintReportRoute(path);
  if (printReportId) {
    if (!session)
      return (
        <>
          {banner}
          <LoginPage
            tweaks={tweaks}
            hasPendingInvite={false}
            onAuthed={() => {}}
            onSwitchToSignup={() => setAuthView('signup')}
            onSwitchToReset={() => setAuthView('reset')}
          />
        </>
      );
    return (
      <LazyChunkBoundary>
        <Suspense fallback={<LazyFallback />}>
          <PrintReportPage reportId={printReportId} />
        </Suspense>
      </LazyChunkBoundary>
    );
  }

  // Print-friendly user guide. Markdown bodies are bundled at build
  // time via `?raw` imports — no DB fetch, no auth requirement. We
  // still gate behind a session because the in-platform launching
  // surface assumes a signed-in admin context.
  const printGuideSlug = matchPrintGuideRoute(path);
  if (printGuideSlug) {
    if (!session)
      return (
        <>
          {banner}
          <LoginPage
            tweaks={tweaks}
            hasPendingInvite={false}
            onAuthed={() => {}}
            onSwitchToSignup={() => setAuthView('signup')}
            onSwitchToReset={() => setAuthView('reset')}
          />
        </>
      );
    return (
      <LazyChunkBoundary>
        <Suspense fallback={<LazyFallback />}>
          <PrintGuidePage slug={printGuideSlug} />
        </Suspense>
      </LazyChunkBoundary>
    );
  }

  // Stripe Checkout success / cancel return targets (Phase 8.13).
  // /checkout/success polls device_orders.paid_at; /checkout/cancel
  // surfaces the abandoned state + offers to resume. Both require a
  // session because they read tenant data — RLS gates the actual read.
  const checkoutMatch = matchCheckoutRoute(path);
  if (checkoutMatch) {
    if (!session)
      return (
        <>
          {banner}
          <LoginPage
            tweaks={tweaks}
            hasPendingInvite={false}
            onAuthed={() => {}}
            onSwitchToSignup={() => setAuthView('signup')}
            onSwitchToReset={() => setAuthView('reset')}
          />
        </>
      );
    return (
      <LazyChunkBoundary>
        <Suspense fallback={<LazyFallback />}>
          <CheckoutResultPage kind={checkoutMatch.kind} orderId={checkoutMatch.orderId} flow={checkoutMatch.flow} />
        </Suspense>
      </LazyChunkBoundary>
    );
  }

  // Maintenance hydration gate. By this point we're past every
  // route that's exempt from maintenance (/platform, /pricing, print,
  // checkout). For everything else, rendering before we know the
  // maintenance state flashes the LoginPage or AuthedApp surface
  // before the gate kicks in (JB hit this on every fresh load while
  // maintenance was ON — login form for ~200ms, then maintenance
  // page). Pin to a blank surface in the same palette as
  // MaintenancePage so the eventual transition is seamless.
  if (!maintenance.ready) {
    return (
      <>
        {banner}
        <div style={{ minHeight: '100vh', width: '100vw', background: '#f4f6fa' }} />
      </>
    );
  }

  if (!session) {
    const hasPendingInvite = typeof window !== 'undefined' && !!sessionStorage.getItem('merlin-pending-invite');
    // Maintenance gate: when the Merlin Owner has enabled maintenance
    // mode, show the MaintenancePage instead of the auth form.
    // Adaptiv staff can bypass the gate with ?staff=1 in the URL —
    // that surfaces the LoginPage so they can sign back in mid-window
    // (post-signin gate still validates platform admin status).
    if (maintenance.enabled && !staffBypass) {
      return (
        <>
          {banner}
          <MaintenancePage customMessage={maintenance.message} />
        </>
      );
    }
    if (authView === 'signup') {
      return (
        <>
          {banner}
          <SignupPage
            tweaks={tweaks}
            hasPendingInvite={hasPendingInvite}
            onAuthed={() => {}}
            onSwitchToLogin={() => setAuthView('login')}
          />
        </>
      );
    }
    if (authView === 'reset') {
      return (
        <>
          {banner}
          <ResetPasswordPage tweaks={tweaks} onSwitchToLogin={() => setAuthView('login')} />
        </>
      );
    }
    return (
      <>
        {banner}
        <LoginPage
          tweaks={tweaks}
          hasPendingInvite={hasPendingInvite}
          onAuthed={() => {}}
          onSwitchToSignup={() => setAuthView('signup')}
          onSwitchToReset={() => setAuthView('reset')}
        />
      </>
    );
  }

  // Maintenance gate for signed-in non-staff. The async useEffect at
  // the top of AppShell will eventually sign them out — but until
  // logout() completes a tick later, AuthedApp would render and briefly
  // leak the app surface (e.g. My day flashes before the gate kicks in).
  // Cut it off at render time so non-staff see MaintenancePage
  // immediately. Adaptiv staff (Merlin Owner + any platform admin)
  // are exempt so they can keep working through the window. The
  // hydration gate above guarantees maintenance.ready is true here.
  // /platform routes are already short-circuited above.
  if (maintenance.enabled && !session.isMerlinOwner && !session.isPlatformAdmin && !staffBypass) {
    return (
      <>
        {banner}
        <MaintenancePage customMessage={maintenance.message} />
      </>
    );
  }

  return (
    <>
      {banner}
      <AuthedAppWithLifecycleGate session={session} />
    </>
  );
}

// Staff bypass for the maintenance-mode pre-signin gate. Visiting
// /?staff=1 (anywhere on the customer Merlin domain) flips this on so
// the LoginPage renders instead of MaintenancePage. Stashed in
// sessionStorage so it survives the auth re-renders and any URL
// cleanup. Wiped on full tab close, which is the right scope — staff
// who want access mid-window can re-add ?staff=1 if they reopen.
//
// This is intentionally NOT a privilege grant: the post-signin gate
// still checks isMerlinOwner / isPlatformAdmin server-validated, so
// a random visitor with the URL can reveal the form but can't get
// into the app without legitimate credentials.
const STAFF_BYPASS_KEY = 'merlin-staff-bypass';
function useStaffBypass() {
  const [on, setOn] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const fromUrl = new URL(window.location.href).searchParams.get('staff') === '1';
      if (fromUrl) sessionStorage.setItem(STAFF_BYPASS_KEY, '1');
      return fromUrl || sessionStorage.getItem(STAFF_BYPASS_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const fromUrl = new URL(window.location.href).searchParams.get('staff') === '1';
      if (fromUrl) {
        sessionStorage.setItem(STAFF_BYPASS_KEY, '1');
        if (!on) setOn(true);
      }
    } catch {}
  }, [on]);
  return on;
}

// SaaS v1 phase 5: short-circuit the customer shell when the active org
// is suspended. Deleted tenants are filtered out earlier (current_user_org
// + workspace picker), so they never reach this layer.
function AuthedAppWithLifecycleGate({ session }) {
  const activeOrg = useActiveOrg();
  if (activeOrg?.lifecycle_state === 'suspended') {
    return <SuspendedOrgPage org={activeOrg} session={session} />;
  }
  return <AuthedApp session={session} />;
}

function InviteBanner({ outcome, onClose }) {
  const t = useT();
  const ok = !!outcome.ok;
  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        minWidth: 320,
        maxWidth: '90vw',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: ok
          ? 'color-mix(in oklch, var(--ok) 14%, var(--surface))'
          : 'color-mix(in oklch, var(--risk) 14%, var(--surface))',
        border: `1px solid color-mix(in oklch, ${ok ? 'var(--ok)' : 'var(--risk)'} 35%, transparent)`,
        color: ok ? 'var(--ok)' : 'var(--risk)',
        fontSize: 12.5,
        fontWeight: 600,
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      }}
    >
      <Icon.sparkle size={13} />
      <div style={{ flex: 1 }}>{ok ? t('invite.accepted') : outcome.error || t('invite.failed')}</div>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          fontSize: 11,
          fontWeight: 700,
          padding: 2,
        }}
      >
        {t('action.dismiss')}
      </button>
    </div>
  );
}

function AuthedApp({ session }) {
  const [tweaks, setTweaks] = useState(window.__MERLIN_TWEAKS__);
  const [editMode, setEditMode] = useState(window.__MERLIN_EDIT_MODE__);
  // Used by the Agentic render-dispatch ternary below; UserMenu has
  // its own copy via the same hook for the menu-item gate.
  const isOrgAdmin = useIsOrgAdmin();

  useEffect(() => {
    const onUpdate = (next) => {
      setTweaks({ ...next });
      setEditMode(window.__MERLIN_EDIT_MODE__);
    };
    window.__MERLIN_LISTENERS__.add(onUpdate);
    return () => window.__MERLIN_LISTENERS__.delete(onUpdate);
  }, []);

  // Lock role to the signed-in user's persona — role is no longer user-switchable.
  useEffect(() => {
    if (session?.role && tweaks.role !== session.role) {
      try {
        window.setMerlinTweaks({ role: session.role });
      } catch {}
    }
  }, [session?.role, tweaks.role]);

  // Apply the user's saved appearance preferences (theme/accent/density/
  // variant/sidebar) on session load so each login lands in the last-
  // picked look. Language is applied separately via i18n.
  const appliedPrefsFor = React.useRef(null);
  useEffect(() => {
    if (!session?.email) return;
    if (appliedPrefsFor.current === session.email) return;
    const prefs = session.preferences;
    if (prefs) {
      const edits = {};
      for (const k of ['theme', 'accent', 'density', 'sidebar', 'variant']) {
        if (prefs[k] !== undefined) edits[k] = prefs[k];
      }
      // default_building_id: lets a freshly-created demo persona land
      // on a specific building instead of HQ (warehouse + healthcare
      // demos use this — see api/demos/send.ts PREFERRED_BUILDING_BY_DEMO).
      // Maps from preferences shape to tweaks.building. Only seeded on
      // the first session-load via the appliedPrefsFor ref, so the
      // BuildingSwitcher can override on subsequent clicks.
      if (prefs.default_building_id) {
        edits.building = prefs.default_building_id;
      }
      if (Object.keys(edits).length) {
        try {
          window.setMerlinTweaks(edits);
        } catch {}
      }
      // Language: a user's saved preference (profiles.preferences.language) is
      // the source of truth and applies on login — so a French tenant lands in
      // French on a fresh browser. The ONLY thing that overrides it is an
      // active on-screen choice this page-load (the login-page or Settings
      // picker, tracked via didUserChooseLanguage()); that wins and syncs the
      // profile. With no explicit choice and no saved preference, seed the
      // profile from the detected/default language.
      const browserLang = (() => {
        try {
          return getLanguage();
        } catch {
          return null;
        }
      })();
      const chose = (() => {
        try {
          return didUserChooseLanguage();
        } catch {
          return false;
        }
      })();
      if (chose && browserLang && browserLang !== prefs.language) {
        try {
          updatePreferences({ language: browserLang });
        } catch {}
      } else if (prefs.language) {
        try {
          setLanguage(prefs.language, { fromUser: false });
        } catch {}
      } else if (browserLang) {
        try {
          updatePreferences({ language: browserLang });
        } catch {}
      }
    }
    appliedPrefsFor.current = session.email;
  }, [session?.email, session?.preferences]);

  useEffect(() => {
    const b = document.body;
    b.classList.toggle('dark', tweaks.theme === 'dark');
    b.classList.toggle('compact', tweaks.density === 'compact');
    b.classList.toggle('bold-variant', tweaks.variant === 'bold');

    const accentMap = { pink: '#FF00B2', indigo: '#20286D', blue: '#2185D0' };
    document.documentElement.style.setProperty('--accent', accentMap[tweaks.accent] || accentMap.pink);
    // Sidebar is always the 52px icon rail now — the full agent-bar
    // mode + hidden mode were retired. The CSS variable still feeds
    // a couple of legacy layouts that expect the value to exist.
    document.documentElement.style.setProperty('--sidebar-w', '52px');
  }, [tweaks]);

  // Chat pane is open by default; user toggles persist across reloads.
  const [chatOpen, setChatOpen] = useState(() => {
    try {
      return localStorage.getItem('merlinChatOpen') !== '0';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('merlinChatOpen', chatOpen ? '1' : '0');
    } catch {}
  }, [chatOpen]);
  const [seededQuery, setSeededQuery] = useState(null);
  // When a caller opens the chat with { send: true } (e.g. a Forecast card),
  // the seeded query is auto-sent instead of just prefilling the composer —
  // otherwise the click reads as dead when the panel is already docked open.
  const [seededSend, setSeededSend] = useState(false);
  // Open the chat straight into an inline, actionable decisions list (Decisions bubble).
  const [seededDecisions, setSeededDecisions] = useState(false);
  const [activeConvId, setActiveConvId] = useState('c1');
  const [view, setView] = useState(() => localStorage.getItem('merlinView') || 'briefing');
  // Land on the Locations picker once per browser-tab session (the
  // 'merlin-landed' flag is cleared on logout by the outer App) when the user
  // has more than one location — rather than dropping them into one building's
  // My Day arbitrarily. Mount-time + sessionStorage rather than a SIGNED_IN hook
  // because AuthedApp REMOUNTS on login, so the auth-event subscription misses
  // the sign-in. Pending only on a fresh login / first load; reloads (flag
  // already set) keep the user on their persisted view.
  const landingPendingRef = useRef(
    typeof sessionStorage === 'undefined' ? true : !sessionStorage.getItem('merlin-landed'),
  );

  // PR #658: every fresh sign-in lands on My Day with Merlin chat
  // open. localStorage still preserves in-session navigation (refresh
  // keeps you where you are), but a SIGNED_IN event — i.e. the user
  // just entered credentials — resets the surface so it's always the
  // operator inbox they meet first. Subscribing here (vs an
  // onSignedIn helper in auth.js) keeps the policy co-located with
  // the state it mutates.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setView('briefing');
        setChatOpen(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Founder kill switch: when My Day is hidden platform-wide
  // (platform_settings 'myday_hidden', toggled from /platform/experimental),
  // the briefing tab is dropped from the sub-nav AND anyone who lands on it
  // (default landing, saved view, or the SIGNED_IN reset above) is bounced to
  // Now so the hidden surface is never reachable.
  const myDayHidden = useMyDayHidden().hidden;
  useEffect(() => {
    if (myDayHidden && view === 'briefing') setView('now');
  }, [myDayHidden, view]);

  // PR #660: scrollbar visibility driven by actual scroll events, not
  // hover. The prior CSS-only approach (PR #656) lit up the page
  // scrollbar whenever the cursor crossed the page — including while
  // interacting with the 3D viewer. Now we toggle a body class on
  // scroll (capture phase catches every scrollable element) and let
  // CSS show the thumb only while the class is on. ~800ms tail so
  // the thumb fades smoothly after the last scroll wheel tick.
  useEffect(() => {
    let timer = null;
    const onScroll = () => {
      document.body.classList.add('is-scrolling');
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        document.body.classList.remove('is-scrolling');
      }, 800);
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      if (timer) clearTimeout(timer);
    };
  }, []);

  const [dashRequest, setDashRequest] = useState(null);
  // Deep-link payloads for cross-page navigation. Each carries an `at`
  // timestamp so re-firing the same target re-triggers downstream
  // effects (StrictMode-safe). callsRequest seeds the Calls for action
  // page filter; agenticRequest opens Agentic on a specific agent.
  const [callsRequest, setCallsRequest] = useState(null);
  const [agenticRequest, setAgenticRequest] = useState(null);
  // Agent detail view — clicking an agent card body on Dashboard
  // routes here. Plain string of the agent id; null when the
  // top-level view isn't 'agent-detail'.
  const [agentDetailId, setAgentDetailId] = useState(null);
  // Deep-link target for the customer Admin page. AgentsPanel's
  // "Unlock more agents" CTA seeds this to 'agents' before flipping
  // view → 'admin'. AdminPage reads it once on mount and clears.
  const [adminSection, setAdminSection] = useState(null);
  const [routedIncidentId, setRoutedIncidentId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Global ⌘K / Ctrl+K command palette. The hook installs the keydown
  // listener once and exposes a stable open/setOpen pair so the topbar
  // search-bar button can also trigger it.
  const { open: paletteOpen, openPalette, closePalette } = useCommandPalette();
  useEffect(() => {
    localStorage.setItem('merlinView', view);
  }, [view]);
  // Reset routedIncidentId on tab switches BUT skip the case where
  // routedIncidentId was just set in the same batch as the view
  // change (the "open full incident" pattern bundles
  // setRoutedIncidentId + setView('dashboard'); without this guard
  // the effect undid the navigation immediately after).
  // Track last-seen routed id via a ref; if it changed this render,
  // it was just set — bail and update the ref. If it didn't change,
  // this is a real tab switch — clear it.
  const lastRoutedRef = useRef(routedIncidentId);
  useEffect(() => {
    if (routedIncidentId !== lastRoutedRef.current) {
      lastRoutedRef.current = routedIncidentId;
      return;
    }
    if (routedIncidentId != null) {
      setRoutedIncidentId(null);
      lastRoutedRef.current = null;
    }
  }, [view, routedIncidentId]);
  useEffect(() => {
    setSettingsOpen(false);
  }, [view]);

  // Phase J-3: scope the building picker to the active org. If the
  // persisted tweaks.building doesn't exist in the active org's set
  // (demo switched away, building deleted, etc.), auto-correct to the
  // first available building so the UI never lands on a stale id.
  // Wait for DB hydration (__ready) before firing — otherwise the
  // pre-hydration check misses DB-backed buildings and stomps the
  // persisted pick with a static fallback.
  const allBuildings = useBuildingsForActiveOrg();
  const buildingsReady = allBuildings.__ready;
  const tweakBuilding = tweaks.building;
  useEffect(() => {
    if (!buildingsReady) return;
    if (!tweakBuilding) return;
    if (allBuildings[tweakBuilding]) return;
    const ids = Object.keys(allBuildings);
    if (ids.length === 0) return;
    const preferred = ids.find((id) => allBuildings[id].organizationId) || ids[0];
    try {
      window.setMerlinTweaks({ building: preferred });
    } catch {}
  }, [buildingsReady, tweakBuilding, allBuildings]);
  // On a fresh sign-in, once the buildings set is ready: if the user has MORE
  // THAN ONE location, land on the Locations picker so they choose where to
  // work (single-location users stay on the My Day landing). One-shot via the
  // ref — never hijacks later navigation, only the post-login landing.
  // No dep array on purpose: while a sign-in landing is pending, re-check after
  // every render until the active org's buildings have actually populated
  // (post-logout the set is transiently empty / its reference may not change on
  // an in-session login, so dep-tracking would miss it). The one-shot ref makes
  // every other render a cheap early return.
  useEffect(() => {
    if (!landingPendingRef.current || !buildingsReady) return;
    const count = Object.keys(allBuildings).filter((id) => id !== '__ready').length;
    if (count === 0) return; // wait for the org's buildings to populate
    landingPendingRef.current = false;
    try {
      sessionStorage.setItem('merlin-landed', '1');
    } catch {
      /* noop */
    }
    if (count > 1) setView('locations');
  });
  // Fallback chain when the persisted pick isn't in the active org's set
  // (e.g. just switched orgs and tweaks.building is still the prior org's id):
  //   1. the persisted building, if it belongs to the active org
  //   2. the active org's 'hq' (Meridian's canonical default), if present
  //   3. the active org's FIRST real building — critical so we don't fall to
  //      (4) static Meridian HQ on an org that has no 'hq' (e.g. Campus PSG),
  //      which rendered another tenant's building + device counts.
  //   4. static BUILDINGS.hq only as a pre-hydration last resort.
  const orgFallbackId =
    Object.keys(allBuildings)
      .filter((id) => id !== '__ready')
      .find((id) => allBuildings[id]?.organizationId) || Object.keys(allBuildings).filter((id) => id !== '__ready')[0];
  const building =
    allBuildings[tweaks.building] ||
    allBuildings.hq ||
    (orgFallbackId ? allBuildings[orgFallbackId] : null) ||
    BUILDINGS.hq;
  const live = useAppData(building);
  // Phase 1 of events-pipeline.md: every simulator incident also writes
  // a row to public.events for the active org. Fire-and-forget bridge;
  // surfaces still read live.incidents today, but events table will be
  // canonical after phase 3.
  useSimulatorEventsBridge(session?.organizationId, building);
  const role = ROLES[tweaks.role] || ROLES.facility;
  // Replay-mode orgs (Meridian / FEB) source incidents from
  // demo_fixtures.incidents instead of the simulator's HQ-only ticking
  // pool. Keeps Briefing + Dashboard in lockstep with the Activity
  // feed (#446) and stops the simulator's churn from leaking into demo
  // surfaces. Non-replay orgs keep the simulator path unchanged.
  const activeOrg = useActiveOrg();
  const isReplayMode = activeOrg?.replay_mode === true;
  const replayIncidents = useReplayIncidents(isReplayMode ? activeOrg?.id : null);
  const sourceIncidents = isReplayMode ? replayIncidents : live.incidents;
  const filteredIncidents =
    building.kind === 'ecosystem' ? sourceIncidents : filterIncidentsForRole(sourceIncidents, role.id);
  const filteredSlas = filterSlasForRole(SLAS, role.id);
  const filteredAgents = filterAgentsForRole(AGENTS, role.id);

  // K-21: live runtime stats + latest persisted action per agent for the
  // sidebar Agent bar. Two hooks; both module-scope realtime so the
  // sidebar updates without a reload as agents tick. When unset (org
  // hasn't been hydrated yet, or agent has no live data), the sidebar
  // falls back to the static fields.
  const agentRuntime = useAgentRuntimeStats(session?.organizationId);
  const agentLatestActions = useLatestAgentActions(session?.organizationId);

  // L-1.6: deep-linkable device detail route (/device/<external_id>).
  // When the URL matches, the centre pane renders DeviceDetailPage
  // instead of the dashboard / other views. Reload + paste-link both
  // work because we read the path on mount and on browser nav.
  const routePath = useRoute();
  const routedDeviceExternalId = matchDeviceRoute(routePath);

  // French overlay — transparent pass-through when language is English.
  const localIncidents = useLocalizedIncidents(filteredIncidents, building);
  const localAgents = useLocalizedAgents(filteredAgents);
  const localSlas = useLocalizedSlas(filteredSlas);
  const localConvs = useLocalizedConversations(CONVERSATIONS);
  const routedIncidentRaw = localIncidents.find((i) => i.id === routedIncidentId);
  const routedIncident = useLocalizedIncident(routedIncidentRaw, building);

  const openChat = (q, opts) => {
    if (typeof q === 'string') {
      setSeededQuery(q);
      setSeededSend(!!opts?.send);
    }
    if (opts?.decisions) setSeededDecisions(true);
    setChatOpen(true);
  };
  const newChat = () => {
    setSeededQuery(null);
    setSeededSend(false);
    setSeededDecisions(false);
    setChatOpen(true);
  };

  // Listen for cross-component requests to open the chat (e.g. the
  // "Ask pending" pill on an SLA card in Insights). Fires a custom
  // event with optional { tab, focusAskId } so future callers can
  // navigate the chat further; today we just open the panel.
  useEffect(() => {
    const onOpenChat = () => setChatOpen(true);
    window.addEventListener('merlin:open-chat', onOpenChat);
    return () => window.removeEventListener('merlin:open-chat', onOpenChat);
  }, []);

  // Phase G-3a: contractor_manager persona gets a dedicated app shell.
  // G-3b: worker persona does too — the manager shell is irrelevant to
  // crew whose day is a task checklist. Early-return before all the
  // building-selector / sidebar / tabs plumbing fires. Help drawer stays
  // mounted at the root so it works from either alt shell.
  const personaKind = personaOf(session, activeOrg);

  // Merlin Mobile — the phone-first worker surface (mobile.adaptiv.systems, or
  // the `?mobile=1` spike flag). Takes over the whole shell regardless of
  // viewport: its own header, bottom tab bar, and worker-grounded chat. Renders
  // before the building-selector / sidebar / tabs plumbing (none of which the
  // mobile app uses). Self-contained like WorkerApp — reads session/org itself.
  // No ShellFrame: the mobile app owns the full viewport (its own dvh layout).
  if (isMobileSurface()) {
    return (
      <>
        <LazyChunkBoundary>
          <Suspense fallback={<LazyFallback />}>
            <MobileApp />
          </Suspense>
        </LazyChunkBoundary>
        <DocsPage open={helpOpen} onClose={() => setHelpOpen(false)} />
      </>
    );
  }

  // contractor_manager used to take over the entire shell with a
  // Contracts-only dashboard. Now that the contractor surface is
  // a real ops tool (cleaning teams, routes, insights, calls for
  // action), they need the same chrome the facility manager has —
  // Merlin chat, agent bar, top nav. Org-scoped agent config keeps
  // the agent bar narrow to cleaning + supply + compliance, and
  // role-filtered insights keep the rest of the surface tidy.
  if (personaKind === PERSONAS.WORKER) {
    return (
      <>
        <ShellFrame session={session}>
          <LazyChunkBoundary>
            <Suspense fallback={<LazyFallback />}>
              <WorkerApp onOpenHelp={() => setHelpOpen(true)} />
            </Suspense>
          </LazyChunkBoundary>
        </ShellFrame>
        <DocsPage open={helpOpen} onClose={() => setHelpOpen(false)} />
      </>
    );
  }

  // First-run state: real_estate tenant with zero buildings. Before
  // this gate, App.jsx silently fell back to BUILDINGS.hq below and
  // rendered Meridian's demo data on top of an empty org — a perceived
  // data leak. We block the main shell entirely until at least one
  // building exists. Once it does, the auto-select effect below picks
  // it up and this component unmounts on the next render.
  // Demo orgs (Meridian, IMF, etc.) ship with DB rows so allBuildings
  // is non-empty for them and this path never fires.
  if (activeOrg && activeOrg.kind === 'real_estate' && buildingsReady && Object.keys(allBuildings).length === 0) {
    return (
      <>
        <FirstRunEmpty org={activeOrg} />
        <DocsPage open={helpOpen} onClose={() => setHelpOpen(false)} />
      </>
    );
  }

  // Flash-of-stale-data guard: during the brief window between mount and
  // the first buildings-cache hydrate, `allBuildings` is empty so the
  // fallback chain below evaluates to BUILDINGS.hq — the static Meridian
  // template — and the whole shell renders one frame with Meridian
  // widgets/asks/schedules before the real building takes over. Looks
  // like a data leak to the user. JB reported it on PRO TEST 2026-05-18.
  // Hold the shell render until hydration completes; demo orgs almost
  // always have warm caches so the loading window is invisible for
  // them, and fresh users see a clean spinner instead of a Meridian
  // flash.
  if (!buildingsReady) {
    return (
      <>
        <ShellFrame session={session}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AdaptivLoader size="lg" />
          </div>
        </ShellFrame>
        <DocsPage open={helpOpen} onClose={() => setHelpOpen(false)} />
      </>
    );
  }

  return (
    <>
      <ShellFrame session={session}>
        <MacWindowChrome>
          <Sidebar
            building={building}
            role={role}
            view={view}
            onView={setView}
            incidents={localIncidents}
            agents={localAgents}
            agentRuntime={agentRuntime}
            agentLatestActions={agentLatestActions}
            team={TEAM}
            conversations={localConvs}
            activeConvId={activeConvId}
            onSelectConv={setActiveConvId}
            /* PR #705: sidebar chat icon TOGGLES (was always-open).
             User reported: clicking the icon when chat appears closed
             does nothing. Likely cause: chatOpen state is already
             true from localStorage but the panel is rendering
             off-screen / behind another element, so always-true
             setter triggers no re-render and nothing changes.
             Toggle makes the icon work as a real switch — close +
             reopen recovers from any stuck state. */
            onOpenChat={() => setChatOpen((v) => !v)}
            onNewChat={newChat}
            onSeeAllIncidents={() => {
              setDashRequest({ section: 'incidents', at: Date.now() });
              setView('dashboard');
            }}
            onOpenAgent={(agentId) => {
              setDashRequest({ section: 'agents', agentId, at: Date.now() });
              setView('dashboard');
            }}
            onOpenIncident={(id) => {
              // K-23: clicking an incident in the sidebar opens its detail
              // view in the center pane. Force view to 'dashboard' since
              // the IncidentView render branch only kicks in when no other
              // top-level page (admin, agentic, operations, …) is active.
              setRoutedIncidentId(id);
              setView('dashboard');
            }}
            // Sidebar is always the icon bar (wide / hidden modes retired).
            collapsed={true}
            hidden={false}
            variant={tweaks.variant}
            onToggle={undefined}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenHelp={() => setHelpOpen(true)}
            onOpenPalette={openPalette}
            theme={tweaks.theme}
            onToggleTheme={() => window.setMerlinTweaks({ theme: tweaks.theme === 'dark' ? 'light' : 'dark' })}
            chatOpen={chatOpen}
            onOpenAlerts={() => {
              // Land on OPERATE → Activity with the CTAs filter active.
              // Timestamped sentinel so EACH click is a distinct prop —
              // ActivityPage's useEffect on initialAgentId then re-fires
              // and resets the filter to 'needs', even when the user is
              // already on Activity (the bell was a no-op before).
              const now = Date.now();
              setCallsRequest({ agentId: `__alerts__:${now}`, at: now });
              setView('activity');
            }}
          />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
            <TopBar
              building={building}
              role={role}
              view={view}
              onView={setView}
              onNavigateNotification={(dest) => setView(dest)}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenPalette={openPalette}
              session={session}
              onLogout={doLogout}
              chatOpen={chatOpen}
              onToggleChat={() => setChatOpen((v) => !v)}
            />
            <CommandPalette open={paletteOpen} onClose={closePalette} onSetView={setView} />
            {/* New-tenant onboarding (PR #522). The modal self-gates on
              organizations.setup_progress.vertical_picked — returns null
              for established tenants. Mounted globally so it survives
              view changes during the first session. */}
            <WelcomeModal organizationId={session?.organizationId} organizationName={session?.organizationName} />
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Central content card — JB asked for the main column to
                read as a rounded "table" container, matching the left
                icon rail (Sidebar.jsx) and the docked Merlin chat
                (Chat.jsx) treatments. Margins: 12 top/bottom for the
                lifted look; 12 right always (when chat is closed,
                ChatPanel returns null and contributes no margin, so
                this is the only thing keeping the card off the
                viewport edge); 0 left (icon rail's marginRight:12
                already provides the gap there).
                Critical layout note: this card stays display:flex
                WITHOUT flexDirection (default row). When it was
                flexDirection:column, the page inside it (e.g. Activity,
                with its own internal flex:1 overflow:auto child)
                couldn't trigger its scroll — flex items in column
                parents default to min-height:min-content and refuse to
                shrink. Default row direction makes the page a
                stretched cross-axis child (height = card height) which
                is what every page assumed before this wrapper landed. */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  minWidth: 0,
                  minHeight: 0,
                  // PR #669: tightened the gap to the TopBar above. The
                  // old 12px stacked with the TopBar's ~12px of empty
                  // space below the BuildingSwitcher pill and made the
                  // floating pill feel disconnected from the floating
                  // card. 4px keeps them visually anchored together.
                  marginTop: 4,
                  marginBottom: 12,
                  marginRight: 12,
                  // No top/bottom padding — JB confirmed 2026-05-23 with
                  // a reference screenshot: he wants the pink scrollbar
                  // thumb to extend to the card's edges and let the
                  // overflow:hidden + borderRadius:14 below clip its
                  // ends so the thumb visually curves into the rounded
                  // corners. (Earlier PRs #556/#557 added padding to
                  // stop the thumb short of the curve; reverted here.)
                  borderRadius: 14,
                  // Border restored 2026-05-23 — JB wants the central
                  // card to read with the same visible border as the
                  // docked Merlin chat panel.
                  border: '1px solid var(--border)',
                  background: 'color-mix(in oklch, var(--surface) 80%, transparent)',
                  backdropFilter: 'blur(30px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                  // No drop shadow — the border alone defines the card edge
                  // (JB, 2026-07-03; the soft shadow bled into the margin gaps).
                  overflow: 'hidden',
                }}
              >
                {/* One Suspense covers every lazy-loaded route (Admin /
                Agentic / Reports / Insights / Innovate). The fallback
                fills the same height as the page that will replace it
                so the layout doesn't jump. */}
                <LazyChunkBoundary>
                  <Suspense fallback={<LazyFallback />}>
                    <AuthedRoutes
                      view={view}
                      role={role}
                      building={building}
                      session={session}
                      activeOrg={activeOrg}
                      isOrgAdmin={isOrgAdmin}
                      tweaks={tweaks}
                      settingsOpen={settingsOpen}
                      setSettingsOpen={setSettingsOpen}
                      routedDeviceExternalId={routedDeviceExternalId}
                      routedIncident={routedIncident}
                      setRoutedIncidentId={setRoutedIncidentId}
                      navigateTo={navigateTo}
                      setView={setView}
                      adminSection={adminSection}
                      setAdminSection={setAdminSection}
                      agenticRequest={agenticRequest}
                      setAgenticRequest={setAgenticRequest}
                      agentDetailId={agentDetailId}
                      setAgentDetailId={setAgentDetailId}
                      dashRequest={dashRequest}
                      setDashRequest={setDashRequest}
                      callsRequest={callsRequest}
                      setCallsRequest={setCallsRequest}
                      localIncidents={localIncidents}
                      localSlas={localSlas}
                      openChat={openChat}
                    />
                  </Suspense>
                </LazyChunkBoundary>
              </div>
              <ChatPanel
                open={chatOpen}
                onClose={() => setChatOpen(false)}
                seededQuery={seededQuery}
                seededSend={seededSend}
                seededDecisions={seededDecisions}
                onSeededHandled={() => {
                  setSeededQuery(null);
                  setSeededSend(false);
                  setSeededDecisions(false);
                }}
                tone={tweaks.tone}
                building={building}
                role={role}
                view={view}
                onView={setView}
                chatMode={tweaks.chatMode || 'floating'}
                onOpenAgent={(agentId) => {
                  setDashRequest({ section: 'agents', agentId, at: Date.now() });
                  setView('dashboard');
                }}
                onOpenCalls={() => setView('activity')}
              />
            </div>
          </div>
        </MacWindowChrome>
      </ShellFrame>

      <TweaksPanel tweaks={tweaks} onChange={window.setMerlinTweaks} visible={editMode} />
      <DocsPage open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
