// Contract detail subsystem — the contract drawer + detail view, SLA rows,
// reports, report pilots, and proposals. Extracted from ContractorApp.jsx
// (2026-06-05) to break up a 4.5k-line god-file. ContractSlaRow /
// ContractDrawerById / ReportPilotRow are re-exported by ContractorApp for
// external consumers (PrintReportPage, Manager inboxes); ContractDetail /
// ReportsSection / ProposalsSection are imported back by ContractorApp's
// contracts dashboard. Behaviour unchanged.

import React, { useState, useEffect } from 'react';
import { Icon } from './icons.jsx';
import { Pill } from './primitives.jsx';
import { useT } from './i18n.js';
import { useSession } from './auth.js';
import { useContractById } from './queries/contracts.ts';
import { useVendors } from './vendors-data.js';
import { confirmDialog } from './dialogs.jsx';
import {
  useContractReports,
  generateContractReport,
  narrateContractReport,
  updateContractReport,
  useContractProposals,
  createContractProposal,
  updateContractProposal,
  deleteContractProposal,
} from './slas-data.js';

// Contract lifecycle status -> Pill tone. Kept local (also defined in
// ContractorApp.jsx's ContractCard) — a 1-line presentational constant
// duplicated to avoid a circular import between the two files.
const STATUS_TONE = { active: 'ok', draft: 'warn', expired: 'neutral', terminated: 'risk' };

export function ContractSlaRow({ sla }) {
  const dotColor =
    sla.status === 'breach'
      ? 'var(--risk)'
      : sla.status === 'at_risk'
        ? 'var(--warn)'
        : sla.status === 'ok'
          ? 'var(--ok)'
          : 'var(--text-faint)';
  const valueColor = sla.status === 'breach' ? 'var(--risk)' : sla.status === 'at_risk' ? 'var(--warn)' : 'var(--text)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: 'var(--text-soft)',
        }}
      >
        {sla.name}
      </span>
      {sla.computable && sla.current != null ? (
        <>
          <span
            style={{
              fontWeight: 700,
              color: valueColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {sla.current}%
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
            / {sla.target}%
          </span>
        </>
      ) : (
        <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontStyle: 'italic' }}>pending</span>
      )}
    </div>
  );
}

// ContractDrawerById — Phase 8.4 wrapper that fetches a contract row
// by id (in the shape ContractDetail expects) then renders the same
// drawer the contractor side already uses. Used by ManagerProposals
// and ManagerReports inboxes when an FM clicks the contract name on
// a row to see other proposals + reports for that contract without
// leaving the inbox.
//
// RLS on contracts already admits both party orgs; the embedded
// relations work the same for either side. The drawer's subsections
// (ReportsSection / ProposalsSection) detect which side via
// contractor_org_id == session.organizationId, so the FM lands in
// read-only mode automatically.
export function ContractDrawerById({ contractId, onClose }) {
  // Contract + party orgs + linked locations. null data = loading or not-found
  // (both render the loading shimmer below, matching prior behaviour).
  const { data: contract = null, error } = useContractById(contractId);

  if (!contract && !error) {
    // Loading shimmer using the same overlay shape ContractDetail uses
    // so there's no visual jump when the data lands.
    return (
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11,16,32,0.45)',
          zIndex: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(680px, 100%)',
            padding: 28,
            textAlign: 'center',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 14,
            color: 'var(--text-dim)',
            fontSize: 12.5,
          }}
        >
          Loading contract…
        </div>
      </div>
    );
  }
  if (error || !contract) {
    return (
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11,16,32,0.45)',
          zIndex: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(520px, 100%)',
            padding: 24,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--risk)', marginBottom: 6 }}>
            Couldn't load contract
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
            {error?.message || "Not found or you don't have access."}
          </div>
        </div>
      </div>
    );
  }
  return <ContractDetail contract={contract} onClose={onClose} />;
}

function ContractDetail({ contract, onClose, initialDraft = null }) {
  const t = useT();
  const locs = contract.contract_locations || [];
  const sla = contract.sla_summary || {};
  const slaEntries = Object.entries(sla);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,16,32,0.45)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(680px, 100%)',
          maxHeight: '85vh',
          overflow: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 14,
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--text-dim)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.15,
              }}
            >
              {contract.manager_org?.name || t('contractor.card.unknown_client')}
            </div>
            <h2 style={{ margin: '4px 0 6px', fontSize: 18, fontWeight: 700 }}>{contract.name}</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Pill tone={STATUS_TONE[contract.status] || 'neutral'}>{contract.status}</Pill>
              <Pill tone="info">{contract.service_kind}</Pill>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              padding: 6,
            }}
          >
            <Icon.close size={14} />
          </button>
        </div>

        <Section title={t('contractor.detail.terms')}>
          <Row label={t('contractor.detail.start_date')} value={contract.start_date} />
          {contract.end_date && <Row label={t('contractor.detail.end_date')} value={contract.end_date} />}
          {contract.monthly_value && (
            <Row
              label={t('contractor.detail.monthly_value')}
              value={`${contract.monthly_value} ${contract.currency || 'USD'}`}
            />
          )}
          {contract.terms && (
            <div
              style={{
                marginTop: 8,
                padding: 10,
                background: 'var(--surface-2)',
                borderRadius: 8,
                fontSize: 12.5,
                color: 'var(--text-soft)',
                lineHeight: 1.55,
              }}
            >
              {contract.terms}
            </div>
          )}
        </Section>

        <Section title={t('contractor.detail.sla_summary', { n: slaEntries.length })}>
          {slaEntries.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
              {t('contractor.detail.no_sla')}
            </div>
          )}
          {slaEntries.map(([k, v]) => (
            <Row key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : String(v)} />
          ))}
        </Section>

        <Section title={t('contractor.detail.locations', { n: locs.length })}>
          {locs.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
              {t('contractor.detail.no_locations')}
            </div>
          )}
          <div style={{ display: 'grid', gap: 4 }}>
            {locs.map((cl) => (
              <div
                key={cl.location_id}
                style={{
                  padding: '6px 10px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--text-soft)',
                }}
              >
                {cl.locations?.name || cl.location_id}
              </div>
            ))}
          </div>
        </Section>

        {contract.status === 'active' && <ReportsSection contract={contract} />}
        {contract.status === 'active' && <ProposalsSection contract={contract} initialDraft={initialDraft} />}
      </div>
    </div>
  );
}

// ReportsSection — Phase 3a of the contractor intelligence loop.
// Lives inside the ContractDetail drawer. Both parties see this; the
// contractor side gets generate buttons + narrative editor + send;
// the manager side reads-only.
function ReportsSection({ contract }) {
  const session = useSession();
  const { reports, loaded } = useContractReports(contract.id);
  const isContractor = (contract.contractor_org_id ?? contract.contractor_org?.id) === session?.organizationId;
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  async function generate(period) {
    setGenerating(true);
    setError(null);
    try {
      await generateContractReport(contract.id, { period });
      // Realtime sub on contract_reports will pick up the new row;
      // no need to manually refetch.
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Section title={`Performance reports (${reports.length})`}>
      {isContractor && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <button disabled={generating} onClick={() => generate('weekly')} style={reportButtonStyle(generating)}>
            <Icon.sparkle size={11} /> Generate weekly
          </button>
          <button disabled={generating} onClick={() => generate('monthly')} style={reportButtonStyle(generating)}>
            <Icon.sparkle size={11} /> Generate monthly
          </button>
          {generating && (
            <span style={{ fontSize: 11, color: 'var(--text-faint)', alignSelf: 'center' }}>Generating…</span>
          )}
        </div>
      )}
      {error && (
        <div
          style={{
            padding: '8px 10px',
            marginBottom: 8,
            background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
            border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
            borderRadius: 6,
            fontSize: 11.5,
            color: 'var(--risk)',
          }}
        >
          {error}
        </div>
      )}
      {!loaded && <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>Loading reports…</div>}
      {loaded && reports.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
          {isContractor
            ? 'No reports yet. Generate a weekly or monthly report to share performance with your client.'
            : 'No reports yet. Your contractor hasn’t generated one for this contract.'}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {reports.map((r) => (
          <ReportRow key={r.id} report={r} isContractor={isContractor} />
        ))}
      </div>
    </Section>
  );
}

function reportButtonStyle(disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 10px',
    background: disabled ? 'var(--surface-2)' : 'var(--accent-soft)',
    border: '1px solid var(--accent-line)',
    borderRadius: 6,
    fontFamily: 'inherit',
    fontSize: 11.5,
    fontWeight: 700,
    color: disabled ? 'var(--text-faint)' : 'var(--accent)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const REPORT_STATUS_TONE = { draft: 'warn', sent: 'ok', archived: 'neutral' };

function ReportRow({ report, isContractor }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(report.contractor_note || '');
  const [savingNote, setSavingNote] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState(null);
  // Phase 8.2 — Merlin auto-narrate. Haiku draft replaces the textarea
  // contents on click; the contractor edits + saves as usual. Tracked
  // separately so we can show a spinner without freezing the textarea.
  const [drafting, setDrafting] = useState(false);

  // Re-sync note when the underlying row updates from realtime (e.g.
  // a regenerate that bumped the snapshot but didn't touch the note).
  useEffect(() => {
    setNote(report.contractor_note || '');
  }, [report.id, report.contractor_note]);

  const snapshot = report.snapshot || {};
  const slas = Array.isArray(snapshot.slas) ? snapshot.slas : [];
  // IMF/ABM cleaning report: a device-derived cleaning-performance block
  // (imf_cleaning_perf) frozen into the snapshot at generation time, since
  // IMF's SLAs aren't engine-computable (signals live in public.events).
  const imfCleaning = snapshot.imf_cleaning || null;
  // Phase 5.5: proposals accepted during this report's period are
  // frozen into the snapshot at generation time. They surface here as
  // "Innovation pilots accepted this period" so the report tells a
  // story not just about numbers but about the changes the contractor
  // and FM committed to.
  const acceptedProposals = Array.isArray(snapshot.accepted_proposals) ? snapshot.accepted_proposals : [];
  // Phase 7: pilots accepted in earlier periods, still within the
  // 90-day attribution window. Each carries a cumulative impact
  // compute through this period's end — May's report sees ~30d post,
  // June's ~60d, July's ~90d, then the pilot ages out.
  const activePriorPilots = Array.isArray(snapshot.active_prior_pilots) ? snapshot.active_prior_pilots : [];

  async function saveNote() {
    setSavingNote(true);
    setError(null);
    try {
      await updateContractReport(report.id, { contractor_note: note });
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSavingNote(false);
    }
  }

  async function draftWithMerlin() {
    setDrafting(true);
    setError(null);
    try {
      const narrative = await narrateContractReport(report.contract_id, report.id);
      if (narrative) setNote(narrative);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setDrafting(false);
    }
  }

  async function markStatus(next) {
    setMarking(true);
    setError(null);
    try {
      await updateContractReport(report.id, { status: next });
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setMarking(false);
    }
  }

  const periodLabel =
    report.period === 'weekly'
      ? `Week of ${report.period_start}`
      : report.period === 'monthly'
        ? `Month of ${report.period_start.slice(0, 7)}`
        : `${report.period_start} → ${report.period_end}`;

  const noteDirty = (note || '') !== (report.contractor_note || '');

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface-2)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <Icon.shield size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {periodLabel}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
            Generated {new Date(report.generated_at).toLocaleDateString()} {' · '}
            {report.period}
          </div>
        </div>
        <Pill tone={REPORT_STATUS_TONE[report.status] || 'neutral'}>{report.status}</Pill>
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-dim)',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div
          style={{
            padding: 10,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {imfCleaning && (
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
                Cleaning performance (live devices)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
                {[
                  {
                    k: 'SLA adherence',
                    v: imfCleaning.sla_adherence_pct != null ? `${imfCleaning.sla_adherence_pct}%` : '—',
                  },
                  { k: 'Crew sessions', v: imfCleaning.crew_sessions_7d ?? '—' },
                  {
                    k: 'Restrooms serviced',
                    v:
                      imfCleaning.restrooms_serviced_7d != null
                        ? `${imfCleaning.restrooms_serviced_7d}/${imfCleaning.restrooms_total ?? '?'}`
                        : '—',
                  },
                  {
                    k: 'Requests',
                    v:
                      imfCleaning.requests_7d != null
                        ? `${imfCleaning.requests_resolved_7d ?? 0}/${imfCleaning.requests_7d}`
                        : '—',
                  },
                  { k: 'Footfall (HQ2)', v: imfCleaning.footfall_7d ?? '—' },
                  { k: 'Overdue at report', v: imfCleaning.overdue_now ?? '—' },
                ].map((m) => (
                  <div
                    key={m.k}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{m.v}</div>
                    <div
                      style={{
                        fontSize: 9.5,
                        color: 'var(--text-soft)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.2,
                      }}
                    >
                      {m.k}
                    </div>
                  </div>
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
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6, lineHeight: 1.45 }}>
                Pilots accepted before this period and still within the 90-day attribution window. Each shows the
                cumulative impact since acceptance.
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
            {isContractor ? (
              <>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional: a few lines on what happened this period, what's improving, what's risky."
                  rows={5}
                  disabled={drafting}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: 8,
                    fontSize: 12,
                    lineHeight: 1.5,
                    fontFamily: 'inherit',
                    color: 'var(--text)',
                    background: drafting ? 'var(--surface-2)' : 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    resize: 'vertical',
                    opacity: drafting ? 0.6 : 1,
                  }}
                />
                <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    onClick={draftWithMerlin}
                    disabled={drafting || savingNote}
                    style={{
                      ...reportButtonStyle(drafting || savingNote),
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                    title="Ask Merlin to draft a narrative from this report's snapshot. You'll be able to edit before saving."
                  >
                    <Icon.sparkle size={11} />
                    {drafting ? 'Drafting…' : note ? 'Re-draft with Merlin' : 'Draft with Merlin'}
                  </button>
                  {noteDirty && (
                    <button
                      onClick={saveNote}
                      disabled={savingNote || drafting}
                      style={reportButtonStyle(savingNote || drafting)}
                    >
                      {savingNote ? 'Saving…' : 'Save narrative'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: 10,
                  fontSize: 12,
                  lineHeight: 1.5,
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
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {/* Phase 8.6 — Export PDF available to both parties on
                a sent or draft report. Opens the chrome-less print
                view in a new tab; user invokes the browser's
                native Print dialog from there. */}
            <button
              onClick={() => window.open(`/print/report/${report.id}`, '_blank', 'noopener')}
              style={{ ...reportButtonStyle(false), display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title="Open a print-friendly view (Save as PDF from your browser)"
            >
              <Icon.panel size={11} />
              Export PDF
            </button>
            {isContractor && report.status === 'draft' && (
              <button onClick={() => markStatus('sent')} disabled={marking} style={reportButtonStyle(marking)}>
                Mark as sent to client
              </button>
            )}
            {isContractor && report.status === 'sent' && (
              <button
                onClick={() => markStatus('archived')}
                disabled={marking}
                style={{ ...reportButtonStyle(marking), background: 'var(--surface)', color: 'var(--text-dim)' }}
              >
                Archive
              </button>
            )}
            {isContractor && report.status === 'archived' && (
              <button
                onClick={() => markStatus('sent')}
                disabled={marking}
                style={{ ...reportButtonStyle(marking), background: 'var(--surface)', color: 'var(--text-dim)' }}
              >
                Restore
              </button>
            )}
          </div>

          {error && <div style={{ fontSize: 11.5, color: 'var(--risk)' }}>{error}</div>}
        </div>
      )}
    </div>
  );
}

// ReportPilotRow — Phase 5.5 + 7. Renders a single accepted proposal
// inside a report snapshot. Frozen data: title, category, decision
// note, monthly value Δ, attached vendor (with mini card if present).
// Pure read-only display; no action affordances.
//
// `variant` ∈ { 'this_period' (default) | 'prior' }:
//   'this_period' = pilots accepted IN this report's period; left
//                   border + bg use the full accent tone, header
//                   reads "accepted <date>"
//   'prior'       = pilots accepted BEFORE this period, still in the
//                   90d attribution window; muted accent so the
//                   "this period" block stays the visual headline,
//                   header reads "active since <date>"
export function ReportPilotRow({ pilot, variant = 'this_period' }) {
  const vendor = pilot?.vendor || null;
  const isPrior = variant === 'prior';
  const fmtDelta = (n) => {
    if (n == null) return null;
    const abs = Math.abs(Number(n));
    const sign = Number(n) >= 0 ? '+' : '−';
    try {
      const f = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: pilot.currency || 'USD',
        maximumFractionDigits: 0,
      }).format(abs);
      return `${sign}${f}`;
    } catch {
      return `${sign}$${Math.round(abs).toLocaleString()}`;
    }
  };
  const delta = fmtDelta(pilot.monthly_value_delta);
  const wrapStyle = isPrior
    ? {
        borderLeft: '3px solid var(--accent-line)',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        borderRadius: '0 8px 8px 0',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }
    : {
        borderLeft: '3px solid var(--accent)',
        background: 'var(--accent-soft)',
        borderRadius: '0 8px 8px 0',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      };
  return (
    <div style={wrapStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Icon.check size={11} style={{ color: isPrior ? 'var(--text-soft)' : 'var(--accent)', flexShrink: 0 }} />
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
          {pilot.title || '(Untitled proposal)'}
        </div>
        <Pill tone="accent">{PROPOSAL_CATEGORY_LABEL?.[pilot.category] || pilot.category}</Pill>
        {delta && <Pill tone="ok">{delta}/mo</Pill>}
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
          {isPrior ? 'active since ' : 'accepted '}
          {pilot.decided_at ? new Date(pilot.decided_at).toLocaleDateString() : ''}
        </span>
      </div>
      {pilot.body && (
        <div style={{ fontSize: 11.5, color: 'var(--text-soft)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
          {pilot.body}
        </div>
      )}
      {pilot.decision_note && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-soft)',
            lineHeight: 1.45,
            padding: '6px 8px',
            background: 'var(--surface)',
            borderRadius: 6,
            border: '1px dashed var(--border)',
            whiteSpace: 'pre-wrap',
          }}
        >
          <strong style={{ color: 'var(--text-dim)', fontWeight: 700 }}>Client note:</strong> {pilot.decision_note}
        </div>
      )}
      {vendor && (
        <div
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            background: 'var(--surface)',
            border: '1px solid var(--accent-line)',
            borderRadius: 999,
            fontSize: 10.5,
            fontWeight: 700,
            color: 'var(--accent)',
          }}
        >
          <Icon.sparkle size={10} />
          Partner: {vendor.name}
          {vendor.tagline && <span style={{ fontWeight: 500, color: 'var(--text-soft)' }}>· {vendor.tagline}</span>}
        </div>
      )}

      <PilotImpactBlock impact={pilot.sla_impact} />

      {/* Phase 8.7 — aging-out polish. When a pilot's 90d
          attribution window will close before the next report's
          period starts, surface that this is the last time it
          appears. Otherwise the pilot would just disappear from
          subsequent reports without explanation. */}
      {isPrior && pilot.aging_out && (
        <div
          style={{
            marginTop: 4,
            padding: '6px 10px',
            background: 'color-mix(in oklch, var(--warn) 10%, transparent)',
            border: '1px solid color-mix(in oklch, var(--warn) 30%, transparent)',
            borderRadius: 6,
            fontSize: 11,
            color: 'var(--warn)',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon.warn size={10} style={{ flexShrink: 0 }} />
          <span>
            <strong>Absorbed into baseline next period.</strong>{' '}
            <span style={{ color: 'var(--text-soft)', fontWeight: 500 }}>
              90-day attribution window closes; pilot becomes part of normal operations and stops appearing in shareback
              reports.
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

// PilotImpactBlock — Phase 6. Renders the pre/post SLA delta computed
// at report-generation time on the snapshot. States:
//   'computed' — show per-SLA pre → post Δ rows
//   'early'    — pilot decided <3 days ago; no meaningful post window
//   'no_data'  — no SLAs had enough samples in both windows
//   'error'    — compute threw (rare; surfaced for transparency)
// Pre-existing impact data is frozen in the report snapshot; this
// renderer never re-fetches, just projects.
function PilotImpactBlock({ impact }) {
  if (!impact) return null;
  const wrapStyle = {
    padding: '8px 10px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };
  const headerStyle = {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: 0.15,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };
  if (impact.status === 'early') {
    return (
      <div style={wrapStyle}>
        <div style={headerStyle}>
          <Icon.warn size={10} style={{ color: 'var(--text-dim)' }} />
          Impact attribution
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-soft)' }}>
          Early days — accepted only {impact.post_days} day{impact.post_days === 1 ? '' : 's'} ago. Next report will
          compare a 14-day window before vs after.
        </div>
      </div>
    );
  }
  if (impact.status === 'no_data' || impact.status === 'error') {
    return (
      <div style={wrapStyle}>
        <div style={headerStyle}>
          <Icon.warn size={10} style={{ color: 'var(--text-dim)' }} />
          Impact attribution
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontStyle: 'italic' }}>
          {impact.status === 'error'
            ? 'Could not compute impact for this pilot.'
            : 'Not enough SLA samples in either window to compute a comparison.'}
        </div>
      </div>
    );
  }
  // status === 'computed'
  const items = Array.isArray(impact.items) ? impact.items : [];
  if (items.length === 0) return null;
  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <Icon.sparkle size={10} style={{ color: 'var(--accent)' }} />
        Impact attribution · 14d before vs {impact.post_days}d after
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map((it) => (
          <PilotImpactRow key={it.sla_id} item={it} />
        ))}
      </div>
    </div>
  );
}

function PilotImpactRow({ item }) {
  const delta = Number(item.delta);
  const direction = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat';
  const deltaColor = direction === 'up' ? 'var(--ok)' : direction === 'down' ? 'var(--risk)' : 'var(--text-dim)';
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: 'var(--text-soft)',
        }}
      >
        {item.sla_name}
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-dim)' }}>
        {item.pre_pct == null ? '—' : `${item.pre_pct}%`}
      </span>
      <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>→</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text)' }}>
        {item.post_pct == null ? '—' : `${item.post_pct}%`}
      </span>
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 700,
          color: deltaColor,
          minWidth: 48,
          textAlign: 'right',
        }}
      >
        {arrow} {Math.abs(delta).toFixed(1)}pp
      </span>
    </div>
  );
}

// ProposalsSection — Phase 3b. Innovation upsell mechanism: contractor
// drafts proposals (often seeded from Merlin's strategic bucket via
// the "Make proposal" button), submits them, and the FM
// accepts/declines/counters. Both parties see the same list with the
// state machine reflected in status pills.
function ProposalsSection({ contract, initialDraft = null }) {
  const session = useSession();
  const { proposals, loaded } = useContractProposals(contract.id);
  const isContractor = (contract.contractor_org_id ?? contract.contractor_org?.id) === session?.organizationId;
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // If a Merlin recommendation was handed in via the "Make proposal"
  // button on the contract card, auto-open compose mode with the body
  // pre-filled. Phase 8.10 — renewal drafts also flow through here
  // and additionally pre-fill title + monthly_value_delta +
  // expected_outcome when present.
  useEffect(() => {
    if (initialDraft && isContractor) {
      setDraft({
        title: initialDraft.title || '',
        body: initialDraft.body || '',
        category: initialDraft.category || 'cadence_change',
        expected_outcome: initialDraft.expected_outcome || '',
        monthly_value_delta: initialDraft.monthly_value_delta != null ? String(initialDraft.monthly_value_delta) : '',
        // Phase 5: when Merlin suggested a partner with this strategic
        // recommendation, pre-fill the vendor picker with it. The
        // contractor still confirms (or overrides) before submitting.
        vendor_id: initialDraft.vendor_id || '',
      });
      setComposing(true);
    }
  }, [initialDraft, isContractor]);

  function startBlankCompose() {
    setDraft({
      title: '',
      body: '',
      category: 'other',
      expected_outcome: '',
      monthly_value_delta: '',
      vendor_id: '',
    });
    setComposing(true);
    setError(null);
  }

  function cancelCompose() {
    setComposing(false);
    setDraft(null);
    setError(null);
  }

  async function saveDraft(submit = false) {
    if (!draft) return;
    setCreating(true);
    setError(null);
    try {
      const numericDelta =
        draft.monthly_value_delta === '' || draft.monthly_value_delta == null
          ? null
          : Number(draft.monthly_value_delta);
      await createContractProposal(contract, {
        title: draft.title || '(Untitled proposal)',
        body: draft.body,
        category: draft.category,
        expected_outcome: draft.expected_outcome || null,
        monthly_value_delta: Number.isFinite(numericDelta) ? numericDelta : null,
        currency: contract.currency || 'USD',
        vendor_id: draft.vendor_id || null,
        status: submit ? 'submitted' : 'drafted',
      });
      cancelCompose();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Section title={`Proposals (${proposals.length})`}>
      {isContractor && !composing && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={startBlankCompose} style={reportButtonStyle(false)}>
            <Icon.plus size={11} /> New proposal
          </button>
        </div>
      )}

      {composing && draft && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: 'var(--surface-2)',
            border: '1px solid var(--accent-line)',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: 0.15,
            }}
          >
            New proposal
          </div>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Title — e.g. 'Bump Floor 32 cadence to 3× weekly'"
            style={inputStyle()}
          />
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            style={inputStyle()}
          >
            <option value="cadence_change">Cadence change</option>
            <option value="scope_expansion">Scope expansion</option>
            <option value="new_service">New service</option>
            <option value="innovation_partner">Innovation partner</option>
            <option value="other">Other</option>
          </select>
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="The pitch — why this matters, what data backs it, what changes."
            rows={4}
            style={{ ...inputStyle(), resize: 'vertical' }}
          />
          <textarea
            value={draft.expected_outcome}
            onChange={(e) => setDraft({ ...draft, expected_outcome: e.target.value })}
            placeholder="Expected outcome — what improves if approved (optional)."
            rows={2}
            style={{ ...inputStyle(), resize: 'vertical' }}
          />
          <input
            type="number"
            value={draft.monthly_value_delta}
            onChange={(e) => setDraft({ ...draft, monthly_value_delta: e.target.value })}
            placeholder={`Monthly value Δ (${contract.currency || 'USD'}) — optional`}
            style={inputStyle()}
          />
          <ProposalVendorPicker
            category={draft.category}
            vendorId={draft.vendor_id}
            onChange={(vid) => setDraft({ ...draft, vendor_id: vid })}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              disabled={creating || !draft.body.trim()}
              onClick={() => saveDraft(false)}
              style={reportButtonStyle(creating || !draft.body.trim())}
            >
              Save draft
            </button>
            <button
              disabled={creating || !draft.body.trim()}
              onClick={() => saveDraft(true)}
              style={{
                ...reportButtonStyle(creating || !draft.body.trim()),
                background: 'var(--accent)',
                color: '#fff',
                borderColor: 'var(--accent)',
              }}
            >
              <Icon.send size={11} /> Submit to client
            </button>
            <button
              disabled={creating}
              onClick={cancelCompose}
              style={{ ...reportButtonStyle(creating), background: 'var(--surface)', color: 'var(--text-dim)' }}
            >
              Cancel
            </button>
          </div>
          {error && <div style={{ fontSize: 11.5, color: 'var(--risk)' }}>{error}</div>}
        </div>
      )}

      {!loaded && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>Loading proposals…</div>
      )}
      {loaded && proposals.length === 0 && !composing && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
          {isContractor
            ? 'No proposals yet. Use Merlin’s strategic recommendations on the contract card, or click “New proposal” to start one from scratch.'
            : 'No proposals yet from this contractor.'}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {proposals.map((p) => (
          <ProposalRow key={p.id} proposal={p} contract={contract} isContractor={isContractor} />
        ))}
      </div>
    </Section>
  );
}

function inputStyle() {
  return {
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
  };
}

// service_kind / proposal-category → vendor category_id heuristics.
// Filters the vendor picker so Lisa proposing a cadence change for
// cleaning sees the operations / wellbeing vendors that actually map,
// not Verkada / Yardi etc. Pure UX pre-filter; user can always toggle
// to the full catalog. See marketplace_vendors.category_id values:
//   wellbeing | compliance | operations | energy | safety | financial
const PROPOSAL_CATEGORY_VENDOR_HINTS = {
  cadence_change: ['operations', 'wellbeing'],
  scope_expansion: ['operations', 'wellbeing', 'safety'],
  new_service: ['operations', 'safety', 'energy', 'compliance', 'wellbeing'],
  innovation_partner: null, // null = show all
  other: null,
};

function ProposalVendorPicker({ category, vendorId, onChange }) {
  const vendors = useVendors();
  const [showAll, setShowAll] = useState(false);
  if (vendors === null) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>Loading partner catalog…</div>
    );
  }
  if (vendors.length === 0) return null;

  const hint = PROPOSAL_CATEGORY_VENDOR_HINTS[category];
  const filtered = !showAll && Array.isArray(hint) ? vendors.filter((v) => hint.includes(v.categoryId)) : vendors;
  const selected = vendors.find((v) => v.id === vendorId) || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.15,
        }}
      >
        Innovation partner (optional)
      </div>
      <select value={vendorId || ''} onChange={(e) => onChange(e.target.value || null)} style={inputStyle()}>
        <option value="">— No partner attached —</option>
        {filtered.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} · {v.tagline}
          </option>
        ))}
      </select>
      {Array.isArray(hint) && (
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
          Showing {filtered.length} {showAll ? 'all' : 'matching'} of {vendors.length} partners ·{' '}
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 10.5,
              fontWeight: 600,
            }}
          >
            {showAll ? 'narrow to category' : 'show all'}
          </button>
        </div>
      )}
      {selected && <ProposalVendorCard vendor={selected} />}
    </div>
  );
}

// ProposalVendorCard — embeds a marketplace vendor as a richer card
// inside a proposal. Renders the same key fields the Innovate detail
// drawer surfaces (name, tagline, region, deploy type, key features
// preview), capped to a small footprint so it fits inside the
// ContractDetail drawer.
function ProposalVendorCard({ vendor }) {
  if (!vendor) return null;
  return (
    <div
      style={{
        padding: 10,
        background: 'var(--surface)',
        border: '1px solid var(--accent-line)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {vendor.name?.charAt(0) || 'V'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{vendor.name}</div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-soft)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {vendor.tagline}
          </div>
        </div>
        <Pill tone="accent">{vendor.categoryId}</Pill>
        {vendor.region && vendor.region !== 'global' && <Pill tone="info">{vendor.region.toUpperCase()}</Pill>}
      </div>
      {vendor.desc && <div style={{ fontSize: 11.5, color: 'var(--text-soft)', lineHeight: 1.5 }}>{vendor.desc}</div>}
      {Array.isArray(vendor.keyFeatures) && vendor.keyFeatures.length > 0 && (
        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.5 }}>
          {vendor.keyFeatures.slice(0, 3).map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
      {vendor.url && (
        <a
          href={vendor.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
        >
          Learn more →
        </a>
      )}
    </div>
  );
}

const PROPOSAL_STATUS_TONE = {
  drafted: 'neutral',
  submitted: 'warn',
  accepted: 'ok',
  declined: 'risk',
  countered: 'accent',
  withdrawn: 'neutral',
};

const PROPOSAL_CATEGORY_LABEL = {
  cadence_change: 'Cadence change',
  scope_expansion: 'Scope expansion',
  new_service: 'New service',
  innovation_partner: 'Innovation partner',
  other: 'Other',
};

function ProposalRow({ proposal, contract, isContractor }) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState(null);
  const [decisionNote, setDecisionNote] = useState(proposal.decision_note || '');
  const [counterValue, setCounterValue] = useState(proposal.counter_value ?? '');
  const [counterNote, setCounterNote] = useState(proposal.counter_note || '');
  // Vendor lookup — `useVendors()` is a single shared subscription
  // already used by Innovate, so this is a cheap re-read of an
  // in-memory list.
  const vendors = useVendors();
  const attachedVendor =
    proposal.vendor_id && Array.isArray(vendors) ? vendors.find((v) => v.id === proposal.vendor_id) || null : null;

  const isManager = !isContractor;

  // Re-sync editor state when the underlying row changes from realtime
  // (FM submitting a counter while contractor has the row open, etc.)
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

  async function deleteIt() {
    if (!(await confirmDialog({ body: 'Delete this draft proposal? This can’t be undone.', danger: true }))) return;
    setActing(true);
    try {
      await deleteContractProposal(proposal.id);
    } catch (e) {
      setError(e?.message || String(e));
      setActing(false);
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface-2)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <Icon.sparkle size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {proposal.title || '(Untitled proposal)'}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
            {PROPOSAL_CATEGORY_LABEL[proposal.category] || proposal.category}
            {attachedVendor && (
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                {' '}
                {' · '}with {attachedVendor.name}
              </span>
            )}
            {proposal.monthly_value_delta != null && (
              <span>
                {' '}
                {' · '} {Number(proposal.monthly_value_delta) >= 0 ? '+' : ''}
                {Number(proposal.monthly_value_delta).toLocaleString()} {proposal.currency || 'USD'}/mo
              </span>
            )}
            {' · '}
            {new Date(proposal.created_at).toLocaleDateString()}
          </div>
        </div>
        <Pill tone={PROPOSAL_STATUS_TONE[proposal.status] || 'neutral'}>{proposal.status}</Pill>
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-dim)',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div
          style={{
            padding: 10,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
            {proposal.body}
          </div>
          {attachedVendor && (
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
              <ProposalVendorCard vendor={attachedVendor} />
            </div>
          )}
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

          {/* History — show decision/counter details when present */}
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
                Client {proposal.status} ·{' '}
                {proposal.decided_at ? new Date(proposal.decided_at).toLocaleDateString() : ''}
              </div>
              {/* Phase 8.5 — surface contract auto-amendment so the
                  contractor sees the chain explicitly: their proposal
                  was accepted AND the contract terms updated. */}
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
                    Contract auto-amended {Number(proposal.monthly_value_delta) > 0 ? '+' : ''}
                    {Number(proposal.monthly_value_delta).toLocaleString()}{' '}
                    {proposal.currency || contract?.currency || 'USD'}/mo
                  </div>
                )}
              {proposal.decision_note && (
                <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                  {proposal.decision_note}
                </div>
              )}
              {proposal.status === 'countered' && (proposal.counter_value != null || proposal.counter_note) && (
                <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-soft)' }}>
                  {proposal.counter_value != null && (
                    <div>
                      Counter value: {Number(proposal.counter_value).toLocaleString()} {proposal.currency || 'USD'}/mo
                    </div>
                  )}
                  {proposal.counter_note && (
                    <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{proposal.counter_note}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Contractor actions on their own proposal */}
          {isContractor && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {proposal.status === 'drafted' && (
                <>
                  <button
                    onClick={() => flip({ status: 'submitted' })}
                    disabled={acting}
                    style={{
                      ...reportButtonStyle(acting),
                      background: 'var(--accent)',
                      color: '#fff',
                      borderColor: 'var(--accent)',
                    }}
                  >
                    <Icon.send size={11} /> Submit to client
                  </button>
                  <button
                    onClick={deleteIt}
                    disabled={acting}
                    style={{
                      ...reportButtonStyle(acting),
                      background: 'var(--surface)',
                      color: 'var(--risk)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    Delete draft
                  </button>
                </>
              )}
              {proposal.status === 'submitted' && (
                <button
                  onClick={() => flip({ status: 'withdrawn' })}
                  disabled={acting}
                  style={{ ...reportButtonStyle(acting), background: 'var(--surface)', color: 'var(--text-dim)' }}
                >
                  Withdraw
                </button>
              )}
              {proposal.status === 'countered' && (
                <button
                  onClick={() => flip({ status: 'submitted' })}
                  disabled={acting}
                  style={{
                    ...reportButtonStyle(acting),
                    background: 'var(--accent)',
                    color: '#fff',
                    borderColor: 'var(--accent)',
                  }}
                >
                  <Icon.send size={11} /> Re-submit (accept counter)
                </button>
              )}
            </div>
          )}

          {/* Manager actions on a submitted proposal */}
          {isManager && proposal.status === 'submitted' && (
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
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--warn)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.15,
                }}
              >
                Decision
              </div>
              <textarea
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="Optional note to the contractor explaining your decision."
                rows={2}
                style={{ ...inputStyle(), resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => flip({ status: 'accepted', decision_note: decisionNote || null })}
                  disabled={acting}
                  style={{
                    ...reportButtonStyle(acting),
                    background: 'var(--ok)',
                    color: '#fff',
                    borderColor: 'var(--ok)',
                  }}
                >
                  <Icon.check size={11} /> Accept
                </button>
                <button
                  onClick={() => flip({ status: 'declined', decision_note: decisionNote || null })}
                  disabled={acting}
                  style={{
                    ...reportButtonStyle(acting),
                    background: 'var(--risk)',
                    color: '#fff',
                    borderColor: 'var(--risk)',
                  }}
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
                    placeholder={`Counter value (${proposal.currency || 'USD'}/mo)`}
                    style={inputStyle()}
                  />
                  <textarea
                    value={counterNote}
                    onChange={(e) => setCounterNote(e.target.value)}
                    placeholder="Counter terms — what you'd accept instead."
                    rows={2}
                    style={{ ...inputStyle(), resize: 'vertical' }}
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
                    style={{
                      ...reportButtonStyle(acting),
                      background: 'var(--accent)',
                      color: '#fff',
                      borderColor: 'var(--accent)',
                    }}
                  >
                    Send counter-proposal
                  </button>
                </div>
              </details>
            </div>
          )}

          {error && <div style={{ fontSize: 11.5, color: 'var(--risk)' }}>{error}</div>}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.15,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, padding: '4px 0', fontSize: 12.5 }}>
      <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

// Internal components imported back by ContractorApp's contracts dashboard.
export { ContractDetail, ReportsSection, ProposalsSection };
