// Agentic — building-admin control surface for configuring Merlin and the
// agents that appear in the Agent bar. Access mirrors /admin
// (superadmin / facility / property_manager — see canAccessAgentic in
// auth.js). Cost-sensitive surfaces inside (Tick frequency card on the
// Agents tab + the SeedFrequencyCard under Sources → Simulator) are
// separately gated to the Merlin Owner only. Config state is persisted
// to merlin_config via agentic-data.js with sensible defaults merged in.
import React, { useMemo, useState, useEffect } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Dot, Card, AdaptivLoader } from './primitives.jsx';
import { ROLES } from './roles.js';
import { useT, t as tPlain } from './i18n.js';
import { useSession } from './auth.js';
import { useActiveOrg } from './org-data.js';
import { useServiceLine } from './service-line.js';
import { useBuildingAgentEntitlements } from './building-agent-entitlements.js';
import {
  useAgenticConfig,
  resetAgenticConfig,
  AUTONOMY_LEVELS,
  PERSONAS,
  PROACTIVE_PINGS,
  MODELS,
  PERMISSION_LEVELS,
  AGENT_ORDER,
  AGENT_GROUPS,
  agentIdsForGroup,
  agentsForServiceLine,
  RECENT_AGENT_ACTIONS,
  DATA_SOURCE_STATUSES,
  resolveDataSource,
} from './agentic-data.js';
import { TickFrequencyCard, SeedFrequencyCard, DeviceSeedSimulatorCard } from './agentic-frequency-cards.jsx';
import { AGENTS } from './data.js';
import { PlaybookEditor } from './PlaybookEditor.jsx';
import { FirehosePanel } from './DashboardFirehose.jsx';
import {
  useSourceCatalog,
  useSourceConnections,
  createCatalogEntry,
  updateCatalogEntry,
  deleteCatalogEntry,
  createConnection,
  updateConnection,
  deleteConnection,
  acceptSourceCatalog,
  actorRoleForCatalog,
  SIMULATOR_PAYLOAD_PROFILES,
} from './sources-data.js';
import { CatalogRow, CatalogForm, ConnectionRow, ConnectionForm, TabBtn, ErrBanner } from './sources-ui.jsx';
import { useBuildingsForActiveOrg } from './custom-locations.js';
import { confirmDialog } from './dialogs.jsx';

const SECTIONS = [
  { id: 'merlin', labelKey: 'agentic.section.merlin', icon: 'sparkle' },
  { id: 'agents', labelKey: 'agentic.section.agents', icon: 'grid' },
  { id: 'sources', labelKey: 'agentic.section.sources', icon: 'gateway' },
  // Firehose — live stream of every raw event in the workspace. Moved
  // here from the Dashboard super-admin sub-tab as part of the 5-pillar
  // topnav restructure. Whole Agentic page is already super-admin gated.
  { id: 'firehose', labelKey: 'agentic.section.firehose', icon: 'bolt' },
  { id: 'permissions', labelKey: 'agentic.section.permissions', icon: 'shield' },
  { id: 'audit', labelKey: 'agentic.section.audit', icon: 'sla' },
];

const AGENT_META = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

export function AgenticPage({ building, initialSection, initialAgentId, onEnableAgents } = {}) {
  const t = useT();
  const session = useSession();
  // Merlin Owner is the singleton "god mode" account (one human, enforced
  // by partial unique index on profiles.is_merlin_owner). Tick frequency
  // and the Simulator tab below directly drive Anthropic spend, so they
  // are gated to Owner only — Super Admins and below don't see them.
  const isMerlinOwner = !!session?.isMerlinOwner;
  // All sections are visible to everyone with Agentic access; the
  // Owner-only knobs that used to gate the whole Emulator tab now live
  // under Sources → Simulator and are gated inline (SeedFrequencyCard
  // drives Anthropic spend → Owner only; DeviceSeedSimulatorCard does
  // not → admin-accessible).
  const visibleSections = SECTIONS;
  const fallbackSectionId = () => {
    const requested = initialSection || 'merlin';
    return visibleSections.some((s) => s.id === requested) ? requested : visibleSections[0]?.id || 'merlin';
  };
  const [section, setSection] = useState(fallbackSectionId);
  // Building-scoped config. The Agentic page edits the active
  // building's overlay for 'merlin' and 'agents' sections; everything
  // else (tick/seed/device_seed/permissions/data_sources) is always
  // org-default. See agentic-data.js for the per-section routing.
  const [config, setConfig, ctx] = useAgenticConfig(building?.id || null);
  // Deep-link from Dashboard → Agents (autonomy pill click) lands here
  // with a target agentId. Switch to the Agents section + scroll the
  // matching card into view + briefly highlight it. Keyed by agentId
  // so re-clicking a different agent re-fires.
  const [highlightedAgentId, setHighlightedAgentId] = useState(null);
  useEffect(() => {
    if (initialSection && visibleSections.some((s) => s.id === initialSection)) {
      setSection(initialSection);
    }
  }, [initialSection, visibleSections]);
  // If the visible-sections set shrinks (e.g. session re-hydrates as
  // non-owner) and the active section becomes hidden, snap to the first
  // visible one so the right pane never renders against a stale id.
  useEffect(() => {
    if (!visibleSections.some((s) => s.id === section)) {
      setSection(visibleSections[0]?.id || 'merlin');
    }
  }, [visibleSections, section]);
  useEffect(() => {
    if (!initialAgentId) return;
    setSection('agents');
    setHighlightedAgentId(initialAgentId);
    // Wait for the section render to commit, then scroll. requestAnimationFrame
    // x2 is enough; AgentCard mounts synchronously after setSection.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-agentic-agent="${initialAgentId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => setHighlightedAgentId(null), 2200);
      }),
    );
  }, [initialAgentId]);

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
      <Hero
        buildingName={building?.name || null}
        onReset={async () => {
          if (await confirmDialog({ body: t('agentic.hero.reset_confirm'), danger: true }))
            resetAgenticConfig(building?.id || null);
        }}
      />

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
                }}
              >
                <IconC size={13} />
                {t(s.labelKey)}
              </button>
            );
          })}
        </nav>

        <div>
          {section === 'merlin' && (
            <MerlinSection config={config} setConfig={setConfig} ctx={ctx} buildingName={building?.name || null} />
          )}
          {section === 'agents' && (
            <AgentsSection
              config={config}
              setConfig={setConfig}
              ctx={ctx}
              buildingId={building?.id || null}
              buildingName={building?.name || null}
              highlightedAgentId={highlightedAgentId}
              isMerlinOwner={isMerlinOwner}
              onEnableAgents={onEnableAgents}
            />
          )}
          {section === 'sources' && (
            <DataSourcesSection
              building={building}
              config={config}
              setConfig={setConfig}
              isMerlinOwner={isMerlinOwner}
            />
          )}
          {section === 'firehose' && <FirehosePanel building={building} />}
          {section === 'permissions' && <PermissionsSection config={config} setConfig={setConfig} />}
          {section === 'audit' && <AuditSection />}
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────── Hero ───────────────────────────

function Hero({ buildingName, onReset }) {
  const t = useT();
  // Eyebrow reflects the scope being edited. With a building selected,
  // settings under 'merlin' / 'agents' write to that building's
  // override row; everything else writes org-default. Without a
  // building (rare — usually only on ecosystem-only orgs without a
  // picked building), all writes are org-default.
  const eyebrow = buildingName
    ? t('agentic.hero.eyebrow_building', { building: buildingName })
    : t('agentic.hero.eyebrow');
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
      <div style={{ padding: 'var(--pad)', position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Icon.agents size={12} style={{ color: 'var(--accent)' }} />
            <span
              style={{
                fontSize: 11,
                letterSpacing: 0.15,
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 700,
              }}
            >
              {eyebrow}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>{t('agentic.hero.title')}</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 680 }}>
            {t('agentic.hero.body')}
          </p>
        </div>
        <button
          onClick={onReset}
          style={{
            padding: '8px 12px',
            background: 'var(--surface-2)',
            color: 'var(--text-soft)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <Icon.reload size={12} /> {t('agentic.hero.reset')}
        </button>
      </div>
    </Card>
  );
}

// Small JSON-shaped deep-equality check. Used by AgentsSection to
// decide if a per-agent override differs from the org default.
// (agentic-data.js has its own copy for write-time diffing; not
// imported here to keep the module surface narrow.)
function deepEqualLocal(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqualLocal(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEqualLocal(a[k], b[k])) return false;
  return true;
}

// ─────────────────────────── Override UI helpers ──────────────────────

// Inline indicator that renders next to a control label when the
// building's value differs from the org default. When `onReset` is
// supplied, the badge becomes interactive — clicking it confirms +
// resets just that scope (currently used for per-agent reset on the
// AgentCard corner). Read-only otherwise.
function OverrideBadge({ onReset }) {
  const t = useT();
  const clickable = typeof onReset === 'function';
  const handleClick = clickable
    ? async (e) => {
        e.stopPropagation();
        if (await confirmDialog({ body: t('agentic.override.agent_reset_confirm'), danger: true })) {
          try {
            Promise.resolve(onReset()).catch(() => {});
          } catch {}
        }
      }
    : undefined;
  const sharedStyle = {
    marginLeft: 8,
    padding: '1px 7px',
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent-line)',
    borderRadius: 999,
    verticalAlign: 'middle',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  };
  if (clickable) {
    return (
      <button
        onClick={handleClick}
        title={t('agentic.override.agent_reset_hint')}
        style={{
          ...sharedStyle,
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        {t('agentic.override.badge')} <span aria-hidden="true">↻</span>
      </button>
    );
  }
  return <span style={sharedStyle}>{t('agentic.override.badge')}</span>;
}

// "Reset section to org defaults" banner — appears at the top of a
// per-building section when there's an active overlay. Wipes the
// building's override for that section only; org defaults are untouched.
function ResetSectionBanner({ section, buildingName, onReset }) {
  const t = useT();
  return (
    <div
      style={{
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent-line)',
        borderRadius: 9,
        fontSize: 12.5,
      }}
    >
      <Icon.sparkle size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, color: 'var(--text-soft)' }}>
        {t('agentic.override.section_banner', { building: buildingName || '' })}
      </div>
      <button
        onClick={async () => {
          if (
            await confirmDialog({
              body: t('agentic.override.section_reset_confirm', { section: t(`agentic.section.${section}`) }),
              danger: true,
            })
          ) {
            onReset();
          }
        }}
        style={{
          padding: '6px 12px',
          background: 'var(--surface)',
          color: 'var(--accent)',
          border: '1px solid var(--accent-line)',
          borderRadius: 7,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <Icon.reload size={11} /> {t('agentic.override.section_reset')}
      </button>
    </div>
  );
}

// ─────────────────────────── Merlin section ───────────────────────────

function MerlinSection({ config, setConfig, ctx, buildingName }) {
  const t = useT();
  const m = config.merlin;
  const set = (patch) => setConfig({ ...config, merlin: { ...m, ...patch } });
  const activePersona = PERSONAS.find((p) => p.id === m.persona) || PERSONAS[1];
  // Org defaults — used to detect per-field overrides. Falls back to
  // current m when ctx isn't supplied (defensive; today every caller
  // passes ctx).
  const orgM = ctx?.orgDefaults?.merlin || m;
  const isOverridden = (key) => ctx?.hasOverride('merlin') && m[key] !== orgM[key];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ctx?.hasOverride('merlin') && buildingName && (
        <ResetSectionBanner
          section="merlin"
          buildingName={buildingName}
          onReset={async () => {
            try {
              await ctx.resetSection('merlin');
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn('[agentic] reset merlin failed:', e.message);
            }
          }}
        />
      )}
      <SectionCard
        title={t('agentic.persona.title')}
        desc={t('agentic.persona.desc')}
        badge={isOverridden('persona') ? <OverrideBadge /> : null}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {PERSONAS.map((p) => (
            <OptionTile
              key={p.id}
              active={m.persona === p.id}
              onClick={() => set({ persona: p.id })}
              label={p.label}
              sub={p.sample}
            />
          ))}
        </div>
        <div
          style={{
            marginTop: 10,
            padding: 12,
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent-line)',
            borderRadius: 8,
            fontSize: 12.5,
            color: 'var(--text)',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          <b
            style={{
              fontSize: 10.5,
              letterSpacing: 0.12,
              textTransform: 'uppercase',
              color: 'var(--accent)',
              fontStyle: 'normal',
              display: 'block',
              marginBottom: 4,
            }}
          >
            {t('agentic.preview_chat_bar')}
          </b>
          {activePersona.sample}
        </div>
      </SectionCard>

      <SectionCard
        title={t('agentic.autonomy.title')}
        desc={t('agentic.autonomy.desc')}
        badge={isOverridden('autonomyPolicy') ? <OverrideBadge /> : null}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {AUTONOMY_LEVELS.map((a) => (
            <OptionTile
              key={a.id}
              active={m.autonomyPolicy === a.id}
              onClick={() => set({ autonomyPolicy: a.id })}
              label={a.label}
              sub={a.desc}
            />
          ))}
        </div>
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SectionCard
          title={t('agentic.pings.title')}
          desc={t('agentic.pings.desc')}
          badge={isOverridden('proactivePings') ? <OverrideBadge /> : null}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PROACTIVE_PINGS.map((p) => (
              <OptionRow
                key={p.id}
                active={m.proactivePings === p.id}
                onClick={() => set({ proactivePings: p.id })}
                label={p.label}
                sub={p.desc}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={t('agentic.model.title')}
          desc={t('agentic.model.desc')}
          badge={isOverridden('model') ? <OverrideBadge /> : null}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MODELS.map((x) => (
              <OptionRow
                key={x.id}
                active={m.model === x.id}
                onClick={() => set({ model: x.id })}
                label={x.label}
                sub={x.desc}
              />
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title={t('agentic.thresholds.title')}
        desc={t('agentic.thresholds.desc')}
        badge={isOverridden('approvalConfidence') || isOverridden('approvalPriority') ? <OverrideBadge /> : null}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label>{t('agentic.thresholds.confidence_below')}</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range"
                min={50}
                max={99}
                value={m.approvalConfidence}
                onChange={(e) => set({ approvalConfidence: parseInt(e.target.value, 10) })}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  minWidth: 44,
                  textAlign: 'right',
                }}
              >
                {m.approvalConfidence}%
              </span>
            </div>
          </div>
          <div>
            <Label>{t('agentic.thresholds.priority_at_or_above')}</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {['low', 'medium', 'high', 'critical'].map((p) => (
                <button
                  key={p}
                  onClick={() => set({ approvalPriority: p })}
                  style={{
                    padding: '7px 0',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    background: m.approvalPriority === p ? 'var(--accent-soft)' : 'var(--surface-2)',
                    color: m.approvalPriority === p ? 'var(--accent)' : 'var(--text-soft)',
                    border: `1px solid ${m.approvalPriority === p ? 'var(--accent-line)' : 'var(--border)'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t('agentic.flags.title')}
        badge={isOverridden('memoryEnabled') || isOverridden('citations') ? <OverrideBadge /> : null}
      >
        <Toggle label={t('agentic.flag.memory')} value={m.memoryEnabled} onChange={(v) => set({ memoryEnabled: v })} />
        <Toggle label={t('agentic.flag.citations')} value={m.citations} onChange={(v) => set({ citations: v })} />
      </SectionCard>
    </div>
  );
}

// ─────────────────────────── Agents section ───────────────────────────

function AgentsSection({
  config,
  setConfig,
  ctx,
  buildingId,
  buildingName,
  highlightedAgentId,
  isMerlinOwner,
  onEnableAgents,
}) {
  const t = useT();
  const session = useSession();
  // Filter the agent grid by entitlement so what's shown matches
  // Admin → Agents (the canonical billing-coupled enable list). Was a
  // discrepancy before — every AGENT was rendered here regardless of
  // entitlement, with its own toggle, creating two sources of truth.
  const { entitled } = useBuildingAgentEntitlements(session?.organizationId, buildingId);
  // Contractor tailoring: when the active workspace is a contractor, the grid
  // is scoped to the current service line (cleaning/security/maintenance/
  // hospitality) instead of building entitlements (empty for contractors).
  const activeOrg = useActiveOrg();
  const serviceLine = useServiceLine();
  const isContractorOrg = activeOrg?.kind === 'contractor';
  const contractorAgents = useMemo(
    () => (isContractorOrg ? new Set(agentsForServiceLine(serviceLine)) : null),
    [isContractorOrg, serviceLine],
  );
  const [playbookOpen, setPlaybookOpen] = useState(null);
  const updateAgent = (id, patch) =>
    setConfig({
      ...config,
      agents: { ...config.agents, [id]: { ...config.agents[id], ...patch } },
    });
  const savePlaybook = (id, playbook) => updateAgent(id, { playbook });
  const setFrequency = (frequency_min) =>
    setConfig({
      ...config,
      tickSettings: { ...config.tickSettings, frequency_min },
    });

  // Per-agent override detection. An agent is "overridden" if any
  // field in its current config differs from the org-default config
  // for that agent. perAgentDiff already lives in agentic-data.js but
  // we don't need a network call — we can compare with the cached
  // orgDefaults that came with `ctx`.
  const orgAgents = ctx?.orgDefaults?.agents || config.agents;
  const isAgentOverridden = (id) => {
    if (!ctx?.hasOverride('agents')) return false;
    const current = config.agents[id];
    const original = orgAgents[id];
    return !deepEqualLocal(current, original);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Tick frequency directly drives Anthropic spend per workspace.
          Gated to Merlin Owner — Super Admins and below don't see it. */}
      {isMerlinOwner && (
        <TickFrequencyCard frequencyMin={config.tickSettings?.frequency_min ?? 15} onChange={setFrequency} />
      )}

      {ctx?.hasOverride('agents') && buildingName && (
        <ResetSectionBanner
          section="agents"
          buildingName={buildingName}
          onReset={async () => {
            try {
              await ctx.resetSection('agents');
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn('[agentic] reset agents failed:', e.message);
            }
          }}
        />
      )}

      {/* Grouped agent grid: one Card per presentation bucket — General /
          Specialized (2026-06-04, per JB). The buckets derive from the
          richer 3-category model in agentic-data.js (general → General;
          industry + specialized + any uncategorized → Specialized), so new
          or drift agents never silently disappear. Each card shows its own
          count. */}
      {(() => {
        // Hide agents that aren't entitled for this building — the
        // canonical entitlement list lives in building_agent_entitlements
        // (driven by Admin → Agents). When no buildingId is set (rare),
        // skip filtering so the page still renders something usable.
        const isEntitled = (id) =>
          isContractorOrg ? (contractorAgents?.has(id) ?? false) : !buildingId || entitled.has(id);
        const groups = AGENT_GROUPS.map((g) => ({
          id: g.id,
          labelKey: g.labelKey,
          descKey: g.descKey,
          icon: g.icon,
          ids: agentIdsForGroup(g.id, isEntitled),
        })).filter((g) => g.ids.length > 0);

        // No agents entitled for this building yet → silent blank used
        // to render, leaving the user with no way to know what to do.
        // The canonical enable surface is Admin → Agents (per the
        // two-sources-of-truth pattern: Admin owns enabled, Agentic
        // owns behavior). Surface a CTA so the workflow is visible.
        // PRO TEST smoke-test 2026-05-18.
        if (groups.length === 0) {
          return (
            <Card>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  padding: '40px 24px',
                  textAlign: 'center',
                }}
              >
                <Icon.sparkle size={28} style={{ color: 'var(--text-dim)' }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    No agents enabled yet for {buildingName || 'this building'}
                  </div>
                  <div
                    style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)', maxWidth: 520, lineHeight: 1.55 }}
                  >
                    Agents are turned on (and billed) from Admin → Agents. Once enabled, they appear here so you can
                    tune their behavior — autonomy level, data sources, playbook — per building.
                  </div>
                </div>
                {onEnableAgents && (
                  <button
                    type="button"
                    onClick={onEnableAgents}
                    style={{
                      marginTop: 4,
                      padding: '8px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      background: 'var(--accent)',
                      color: 'var(--accent-fg, #fff)',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    Enable agents
                  </button>
                )}
              </div>
            </Card>
          );
        }

        return groups.map((g) => {
          const IconC = Icon[g.icon] || Icon.sparkle;
          return (
            <Card key={g.id} pad={false}>
              <div
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <IconC size={14} style={{ color: 'var(--accent)' }} />
                <div style={{ fontSize: 13, fontWeight: 700 }}>{t(g.labelKey)}</div>
                <Pill tone="accent">{g.ids.length}</Pill>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 11, color: 'var(--text-dim)', maxWidth: 480, textAlign: 'right' }}>
                  {t(g.descKey)}
                </div>
              </div>
              <div
                style={{
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: 10,
                }}
              >
                {g.ids.map((id) => (
                  <div
                    key={id}
                    data-agentic-agent={id}
                    style={{
                      outline: highlightedAgentId === id ? '2px solid var(--accent)' : '2px solid transparent',
                      outlineOffset: 2,
                      borderRadius: 10,
                      transition: 'outline-color .3s ease',
                    }}
                  >
                    <AgentCard
                      id={id}
                      meta={AGENT_META[id]}
                      cfg={config.agents[id]}
                      allSources={config.dataSources}
                      onChange={(patch) => updateAgent(id, patch)}
                      onEditPlaybook={() => setPlaybookOpen(id)}
                      // PR-fix: previously the OverrideBadge was rendered
                      // by the wrapper via position:absolute at left:56,
                      // which sat exactly on top of the agent name once
                      // the icon + gap width was finalized. Pass the
                      // badge state into AgentCard so it renders inline
                      // in the header row (after the name) where it
                      // can never collide.
                      overridden={isAgentOverridden(id)}
                      onResetOverride={() => ctx?.resetAgent(id)}
                    />
                  </div>
                ))}
              </div>
            </Card>
          );
        });
      })()}

      {playbookOpen && (
        <PlaybookEditor
          agentId={playbookOpen}
          meta={AGENT_META[playbookOpen]}
          cfg={config.agents[playbookOpen]}
          allSources={config.dataSources}
          onSave={(pb) => savePlaybook(playbookOpen, pb)}
          onAddTrigger={(trigger) =>
            updateAgent(playbookOpen, {
              triggers: [...(config.agents[playbookOpen].triggers || []), trigger],
            })
          }
          onClose={() => setPlaybookOpen(null)}
        />
      )}
    </div>
  );
}

function AgentCard({ id, meta, cfg, allSources, onChange, onEditPlaybook, overridden = false, onResetOverride }) {
  const t = useT();
  // Defensive guard: if a future AGENT is added to data.js without a
  // matching AGENT_DEFAULTS entry in agentic-data.js, AGENT_ORDER will
  // include the id but `config.agents[id]` will be undefined. Fall back
  // to a no-op shape so the page renders the row instead of crashing
  // on `cfg.icon`. New agents should always be added to BOTH AGENTS
  // (data.js) AND AGENT_DEFAULTS (agentic-data.js) together.
  if (!cfg) cfg = { icon: 'sparkle', enabled: false, description: '', dataSources: [], playbook: { steps: [] } };
  const IconC = Icon[cfg.icon] || Icon.sparkle;
  const stepCount = cfg.playbook?.steps?.length ?? 0;
  const linkedSources = (cfg.dataSources || []).map((ref) => resolveDataSource({ dataSources: allSources }, ref));
  const linkedIds = new Set(cfg.dataSources || []);
  const unlinked = Object.values(allSources || {}).filter((s) => !linkedIds.has(s.id));
  const unlinkSource = (ref) => onChange({ dataSources: (cfg.dataSources || []).filter((r) => r !== ref) });
  const linkSource = (id) => onChange({ dataSources: [...(cfg.dataSources || []), id] });
  return (
    <div
      style={{
        padding: 12,
        background: cfg.enabled ? 'var(--surface-2)' : 'color-mix(in oklch, var(--surface-2) 60%, transparent)',
        border: `1px solid ${cfg.enabled ? 'var(--border)' : 'var(--border)'}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: cfg.enabled ? 1 : 0.65,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            flexShrink: 0,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconC size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}
          >
            <span>{meta?.name || id}</span>
            {overridden && <OverrideBadge onReset={onResetOverride} />}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{cfg.description}</div>
        </div>
        <Toggle inline value={cfg.enabled} onChange={(v) => onChange({ enabled: v })} />
      </div>

      <div>
        <Label>{t('agentic.card.autonomy')}</Label>
        <select value={cfg.autonomy} onChange={(e) => onChange({ autonomy: e.target.value })} style={selectStyle}>
          {AUTONOMY_LEVELS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <Label>{t('agentic.card.confidence_floor')}</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="range"
              min={50}
              max={99}
              value={cfg.confidence}
              onChange={(e) => onChange({ confidence: parseInt(e.target.value, 10) })}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--accent)',
                minWidth: 34,
                textAlign: 'right',
              }}
            >
              {cfg.confidence}%
            </span>
          </div>
        </div>
        <div>
          <Label>{t('agentic.card.max_actions')}</Label>
          <input
            type="number"
            min={1}
            max={120}
            value={cfg.maxActionsPerHour}
            onChange={(e) =>
              onChange({ maxActionsPerHour: Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1)) })
            }
            style={{ ...selectStyle, fontFamily: 'var(--mono)' }}
          />
        </div>
      </div>

      <div>
        <Label>{t('agentic.card.triggers')}</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {cfg.triggers.map((trig, i) => (
            <span
              key={i}
              style={{
                padding: '4px 8px',
                fontSize: 10.5,
                fontWeight: 600,
                background: 'var(--surface-3)',
                color: 'var(--text-soft)',
                border: '1px solid var(--border)',
                borderRadius: 4,
              }}
            >
              {trig}
            </span>
          ))}
        </div>
      </div>

      <div>
        <Label>{t('agentic.card.data_sources')}</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {linkedSources.map((s, i) => {
            const statusMeta = DATA_SOURCE_STATUSES.find((x) => x.id === s.status) || DATA_SOURCE_STATUSES[0];
            return (
              <span
                key={s.id || i}
                title={s.description || s.name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 4px 3px 8px',
                  fontSize: 10.5,
                  fontWeight: 600,
                  background: 'color-mix(in oklch, var(--accent) 8%, var(--surface))',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-line)',
                  borderRadius: 4,
                }}
              >
                <Dot tone={statusMeta.tone} size={5} />
                {s.name}
                <button
                  onClick={() => unlinkSource(cfg.dataSources[i])}
                  title={t('agentic.card.unlink')}
                  style={{
                    width: 14,
                    height: 14,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--accent)',
                    borderRadius: 3,
                    cursor: 'pointer',
                    opacity: 0.7,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon.close size={9} />
                </button>
              </span>
            );
          })}
          {unlinked.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && linkSource(e.target.value)}
              style={{
                padding: '3px 6px',
                fontSize: 10.5,
                fontWeight: 600,
                background: 'var(--surface-2)',
                color: 'var(--accent)',
                border: '1px dashed var(--accent-line)',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                outline: 'none',
              }}
            >
              <option value="">{t('agentic.card.link_source')}</option>
              {unlinked.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onEditPlaybook}
          style={{
            flex: 1,
            padding: '7px 10px',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '1px solid var(--accent-line)',
            borderRadius: 6,
            fontSize: 11.5,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          <Icon.sparkle size={11} /> {t('agentic.card.edit_playbook')}
          <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)', opacity: 0.7 }}>
            · {stepCount}
          </span>
        </button>
        <button
          disabled
          style={{
            padding: '7px 10px',
            background: 'var(--surface-3)',
            color: 'var(--text-dim)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 11.5,
            fontWeight: 600,
            cursor: 'not-allowed',
          }}
        >
          {t('agentic.card.test')}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── Data sources section ───────────────────────────

// DataSourcesSection (PR 2 of data source redesign) — tabbed shell that
// reads from the new source_catalog + source_connection tables. The
// per-agent picker in AgentCard still reads merlin_config.data_sources
// (legacy fallback via resolveDataSource) until a follow-up PR migrates
// the agent linking ledger. New catalog entries created here aren't
// yet agent-linkable; surfaced via the legacy_note banner below.
function DataSourcesSection({ building, config, setConfig, isMerlinOwner }) {
  const t = useT();
  const session = useSession();
  const orgId = session?.organizationId;
  const [tab, setTab] = useState('catalog');

  // Running simulations count is read from source_connection (live via
  // realtime subscription). Used both by the discovery strip below and
  // by the Simulator tab to title its list. Scoped to the active
  // building when one is selected, mirroring the Connections tab.
  const { rows: simRows } = useSourceConnections(orgId, { building });
  const simulatedRows = useMemo(() => simRows.filter((r) => r?.metadata?.simulator?.enabled === true), [simRows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 4, padding: '0 2px' }}>
        <TabBtn active={tab === 'catalog'} onClick={() => setTab('catalog')}>
          {t('sources.tab.catalog')}
        </TabBtn>
        <TabBtn active={tab === 'connections'} onClick={() => setTab('connections')}>
          {t('sources.tab.connections')}
        </TabBtn>
        <TabBtn active={tab === 'simulator'} onClick={() => setTab('simulator')}>
          {t('sources.tab.simulator')}
        </TabBtn>
      </div>

      {/* Discoverability strip — visible on every Sources sub-tab when
          at least one simulated connection exists. Click jumps to the
          Simulator tab. */}
      {simulatedRows.length > 0 && tab !== 'simulator' && (
        <button
          onClick={() => setTab('simulator')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            textAlign: 'left',
            background: 'color-mix(in oklch, var(--accent) 6%, var(--surface-2))',
            border: '1px solid color-mix(in oklch, var(--accent) 28%, var(--border))',
            borderRadius: 7,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          <Dot tone="accent" size={5} pulse />
          <div style={{ fontSize: 12, color: 'var(--text-soft)', flex: 1 }}>
            {t('sources.sim.strip', { n: simulatedRows.length })}
          </div>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>{t('sources.sim.strip_cta')}</span>
        </button>
      )}

      {tab !== 'simulator' && (
        <div
          style={{
            padding: 10,
            fontSize: 11.5,
            color: 'var(--text-soft)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 7,
          }}
        >
          {t('sources.legacy_note')}
        </div>
      )}
      {tab === 'catalog' && <CatalogList orgId={orgId} building={building} />}
      {tab === 'connections' && <ConnectionsList orgId={orgId} building={building} />}
      {tab === 'simulator' && (
        <SimulatorTab
          config={config}
          setConfig={setConfig}
          isMerlinOwner={isMerlinOwner}
          simulatedRows={simulatedRows}
          building={building}
        />
      )}
    </div>
  );
}

// Simulator settings + Running simulations roll-up. Folded under
// Sources from the old top-level Emulator tab (which was Owner-only).
// Inline gating now keeps the cost-driving SeedFrequencyCard
// Owner-only while letting admins manage the device-event simulator
// and view the per-connection simulated sources running in their org.
function SimulatorTab({ config, setConfig, isMerlinOwner, simulatedRows, building }) {
  const t = useT();
  const setSeedFrequency = (frequency_min) =>
    setConfig({
      ...config,
      seedSettings: { ...config.seedSettings, frequency_min },
    });
  const setDeviceSeedSettings = (patch) =>
    setConfig({
      ...config,
      deviceSeedSettings: { ...config.deviceSeedSettings, ...patch },
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Per-connection running list. Each row is one source_connection
          with metadata.simulator.enabled = true. Reuses ConnectionRow
          chrome so the visual matches the Connections tab — including
          the "Simulating · every N min" pill rendered by ConnectionRow
          itself. */}
      <Card pad={false}>
        <div
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: simulatedRows.length > 0 ? '1px solid var(--border)' : 'none',
          }}
        >
          <Dot tone={simulatedRows.length > 0 ? 'accent' : 'off'} size={5} pulse={simulatedRows.length > 0} />
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('sources.sim.running.title')}</div>
          <Pill tone={simulatedRows.length > 0 ? 'accent' : 'off'}>{simulatedRows.length}</Pill>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {building?.name
              ? t('sources.sim.running.scope_building', { name: building.name })
              : t('sources.sim.running.scope_org')}
          </div>
        </div>
        {simulatedRows.length === 0 ? (
          <div style={{ padding: 18, fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
            {t('sources.sim.running.empty')}
            <br />
            <span style={{ color: 'var(--text-soft)' }}>{t('sources.sim.running.empty_hint')}</span>
          </div>
        ) : (
          <div style={{ padding: '4px 12px 8px' }}>
            {simulatedRows.map((row) => (
              <SimulatedRunningRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </Card>

      {/* Cost knob — Owner only. seed-signal drives synthetic incidents
          that agents react to; high cadence is a real Anthropic spend
          multiplier. */}
      {isMerlinOwner ? (
        <SeedFrequencyCard frequencyMin={config.seedSettings?.frequency_min ?? 10} onChange={setSeedFrequency} />
      ) : (
        <Card pad={false}>
          <div
            style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <Icon.shield size={11} style={{ color: 'var(--text-dim)' }} />
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('agentic.data_simulator')}</div>
            <Pill tone="off">{t('sources.sim.owner_only')}</Pill>
          </div>
          <div style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--text-soft)', lineHeight: 1.5 }}>
            {t('sources.sim.owner_only_hint')}
          </div>
        </Card>
      )}

      {/* No LLM cost in device-event seeding — admins can tune freely. */}
      <DeviceSeedSimulatorCard
        frequencyMin={config.deviceSeedSettings?.frequency_min ?? 5}
        profileIds={config.deviceSeedSettings?.profile_ids}
        onChange={setDeviceSeedSettings}
      />
    </div>
  );
}

// One row in the Running simulations list. Slim variant of
// ConnectionRow — no edit/delete (those live in the Connections tab),
// just identity + interval + last heartbeat.
function SimulatedRunningRow({ row }) {
  const t = useT();
  const sim = row.metadata?.simulator || {};
  const profileLabel = sim.payload_profile
    ? SIMULATOR_PAYLOAD_PROFILES.find((p) => p.id === sim.payload_profile)?.label || sim.payload_profile
    : null;
  const heartbeat = row.last_heartbeat_at
    ? new Date(row.last_heartbeat_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    : null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 6px',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          flexShrink: 0,
          background: 'var(--surface-2)',
          color: 'var(--text-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon.play size={11} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.name || row.external_id || row.id.slice(0, 8)}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1, fontFamily: 'var(--mono)' }}>
          {profileLabel || t('sources.sim.running.no_profile')}
          {heartbeat && ` · ${t('sources.conn.last_heartbeat')} ${heartbeat}`}
        </div>
      </div>
      <Pill tone="info">
        {sim.interval_min
          ? t('sources.conn.simulator.pill_every_n_min', { n: sim.interval_min })
          : t('sources.conn.simulator.pill_simulating')}
      </Pill>
    </div>
  );
}

function CatalogList({ orgId, building }) {
  const t = useT();
  // PR 5: includePending=true so contractor-proposed entries show up
  // here with a Pending pill + Accept button. Without it the customer
  // never sees what's being proposed.
  const { rows, loaded } = useSourceCatalog(orgId, {
    buildingId: building?.id || null,
    includePending: true,
  });
  const buildings = useBuildingsForActiveOrg();
  const [editing, setEditing] = useState(null); // null | 'new' | row.id
  const [error, setError] = useState(null);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon.gateway size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('sources.catalog.title')}</div>
        <Pill tone="info">{rows.length}</Pill>
        <div style={{ flex: 1 }} />
        {editing !== 'new' && (
          <button
            onClick={() => {
              setEditing('new');
              setError(null);
            }}
            style={btnPrimaryLocal}
          >
            {t('sources.catalog.new')}
          </button>
        )}
      </div>

      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55, maxWidth: 720 }}>
        {t('sources.catalog.body')}
      </p>

      {!loaded && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <AdaptivLoader size="sm" />
        </div>
      )}

      {loaded && rows.length === 0 && editing !== 'new' && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.55 }}>
          {t('sources.catalog.empty')}
          <br />
          {t('sources.catalog.empty_hint')}
        </div>
      )}

      <ErrBanner text={error} />

      {editing === 'new' && (
        <CatalogForm
          initial={null}
          currentBuilding={building}
          onCancel={() => setEditing(null)}
          onSave={async (draft) => {
            setError(null);
            // draft.scope is 'org' or 'building' (from the toggle). Map
            // to a buildingId for the insert helper. Strip the scope
            // field so it doesn't try to land as a DB column.
            const { scope, ...rest } = draft;
            const targetBuildingId = scope === 'building' ? building?.id : null;
            try {
              await createCatalogEntry({ orgId, draft: rest, buildingId: targetBuildingId });
              setEditing(null);
            } catch (e) {
              setError(e.message);
              throw e;
            }
          }}
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
          alignItems: 'stretch',
        }}
      >
        {rows.map((row) => (
          <CatalogRow
            key={row.id}
            row={row}
            asCard
            buildings={buildings}
            editing={editing === row.id}
            isAdmin={true}
            actorRole={actorRoleForCatalog(row, orgId)}
            onEdit={() => {
              setEditing(row.id);
              setError(null);
            }}
            onCancel={() => setEditing(null)}
            onSave={async (patch) => {
              setError(null);
              const { scope, ...rest } = patch;
              try {
                await updateCatalogEntry(row.id, rest);
                setEditing(null);
              } catch (e) {
                setError(e.message);
                throw e;
              }
            }}
            onAccept={async () => {
              setError(null);
              try {
                await acceptSourceCatalog(row.id);
              } catch (e) {
                setError(e.message);
              }
            }}
            onDelete={async () => {
              if (
                !(await confirmDialog({ body: t('sources.catalog.delete_confirm', { name: row.name }), danger: true }))
              )
                return;
              setError(null);
              try {
                await deleteCatalogEntry(row.id);
              } catch (e) {
                setError(e.message);
              }
            }}
          />
        ))}
      </div>
    </Card>
  );
}

function ConnectionsList({ orgId, building }) {
  const t = useT();
  // Both lists for the form pickers + the row-side catalog lookup.
  const { rows: catalog } = useSourceCatalog(orgId);
  const { rows, loaded } = useSourceConnections(orgId, { building });
  const buildings = useBuildingsForActiveOrg();
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const catalogById = useMemo(() => {
    const map = {};
    for (const c of catalog) map[c.id] = c;
    return map;
  }, [catalog]);

  const catalogOptions = catalog.map((c) => ({ id: c.id, name: c.name }));
  const locationOptions = Object.values(buildings || {}).map((b) => ({ id: b.id, name: b.name }));

  const locationName = (locId) => buildings?.[locId]?.name || null;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon.bolt size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('sources.connections.title')}</div>
        <Pill tone="info">{rows.length}</Pill>
        <div style={{ flex: 1 }} />
        {editing !== 'new' && catalogOptions.length > 0 && locationOptions.length > 0 && (
          <button
            onClick={() => {
              setEditing('new');
              setError(null);
            }}
            style={btnPrimaryLocal}
          >
            {t('sources.connections.new')}
          </button>
        )}
      </div>

      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55, maxWidth: 720 }}>
        {t('sources.connections.body')}
      </p>

      {!loaded && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <AdaptivLoader size="sm" />
        </div>
      )}

      {loaded && rows.length === 0 && editing !== 'new' && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.55 }}>
          {t('sources.connections.empty')}
        </div>
      )}

      <ErrBanner text={error} />

      {editing === 'new' && (
        <ConnectionForm
          initial={null}
          catalogOptions={catalogOptions}
          locationOptions={locationOptions}
          onCancel={() => setEditing(null)}
          onSave={async (draft) => {
            setError(null);
            try {
              await createConnection({ orgId, draft });
              setEditing(null);
            } catch (e) {
              setError(e.message);
              throw e;
            }
          }}
        />
      )}

      {rows.map((row) => (
        <ConnectionRow
          key={row.id}
          row={row}
          catalogById={catalogById}
          locationName={locationName(row.location_id)}
          editing={editing === row.id}
          isAdmin={true}
          onEdit={() => {
            setEditing(row.id);
            setError(null);
          }}
          onCancel={() => setEditing(null)}
          onSave={async (patch) => {
            setError(null);
            try {
              await updateConnection(row.id, patch);
              setEditing(null);
            } catch (e) {
              setError(e.message);
              throw e;
            }
          }}
          onDelete={async () => {
            const displayName = row.name || row.external_id || row.id.slice(0, 8);
            if (
              !(await confirmDialog({
                body: t('sources.connections.delete_confirm', { name: displayName }),
                danger: true,
              }))
            )
              return;
            setError(null);
            try {
              await deleteConnection(row.id);
            } catch (e) {
              setError(e.message);
            }
          }}
        />
      ))}
    </Card>
  );
}

const btnPrimaryLocal = {
  padding: '7px 12px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

// ─────────────────────────── Permissions section ───────────────────────────

function PermissionsSection({ config, setConfig }) {
  const t = useT();
  const cycleLevel = (roleId, agentId) => {
    const order = PERMISSION_LEVELS.map((l) => l.id);
    const current = config.permissions[roleId]?.[agentId] || 'none';
    const next = order[(order.indexOf(current) + 1) % order.length];
    setConfig({
      ...config,
      permissions: {
        ...config.permissions,
        [roleId]: { ...config.permissions[roleId], [agentId]: next },
      },
    });
  };

  const roleIds = Object.keys(ROLES);

  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Icon.shield size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('agentic.perms.title')}</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('agentic.perms.hint')}</div>
      </div>
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', paddingLeft: 16 }}>{t('agentic.perms.col.role')}</th>
              {AGENT_ORDER.map((id) => (
                <th key={id} style={thStyle}>
                  {AGENT_META[id]?.name?.split(' ')[0] || id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roleIds.map((rid) => {
              const role = ROLES[rid];
              return (
                <tr key={rid} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{role.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{role.short}</div>
                  </td>
                  {AGENT_ORDER.map((aid) => {
                    const level = config.permissions[rid]?.[aid] || 'none';
                    const meta = PERMISSION_LEVELS.find((l) => l.id === level) || PERMISSION_LEVELS[0];
                    return (
                      <td key={aid} style={{ padding: 6, textAlign: 'center' }}>
                        <button
                          onClick={() => cycleLevel(rid, aid)}
                          style={{
                            padding: '6px 10px',
                            minWidth: 56,
                            background:
                              level === 'none'
                                ? 'var(--surface-2)'
                                : `color-mix(in oklch, var(--${meta.tone}) 12%, transparent)`,
                            color: level === 'none' ? 'var(--text-dim)' : `var(--${meta.tone})`,
                            border: `1px solid ${level === 'none' ? 'var(--border)' : `color-mix(in oklch, var(--${meta.tone}) 35%, transparent)`}`,
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {meta.label}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text-dim)',
        }}
      >
        <b style={{ color: 'var(--text-soft)' }}>{t('agentic.perms.legend')}</b>
        {PERMISSION_LEVELS.slice(1).map((l) => (
          <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Dot tone={l.tone} size={5} /> {l.label}
          </span>
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────── Audit section ───────────────────────────

function AuditSection() {
  const t = useT();
  const [agentFilter, setAgentFilter] = useState('all');
  const rows = useMemo(() => {
    return RECENT_AGENT_ACTIONS.filter((r) => agentFilter === 'all' || r.agent === agentFilter);
  }, [agentFilter]);

  return (
    <Card pad={false}>
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Icon.sla size={13} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('agentic.audit.title')}</div>
        <Pill>{rows.length}</Pill>
        <div style={{ flex: 1 }} />
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          style={{ ...selectStyle, maxWidth: 180 }}
        >
          <option value="all">{t('agentic.audit.all_agents')}</option>
          {AGENT_ORDER.map((id) => (
            <option key={id} value={id}>
              {AGENT_META[id]?.name || id}
            </option>
          ))}
        </select>
      </div>
      <div>
        {rows.map((r, i) => {
          const meta = AGENT_META[r.agent];
          const toneByOutcome =
            { auto: 'ok', approved: 'accent', proposed: 'warn', rollback: 'risk' }[r.outcome] || 'info';
          return (
            <div
              key={r.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 150px minmax(0, 1fr) 80px 100px',
                gap: 14,
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                fontSize: 12,
              }}
            >
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{humanTs(r.ts)}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{meta?.name || r.agent}</div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-soft)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.action}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
                {r.confidence}%
              </div>
              <div>
                <Pill tone={toneByOutcome}>{r.outcome}</Pill>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12.5, color: 'var(--text-dim)' }}>
            {t('agentic.audit.empty')}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─────────────────────────── atoms ───────────────────────────

function SectionCard({ title, desc, badge, children }) {
  return (
    <Card>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
          <span>{title}</span>
          {badge}
        </div>
        {desc && <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 3 }}>{desc}</div>}
      </div>
      {children}
    </Card>
  );
}

function OptionTile({ active, onClick, label, sub }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 12px',
        textAlign: 'left',
        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: active ? 'var(--accent)' : 'var(--text-soft)',
        border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
        borderRadius: 8,
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</div>
      {sub && (
        <div
          style={{
            fontSize: 10.5,
            color: active ? 'var(--accent)' : 'var(--text-dim)',
            opacity: active ? 0.85 : 1,
            marginTop: 3,
            lineHeight: 1.45,
          }}
        >
          {sub}
        </div>
      )}
    </button>
  );
}

function OptionRow({ active, onClick, label, sub }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 12px',
        textAlign: 'left',
        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: active ? 'var(--accent)' : 'var(--text-soft)',
        border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
        borderRadius: 7,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          flexShrink: 0,
          border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
        {sub && <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
      </div>
    </button>
  );
}

function Toggle({ label, value, onChange, inline }) {
  const btn = (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 36,
        height: 20,
        padding: 2,
        flexShrink: 0,
        background: value ? 'var(--accent)' : 'var(--surface-3)',
        border: `1px solid ${value ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 999,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background .15s',
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          transform: value ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform .15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
  if (inline) return btn;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      {btn}
      <div style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{label}</div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        color: 'var(--text-dim)',
        fontWeight: 700,
        letterSpacing: 0.1,
        textTransform: 'uppercase',
        marginBottom: 5,
      }}
    >
      {children}
    </div>
  );
}

function humanTs(iso) {
  const d = new Date(iso);
  const today = new Date('2026-04-21T12:00:00');
  const days = Math.round((today - d) / 86400000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;
  if (days === 0) return tPlain('agentic.ts.today', { time });
  if (days === 1) return tPlain('agentic.ts.yesterday', { time });
  return tPlain('agentic.ts.day_ago', { n: days });
}

const selectStyle = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 12,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontFamily: 'var(--font)',
  outline: 'none',
};

const thStyle = {
  padding: '10px 6px',
  textAlign: 'center',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.12,
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  background: 'var(--surface-2)',
};
