// Render layer for merlin_asks rows.
//
// Phase 2 (i18n): asks are written in two flavors —
//   - Structured: row.kind + row.params (migration 069). Per-kind i18n
//     keys are looked up at render time, so the row renders in any
//     supported language without re-running the agent.
//   - Free-form (legacy): row.title + row.body. Whatever language the
//     agent or the simulator wrote in, that's what the reader sees.
//
// renderAsk(t, ask) → { title, body } collapses both into a single
// shape for the renderers in Chat.jsx and CallsForAction.jsx.
//
// When migrating an agent to emit a new kind, the writer should still
// pass title+body as a source-language fallback so that:
//   1. Legacy clients (pre-Phase-2) keep working.
//   2. Debug tooling can grep for the agent's actual prose.
//   3. The on-read translation path that lands later has something
//      to translate when the structured templates miss.

import { useT } from './i18n.js';

export function useAskRenderer() {
  const t = useT();
  return (ask) => renderAsk(t, ask);
}

// ─────────────────────────── agent actions (Phase 2C) ───────────────────────────
//
// The "what I did today" pill on Dashboard → Agents and the override
// row in Schedules render persisted agent actions, not asks. Same
// kind+params shape lands in the act-path tables (migration 070), but
// the display strings are different — terser summary for the pill,
// localized reason text for the tooltip.

export function useAgentActionRenderer() {
  const t = useT();
  return (action) => renderAgentAction(t, action);
}

export function renderAgentAction(t, action) {
  if (!action) return { summary: '', reason: null };
  const kind = action.kind;
  const p = action.params || {};
  const localized = localizeParams(t, p);

  // Summary (the pill text). Per-kind summary template; falls back to
  // a localized legacy template (built from the raw row data) when
  // structured params are empty/missing — the typical case for rows
  // written before Phase 2C. Final fallback is the writer-supplied
  // English `legacySummary` string from agent-runs.js.
  const summaryKey = `action.${kind}.summary`;
  let summary = t(summaryKey, localized);
  if (summary === summaryKey || hasUnresolvedPlaceholder(summary)) {
    const fromLegacy = renderLocalizedLegacySummary(t, action);
    summary = fromLegacy || action.legacySummary || action.reason || '';
  }

  // Reason (the tooltip / italic line). Reuses the ask body keys —
  // same wording works for both contexts. Falls back to the writer's
  // free-form reason text.
  const reasonCode = p.reason_code || action.reason_code;
  let reason = action.reason || null;
  if (kind && reasonCode) {
    const bodyKey = `ask.${kind}.body.${reasonCode}`;
    const localizedBody = t(bodyKey, localized);
    if (localizedBody !== bodyKey && !hasUnresolvedPlaceholder(localizedBody)) {
      reason = localizedBody;
    }
  }

  return { summary, reason };
}

// Detect leftover {var} placeholders — means the template needed a
// param the caller didn't supply. The legacy fallback is preferable
// to showing raw template tokens to a user.
function hasUnresolvedPlaceholder(s) {
  return typeof s === 'string' && /\{[a-z_][a-z0-9_]*\}/i.test(s);
}

// Renders the kind-specific localized template (`legacy.<kind>.summary`)
// from the raw column data the caller stashed on `action.raw`. Returns
// null when we can't build a clean string (no raw row, unknown kind,
// or required column missing) — the renderer then falls through to the
// writer-supplied English `legacySummary`.
function renderLocalizedLegacySummary(t, action) {
  const row = action?.raw;
  if (!row) return null;
  const kind = action.kind;
  const sevLabel = row.severity ? t(`severity.${row.severity}`) : '';
  const sevSuffix = sevLabel ? ` · ${sevLabel}` : '';

  let vars;
  switch (kind) {
    case 'setpoint_change': {
      const dc = Number(row.delta_c);
      if (!Number.isFinite(dc)) return null;
      vars = { delta_signed: `${dc >= 0 ? '+' : ''}${dc.toFixed(1)}`, zone: row.zone || '' };
      break;
    }
    case 'supply_order':
      vars = {
        sku: row.sku || '',
        qty_suffix: row.qty ? ` × ${row.qty}` : '',
        vendor_suffix: row.vendor ? ` · ${row.vendor}` : '',
      };
      break;
    case 'booking_release':
      vars = {
        room: row.room || '',
        mins_suffix: row.recovered_minutes ? ` · +${row.recovered_minutes}m` : '',
      };
      break;
    case 'setback_proposal':
      vars = {
        zone: row.zone || '',
        kwh_suffix: row.est_savings_kwh ? ` · ~${row.est_savings_kwh} kWh` : '',
      };
      break;
    case 'evidence_request':
      vars = { artifact: row.artifact || '', severity_suffix: sevSuffix };
      break;
    case 'escalation':
      vars = { location: row.location_label || '', severity_suffix: sevSuffix };
      break;
    default:
      return null;
  }

  const key = `legacy.${kind}.summary`;
  const out = t(key, vars);
  if (out === key || hasUnresolvedPlaceholder(out)) return null;
  return out;
}

// Convenience for the route_overrides display path in Schedules.
// Override rows have a slightly different shape than agent_actions
// (they live in a different table) but the params + reason_code
// structure is identical. Adapt and delegate.
export function useRouteOverrideRenderer() {
  const t = useT();
  return (override) => renderRouteOverride(t, override);
}

function renderRouteOverride(t, override) {
  if (!override) return { summary: '', reason: null };
  return renderAgentAction(t, {
    kind: 'route_override',
    params: override.params || null,
    reason_code: override.reason_code || null,
    reason: override.reason || null,
    legacySummary: null,
  });
}

// Kinds that have per-kind DICT templates (rendered already-localized via
// t()). Everything else — including 'servicing', 'incident_simulator',
// 'freeform', and any unknown kind — falls through to the free-form title/body
// in the writer's language and must be translated on read. `localized` lets
// the renderers (CallRow, Chat, NowBriefing) decide whether to translate.
const STRUCTURED_ASK_KINDS = new Set([
  'route_override',
  'setpoint_change',
  'supply_order',
  'booking_release',
  'setback_proposal',
  'escalation',
  'evidence_request',
  'cold_chain_excursion',
  'pharmacy_temp_excursion',
  'predictive_maintenance',
  'asset_tracking',
]);

export function renderAsk(t, ask) {
  if (!ask) return { title: '', body: null, localized: false };
  const localized = STRUCTURED_ASK_KINDS.has(ask.kind);

  switch (ask.kind) {
    // Cleaning agent — title varies by override_action; body by reason_code.
    case 'route_override':
      return { ...renderTwoAxis(t, ask, 'route_override', 'override_action', 'extra'), localized };

    // Single-axis kinds: one title, body varies by reason_code.
    case 'setpoint_change':
      return { ...renderSingleAxis(t, ask, 'setpoint_change'), localized };
    case 'supply_order':
      return { ...renderSingleAxis(t, ask, 'supply_order'), localized };
    case 'booking_release':
      return { ...renderSingleAxis(t, ask, 'booking_release'), localized };
    case 'setback_proposal':
      return { ...renderSingleAxis(t, ask, 'setback_proposal'), localized };
    case 'escalation':
      return { ...renderSingleAxis(t, ask, 'escalation'), localized };
    case 'evidence_request':
      return { ...renderSingleAxis(t, ask, 'evidence_request'), localized };
    case 'cold_chain_excursion':
      return { ...renderSingleAxis(t, ask, 'cold_chain_excursion'), localized };
    case 'pharmacy_temp_excursion':
      return { ...renderSingleAxis(t, ask, 'pharmacy_temp_excursion'), localized };
    case 'predictive_maintenance':
      return { ...renderSingleAxis(t, ask, 'predictive_maintenance'), localized };
    case 'asset_tracking':
      return { ...renderSingleAxis(t, ask, 'asset_tracking'), localized };

    case 'incident_simulator':
    case 'freeform':
    default:
      return { title: ask.title, body: ask.body, localized: false };
  }
}

// Localize controlled-vocabulary param fields (severity, etc.) before
// interpolating into title/body templates. Anything not in the
// vocabulary passes through untouched — grammatical concordance only
// matters for known enum values.
function localizeParams(t, p) {
  const out = { ...p };
  if (p.severity) {
    const localized = t(`severity.${p.severity}`);
    if (localized !== `severity.${p.severity}`) out.severity = localized;
  }
  return out;
}

// Title varies by a discriminator in params (e.g. override_action),
// body varies by reason_code. Per-field fallback to writer-supplied
// title/body when the structured key isn't in the dict.
function renderTwoAxis(t, ask, kind, titleAxis, titleAxisDefault) {
  const p = ask.params || {};
  const localized = localizeParams(t, p);
  const titleAxisVal = p[titleAxis] || titleAxisDefault;
  const reasonCode = p.reason_code || 'manual';
  const titleKey = `ask.${kind}.title.${titleAxisVal}`;
  const bodyKey = `ask.${kind}.body.${reasonCode}`;
  const title = t(titleKey, localized);
  const body = t(bodyKey, localized);
  return {
    title: title === titleKey ? ask.title || title : title,
    body: body === bodyKey ? ask.body || body : body,
  };
}

// One title, body varies by reason_code.
function renderSingleAxis(t, ask, kind) {
  const p = ask.params || {};
  const localized = localizeParams(t, p);
  const reasonCode = p.reason_code || 'manual';
  const titleKey = `ask.${kind}.title`;
  const bodyKey = `ask.${kind}.body.${reasonCode}`;
  const title = t(titleKey, localized);
  const body = t(bodyKey, localized);
  return {
    title: title === titleKey ? ask.title || title : title,
    body: body === bodyKey ? ask.body || body : body,
  };
}
