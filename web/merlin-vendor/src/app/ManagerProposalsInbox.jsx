// Manager-side proposals inbox.
//
// Lives at Operations → Proposals on real_estate / adaptiv orgs (the
// FM persona). Lists every contract_proposal where the caller's org
// is the manager_org, across all contracts. Decision affordances
// (Accept / Decline / Counter) render inline per submitted row so
// Jamie doesn't have to drill into a contract drawer per proposal.
//
// Companion to ContractorApp.jsx ProposalsSection (the contractor's
// per-contract view of the same data). Both surfaces hit the same
// contract_proposals rows via different filters; the column-mask
// trigger on the table guarantees field-level isolation regardless
// of which surface is in use.

import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill } from './primitives.jsx';
import { useT } from './i18n.js';
import { useSession } from './auth.js';
import { useActiveOrg } from './org-data.js';
import { useManagerProposalsInbox, updateContractProposal } from './slas-data.js';
import { ContractDrawerById } from './ContractorApp.jsx';

const STATUS_TONE = {
  drafted: 'neutral',
  submitted: 'warn',
  accepted: 'ok',
  declined: 'risk',
  countered: 'accent',
  withdrawn: 'neutral',
};

const CATEGORY_LABEL = {
  cadence_change: 'Cadence change',
  scope_expansion: 'Scope expansion',
  new_service: 'New service',
  innovation_partner: 'Innovation partner',
  other: 'Other',
};

const FILTERS = [
  { id: 'pending', label: 'Needs decision', match: (p) => p.status === 'submitted' || p.status === 'countered' },
  { id: 'all', label: 'All', match: () => true },
  { id: 'accepted', label: 'Accepted', match: (p) => p.status === 'accepted' },
  { id: 'declined', label: 'Declined', match: (p) => p.status === 'declined' },
  { id: 'archive', label: 'Withdrawn / drafts', match: (p) => p.status === 'withdrawn' || p.status === 'drafted' },
];

export function ManagerProposalsInbox() {
  useT();
  const session = useSession();
  const org = useActiveOrg();
  const { proposals, loaded } = useManagerProposalsInbox(session?.organizationId);
  const [filter, setFilter] = useState('pending');
  // Phase 8.4 — clicking the contract name on a row opens the contract
  // drawer in a side overlay so the FM can see other proposals + reports
  // for the same contract while deciding, without leaving the inbox.
  const [drawerContractId, setDrawerContractId] = useState(null);

  const counts = useMemo(
    () => ({
      pending: proposals.filter((p) => p.status === 'submitted' || p.status === 'countered').length,
      all: proposals.length,
      accepted: proposals.filter((p) => p.status === 'accepted').length,
      declined: proposals.filter((p) => p.status === 'declined').length,
      archive: proposals.filter((p) => p.status === 'withdrawn' || p.status === 'drafted').length,
      monthlyDeltaSum: proposals
        .filter((p) => p.status === 'accepted' && p.monthly_value_delta != null)
        .reduce((sum, p) => sum + Number(p.monthly_value_delta || 0), 0),
    }),
    [proposals],
  );

  const visible = useMemo(() => {
    const def = FILTERS.find((f) => f.id === filter) || FILTERS[0];
    return proposals.filter(def.match);
  }, [proposals, filter]);

  return (
    <main style={{ flex: 1, padding: 'var(--pad)', overflow: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
        <Hero org={org} counts={counts} />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => {
            const n = counts[f.id] ?? 0;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: active ? 'var(--accent)' : 'var(--text-soft)',
                  border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                  borderRadius: 999,
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {f.label}
                <span
                  style={{
                    background: active ? 'var(--accent)' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--text-soft)',
                    padding: '1px 6px',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        {!loaded && (
          <div style={{ textAlign: 'center', padding: 36, color: 'var(--text-faint)' }}>Loading proposals…</div>
        )}

        {loaded && proposals.length === 0 && <EmptyState />}

        {loaded && proposals.length > 0 && visible.length === 0 && (
          <div
            style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', textAlign: 'center', padding: 36 }}
          >
            No proposals match this filter.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((p) => (
            <InboxRow key={p.id} proposal={p} onOpenContract={(id) => setDrawerContractId(id)} />
          ))}
        </div>
      </div>
      {drawerContractId && (
        <ContractDrawerById contractId={drawerContractId} onClose={() => setDrawerContractId(null)} />
      )}
    </main>
  );
}

function Hero({ org, counts }) {
  const fmt = (n, currency = 'USD') => {
    if (!n) return null;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `$${Math.round(n).toLocaleString()}`;
    }
  };
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: 'var(--pad)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--surface)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(500px 240px at 85% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.15,
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            fontWeight: 700,
          }}
        >
          Proposals from your contractors{org?.name ? ` · ${org.name}` : ''}
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>Proposals inbox</h1>
        <p style={{ margin: '6px 0 12px', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 720 }}>
          Every cadence change, scope expansion, and innovation pitch your contractors have submitted — across every
          contract you manage. Decide inline; the contractor's view updates in realtime.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Stat label="Needs decision" value={counts.pending} tone="warn" />
          <Stat label="Accepted (lifetime)" value={counts.accepted} tone="ok" />
          <Stat label="Total" value={counts.all} tone="neutral" />
          {counts.monthlyDeltaSum !== 0 && (
            <Stat
              label="Accepted Δ"
              value={`${counts.monthlyDeltaSum >= 0 ? '+' : '−'}${fmt(Math.abs(counts.monthlyDeltaSum))}/mo`}
              tone="accent"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const palette = {
    ok: { fg: 'var(--ok)', bg: 'color-mix(in oklch, var(--ok) 10%, transparent)' },
    warn: { fg: 'var(--warn)', bg: 'color-mix(in oklch, var(--warn) 10%, transparent)' },
    accent: { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
    neutral: { fg: 'var(--text-soft)', bg: 'var(--surface-2)' },
  }[tone] || { fg: 'var(--text-soft)', bg: 'var(--surface-2)' };
  return (
    <div
      style={{
        padding: '8px 12px',
        background: palette.bg,
        borderRadius: 8,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 100,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--text-dim)',
          letterSpacing: 0.15,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color: palette.fg, marginTop: 2 }}>{value}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: 48,
        textAlign: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
      }}
    >
      <Icon.sparkle size={28} style={{ color: 'var(--text-faint)' }} />
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, color: 'var(--text)' }}>No proposals yet</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, maxWidth: 460, marginInline: 'auto' }}>
        When a contractor on one of your contracts submits a cadence change, scope expansion, or innovation pitch, it
        will appear here. They author from their own Operations → Contracts page using Merlin's strategic
        recommendations.
      </div>
    </div>
  );
}

function InboxRow({ proposal, onOpenContract }) {
  const [expanded, setExpanded] = useState(proposal.status === 'submitted');
  const [acting, setActing] = useState(false);
  const [error, setError] = useState(null);
  const [decisionNote, setDecisionNote] = useState(proposal.decision_note || '');
  const [counterValue, setCounterValue] = useState(proposal.counter_value ?? '');
  const [counterNote, setCounterNote] = useState(proposal.counter_note || '');

  // Re-sync editor state when the underlying row updates from realtime
  useEffect(() => {
    setDecisionNote(proposal.decision_note || '');
    setCounterValue(proposal.counter_value ?? '');
    setCounterNote(proposal.counter_note || '');
  }, [proposal.id, proposal.decision_note, proposal.counter_value, proposal.counter_note, proposal.status]);

  async function flip(patch) {
    setActing(true);
    setError(null);
    try {
      await updateContractProposal(proposal.id, patch);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setActing(false);
    }
  }

  const vendor = proposal.vendor || null;
  const contract = proposal.contract || null;
  const contractor = proposal.contractor_org || null;
  const currency = contract?.currency || proposal.currency || 'USD';
  const fmtMoney = (n, suffix = '') => {
    if (n == null) return null;
    const abs = Math.abs(Number(n));
    const sign = Number(n) >= 0 ? '+' : '−';
    try {
      const v = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(abs);
      return `${sign}${v}${suffix}`;
    } catch {
      return `${sign}$${Math.round(abs).toLocaleString()}${suffix}`;
    }
  };

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <Icon.sparkle size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-dim)',
              fontWeight: 700,
              letterSpacing: 0.15,
              textTransform: 'uppercase',
            }}
          >
            {contractor?.name || 'Unknown contractor'}
            {contract?.name && (
              <>
                {' · '}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenContract && contract?.id) onOpenContract(contract.id);
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && onOpenContract && contract?.id) {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenContract(contract.id);
                    }
                  }}
                  title="Open contract drawer"
                  style={{
                    color: 'var(--accent)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  {contract.name}
                </span>
              </>
            )}
          </div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: 'var(--text)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {proposal.title || '(Untitled proposal)'}
          </div>
          <div
            style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}
          >
            <span>{CATEGORY_LABEL[proposal.category] || proposal.category}</span>
            {proposal.monthly_value_delta != null && (
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                {fmtMoney(proposal.monthly_value_delta, '/mo')}
              </span>
            )}
            {vendor && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>with {vendor.name}</span>}
            <span style={{ color: 'var(--text-faint)' }}>
              submitted {proposal.submitted_at ? new Date(proposal.submitted_at).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
        <Pill tone={STATUS_TONE[proposal.status] || 'neutral'}>{proposal.status}</Pill>
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-dim)',
            marginTop: 4,
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }}
        >
          ▾
        </span>
      </div>

      {expanded && (
        <div
          style={{
            padding: 12,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
            {proposal.body}
          </div>

          {proposal.expected_outcome && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.15,
                  marginBottom: 4,
                }}
              >
                Expected outcome
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {proposal.expected_outcome}
              </div>
            </div>
          )}

          {vendor && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.15,
                  marginBottom: 4,
                }}
              >
                Innovation partner
              </div>
              <div
                style={{
                  padding: 10,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--accent-line)',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon.sparkle size={12} style={{ color: 'var(--accent)' }} />
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{vendor.name}</div>
                  <Pill tone="accent">{vendor.category_id}</Pill>
                  {vendor.region && vendor.region !== 'global' && (
                    <Pill tone="info">{String(vendor.region).toUpperCase()}</Pill>
                  )}
                </div>
                {vendor.tagline && <div style={{ fontSize: 11.5, color: 'var(--text-soft)' }}>{vendor.tagline}</div>}
              </div>
            </div>
          )}

          {(proposal.status === 'declined' || proposal.status === 'accepted' || proposal.status === 'countered') && (
            <div
              style={{
                padding: 10,
                borderRadius: 6,
                background:
                  proposal.status === 'declined'
                    ? 'color-mix(in oklch, var(--risk) 8%, transparent)'
                    : proposal.status === 'accepted'
                      ? 'color-mix(in oklch, var(--ok) 8%, transparent)'
                      : 'var(--accent-soft)',
                borderLeft: `3px solid ${
                  proposal.status === 'declined'
                    ? 'var(--risk)'
                    : proposal.status === 'accepted'
                      ? 'var(--ok)'
                      : 'var(--accent)'
                }`,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.15,
                  marginBottom: 4,
                }}
              >
                {proposal.status} · {proposal.decided_at ? new Date(proposal.decided_at).toLocaleDateString() : ''}
              </div>
              {/* Phase 8.5 — surface the contract auto-amendment that
                  the accept-trigger applied. Trigger fires on the
                  accepted transition; this is just a UX confirmation
                  so the FM sees the chain without opening the drawer. */}
              {proposal.status === 'accepted' &&
                proposal.monthly_value_delta != null &&
                Number(proposal.monthly_value_delta) !== 0 && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--ok)',
                      fontWeight: 600,
                      marginBottom: proposal.decision_note ? 6 : 0,
                    }}
                  >
                    Contract auto-amended {fmtMoney(proposal.monthly_value_delta, '/mo')}
                  </div>
                )}
              {proposal.decision_note && (
                <div style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{proposal.decision_note}</div>
              )}
              {proposal.status === 'countered' && (proposal.counter_value != null || proposal.counter_note) && (
                <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-soft)' }}>
                  {proposal.counter_value != null && (
                    <div>Counter value: {fmtMoney(proposal.counter_value, '/mo')}</div>
                  )}
                  {proposal.counter_note && (
                    <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{proposal.counter_note}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {proposal.status === 'submitted' && (
            <DecisionPanel
              proposal={proposal}
              currency={currency}
              decisionNote={decisionNote}
              setDecisionNote={setDecisionNote}
              counterValue={counterValue}
              setCounterValue={setCounterValue}
              counterNote={counterNote}
              setCounterNote={setCounterNote}
              acting={acting}
              flip={flip}
            />
          )}

          {error && <div style={{ fontSize: 11.5, color: 'var(--risk)' }}>{error}</div>}
        </div>
      )}
    </div>
  );
}

function DecisionPanel({
  currency,
  decisionNote,
  setDecisionNote,
  counterValue,
  setCounterValue,
  counterNote,
  setCounterNote,
  acting,
  flip,
}) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 6,
        background: 'color-mix(in oklch, var(--warn) 5%, transparent)',
        border: '1px dashed color-mix(in oklch, var(--warn) 35%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{ fontSize: 10, fontWeight: 700, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: 0.15 }}
      >
        Your decision
      </div>
      <textarea
        value={decisionNote}
        onChange={(e) => setDecisionNote(e.target.value)}
        placeholder="Optional note to the contractor explaining your decision."
        rows={2}
        style={inputStyle}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => flip({ status: 'accepted', decision_note: decisionNote || null })}
          disabled={acting}
          style={{ ...btnBase(acting), background: 'var(--ok)', color: '#fff', borderColor: 'var(--ok)' }}
        >
          <Icon.check size={11} /> Accept
        </button>
        <button
          onClick={() => flip({ status: 'declined', decision_note: decisionNote || null })}
          disabled={acting}
          style={{ ...btnBase(acting), background: 'var(--risk)', color: '#fff', borderColor: 'var(--risk)' }}
        >
          Decline
        </button>
      </div>
      <details>
        <summary style={{ fontSize: 11, color: 'var(--text-soft)', cursor: 'pointer', fontWeight: 600 }}>
          Counter-propose instead
        </summary>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="number"
            value={counterValue}
            onChange={(e) => setCounterValue(e.target.value)}
            placeholder={`Counter value (${currency}/mo)`}
            style={inputStyle}
          />
          <textarea
            value={counterNote}
            onChange={(e) => setCounterNote(e.target.value)}
            placeholder="Counter terms — what you'd accept instead."
            rows={2}
            style={inputStyle}
          />
          <button
            onClick={() =>
              flip({
                status: 'countered',
                decision_note: decisionNote || null,
                counter_value: counterValue === '' ? null : Number(counterValue),
                counter_note: counterNote || null,
              })
            }
            disabled={acting}
            style={{ ...btnBase(acting), background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}
          >
            Send counter-proposal
          </button>
        </div>
      </details>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '7px 9px',
  fontSize: 12.5,
  lineHeight: 1.4,
  fontFamily: 'inherit',
  color: 'var(--text)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  resize: 'vertical',
};

function btnBase(disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 12px',
    border: '1px solid var(--accent-line)',
    borderRadius: 6,
    fontFamily: 'inherit',
    fontSize: 11.5,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}
