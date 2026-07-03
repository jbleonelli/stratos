// Admin — per-building Agents section (agent entitlement toggles). Extracted from
// Admin.jsx (G2 split, after AdminLocations.jsx). Self-contained: takes the active
// `building` as a prop, reads entitlements via useBuildingAgentEntitlements. Exports
// AgentsSection; SummaryStat / AgentToggle stay file-internal.

import React from 'react';
import { Pill, Card } from './primitives.jsx';
import { useT } from './i18n.js';
import { useSession } from './auth.js';
import { useActiveOrg } from './org-data.js';
import { useBuildingsForActiveOrg } from './custom-locations.js';
import { useBuildingAgentEntitlements, toggleEntitlement } from './building-agent-entitlements.js';
import { AGENTS } from './data.js';
import { AGENT_GROUPS, AGENT_GROUP_BY_ID } from './agentic-data.js';
import { alertDialog } from './dialogs.jsx';

// ─────────────────────────── Agents section ──────────────────────────
//
// Per-building agent entitlements (migration 117). The model is:
//   - 1 free agent per building, included with every plan tier
//   - Each additional agent: $99 / building / month (Stripe wiring in G3)
// Until Stripe is wired (Phase C of the main pricing rollout), the
// admin can toggle entitlements directly. After G3, paid toggles will
// route through Stripe Checkout first, then the webhook flips the
// active flag with source='paid'.
//
// Building admins (`organization_members.role IN ('owner','admin')`)
// can write — RLS gates everyone else to read-only. The section
// scopes to the active building from the topbar building picker;
// admins managing multiple buildings switch building first.

const AGENT_PRICE_USD = 99;
const FREE_QUOTA = 1;

export function AgentsSection({ building }) {
  const t = useT();
  const session = useSession();
  const buildings = useBuildingsForActiveOrg();
  const org = useActiveOrg();
  const orgId = session?.organizationId;
  const activeBuildingId = building?.id;
  const { rows, ready } = useBuildingAgentEntitlements(orgId, activeBuildingId);

  if (!activeBuildingId) {
    return (
      <Card>
        <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>{t('admin.agents.no_building')}</div>
      </Card>
    );
  }

  // Enterprise customers and grandfathered tenants pay nothing for
  // agents — the cost math must reflect actual billed rows, not just
  // "active count minus free quota." A row is billed iff source='paid'
  // (that's the source the toggle-entitlement endpoint sets when it
  // creates a Stripe subscription_item). grandfathered, free_quota,
  // and manual rows are all $0.
  const activeIds = new Set(rows.filter((r) => r.active).map((r) => r.agent_id));
  const activeCount = activeIds.size;
  const isEnterprise = org?.plan === 'enterprise';
  const paidCount = isEnterprise ? 0 : rows.filter((r) => r.active && r.source === 'paid').length;
  const monthlyCost = paidCount * AGENT_PRICE_USD;

  // useBuildingsForActiveOrg returns an id → building MAP (with a
  // non-enumerable __ready flag), not an array. Direct key lookup,
  // not .find(). The previous .find() call threw
  // "TypeError: n.find is not a function" the moment AgentsSection
  // rendered (Sentry JAVASCRIPT-REACT-1D).
  const buildingName = buildings?.[activeBuildingId]?.name || activeBuildingId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {t('admin.agents.heading', { building: buildingName })}
            </h2>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.55 }}>
              {isEnterprise
                ? t('admin.agents.subheading_enterprise')
                : t('admin.agents.subheading', { price: AGENT_PRICE_USD })}
            </p>
          </div>

          {isEnterprise ? (
            // Enterprise: free quota and per-agent cost are irrelevant.
            // Show a single "Active agents N / total · Included" stat.
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <SummaryStat
                label={t('admin.agents.stat.active')}
                value={activeCount}
                total={AGENTS.length}
                tone="accent"
              />
              <SummaryStat
                label={t('admin.agents.stat.plan')}
                value={t('admin.agents.stat.plan_enterprise')}
                detail={t('admin.agents.stat.plan_enterprise_detail')}
                tone="ok"
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <SummaryStat
                label={t('admin.agents.stat.active')}
                value={activeCount}
                total={AGENTS.length}
                tone="accent"
              />
              <SummaryStat
                label={t('admin.agents.stat.free')}
                value={Math.min(activeCount, FREE_QUOTA)}
                total={FREE_QUOTA}
                tone="ok"
              />
              <SummaryStat
                label={t('admin.agents.stat.paid')}
                value={`$${monthlyCost}`}
                detail={t('admin.agents.stat.paid_detail', { n: paidCount })}
                tone={paidCount > 0 ? 'warn' : 'off'}
              />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
              <th
                style={{
                  padding: '10px 14px',
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: 0.2,
                  textTransform: 'uppercase',
                }}
              >
                {t('admin.agents.col.agent')}
              </th>
              <th
                style={{
                  padding: '10px 14px',
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: 0.2,
                  textTransform: 'uppercase',
                }}
              >
                {t('admin.agents.col.source')}
              </th>
              <th
                style={{
                  padding: '10px 14px',
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: 0.2,
                  textTransform: 'uppercase',
                }}
              >
                {t('admin.agents.col.cost')}
              </th>
              <th
                style={{
                  padding: '10px 14px',
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: 0.2,
                  textTransform: 'uppercase',
                  textAlign: 'right',
                }}
              >
                {t('admin.agents.col.status')}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Two presentation groups — General / Specialized (2026-06-04).
                Membership derives from agentic-data.js's AGENT_GROUP_BY_ID;
                anything unmapped falls into Specialized so no agent vanishes
                from the entitlement table. Each group gets a header row. */}
            {AGENT_GROUPS.map((grp) => {
              const groupAgents = AGENTS.filter((a) => (AGENT_GROUP_BY_ID[a.id] || 'specialized') === grp.id);
              if (groupAgents.length === 0) return null;
              return (
                <React.Fragment key={grp.id}>
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: '12px 14px 6px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        background: 'var(--surface-2)',
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      {t(grp.labelKey)}
                    </td>
                  </tr>
                  {groupAgents.map((agent) => {
                    const row = rows.find((r) => r.agent_id === agent.id);
                    const active = !!(row && row.active);
                    const source = row?.source || null;
                    // The first-activated agent in the building counts as free;
                    // everything beyond is paid at $99/mo. We don't track which
                    // *specific* agent is "the free one" — billing is just the
                    // count above quota.
                    const orderInActive = active ? [...activeIds].sort().indexOf(agent.id) : -1;
                    const isFreePosition = active && orderInActive < FREE_QUOTA;
                    const wouldBePaid = !active && activeCount >= FREE_QUOTA;
                    return (
                      <tr key={agent.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{agent.name}</div>
                          {agent.tag && (
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{agent.tag}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {!active ? (
                            <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>—</span>
                          ) : source === 'grandfathered' ? (
                            <Pill tone="info">{t('admin.agents.source.grandfathered')}</Pill>
                          ) : isFreePosition ? (
                            <Pill tone="ok">{t('admin.agents.source.free')}</Pill>
                          ) : source === 'paid' ? (
                            <Pill tone="accent">{t('admin.agents.source.paid')}</Pill>
                          ) : (
                            <Pill>{t('admin.agents.source.manual')}</Pill>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-soft)' }}>
                          {isEnterprise
                            ? t('admin.agents.cost.included')
                            : !active
                              ? wouldBePaid
                                ? `$${AGENT_PRICE_USD}/mo`
                                : t('admin.agents.cost.free')
                              : isFreePosition || source === 'grandfathered'
                                ? t('admin.agents.cost.free')
                                : `$${AGENT_PRICE_USD}/mo`}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <AgentToggle
                            checked={active}
                            disabled={!ready}
                            onChange={async (next) => {
                              try {
                                // G3: server-side endpoint wraps Stripe
                                // subscription_item create/delete around the
                                // DB upsert. Source resolution (free_quota /
                                // paid / grandfathered) is decided server-side
                                // based on the current active count + the org's
                                // subscription state.
                                await toggleEntitlement(activeBuildingId, agent.id, next);
                              } catch (e) {
                                if (e?.code === 'no_active_subscription') {
                                  alertDialog(t('admin.agents.err.no_subscription'));
                                } else {
                                  alertDialog(e?.message || String(e));
                                }
                              }
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card>
        <div style={{ padding: 14, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>{t('admin.agents.note.heading')}</strong>{' '}
          {isEnterprise ? t('admin.agents.note.body_enterprise') : t('admin.agents.note.body')}
        </div>
      </Card>
    </div>
  );
}

function SummaryStat({ label, value, total, detail, tone = 'off' }) {
  const accent =
    tone === 'accent'
      ? 'var(--accent)'
      : tone === 'ok'
        ? 'var(--ok, #0a0)'
        : tone === 'warn'
          ? 'var(--warn, #c80)'
          : 'var(--text-soft)';
  return (
    <div
      style={{
        padding: 12,
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface-2)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums' }}>
        {value}
        {total != null && (
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>/ {total}</span>
        )}
      </div>
      {detail && <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-dim)' }}>{detail}</div>}
    </div>
  );
}

function AgentToggle({ checked, disabled, onChange }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: 'none',
        background: checked ? 'var(--accent)' : 'var(--surface-3)',
        position: 'relative',
        cursor: disabled ? 'wait' : 'pointer',
        transition: 'background 0.15s',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'left 0.15s',
        }}
      />
    </button>
  );
}
