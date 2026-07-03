// PrintReportPage — Phase 8.6 of the contractor intelligence loop.
//
// Standalone, chrome-less view of a single contract_report sized for
// printing or "Save as PDF" via the browser's native Print dialog.
// Reachable at /print/report/<uuid>; the App.jsx router takes over
// when the path matches and renders this instead of the normal shell.
//
// Why this approach over jsPDF / server-side rendering: the snapshot
// is already the source of truth on the row, so re-render with print
// CSS is the cheapest path. Browser → Print → Save as PDF gives
// pixel-fidelity to whatever the user is looking at on the inbox row;
// no font drift, no missing chart libs in a headless render.
//
// RLS continues to gate the fetch — the contractor + manager party
// orgs read; everyone else 404s. Sharing the URL externally without
// a session lands on "Couldn't load report".

import React, { useEffect } from 'react';
import { useContractReport } from './queries/reports.ts';
import { ContractSlaRow, ReportPilotRow } from './ContractorApp.jsx';

export function PrintReportPage({ reportId }) {
  const { data: report, error } = useContractReport(reportId);

  // Set the page title from the loaded report — drives the saved-PDF filename.
  useEffect(() => {
    if (!report) return;
    try {
      const c = report.contract?.name || 'Contract';
      const period =
        report.period === 'monthly'
          ? report.period_start.slice(0, 7)
          : `${report.period_start} to ${report.period_end}`;
      document.title = `${c} — ${report.period} report ${period}`;
    } catch {}
  }, [report]);

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ padding: 32, textAlign: 'center', color: '#7a1a1a' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Couldn't load report</div>
          <div style={{ fontSize: 13 }}>{error.message}</div>
        </div>
      </div>
    );
  }
  if (!report) {
    return (
      <div style={pageStyle}>
        <div style={{ padding: 32, textAlign: 'center', color: '#7a7a7a', fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  const snapshot = report.snapshot || {};
  const slas = Array.isArray(snapshot.slas) ? snapshot.slas : [];
  const acceptedProposals = Array.isArray(snapshot.accepted_proposals) ? snapshot.accepted_proposals : [];
  const activePriorPilots = Array.isArray(snapshot.active_prior_pilots) ? snapshot.active_prior_pilots : [];
  const contract = report.contract;

  const periodLabel =
    report.period === 'weekly'
      ? `Week of ${report.period_start}`
      : report.period === 'monthly'
        ? `Month of ${formatYearMonth(report.period_start)}`
        : `${report.period_start} → ${report.period_end}`;

  return (
    <div style={pageStyle}>
      <PrintCss />
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '32px 36px',
        }}
      >
        <div
          className="merlin-print-noprint"
          style={{ marginBottom: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}
        >
          <button onClick={() => window.print()} style={primaryBtnStyle}>
            Print / Save as PDF
          </button>
          <button onClick={() => window.close()} style={secondaryBtnStyle}>
            Close
          </button>
        </div>

        <header style={{ borderBottom: '2px solid #1a1a1a', paddingBottom: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#666', fontWeight: 700 }}>
            Performance report · {report.period}
          </div>
          <h1 style={{ margin: '4px 0 8px', fontSize: 24, fontWeight: 700, lineHeight: 1.15 }}>
            {contract?.name || 'Contract'}
          </h1>
          <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>
            <div>
              <strong>Period:</strong> {periodLabel}
            </div>
            <div>
              <strong>From:</strong> {report.contractor_org?.name || 'Contractor'}
            </div>
            <div>
              <strong>To:</strong> {report.manager_org?.name || 'Client'}
            </div>
            <div>
              <strong>Status:</strong> {report.status}
              {report.sent_at ? ` · sent ${new Date(report.sent_at).toLocaleDateString()}` : ''}
            </div>
            <div style={{ color: '#888', fontSize: 11.5, marginTop: 4 }}>
              Generated {new Date(report.generated_at).toLocaleString()} · {snapshot.location_count ?? '—'} location
              {snapshot.location_count === 1 ? '' : 's'}
              {snapshot.serviced_area_count > snapshot.location_count
                ? ` · ${snapshot.serviced_area_count} serviced areas`
                : ''}
            </div>
          </div>
        </header>

        <Section title={`SLA performance (${slas.length})`}>
          {slas.length === 0 ? (
            <div style={mutedStyle}>No SLAs in scope at the time of this report.</div>
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
        </Section>

        {acceptedProposals.length > 0 && (
          <Section title={`Innovation pilots accepted this period (${acceptedProposals.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {acceptedProposals.map((p) => (
                <ReportPilotRow key={p.id} pilot={p} />
              ))}
            </div>
          </Section>
        )}

        {activePriorPilots.length > 0 && (
          <Section title={`Active pilots from prior periods (${activePriorPilots.length})`}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 6, lineHeight: 1.5 }}>
              Pilots accepted before this period and still within the 90-day attribution window. Each shows the
              cumulative impact since acceptance.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activePriorPilots.map((p) => (
                <ReportPilotRow key={p.id} pilot={p} variant="prior" />
              ))}
            </div>
          </Section>
        )}

        <Section title="Narrative">
          <div
            style={{
              padding: 14,
              fontSize: 12.5,
              lineHeight: 1.65,
              color: report.contractor_note ? '#1a1a1a' : '#999',
              fontStyle: report.contractor_note ? 'normal' : 'italic',
              background: '#fafafa',
              border: '1px solid #ddd',
              borderRadius: 4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {report.contractor_note || 'No narrative provided.'}
          </div>
        </Section>

        <footer
          style={{
            marginTop: 28,
            paddingTop: 12,
            borderTop: '1px solid #ccc',
            fontSize: 10,
            color: '#999',
            textAlign: 'center',
          }}
        >
          Generated by Merlin · merlin.adaptiv.systems · Report ID {report.id}
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 24 }} className="merlin-print-section">
      <h2
        style={{
          margin: '0 0 8px',
          fontSize: 14,
          fontWeight: 700,
          color: '#1a1a1a',
          borderBottom: '1px solid #1a1a1a',
          paddingBottom: 4,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function formatYearMonth(iso) {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  if (!y || !m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx] || m} ${y}`;
}

const pageStyle = {
  minHeight: '100vh',
  background: '#fff',
  color: '#1a1a1a',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const mutedStyle = { fontSize: 12, color: '#888', fontStyle: 'italic' };

const primaryBtnStyle = {
  padding: '8px 14px',
  fontSize: 12.5,
  fontWeight: 700,
  background: '#1a1a1a',
  color: '#fff',
  border: '1px solid #1a1a1a',
  borderRadius: 6,
  cursor: 'pointer',
};
const secondaryBtnStyle = {
  padding: '8px 14px',
  fontSize: 12.5,
  fontWeight: 600,
  background: '#fff',
  color: '#1a1a1a',
  border: '1px solid #ccc',
  borderRadius: 6,
  cursor: 'pointer',
};

// Inline print stylesheet — we want to keep this completely
// self-contained so the route doesn't have to opt out of the global
// app CSS. Hides the header buttons + a few app shell selectors that
// might leak through (sidebar, chat panel) in case the route is
// rendered inside the normal tree by mistake.
function PrintCss() {
  const css = `
    @media print {
      .merlin-print-noprint { display: none !important; }
      body { background: #fff !important; }
      .merlin-print-section { break-inside: avoid; page-break-inside: avoid; }
      h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
      @page { margin: 14mm; }
    }
  `;
  return <style>{css}</style>;
}
