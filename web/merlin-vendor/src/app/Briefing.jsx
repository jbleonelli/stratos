// Briefing — the "what do I need to know?" landing view.
// Phase 6 redesign: the central content is now a 3D building view
// showing the top 3 CTAs (pending asks) on the floors where they
// fired. The old attention-card list lives on as a fallback for
// orgs without 3D-ready data, but Meridian + Hemisphere + IMF all
// render the spatial view by default.
import React, { Suspense, lazy, useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card, AdaptivLoader } from './primitives.jsx';
import { useT } from './i18n.js';
import { useSession } from './auth.js';
import { handleIncident } from './simulator.js';
import { useLatestAgentActions, useRecentResolvedAgentRuns } from './agent-runs.js';
import { useEventsForBuilding, resolveEvent } from './events.js';
import { useAgentActionRenderer } from './ask-render.js';
import { useFormatRelative } from './locale-format.js';
import { useTranslatedText } from './event-translations.js';
import { StadiumLiveBoard } from './StadiumLiveBoard.jsx';
import { StadiumHeatmap } from './StadiumHeatmap.jsx';
import { StadiumSchedule } from './StadiumSchedule.jsx';
import { GetStartedCard } from './GetStartedCard.jsx';
import { useMyDayContent } from './myday-content.js';

// Lazy-load the 3D viewer so the three.js bundle (~225 KB gzipped)
// only ships when My Day actually mounts. App.jsx already lazy-loads
// the whole Briefing module, so this is a second-level split.
const HypervisorViewer3D = lazy(() => import('./HypervisorViewer3D.jsx'));

// "Since you last checked, Merlin handled these" only counts items handled
// within this window. Keeps the section honest about recency instead of
// surfacing the newest-N resolutions no matter how old (which read as
// stale beside the live attention cards). 48h ≈ "since you were last on".
const HANDLED_RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;

const PRIORITY_TONE = { critical: 'risk', high: 'warn', medium: 'info', info: 'neutral' };
const ICON_MAP = {
  air: 'air',
  people: 'people',
  sla: 'sla',
  room: 'room',
  warn: 'warn',
  supply: 'supply',
  hvac: 'hvac',
  building: 'building',
  shield: 'shield',
  light: 'light',
  bolt: 'bolt',
  check: 'check',
  sparkle: 'sparkle',
  bell: 'bell',
  wifi: 'wifi',
};

// Per-action-kind icon + tone. Mirrors the AgentActionPill mapping on
// Dashboard.jsx so the visual language stays consistent across surfaces.
const ACTION_KIND_ICON = {
  setpoint_change: 'bolt',
  supply_order: 'supply',
  booking_release: 'floor',
  setback_proposal: 'bolt',
  audit_evidence: 'shield',
  escalation: 'badge',
  // Resolved-ask kinds (see toResolvedActionShape in agent-runs.js).
  // Approve / Hold / Dismiss don't map to a downstream action table —
  // they're the human's verb on an agent's ask — so the icon reflects
  // the verb rather than the agent's domain. Icon set is whatever
  // src/app/icons.jsx exposes — `pause`/`clock` don't exist so we
  // fall back to neighbouring glyphs.
  approved: 'check',
  on_hold: 'sla',
  dismissed: 'close',
  resolved: 'check',
  expired: 'bell',
};

// Per-role allow-list of agent IDs whose actions should appear in the
// briefing's "Merlin handled" section. Same shape as the whitelist in
// roles.pickAgentsForRole — kept local so a future tweak to the
// briefing's role-scoping doesn't ripple into the dashboard's agent
// grid filter.
const HANDLED_AGENTS_BY_ROLE = {
  superadmin: null, // null = all agents
  property_manager: null,
  facility: ['cleaning', 'hvac', 'space', 'supply', 'energy', 'compliance', 'security', 'parking'],
  fm_network: ['cleaning', 'space', 'energy'],
  auditor: ['compliance', 'security'],
  cleaning: ['cleaning', 'space', 'supply'],
  maintenance: ['hvac', 'energy'],
  security: ['security', 'compliance'],
  executive: ['cleaning', 'hvac', 'space', 'energy', 'compliance', 'security'],
  tenant: ['cleaning', 'space', 'hvac'],
};

export function BriefingPage({
  building,
  role,
  incidents,
  onOpenChat,
  onOpenIncident,
  onGoDashboard: _onGoDashboard,
  onView,
}) {
  const t = useT();
  const critical = incidents.filter((i) => i.priority === 'critical');
  const high = incidents.filter((i) => i.priority === 'high');
  const attention = [...critical, ...high].slice(0, 3);
  const calm = attention.length === 0;

  const session = useSession();
  const firstName = (session?.name || role.who || '').split(' ')[0];

  // Overridable hero copy from /platform/content (key='myday_content').
  // Each field falls back to its i18n default when unset, so no override
  // = current behavior. {n}/{name} placeholders are interpolated here.
  const mydayContent = useMyDayContent().value;
  const interp = (tpl) =>
    String(tpl)
      .replace(/\{n\}/g, attention.length)
      .replace(/\{name\}/g, firstName);
  const eyebrowLabel = mydayContent.eyebrow || t('briefing.label');
  const heroTitle = calm
    ? mydayContent.calm_title
      ? interp(mydayContent.calm_title)
      : t('briefing.calm.title', { name: firstName })
    : (() => {
        const ovr = attention.length === 1 ? mydayContent.attention_title_one : mydayContent.attention_title_many;
        return ovr
          ? interp(ovr)
          : t(attention.length === 1 ? 'briefing.attention.title_one' : 'briefing.attention.title_many', {
              n: attention.length,
              name: firstName,
            });
      })();
  const heroSub = calm
    ? mydayContent.calm_sub || t('briefing.calm.sub')
    : mydayContent.attention_sub || t('briefing.attention.sub');

  // Real "Merlin handled these" — pulled from two sources, merged:
  // (1) per-agent action tables via useLatestAgentActions (agent
  //     successfully wrote a downstream row: setpoint change, supply
  //     order, route override, etc).
  // (2) recently-resolved agent_runs via useRecentResolvedAgentRuns
  //     (Approve/Hold/Dismiss on a CTA whose agent has no
  //     action_payload — e.g. simulator/heartbeat rows). Without
  //     this stream the handled card stayed stale after Approve
  //     clicks on most My Day CTAs. PR #665.
  // Both shapes are unified to {agentId, kind, legacySummary,
  // applied_at, tone}, sorted newest-first, top 3 shown. Scoped to
  // the active building.
  const latestActions = useLatestAgentActions(session?.organizationId, building?.id);
  const resolvedAsks = useRecentResolvedAgentRuns(session?.organizationId, building?.id, 10);
  const handledItems = React.useMemo(() => {
    const allow = HANDLED_AGENTS_BY_ROLE[role.id];
    const fromActions = Object.values(latestActions || {});
    const merged = [...fromActions, ...resolvedAsks];
    const scoped = allow == null ? merged : merged.filter((a) => allow.includes(a.agentId));
    // Bound to a recent window. The "since you last checked" framing
    // implies recency, but the underlying sources are "newest N
    // regardless of age" — so on a building with live pending asks but
    // no recent resolutions (e.g. a replay org mid-window), the newest
    // handled items can be days old and read as stale next to the live
    // attention cards. When nothing's been handled lately, fall to the
    // calm empty-state rather than surfacing day-old items as "recent".
    const cutoff = Date.now() - HANDLED_RECENT_WINDOW_MS;
    return scoped
      .filter((a) => a.applied_at && new Date(a.applied_at).getTime() >= cutoff)
      .sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at))
      .slice(0, 3);
  }, [latestActions, resolvedAsks, role.id]);

  // Top 3 pending asks for the building — power the 3D view's CTA
  // floors. Sorted newest first (the hook's initial fetch is already
  // ordered desc; we just flatten + slice).
  // PR #761: My day attention reads events. Backfill migration 168
  // populated events from existing pending agent_runs, so the top-3
  // list reflects the same dataset (now joined with agent_run state
  // for decision_reason / ask_resolution). resolveEvent updates both
  // events.resolved AND agent_runs.ask_resolution in lockstep.
  const myDayEvents = useEventsForBuilding(session?.organizationId, building?.id, {
    includeResolved: false,
    processingState: 'awaiting_human',
    limit: 50,
  });

  // Ids the operator just resolved (approve/hold) — dropped from the canvas
  // optimistically so the card leaves on click instead of waiting on the
  // events realtime round-trip. resolveEvent still persists; realtime
  // reconciles the source of truth. Cleared on building switch.
  const [dismissedIds, setDismissedIds] = React.useState(() => new Set());
  React.useEffect(() => {
    setDismissedIds(new Set());
  }, [building?.id]);
  const dismissCta = React.useCallback((id) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const ctaRows = useMemo(() => {
    // Primary source: agent-decided asks awaiting human review (Approve/
    // Hold actually wires through to resolveEvent + apply-ask). These are
    // the high-fidelity "you need to act on this" items.
    if (myDayEvents.length > 0) {
      const visible = myDayEvents.filter((e) => !dismissedIds.has(e.id));
      return visible.slice(0, 3).map((e) => ({
        id: e.id,
        location_id: e.location_id,
        color: '#ef4444',
        title: e.decision_reason || e.payload?.title || `${e.kind} requires review`,
        body: null,
        priority: 'attention',
        agentId: e.processed_by_agent_id || e.kind,
        // Fields the MessageDrawer (opened by the card's Details button)
        // renders. Without these it fell back to a bare "agent" header
        // with only Run id + Location id. Mirror Hypervisor.jsx's ctaRows
        // so My Day's drawer is as hydrated as the Hypervisor's. `raw: e`
        // lets the drawer surface action_payload / inputs / runtime too.
        agent_id: e.processed_by_agent_id || e.kind,
        decision: e.decision,
        decision_reason: e.decision_reason,
        confidence: e.confidence,
        ask_resolution: e.ask_resolution,
        ask_resolved_at: e.ask_resolved_at,
        created_at: e.created_at,
        raw: e,
        onApprove: () => {
          dismissCta(e.id);
          resolveEvent(e.id, 'approve');
        },
        onHold: () => {
          dismissCta(e.id);
          resolveEvent(e.id, 'hold');
        },
      }));
    }
    // Fallback: the simulator's curated critical/high incidents (same
    // pool the hero's "N things need your attention" counts). Surfaces
    // demo content on the 3D viewer when no agent asks are pending —
    // otherwise the building reads empty after the stale-ask sweep,
    // which contradicts the hero saying there ARE things to handle.
    // No agent_run to flip, so onApprove/onHold mutate the simulator's
    // in-memory pool instead (handleIncident drops the incident from
    // the queue locally — close enough for demo purposes).
    return attention.slice(0, 3).map((inc) => ({
      id: 'sim-' + inc.id,
      location_id: simIncidentLocation(inc, building?.id),
      color: inc.priority === 'critical' ? '#ef4444' : '#f59e0b',
      title: inc.title,
      body: inc.sub || null,
      priority: 'attention',
      agentId: null,
      onApprove: () => {
        try {
          handleIncident(inc.id, 'approve', session?.name || 'you');
        } catch {
          /* noop */
        }
      },
      onHold: () => {
        try {
          handleIncident(inc.id, 'hold', session?.name || 'you');
        } catch {
          /* noop */
        }
      },
    }));
  }, [myDayEvents, dismissedIds, dismissCta, attention, building?.id, session?.name]);

  // Pull a building-relative floor location_id out of a simulator
  // incident. Mirrors the helper inside simulator-events-bridge.js so
  // the floor pill on the 3D viewer lands at the same spot the bridge
  // would have written. params.fl is the canonical floor number; we
  // also try a "Floor NN" regex on the title as a last-ditch fallback.
  function simIncidentLocation(inc, buildingId) {
    if (!buildingId) return null;
    const fl =
      inc?.params?.fl ??
      (typeof inc?.title === 'string' && /\bFloor\s+(\d+)\b/i.test(inc.title)
        ? Number((inc.title.match(/\bFloor\s+(\d+)\b/i) || [])[1])
        : null);
    return Number.isFinite(fl) ? `${buildingId}-fl-${fl}` : buildingId;
  }
  // PR #671: no longer gate on ctaRows.length > 0. The hydration race
  // meant ctaRows started empty and the old AttentionCard layout
  // briefly flashed on every page load / refresh before usePending-
  // AsksByLocation populated. Always render the viewer when we have
  // building + org context; its own "all quiet" empty state (PR
  // #645) covers the no-CTAs case much better than falling back to
  // the legacy simulator-driven list.
  const useMyDay3D = !!building?.id && !!session?.organizationId;

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        // PR #673: top padding now matches the side padding (var(--pad))
        // so the TOP gap equals the LEFT gap — symmetric inset around
        // the banner card. Bottom keeps the extra room (var(--pad) * 2)
        // for breathing space below the handled-actions list.
        padding: 'var(--pad) var(--pad) calc(var(--pad) * 2)',
        // PR #703: alignItems flex-start (was center) lets content stretch
        // to the full inner width via children's width:100%; without this
        // the inner wrapper centered at maxWidth 1240 left big gutters on
        // wide screens.
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 'var(--pad)',
      }}
    >
      {/* PR #674: display:contents on the wrapper so it doesn't
          participate in the flex layout. All four children return
          null for non-stadium / established tenants → with the old
          wrapper, the empty div STILL ate a var(--pad) gap from
          main's flex spacing, leaving ~32px between the central card
          top and the banner card even after #672/#673 tightened
          padding. display:contents promotes children to direct flex
          children so gaps only apply between rendered components. */}
      <div style={{ display: 'contents' }}>
        <GetStartedCard organizationId={session?.organizationId} onOpenChat={onOpenChat} />
        <StadiumLiveBoard building={building} orgId={session?.organizationId} />
        <StadiumHeatmap building={building} orgId={session?.organizationId} />
        <StadiumSchedule building={building} orgId={session?.organizationId} />
      </div>

      {/* PR #701: collapsed the 2-column grid (banner + product
          showcase) into a single full-width column per JB. The
          viewer card and handled-actions card now use the full
          width of the main content area. ProductShowcase is no
          longer rendered. */}
      <div
        style={{
          // PR #703: removed maxWidth:1240 per JB. Content now uses the
          // full width of the central card (minus main's var(--pad)
          // side padding) on any viewport.
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--pad)',
          alignItems: 'stretch',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)', minWidth: 0 }}>
          {/* Banner */}
          <Card pad={false} style={{ overflow: 'hidden', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: calm
                  ? 'radial-gradient(600px 280px at 85% 0%, color-mix(in oklch, var(--ok) 16%, transparent), transparent 60%)'
                  : 'radial-gradient(600px 280px at 85% 0%, color-mix(in oklch, var(--accent) 20%, transparent), transparent 60%)',
                pointerEvents: 'none',
              }}
            />
            {/* PR #670: tightened top padding (var(--pad)*1.3 → 14px) so
              the eyebrow sits close to the card's top edge, per JB.
              Bottom padding stays at var(--pad)*1.3 to preserve the
              breathing room below the description copy. */}
            <div style={{ padding: '14px var(--pad) calc(var(--pad) * 1.3)', position: 'relative' }}>
              {/* PR #668: eyebrow lives inside the banner card, just
                above the H1. JB asked for it tight to the card edge;
                in-card placement is the cleanest way to keep that
                relationship at any spacing the surrounding layout
                imposes. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {/* PR #701: yellow pulsing dot removed per JB. The
                  eyebrow text alone carries the section label. */}
                <div
                  style={{
                    fontSize: 11.5,
                    letterSpacing: 0.2,
                    textTransform: 'uppercase',
                    color: 'var(--text-dim)',
                    fontWeight: 700,
                  }}
                >
                  {eyebrowLabel} · {building.name}
                  {building.variant &&
                    t(`briefing.variant.${building.variant}`) !== `briefing.variant.${building.variant}` && (
                      <>
                        {' '}
                        · {t(`briefing.variant.${building.variant}`)}
                        {building.sqft && building.sqft !== '—'
                          ? ` · ${building.sqft} ${t('briefing.sqft_suffix')}`
                          : ''}
                      </>
                    )}{' '}
                  · {role.name}
                </div>
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 34,
                  fontWeight: 800,
                  letterSpacing: -0.02,
                  lineHeight: 1.1,
                  color: 'var(--text)',
                }}
              >
                {heroTitle}
              </h1>
              <p
                style={{
                  margin: '10px 0 0',
                  fontSize: 14.5,
                  color: 'var(--text-soft)',
                  lineHeight: 1.55,
                  maxWidth: 620,
                }}
              >
                {heroSub}
              </p>
            </div>
          </Card>

          {/* 3D building view with the top 3 pending-ask CTAs pinned
            to their floors in red. Replaces the flat attention-card
            list with a spatial overview — the operator sees where
            the actions are happening, not just what they are.
            Falls back to the legacy AttentionCard list when no
            pending asks exist (e.g. fresh tenant, all-clear day). */}
          {useMyDay3D ? (
            <Card pad={false} style={{ overflow: 'hidden', height: 520, position: 'relative' }}>
              <Suspense
                fallback={
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AdaptivLoader size="md" />
                  </div>
                }
              >
                <HypervisorViewer3D buildingId={building?.id} orgId={session?.organizationId} ctas={ctaRows} />
              </Suspense>
            </Card>
          ) : !calm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {attention.map((inc) => (
                <AttentionCard
                  key={inc.id}
                  incident={inc}
                  onOpen={() => onOpenIncident?.(inc.id)}
                  onAsk={() => onOpenChat?.(t('briefing.tell_me_about', { title: inc.title }))}
                />
              ))}
            </div>
          ) : null}

          {/* Merlin handled — real agent actions from the last activity
            window, scoped to the role's allowed agents. Rows click
            through to OPERATE → Activity (PR #675). */}
          <HandledSection
            items={handledItems}
            loaded={resolvedAsks.loaded !== false}
            onOpenActivity={() => onView?.('activity')}
          />

          {/* PR #675: dive-deeper buttons removed per JB. The two
            CTAs ("Open the full dashboard" + "Ask Merlin anything")
            duplicated the sidebar nav + the always-open chat panel
            and felt redundant against the new live-hydrated handled
            rows. */}
        </div>
        {/* /content column */}
      </div>
    </main>
  );
}

// Renders the "Since you last checked, Merlin handled these" card.
// Each item is a real agent action from the action tables (one row per
// agent), localized through useAgentActionRenderer so the summary
// honours the user's language. Empty state when no agent has fired yet.
function HandledSection({ items, loaded = true, onOpenActivity }) {
  const t = useT();
  const renderAction = useAgentActionRenderer();
  const fmtRel = useFormatRelative();

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon.sparkle size={14} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('briefing.handled.title')}</div>
      </div>

      {!loaded && items.length === 0 ? (
        // Initial hydration: show the loader instead of an empty-state
        // flash followed by a snap-in. useRecentResolvedAgentRuns
        // takes ~1s on multi-building tenants and the cross-source
        // merge in handledItems re-sorts visibly when it lands.
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <AdaptivLoader size="sm" />
        </div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>{t('briefing.handled.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((action) => (
            <HandledRow
              key={action.agentId + ':' + action.applied_at}
              action={action}
              renderAction={renderAction}
              fmtRel={fmtRel}
              onOpen={onOpenActivity}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// Extracted so we can call useTranslatedText per row (hooks can't run
// inside .map()). The structured-template reason from renderAgentAction
// (ask.<kind>.body.<reason_code>) goes through as-is — already
// localized. When the row only has the writer-supplied free-form English
// `reason`, route it through the on-read translation cache so French
// readers see French prose. Empty/null reasons short-circuit cleanly.
function HandledRow({ action, renderAction, fmtRel, onOpen }) {
  const { summary, reason } = renderAction(action);
  // Same content-addressable cache used by AgentDetailView's RunRow —
  // first paint shows the source string, second paint swaps in the
  // translation after Haiku replies (typically <1s with cache warm).
  const translatedReason = useTranslatedText(reason || '');
  const IconC = Icon[ACTION_KIND_ICON[action.kind] || 'sparkle'] || Icon.sparkle;
  const tone = action.tone || 'accent';
  const when = fmtRel(action.applied_at);
  // PR #675: clickable rows → OPERATE → Activity (operator's full
  // work queue). Hover background to signal interactivity.
  const clickable = !!onOpen;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: 8,
        margin: -8,
        borderRadius: 8,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background .12s',
      }}
      onMouseEnter={(e) => {
        if (clickable) e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        if (clickable) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `color-mix(in oklch, var(--${tone}) 14%, transparent)`,
          color: `var(--${tone})`,
        }}
      >
        <IconC size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* PR #675: wordBreak + overflowWrap ensures the title wraps
            cleanly even when the reason string doesn't have natural
            break opportunities (e.g. long agent-generated text). The
            old style had no wrap rule and was being clipped on
            single-line overflow. */}
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.4,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
          }}
        >
          {summary || action.legacySummary || '—'}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--text-dim)',
            marginTop: 2,
            lineHeight: 1.5,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
          }}
        >
          {when}
          {translatedReason ? ' · ' + translatedReason : ''}
        </div>
      </div>
    </div>
  );
}

function AttentionCard({ incident: inc, onOpen, onAsk }) {
  const t = useT();
  const priorityTone = PRIORITY_TONE[inc.priority] || 'info';
  const iconName = ICON_MAP[inc.icon] || 'warn';
  const IconC = Icon[iconName] || Icon.warn;
  // Incident copy comes from the per-vertical static snapshots in
  // simulator.js (MDE_INCIDENTS, MHC_INCIDENTS, …) as hardcoded English
  // strings. Route them through the on-read translation cache so French
  // readers see French prose. First paint shows the source string;
  // second paint swaps in the translation after Haiku replies. English
  // short-circuits inside useTranslatedText so this is a no-op for EN.
  const txTitle = useTranslatedText(inc.title || '');
  const txSub = useTranslatedText(inc.sub || '');
  const txSla = useTranslatedText(inc.sla || '');
  const txStatus = useTranslatedText(inc.status || '');

  return (
    <Card
      pad={false}
      style={{
        overflow: 'hidden',
        borderLeft: `3px solid var(--${priorityTone})`,
      }}
    >
      <div style={{ padding: 14, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            flexShrink: 0,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `color-mix(in oklch, var(--${priorityTone}) 14%, transparent)`,
            color: `var(--${priorityTone})`,
          }}
        >
          <IconC size={17} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{txTitle}</div>
            <Pill tone={priorityTone}>{t(`priority.${inc.priority}`)}</Pill>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.45, marginBottom: 6 }}>{txSub}</div>
          {inc.sla && (
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon.sla size={11} /> {txSla}
            </div>
          )}
          {inc.status && (
            <div style={{ fontSize: 11.5, color: 'var(--text-soft)', marginTop: 4, fontStyle: 'italic' }}>
              {txStatus}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button
            onClick={onOpen}
            style={{
              padding: '7px 12px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
            }}
          >
            {t('briefing.open')} <Icon.chevR size={10} />
          </button>
          <button
            onClick={onAsk}
            style={{
              padding: '7px 12px',
              background: 'transparent',
              color: 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
            }}
          >
            <Icon.sparkle size={10} /> {t('briefing.ask')}
          </button>
        </div>
      </div>
    </Card>
  );
}
