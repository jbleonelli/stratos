// ContractorSlaTracker — MONITOR → SLAs (contractor, follow-focused).
//
// A read/track view of every SLA this contractor is accountable for, across
// all of its customers: live adherence vs target, status (on-target / at-risk
// / breaching / pending), a trend sparkline, and a one-tap "Ask Merlin" drill.
// MANAGEMENT (propose / amend / accept) deliberately stays in OPERATE →
// Contracts → SLAs (ContractorSlas.jsx) — this surface never writes.
//
// Data: the contractor's client owns the SLA rows + the source signals (both
// org-locked by RLS), so live % can't be read directly. We reuse the existing
// /api/contracts/:id/performance bridge (party-guarded, service-role compute,
// and for replay manager orgs it synthesizes believable per-clause numbers
// anchored to the line's real servicing adherence) — fanning it across every
// active contract and merging the clauses. No per-clause trend comes back, so
// we synthesize a deterministic one (same approach as the Scorecard/bubbles).

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from './icons.jsx';
import { Card, Sparkline, AdaptivLoader } from './primitives.jsx';
import { useSession } from './auth.js';
import { useSL } from './servicing-i18n.js';
import { supabase } from './supabase.js';
import { synthTrend } from './servicing-data.js';
import { statusFor, SLA_DOMAIN_TO_SERVICING_LINE } from './slas-data.js';
import { SERVICING_DOMAIN_META } from './servicing-areas.js';
import { SERVICE_LINE_ORDER } from './service-line.js';

// Status vocab — the endpoint emits ok | at_risk | breach (+ computable=false →
// pending). rank drives the urgency sort (breaching first).
const STATUS_META = {
  breach: { label: ['Breaching', 'Infraction'], color: 'var(--risk)', rank: 0 },
  at_risk: { label: ['At risk', 'À risque'], color: 'var(--warn)', rank: 1 },
  ok: { label: ['On target', 'Conforme'], color: 'var(--ok)', rank: 2 },
  pending: { label: ['Pending', 'En attente'], color: 'var(--text-faint)', rank: 3 },
};

function normStatus(s) {
  if (s.computable === false) return 'pending';
  if (s.status === 'breach') return 'breach';
  if (s.status === 'ok' || s.status === 'at_risk') return s.status;
  if (s.current != null && s.target != null) return statusFor(s.current, s.target);
  return 'pending';
}

// ────── useContractorSlaTracker ─────────────────────────────────────
// Every SLA clause the contractor is accountable for, across all active
// contracts, with its customer + live status. Cached per org; refresh()
// re-fetches.
function useContractorSlaTracker(orgId) {
  const q = useQuery({
    queryKey: ['contractor-sla-tracker', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      try {
        const { data: cs } = await supabase
          .from('contracts')
          .select(
            'id, name, service_kind, manager_org_id, manager_org:organizations!contracts_manager_org_id_fkey(id, name, slug)',
          )
          .eq('contractor_org_id', orgId)
          .eq('status', 'active');
        if (!cs || cs.length === 0) return [];

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
          (cs || []).map(async (c) => {
            try {
              const res = await fetch(`${apiBase}/api/contracts/${encodeURIComponent(c.id)}/performance`, {
                headers: { authorization: `Bearer ${token}` },
              });
              if (!res.ok) return [];
              const json = await res.json();
              const mgr = Array.isArray(json?.manager_org) ? json.manager_org[0] : json?.manager_org;
              const customer = mgr?.name || c.manager_org?.name || '—';
              return (Array.isArray(json?.slas) ? json.slas : []).map((s) => ({
                id: s.id,
                name: s.name,
                domain: s.domain || 'other',
                metricKind: s.metric_kind || null,
                current: s.current ?? null,
                target: s.target ?? null,
                breachesMtd: s.breaches_mtd ?? 0,
                sampleSize: s.sample_size ?? null,
                windowDays: json?.window_days ?? 14,
                ownerLabel: s.owner_label || null,
                computable: s.computable !== false,
                status: normStatus(s),
                customer,
                contractId: c.id,
                serviceKind: c.service_kind,
                trend: synthTrend(`slatrk:${s.id}`, s.current ?? 0),
              }));
            } catch {
              return [];
            }
          }),
        );

        const seen = new Set();
        const merged = [];
        for (const it of lists.flat()) {
          if (!it?.id || seen.has(it.id)) continue;
          seen.add(it.id);
          merged.push(it);
        }
        merged.sort(
          (a, b) =>
            (STATUS_META[a.status]?.rank ?? 3) - (STATUS_META[b.status]?.rank ?? 3) ||
            (a.current ?? 100) - (b.current ?? 100),
        );
        return merged;
      } catch {
        // Never throw — settle to an empty list (preserves the old behaviour
        // where any failure just renders the empty state).
        return [];
      }
    },
  });

  return { items: q.data ?? [], loaded: q.isSuccess, refresh: () => q.refetch() };
}

// The service line an SLA belongs to — drives BOTH the grouping and the row
// icon, so every row in a line shares that line's brand mark (no per-domain
// odd-one-out like 'supplies'). Resolve the line from the clause domain first
// (hygiene→cleaning, amenity→hospitality, safety→security, hvac/uptime→
// maintenance), then fall back to the contract's service_kind ('other' = the
// catch-all hospitality bucket), else 'other'.
const KNOWN_LINES = new Set(['cleaning', 'security', 'hospitality', 'maintenance']);
const LINE_NAME = {
  cleaning: ['Cleaning', 'Nettoyage'],
  security: ['Security', 'Sécurité'],
  hospitality: ['Hospitality', 'Hôtellerie'],
  maintenance: ['Maintenance', 'Maintenance'],
  other: ['Other', 'Autre'],
};
function serviceLineOf(item) {
  const d = String(item.domain || '').toLowerCase();
  const top = d.split('_')[0];
  const fromDomain =
    SLA_DOMAIN_TO_SERVICING_LINE[d] || SLA_DOMAIN_TO_SERVICING_LINE[top] || (SERVICING_DOMAIN_META[top] ? top : null);
  if (fromDomain) return fromDomain;
  const kind = String(item.serviceKind || '').toLowerCase();
  if (kind === 'other') return 'hospitality';
  return KNOWN_LINES.has(kind) ? kind : 'other';
}

// Brand icon + accent for a row, keyed on its service LINE (matches the group).
function lineVisual(item) {
  const meta = SERVICING_DOMAIN_META[serviceLineOf(item)];
  return { icon: meta?.icon || 'sla', color: meta?.color || 'var(--accent)' };
}

// Group divider — service line name + SLA count (no icon; the rows already
// carry the line icon, so repeating it in the header reads as noise).
function LineHeader({ line, count, first, sl }) {
  const name = LINE_NAME[line] || LINE_NAME.other;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 4px 8px',
        marginTop: first ? 0 : 6,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          color: 'var(--text-soft)',
        }}
      >
        {sl(name[0], name[1])}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)' }}>{count}</span>
    </div>
  );
}

// ────── Adherence bar — current fill + a target marker ──────────────
function AdherenceBar({ current, target, color }) {
  if (current == null) return <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-3)' }} />;
  const pct = Math.max(0, Math.min(100, current));
  const tgt = target == null ? null : Math.max(0, Math.min(100, target));
  return (
    <div
      style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--surface-3)', overflow: 'visible' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: `${pct}%`,
          borderRadius: 4,
          background: color,
          transition: 'width .3s',
        }}
      />
      {tgt != null && (
        <div
          title={`target ${tgt}%`}
          style={{
            position: 'absolute',
            left: `${tgt}%`,
            top: -2,
            bottom: -2,
            width: 2,
            background: 'var(--text-dim)',
            borderRadius: 1,
            transform: 'translateX(-1px)',
          }}
        />
      )}
    </div>
  );
}

function StatusPill({ status, sl }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        display: 'inline-block',
        minWidth: 84,
        textAlign: 'center',
        boxSizing: 'border-box',
        color: m.color,
        background: `color-mix(in oklch, ${m.color} 14%, transparent)`,
        border: `1px solid color-mix(in oklch, ${m.color} 32%, transparent)`,
      }}
    >
      {sl(m.label[0], m.label[1])}
    </span>
  );
}

// SLA metric type → readable label.
const METRIC_LABEL = {
  response_time: ['Response time', 'Temps de réponse'],
  count: ['Count / volume', 'Volume'],
  compliance: ['Compliance', 'Conformité'],
  threshold: ['Threshold', 'Seuil'],
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

function DetailField({ label, value, mono }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--text)',
          marginTop: 2,
          fontFamily: mono ? 'var(--mono)' : 'inherit',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DetailGroup({ title, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

// ────── One SLA row (click to expand its detail) ────────────────────
function SlaTrackRow({ item, sl, onAsk, expanded, onToggle }) {
  const v = lineVisual(item);
  const m = STATUS_META[item.status] || STATUS_META.pending;
  const IconC = Icon[v.icon] || Icon.sla;
  const metricLabel = item.metricKind
    ? sl(...(METRIC_LABEL[item.metricKind] || [item.metricKind, item.metricKind]))
    : sl('Adherence', 'Adhérence');
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 1.6fr 1.3fr auto 16px',
          gap: 14,
          alignItems: 'center',
          padding: '12px 4px',
          cursor: 'pointer',
        }}
      >
        {/* domain icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `color-mix(in oklch, ${v.color} 12%, var(--surface))`,
            color: v.color,
            flexShrink: 0,
          }}
        >
          <IconC size={20} />
        </div>

        {/* name + customer */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.name}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-dim)',
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon.people size={12} />{' '}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.customer}</span>
          </div>
        </div>

        {/* adherence vs target */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: m.color }}>
              {item.current != null ? `${Math.round(item.current)}%` : '—'}
            </span>
            {item.target != null && (
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {sl('vs', 'vs')} {Math.round(item.target)}%
              </span>
            )}
          </div>
          <AdherenceBar current={item.current} target={item.target} color={m.color} />
        </div>

        {/* status + trend + ask */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
          {item.trend?.length > 1 && (
            <Sparkline
              data={item.trend}
              w={64}
              h={22}
              stroke={m.color}
              fill={`color-mix(in oklch, ${m.color} 12%, transparent)`}
            />
          )}
          <StatusPill status={item.status} sl={sl} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAsk(item);
            }}
            title={sl('Ask Merlin about this SLA', 'Demander à Merlin')}
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: '5px 10px',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--accent)',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-line)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}
          >
            <Icon.sparkle size={13} /> {sl('Ask Merlin', 'Demander')}
          </button>
        </div>

        {/* expand chevron */}
        <Icon.chevD
          size={14}
          style={{
            color: 'var(--text-faint)',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }}
        />
      </div>

      {/* Detail panel — parameters + ownership */}
      {expanded && (
        <div style={{ padding: '6px 8px 18px 54px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DetailGroup title={sl('Parameters', 'Paramètres')}>
            <DetailField label={sl('Metric', 'Métrique')} value={metricLabel} />
            <DetailField
              label={sl('Target', 'Objectif')}
              value={item.target != null ? `${Math.round(item.target)}%` : '—'}
              mono
            />
            <DetailField
              label={sl('Current', 'Actuel')}
              value={item.current != null ? `${Math.round(item.current)}%` : sl('Pending', 'En attente')}
              mono
            />
            <DetailField label={sl('Window', 'Fenêtre')} value={`${item.windowDays} ${sl('days', 'jours')}`} mono />
            <DetailField
              label={sl('Sample', 'Échantillon')}
              value={item.sampleSize != null ? item.sampleSize.toLocaleString() : '—'}
              mono
            />
            <DetailField label={sl('Breaches (MTD)', 'Manquements (mois)')} value={item.breachesMtd ?? 0} mono />
          </DetailGroup>
          <DetailGroup title={sl('Ownership', 'Responsabilité')}>
            <DetailField label={sl('Client', 'Client')} value={item.customer} />
            <DetailField label={sl('Service line', 'Ligne de service')} value={cap(item.serviceKind)} />
            <DetailField
              label={sl('SLA owner', 'Responsable SLA')}
              value={item.ownerLabel || sl('Unassigned', 'Non attribué')}
            />
            <DetailField label={sl('Accountable', 'Redevable')} value={sl('Your team', 'Votre équipe')} />
          </DetailGroup>
          <div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAsk(item);
              }}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                color: 'var(--accent)',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'inherit',
              }}
            >
              <Icon.sparkle size={13} /> {sl('Ask Merlin to dig into this SLA', 'Demander à Merlin d’analyser ce SLA')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, count, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 110,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: '12px 14px',
        borderRadius: 12,
        background: active ? `color-mix(in oklch, ${color} 12%, var(--surface))` : 'var(--surface-2)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        transition: 'border-color .15s, background .15s',
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{count}</div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-dim)', marginTop: 2 }}>{label}</div>
    </button>
  );
}

export function ContractorSlaTracker({ onOpenChat, onView }) {
  const sl = useSL();
  const session = useSession();
  const orgId = session?.organizationId;
  const { items, loaded } = useContractorSlaTracker(orgId);
  const [filter, setFilter] = useState(null); // null | 'breach' | 'at_risk' | 'ok'
  const [expandedId, setExpandedId] = useState(null); // SLA whose detail is open

  const counts = useMemo(() => {
    const c = { breach: 0, at_risk: 0, ok: 0, pending: 0 };
    for (const it of items) c[it.status] = (c[it.status] || 0) + 1;
    return c;
  }, [items]);

  const overall = useMemo(() => {
    const computable = items.filter((it) => it.current != null);
    if (!computable.length) return null;
    return Math.round(computable.reduce((a, it) => a + it.current, 0) / computable.length);
  }, [items]);

  const shown = useMemo(() => (filter ? items.filter((it) => it.status === filter) : items), [items, filter]);

  // Group the (filtered) SLAs by service line, in the canonical line order;
  // within each line the urgency sort from `items` is preserved.
  const groups = useMemo(() => {
    const order = [...SERVICE_LINE_ORDER, 'other'];
    const byLine = {};
    for (const it of shown) {
      const line = serviceLineOf(it);
      (byLine[line] ||= []).push(it);
    }
    return order.filter((l) => byLine[l]?.length).map((l) => ({ line: l, items: byLine[l] }));
  }, [shown]);

  const askMerlin = (it) => {
    const statusLabel = sl(STATUS_META[it.status]?.label[0] || '', STATUS_META[it.status]?.label[1] || '');
    const q =
      it.current != null
        ? sl(
            `How is the "${it.name}" SLA for ${it.customer} doing? It's at ${Math.round(it.current)}%${it.target != null ? ` against a ${Math.round(it.target)}% target` : ''} (${statusLabel}). Diagnose what's driving it from the data and lead with your recommendation.`,
            `Comment se porte le SLA « ${it.name} » pour ${it.customer} ? Il est à ${Math.round(it.current)}%${it.target != null ? ` pour un objectif de ${Math.round(it.target)}%` : ''} (${statusLabel}). Diagnostique la cause à partir des données et commence par ta recommandation.`,
          )
        : sl(
            `The "${it.name}" SLA for ${it.customer} has no live reading yet. What would it take to start measuring it, and what's your read on the risk?`,
            `Le SLA « ${it.name} » pour ${it.customer} n'a pas encore de mesure en direct. Que faut-il pour le mesurer, et quel est ton avis sur le risque ?`,
          );
    onOpenChat?.(q, { send: true });
  };

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 12,
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-dim)' }}>
            {sl('SLA TRACKER', 'SUIVI DES SLA')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <Icon.agreement size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              {sl('Where your SLAs stand', 'Où en sont vos SLA')}
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 720, lineHeight: 1.5 }}>
            {sl(
              'Every service agreement you’re accountable for, across your clients — live adherence vs target, what’s at risk, and where it’s heading. To propose, amend or accept terms, head to Contracts → SLAs.',
              'Chaque accord de service dont vous êtes responsable, chez tous vos clients — adhérence en direct vs objectif, ce qui est à risque, et la tendance. Pour proposer, amender ou accepter des termes, allez dans Contrats → SLA.',
            )}
          </p>
        </div>
        {overall != null && (
          <div
            style={{
              minWidth: 160,
              padding: '14px 18px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: 0.2,
              }}
            >
              {sl('Avg adherence', 'Adhérence moy.')}
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 800,
                color: overall >= 90 ? 'var(--ok)' : overall >= 80 ? 'var(--warn)' : 'var(--risk)',
                marginTop: 4,
              }}
            >
              {overall}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
              {sl(`${items.length} SLA${items.length === 1 ? '' : 's'}`, `${items.length} SLA`)}
            </div>
          </div>
        )}
      </div>

      {/* Summary tiles (also filter the list) */}
      {loaded && items.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SummaryTile
            label={sl('On target', 'Conformes')}
            count={counts.ok}
            color="var(--ok)"
            active={filter === 'ok'}
            onClick={() => setFilter((f) => (f === 'ok' ? null : 'ok'))}
          />
          <SummaryTile
            label={sl('At risk', 'À risque')}
            count={counts.at_risk}
            color="var(--warn)"
            active={filter === 'at_risk'}
            onClick={() => setFilter((f) => (f === 'at_risk' ? null : 'at_risk'))}
          />
          <SummaryTile
            label={sl('Breaching', 'En infraction')}
            count={counts.breach}
            color="var(--risk)"
            active={filter === 'breach'}
            onClick={() => setFilter((f) => (f === 'breach' ? null : 'breach'))}
          />
          {counts.pending > 0 && (
            <SummaryTile
              label={sl('Pending', 'En attente')}
              count={counts.pending}
              color="var(--text-faint)"
              active={filter === 'pending'}
              onClick={() => setFilter((f) => (f === 'pending' ? null : 'pending'))}
            />
          )}
        </div>
      )}

      {/* List */}
      <Card style={{ padding: '4px 16px 8px' }}>
        {!loaded ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <AdaptivLoader />
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-dim)' }}>
            <Icon.shield size={28} style={{ color: 'var(--text-faint)' }} />
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, color: 'var(--text)' }}>
              {sl('No SLAs to track yet', 'Aucun SLA à suivre')}
            </div>
            <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.5, maxWidth: 420, marginInline: 'auto' }}>
              {sl(
                'Once a client agreement carries service-level targets, they’ll show here. Propose one from Contracts → SLAs.',
                'Dès qu’un accord client porte des objectifs de niveau de service, ils apparaîtront ici. Proposez-en un depuis Contrats → SLA.',
              )}
            </div>
          </div>
        ) : shown.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
            {sl('Nothing in this status right now.', 'Rien dans ce statut pour l’instant.')}
          </div>
        ) : (
          groups.map((g, gi) => (
            <div key={g.line}>
              <LineHeader line={g.line} count={g.items.length} first={gi === 0} sl={sl} />
              {g.items.map((it) => (
                <SlaTrackRow
                  key={it.id}
                  item={it}
                  sl={sl}
                  onAsk={askMerlin}
                  expanded={expandedId === it.id}
                  onToggle={() => setExpandedId((cur) => (cur === it.id ? null : it.id))}
                />
              ))}
            </div>
          ))
        )}
      </Card>

      {/* Manage footer — editing lives in OPERATE */}
      {loaded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            padding: '0 4px 4px',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {sl('Need to propose, amend or accept SLA terms?', 'Besoin de proposer, amender ou accepter des termes ?')}
          </span>
          <button
            onClick={() => onView?.('contracts')}
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              padding: '7px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--text)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'inherit',
            }}
          >
            {sl('Manage in Contracts', 'Gérer dans Contrats')} <Icon.chevR size={13} />
          </button>
        </div>
      )}
    </main>
  );
}
