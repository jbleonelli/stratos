// Platform cost telemetry — reads claude_usage_daily (rollup view over
// claude_usage_events) plus a small recent-rows window from the raw
// table. Both are RLS-gated to platform admins, so no extra auth
// plumbing is needed beyond mounting the page inside /platform.
//
// One hook returns everything the cost dashboard needs. The window is
// configurable (default 30 days) so future tabs can ask for 90d / 365d
// without forking the data layer.

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';

const RECENT_LIMIT = 100;

function emptyRollup() {
  return {
    days: [], // [{ day: '2026-05-10', cost: 1.23, calls: 200 }] — chronological
    byOrg: [], // [{ orgId, orgName, cost, calls }]
    byFeature: [], // [{ feature, cost, calls }]
    byModel: [], // [{ model, cost, calls }]
    totalCost: 0,
    totalCalls: 0,
    todayCost: 0,
    yesterdayCost: 0,
    recent: [], // [{ id, createdAt, feature, model, costUsd, inputTokens, outputTokens, orgName, latencyMs }]
  };
}

function dayKey(d) {
  // YYYY-MM-DD in UTC — matches the view's bucketing.
  return d.toISOString().slice(0, 10);
}

function buildSeries(rows, lookbackDays) {
  // Pre-fill every day in the window so the chart renders flat zeros
  // rather than skipping missing days.
  const series = new Map();
  const now = new Date();
  for (let i = lookbackDays - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    series.set(dayKey(d), { day: dayKey(d), cost: 0, calls: 0 });
  }
  for (const r of rows) {
    const key = String(r.day).slice(0, 10);
    const slot = series.get(key);
    if (slot) {
      slot.cost += Number(r.cost_usd) || 0;
      slot.calls += Number(r.call_count) || 0;
    }
  }
  return Array.from(series.values());
}

function rollupBy(rows, key, label) {
  const map = new Map();
  for (const r of rows) {
    const k = r[key] || '(none)';
    if (!map.has(k)) map.set(k, { [label]: k, cost: 0, calls: 0 });
    const slot = map.get(k);
    slot.cost += Number(r.cost_usd) || 0;
    slot.calls += Number(r.call_count) || 0;
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

export function useCostsRollup({ days = 30 } = {}) {
  const [rollup, setRollup] = useState(() => emptyRollup());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const since = new Date(Date.now() - days * 86_400_000);
    (async () => {
      try {
        // Daily view → cheap aggregation surface.
        const { data: dailyRows, error: dailyErr } = await supabase
          .from('claude_usage_daily')
          .select('day, organization_id, feature, model, call_count, cost_usd')
          .gte('day', since.toISOString().slice(0, 10));
        if (dailyErr) throw dailyErr;

        // Resolve org names so the UI doesn't show raw uuids. Only IDs
        // present in the dataset — pulls a small list.
        const orgIds = Array.from(new Set((dailyRows || []).map((r) => r.organization_id).filter(Boolean)));
        const nameById = new Map();
        if (orgIds.length > 0) {
          const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', orgIds);
          for (const o of orgs || []) nameById.set(o.id, o.name);
        }

        const days_ = buildSeries(dailyRows || [], days);
        const todayKey = dayKey(new Date());
        const yesterdayKey = dayKey(new Date(Date.now() - 86_400_000));
        const todayCost = days_.find((d) => d.day === todayKey)?.cost || 0;
        const yesterdayCost = days_.find((d) => d.day === yesterdayKey)?.cost || 0;

        // org rollup carries the resolved name for display.
        const byOrgRaw = rollupBy(dailyRows || [], 'organization_id', 'orgId');
        const byOrg = byOrgRaw.map((r) => ({
          orgId: r.orgId === '(none)' ? null : r.orgId,
          orgName: r.orgId === '(none)' ? '(unattributed)' : nameById.get(r.orgId) || r.orgId.slice(0, 8) + '…',
          cost: r.cost,
          calls: r.calls,
        }));

        const byFeature = rollupBy(dailyRows || [], 'feature', 'feature');
        const byModel = rollupBy(dailyRows || [], 'model', 'model');
        const totalCost = (dailyRows || []).reduce((acc, r) => acc + (Number(r.cost_usd) || 0), 0);
        const totalCalls = (dailyRows || []).reduce((acc, r) => acc + (Number(r.call_count) || 0), 0);

        // Recent calls — small live tail for debugging.
        const { data: recentRows } = await supabase
          .from('claude_usage_events')
          .select('id, created_at, organization_id, feature, model, cost_usd, input_tokens, output_tokens, latency_ms')
          .order('created_at', { ascending: false })
          .limit(RECENT_LIMIT);
        const recent = (recentRows || []).map((r) => ({
          id: r.id,
          createdAt: r.created_at,
          feature: r.feature,
          model: r.model,
          costUsd: Number(r.cost_usd) || 0,
          inputTokens: r.input_tokens || 0,
          outputTokens: r.output_tokens || 0,
          latencyMs: r.latency_ms,
          orgId: r.organization_id,
          orgName: r.organization_id
            ? nameById.get(r.organization_id) || r.organization_id.slice(0, 8) + '…'
            : '(unattributed)',
        }));

        if (!alive) return;
        setRollup({
          days: days_,
          byOrg,
          byFeature,
          byModel,
          totalCost,
          totalCalls,
          todayCost,
          yesterdayCost,
          recent,
        });
        setReady(true);
        setError(null);
      } catch (err) {
        if (!alive) return;
        captureException(err, { where: 'useCostsRollup' });
        // eslint-disable-next-line no-console
        console.warn('[costs-data] fetch failed:', err.message);
        setError(err.message);
        setRollup(emptyRollup());
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [days]);

  return { ...rollup, ready, error };
}
