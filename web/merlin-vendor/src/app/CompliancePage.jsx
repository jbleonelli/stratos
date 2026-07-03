// ANTICIPATE → Compliance. The building's standing against the codes,
// regulations and certifications it must hold: what's compliant, what's drifting
// toward a breach, what's DUE, what's MISSING (the gap), and what Merlin
// proposes you may owe. Sibling to ForecastPage + PredictMaintenancePage.
//
// Real data: building_compliance_overview(location_id) resolves the catalog by
// the building's jurisdiction × occupancy × systems, so Meridian HQ shows US
// frameworks (NFPA/ASHRAE/ADA…) and Campus PSG shows French ones (ERP/ARS/HACCP…).
// Gaps = applicable obligations the building doesn't hold. Merlin-proposed items
// ride a confirm/dismiss lane. Buildings with no compliance profile show an
// honest empty state. Source of truth: compliance-data.js + the catalog tables.

import React from 'react';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { useT } from './i18n.js';
import { useFormatTime } from './locale-format.js';
import {
  useBuildingCompliance,
  useBuildingDocuments,
  useComplianceAudits,
  confirmComplianceItem,
  dismissComplianceItem,
  proposeComplianceItems,
  linkComplianceEvidence,
  scheduleComplianceAudit,
  cancelComplianceAudit,
  complianceTone,
  daysUntil,
} from './compliance-data.js';
import { alertDialog, promptDialog, confirmDialog } from './dialogs.jsx';

export function CompliancePage({ building, onOpenChat }) {
  const t = useT();
  const fmtTime = useFormatTime();
  const bName = building?.name || 'this building';
  const { rows, loaded, reload } = useBuildingCompliance(building?.id);
  const { docs, reload: reloadDocs } = useBuildingDocuments(building?.id);
  const { audits, reload: reloadAudits } = useComplianceAudits(building?.id);

  // Re-pull compliance rows, the doc list AND scheduled audits after any change.
  const reloadAll = React.useCallback(async () => {
    await Promise.all([reload(), reloadDocs(), reloadAudits()]);
  }, [reload, reloadDocs, reloadAudits]);

  // Obligation name lookup for the audits list (audits carry bc_id, not name).
  const nameByBcId = React.useMemo(() => {
    const m = new Map();
    rows.forEach((r) => r.bc_id && m.set(r.bc_id, r.name));
    return m;
  }, [rows]);

  // Live tick — keeps the "Updated" stamp feeling like a live watch.
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Open chat AND send so a card click yields a grounded Merlin answer.
  const ask = (q) => onOpenChat?.(q, { send: true });

  // Phase 2b — Merlin researches the building's profile and proposes obligations
  // it may be missing, into the suggest lane below. Server-side LLM call; nothing
  // is auto-applied (each lands as a confirm/dismiss proposal).
  const [researching, setResearching] = React.useState(false);
  const research = async () => {
    if (researching || !building?.id) return;
    setResearching(true);
    try {
      const { proposed } = await proposeComplianceItems(building.id);
      await reload();
      await alertDialog({
        title: proposed > 0 ? 'Merlin found possible gaps' : 'Nothing new to flag',
        body:
          proposed > 0
            ? `Merlin proposed ${proposed} requirement${proposed === 1 ? '' : 's'} ${bName} may owe. Review them under “Merlin suggests” — confirm to track, or dismiss.`
            : `Merlin reviewed ${bName}'s profile and didn't find any additional well-established requirements beyond what's already tracked.`,
      });
    } catch (err) {
      const msg =
        err?.message === 'spend_cap_reached'
          ? 'Merlin has hit its AI spend cap for now — try again shortly.'
          : err?.message === 'no_profile'
            ? `${bName} has no compliance profile yet, so there's nothing to research against.`
            : 'Merlin could not complete the research just now. Please try again.';
      await alertDialog({ title: 'Research unavailable', body: msg });
    } finally {
      setResearching(false);
    }
  };

  // Split the rows: Merlin's unconfirmed proposals vs the tracked record.
  const proposed = rows.filter((r) => r.source === 'merlin_proposed' && !r.confirmed);
  const tracked = rows.filter((r) => !(r.source === 'merlin_proposed' && !r.confirmed));
  const obligations = tracked.filter((r) => r.scope === 'obligation' && r.status !== 'missing');
  const certifications = tracked.filter((r) => r.scope === 'certification' && r.status !== 'missing');
  const gaps = tracked.filter((r) => r.status === 'missing');

  // KPIs from the real picture.
  const compliant = tracked.filter((r) => r.status === 'compliant' || r.status === 'certified').length;
  const attention = tracked.filter((r) => ['action', 'review', 'in_progress'].includes(r.status)).length;
  const dueSorted = tracked
    .filter((r) => r.next_due && r.status !== 'missing')
    .sort((a, b) => new Date(a.next_due) - new Date(b.next_due));
  const nextDueDays = dueSorted.length ? daysUntil(dueSorted[0].next_due) : null;

  const hasProfile = loaded && rows.length > 0;

  return (
    <main style={{ flex: 1, overflow: 'auto', padding: 12, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                  fontWeight: 700,
                }}
              >
                {t('predict.comp.eyebrow')}
              </div>
              {hasProfile && <LiveStamp t={t} tick={tick} fmtTime={fmtTime} />}
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: -0.02,
                lineHeight: 1.15,
                color: 'var(--text)',
              }}
            >
              {t('predict.comp.title')}
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.5, maxWidth: 760 }}>
              {t('predict.comp.intro', { building: bName })}
            </p>
          </div>
          {hasProfile && <ResearchButton onClick={research} busy={researching} />}
        </div>

        {!loaded ? (
          <Card style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Loading…</Card>
        ) : !hasProfile ? (
          <Card style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>
            Compliance isn&rsquo;t set up for <strong>{bName}</strong> yet. Once the building&rsquo;s jurisdiction,
            occupancy class and systems are profiled, Merlin maps the obligations and certifications it must hold — then
            flags what&rsquo;s missing and tracks every renewal.
          </Card>
        ) : (
          <>
            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <Kpi label="Compliant" value={compliant} sub="obligations & certs in good standing" tone="ok" />
              <Kpi
                label="Needs attention"
                value={attention}
                sub="at-risk, in review or in progress"
                tone={attention > 0 ? 'warn' : 'ok'}
              />
              <Kpi
                label="Gaps"
                value={gaps.length}
                sub="required but not held"
                tone={gaps.some((g) => g.scope === 'obligation') ? 'risk' : 'ok'}
              />
              <Kpi
                label="Next due"
                value={nextDueDays == null ? '—' : nextDueDays < 0 ? `${-nextDueDays}d` : `${nextDueDays}d`}
                sub={nextDueDays != null && nextDueDays < 0 ? 'overdue' : 'until the next deadline'}
                tone={nextDueDays != null && nextDueDays <= 7 ? 'warn' : 'ok'}
              />
            </div>

            {/* Merlin suggests — unconfirmed proposals (the AI-assist lane) */}
            {proposed.length > 0 && (
              <>
                <SectionLabel icon="sparkle">Merlin suggests — confirm to track</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
                  {proposed.map((p) => (
                    <ProposalCard key={p.bc_id} row={p} onReload={reload} />
                  ))}
                </div>
              </>
            )}

            {/* Gaps — what you're missing (the headline value) */}
            {gaps.length > 0 && (
              <>
                <SectionLabel icon="warn">What you&rsquo;re missing</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                  {gaps.map((g) => {
                    const tone = complianceTone(g.status, g.scope);
                    const tc = toneColor(tone);
                    return (
                      <Clickable
                        key={g.bc_id || g.catalog_id || g.name}
                        onClick={() =>
                          ask(
                            t('predict.comp.ask.close_gap', {
                              name: g.name,
                              building: bName,
                              kind:
                                g.scope === 'certification'
                                  ? t('predict.comp.ask.kind.cert')
                                  : t('predict.comp.ask.kind.obligation'),
                              detail: g.description || g.area || '',
                            }),
                          )
                        }
                      >
                        <Card pad interactive style={{ height: '100%', borderLeft: `3px solid ${tc}` }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 10,
                              marginBottom: 6,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              {g.code && (
                                <div
                                  style={{
                                    fontSize: 10.5,
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                    color: 'var(--text-faint)',
                                    fontWeight: 700,
                                  }}
                                >
                                  {g.authority || g.jurisdiction}
                                </div>
                              )}
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                                {g.name}
                              </div>
                            </div>
                            <Pill tone={tone} label={g.scope === 'certification' ? 'not held' : 'missing'} />
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
                            {g.description || g.area}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 10,
                              paddingTop: 10,
                              borderTop: '1px solid var(--border)',
                            }}
                          >
                            <Icon.sparkle size={11} style={{ color: 'var(--accent)' }} />
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)' }}>
                              Ask Merlin how to close this
                            </span>
                          </div>
                        </Card>
                      </Clickable>
                    );
                  })}
                </div>
              </>
            )}

            {/* Regulatory obligations held */}
            <SectionLabel icon="badge">{t('predict.comp.sec.obligations')}</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
              {obligations.map((c) => {
                const tone = complianceTone(c.status, c.scope);
                const tc = toneColor(tone);
                const dd = daysUntil(c.next_due);
                return (
                  <Clickable
                    key={c.bc_id || c.catalog_id || c.name}
                    onClick={() =>
                      ask(
                        t('predict.comp.ask.where_stand', {
                          name: c.name,
                          building: bName,
                          status: c.status,
                          noteSuffix: c.note ? ` — ${c.note}` : '',
                        }),
                      )
                    }
                  >
                    <Card
                      pad
                      interactive
                      style={{
                        height: '100%',
                        ...(tone === 'risk' || tone === 'warn' ? { borderLeft: `3px solid ${tc}` } : null),
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 10,
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 10.5,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: 'var(--text-faint)',
                              fontWeight: 700,
                            }}
                          >
                            {c.authority || c.jurisdiction}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                            {c.name}
                          </div>
                        </div>
                        <Pill tone={tone} label={statusLabel(c.status)} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
                        {c.note || c.area}
                      </div>
                      {c.next_due && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: '1px solid var(--border)',
                          }}
                        >
                          <Icon.bell size={11} style={{ color: tc }} />
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: tc }}>{dueLabel(dd)}</span>
                        </div>
                      )}
                    </Card>
                  </Clickable>
                );
              })}
            </div>

            {/* Certifications & ratings */}
            {certifications.length > 0 && (
              <>
                <SectionLabel icon="badge">{t('predict.comp.sec.certs')}</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {certifications.map((c) => {
                    const tone = complianceTone(c.status, c.scope);
                    const tc = toneColor(tone);
                    return (
                      <Clickable
                        key={c.bc_id || c.catalog_id || c.name}
                        onClick={() =>
                          ask(t('predict.comp.ask.tell_cert', { name: c.name, building: bName, note: c.note || '' }))
                        }
                      >
                        <Card pad interactive style={{ height: '100%' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 10,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{c.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>
                                {c.authority}
                              </div>
                            </div>
                            {c.pct != null && <ProgressRing pct={c.pct} tone={tone} />}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                            {c.level && <span style={{ fontSize: 12.5, fontWeight: 700, color: tc }}>{c.level}</span>}
                            {c.score && <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>· {c.score}</span>}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <Pill tone={tone} label={statusLabel(c.status)} />
                          </div>
                          {c.note && (
                            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
                              {c.note}
                            </div>
                          )}
                        </Card>
                      </Clickable>
                    );
                  })}
                </div>
              </>
            )}

            {/* Upcoming deadlines */}
            {dueSorted.length > 0 && (
              <Card pad>
                <SectionLabel icon="bell" inline>
                  {t('predict.comp.sec.upcoming')}
                </SectionLabel>
                <div style={{ marginTop: 10 }}>
                  {dueSorted.slice(0, 8).map((d, i) => {
                    const tone = complianceTone(d.status, d.scope);
                    const dd = daysUntil(d.next_due);
                    return (
                      <div
                        key={d.bc_id || d.catalog_id || d.name}
                        role="button"
                        tabIndex={0}
                        onClick={() => ask(t('predict.comp.ask.when_due', { name: d.name, building: bName }))}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault();
                            ask(t('predict.comp.ask.when_due', { name: d.name, building: bName }));
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 4px',
                          borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                          cursor: 'pointer',
                          borderRadius: 6,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: toneColor(tone),
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{d.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                            {d.authority || d.area}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: 'var(--mono)',
                            color: toneColor(tone),
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {dueLabel(dd)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Scheduled compliance audits (inspections, type=compliance). */}
            <AuditsSection audits={audits} nameByBcId={nameByBcId} onReload={reloadAll} />

            {/* Reference — every applicable regulation & certification explained:
                what it is, what it requires, why it lands on THIS building, and
                the consequence of letting it lapse. The depth that turns the
                tracker into something an FM can defend to an inspector. */}
            {tracked.some((r) => r.what_it_is) && (
              <>
                <SectionLabel icon="badge">Reference — every requirement explained</SectionLabel>
                <p
                  style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--text-dim)', maxWidth: 760, lineHeight: 1.5 }}
                >
                  What each code and certification is, what it demands, and why it applies to {bName}. Curated reference
                  — not legal advice.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {tracked
                    .filter((r) => r.what_it_is)
                    .sort(
                      (a, b) =>
                        (a.scope === 'certification') - (b.scope === 'certification') ||
                        String(a.name).localeCompare(String(b.name)),
                    )
                    .map((r) => (
                      <ReferenceEntry
                        key={r.bc_id || r.catalog_id || r.name}
                        row={r}
                        bName={bName}
                        onAsk={ask}
                        docs={docs}
                        onReload={reloadAll}
                      />
                    ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// One reference entry — the full write-up for a regulation/certification.
function ReferenceEntry({ row, bName, onAsk, docs, onReload }) {
  const tone = complianceTone(row.status, row.scope);
  const tc = toneColor(tone);
  const dd = daysUntil(row.next_due);
  return (
    <Card pad style={{ borderLeft: `3px solid ${tc}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              fontWeight: 700,
            }}
          >
            {row.authority || row.jurisdiction} · {row.scope === 'certification' ? 'Certification' : 'Obligation'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{row.name}</div>
        </div>
        <Pill tone={tone} label={statusLabel(row.status)} />
      </div>

      <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.55 }}>{row.what_it_is}</p>

      {/* Why it applies HERE — computed from the building's own profile tags. */}
      <div
        style={{
          marginTop: 10,
          padding: '8px 10px',
          background: 'color-mix(in oklch, var(--accent) 6%, transparent)',
          border: '1px solid color-mix(in oklch, var(--accent) 22%, transparent)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--text-soft)',
          lineHeight: 1.5,
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>Why it applies to {bName}: </span>
        {whyApplies(row, bName)}
      </div>

      {Array.isArray(row.requirements) && row.requirements.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <RefHeading>What it requires</RefHeading>
          <ul
            style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.6 }}
          >
            {row.requirements.map((req, i) => (
              <li key={i}>{req}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Meta row: cadence · evidence · consequence. */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 10,
        }}
      >
        <RefMeta label="Cadence" value={cadenceLabel(row.cadence_months)} />
        {row.default_evidence && <RefMeta label="Evidence to keep" value={row.default_evidence} />}
        {row.next_due && <RefMeta label="Next due" value={dueLabel(dd)} valueColor={tc} />}
        {row.consequence && <RefMeta label="If it lapses" value={row.consequence} />}
      </div>

      {/* Evidence on file — the proof this requirement is met (held items only). */}
      {row.held && <EvidenceRow row={row} docs={docs} onReload={onReload} />}

      {/* Schedule an audit/inspection — obligations only. */}
      {row.scope === 'obligation' && <AuditControl row={row} onReload={onReload} />}

      <button
        onClick={() =>
          onAsk(
            `Explain ${row.name} for ${bName} in practical terms — what it requires, where we stand (${row.status}), and the next steps.`,
          )
        }
        style={{
          marginTop: 12,
          background: 'transparent',
          border: 'none',
          padding: 0,
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--accent)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <Icon.sparkle size={11} /> Ask Merlin to go deeper
      </button>
    </Card>
  );
}

// Evidence-on-file line for a held requirement: shows the linked proof (a stored
// document — openable when it has a URL — or an external link) and lets the
// operator link, change or remove it.
function EvidenceRow({ row, docs, onReload }) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const hasDoc = Boolean(row.evidence_doc_id && row.evidence_doc_title);
  const hasUrl = !hasDoc && Boolean(row.evidence_url);
  const linked = hasDoc || hasUrl;

  const apply = async (patch) => {
    setBusy(true);
    setPickerOpen(false);
    try {
      await linkComplianceEvidence(row.bc_id, patch);
      await onReload?.();
    } finally {
      setBusy(false);
    }
  };
  const pasteUrl = async () => {
    const url = await promptDialog({
      title: 'Link an external document',
      body: 'Paste the URL of the evidence (e.g. a SharePoint or Drive link).',
      placeholder: 'https://…',
    });
    if (url && /^https?:\/\//i.test(url.trim())) await apply({ url: url.trim() });
  };

  const docTitle = hasDoc ? row.evidence_doc_title : null;
  const openHref = hasDoc ? row.evidence_doc_url : hasUrl ? row.evidence_url : null;

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      <Icon.agreement size={13} style={{ color: linked ? 'var(--ok, #10b981)' : 'var(--text-faint)', flexShrink: 0 }} />
      {linked ? (
        <span style={{ fontSize: 12, color: 'var(--text-soft)', minWidth: 0 }}>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>Evidence on file:</span>{' '}
          {openHref ? (
            <a href={openHref} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 700 }}>
              {docTitle || 'External document'} ↗
            </a>
          ) : (
            <span style={{ color: 'var(--text)' }}>{docTitle}</span>
          )}
        </span>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>No evidence linked</span>
      )}
      <span style={{ flex: 1 }} />
      <button onClick={() => setPickerOpen(true)} disabled={busy} style={evidenceLinkBtnStyle}>
        {linked ? 'Change' : 'Link evidence'}
      </button>
      {linked && (
        <button onClick={() => apply({})} disabled={busy} style={{ ...evidenceLinkBtnStyle, color: 'var(--text-dim)' }}>
          Remove
        </button>
      )}
      {pickerOpen && (
        <EvidencePicker
          docs={docs}
          onPick={(id) => apply({ docId: id })}
          onPasteUrl={pasteUrl}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

const evidenceLinkBtnStyle = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--accent)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

// Compact modal to choose a stored document (or paste an external link) as
// evidence. Org-scoped doc list comes from useBuildingDocuments.
function EvidencePicker({ docs, onPick, onPasteUrl, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, 100%)',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 800, fontSize: 14 }}>
          Link evidence
        </div>
        <div style={{ overflow: 'auto', padding: 8 }}>
          {docs.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12.5, color: 'var(--text-dim)', textAlign: 'center' }}>
              No documents stored for this building yet.
            </div>
          ) : (
            docs.map((d) => (
              <button
                key={d.id}
                onClick={() => onPick(d.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 10px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: 'var(--text)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{d.title}</div>
                {d.category && (
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>{d.category}</div>
                )}
              </button>
            ))
          )}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button onClick={onPasteUrl} style={{ ...evidenceLinkBtnStyle }}>
            Paste an external link…
          </button>
          <button onClick={onClose} style={{ ...evidenceLinkBtnStyle, color: 'var(--text-dim)' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// "Schedule audit" affordance under a Reference obligation. Opens a date picker;
// writes through the schedule_compliance_audit RPC (org-guarded server-side).
function AuditControl({ row, onReload }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const submit = async (dateStr, inspector) => {
    setBusy(true);
    setOpen(false);
    try {
      await scheduleComplianceAudit(row.bc_id, dateStr, inspector);
      await onReload?.();
    } catch (err) {
      await alertDialog({
        title: 'Could not schedule',
        body: err?.message === 'forbidden' ? 'You do not have access to schedule this audit.' : 'Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={busy}
        style={{
          marginTop: 10,
          marginRight: 14,
          background: 'transparent',
          border: 'none',
          padding: 0,
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--accent)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <Icon.schedule size={12} /> Schedule audit
      </button>
      {open && (
        <ScheduleAuditModal
          defaultDate={row.next_due || ''}
          obligation={row.name}
          onSubmit={submit}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// Date + inspector picker for scheduling a compliance audit.
function ScheduleAuditModal({ defaultDate, obligation, onSubmit, onClose }) {
  const [date, setDate] = React.useState(defaultDate || '');
  const [inspector, setInspector] = React.useState('');
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Schedule audit</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{obligation}</div>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-soft)' }}>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={auditInputStyle} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-soft)' }}>
            Inspector / body <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(optional)</span>
            <input
              type="text"
              value={inspector}
              placeholder="e.g. AHJ Fire Marshal, third-party auditor…"
              onChange={(e) => setInspector(e.target.value)}
              style={auditInputStyle}
            />
          </label>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button onClick={onClose} style={{ ...evidenceLinkBtnStyle, color: 'var(--text-dim)' }}>
            Cancel
          </button>
          <button
            onClick={() => date && onSubmit(date, inspector)}
            disabled={!date}
            style={{ ...evidenceLinkBtnStyle, opacity: date ? 1 : 0.4 }}
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

const auditInputStyle = {
  display: 'block',
  width: '100%',
  marginTop: 5,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

// The building's scheduled compliance audits (inspections, type=compliance),
// each tied to an obligation. Cancel removes a still-scheduled one.
function AuditsSection({ audits, nameByBcId, onReload }) {
  const [busyId, setBusyId] = React.useState(null);
  if (!audits || audits.length === 0) return null;

  const cancel = async (id) => {
    if (!(await confirmDialog({ title: 'Cancel this audit?', body: 'It will be removed from the schedule.' }))) return;
    setBusyId(id);
    try {
      await cancelComplianceAudit(id);
      await onReload?.();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card pad>
      <SectionLabel icon="schedule" inline>
        Scheduled audits
      </SectionLabel>
      <div style={{ marginTop: 10 }}>
        {audits.map((a, i) => {
          const dd = daysUntil(typeof a.scheduled_for === 'string' ? a.scheduled_for.slice(0, 10) : null);
          const done = a.status !== 'scheduled';
          return (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 4px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <Icon.schedule size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {nameByBcId.get(a.building_compliance_id) || 'Compliance audit'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                  {a.inspector || 'Audit'}
                  {dd != null && ` · ${dd < 0 ? `${-dd}d ago` : dd === 0 ? 'today' : `in ${dd}d`}`}
                </div>
              </div>
              <Pill tone={done ? 'ok' : 'info'} label={a.result || a.status} />
              {!done && (
                <button
                  onClick={() => cancel(a.id)}
                  disabled={busyId === a.id}
                  style={{ ...evidenceLinkBtnStyle, color: 'var(--text-dim)' }}
                >
                  Cancel
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RefHeading({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--text-faint)',
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function RefMeta({ label, value, valueColor }) {
  return (
    <div>
      <RefHeading>{label}</RefHeading>
      <div style={{ fontSize: 12.5, color: valueColor || 'var(--text-soft)', lineHeight: 1.5, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

// Friendly labels for the profile tags that drive "why it applies".
const JURISDICTION_LABEL = {
  'US-CA': 'California (US)',
  'US-NY': 'New York (US)',
  US: 'US federal',
  FR: 'France',
  ANY: '',
};
const OCCUPANCY_LABEL = {
  office: 'office building',
  campus: 'campus / ERP',
  healthcare: 'healthcare facility',
  assembly: 'assembly venue',
  warehouse: 'warehouse',
  financial: 'financial branch',
  any: 'building',
};
const SYSTEM_LABEL = {
  cooling_tower: 'a cooling tower',
  elevator: 'elevators',
  pool: 'a pool',
  kitchen: 'a commercial kitchen',
  sprinkler: 'a sprinkler system',
  generator: 'a standby generator',
};

// Compose a building-specific "why this applies" line from the catalog tags.
function whyApplies(row, bName) {
  const occ = OCCUPANCY_LABEL[row.occupancy_class] || 'building';
  const jur = JURISDICTION_LABEL[row.jurisdiction];
  const article = /^[aeiou]/i.test(occ) ? 'an' : 'a'; // "an office" but "a campus / a warehouse"
  const base =
    row.jurisdiction === 'ANY' || !jur
      ? `${bName} is ${article} ${occ}`
      : `${bName} is ${article} ${occ} under ${jur} rules`;
  const sys = row.requires_system
    ? `, and it operates ${SYSTEM_LABEL[row.requires_system] || 'the relevant system'}`
    : '';
  return `${base}${sys}${row.area ? ` — covering ${String(row.area).toLowerCase()}` : ''}.`;
}

function cadenceLabel(months) {
  if (!months) return 'Continuous / one-time';
  if (months === 1) return 'Monthly';
  if (months === 3) return 'Quarterly';
  if (months === 12) return 'Annual';
  if (months % 12 === 0) return `Every ${months / 12} years`;
  return `Every ${months} months`;
}

// Status → short pill label. (Catalog content is EN/FR by jurisdiction; the
// status word stays a stable, scannable English token across both.)
const STATUS_LABEL = {
  compliant: 'Compliant',
  review: 'Review',
  action: 'Action due',
  missing: 'Missing',
  in_progress: 'In progress',
  certified: 'Certified',
};
function statusLabel(status) {
  return STATUS_LABEL[status] || status;
}

// Days-until → short label.
function dueLabel(dd) {
  if (dd == null) return '';
  if (dd < 0) return `overdue ${-dd}d`;
  if (dd === 0) return 'due today';
  return `due in ${dd}d`;
}

// Merlin proposal card with Confirm / Dismiss.
function ProposalCard({ row, onReload }) {
  const [busy, setBusy] = React.useState(false);
  const act = async (fn) => {
    setBusy(true);
    await fn(row.bc_id);
    await onReload();
    setBusy(false);
  };
  return (
    <Card pad style={{ height: '100%', borderLeft: '3px solid var(--accent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Icon.sparkle size={12} style={{ color: 'var(--accent)' }} />
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            fontWeight: 800,
          }}
        >
          Merlin proposes
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{row.name}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
        {row.note || row.description}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          disabled={busy}
          onClick={() => act(confirmComplianceItem)}
          style={{
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit',
            opacity: busy ? 0.6 : 1,
          }}
        >
          Confirm &amp; track
        </button>
        <button
          disabled={busy}
          onClick={() => act(dismissComplianceItem)}
          style={{
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-soft)',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Dismiss
        </button>
      </div>
    </Card>
  );
}

// Live "Updated HH:MM · live" stamp with a pulsing dot.
// The Phase 2b affordance — ask Merlin to research the building's profile for
// obligations it may be missing. Sparkle + "Merlin" framing signals the AI act;
// disabled + spinner copy while the (server-side LLM) call is in flight.
function ResearchButton({ onClick, busy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '9px 14px',
        borderRadius: 10,
        border: '1px solid var(--accent)',
        background: busy ? 'var(--surface-2)' : 'var(--accent)',
        color: busy ? 'var(--text-soft)' : '#fff',
        fontSize: 13,
        fontWeight: 700,
        cursor: busy ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
        opacity: busy ? 0.85 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      <Icon.sparkle size={15} />
      {busy ? 'Merlin is researching…' : 'Find what I’m missing'}
    </button>
  );
}

function LiveStamp({ t, tick, fmtTime }) {
  // `tick` is intentional — it re-evaluates the clock every 30s.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const time = React.useMemo(() => fmtTime(new Date()), [tick, fmtTime]);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#10b981',
          color: '#10b981',
          animation: 'merlinPulse 2.4s ease-out infinite',
        }}
      />
      <span
        style={{
          fontSize: 10.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          fontWeight: 700,
        }}
      >
        {t('predict.comp.updated', { time })} · {t('predict.comp.live')}
      </span>
    </span>
  );
}

function Pill({ tone, label }) {
  const tc = toneColor(tone);
  return (
    <span
      style={{
        flexShrink: 0,
        padding: '2px 8px',
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        borderRadius: 999,
        color: tc,
        background: `color-mix(in oklch, ${tc} 13%, transparent)`,
        border: `1px solid color-mix(in oklch, ${tc} 34%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

// Clickable wrapper — onClick + keyboard + a subtle hover-lift.
function Clickable({ onClick, children, style }) {
  const [hover, setHover] = React.useState(false);
  if (!onClick) return children;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: '100%',
        borderRadius: 'var(--radius)',
        transition: 'transform .12s ease, box-shadow .12s ease',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 8px 22px color-mix(in oklch, var(--accent) 16%, transparent)' : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function toneColor(tone) {
  return tone === 'risk' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : tone === 'info' ? '#6366f1' : '#10b981';
}

// Progress ring for a certification — % toward the next level / recert.
function ProgressRing({ pct, tone }) {
  const color = toneColor(tone);
  const r = 18,
    c = 2 * Math.PI * r,
    dash = c * (pct / 100);
  return (
    <div style={{ position: 'relative', width: 46, height: 46, flexShrink: 0 }}>
      <svg width="46" height="46" viewBox="0 0 46 46">
        <circle cx="23" cy="23" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle
          cx="23"
          cy="23"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 23 23)"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 800,
          color: 'var(--text)',
        }}
      >
        {pct}%
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone = 'ok' }) {
  const elevated = tone === 'warn' || tone === 'risk';
  const accent = toneColor(tone);
  return (
    <Card pad style={elevated ? { borderLeft: `3px solid ${accent}` } : undefined}>
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', lineHeight: 1, letterSpacing: -0.02 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>{sub}</div>
    </Card>
  );
}

function SectionLabel({ icon, children, inline }) {
  const I = Icon[icon] || Icon.bolt;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: inline ? 0 : 4 }}>
      <I size={13} style={{ color: 'var(--accent)' }} />
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          fontWeight: 700,
        }}
      >
        {children}
      </div>
    </div>
  );
}
