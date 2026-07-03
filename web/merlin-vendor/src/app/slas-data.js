// SLA scorecards + live performance computation. (Track S)
//
// Two hooks:
//   useSlas(orgId)         — list SLAs from public.slas (org-scoped),
//                            realtime-subscribed.
//   useSlaPerformance(orgId)
//                          — for each SLA, compute current % vs target
//                            from the underlying event stream + return
//                            a small set of derived stats for the UI.
//
// metric_kind dispatch in computeSlaPerformance:
//   response_time — % of device_requests resolved within max_minutes.
//                   trend = 14-day daily series.
//                   contributors = top locations by breach count.
//   count         — % of recent windows with open count <= max_open_count.
//                   For supplies: count of currently-open requests with
//                   age > 1h. We render at_risk = currently-open-too-long
//                   and breaches_mtd = how many such breaches this month.
//   threshold     — needs sensor data we don't have yet (Air Quality probe,
//                   temperature). Returns { computable: false } so the UI
//                   renders a "Pending data" placeholder.
//   compliance    — % of branches/devices that completed daily action.
//                   Wired for the bank scenario where service_policy lives
//                   on devices and device_service_sessions records actions.
//
// The 14-day trend keeps the per-SLA query bounded — Meridian generates a
// few thousand events/day, so 14 days is well under 100k rows in the worst
// case. If volume grows, swap to a daily-aggregate sla_snapshots table.

import { useEffect, useId, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { fetchAllPaginated } from './pagination.js';

// Agent-action tables an SLA can target via metric_kind='count' +
// config.source='<table>'. See computeAgentActivity below + the
// matching list in api/_lib/sla-perf.js.
const AGENT_ACTIVITY_SOURCES = new Set([
  'agent_booking_releases',
  'agent_setback_proposals',
  'agent_escalations',
  'agent_supply_orders',
]);

// Per-source labels for the SLA card narrative — keeps Insights
// recommendations readable across all four agent-activity sources
// without hardcoding "release" everywhere.
const AGENT_ACTIVITY_LABELS = {
  agent_booking_releases: { noun: 'release', verb: 'auto-release', agent: 'Space agent' },
  agent_setback_proposals: { noun: 'setback proposal', verb: 'propose a setback', agent: 'Energy agent' },
  agent_escalations: { noun: 'escalation', verb: 'escalate', agent: 'Security agent' },
  agent_supply_orders: { noun: 'supply order', verb: 'place an order', agent: 'Supply agent' },
};

// Per-source contributor field — most agent activity tables key by
// `location_id` (or `room` for booking releases). Picks a column to
// roll up "top contributors" against in the SLA card.
const AGENT_ACTIVITY_CONTRIBUTOR_FIELD = {
  agent_booking_releases: 'room',
  agent_setback_proposals: 'zone',
  agent_escalations: 'location_label',
  agent_supply_orders: 'sku',
};

// ────── useSlas: list SLAs from DB ──────────────────────────────────
//
// scope defaults to 'agreement' so existing callers (Insights, agent
// context, MetricsWidgets) keep receiving the formal SLAs they always
// did. Pass { scope: 'target' } to read personal/team Type B targets;
// pass { scope: null } to bypass the filter entirely (used in places
// that need to roll up both, e.g. a future cross-scope dashboard).
//
// acceptedOnly (default false) adds `.not('accepted_at', 'is', null)`
// — only in-effect agreements. Pending proposals (accepted_at IS NULL)
// drop out. Used by useSlaPerformance so Insights/Dashboard/Metrics
// widgets don't compute live % on rows that aren't yet in effect.
// The Admin → SLAs editor passes the default (false) to keep pending
// proposals visible for the author to manage.
//
// Migration 142 introduced the scope column with a default of
// 'agreement'; migration 143 introduced accepted_at semantics. Both
// filters are safe pre- and post-migration.

export function useSlas(orgId, { scope = 'agreement', acceptedOnly = false } = {}) {
  const [slas, setSlas] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // useId gives every hook-call a unique suffix so two components calling
  // useSlas(orgId) at the same time don't both ask supabase.channel() for
  // the same topic. Supabase de-dupes by topic and reuses the existing
  // channel, but you can't add new `.on()` callbacks to a channel that's
  // already been `.subscribe()`d — it throws "cannot add postgres_changes
  // callbacks ... after subscribe()" and crashes the React tree.
  const instanceId = useId();

  useEffect(() => {
    if (!orgId) {
      setSlas([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    let channel = null;

    async function refresh() {
      let query = supabase
        .from('slas')
        // Embed the counterparty org's name/kind so SLA cards can show WHICH
        // contractor an agreement is against. RLS organizations_counterparty_read
        // lets a manager read the orgs it holds contracts with; NULL for internal
        // (non-counterparty) SLAs.
        .select('*, counterparty:organizations!slas_counterparty_org_fkey(name, kind)')
        .eq('organization_id', orgId)
        .eq('active', true)
        .order('display_order', { ascending: true });
      if (scope) query = query.eq('scope', scope);
      if (acceptedOnly) query = query.not('accepted_at', 'is', null);
      const { data, error } = await query;
      if (cancelled) return;
      if (error) captureException(error, { where: 'useSlas' });
      setSlas(error || !data ? [] : data);
      setLoaded(true);
    }

    refresh();

    channel = supabase
      .channel(`slas_${orgId}_${scope || 'all'}_${acceptedOnly ? 'accepted' : 'any'}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'slas', filter: `organization_id=eq.${orgId}` },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orgId, scope, acceptedOnly, instanceId]);

  return { slas, loaded };
}

// ────── useAuthoredAgreements: contractor-side view of "agreements I
// proposed" — joined with the customer org for headering. RLS
// already restricts the contractor to rows where they're a party
// (counterparty_org = my org, OR authored_by_org = my org). We filter
// on counterparty_org so customer-authored agreements where the
// contractor is the deliverer are included too.
//
// Used by Operations → SLAs (contractor surface, PR 3). The embed
// pins the FK constraint name because slas has three FKs to
// organizations (organization_id, authored_by_org, counterparty_org).

export function useAuthoredAgreements(orgId) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    let channel = null;

    async function refresh() {
      const { data, error } = await supabase
        .from('slas')
        .select(
          `
          *,
          customer:organizations!slas_organization_id_fkey(id, name, kind, slug),
          location:locations(id, name)
        `,
        )
        .eq('scope', 'agreement')
        .eq('active', true)
        .eq('counterparty_org', orgId)
        .order('display_order', { ascending: true });
      if (cancelled) return;
      if (error) captureException(error, { where: 'useAuthoredAgreements' });
      setRows(error || !data ? [] : data);
      setLoaded(true);
    }

    refresh();

    channel = supabase
      .channel(`slas_authored_${orgId}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'slas', filter: `counterparty_org=eq.${orgId}` },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orgId, instanceId]);

  return { rows, loaded };
}

// ────── Accept / version helpers ────────────────────────────────────

// Counterparty side stamps accepted_at via SECURITY DEFINER RPC. The
// RLS UPDATE policy only lets the AUTHORING side touch pending rows,
// so a direct supabase.from('slas').update({accepted_at: …}) by the
// counterparty would fail — hence the RPC (migration 143).
export async function acceptSla(slaId) {
  const { error } = await supabase.rpc('accept_sla', { p_sla_id: slaId });
  if (error) throw new Error(error.message);
}

// Target visibility moves through a SECURITY DEFINER RPC so the
// "private/team is open, org requires admin" rule (manager bump) can
// be enforced consistently — migration 144. Creator can also set
// private/team via the RLS UPDATE policy directly, but the UI funnels
// everything through this RPC so error messages are uniform.
export async function setTargetVisibility(slaId, visibility) {
  const { error } = await supabase.rpc('set_target_visibility', {
    p_sla_id: slaId,
    p_visibility: visibility,
  });
  if (error) throw new Error(error.message);
}

// Compute who the caller is relative to an agreement row:
//   'author'    — caller's org is authored_by_org (and not the accepter)
//   'accepter'  — caller's org is the OTHER party from author
//   'both'      — author = accepter (internal SLA, same-org)
//   'observer'  — neither (shouldn't happen under RLS, defensive)
// Used by the UI to decide which action buttons to show on each row.
export function actorRoleForAgreement(sla, callerOrgId) {
  if (!sla || !callerOrgId) return 'observer';
  const author = sla.authored_by_org;
  // For internal SLAs (counterparty_org is null), accepter is also
  // organization_id. For cross-org, accepter is the party that isn't
  // the author.
  const accepter =
    author === sla.organization_id
      ? sla.counterparty_org // could be null for internal
      : sla.organization_id;
  const isAuthor = callerOrgId === author;
  const isAccepter = callerOrgId === accepter;
  if (isAuthor && isAccepter) return 'both';
  if (isAuthor) return 'author';
  if (isAccepter) return 'accepter';
  return 'observer';
}

// ────── useSlaSourceHealth: derived source-dep status per SLA (PR 6) ─
//
// Calls derive_sla_source_health(orgId) every ~60s and on realtime
// changes to either slas (catalog id wiring) or source_connection
// (status flips from the PR 4 health loop). Returns a map keyed by
// sla.id → { total, healthy, degraded, offline, derived_status }.
//
// derived_status values: 'no_sources' | 'computing' | 'impaired' | 'paused'.
// SlaRow renders an Impaired / Paused pill on non-computing rows.

export function useSlaSourceHealth(orgId) {
  const [byId, setById] = useState({});
  const [loaded, setLoaded] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    if (!orgId) {
      setById({});
      setLoaded(false);
      return;
    }
    let cancelled = false;
    let timer = null;
    let chanSlas = null;
    let chanConn = null;

    async function refresh() {
      const { data, error } = await supabase.rpc('derive_sla_source_health', { p_org_id: orgId });
      if (cancelled) return;
      if (error) captureException(error, { where: 'useSlaSourceHealth' });
      const next = {};
      for (const r of error ? [] : data || []) next[r.sla_id] = r;
      setById(next);
      setLoaded(true);
    }

    refresh();
    timer = setInterval(refresh, 60_000);

    // Realtime: catalog id wiring changes (slas) + connection status
    // flips (source_connection). Either invalidates the derived view.
    chanSlas = supabase
      .channel(`sla_health_slas_${orgId}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'slas', filter: `organization_id=eq.${orgId}` },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();
    chanConn = supabase
      .channel(`sla_health_conn_${orgId}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'source_connection', filter: `organization_id=eq.${orgId}` },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (chanSlas) supabase.removeChannel(chanSlas);
      if (chanConn) supabase.removeChannel(chanConn);
    };
  }, [orgId, instanceId]);

  return { byId, loaded };
}

// ────── useSlaPerformance: compute per-SLA live stats ───────────────

export function useSlaPerformance(orgId, windowSpec = '14d') {
  // Only in-effect agreements feed live perf computation. Targets are
  // dashboard-only (excluded by default scope='agreement') and pending
  // proposals shouldn't show % until they're accepted (PR 5 adds
  // acceptedOnly). Predecessor rows that have been superseded flip to
  // active=false at accept time (migration 143 accept_sla RPC) so they
  // drop out via the existing active=true filter.
  const { slas, loaded: slasLoaded } = useSlas(orgId, { scope: 'agreement', acceptedOnly: true });
  const [perf, setPerf] = useState({});
  const [openAskBySlaId, setOpenAskBySlaId] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [asksTick, bumpAsksTick] = useState(0);
  // See useSlas above for why we suffix the channel topic — multiple
  // simultaneous useSlaPerformance callers (KpiRing + SlaBreachStrip on
  // the same Metrics page) would otherwise crash on `.on()` after a
  // shared channel is `.subscribe()`d.
  const instanceId = useId();

  // Subscribe to public.events (phase 4 of events-pipeline) so the
  // "open ask" pill on each SLA card appears the instant an agent
  // decides=ask, and clears the instant a human approves/holds/
  // dismisses it. The asks-list fetcher above reads from events too,
  // so source + listener stay in sync.
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`sla_open_asks_${orgId}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `organization_id=eq.${orgId}` },
        () => bumpAsksTick((n) => n + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, instanceId]);

  useEffect(() => {
    if (!orgId || !slasLoaded) {
      return;
    }
    if (slas.length === 0) {
      setPerf({});
      setOpenAskBySlaId({});
      setLoaded(true);
      return;
    }

    let cancelled = false;
    const windowDays = resolveWindowDays(windowSpec);
    (async () => {
      // Pre-warm the location-id → name map so contributor pills render
      // "Floor 18 · Conf Sycamore" instead of raw "hq" or "feb-nyc". Org-
      // scoped read is RLS-cheap and the result is shared across all SLAs.
      const locNameById = await fetchLocationNames(orgId);

      // Fetch open agent asks for this org so each SLA can render an
      // "open ask" pill. Match by checking whether the action.subject
      // contains the SLA name — the model sometimes augments the
      // subject ("Daily cleaning compliance + NFC audit gap") instead
      // of using the SLA name verbatim, so substring match is more
      // forgiving than equality. Per-SLA picks the most-recent
      // matching ask (asks are pre-sorted desc by created_at).
      const openAsksList = await fetchOpenAsksList(orgId);

      const out = {};
      for (const sla of slas) {
        if (!sla.computable) {
          out[sla.id] = pendingDataResult(sla);
          continue;
        }
        try {
          if (sla.metric_kind === 'response_time') {
            out[sla.id] = await computeResponseTime(orgId, sla, windowDays);
          } else if (sla.metric_kind === 'count' && AGENT_ACTIVITY_SOURCES.has(sla?.config?.source)) {
            out[sla.id] = await computeAgentActivity(orgId, sla);
          } else if (sla.metric_kind === 'count') {
            out[sla.id] = await computeOpenCount(orgId, sla, windowDays);
          } else if (sla.metric_kind === 'compliance') {
            out[sla.id] = await computeCompliance(orgId, sla, windowDays);
          } else if (sla.metric_kind === 'threshold') {
            out[sla.id] = pendingDataResult(sla);
          } else {
            out[sla.id] = pendingDataResult(sla);
          }
          // Decorate contributor entries with friendly names (post-compute
          // so each computer stays focused on its event-stream math).
          if (out[sla.id]?.contributors?.length) {
            out[sla.id].contributors = out[sla.id].contributors.map((c) => ({
              ...c,
              name: locNameById.get(c.location_id) || c.location_id,
            }));
          }
        } catch (err) {
          captureException(err, { where: 'useSlaPerformance' });
          out[sla.id] = { ...pendingDataResult(sla), error: err?.message || String(err) };
        }
      }

      // Demo polish: replay-mode orgs carry several computable=false SLAs
      // (servicing/apex-sourced response_time + threshold clauses) that read
      // "Pending data" on the owner SLA dashboard — yet the SERVICING boards
      // show REAL adherence for those exact lines. Synthesize a believable
      // `current` for those clauses anchored to their line's live servicing
      // adherence, so the owner SLA view is coherent with SERVICING instead of
      // a wall of "Pending data". Same approach the contractor /performance
      // endpoint already uses. Gated to replay orgs — real (non-replay) orgs and
      // any clause with no matching servicing line keep their genuine pending.
      try {
        const { data: orgRow } = await supabase
          .from('organizations')
          .select('replay_mode')
          .eq('id', orgId)
          .maybeSingle();
        if (orgRow?.replay_mode) {
          const lineAdh = await fetchServicingLineAdherence(orgId);
          for (const sla of slas) {
            const r = out[sla.id];
            if (!r || r.computable !== false) continue; // only the pending placeholders
            const line = SLA_DOMAIN_TO_SERVICING_LINE[sla.domain];
            if (!line || lineAdh[line] == null) continue;
            out[sla.id] = synthSlaFromServicing(sla, lineAdh[line]);
          }
        }
      } catch (e) {
        captureException(e, { where: 'useSlaPerformance' }); /* keep the genuine pending values */
      }

      // Build per-sla open-ask map. For each SLA, find the most-recent
      // open ask whose action.subject contains the SLA name (case-
      // insensitive). openAsksList is already sorted desc by created_at
      // so the first match is the freshest.
      const openAsks = {};
      for (const sla of slas) {
        const needle = (sla.name || '').toLowerCase();
        if (!needle) continue;
        for (const ask of openAsksList) {
          const haystack = (ask.subject || '').toLowerCase();
          if (haystack.includes(needle)) {
            openAsks[sla.id] = ask;
            break;
          }
        }
      }

      if (!cancelled) {
        setPerf(out);
        setOpenAskBySlaId(openAsks);
        setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId, slasLoaded, slas, asksTick, windowSpec]);

  return { slas, perf, openAskBySlaId, loaded, windowDays: resolveWindowDays(windowSpec) };
}

// Window selector spec → number of lookback days. 'mtd' resolves
// dynamically to "days since the 1st of the calendar month" so the
// sparkline + sample size shift naturally as the month progresses.
// 7d / 14d / 30d are absolute fixed lookbacks.
function resolveWindowDays(spec) {
  if (spec === '7d') return 7;
  if (spec === '30d') return 30;
  if (spec === 'mtd') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const ms = now - start;
    return Math.max(1, Math.ceil(ms / 86_400_000));
  }
  return 14; // default
}

export function windowLabel(spec) {
  if (spec === '7d') return 'Last 7 days';
  if (spec === '30d') return 'Last 30 days';
  if (spec === 'mtd') return 'Month to date';
  return 'Last 14 days';
}

async function fetchOpenAsksList(orgId) {
  // Events-pipeline phase 4: open asks now live as unresolved rows in
  // public.events whose backing agent_run has decision='ask'. The
  // agent's structured action still lives on agent_runs.action_payload
  // (keyed by agent_run_id) — we join via the FK PostgREST sees on
  // events.agent_run_id and grab subject / gap_type from there.
  const events = await fetchAllPaginated(() =>
    supabase
      .from('events')
      .select(
        'id, processed_by_agent_id, payload, agent_run_id, created_at, agent_runs!agent_run_id(decision, ask_resolution, action_payload)',
      )
      .eq('organization_id', orgId)
      .eq('resolved', false)
      .not('agent_run_id', 'is', null)
      .order('created_at', { ascending: false }),
  ).catch((e) => {
    captureException(e, { where: 'slas:open-asks-events' });
    return [];
  });
  if (!events || events.length === 0) return [];

  const out = [];
  for (const ev of events) {
    const run = ev.agent_runs;
    if (!run || run.decision !== 'ask' || run.ask_resolution) continue;
    const payload = run.action_payload || null;
    const subject = payload?.subject;
    if (!subject) continue;
    out.push({
      id: ev.id,
      agent_id: ev.processed_by_agent_id || null,
      title: ev.payload?.title || null,
      subject,
      gap_type: payload?.gap_type || null,
      created_at: ev.created_at,
    });
  }
  return out;
}

async function fetchLocationNames(orgId) {
  const map = new Map();
  const data = await fetchAllPaginated(() =>
    supabase.from('locations').select('id, name').eq('organization_id', orgId).order('id'),
  ).catch((e) => {
    captureException(e, { where: 'slas:location-names' });
    return [];
  });
  for (const row of data || []) {
    if (row.id) map.set(row.id, row.name || row.id);
  }
  return map;
}

// ────── replay-org servicing-anchored SLA synth ─────────────────────
// Maps an SLA's domain to the servicing line whose live adherence anchors its
// synthesized value (replay orgs only). Domains with no servicing line (energy
// / space / supplies) are absent → those SLAs are never synthesized.
export const SLA_DOMAIN_TO_SERVICING_LINE = {
  cleaning: 'cleaning',
  hygiene: 'cleaning',
  hospitality: 'hospitality',
  amenity: 'hospitality',
  maintenance: 'maintenance',
  hvac: 'maintenance',
  uptime: 'maintenance',
  security: 'security',
  safety: 'security',
};

// Item-weighted servicing adherence per line, from demo_servicing_perf (the
// same source the contractor /performance synth reads). Returns e.g.
// { cleaning: 93, hospitality: 88, maintenance: 99, security: 87 }.
async function fetchServicingLineAdherence(orgId) {
  const { data } = await supabase
    .from('demo_servicing_perf')
    .select('domain, adherence_pct, items_total')
    .eq('organization_id', orgId);
  const num = {};
  const den = {};
  for (const r of data || []) {
    const line = String(r.domain || '').split('_')[0];
    const w = Number(r.items_total) || 0;
    num[line] = (num[line] || 0) + (Number(r.adherence_pct) || 0) * w;
    den[line] = (den[line] || 0) + w;
  }
  const out = {};
  for (const line of Object.keys(den)) out[line] = den[line] > 0 ? Math.round(num[line] / den[line]) : null;
  return out;
}

// FNV-1a → deterministic per-SLA jitter so synthesized values are stable across
// renders (and differ between clauses) rather than random each fetch.
function slaHash(s) {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Believable perf for a pending clause, anchored to its line's real servicing
// adherence. Healthy lines (≥92) carry no extra gap; weaker lines pull the
// clause a few points below target. Mirrors the contractor endpoint's
// synthesizeDemoClauses so owner + contractor SLA views stay consistent.
function synthSlaFromServicing(sla, lineAdh) {
  const target = Number(sla.target_pct) || 95;
  const lineGap = Math.max(0, 92 - lineAdh);
  const drift = (slaHash(sla.id) % 5) - 2; // -2..+2 around target
  const current = Math.max(72, Math.min(100, Math.round(target + drift - lineGap)));
  const status = current >= target ? 'ok' : target - current <= 5 ? 'at_risk' : 'breaching';
  const breaches = status === 'ok' ? 0 : status === 'at_risk' ? 1 : 2 + (slaHash(sla.id) % 3);
  const trend = Array.from({ length: 8 }, (_, i) =>
    Math.max(70, Math.min(100, current + ((slaHash(sla.id + ':' + i) % 5) - 2))),
  );
  return {
    computable: true,
    current,
    target,
    status,
    at_risk: status === 'at_risk' ? 1 : 0,
    breaches_mtd: breaches,
    sample_size: 24 + (slaHash(sla.id) % 40),
    trend,
    contributors: [],
    recommendations: [],
  };
}

// ────── per-metric_kind computers ───────────────────────────────────

function pendingDataResult(sla) {
  return {
    computable: false,
    current: null,
    target: Number(sla.target_pct),
    status: 'pending',
    at_risk: null,
    breaches_mtd: null,
    trend: [],
    contributors: [],
    recommendations: [
      // Generic guidance until the sensor class exists.
      'Pending data — this SLA needs a device class that the fleet does not carry yet.',
      'Add the matching sensor (e.g., Air Quality probe) to capture the metric.',
    ],
  };
}

// % of resolved device_requests in the last `windowDays` days that
// closed within max_minutes. Pulled raw because we need the per-row
// latency to also compute the trend + the top-contributing locations.
async function computeResponseTime(orgId, sla, windowDays = 14) {
  const maxMinutes = Number(sla?.config?.max_minutes ?? 20);
  const sinceWin = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const startMonth = startOfMonth().toISOString();

  // Paginated past PostgREST's 1000-row cap. A busy tenant's recent
  // device_requests over a 14-day window can exceed that.
  const list = await fetchAllPaginated(() =>
    supabase
      .from('device_requests')
      .select('id, location_id, request_type, first_pressed_at, resolved_at')
      .eq('organization_id', orgId)
      .gte('first_pressed_at', sinceWin)
      .order('first_pressed_at', { ascending: false }),
  );

  // Closed = has resolved_at; latency in minutes.
  const closed = list
    .filter((r) => r.resolved_at)
    .map((r) => ({
      ...r,
      latency_min: Math.max(0, (new Date(r.resolved_at) - new Date(r.first_pressed_at)) / 60000),
    }));

  // Currently open (no resolved_at) AND already past max_minutes = at_risk now.
  const nowMs = Date.now();
  const openAtRisk = list
    .filter((r) => !r.resolved_at)
    .filter((r) => (nowMs - new Date(r.first_pressed_at).getTime()) / 60000 > maxMinutes);

  const passed = closed.filter((r) => r.latency_min <= maxMinutes).length;
  const total = closed.length;
  const current = total > 0 ? round2((passed / total) * 100) : null;

  // Breaches this month = closed slow-resolutions with first_pressed_at in current month.
  const breachesMtd = closed.filter((r) => r.latency_min > maxMinutes && r.first_pressed_at >= startMonth).length;

  // Daily trend over the active window (% per day).
  const trend = buildResponseTimeTrend(closed, maxMinutes, windowDays);

  // Top contributing locations (highest breach count).
  const contributors = topBreachContributors(closed.filter((r) => r.latency_min > maxMinutes));

  const status = statusFor(current, sla.target_pct);

  return {
    computable: true,
    current,
    target: Number(sla.target_pct),
    status,
    at_risk: openAtRisk.length,
    breaches_mtd: breachesMtd,
    sample_size: total,
    trend,
    contributors,
    recommendations: recommendResponseTime({ status, atRisk: openAtRisk.length, breachesMtd, maxMinutes }),
  };
}

// "0 stockouts" SLA: open requests whose age > 1h are out of compliance.
// current = % of recent buckets with zero such breaches; for v1 we render
// a simpler "currently OK / N at-risk" state instead of a smoothed %.
async function computeOpenCount(orgId, sla, windowDays = 14) {
  const types = Array.isArray(sla?.config?.request_types) ? sla.config.request_types : null;
  const maxOpen = Number(sla?.config?.max_open_count ?? 0);
  const sinceWin = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const startMonth = startOfMonth().toISOString();
  const oneHourMs = 60 * 60 * 1000;

  // Paginated past PostgREST's 1000-row cap. The .in() filter further
  // narrows volume; the query builder is closed-over so each page applies
  // it identically.
  const list = await fetchAllPaginated(() => {
    let q = supabase
      .from('device_requests')
      .select('id, location_id, request_type, first_pressed_at, resolved_at')
      .eq('organization_id', orgId)
      .gte('first_pressed_at', sinceWin)
      .order('first_pressed_at', { ascending: false });
    if (types && types.length) q = q.in('request_type', types);
    return q;
  });
  const nowMs = Date.now();

  const openAged = list.filter((r) => !r.resolved_at && nowMs - new Date(r.first_pressed_at).getTime() > oneHourMs);
  const closedThisMonth = list.filter((r) => r.resolved_at && r.first_pressed_at >= startMonth);
  const breachesMtd = closedThisMonth.filter((r) => {
    const lat = new Date(r.resolved_at) - new Date(r.first_pressed_at);
    return lat > oneHourMs;
  }).length;

  // Per-day % = % of (closed-or-open buckets ending that day) where open
  // count stayed ≤ max_open_count. For v1 simpler approximation: % of
  // closed requests that day resolved within 1h.
  const trend = buildHourlyTrend(list, oneHourMs, windowDays);

  // For supplies: "current" reads as 100% when no breaches mid-day, drops
  // as breaches accumulate. Use the most recent day's snapshot.
  const todayBreachCount = openAged.length;
  const current = todayBreachCount <= maxOpen ? 100 : Math.max(0, 100 - todayBreachCount * 5);

  const status = statusFor(current, sla.target_pct);

  return {
    computable: true,
    current,
    target: Number(sla.target_pct),
    status,
    at_risk: openAged.length,
    breaches_mtd: breachesMtd,
    sample_size: list.length,
    trend,
    contributors: topBreachContributors(
      closedThisMonth.filter((r) => {
        const lat = new Date(r.resolved_at) - new Date(r.first_pressed_at);
        return lat > oneHourMs;
      }),
    ),
    recommendations: recommendCount({ status, atRisk: openAged.length, breachesMtd, types }),
  };
}

// Generic agent-activity SLA: scores "% of last N weekdays where the
// row count in <source-table> met or exceeded min_per_day". Mirrors
// computeAgentActivity in api/_lib/sla-perf.js so the agent prompt
// and the Insights SLA card render the same number. Drives the
// Space (booking releases), Energy (setback proposals), and Security
// (escalations) SLAs today — Supply will join when its source has
// data flowing.
async function computeAgentActivity(orgId, sla) {
  const source = sla?.config?.source;
  const lookbackWeekdays = Number(sla?.config?.lookback_weekdays ?? 10);
  const minPerDay = Number(sla?.config?.min_per_day ?? 1);
  if (!AGENT_ACTIVITY_SOURCES.has(source)) {
    return { computable: false, current: null, target: Number(sla.target_pct), status: 'pending', sample_size: 0 };
  }
  const labels = AGENT_ACTIVITY_LABELS[source] || { noun: 'action', verb: 'act', agent: 'agent' };
  const contribField = AGENT_ACTIVITY_CONTRIBUTOR_FIELD[source] || null;

  // Build the list of weekdays (newest first) we want to score.
  const weekdays = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (weekdays.length < lookbackWeekdays) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) weekdays.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  const oldest = weekdays[weekdays.length - 1];
  const newestEnd = new Date(weekdays[0]);
  newestEnd.setDate(newestEnd.getDate() + 1);

  const selectCols = ['applied_at'];
  if (contribField) selectCols.push(contribField);
  const { data: rows, error } = await supabase
    .from(source)
    .select(selectCols.join(', '))
    .eq('organization_id', orgId)
    .gte('applied_at', oldest.toISOString())
    .lt('applied_at', newestEnd.toISOString())
    .order('applied_at', { ascending: true });
  if (error) throw new Error(error.message);

  const perDay = new Map();
  for (const r of rows || []) {
    const k = r.applied_at.slice(0, 10);
    perDay.set(k, (perDay.get(k) || 0) + 1);
  }

  const startMonth = startOfMonth().toISOString().slice(0, 10);
  let metDays = 0;
  let breachesMtd = 0;
  // Build a daily trend so the SLA card sparkline renders. weekdays is
  // newest-first; trend convention used by the other computers is also
  // newest-first so chart code can take it as-is.
  const trend = weekdays.map((day) => {
    const k = day.toISOString().slice(0, 10);
    const n = perDay.get(k) || 0;
    if (n >= minPerDay) metDays++;
    else if (k >= startMonth) breachesMtd++;
    return { date: k, pct: n >= minPerDay ? 100 : 0, count: n };
  });

  const current = lookbackWeekdays > 0 ? Math.round((metDays / lookbackWeekdays) * 1000) / 10 : null;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCount = perDay.get(todayKey) || 0;
  const at_risk = todayCount < minPerDay ? 1 : 0;
  const status = statusFor(current, sla.target_pct);

  return {
    computable: true,
    current,
    target: Number(sla.target_pct),
    status,
    at_risk,
    breaches_mtd: breachesMtd,
    sample_size: lookbackWeekdays,
    trend,
    contributors: topAgentActivityContributors(rows || [], contribField),
    recommendations: recommendAgentActivity({ status, todayCount, minPerDay, breachesMtd, labels }),
  };
}

// Top contributors by # of activity rows in the chosen
// `contribField`. The Insights SLA card renders the result as
// "Conf Sycamore (5), Conf Alder (3) …" or similar.
function topAgentActivityContributors(rows, field) {
  if (!field) return [];
  const counts = new Map();
  for (const r of rows) {
    const key = r?.[field];
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([location_id, count]) => ({ location_id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function recommendAgentActivity({ status, todayCount, minPerDay, breachesMtd, labels }) {
  const recs = [];
  if (status === 'breach' || status === 'at_risk') {
    if (todayCount < minPerDay) {
      recs.push(
        `Today's ${labels.noun} count is ${todayCount} (target ≥ ${minPerDay}). Have the ${labels.agent} re-scan its inputs and ${labels.verb} where needed.`,
      );
    }
    if (breachesMtd > 0) {
      recs.push(
        `${breachesMtd} weekday${breachesMtd === 1 ? '' : 's'} this month had no ${labels.noun}s. Verify the ${labels.agent} autonomy policy isn't blocking action.`,
      );
    }
  }
  return recs;
}

// % of devices with service_policy that completed today's daily action.
// Reuses the bank-compliance pattern (see Dashboard's
// useBankComplianceToday) but in the SLA-scorecard format.
async function computeCompliance(orgId, sla, windowDays = 14) {
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sinceWin = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: devices, error: dErr } = await supabase
    .from('devices')
    .select('id, telemetry')
    .eq('organization_id', orgId);
  if (dErr) throw new Error(dErr.message);
  const policyDevices = (devices || []).filter((d) => d?.telemetry?.service_policy);
  const totalBranches = policyDevices.length;
  if (totalBranches === 0) return pendingDataResult(sla);

  const { data: sessions, error: sErr } = await supabase
    .from('device_service_sessions')
    .select('device_id, started_at')
    .eq('organization_id', orgId)
    .gte('started_at', sinceWin);
  if (sErr) throw new Error(sErr.message);

  // Today (last 24h)
  const cleanedTodaySet = new Set();
  for (const s of sessions || []) {
    if (s.started_at >= since24) cleanedTodaySet.add(s.device_id);
  }
  const cleanedToday = cleanedTodaySet.size;
  const missedToday = Math.max(0, totalBranches - cleanedToday);
  const current = totalBranches > 0 ? round2((cleanedToday / totalBranches) * 100) : null;

  // Daily trend across the active window.
  const trend = buildComplianceTrend(sessions || [], totalBranches, windowDays);

  const status = statusFor(current, sla.target_pct);

  return {
    computable: true,
    current,
    target: Number(sla.target_pct),
    status,
    at_risk: missedToday,
    breaches_mtd: countMissedDaysThisMonth(sessions || [], totalBranches),
    sample_size: totalBranches,
    trend,
    contributors: [],
    recommendations: recommendCompliance({ status, missedToday, totalBranches }),
  };
}

// ────── trend builders ──────────────────────────────────────────────

function buildResponseTimeTrend(closedRows, maxMinutes, days) {
  const buckets = makeDayBuckets(days);
  for (const r of closedRows) {
    const dayKey = bucketKey(r.first_pressed_at);
    if (buckets[dayKey]) {
      buckets[dayKey].total += 1;
      if (r.latency_min <= maxMinutes) buckets[dayKey].passed += 1;
    }
  }
  return Object.values(buckets).map((b) => ({
    date: b.date,
    pct: b.total > 0 ? round2((b.passed / b.total) * 100) : null,
  }));
}

function buildHourlyTrend(rows, maxAgeMs, days) {
  const buckets = makeDayBuckets(days);
  for (const r of rows) {
    if (!r.resolved_at) continue;
    const dayKey = bucketKey(r.resolved_at);
    if (buckets[dayKey]) {
      const lat = new Date(r.resolved_at) - new Date(r.first_pressed_at);
      buckets[dayKey].total += 1;
      if (lat <= maxAgeMs) buckets[dayKey].passed += 1;
    }
  }
  return Object.values(buckets).map((b) => ({
    date: b.date,
    pct: b.total > 0 ? round2((b.passed / b.total) * 100) : null,
  }));
}

function buildComplianceTrend(sessions, totalBranches, days) {
  const buckets = makeDayBuckets(days);
  // Per day: count of distinct branches that started a session that day.
  const perDayDevices = {};
  for (const s of sessions) {
    const dayKey = bucketKey(s.started_at);
    if (!perDayDevices[dayKey]) perDayDevices[dayKey] = new Set();
    perDayDevices[dayKey].add(s.device_id);
  }
  return Object.values(buckets).map((b) => {
    const cleanedThatDay = perDayDevices[b.key]?.size || 0;
    return {
      date: b.date,
      pct: totalBranches > 0 ? round2((cleanedThatDay / totalBranches) * 100) : null,
    };
  });
}

function countMissedDaysThisMonth(sessions, totalBranches) {
  const start = startOfMonth();
  const seenPerDay = {};
  for (const s of sessions) {
    if (new Date(s.started_at) < start) continue;
    const k = s.started_at.slice(0, 10);
    if (!seenPerDay[k]) seenPerDay[k] = new Set();
    seenPerDay[k].add(s.device_id);
  }
  let total = 0;
  for (const k of Object.keys(seenPerDay)) {
    const missed = Math.max(0, totalBranches - seenPerDay[k].size);
    total += missed;
  }
  return total;
}

// ────── shared helpers ──────────────────────────────────────────────

function makeDayBuckets(days) {
  const out = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    out[key] = { key, date: key, total: 0, passed: 0 };
  }
  return out;
}

function bucketKey(iso) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function round2(n) {
  return Math.round(n * 10) / 10;
}

// status: how to render the SLA's current state.
//   'ok'       — current >= target
//   'at_risk'  — within 5 points of target (under)
//   'breach'   — > 5 points under target
//   'pending'  — no data yet
export function statusFor(current, target) {
  if (current == null) return 'pending';
  if (current >= target) return 'ok';
  if (target - current <= 5) return 'at_risk';
  return 'breach';
}

function topBreachContributors(breachRows, max = 3) {
  const counts = {};
  for (const r of breachRows) {
    const key = r.location_id || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([location_id, n]) => ({ location_id, count: n }));
}

// ────── rule-based recommendations ──────────────────────────────────
// These are pinned per-status guidance — keep them tactical, not
// philosophical. Phase S-2.5 swaps in Merlin-generated recs via the
// chat API; for v1 the rules cover the obvious moves.

function recommendResponseTime({ status, atRisk, breachesMtd, maxMinutes }) {
  if (status === 'ok' && atRisk === 0) {
    return [
      'On track. Current response time has headroom against the target.',
      'Consider tightening the target by 1–2 points if you want to bank the margin as a higher SLA.',
    ];
  }
  const recs = [];
  if (atRisk > 0) {
    recs.push(
      `${atRisk} request${atRisk === 1 ? '' : 's'} currently open past ${maxMinutes}m — page nearest crew member from Schedules.`,
    );
  }
  if (status === 'at_risk') {
    recs.push('Pull the next scheduled cleaning route forward; high-press-count rooms first.');
    recs.push('Audit dispatch latency — log the time between request_pressed and route_assignment to find the gap.');
  }
  if (status === 'breach') {
    recs.push(
      'Increase shift overlap during peak hours (12:00–14:00 + 17:00–19:00 typically) — current staffing is undersized for response window.',
    );
    recs.push(
      'Move from 3-pass scheduled cleaning to traffic-aware dispatch; saves 2 crew-hours per floor per day at typical occupancy.',
    );
  }
  if (breachesMtd >= 5) {
    recs.push(
      `${breachesMtd} breach${breachesMtd === 1 ? '' : 'es'} this month — escalate to Cleaning Services lead for staffing review.`,
    );
  }
  return recs;
}

function recommendCount({ status, atRisk, breachesMtd, types }) {
  if (status === 'ok' && atRisk === 0) {
    return [
      'No open stockout-class requests past 1 hour. Supply pipeline is healthy.',
      'Use the Supplies agent to keep this state — auto-reorder threshold currently configured.',
    ];
  }
  const recs = [];
  if (atRisk > 0) {
    recs.push(`${atRisk} supply request${atRisk === 1 ? '' : 's'} open longer than 1h. Dispatch a restock route now.`);
    recs.push('Most likely SKUs at risk: ' + (types?.join(' / ') || 'restroom consumables') + '. Bundle in one trip.');
  }
  if (breachesMtd >= 3) {
    recs.push(
      `${breachesMtd} stockout-class breaches this month — evaluate vendor SLAs and on-floor par stock levels.`,
    );
  }
  if (status === 'breach') {
    recs.push(
      'Auto-restock threshold may be set too low; lift par stock by 25% on the affected SKU + add a same-day emergency reorder rule.',
    );
  }
  return recs;
}

function recommendCompliance({ missedToday, totalBranches }) {
  if (missedToday === 0) {
    return [
      'Every branch in compliance today. Daily window cleared.',
      'Identify the most-consistent crews — replicate their pattern on weak-spot branches.',
    ];
  }
  const recs = [];
  recs.push(
    `${missedToday} branch${missedToday === 1 ? '' : 'es'} of ${totalBranches} did not start service in today's window.`,
  );
  if (missedToday >= Math.max(5, totalBranches * 0.05)) {
    recs.push(
      'Review crew assignments — repeated misses cluster on the same branches when staffing or routing is wrong.',
    );
    recs.push('Consider extending the service window by 30m or splitting into two shifts to absorb peak traffic.');
  }
  recs.push('Notify the Compliance agent to reach out to the responsible crew leads with branch-level breakdown.');
  return recs;
}

// ────── AI-generated recommendations hook ──────────────────────────
//
// Calls /api/sla-recommendations on demand to generate model-drafted,
// SLA-specific guidance. The Insights → SLAs page renders the result
// in a "Merlin's take" section that augments (not replaces) the
// rule-based recs below it. Rule-based stays visible immediately so
// the demo never has a blank moment while Haiku thinks.
//
// Cache key: sla.id + status + bucketed current% so re-expanding the
// same card doesn't re-call. Cache lives at module scope — a hard
// reload clears it; a re-render of the same card hits the cache.

const aiRecsCache = new Map();
function aiRecsCacheKey(sla, perf) {
  // Bucket current% to 5-pt increments so jitter doesn't bust cache.
  const bucket = perf?.current == null ? 'na' : String(Math.round(perf.current / 5) * 5);
  return `${sla.id}::${perf?.status || 'pending'}::${bucket}`;
}

// ────── useContractPerformance ──────────────────────────────────────
// Phase 1 of the contractor-side intelligence loop. Fetches the slice
// of the manager org's SLAs that map to a contract's service_kind,
// computed against signal scoped to the contract's location set.
//
// This is a server-side compute (RLS prevents the contractor's client
// from reading the manager org's device_events / device_requests / slas
// directly). The endpoint at /api/contracts/[id]/performance does the
// authorization check + cross-org compute.
//
// Caches per-contract — refreshes on contract.id flip + on a manual
// `refresh()` call. No realtime: the underlying signals are typically
// minutes-stale anyway, and a cheap fetch on contract-card mount + a
// refresh button is plenty for v1.
//
// Returns: { contract, manager_org, slas, domains, location_count,
//           window_days, loaded, error, refresh() }

export function useContractPerformance(contractId) {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!contractId) {
      setData(null);
      setLoaded(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    setError(null);
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('not authenticated');
        const apiBase =
          typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)
            ? 'https://merlin.adaptiv.systems'
            : '';
        const res = await fetch(`${apiBase}/api/contracts/${encodeURIComponent(contractId)}/performance`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`${res.status} ${txt.slice(0, 200)}`);
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || String(err));
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractId, tick]);

  return {
    contract: data?.contract || null,
    managerOrg: data?.manager_org || null,
    slas: data?.slas || [],
    domains: data?.domains || [],
    locationCount: data?.location_count ?? 0,
    windowDays: data?.window_days ?? 14,
    loaded,
    error,
    refresh: () => setTick((n) => n + 1),
  };
}

// ────── Contractor Hypervisor SLAs (building-scoped) ─────────────────
//
// The Hypervisor "SLAs" tab reads public.slas scoped to the VIEWER's org
// (useSlas / useSlaPerformance, organization_id = orgId). A contractor
// viewing a customer building has no SLA rows of its OWN — the live SLAs it
// is accountable for are authored by the building owner, with
// counterparty_org = the contractor. RLS (slas_read) lets the contractor
// READ those rows, but NOT the owner's source tables (device_requests /
// agent_*) the live % is computed from — those stay org-locked. So we reuse
// the existing /api/contracts/:id/performance bridge, which is already
// party-guarded, does the service-role cross-org compute, and (for replay
// manager orgs) synthesizes believable per-clause numbers anchored to the
// line's real servicing adherence.
//
// We resolve the contractor's active contracts that touch THIS building,
// fetch each one's clause performance, and merge them into the Hypervisor
// SLA picker's row shape. No per-floor contributors (the endpoint returns
// no room-level rollup), so the 3D viewer stays neutral on this tab — the
// list, targets, live %, and status pills are the win.
//
// Returns { rows, loaded } where rows are ready for the Hypervisor picker.
export function useContractorBuildingSlas(contractorOrgId, buildingId) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!contractorOrgId || !buildingId) {
      setRows([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        // Active contracts this contractor holds that touch THIS building —
        // exact id or dash-bounded descendant, same prefix shape as
        // useEventsForBuilding (contracts seed building-level ids like 'hq').
        const { data: cs } = await supabase
          .from('contracts')
          .select('id, contract_locations(location_id)')
          .eq('contractor_org_id', contractorOrgId)
          .eq('status', 'active');
        const onBuilding = (cs || []).filter((c) =>
          (c.contract_locations || []).some((cl) => {
            const loc = cl.location_id;
            return loc === buildingId || (typeof loc === 'string' && loc.startsWith(buildingId + '-'));
          }),
        );
        if (onBuilding.length === 0) {
          if (!cancelled) {
            setRows([]);
            setLoaded(true);
          }
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('not authenticated');
        const apiBase =
          typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)
            ? 'https://merlin.adaptiv.systems'
            : '';

        const lists = await Promise.all(
          onBuilding.map(async (c) => {
            try {
              const res = await fetch(`${apiBase}/api/contracts/${encodeURIComponent(c.id)}/performance`, {
                headers: { authorization: `Bearer ${token}` },
              });
              if (!res.ok) return [];
              const json = await res.json();
              return Array.isArray(json?.slas) ? json.slas : [];
            } catch (e) {
              captureException(e, { where: 'slas:contract-performance' });
              return [];
            }
          }),
        );

        // Merge across contracts, dedupe by clause id (each contract scopes
        // by contract_id so overlap is unexpected — the Set is just safety).
        const seen = new Set();
        const merged = [];
        for (const s of lists.flat()) {
          if (!s?.id || seen.has(s.id)) continue;
          seen.add(s.id);
          merged.push(contractClauseToSlaRow(s));
        }
        if (!cancelled) {
          setRows(merged);
          setLoaded(true);
        }
      } catch (e) {
        captureException(e, { where: 'useContractorBuildingSlas' });
        if (!cancelled) {
          setRows([]);
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractorOrgId, buildingId]);

  return { rows, loaded };
}

// Map a /performance clause → the Hypervisor SLA picker/detail row shape.
// Status vocab differs between the two systems: the endpoint emits
// ok | at_risk | breach (+ computable=false → "pending"), while the picker
// + 3D status ramp key on ok | at_risk | breaching | pending.
function contractClauseToSlaRow(s) {
  const status =
    s.computable === false
      ? 'pending'
      : s.status === 'breach'
        ? 'breaching'
        : s.status === 'ok' || s.status === 'at_risk'
          ? s.status
          : 'pending';
  return {
    sla: { id: s.id, name: s.name, domain: s.domain || 'other' },
    status,
    current: s.current ?? null,
    target: s.target ?? null,
    breachesMtd: s.breaches_mtd ?? null,
    contributors: [], // endpoint returns no per-floor rollup
    localBreaches: 0,
    openAsk: null,
  };
}

// ────── Contractor SLA alert threshold (mig 227) ────────────────────
// The adherence level at which Merlin alerts the contractor when a service
// line is FORECAST to dip below it, plus the desired lead time. One row per
// contractor org; falls back to a sensible default while loading / if unset.
export function useContractorThresholds(orgId) {
  const [row, setRow] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!orgId) {
      setRow(null);
      setLoaded(true);
      return;
    }
    let alive = true;
    setLoaded(false);
    (async () => {
      const { data } = await supabase
        .from('contractor_alert_thresholds')
        .select('threshold_pct, lead_days, enabled')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (!alive) return;
      setRow(data || null);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [orgId, tick]);

  return {
    thresholdPct: row?.threshold_pct ?? 90,
    leadDays: row?.lead_days ?? 3,
    enabled: row?.enabled ?? true,
    loaded,
    refresh: () => setTick((n) => n + 1),
  };
}

// Org-party-guarded write (mig 227 RPC). Contractor orgs only.
export async function setContractorThreshold({ thresholdPct, leadDays, enabled }) {
  const { error } = await supabase.rpc('set_contractor_alert_threshold', {
    p_threshold_pct: thresholdPct,
    p_lead_days: leadDays,
    p_enabled: enabled,
  });
  if (error) throw error;
}

// ────── SLA penalty ledger (mig 238) ────────────────────────────────
// The per-month avoided/incurred track record. RLS admits both the
// contractor (organization_id) and the FM (manager_org_id), so this hook
// works on either side. Pass `viewerKind: 'manager'` to read the rows
// where the active org is the client rather than the contractor.
export function useContractorPenaltyLedger(orgId, { viewerKind = 'contractor' } = {}) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!orgId) {
      setRows([]);
      setLoaded(true);
      return;
    }
    let alive = true;
    setLoaded(false);
    (async () => {
      const col = viewerKind === 'manager' ? 'manager_org_id' : 'organization_id';
      const { data } = await supabase
        .from('contract_penalty_ledger')
        .select(
          'id, organization_id, manager_org_id, contract_id, service_kind, period_month, adherence_pct, floor_pct, status, amount_avoided, amount_incurred, currency, streak',
        )
        .eq(col, orgId)
        .order('period_month', { ascending: false });
      if (!alive) return;
      setRows(data || []);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [orgId, viewerKind, tick]);

  return { rows, loaded, refresh: () => setTick((n) => n + 1) };
}

// FM-party-guarded write (mig 237 RPC). Only the contract's manager org may set
// penalty terms. Pass all-null fields to clear terms back to the default.
export async function setContractPenalty({ contractId, floorPct, ratePct, capPct, escalationPct } = {}) {
  const { error } = await supabase.rpc('set_contract_penalty', {
    p_contract_id: contractId,
    p_floor_pct: floorPct ?? null,
    p_rate_pct: ratePct ?? null,
    p_cap_pct: capPct ?? null,
    p_escalation_pct: escalationPct ?? null,
  });
  if (error) throw error;
}

// ────── Contract reports (Phase 3a — shareback) ─────────────────────
// A contractor freezes the live SLA performance into a contract_report
// row, optionally adds a narrative, and shares it with the FM. Both
// parties read the same row; only the contractor side writes.

// useContractReports — list reports for a contract. RLS admits both
// parties (manager + contractor) so this hook works on either side
// of the relationship, returning the same set of rows.
export function useContractReports(contractId) {
  const [reports, setReports] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    if (!contractId) {
      setReports([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    let channel = null;

    async function refresh() {
      const { data, error } = await supabase
        .from('contract_reports')
        .select('*')
        .eq('contract_id', contractId)
        .order('generated_at', { ascending: false });
      if (cancelled) return;
      if (error) captureException(error, { where: 'useContractReports' });
      setReports(error || !data ? [] : data);
      setLoaded(true);
    }
    refresh();

    channel = supabase
      .channel(`contract_reports_${contractId}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contract_reports', filter: `contract_id=eq.${contractId}` },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [contractId, instanceId]);

  return { reports, loaded };
}

// Contractor analytics (Phase 8.8): aggregates a contractor org's
// portfolio into a few headline metrics — lifetime revenue, win rate,
// avg decision time, biggest pilot impact this quarter. Pulled from
// proposals + reports + contracts in one go and computed entirely
// client-side; no new endpoint. Refreshes via realtime on the same
// tables the rest of the contractor surface listens to.
//
// Returns { loaded, contracts, proposals, reports, metrics }.
//   metrics: {
//     activeContracts, monthlyRunRate (total $/mo across active),
//     lifetimeRevenue ($ accumulated since each contract started),
//     winRate (decided proposals' accepted ratio, null if too few),
//     decisionDays (median decided_at - submitted_at, null if too few),
//     biggestImprovement (top SLA delta across last 90d pilots)
//   }
export function useContractorAnalytics(contractorOrgId) {
  const [contracts, setContracts] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [reports, setReports] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    if (!contractorOrgId) {
      setContracts([]);
      setProposals([]);
      setReports([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    let channels = [];

    async function refresh() {
      const [{ data: cs }, { data: ps }, { data: rs }] = await Promise.all([
        supabase
          .from('contracts')
          .select(
            'id, name, status, service_kind, start_date, end_date, monthly_value, currency, penalties, manager_org_id, manager_org:organizations!contracts_manager_org_id_fkey(id, name)',
          )
          .eq('contractor_org_id', contractorOrgId),
        supabase
          .from('contract_proposals')
          .select('id, contract_id, manager_org_id, status, monthly_value_delta, submitted_at, decided_at, decided_by')
          .eq('contractor_org_id', contractorOrgId),
        supabase
          .from('contract_reports')
          .select('id, contract_id, period, period_start, period_end, snapshot, generated_at')
          .eq('contractor_org_id', contractorOrgId)
          .gte('period_start', isoDaysAgo(120))
          .order('generated_at', { ascending: false }),
      ]);
      if (cancelled) return;
      setContracts(cs || []);
      setProposals(ps || []);
      setReports(rs || []);
      setLoaded(true);
    }
    refresh();

    // Realtime: refresh on any change to the three tables for this
    // contractor org. One channel each (different filter per table).
    channels = [
      supabase
        .channel(`contractor_analytics_c_${contractorOrgId}_${instanceId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'contracts', filter: `contractor_org_id=eq.${contractorOrgId}` },
          () => {
            if (!cancelled) refresh();
          },
        )
        .subscribe(),
      supabase
        .channel(`contractor_analytics_p_${contractorOrgId}_${instanceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'contract_proposals',
            filter: `contractor_org_id=eq.${contractorOrgId}`,
          },
          () => {
            if (!cancelled) refresh();
          },
        )
        .subscribe(),
      supabase
        .channel(`contractor_analytics_r_${contractorOrgId}_${instanceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'contract_reports',
            filter: `contractor_org_id=eq.${contractorOrgId}`,
          },
          () => {
            if (!cancelled) refresh();
          },
        )
        .subscribe(),
    ];

    return () => {
      cancelled = true;
      for (const ch of channels) supabase.removeChannel(ch);
    };
  }, [contractorOrgId, instanceId]);

  // Compute metrics from the three lists. Memo-safe via deps.
  const metrics = computeContractorMetrics(contracts, proposals, reports);
  return { loaded, contracts, proposals, reports, metrics };
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function computeContractorMetrics(contracts, proposals, reports) {
  const now = Date.now();
  const active = contracts.filter((c) => c.status === 'active');
  const monthlyRunRate = active.reduce((sum, c) => sum + (Number(c.monthly_value) || 0), 0);
  // Single-currency per tenant in practice — take the first active contract's
  // so money KPIs render in the contractor's currency (e.g. EUR), not USD.
  const currency = active.find((c) => c.currency)?.currency || 'USD';

  // Lifetime revenue: per-contract monthly_value * months_elapsed.
  // Acknowledged limitation — uses current monthly_value, doesn't
  // walk historical amendments backwards. Good enough for hero
  // metric; the auto-amendment trigger means current value already
  // reflects accepted proposals' impact.
  let lifetimeRevenue = 0;
  for (const c of active) {
    if (!c.start_date || !c.monthly_value) continue;
    const startMs = new Date(c.start_date).getTime();
    if (Number.isNaN(startMs)) continue;
    const endMs = c.end_date ? Math.min(now, new Date(c.end_date).getTime()) : now;
    const monthsElapsed = Math.max(0, (endMs - startMs) / (30 * 86_400_000));
    lifetimeRevenue += Number(c.monthly_value) * monthsElapsed;
  }

  // Win rate: among proposals that reached a terminal decision
  // (accepted, declined), what fraction accepted? Drafts /
  // submitted / countered / withdrawn excluded — they're
  // in-flight or never got a decision.
  const decided = proposals.filter((p) => p.status === 'accepted' || p.status === 'declined');
  const winRate = decided.length >= 3 ? decided.filter((p) => p.status === 'accepted').length / decided.length : null;

  // Decision time: median ms between submitted_at and decided_at
  // across decided proposals, expressed in days.
  const decisionDurations = decided
    .filter((p) => p.submitted_at && p.decided_at)
    .map((p) => new Date(p.decided_at).getTime() - new Date(p.submitted_at).getTime())
    .filter((ms) => ms >= 0)
    .sort((a, b) => a - b);
  const decisionDays =
    decisionDurations.length >= 3
      ? Math.round((decisionDurations[Math.floor(decisionDurations.length / 2)] / 86_400_000) * 10) / 10
      : null;

  // Biggest pilot improvement this quarter: across reports in last
  // 90 days, find the largest positive sla_impact.delta among
  // accepted_proposals + active_prior_pilots. Returns the pilot
  // name + sla name + delta, or null if nothing meaningful.
  let biggestImprovement = null;
  const cutoffMs = now - 90 * 86_400_000;
  for (const r of reports) {
    if (!r.snapshot) continue;
    const ts = new Date(r.generated_at || r.period_end || 0).getTime();
    if (Number.isNaN(ts) || ts < cutoffMs) continue;
    const buckets = [
      ...(Array.isArray(r.snapshot.accepted_proposals) ? r.snapshot.accepted_proposals : []),
      ...(Array.isArray(r.snapshot.active_prior_pilots) ? r.snapshot.active_prior_pilots : []),
    ];
    for (const pilot of buckets) {
      const items = pilot?.sla_impact?.items;
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        if (typeof it.delta !== 'number') continue;
        if (!biggestImprovement || it.delta > biggestImprovement.delta) {
          biggestImprovement = {
            delta: it.delta,
            sla_name: it.sla_name,
            pilot_title: pilot.title,
            vendor_name: pilot.vendor?.name || null,
            decided_at: pilot.decided_at,
          };
        }
      }
    }
  }
  // Only surface when materially positive.
  if (biggestImprovement && biggestImprovement.delta < 1) biggestImprovement = null;

  return {
    activeContracts: active.length,
    monthlyRunRate,
    currency,
    lifetimeRevenue,
    winRate,
    decisionDays,
    biggestImprovement,
    proposalsTotal: proposals.length,
    proposalsAccepted: proposals.filter((p) => p.status === 'accepted').length,
    proposalsPending: proposals.filter((p) => p.status === 'submitted' || p.status === 'countered').length,
  };
}

// Manager-side scorecard (Phase 8.12): symmetric to useContractorAnalytics
// (8.8) but for the FM side. Aggregates every contract / proposal /
// report under this manager_org by contractor_org_id, so an FM with
// multiple contractors (Lily at Meridian has 4) gets a side-by-side
// comparison: who's delivering value, who's pitching the most, who
// decides fastest, etc.
//
// Computed entirely client-side from realtime-subscribed reads. No
// new endpoint, no new tables — every metric is derivable from data
// the FM already has read access to via existing RLS.
//
// Returns { loaded, contracts, proposals, reports, rows, totals }.
//   rows: per-contractor aggregate, sorted by monthly_value desc.
//     Each row carries:
//       contractor_org_id, contractor_name, contractor_slug,
//       activeContracts, totalContracts, monthlyValue,
//       proposalsTotal, proposalsAccepted, proposalsDeclined,
//       proposalsPending, decisionDaysMedian (null if <3 decided
//       in this contractor's history),
//       reportsCount, lastReportAt,
//       biggestImprovement: { delta, sla_name, pilot_title,
//         vendor_name, decided_at } | null (last 90d),
//       cumulativeSlaDelta (sum of all positive pilot deltas in the
//         last 90d — "value delivered" proxy).
//   totals: portfolio-level rollup for the hero strip.
export function useManagerScorecard(managerOrgId) {
  const [contracts, setContracts] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [reports, setReports] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    if (!managerOrgId) {
      setContracts([]);
      setProposals([]);
      setReports([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    let channels = [];

    async function refresh() {
      const [{ data: cs }, { data: ps }, { data: rs }] = await Promise.all([
        supabase
          .from('contracts')
          .select(
            'id, name, status, start_date, end_date, monthly_value, currency, contractor_org_id, contractor_org:organizations!contracts_contractor_org_id_fkey(id, name, slug)',
          )
          .eq('manager_org_id', managerOrgId),
        supabase
          .from('contract_proposals')
          .select(
            'id, contract_id, contractor_org_id, status, monthly_value_delta, submitted_at, decided_at, decided_by',
          )
          .eq('manager_org_id', managerOrgId),
        supabase
          .from('contract_reports')
          .select(
            'id, contract_id, contractor_org_id, period, period_start, period_end, snapshot, status, sent_at, generated_at',
          )
          .eq('manager_org_id', managerOrgId)
          .gte('period_start', isoDaysAgo(120))
          .order('generated_at', { ascending: false }),
      ]);
      if (cancelled) return;
      setContracts(cs || []);
      setProposals(ps || []);
      setReports(rs || []);
      setLoaded(true);
    }
    refresh();

    // Three realtime channels, one per table, all filtered by manager_org_id.
    // Channel topic suffix uses instanceId (useId()) to keep parallel mounts
    // from colliding on supabase's per-topic dedup — bit us before.
    channels = [
      supabase
        .channel(`manager_scorecard_c_${managerOrgId}_${instanceId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'contracts', filter: `manager_org_id=eq.${managerOrgId}` },
          () => {
            if (!cancelled) refresh();
          },
        )
        .subscribe(),
      supabase
        .channel(`manager_scorecard_p_${managerOrgId}_${instanceId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'contract_proposals', filter: `manager_org_id=eq.${managerOrgId}` },
          () => {
            if (!cancelled) refresh();
          },
        )
        .subscribe(),
      supabase
        .channel(`manager_scorecard_r_${managerOrgId}_${instanceId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'contract_reports', filter: `manager_org_id=eq.${managerOrgId}` },
          () => {
            if (!cancelled) refresh();
          },
        )
        .subscribe(),
    ];

    return () => {
      cancelled = true;
      for (const ch of channels) supabase.removeChannel(ch);
    };
  }, [managerOrgId, instanceId]);

  const { rows, totals } = computeManagerScorecard(contracts, proposals, reports);
  return { loaded, contracts, proposals, reports, rows, totals };
}

function computeManagerScorecard(contracts, proposals, reports) {
  const now = Date.now();
  const cutoffMs = now - 90 * 86_400_000;

  // Bucket by contractor_org_id. Some contracts may carry no contractor
  // (drafts) — skip those rather than rendering a "(none)" row.
  const byContractor = new Map();
  function bucket(id, name, slug) {
    if (!byContractor.has(id)) {
      byContractor.set(id, {
        contractor_org_id: id,
        contractor_name: name || 'Contractor',
        contractor_slug: slug || null,
        activeContracts: 0,
        totalContracts: 0,
        monthlyValue: 0,
        // Primary contract for drilling into the contract drawer when the
        // row is clicked. Picked as the highest-monthly-value active
        // contract; falls back to any contract if none active.
        primaryContractId: null,
        primaryContractValue: -1,
        proposalsTotal: 0,
        proposalsAccepted: 0,
        proposalsDeclined: 0,
        proposalsPending: 0,
        decisionDurationsMs: [],
        reportsCount: 0,
        lastReportAt: null,
        biggestImprovement: null,
        cumulativeSlaDelta: 0,
        // PR #227 polish: per-report deltas keyed by ISO date so we can
        // emit a sparkline; top SLA wins so we can show a hover popover.
        // reportSlaDeltas: [{ts, slaDelta}] sorted asc, used to build the
        // running-cumulative timeseries in the finalize pass.
        reportSlaDeltas: [],
        topImprovements: [], // top 3 by delta (filled in finalize)
        allImprovements: [], // working set; truncated in finalize
      });
    }
    return byContractor.get(id);
  }

  for (const c of contracts) {
    if (!c.contractor_org_id) continue;
    const row = bucket(c.contractor_org_id, c.contractor_org?.name, c.contractor_org?.slug);
    row.totalContracts += 1;
    const mv = Number(c.monthly_value) || 0;
    if (c.status === 'active') {
      row.activeContracts += 1;
      row.monthlyValue += mv;
    }
    // Prefer active contracts when picking the primary; within active,
    // the highest monthly value wins. Non-active contracts fill in only
    // if no active candidate has been seen yet.
    const score = (c.status === 'active' ? 1_000_000_000 : 0) + mv;
    if (score > row.primaryContractValue) {
      row.primaryContractValue = score;
      row.primaryContractId = c.id;
    }
  }

  for (const p of proposals) {
    if (!p.contractor_org_id) continue;
    const row = bucket(p.contractor_org_id);
    row.proposalsTotal += 1;
    if (p.status === 'accepted') row.proposalsAccepted += 1;
    else if (p.status === 'declined') row.proposalsDeclined += 1;
    else if (p.status === 'submitted' || p.status === 'countered') row.proposalsPending += 1;
    if ((p.status === 'accepted' || p.status === 'declined') && p.submitted_at && p.decided_at) {
      const ms = new Date(p.decided_at).getTime() - new Date(p.submitted_at).getTime();
      if (ms >= 0) row.decisionDurationsMs.push(ms);
    }
  }

  for (const r of reports) {
    if (!r.contractor_org_id) continue;
    const row = bucket(r.contractor_org_id);
    row.reportsCount += 1;
    const ts = r.sent_at || r.generated_at;
    if (ts && (!row.lastReportAt || ts > row.lastReportAt)) row.lastReportAt = ts;
    // Mine snapshot for pilot SLA deltas in the last 90d window.
    const reportTs = new Date(r.generated_at || r.period_end || 0).getTime();
    if (Number.isNaN(reportTs) || reportTs < cutoffMs) continue;
    if (!r.snapshot) continue;
    const buckets = [
      ...(Array.isArray(r.snapshot.accepted_proposals) ? r.snapshot.accepted_proposals : []),
      ...(Array.isArray(r.snapshot.active_prior_pilots) ? r.snapshot.active_prior_pilots : []),
    ];
    // Per-report positive-delta sum, used to build the sparkline.
    let reportPositiveDelta = 0;
    for (const pilot of buckets) {
      const items = pilot?.sla_impact?.items;
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        if (typeof it.delta !== 'number') continue;
        if (it.delta > 0) {
          row.cumulativeSlaDelta += it.delta;
          reportPositiveDelta += it.delta;
        }
        if (!row.biggestImprovement || it.delta > row.biggestImprovement.delta) {
          row.biggestImprovement = {
            delta: it.delta,
            sla_name: it.sla_name,
            pilot_title: pilot.title,
            vendor_name: pilot.vendor?.name || null,
            decided_at: pilot.decided_at,
          };
        }
        // Stash every meaningful improvement so we can pick the top 3
        // for the hover popover in finalize.
        if (it.delta >= 1) {
          row.allImprovements.push({
            delta: it.delta,
            sla_name: it.sla_name,
            pilot_title: pilot.title,
            vendor_name: pilot.vendor?.name || null,
          });
        }
      }
    }
    if (reportPositiveDelta > 0) {
      row.reportSlaDeltas.push({ ts: reportTs, delta: reportPositiveDelta });
    }
  }

  // Finalize: median decision time, sparkline timeseries, top improvements.
  for (const row of byContractor.values()) {
    const sorted = row.decisionDurationsMs.sort((a, b) => a - b);
    row.decisionDaysMedian =
      sorted.length >= 3 ? Math.round((sorted[Math.floor(sorted.length / 2)] / 86_400_000) * 10) / 10 : null;
    delete row.decisionDurationsMs;
    delete row.primaryContractValue;
    if (row.biggestImprovement && row.biggestImprovement.delta < 1) row.biggestImprovement = null;

    // Sparkline timeseries: cumulative positive SLA delta over time
    // across the contractor's last 90d of reports. Sorted asc by ts;
    // each point is the running total at that report's timestamp.
    // <Sparkline /> in primitives expects an array of {v} or numbers.
    const series = row.reportSlaDeltas.sort((a, b) => a.ts - b.ts);
    let running = 0;
    row.slaDeltaTimeseries = series.map((p) => {
      running += p.delta;
      return { v: running, ts: p.ts };
    });
    delete row.reportSlaDeltas;

    // Top 3 SLA improvements (dedupe by sla_name + pilot_title — same
    // pilot may surface in successive monthly reports under
    // active_prior_pilots so we don't want to triple-count it).
    const seen = new Set();
    const unique = [];
    for (const imp of row.allImprovements.sort((a, b) => b.delta - a.delta)) {
      const k = `${imp.sla_name}::${imp.pilot_title}`;
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(imp);
      if (unique.length >= 3) break;
    }
    row.topImprovements = unique;
    delete row.allImprovements;
  }

  const rows = [...byContractor.values()].sort((a, b) => {
    // Active contractors before dormant; within tier, by monthly value desc.
    if (b.activeContracts > 0 !== a.activeContracts > 0) {
      return (b.activeContracts > 0 ? 1 : 0) - (a.activeContracts > 0 ? 1 : 0);
    }
    return b.monthlyValue - a.monthlyValue;
  });

  const totals = {
    contractorCount: rows.length,
    activeContractors: rows.filter((r) => r.activeContracts > 0).length,
    totalMonthly: rows.reduce((sum, r) => sum + r.monthlyValue, 0),
    pilotsAccepted: rows.reduce((sum, r) => sum + r.proposalsAccepted, 0),
    pilotsPending: rows.reduce((sum, r) => sum + r.proposalsPending, 0),
    cumulativeSlaDelta: rows.reduce((sum, r) => sum + r.cumulativeSlaDelta, 0),
  };

  return { rows, totals };
}

// Manager-side reports inbox (Phase 8.3): every contract_report where
// the caller's org is the manager_org_id, across every contract it
// manages. Counterpart to useManagerProposalsInbox; same realtime +
// embed-relations shape so the two surfaces feel identical.
export function useManagerReportsInbox(managerOrgId) {
  const [reports, setReports] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    if (!managerOrgId) {
      setReports([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    let channel = null;

    async function refresh() {
      const { data, error } = await supabase
        .from('contract_reports')
        .select(
          `
          id, contract_id, manager_org_id, contractor_org_id,
          period, period_start, period_end,
          snapshot, contractor_note,
          status, sent_at, generated_at, updated_at,
          contract:contracts!contract_reports_contract_id_fkey(
            id, name, service_kind, currency, monthly_value, status
          ),
          contractor_org:organizations!contract_reports_contractor_org_id_fkey(
            id, name, slug
          )
        `,
        )
        .eq('manager_org_id', managerOrgId)
        .order('generated_at', { ascending: false });
      if (cancelled) return;
      if (error) captureException(error, { where: 'useManagerReportsInbox' });
      if (error || !data) {
        setReports([]);
        setLoaded(true);
        return;
      }
      // Status priority: sent (deliverable) first, then drafts, then archived.
      const STATUS_PRIORITY = { sent: 0, draft: 1, archived: 2 };
      const sorted = [...data].sort((a, b) => {
        const pa = STATUS_PRIORITY[a.status] ?? 9;
        const pb = STATUS_PRIORITY[b.status] ?? 9;
        if (pa !== pb) return pa - pb;
        return (b.generated_at || '').localeCompare(a.generated_at || '');
      });
      setReports(sorted);
      setLoaded(true);
    }
    refresh();

    channel = supabase
      .channel(`manager_reports_${managerOrgId}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contract_reports', filter: `manager_org_id=eq.${managerOrgId}` },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [managerOrgId, instanceId]);

  return { reports, loaded };
}

// generateContractReport — POST to /api/contracts/:id/reports/generate.
// Returns the inserted row (or throws). Caller is the contractor on the
// contract; the endpoint enforces this.
export async function generateContractReport(
  contractId,
  { period = 'monthly', period_start, period_end, contractor_note } = {},
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('not authenticated');
  const apiBase =
    typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)
      ? 'https://merlin.adaptiv.systems'
      : '';
  const res = await fetch(`${apiBase}/api/contracts/${encodeURIComponent(contractId)}/reports/generate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ period, period_start, period_end, contractor_note }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.report;
}

// fetchContractSignals — GET /api/contracts/:id/signals. Returns a small
// service-line-scoped summary of recent device/agent signals at the
// contract's locations (aggregated server-side; the contractor can't scan
// tenant events broadly without hitting the RLS timeout). Shape:
// { contract_id, service_line, window_days, signals: [{key,label,count,high,unresolved,tone,latest,locationHint}] }
export async function fetchContractSignals(contractId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('not authenticated');
  const apiBase =
    typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)
      ? 'https://merlin.adaptiv.systems'
      : '';
  const res = await fetch(`${apiBase}/api/contracts/${encodeURIComponent(contractId)}/signals`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${txt.slice(0, 200)}`);
  }
  return res.json();
}

// narrateContractReport — POST to /api/contracts/:id/reports/narrate.
// Phase 8.2: asks Haiku to draft the contractor_note from the frozen
// snapshot. Returns the suggested narrative string; the caller decides
// what to do with it (we drop it into the textarea, contractor edits,
// then saves via updateContractReport). Endpoint does NOT persist —
// the round-trip is intentionally separate from save so the contractor
// can re-roll without losing what they had.
export async function narrateContractReport(contractId, reportId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('not authenticated');
  const apiBase =
    typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)
      ? 'https://merlin.adaptiv.systems'
      : '';
  const res = await fetch(`${apiBase}/api/contracts/${encodeURIComponent(contractId)}/reports/narrate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ report_id: reportId }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.narrative || '';
}

// draftContractRenewal — POST to /api/contracts/:id/renewal/draft.
// Phase 8.10: asks Haiku to pre-fill a renewal proposal from the
// contract's accepted-pilots history + recent SLA-impact reports.
// Returns { title, body, monthly_value_delta, currency,
// expected_outcome }; the caller uses these to seed the proposal
// composer. Endpoint does NOT persist.
export async function draftContractRenewal(contractId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('not authenticated');
  const apiBase =
    typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)
      ? 'https://merlin.adaptiv.systems'
      : '';
  const res = await fetch(`${apiBase}/api/contracts/${encodeURIComponent(contractId)}/renewal/draft`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${txt.slice(0, 200)}`);
  }
  return res.json();
}

// updateContractReport — direct Supabase write. RLS admits the
// contractor. Used to edit contractor_note inline or flip status to
// 'sent' / 'archived'.
export async function updateContractReport(reportId, patch) {
  const { data, error } = await supabase.from('contract_reports').update(patch).eq('id', reportId).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

// ────── Contract proposals (Phase 3b — innovation upsells) ──────────
// Where contract_reports (Phase 3a) is "here's how I performed",
// contract_proposals is "here's what I think we should change."
// State machine: drafted → submitted → {accepted | declined |
// countered → submitted | …} | withdrawn.
//
// RLS admits both parties for reads + updates; the column-mask trigger
// in migration 083 (tg_contract_proposals_field_guard) enforces who can
// change what (contractor edits body/title/etc., FM sets decision_note
// + counter_*). Status transitions are also gated server-side.

export function useContractProposals(contractId) {
  const [proposals, setProposals] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    if (!contractId) {
      setProposals([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    let channel = null;

    async function refresh() {
      const { data, error } = await supabase
        .from('contract_proposals')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) captureException(error, { where: 'useContractProposals' });
      setProposals(error || !data ? [] : data);
      setLoaded(true);
    }
    refresh();

    channel = supabase
      .channel(`contract_proposals_${contractId}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contract_proposals', filter: `contract_id=eq.${contractId}` },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [contractId, instanceId]);

  return { proposals, loaded };
}

// createContractProposal — direct supabase insert. Caller must be the
// contractor on the contract (RLS + the contractor_ins policy enforce).
// `contract` is the row from /api/contracts/:id/performance or the
// dashboard list — we read manager_org_id + contractor_org_id off it.
export async function createContractProposal(contract, draft) {
  const row = {
    contract_id: contract.id,
    manager_org_id: contract.manager_org_id ?? contract.manager_org?.id,
    contractor_org_id: contract.contractor_org_id ?? contract.contractor_org?.id,
    title: draft.title || '(Untitled proposal)',
    body: draft.body || '',
    category: draft.category || 'other',
    expected_outcome: draft.expected_outcome || null,
    monthly_value_delta: draft.monthly_value_delta ?? null,
    currency: draft.currency || contract.currency || null,
    vendor_id: draft.vendor_id || null,
    status: draft.status || 'drafted',
  };
  const { data, error } = await supabase.from('contract_proposals').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

// updateContractProposal — direct supabase update. The column-mask
// trigger reverts disallowed changes (contractor can't set
// decision_note; FM can't rewrite body) so callers don't need to
// branch on caller-org client-side.
export async function updateContractProposal(proposalId, patch) {
  const { data, error } = await supabase
    .from('contract_proposals')
    .update(patch)
    .eq('id', proposalId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteContractProposal(proposalId) {
  const { error } = await supabase.from('contract_proposals').delete().eq('id', proposalId);
  if (error) throw new Error(error.message);
}

// Manager-side inbox: every proposal across every contract where the
// caller's org is the manager. Embeds contract + contractor + vendor
// inline so the row can render decision context without N+1 fetches.
// Sorted server-side by status priority (pending decisions first) +
// created_at desc.
export function useManagerProposalsInbox(managerOrgId) {
  const [proposals, setProposals] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    if (!managerOrgId) {
      setProposals([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    let channel = null;

    async function refresh() {
      const { data, error } = await supabase
        .from('contract_proposals')
        .select(
          `
          id, contract_id, manager_org_id, contractor_org_id,
          title, body, category, expected_outcome,
          monthly_value_delta, currency,
          status, decision_note, counter_value, counter_note,
          submitted_at, decided_at, decided_by,
          created_at, updated_at,
          vendor_id,
          vendor:marketplace_vendors!contract_proposals_vendor_id_fkey(
            id, name, tagline, category_id, region
          ),
          contract:contracts!contract_proposals_contract_id_fkey(
            id, name, service_kind, currency, monthly_value, status
          ),
          contractor_org:organizations!contract_proposals_contractor_org_id_fkey(
            id, name, slug
          )
        `,
        )
        .eq('manager_org_id', managerOrgId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) captureException(error, { where: 'useManagerProposalsInbox' });
      if (error || !data) {
        setProposals([]);
        setLoaded(true);
        return;
      }
      // Re-sort client-side: status priority then created_at desc.
      const STATUS_PRIORITY = {
        submitted: 0,
        countered: 1,
        drafted: 2,
        accepted: 3,
        declined: 4,
        withdrawn: 5,
      };
      const sorted = [...data].sort((a, b) => {
        const pa = STATUS_PRIORITY[a.status] ?? 9;
        const pb = STATUS_PRIORITY[b.status] ?? 9;
        if (pa !== pb) return pa - pb;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
      setProposals(sorted);
      setLoaded(true);
    }
    refresh();

    channel = supabase
      .channel(`manager_inbox_${managerOrgId}_${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contract_proposals', filter: `manager_org_id=eq.${managerOrgId}` },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [managerOrgId, instanceId]);

  return { proposals, loaded };
}

// ────── useContractorRecommendations ────────────────────────────────
// Phase 2 of the contractor-side intelligence loop. Calls Haiku via
// /api/contractor-recommendations to draft 3 categories of guidance
// for the contractor manager:
//
//   operational  — things the contractor can do right now
//   strategic    — proposals to take to the facility manager
//   risk_alerts  — forward-looking risks
//
// Lazy: the caller passes `enabled=true` only when the user has
// expanded the "Merlin's take" panel on a contract card. Cached per
// contract.id + perf snapshot — toggling the panel doesn't re-fire.

const contractorRecsCache = new Map();
function contractorRecsCacheKey(contractId, perfSnapshot) {
  // Snapshot is "id:status:current%" joined per SLA, so the cache
  // bucket flips every time the underlying perf changes meaningfully
  // but stays stable across re-mounts within the same perf state.
  const sig = (perfSnapshot || [])
    .map((s) => `${s.id}:${s.status}:${s.current ?? 'null'}`)
    .sort()
    .join('|');
  return `${contractId}::${sig}`;
}

export function useContractorRecommendations(contractId, perfSnapshot, enabled) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !contractId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const key = contractorRecsCacheKey(contractId, perfSnapshot);
    if (contractorRecsCache.has(key)) {
      setData(contractorRecsCache.get(key));
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('not authenticated');
        const apiBase =
          typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)
            ? 'https://merlin.adaptiv.systems'
            : '';
        const res = await fetch(`${apiBase}/api/contractor-recommendations`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ contract_id: contractId }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`${res.status} ${txt.slice(0, 200)}`);
        }
        const json = await res.json();
        // strategic items are objects { text, vendor_id } as of Phase 5;
        // older cached responses (or test fallbacks) may be plain
        // strings — normalize to the object shape so consumers don't
        // need to branch.
        const normalizeStrategic = (arr) =>
          (Array.isArray(arr) ? arr : [])
            .map((item) => {
              if (typeof item === 'string') return { text: item, vendor_id: null };
              if (item && typeof item === 'object' && typeof item.text === 'string') {
                return { text: item.text, vendor_id: item.vendor_id || null };
              }
              return null;
            })
            .filter(Boolean);
        const result = {
          operational: Array.isArray(json.operational) ? json.operational : [],
          strategic: normalizeStrategic(json.strategic),
          risk_alerts: Array.isArray(json.risk_alerts) ? json.risk_alerts : [],
          slaCount: json.sla_count ?? 0,
          vendorCount: json.vendor_count ?? 0,
          model: json.model || null,
          latencyMs: json.latencyMs ?? null,
        };
        contractorRecsCache.set(key, result);
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || String(err));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, contractId, contractorRecsCacheKey(contractId, perfSnapshot)]);

  return { data, loading, error };
}

export function useAiSlaRecommendations(sla, perf, enabled) {
  const [recs, setRecs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !sla || !perf) {
      setRecs(null);
      setLoading(false);
      setError(null);
      return;
    }
    const key = aiRecsCacheKey(sla, perf);
    if (aiRecsCache.has(key)) {
      setRecs(aiRecsCache.get(key));
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('not authenticated');
        // Vite doesn't serve /api/* in dev — prefix with the deployed
        // origin so the localhost preview still hits the Vercel function.
        const apiBase =
          typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(location.hostname)
            ? 'https://merlin.adaptiv.systems'
            : '';
        const res = await fetch(`${apiBase}/api/sla-recommendations`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ sla, perf, owner: sla.owner_label || null }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`${res.status} ${txt.slice(0, 120)}`);
        }
        const json = await res.json();
        const list = Array.isArray(json.recommendations) ? json.recommendations : [];
        aiRecsCache.set(key, list);
        if (!cancelled) {
          setRecs(list);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || String(err));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, sla?.id, perf?.status, perf?.current, perf?.at_risk]);

  return { recs, loading, error };
}
