// User-menu + help cluster, extracted from App.jsx (2026-06-24). The customer
// Merlin topbar's floating menu (MerlinFloatingMenu, used by App's TopBar), the
// standalone UserMenu pill + HelpButton (used by WorkerApp), and their leaf
// pieces (MerlinUserCard, UserMenuItem). All presentational / prop-driven — no
// app-shell state lives here.
import React, { useState, useEffect } from 'react';
import { Icon } from './icons.jsx';
import { useT } from './i18n.js';
import { useActiveOrg, useIsOrgAdmin } from './org-data.js';
import { effectiveRoleKey, effectiveRoleLabel } from './personas.js';
import { FloatingMenu, AdaptivAIcon } from './FloatingMenu.jsx';
import { useInstallPrompt } from './pwa-install.js';
import { initialsOf, canAccessAdmin, canAccessAgentic } from './auth.js';

export function HelpButton({ onOpen }) {
  const t = useT();
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onOpen}
      title={t('topbar.help')}
      style={{
        width: 34,
        height: 34,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? 'var(--accent-soft)' : 'transparent',
        color: 'var(--accent)',
        border: '1px solid ' + (hover ? 'var(--accent-line)' : 'transparent'),
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'background .12s',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Icon.help size={16} />
    </button>
  );
}

// Topbar search trigger — opens the ⌘K command palette. Was a 240px
// search-bar pill (PR #230). Collapsed to a 34px icon button so it
// reads as a sibling to Help + Bell. The ⌘K shortcut stays bound
// globally in AuthedApp; the title attribute keeps the discovery
// hint without taking up the topbar real estate.
// FloatingMenu trigger for the customer Merlin topbar — replaces the
// inline picture+name UserMenu pill 2026-05-23. Mirrors the Excalibur
// pattern (PlatformApp.jsx) but with Merlin-side menu items + onClick
// handlers (the customer app navigates via setView callbacks, not URL
// hrefs, so renderLink is overridden to turn each item href into a
// button that fires the matching handler).
export function MerlinFloatingMenu({ session, role, onLogout, onOpenSettings, onOpenAdmin, onOpenAgentic }) {
  const t = useT();
  const isOrgAdmin = useIsOrgAdmin();
  const showAdmin = canAccessAdmin(role?.id);
  const showAgentic = canAccessAgentic(role?.id, isOrgAdmin, session?.isPlatformAdmin);
  // "Install Merlin" appears only when Chrome has offered an install prompt
  // (installable + not already installed) — see pwa-install.js.
  const { canInstall, promptInstall } = useInstallPrompt();
  const handlers = {
    'merlin://install': promptInstall,
    'merlin://admin': showAdmin ? onOpenAdmin : null,
    'merlin://agentic': showAgentic ? onOpenAgentic : null,
    'merlin://settings': onOpenSettings,
    'merlin://logout': onLogout,
  };
  const items = [
    canInstall && { label: t('user_menu.install'), href: 'merlin://install' },
    showAdmin && { label: t('user_menu.admin'), href: 'merlin://admin' },
    showAgentic && { label: t('user_menu.agentic'), href: 'merlin://agentic' },
    { label: t('action.settings'), href: 'merlin://settings' },
    { label: t('user_menu.sign_out'), href: 'merlin://logout' },
  ].filter(Boolean);
  const renderLink = ({ href, className, style, children }) => (
    <button
      onClick={(e) => {
        e.preventDefault();
        handlers[href]?.();
      }}
      className={className}
      style={{
        ...style,
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        width: '100%',
      }}
    >
      {children}
    </button>
  );
  return (
    <FloatingMenu
      icon={<AdaptivAIcon />}
      items={items}
      renderLink={renderLink}
      positionStyle={{ position: 'relative', top: 'auto', right: 'auto', width: 40, height: 40 }}
      panelPositionStyle={{ top: 56 }}
      eyebrow="// Merlin"
      headerSlot={<MerlinUserCard session={session} />}
    />
  );
}

function MerlinUserCard({ session }) {
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
    </div>
  );
}

// User menu item — small button used inside UserMenu for the cogwheel
// actions that used to live in GearMenu. Same shape as the workspace
// switcher rows so the menu reads consistently.
function UserMenuItem({ icon, label, onClick }) {
  const IconC = Icon[icon] || Icon.cog;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: 'transparent',
        color: 'var(--text-soft)',
        border: 'none',
        borderRadius: 7,
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 12.5,
        fontWeight: 600,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <IconC size={13} style={{ color: 'var(--text-dim)' }} />
      {label}
    </button>
  );
}

export function UserMenu({ session, role, onLogout, onOpenSettings, onOpenAdmin, onOpenAgentic }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const org = useActiveOrg();
  // Workspace switcher moved to BuildingSwitcher — the location selector
  // owns "where you are" across both org and building layers.
  const isOrgAdmin = useIsOrgAdmin();
  const showAdmin = canAccessAdmin(role?.id);
  const showAgentic = canAccessAgentic(role?.id, isOrgAdmin, session?.isPlatformAdmin);

  const roleTone =
    {
      superadmin: 'linear-gradient(135deg, #ef4444, #FF00B2)',
      facility: 'linear-gradient(135deg, #FF00B2, #20286D)',
      cleaning: 'linear-gradient(135deg, #10b981, #0ea5e9)',
      maintenance: 'linear-gradient(135deg, #f59e0b, #ef4444)',
      security: 'linear-gradient(135deg, #20286D, #0b1020)',
    }[role?.id] || 'linear-gradient(135deg, #20286D, #FF00B2)';
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => document.addEventListener('click', close), 0);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={session.name}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px 4px 4px',
          borderRadius: 999,
          background: open ? 'var(--surface-3)' : 'transparent',
          border: '1px solid ' + (open ? 'var(--border-strong)' : 'transparent'),
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            // roleTone is a linear-gradient string — must go through
            // backgroundImage, not backgroundColor (which silently drops
            // gradients and leaves the circle transparent, making the
            // white initials invisible against a white topbar).
            backgroundColor: session.picture ? 'var(--surface-2)' : undefined,
            backgroundImage: session.picture ? `url(${session.picture})` : roleTone,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.3,
            boxShadow: '0 0 0 1.5px var(--surface), 0 1px 3px rgba(0,0,0,0.2)',
          }}
        >
          {!session.picture && initialsOf(session.name)}
        </div>
        <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{session.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>
            {effectiveRoleLabel(effectiveRoleKey(session, org), t)}
          </div>
        </div>
        <Icon.chevD size={11} style={{ color: 'var(--text-dim)', marginLeft: 2 }} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 240,
            padding: 6,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            zIndex: 100,
          }}
        >
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{session.name}</div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-dim)',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {session.email}
            </div>
            {session.company && (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{session.company}</div>
            )}
            {org && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 8,
                  padding: '3px 8px',
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-line)',
                  borderRadius: 999,
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  letterSpacing: 0.1,
                }}
              >
                <Icon.sparkle size={10} />
                {org.name}
              </div>
            )}
            {/* Effective-role line — single short label reflecting the
                full Adaptiv hierarchy (Owner > Super Admin > Admin >
                Contractor > worker functions). Replaces the prior
                "Persona · …" framing 2026-05-17. */}
            {(() => {
              const key = effectiveRoleKey(session, org);
              if (!key) return null;
              return (
                <div
                  style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, fontWeight: 700, letterSpacing: 0.1 }}
                >
                  {effectiveRoleLabel(key, t)}
                </div>
              );
            })()}
          </div>

          {/* Cogwheel actions — folded into the user menu so the topbar
              loses one button. Items are role-gated: tenant-side admin/
              agentic only when the role allows; platform link only when
              this user is a platform admin. */}
          <div style={{ padding: '6px 4px', borderBottom: '1px solid var(--border)' }}>
            <UserMenuItem
              icon="cog"
              label={t('action.settings')}
              onClick={() => {
                setOpen(false);
                onOpenSettings?.();
              }}
            />
            {showAdmin && (
              <UserMenuItem
                icon="people"
                label={t('tab.admin')}
                onClick={() => {
                  setOpen(false);
                  onOpenAdmin?.();
                }}
              />
            )}
            {showAgentic && (
              <UserMenuItem
                icon="agents"
                label={t('tab.agentic')}
                onClick={() => {
                  setOpen(false);
                  onOpenAgentic?.();
                }}
              />
            )}
            {/* Customer-app menu deliberately has no link to /platform.
                Platform admins reach the back-office by typing the URL —
                see supabase.js for the session-isolation rationale. */}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              marginTop: 4,
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--risk)',
              border: 'none',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'color-mix(in oklch, var(--risk) 8%, transparent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Icon.chevR size={11} style={{ transform: 'rotate(180deg)' }} />
            {t('auth.signout')}
          </button>
        </div>
      )}
    </div>
  );
}
