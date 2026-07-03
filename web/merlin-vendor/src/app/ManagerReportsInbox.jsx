// Manager-side reports inbox (Phase 8.3 of the contractor intelligence
// loop). Lives at Operations → Reports on real_estate orgs.
//
// Where ManagerProposalsInbox is the FM's view of "what is my contractor
// asking me to decide on", this is the FM's view of "what has my
// contractor handed me as a deliverable" — every contract_report sent
// across every contract this org manages, all in one place.
//
// Read-only on the FM side: reports are unilateral deliverables (the
// contractor authors + sends; the FM consumes). No decision flow here
// — that's the proposals inbox. The bell deep-links here when a
// `report_sent` notification fires; clicking the row expands the
// frozen snapshot inline.

import React, { useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill } from './primitives.jsx';
import { useT } from './i18n.js';
import { useSession } from './auth.js';
import { useActiveOrg } from './org-data.js';
import { useManagerReportsInbox } from './slas-data.js';
import { ContractSlaRow, ReportPilotRow, ContractDrawerById } from './ContractorApp.jsx';

const STATUS_TONE = {
  draft: 'warn',
  sent: 'ok',
  archived: 'neutral',
};

const FILTERS = [
  { id: 'sent', label: 'Sent', match: (r) => r.status === 'sent' },
  { id: 'all', label: 'All', match: () => true },
  { id: 'draft', label: 'Drafts (preview)', match: (r) => r.status === 'draft' },
  { id: 'archived', label: 'Archived', match: (r) => r.status === 'archived' },
];

export function ManagerReportsInbox() {
  useT();
  const session = useSession();
  const org = useActiveOrg();
  const { reports, loaded } = useManagerReportsInbox(session?.organizationId);
  const [filter, setFilter] = useState('sent');
  // Phase 8.4 — clicking the contract name on a row opens the contract
  // drawer in a side overlay so the FM can see other proposals + reports
  // for the same contract while reviewing.
  const [drawerContractId, setDrawerContractId] = useState(null);

  const counts = useMemo(
    () => ({
      sent: reports.filter((r) => r.status === 'sent').length,
      all: reports.length,
      draft: reports.filter((r) => r.status === 'draft').length,
      archived: reports.filter((r) => r.status === 'archived').length,
      contractors: new Set(reports.map((r) => r.contractor_org_id).filter(Boolean)).size,
    }),
    [reports],
  );

  const visible = useMemo(() => {
    const def = FILTERS.find((f) => f.id === filter) || FILTERS[0];
    return reports.filter(def.match);
  }, [reports, filter]);

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
          <div style={{ textAlign: 'center', padding: 36, color: 'var(--text-faint)' }}>Loading reports…</div>
        )}
        {loaded && reports.length === 0 && <EmptyState />}
        {loaded && reports.length > 0 && visible.length === 0 && (
          <div
            style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', textAlign: 'center', padding: 36 }}
          >
            No reports match this filter.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((r) => (
            <InboxReportRow key={r.id} report={r} onOpenContract={(id) => setDrawerContractId(id)} />
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
          Reports from your contractors{org?.name ? ` · ${org.name}` : ''}
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: -0.01 }}>Reports inbox</h1>
        <p style={{ margin: '6px 0 12px', color: 'var(--text-soft)', fontSize: 13.5, maxWidth: 720 }}>
          Frozen performance summaries your contractors have sent — SLA snapshot, accepted innovation pilots, and
          cumulative impact across prior periods. Read-only here; this is the deliverable, not a decision queue.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Stat label="Sent" value={counts.sent} tone="ok" />
          <Stat label="Total" value={counts.all} tone="neutral" />
          <Stat label="Contractors" value={counts.contractors} tone="accent" />
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
      <Icon.panel size={28} style={{ color: 'var(--text-faint)' }} />
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, color: 'var(--text)' }}>No reports yet</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, maxWidth: 460, marginInline: 'auto' }}>
        When a contractor on one of your contracts generates and sends a weekly or monthly performance report, it lands
        here. Drafts won't show up until they're marked as sent.
      </div>
    </div>
  );
}

function InboxReportRow({ report, onOpenContract }) {
  const [expanded, setExpanded] = useState(report.status === 'sent' && isRecent(report.sent_at));
  const snapshot = report.snapshot || {};
  const slas = Array.isArray(snapshot.slas) ? snapshot.slas : [];
  const acceptedProposals = Array.isArray(snapshot.accepted_proposals) ? snapshot.accepted_proposals : [];
  const activePriorPilots = Array.isArray(snapshot.active_prior_pilots) ? snapshot.active_prior_pilots : [];
  const contract = report.contract;
  const contractor = report.contractor_org;

  const periodLabel =
    report.period === 'weekly'
      ? `Week of ${report.period_start}`
      : report.period === 'monthly'
        ? `Month of ${report.period_start.slice(0, 7)}`
        : `${report.period_start} → ${report.period_end}`;

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
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
          }}
        >
          <Icon.panel size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
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
                fontSize: 13.5,
                fontWeight: 700,
                color: 'var(--accent)',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              {contract?.name || 'Contract'}
            </span>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>· {periodLabel}</div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-soft)', marginTop: 2 }}>
            From <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{contractor?.name || 'Contractor'}</strong>
            {report.sent_at
              ? ` · sent ${new Date(report.sent_at).toLocaleDateString()}`
              : ` · generated ${new Date(report.generated_at).toLocaleDateString()}`}
            {acceptedProposals.length > 0 &&
              ` · ${acceptedProposals.length} pilot${acceptedProposals.length === 1 ? '' : 's'} this period`}
          </div>
        </div>
        <Pill tone={STATUS_TONE[report.status] || 'neutral'}>{report.status}</Pill>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
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
            padding: 14,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'var(--surface-2)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: 0.15,
                marginBottom: 5,
              }}
            >
              SLA snapshot ({slas.length})
            </div>
            {slas.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                No SLAs in scope at the time of this report.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {slas.map((s) => (
                  <ContractSlaRow
                    key={s.id}
                    sla={{ ...s, target: s.target ?? s.target_pct, computable: s.computable !== false }}
                  />
                ))}
              </div>
            )}
          </div>

          {acceptedProposals.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.15,
                  marginBottom: 5,
                }}
              >
                Innovation pilots accepted this period ({acceptedProposals.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {acceptedProposals.map((p) => (
                  <ReportPilotRow key={p.id} pilot={p} />
                ))}
              </div>
            </div>
          )}

          {activePriorPilots.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-soft)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.15,
                  marginBottom: 5,
                }}
              >
                Active pilots from prior periods ({activePriorPilots.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activePriorPilots.map((p) => (
                  <ReportPilotRow key={p.id} pilot={p} variant="prior" />
                ))}
              </div>
            </div>
          )}

          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: 0.15,
                marginBottom: 5,
              }}
            >
              Narrative
            </div>
            <div
              style={{
                padding: 10,
                fontSize: 12,
                lineHeight: 1.55,
                color: report.contractor_note ? 'var(--text)' : 'var(--text-faint)',
                fontStyle: report.contractor_note ? 'normal' : 'italic',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {report.contractor_note || 'No narrative provided.'}
            </div>
          </div>

          {/* Phase 8.6 — Export PDF action for the FM. Opens the
              print-friendly view in a new tab; the FM hits Print
              from there to save as PDF for procurement / internal
              stakeholders. */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => window.open(`/print/report/${report.id}`, '_blank', 'noopener')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 9px',
                fontSize: 11.5,
                fontWeight: 700,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-line)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
              title="Open a print-friendly view (Save as PDF from your browser)"
            >
              <Icon.panel size={11} />
              Export PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// "Recent" = within the last 24h. Used to auto-expand the most recent
// sent report so the FM lands on what they came to see.
function isRecent(iso) {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < 24 * 60 * 60 * 1000;
}
