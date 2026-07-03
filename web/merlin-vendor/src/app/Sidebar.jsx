// Left sidebar
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, IconBtn } from './primitives.jsx';
import { WORDMARK_URL } from './brand-assets.js';
import { useT, t as tStatic } from './i18n.js';
import { useTranslatedText } from './event-translations.js';
import { AGENTS } from './data.js';

// K-22: agent_id → short display name for the activity feed rows.
// Strips the "& Foo" suffix so rows stay compact in the narrow sidebar.
const AGENT_NAME_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a.name.replace(/\s*&.*$/, '')]));
import { useBuildingsForActiveOrg, breadcrumbFor } from './custom-locations.js';
import { useFleetCountsByLocation } from './devices-store.js';
import { useSession } from './auth.js';
import { switchOrg } from './org-data.js';
import { useBranding } from './branding-data.js';
import { useWorkspaceMemberships } from './queries/memberships.ts';
import { useMerlinAsks } from './merlin-asks.js';
import { pillarForView } from './pillar-subnav.js';
import { alertDialog } from './dialogs.jsx';

const SIDEBAR_WIDTH_KEY = 'merlinSidebarWidth';
const SIDEBAR_WIDTH_MIN = 220;
const SIDEBAR_WIDTH_MAX = 420;
const SIDEBAR_WIDTH_DEFAULT = 268;
const PINS_KEY = 'merlin-conv-pins';

// Shared floating-card styling for the icon-rail's two cards (the top
// icons card and the bottom help/cog card). Mirrors the central content
// card + docked chat panel so the three surfaces read as one family.
//
// Width: collapsed = fixed 52px. Expanded uses width:max-content with
// max-width transitioning to RAIL_MAX_EXPAND_CAP, so the card auto-
// sizes to the widest label + padding (PR #680) instead of a fixed
// 200px. min-width keeps it from collapsing below the icon column.
const RAIL_WIDTH_COLLAPSED = 52;
const RAIL_MAX_EXPAND_CAP = 360; // cap large enough that content always wins
const floatingCardStyle = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  // Near-opaque (92%) + a lighter blur: the cards animate their max-width on
  // hover and sit OVER the live-updating Now page (pulsing dots, rotating
  // avatar, sparklines). At 80% opacity + blur(30px) the backdrop-filter
  // re-sampled the moving content every frame → a visible shimmer/flicker on
  // the expanded rail (a known Chrome backdrop-filter behaviour). Making the
  // surface mostly opaque means the backdrop contributes little, so the
  // shimmer is gone while the frosted look is preserved.
  background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
  backdropFilter: 'blur(16px) saturate(150%)',
  WebkitBackdropFilter: 'blur(16px) saturate(150%)',
  boxShadow: '0 6px 24px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.04)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  // Horizontal padding is 7px (not 8) so the content box is exactly the 36px
  // icon width: 52 − 2(border) − 2(7) = 36. A left-aligned 36px icon then sits
  // dead-centre in the 52px rail (8px gap each side) — the previous 8px padding
  // left a 34px content box, so the icon overflowed 2px right and read 2px
  // off-centre. Matching the box also means collapsed and expanded share the
  // same icon-left, so there's no hover jump (why `alignSelf:center` was dropped).
  padding: '14px 7px 12px',
  gap: 6,
  width: 'max-content',
  minWidth: RAIL_WIDTH_COLLAPSED,
  flexShrink: 0,
  overflow: 'hidden',
  // No width transition. The card is `width: max-content` (sized to the
  // labels, which stay in the DOM and only fade via opacity). Animating
  // max-width with an ease curve left the collapse crawling its last few px —
  // the card lingered a hair wider than 52px with the truncated label still
  // showing, then snapped closed, reading as a flicker. Snapping the width
  // (labels fade on their own) is clean both ways.
  transition: 'none',
};

// Sidebar nav row — wraps an icon button (or any leading element) and
// renders a label next to it when the rail is expanded on hover. The
// label is clickable too (same onClick), so the whole row reads as a
// single nav item rather than icon-with-decorative-text.
function NavRow({ expanded, label, onClick, active, children }) {
  const [hovered, setHovered] = useState(false);
  // PR #699: full-row background highlight on hover + active (Supabase
  // pattern). When the rail is expanded, the icon AND label area share
  // the same hover/active fill so the row reads as a single nav item
  // rather than icon-with-decorative-text. Collapsed state still works
  // — the highlight is just the icon's width wide.
  const rowBg = active ? 'var(--accent-soft)' : hovered ? 'var(--surface-3)' : 'transparent';
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        // Always full-width + stretch so the icon's LEFT EDGE is identical
        // collapsed vs expanded. Previously collapsed used `width:36 +
        // alignSelf:center`, but the 36px icon box is wider than the
        // collapsed content box (~34px = 52 − 2px border − 16px padding), so
        // centering offset it ~1px — on hover the icon visibly jumped right,
        // then back on collapse. The glyph still reads centered in the 52px
        // rail; only the layout box is now stable.
        width: '100%',
        alignSelf: 'stretch',
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 8,
        background: rowBg,
        transition: 'background 0.12s ease',
      }}
    >
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36 }}>
        {expanded && React.isValidElement(children) ? React.cloneElement(children, { chromeless: true }) : children}
      </div>
      {/* Label fades in only when the rail has expanded — opacity +
          translateX gives a small reveal motion that matches the
          width transition. Right padding gives the label breathing
          room from the card's right edge when max-content sizes
          the card to fit. pointer-events: none so clicks always
          fall through to the icon button. */}
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: active ? 'var(--accent)' : hovered ? 'var(--text)' : 'var(--text-soft)',
          whiteSpace: 'nowrap',
          paddingRight: 8,
          opacity: expanded ? 1 : 0,
          transform: expanded ? 'translateX(0)' : 'translateX(-4px)',
          transition: 'opacity 0.16s ease, transform 0.18s ease',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function loadPinOverrides() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(PINS_KEY) || '{}');
  } catch {
    return {};
  }
}
function persistPinOverrides(map) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify(map));
  } catch {}
}

export function Sidebar({
  building,
  view,
  onView,
  incidents,
  agents,
  agentRuntime,
  agentLatestActions,
  conversations,
  onOpenChat,
  onNewChat,
  onSeeAllIncidents,
  onOpenAgent,
  onOpenIncident,
  collapsed,
  hidden,
  onToggle,
  onOpenSettings,
  onOpenHelp,
  onOpenPalette,
  chatOpen,
  onOpenAlerts,
  theme,
  onToggleTheme,
}) {
  // Phase H-7: agent bar gets a true hide state (returns null) like the
  // Merlin chat bar. Toggle now lives in the TopBar so the user can
  // bring it back even when fully hidden. The 64px collapsed state is
  // kept as an intermediate compact mode. NOTE: the `hidden` early return
  // lives AFTER the hooks below — hooks must run in the same order every
  // render (rules-of-hooks), and none of them depend on `hidden`.
  const t = useT();
  // PR #679: each rail (top + bottom) tracks its own hover state and
  // expands as an OVERLAY (not in layout) so the main content doesn't
  // shift. The outer wrapper stays 52px wide; cards grow to 200px with
  // alignSelf:flex-start so they overflow to the right, z-index lifts
  // them above the central content card.
  const [topHovered, setTopHovered] = useState(false);
  const [bottomHovered, setBottomHovered] = useState(false);
  // Light white-label (migration 133). When branding is active for the
  // current org, swap the rotated Adaptiv wordmark for the customer's
  // logo (rendered unrotated). Accent color + favicon are applied
  // globally by useApplyBranding at the App root.
  const branding = useBranding();
  const criticalCount = incidents.filter((i) => i.priority === 'critical').length;
  const highCount = incidents.filter((i) => i.priority === 'high').length;
  // Pending Merlin "calls for action" — drives the bell badge in the
  // collapsed icon bar. Same data the OPERATE → Activity feed shows.
  // Building-scoped (2026-05-14): asks attributed to a specific
  // building only count when that building is active.
  const ctaAsks = useMerlinAsks(building?.id);
  const ctaCount = ctaAsks.length;
  const [width, setWidth] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || '', 10);
      if (Number.isFinite(v) && v >= SIDEBAR_WIDTH_MIN && v <= SIDEBAR_WIDTH_MAX) return v;
    } catch {}
    return SIDEBAR_WIDTH_DEFAULT;
  });
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    } catch {}
  }, [width]);

  // Pin state: seeded from c.pinned, overridable via localStorage.
  const [pinOverrides, setPinOverrides] = useState(() => loadPinOverrides());
  const isPinned = (c) => pinOverrides[c.id] ?? !!c.pinned;
  const _togglePin = (id, currentlyPinned) => {
    const next = { ...pinOverrides, [id]: !currentlyPinned };
    setPinOverrides(next);
    persistPinOverrides(next);
  };
  React.useMemo(() => {
    const withPin = conversations.map((c) => ({ ...c, _pinned: isPinned(c) }));
    return withPin.sort((a, b) => (a._pinned === b._pinned ? 0 : a._pinned ? -1 : 1));
  }, [conversations, pinOverrides]);

  // Hidden state → render nothing. Placed AFTER all hooks above so hook order
  // stays stable across renders (rules-of-hooks).
  if (hidden) return null;

  // (BuildingSwitcher used to take `t` as a prop; it now calls useT()
  // internally so the TopBar can host it without importing the i18n
  // hook here just for that pass-through.)

  if (collapsed) {
    // Collapsed agent bar — icon-only quick actions. Each row maps onto
    // a section users actually use: Ask Merlin (the one accent CTA),
    // open chat panel, search, incidents (with a critical-count dot),
    // agents runtime, team / on-shift. Click → either expand the
    // sidebar (so the section is visible) or jump straight to the
    // matching view.
    // 5-pillar nav highlight — derive every pillar from the single source of
    // truth (VIEW_TO_PILLAR in pillar-subnav.js, via pillarForView), exactly as
    // the TopBar does (App.jsx). Hardcoded lists here used to drift out of sync —
    // e.g. the contractor MONITOR views (now / contractor-scorecard / building)
    // never lit the MONITOR icon, and several OPERATE/INNOVATE sub-views were
    // missed too. One mapping keeps the rail correct as sub-views move.
    const activePillar = pillarForView(view);
    const onMonitor = activePillar === 'monitor';
    const onOperate = activePillar === 'operate';
    const onReport = activePillar === 'report';
    const onPredict = activePillar === 'predict';
    const onInnovate = activePillar === 'innovate';
    return (
      <div
        style={{
          width: RAIL_WIDTH_COLLAPSED,
          flexShrink: 0,
          margin: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 50,
        }}
      >
        {/* TOP CARD — chat trigger + 5 pillar nav + bell + agents.
            Overlay expand: alignSelf:flex-start so the card takes its
            own (variable) width and overflows the 52px outer wrapper
            to the right when hovered. Main content doesn't shift. */}
        <aside
          onMouseEnter={() => setTopHovered(true)}
          onMouseLeave={() => setTopHovered(false)}
          style={{
            ...floatingCardStyle,
            maxWidth: topHovered ? RAIL_MAX_EXPAND_CAP : RAIL_WIDTH_COLLAPSED,
            alignSelf: 'flex-start',
          }}
        >
          <NavRow expanded={topHovered} label={t('sidebar.ask_merlin')} onClick={onOpenChat} active={chatOpen}>
            <IconBtn size={36} active={chatOpen} onClick={onOpenChat} title={t('sidebar.ask_merlin')}>
              {/* PR #677: custom Merlin chat icon, see CSS mask below. */}
              <div
                role="img"
                aria-label={t('sidebar.ask_merlin')}
                style={{
                  width: 18,
                  height: 18,
                  background: 'currentColor',
                  maskImage: 'url(/assets/merlin-chat.png)',
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  WebkitMaskImage: 'url(/assets/merlin-chat.png)',
                  WebkitMaskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                }}
              />
            </IconBtn>
          </NavRow>

          <NavRow
            expanded={topHovered}
            label={t('tab.cat.monitor')}
            onClick={() => onView?.('briefing')}
            active={onMonitor}
          >
            <IconBtn size={36} active={onMonitor} onClick={() => onView?.('briefing')} title={t('tab.cat.monitor')}>
              <Icon.monitor size={18} />
            </IconBtn>
          </NavRow>

          <NavRow
            expanded={topHovered}
            label={t('tab.cat.operate')}
            onClick={() => onView?.('operations')}
            active={onOperate}
          >
            <IconBtn size={36} active={onOperate} onClick={() => onView?.('operations')} title={t('tab.cat.operate')}>
              <Icon.operate size={18} />
            </IconBtn>
          </NavRow>

          <NavRow
            expanded={topHovered}
            label={t('tab.cat.report')}
            onClick={() => onView?.('reports')}
            active={onReport}
          >
            <IconBtn size={36} active={onReport} onClick={() => onView?.('reports')} title={t('tab.cat.report')}>
              <Icon.report size={18} />
            </IconBtn>
          </NavRow>

          <NavRow
            expanded={topHovered}
            label={t('tab.cat.predict')}
            onClick={() => onView?.('predict-forecast')}
            active={onPredict}
          >
            <IconBtn
              size={36}
              active={onPredict}
              onClick={() => onView?.('predict-forecast')}
              title={t('tab.cat.predict')}
            >
              <Icon.predict size={18} />
            </IconBtn>
          </NavRow>

          <NavRow
            expanded={topHovered}
            label={t('tab.cat.innovate')}
            onClick={() => onView?.('innovate')}
            active={onInnovate}
          >
            <IconBtn size={36} active={onInnovate} onClick={() => onView?.('innovate')} title={t('tab.cat.innovate')}>
              <Icon.innovate size={18} />
            </IconBtn>
          </NavRow>

          <div style={{ height: 8 }} />

          <NavRow
            expanded={topHovered}
            label={t('sidebar.alerts')}
            onClick={() => (onOpenAlerts ? onOpenAlerts() : onView?.('activity'))}
          >
            <IconBtn
              size={36}
              onClick={() => (onOpenAlerts ? onOpenAlerts() : onView?.('activity'))}
              title={t('sidebar.alerts')}
              style={{ position: 'relative' }}
            >
              <Icon.bell size={18} />
              {ctaCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -4,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    background: 'var(--accent)',
                    color: '#fff',
                    border: '1.5px solid var(--surface)',
                    fontSize: 9.5,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                    letterSpacing: 0,
                  }}
                >
                  {ctaCount > 99 ? '99+' : ctaCount}
                </span>
              )}
            </IconBtn>
          </NavRow>

          <NavRow
            expanded={topHovered}
            label={t('sidebar.agents')}
            onClick={() => onView?.('agents')}
            active={view === 'agents' || view === 'agent-detail'}
          >
            <IconBtn
              size={36}
              active={view === 'agents' || view === 'agent-detail'}
              onClick={() => onView?.('agents')}
              title={t('sidebar.agents')}
            >
              <Icon.agents size={18} />
            </IconBtn>
          </NavRow>
        </aside>

        {/* WORDMARK — between the two cards, NOT inside either.
            Brand pink→indigo gradient via CSS-mask on the source PNG.
            flex:1 makes the wordmark absorb the leftover vertical
            space so it sits centered between the two cards no matter
            the viewport height. minHeight keeps the gradient legible
            on short screens. White-label orgs see their tenant logo
            in place of the wordmark. */}
        {branding?.logoUrl ? (
          <div
            style={{
              flex: 1,
              minHeight: 120,
              width: RAIL_WIDTH_COLLAPSED,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 0',
            }}
          >
            <img
              src={branding.logoUrl}
              alt="Tenant logo"
              style={{ maxWidth: 40, maxHeight: 40, objectFit: 'contain' }}
            />
          </div>
        ) : (
          // PR #691: wordmark moved to position:fixed (viewport-anchored)
          // to definitively escape any parent stacking/overflow constraint
          // that was clipping previous size bumps. Anchored to the left
          // edge of the viewport, vertically centered. flex:1 spacer
          // keeps the layout flow intact between the two cards.
          <div style={{ flex: 1, minHeight: 80, width: RAIL_WIDTH_COLLAPSED }} aria-hidden />
        )}
        {/* Viewport-fixed wordmark, rendered outside the rail's flex flow.
            500x150 source dims (aspect 3.33), rotated -90deg → 150 wide ×
            500 tall on screen. zIndex 200 well above any chrome layer. */}
        {!branding?.logoUrl && (
          <div
            role="img"
            aria-label="Adaptiv"
            style={{
              position: 'fixed',
              left: 17, // +5 from base 12 per JB
              top: 'calc(50% + 200px)', // viewport center + 200px down per JB
              transform: 'translateY(-50%) rotate(-90deg)',
              transformOrigin: 'center center',
              width: 136,
              height: 41,
              marginLeft: -42, // (136 - 52) / 2 = 42, centre the visual within the 52px rail column
              pointerEvents: 'none',
              zIndex: 200,
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
        )}

        {/* BOTTOM CARD — search + help (?) + settings (cog).
            Search moved here from the topbar 2026-05-23 (JB).
            PR #679: independent hover (same overlay-expand pattern
            as the top card). */}
        {(onOpenPalette || onOpenHelp || onOpenSettings || onToggleTheme) && (
          <aside
            onMouseEnter={() => setBottomHovered(true)}
            onMouseLeave={() => setBottomHovered(false)}
            style={{
              ...floatingCardStyle,
              padding: '8px 8px', // give horizontal room so labels don't touch the edge
              maxWidth: bottomHovered ? RAIL_MAX_EXPAND_CAP : RAIL_WIDTH_COLLAPSED,
              alignSelf: 'flex-start',
            }}
          >
            {onOpenPalette && (
              <NavRow expanded={bottomHovered} label={t('sidebar.search')} onClick={onOpenPalette}>
                <IconBtn size={32} onClick={onOpenPalette} title={`${t('topbar.search')} (⌘K)`}>
                  <Icon.search size={16} />
                </IconBtn>
              </NavRow>
            )}
            {onOpenHelp && (
              <NavRow expanded={bottomHovered} label={t('sidebar.help')} onClick={onOpenHelp}>
                <IconBtn size={32} onClick={onOpenHelp} title={t('topbar.help')}>
                  <Icon.help size={16} />
                </IconBtn>
              </NavRow>
            )}
            {onToggleTheme && (
              <NavRow
                expanded={bottomHovered}
                label={theme === 'dark' ? t('sidebar.light_mode') : t('sidebar.dark_mode')}
                onClick={onToggleTheme}
              >
                <IconBtn
                  size={32}
                  onClick={onToggleTheme}
                  title={theme === 'dark' ? t('sidebar.light_mode') : t('sidebar.dark_mode')}
                >
                  {theme === 'dark' ? <Icon.sun size={16} /> : <Icon.moon size={16} />}
                </IconBtn>
              </NavRow>
            )}
            {onOpenSettings && (
              <NavRow expanded={bottomHovered} label={t('action.settings')} onClick={onOpenSettings}>
                <IconBtn size={32} onClick={onOpenSettings} title={t('action.settings')}>
                  <Icon.settings size={16} />
                </IconBtn>
              </NavRow>
            )}
          </aside>
        )}
      </div>
    );
  }

  return (
    <aside
      style={{
        width: width,
        height: '100%',
        borderRight: '1px solid var(--border)',
        background: 'color-mix(in oklch, var(--surface) 55%, transparent)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        transition: dragging ? 'none' : 'width .22s cubic-bezier(.2, 0, 0, 1)',
      }}
    >
      <SidebarResizeHandle onResize={setWidth} dragging={dragging} setDragging={setDragging} />

      <div style={{ padding: '14px 12px', display: 'flex', gap: 6 }}>
        <button
          onClick={onNewChat}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 10px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 2px 8px color-mix(in oklch, var(--accent) 30%, transparent)',
          }}
        >
          <Icon.sparkle size={13} /> {t('sidebar.ask_merlin')}
        </button>
        {/* Collapse to icons-only mode. Replaces the unwired search
            button (no global palette yet) — once a Cmd-K palette
            lands we can bring search back as its own affordance. */}
        <button
          onClick={onToggle}
          title={t('sidebar.collapse')}
          style={{
            width: 34,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface-3)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: 'pointer',
            color: 'var(--text-soft)',
          }}
        >
          <Icon.sidebar size={13} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 0 16px' }}>
        <SidebarSection
          id="incidents"
          title={t('sidebar.incidents')}
          right={
            <div style={{ display: 'flex', gap: 4 }}>
              {criticalCount > 0 && <Pill tone="risk">{t('sidebar.critical', { n: criticalCount })}</Pill>}
              {highCount > 0 && <Pill tone="warn">{highCount}</Pill>}
            </div>
          }
        >
          {incidents.slice(0, 3).map((inc) => {
            const handled = inc._humanHandled || inc._autoHandled;
            return (
              <SidebarRow
                key={inc.id}
                onClick={onOpenIncident ? () => onOpenIncident(inc.id) : null}
                icon={
                  <Dot
                    tone={
                      handled ? 'ok' : inc.priority === 'critical' ? 'risk' : inc.priority === 'high' ? 'warn' : 'info'
                    }
                    pulse={!handled && inc.priority === 'critical'}
                  />
                }
                title={inc.title}
                sub={handled ? inc.status : inc.sla}
                right={
                  inc._humanHandled ? (
                    <Pill tone="ok">{t('sidebar.pill.handled')}</Pill>
                  ) : inc._autoHandled ? (
                    <Pill tone="accent">{t('sidebar.pill.auto')}</Pill>
                  ) : null
                }
              />
            );
          })}
          <SidebarFooterLink onClick={onSeeAllIncidents}>
            {t('sidebar.see_all', { n: incidents.length })} →
          </SidebarFooterLink>
        </SidebarSection>

        <SidebarSection id="agents" title={t('sidebar.agents')}>
          {agents.map((a) => (
            <AgentLiveRow
              key={a.id}
              agent={a}
              live={agentRuntime?.[a.id]}
              latestAction={agentLatestActions?.[a.id]}
              onOpenAgent={onOpenAgent}
            />
          ))}
        </SidebarSection>

        <SidebarSection id="activity" title={t('sidebar.activity')}>
          {(() => {
            // K-22: live agent activity feed. Flatten today's runs across
            // every agent (already in agentRuntime via K-3), filter to
            // act + ask (skip is noise; error is rare), sort desc, take
            // the most recent ~12. Each row links to its agent's runtime
            // card for the full reasoning + timeline.
            const feed = [];
            for (const agentId of Object.keys(agentRuntime || {})) {
              const a = AGENT_NAME_BY_ID[agentId] || agentId;
              for (const r of agentRuntime[agentId].runs || []) {
                if (r.decision !== 'act' && r.decision !== 'ask') continue;
                feed.push({ ...r, agentId, agentName: a });
              }
            }
            feed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const top = feed.slice(0, 12);
            if (top.length === 0) {
              return (
                <div style={{ padding: '12px 18px 6px', fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  {t('sidebar.activity.empty')}
                </div>
              );
            }
            return top.map((r) => <ActivityFeedRow key={r.id} run={r} onOpenAgent={onOpenAgent} />);
          })()}
        </SidebarSection>
      </div>

      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.1,
          color: 'var(--text-dim)',
        }}
      >
        {t('sidebar.footer')}
      </div>
    </aside>
  );
}

const SECTION_COLLAPSE_KEY = 'merlin-sidebar-section-collapsed';
function loadCollapsedSections() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(SECTION_COLLAPSE_KEY) || '{}');
  } catch {
    return {};
  }
}
function persistCollapsedSections(map) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SECTION_COLLAPSE_KEY, JSON.stringify(map));
  } catch {}
}

function SidebarSection({ id, title, right, children }) {
  const [collapsed, setCollapsed] = useState(() => !!loadCollapsedSections()[id]);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (id) {
      const map = loadCollapsedSections();
      map[id] = next;
      persistCollapsedSections(map);
    }
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 16px 6px 18px',
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.1,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        <button
          onClick={toggle}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            font: 'inherit',
            letterSpacing: 'inherit',
            textTransform: 'inherit',
            cursor: 'pointer',
          }}
        >
          <Icon.chevD
            size={9}
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s', opacity: 0.6 }}
          />
          <span>{title}</span>
        </button>
        {right}
      </div>
      {!collapsed && children}
    </div>
  );
}

function SidebarRow({ icon, title, sub, right, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className="sidebar-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px 6px 18px',
        margin: '0 6px',
        borderRadius: 7,
        cursor: onClick ? 'pointer' : 'default',
        background: active ? 'var(--accent-soft)' : 'transparent',
        transition: 'background .12s',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--surface-3)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ width: 16, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: active ? 'var(--accent)' : 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

// Per-agent row in the live sidebar list. Calls useTranslatedText on
// the free-form `decision_reason` / `latestAction.summary` so a French
// reader sees on-read translations of writer-language reasoning.
function AgentLiveRow({ agent: a, live, latestAction, onOpenAgent }) {
  const t = useT();
  const hasAnyLive = !!(live || latestAction);
  const liveCount = hasAnyLive ? (live?.actionsToday ?? 0) : null;
  const pendingAsks = live?.pendingAsks ?? 0;
  // When the agent has run today but nothing has landed downstream yet
  // (count=0), surface its unresolved asks so the row reads as "alive,
  // awaiting your review" instead of a flat dead-looking 0.
  const showAwaiting = liveCount === 0 && pendingAsks > 0;
  const lastReason = live?.lastRun?.decision_reason || '';
  const sourceSub = latestAction?.summary || (lastReason ? truncateForSidebar(lastReason) : '');
  // Tier C: translate free-form reasoning on read. Empty input
  // short-circuits the hook so we don't pay for needless work.
  const translatedSub = useTranslatedText(sourceSub);
  const liveSub = sourceSub ? translatedSub || sourceSub : null;
  const isPulsing = a.status === 'active' && hasAnyLive;
  const rightTitle = showAwaiting
    ? t(pendingAsks === 1 ? 'sidebar.awaiting_one' : 'sidebar.awaiting_many', { n: pendingAsks })
    : liveCount != null
      ? t(liveCount === 1 ? 'sidebar.actions_one' : 'sidebar.actions_many', { n: liveCount })
      : null;
  return (
    <SidebarRow
      onClick={onOpenAgent ? () => onOpenAgent(a.id) : null}
      icon={<Dot tone={a.status === 'active' ? 'ok' : 'warn'} pulse={isPulsing} />}
      title={a.name}
      sub={liveSub || (hasAnyLive ? t('sidebar.standing_by') : a.tag)}
      right={
        liveCount != null ? (
          <span
            title={rightTitle}
            style={{
              fontSize: 10,
              color: showAwaiting ? 'var(--warn)' : liveCount > 0 ? 'var(--accent)' : 'var(--text-dim)',
              fontFamily: 'var(--mono)',
              fontWeight: showAwaiting || liveCount > 0 ? 700 : 400,
            }}
          >
            {showAwaiting ? `${pendingAsks}·` : liveCount}
          </span>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{a.actions}</span>
        )
      }
    />
  );
}

// One row in the live activity feed. Same Tier C pattern as
// AgentLiveRow — useTranslatedText on the per-run reasoning.
function ActivityFeedRow({ run: r, onOpenAgent }) {
  const t = useT();
  const tone = r.decision === 'act' ? 'ok' : 'warn';
  const reason = r.decision_reason || '';
  const sourceSub = reason.length > 60 ? reason.slice(0, 57) + '…' : reason;
  const translatedSub = useTranslatedText(sourceSub);
  const sub = sourceSub ? translatedSub || sourceSub : '';
  return (
    <SidebarRow
      onClick={onOpenAgent ? () => onOpenAgent(r.agentId) : null}
      icon={<Dot tone={tone} pulse={false} />}
      title={`${r.agentName} · ${r.decision === 'act' ? t('sidebar.activity.acted') : t('sidebar.activity.called_for_action')}`}
      sub={sub || t('sidebar.activity.no_reason')}
      right={
        <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
          {relTimeShort(r.created_at)}
        </span>
      }
    />
  );
}

function SidebarFooterLink({ children, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '4px 18px',
        fontSize: 11,
        color: 'var(--accent)',
        cursor: onClick ? 'pointer' : 'default',
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

// Exported so the TopBar can host it directly (Phase H-7). The
// `compact` flag swaps the dense 3-line layout for a single-row pill
// that fits the 56px topbar without clipping. The dropdown content
// is identical in both modes. Calls useT() internally so external
// callers (TopBar) don't have to thread the translator through.
export function BuildingSwitcher({ building, compact = false }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const allBuildings = useBuildingsForActiveOrg();
  // Live device counts per location, derived from the actual devices
  // table. Falls back to b.displays / b.sensors (the static columns
  // on locations) until the hook resolves so the picker doesn't blink
  // empty on first paint. Once live counts arrive they take precedence
  // \u2014 locations.displays / sensors are seed-time snapshots and drift
  // as devices get added.
  const fleetCounts = useFleetCountsByLocation();

  // Workspace memberships \u2014 moved out of UserMenu so the location selector
  // owns both layers of "where you are" (which org \u2192 which building).
  const session = useSession();
  // Workspace switcher list \u2014 every non-deleted, non-adaptiv org the user
  // belongs to, with their role. Fetch + shaping live in the query hook.
  const { data: memberships = [] } = useWorkspaceMemberships(session?.userId);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const timer = setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
    };
  }, [open]);

  const subLabel = (b) => {
    const live = fleetCounts?.get(b.id);
    if (b.kind === 'ecosystem') {
      if (b.variant === 'imf') {
        const displays = live?.displays ?? b.displays;
        const counters = live?.sensors ?? b.sensors;
        return `${b.branches} ${t('ecosystem.buildings')} \u00b7 ${t('switcher.devices.displays', { n: displays })} \u00b7 ${t('switcher.devices.counters', { n: counters })}`;
      }
      return `${b.branches} ${t('ecosystem.branches')} \u00b7 ${t('switcher.region.ny')}`;
    }
    const displays = live?.displays ?? b.displays ?? 0;
    const sensors = live?.sensors ?? b.sensors ?? 0;
    const loggers = live?.loggers ?? 0;
    const parts = [
      t('switcher.devices.displays', { n: displays.toLocaleString() }),
      t('switcher.devices.sensors', { n: sensors.toLocaleString() }),
    ];
    if (loggers > 0) parts.push(t('switcher.devices.loggers', { n: loggers.toLocaleString() }));
    return parts.join(' \u00b7 ');
  };

  const setBuilding = (id) => {
    try {
      window.setMerlinTweaks?.({ building: id });
    } catch {}
    setOpen(false);
  };

  const iconSize = compact ? 22 : 28;
  return (
    <div
      style={{ position: 'relative', minWidth: compact ? 200 : undefined, maxWidth: compact ? 320 : undefined }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 8 : 10,
          padding: compact ? '5px 10px' : '8px 10px',
          // Compact pill (in TopBar) matches the icon rail's
          // surface-80% mix so the BuildingSwitcher reads as part of
          // the same surface family as the rail and the topbar.
          background: compact ? 'color-mix(in oklch, var(--surface) 80%, transparent)' : 'var(--surface-3)',
          border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: compact ? 8 : 10,
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <div
          style={{
            width: iconSize,
            height: iconSize,
            // No box — the brand icon renders directly in pink. The transparent
            // wrapper just reserves a square footprint so the label aligns.
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          {building.kind === 'ecosystem' ? (
            <Icon.campus size={compact ? 18 : 24} />
          ) : (
            <Icon.building2 size={compact ? 18 : 24} />
          )}
        </div>
        {compact ? (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{building.name}</span>
          </div>
        ) : (
          <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
            <BreadcrumbLine locationId={building.id} />
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {building.name}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--text-dim)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subLabel(building)}
            </div>
          </div>
        )}
        <Icon.chevD
          size={11}
          style={{
            color: 'var(--text-dim)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: compact ? 320 : '100%',
            minWidth: 280,
            padding: 6,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            zIndex: 100,
            maxHeight: 480,
            overflowY: 'auto',
          }}
        >
          {memberships.length > 1 && (
            <>
              <div
                style={{
                  padding: '8px 10px 4px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.15,
                }}
              >
                {t('switcher.workspaces')}
              </div>
              {memberships.map((m) => {
                const isActive = m.id === session?.organizationId;
                return (
                  <button
                    key={m.id}
                    onClick={async () => {
                      if (isActive) {
                        setOpen(false);
                        return;
                      }
                      try {
                        await switchOrg(m.id);
                      } catch (ex) {
                        alertDialog(ex.message || t('menu.switch_failed'));
                      }
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 10px',
                      borderRadius: 7,
                      marginBottom: 2,
                      background: isActive ? 'var(--accent-soft)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--text-soft)',
                      border: `1px solid ${isActive ? 'var(--accent-line)' : 'transparent'}`,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isActive ? 'default' : 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'var(--surface-2)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Icon.sparkle size={11} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}
                    </span>
                    {isActive && (
                      <span style={{ fontSize: 9.5, color: 'var(--accent)', fontWeight: 700 }}>{t('menu.active')}</span>
                    )}
                  </button>
                );
              })}
              <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />
            </>
          )}
          <div
            style={{
              padding: '8px 10px 4px',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.15,
            }}
          >
            {t('ecosystem.switch')}
          </div>
          {/* Sort + group: each top-level item is followed by its
              direct children, so the visual order reads as
              "Ecosystem → Region → Region → next Ecosystem".
              breadcrumbFor() walks parentId; depth=0 means top-level
              (parent ecosystem / building), depth>=1 means nested
              region. The render renders a 'REGIONS' subheader before
              the first sub-row of each parent so the hierarchy is
              scannable, and indents + reskins child rows so they
              read as 'Region', not 'Ecosystem'. */}
          {(() => {
            const items = Object.values(allBuildings).map((b) => {
              const chain = breadcrumbFor(b.id);
              return { b, depth: Math.max(0, chain.length - 1), parentId: b.parentId || null };
            });
            // Stable parent-then-children ordering: top-levels in
            // their natural order, each followed by its children
            // (also natural order). Items with a parent that ISN'T
            // in the picker fall back to top-level slot.
            const byParent = new Map();
            for (const it of items) {
              const k = it.parentId && items.some((x) => x.b.id === it.parentId) ? it.parentId : '__root__';
              if (!byParent.has(k)) byParent.set(k, []);
              byParent.get(k).push(it);
            }
            const sorted = [];
            for (const top of byParent.get('__root__') || []) {
              sorted.push(top);
              const kids = byParent.get(top.b.id) || [];
              for (const k of kids) sorted.push(k);
            }
            // Scan-by row to know whether to emit the REGIONS
            // subheader before this sub-item (only before the first
            // sub-item of each parent group).
            const lastDepthByParent = new Map();
            return sorted.map((it) => {
              const { b, depth, parentId } = it;
              const active = b.id === building.id;
              const isEco = b.kind === 'ecosystem';
              const isSub = depth >= 1;
              const groupKey = parentId || '__root__';
              const showGroupHeader = isSub && lastDepthByParent.get(groupKey) !== 'sub';
              if (isSub) lastDepthByParent.set(groupKey, 'sub');
              return (
                <React.Fragment key={b.id}>
                  {showGroupHeader && (
                    <div
                      style={{
                        padding: '6px 10px 2px ' + (10 + 12) + 'px',
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: 'var(--text-faint)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.2,
                      }}
                    >
                      {t('switcher.regions')}
                    </div>
                  )}
                  <button
                    onClick={() => setBuilding(b.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      // Indent sub-rows so the parent/region hierarchy
                      // reads at a glance. Left border on sub-rows acts
                      // as a tree-line connector to the parent row above.
                      padding: '8px 10px 8px ' + (10 + (isSub ? 18 : 0)) + 'px',
                      borderRadius: 7,
                      background: active ? 'var(--accent-soft)' : 'transparent',
                      border: 'none',
                      borderLeft: isSub ? '2px solid var(--border)' : '2px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = 'var(--surface-2)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        width: isSub ? 22 : 26,
                        height: isSub ? 22 : 26,
                        flexShrink: 0,
                        // No box — brand icon renders directly in pink.
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isEco ? <Icon.campus size={isSub ? 18 : 22} /> : <Icon.building2 size={isSub ? 18 : 22} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!isSub && <BreadcrumbLine locationId={b.id} compact />}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: isSub ? 12 : 12.5,
                            fontWeight: isSub ? 600 : 700,
                            color: active ? 'var(--accent)' : 'var(--text)',
                          }}
                        >
                          {b.name}
                        </span>
                        {isEco &&
                          (isSub ? (
                            <Pill tone="neutral">{t('switcher.region.pill')}</Pill>
                          ) : (
                            <Pill tone="info">{t('ecosystem.label')}</Pill>
                          ))}
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: 'var(--text-dim)',
                          marginTop: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {b.addr}
                      </div>
                    </div>
                    {active && <Icon.check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                  </button>
                </React.Fragment>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

// Renders "Parent › Sub-parent › " above a location name when the
// location has ancestors. Empty render when it's top-level.
function BreadcrumbLine({ locationId, compact }) {
  const chain = breadcrumbFor(locationId).slice(0, -1);
  if (chain.length === 0) return null;
  return (
    <div
      style={{
        fontSize: compact ? 9.5 : 10,
        color: 'var(--accent)',
        fontWeight: 600,
        letterSpacing: 0.1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginBottom: 1,
      }}
    >
      {chain.map((c) => c.name).join(' › ')} ›
    </div>
  );
}

// Vertical drag handle on the right edge of the sidebar.
// Drag right → wider sidebar · drag left → narrower.
function SidebarResizeHandle({ onResize, dragging, setDragging }) {
  const t = useT();
  const dragRef = useRef({ startX: 0, startWidth: 0 });

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = e.clientX - dragRef.current.startX;
      const next = Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, dragRef.current.startWidth + dx));
      onResize(next);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, onResize, setDragging]);

  const onMouseDown = (e) => {
    const aside = e.currentTarget.parentElement;
    dragRef.current = { startX: e.clientX, startWidth: aside.getBoundingClientRect().width };
    setDragging(true);
  };
  const onDoubleClick = () => onResize(SIDEBAR_WIDTH_DEFAULT);

  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title={t('sidebar.resize_handle')}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: 6,
        marginRight: -3,
        cursor: 'col-resize',
        zIndex: 5,
        background: dragging ? 'color-mix(in oklch, var(--accent) 35%, transparent)' : 'transparent',
        transition: dragging ? 'none' : 'background .12s',
      }}
      onMouseEnter={(e) => {
        if (!dragging) e.currentTarget.style.background = 'color-mix(in oklch, var(--accent) 18%, transparent)';
      }}
      onMouseLeave={(e) => {
        if (!dragging) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: 1,
          transform: 'translateY(-50%)',
          width: 2,
          height: 36,
          borderRadius: 2,
          background: dragging ? 'var(--accent)' : 'var(--border-strong)',
          opacity: dragging ? 1 : 0.5,
        }}
      />
    </div>
  );
}

// K-21: trim a model's full reasoning down to something the narrow
// sidebar row can show without wrapping. The "Reads from" sub-line
// has room for ~40 chars before ellipsis kicks in.
function truncateForSidebar(s) {
  if (!s) return null;
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > 60 ? t.slice(0, 57) + '…' : t;
}

// K-22: very compact relative time for the activity feed right-cell.
// Renders 'now', '3m', '1h', '4h', '2d' — no longer-form variants.
function relTimeShort(iso) {
  if (!iso) return '';
  const ageMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ageMs / 1000);
  if (sec < 60) return tStatic('sidebar.rel.now');
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  const hr = Math.floor(sec / 3600);
  if (hr < 48) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}
