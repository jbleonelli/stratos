// Admin — Facility Manager's control surface.
// Sub-sections: Organization, Users, Locations, SLAs, Device Import.
import React, { useState, useEffect } from 'react';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { SlasSection } from './AdminSlas.jsx';
import { LocationsSection } from './AdminLocations.jsx';
import { AgentsSection } from './AdminAgents.jsx';
import { ChannelSection } from './AdminChannel.jsx';
import { UsersSection } from './AdminUsers.jsx';
import { ImportSection } from './AdminImport.jsx';
import { SetupSection } from './AdminSetup.jsx';
import { NotificationsSection } from './AdminNotifications.jsx';
import { OrganizationSection } from './AdminOrganization.jsx';
import { useSession } from './auth.js';
import { useActiveOrg } from './org-data.js';
import { useT } from './i18n.js';
// Feature flags moved to /platform/experimental (2026-05-12). The
// useFeatureFlags / saveFeatureFlags imports that lived here are no
// longer needed — consumers import the hook directly when they need it.

// `hideForOrgKind` is the set of org.kind values that don't get this
// section. Contractor orgs don't own buildings (no Locations), don't
// run org-level SLAs the way real-estate orgs do (their SLA targets
// live per-contract), and aren't reseller-level so the Adaptiv
// product showcase isn't theirs to edit. Device import IS exposed —
// contractors may provision crew-shared devices like NFC badges.
const SECTIONS = [
  { id: 'organization', labelKey: 'admin.section.organization', icon: 'sparkle' },
  { id: 'users', labelKey: 'admin.section.users', icon: 'people' },
  // Outbound notification settings — email/Slack opt-in for ticket events
  // (migration 182). Drives api/cron/tickets-sla-sweep.ts's outbox.
  { id: 'notifications', labelKey: 'admin.section.notifications', icon: 'bell' },
  { id: 'locations', labelKey: 'admin.section.locations', icon: 'building', hideForOrgKind: ['contractor'] },
  // Per-building Setup hub (mig 170, PRD building-setup.md) — captures the
  // data Merlin grounds on. Real-estate only; contractors don't own buildings.
  { id: 'setup', labelKey: 'admin.section.setup', icon: 'panel', hideForOrgKind: ['contractor'] },
  { id: 'slas', labelKey: 'admin.section.slas', icon: 'shield', hideForOrgKind: ['contractor'] },
  // Agent entitlements (migration 117). 1 free per building, $99/mo
  // per extra. Hidden for contractor orgs — agents are a manager
  // feature today.
  { id: 'agents', labelKey: 'admin.section.agents', icon: 'sparkle', hideForOrgKind: ['contractor'] },
  // Product ads moved fully to Excalibur (/platform/marketing/ads) —
  // 2026-06. The per-tenant override section was removed from the
  // customer Admin entirely (it previously lived here gated to platform
  // admins). Manage the catalog + per-tenant overrides back-office.
  // 'features' removed 2026-05-12 — feature flags are now
  // platform-managed (Adaptiv-side at /platform/experimental).
  // Customer-side admins no longer flip them per-tenant.
  { id: 'import', labelKey: 'admin.section.import', icon: 'ship' },
  // Reseller channel admin (migration 135). Only visible when the
  // active org has is_reseller=true. The org has children to manage —
  // their plan, releasing them from the channel, viewing their state.
  // Branding for the reseller itself is set on Organization → Brand
  // & appearance (the existing card from migration 133 / Phase 2).
  { id: 'channel', labelKey: 'admin.section.channel', icon: 'beacon', showOnlyIfReseller: true },
];

export function AdminPage({ building, initialSection, onSectionConsumed }) {
  const t = useT();
  const org = useActiveOrg();
  const session = useSession();
  const visibleSections = SECTIONS.filter((s) => {
    if (s.hideForOrgKind?.includes(org?.kind)) return false;
    // Reseller channel admin tab only shows when the active org IS a
    // reseller (is_reseller=true). Most orgs hide it entirely.
    if (s.showOnlyIfReseller && !org?.is_reseller) return false;
    // Product ads section is Adaptiv-platform-admin-only (managed
    // from /platform/marketing/ads canonically).
    if (s.showOnlyIfPlatformAdmin && !session?.isPlatformAdmin) return false;
    return true;
  });
  const [section, setSection] = useState(() => {
    if (initialSection && visibleSections.some((s) => s.id === initialSection)) {
      return initialSection;
    }
    return visibleSections[0]?.id || 'organization';
  });
  // Deep-link consumption — when AgentsPanel routes here with
  // initialSection='agents', honour it once then clear so a manual
  // tab change doesn't get clobbered by re-renders.
  useEffect(() => {
    if (initialSection && visibleSections.some((s) => s.id === initialSection)) {
      setSection(initialSection);
      onSectionConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection]);
  // Bounce out if the current section is now hidden (e.g. user just
  // switched workspace from real_estate to contractor while parked
  // on the Locations tab).
  useEffect(() => {
    if (!visibleSections.some((s) => s.id === section)) {
      setSection(visibleSections[0]?.id || 'organization');
    }
  }, [org?.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 'var(--pad)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pad)',
      }}
    >
      <Hero />
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--pad)', alignItems: 'flex-start' }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {visibleSections.map((s) => {
            const IconC = Icon[s.icon] || Icon.sparkle;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-soft)',
                  border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background .12s',
                }}
              >
                <IconC size={13} />
                {t(s.labelKey)}
              </button>
            );
          })}
        </nav>
        <div>
          {section === 'organization' && <OrganizationSection building={building} />}
          {section === 'users' && <UsersSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'locations' && <LocationsSection />}
          {section === 'setup' && <SetupSection />}
          {section === 'slas' && <SlasSection />}
          {section === 'agents' && <AgentsSection building={building} />}
          {section === 'import' && <ImportSection />}
          {section === 'channel' && <ChannelSection />}
        </div>
      </div>
    </main>
  );
}

function Hero() {
  const t = useT();
  return (
    <Card pad={false} style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ padding: 'var(--pad)', position: 'relative' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            fontWeight: 700,
          }}
        >
          {t('admin.hero.eyebrow')}
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>
          {t('admin.workspace_setup')}
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 640 }}>
          {t('admin.hero.body')}
        </p>
      </div>
    </Card>
  );
}
