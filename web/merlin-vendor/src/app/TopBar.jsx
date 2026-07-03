// Customer topbar, extracted from App.jsx (2026-06-24). Renders the workspace +
// service-line switchers, the pillar breadcrumb + section sub-nav (from
// pillar-subnav.js), the active org's co-brand logo/name, and the Merlin user
// menu. Pure presentation over props + a few read hooks; navigation is delegated
// up via onView.
import React from 'react';
import { Icon } from './icons.jsx';
import { useT } from './i18n.js';
import { useActiveOrg, useIsOrgAdmin } from './org-data.js';
import { canAccessHypervisor } from './auth.js';
import { PILLAR_SUBNAV, pillarForView, activeSubNavId, filterSubNav, contractorsLandingView } from './pillar-subnav.js';
import { useMyDayHidden } from './platform-settings.js';
import { useBuildingsForActiveOrg } from './custom-locations.js';
import { BuildingSwitcher } from './Sidebar.jsx';
import { ServiceLineSwitcher } from './ServiceLineSwitcher.jsx';
import { MerlinFloatingMenu } from './UserMenu.jsx';

export function TopBar({
  building,
  role,
  view,
  onView,
  onOpenSettings,
  session,
  onLogout,
  chatOpen: _chatOpen,
  onToggleChat: _onToggleChat,
  onNavigateNotification: _onNavigateNotification,
  onOpenPalette: _onOpenPalette,
}) {
  const t = useT();
  const activeOrg = useActiveOrg();
  const hypervisorAccess = canAccessHypervisor(session?.role, session?.isPlatformAdmin);

  // The icon rail in Sidebar.jsx owns pillar-level navigation now — the
  // top-level MONITOR/OPERATE/REPORT/PREDICT/INNOVATE strip that used to
  // live here was redundant with the rail. We lifted each pillar's
  // sub-nav UP one row so it lives in the TopBar slot directly. The
  // definition is centralized in pillar-subnav.js.
  const pillar = pillarForView(view);
  const rawItems = pillar ? PILLAR_SUBNAV[pillar] : null;
  // Contractors child visibility — mirror Operations.jsx logic without
  // duplicating the inner sub-nav: a contractor-kind org always has a
  // child (contracts), real_estate orgs have one (scorecard). Other org
  // kinds (adaptiv) get nothing.
  const hasContractorsChild = activeOrg?.kind === 'contractor' || activeOrg?.kind === 'real_estate';
  const myDayHidden = useMyDayHidden().hidden;
  const isOrgAdmin = useIsOrgAdmin();
  const topbarBuildings = useBuildingsForActiveOrg();
  const multiLocation = Object.keys(topbarBuildings).filter((id) => id !== '__ready').length > 1;
  const subNavItems = filterSubNav(rawItems, {
    hypervisorAccess,
    hasContractorsChild,
    myDayHidden,
    isRealEstate: activeOrg?.kind === 'real_estate',
    orgKind: activeOrg?.kind,
    multiLocation,
    isOrgAdmin,
  });
  const activeId = activeSubNavId(view, subNavItems);

  function onSubNavClick(item) {
    // Contractors group's landing view depends on org kind. Other items
    // route directly to their stated view value.
    if (item.contractorsGroup) {
      onView(contractorsLandingView(activeOrg?.kind));
      return;
    }
    onView(item.view);
  }

  return (
    <div
      style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        // Padding aligns TopBar content with the floating siblings
        // below: left 0 puts the BuildingSwitcher pill flush with the
        // central card's left edge (12px from the icon rail, same as
        // the card); right 12 matches the card's marginRight + the
        // chat's right viewport edge.
        padding: '0 12px 0 0',
        // No background fill — the topbar reads straight onto the page
        // so it blends with the canvas rather than sitting on a tile.
        // (JB asked to drop the surface tint 2026-06-08.)
        background: 'transparent',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {/* Workspace picker (Phase H-7: moved out of the agent bar) */}
        <BuildingSwitcher building={building} compact />
        {/* Service-line switcher — only for multi-service contractors; it also
            initializes the current service line for single-service ones.
            Shown ONLY on the agent surfaces (AI Agents grid + drill-in), the one
            place a per-line filter changes what's on screen. Everywhere else —
            My Day (all-line briefing), Metrics (whole-portfolio KPIs), ANTICIPATE
            (all lines on one page), OPERATE, … — a per-line filter is meaningless,
            so it's hidden (the init hooks still run; only the control is suppressed). */}
        <ServiceLineSwitcher hideControl={!['agents', 'agent-detail', 'agentic'].includes(view)} />
        {pillar && (
          <>
            {/* Pillar breadcrumb — gives the user a "where am I" cue
                between the workspace picker and the section sub-nav.
                Capitalized via the i18n value (tab.cat.* are already
                upper-case strings). The vertical separator that used
                to sit between the BuildingSwitcher pill and this
                label was removed 2026-05-23 — gap:10 on the parent
                flex provides enough visual separation. */}
            <span
              style={{
                fontSize: 13,
                letterSpacing: 0.3,
                fontWeight: 700,
                color: 'var(--accent-pink)',
                flexShrink: 0,
              }}
            >
              {t(`tab.cat.${pillar}`)}
            </span>
          </>
        )}
        {subNavItems && subNavItems.length > 0 && (
          // Sub-nav strip — no background tint, no outer border, no
          // padding. Buttons sit directly on the topbar surface. JB
          // asked for this 2026-05-23.
          <div style={{ display: 'flex', gap: 2 }}>
            {subNavItems.map((item) => {
              const IconC = Icon[item.icon] || Icon.sparkle;
              const active = item.id === activeId;
              return (
                <button
                  key={item.id}
                  onClick={() => onSubNavClick(item)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-dim)',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  <IconC size={12} />
                  {t(item.labelKey)}
                </button>
              );
            })}
          </div>
        )}
        {/* Notification bell removed 2026-05-23 — JB turned it into
            a "Pending" tab inside the OPERATE sub-nav itself
            (pillar-subnav.js). Pending routes to view='calls'. */}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Topbar right cluster — the active organization's logo (or name) +
            the FloatingMenu. Whose-workspace cue, sitting to the left of the
            menu. When the org has set a co-brand logo (branding_logo_url), we
            render it here for ANY org — this is the lightweight co-brand slot,
            distinct from the Enterprise white-label resolver. Falls back to the
            org name text. Search moved to the Sidebar bottom card; chat toggle
            removed; bell moved left (next to the sub-nav). */}
        {activeOrg?.branding_logo_url ? (
          <img
            src={activeOrg.branding_logo_url}
            alt={activeOrg.name || ''}
            title={activeOrg.name}
            className="org-cobrand-logo"
            draggable={false}
            style={{
              height: 22,
              maxWidth: 190,
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
              flexShrink: 0,
            }}
          />
        ) : activeOrg?.name ? (
          <span
            title={activeOrg.name}
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--text-soft)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 220,
            }}
          >
            {activeOrg.name}
          </span>
        ) : null}
        {session && (
          <MerlinFloatingMenu
            session={session}
            role={role}
            onLogout={onLogout}
            onOpenSettings={onOpenSettings}
            onOpenAdmin={() => onView('admin')}
            onOpenAgentic={() => onView('agentic')}
          />
        )}
      </div>
    </div>
  );
}
