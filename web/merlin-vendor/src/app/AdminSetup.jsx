// Admin — per-building Setup section: a drop zone where the operator uploads any
// document, Merlin classifies + extracts it (mocked client-side for the demo via
// MOCK_EXTRACT), the operator confirms, and it bumps Merlin-readiness (setup_progress).
// Extracted from Admin.jsx (G2 split). Exports SetupSection; SetupDocRow +
// SETUP_DOC_KINDS / MOCK_EXTRACT stay file-internal.

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Icon } from './icons.jsx';
import { Card } from './primitives.jsx';
import { ErrBanner } from './slas-ui.jsx';
import { useT } from './i18n.js';
import { useActiveOrg } from './org-data.js';
import { useBuildingsForActiveOrg } from './custom-locations.js';
import {
  fetchSetupProgress,
  markSection,
  computeReadiness,
  extractDocument,
  saveExtractedContract,
  normalizeWorkforceRows,
  saveWorkforce,
} from './setup-data.js';
import { sampleForFileName } from './setup-sample-docs.js';
import { SETUP_DEMO_DOCS } from './setup-demo-docs.js';

// Per-building Setup — redesigned (2026-06): one drop zone for ANY document.
// Merlin reads each file, classifies what it is, asks a clarifying question
// when unsure, then the operator confirms and it's "applied" to the building
// (added to an editable document list + bumps Merlin-readiness). Demo:
// the analyze/clarify steps are mocked client-side (no real /api/extract
// call) so the flow is reliable on stage for Meridian HQ; swap MOCK_ANALYZE
// for extractDocument() when wiring real extraction.
//
// Replaces the old 10-section checklist + per-section panels. setup_progress
// is still the persistence layer (readiness score), keyed by the doc kinds
// a confirmed document maps to.

// Map an uploaded file to what Merlin "understands" it as. Keyed loosely off
// the filename so a demo upload classifies believably; falls back to a
// rotating default so any file lands somewhere sensible.
const SETUP_DOC_KINDS = {
  contract: {
    labelKey: 'setup.v2.kind.contract',
    icon: 'shield',
    section: 'contracts',
    applies: 'SLAs, rate card + penalties',
  },
  sla: { labelKey: 'setup.v2.kind.sla', icon: 'sla', section: 'contracts', applies: 'service-level targets' },
  roster: { labelKey: 'setup.v2.kind.roster', icon: 'people', section: 'workforce', applies: 'team + certifications' },
  floorplan: {
    labelKey: 'setup.v2.kind.floorplan',
    icon: 'floor',
    section: 'spatial',
    applies: 'floors, zones + rooms',
  },
  devices: { labelKey: 'setup.v2.kind.devices', icon: 'grid', section: 'devices', applies: 'sensors bound to zones' },
  suppliers: { labelKey: 'setup.v2.kind.suppliers', icon: 'ship', section: 'suppliers', applies: 'vendor contacts' },
};

// Rich extracted-field sets per kind, shown in the doc-row preview as the
// "Merlin understood it" moment. A dropped SAMPLE file (exact filename match)
// uses its own canonical fields; any other file falls back to these.
const MOCK_EXTRACT = {
  contract: {
    Vendor: 'CleanCo Facilities Services',
    Service: 'Cleaning & hygiene',
    'Annual value': '$184,000',
    Term: '2026 → 2027 · auto-renew',
    'Rate card': '3 lines',
    Penalties: '2',
  },
  sla: {
    'Hygiene response': '< 20 min',
    'Comfort temp': '±2°C',
    'Air quality': 'CO₂ < 900 ppm',
    Supplies: '0 stockouts',
  },
  roster: { Headcount: '12 people', Trades: 'Cleaning, HVAC, Security', Certifications: '9 on file · 1 expiring' },
  floorplan: { Floors: '50', Zones: '18', Rooms: '~360', 'Mech rooms': '2' },
  devices: { Devices: '772', Kinds: '9', Online: '93%', Bound: 'to 18 zones' },
  suppliers: { Suppliers: '6', Trades: 'cleaning, HVAC, waste', Contacts: '6 on file' },
};

// Heuristic classifier (demo). Returns { kind, extracted, question? }.
// `question` (when present) is the clarifying step Merlin asks before the
// document can be confirmed — mimicking "asks to make sure it understood".
function mockAnalyze(fileName, idx) {
  // Exact sample match → use that sample's canonical kind/question/extracted.
  const sample = sampleForFileName(fileName);
  if (sample) return { kind: sample.kind, extracted: sample.extracted, question: sample.question };

  const n = String(fileName || '').toLowerCase();
  const pick = (kind, question) => ({ kind, extracted: MOCK_EXTRACT[kind], question });
  if (/sla|service.?level/.test(n)) return pick('sla', null);
  if (/contract|agreement|msa/.test(n))
    return pick('contract', 'Is this the renewal that supersedes the 2024 CleanCo contract, or a new vendor?');
  if (/roster|staff|team|workforce|hr/.test(n)) return pick('roster', null);
  if (/floor|plan|cad|dwg|spatial/.test(n))
    return pick(
      'floorplan',
      'Floor 32 appears twice in the plan — is the second one a mezzanine, or a labelling duplicate?',
    );
  if (/device|sensor|inventory|bom/.test(n)) return pick('devices', null);
  if (/supplier|vendor|procure/.test(n)) return pick('suppliers', null);
  // Fallback: rotate through a couple so any file classifies believably.
  const rot = ['contract', 'roster', 'devices'][idx % 3];
  return pick(rot, null);
}

export function SetupSection() {
  const t = useT();
  const org = useActiveOrg();
  const buildings = useBuildingsForActiveOrg();
  const targets = useMemo(
    () => Object.values(buildings || {}).filter((b) => b.kind === 'building' || b.kind === 'ecosystem'),
    [buildings],
  );
  const [selectedId, setSelectedId] = useState(null);
  const selected = targets.find((b) => b.id === selectedId) || targets[0] || null;

  const [progress, setProgress] = useState({});
  const [docs, setDocs] = useState([]); // [{ id, name, status, kind, fields, question, answer }]
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState(null);
  const idRef = React.useRef(0);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    if (!selected?.id) {
      setProgress({});
      setDocs([]);
      return;
    }
    let alive = true;
    fetchSetupProgress(selected.id)
      .then((p) => {
        if (alive) setProgress(p || {});
      })
      .catch((e) => {
        if (alive) setErr(e.message);
      });
    // Pre-seed the documents list so Setup reads as an already-configured
    // building for the demo — ~20 docs shown as already "applied", each with
    // the type Merlin classified + a summary it wrote. Negative ids so they
    // never collide with freshly-uploaded docs.
    setDocs(
      SETUP_DEMO_DOCS.map((s, i) => ({
        id: -(i + 1),
        name: s.name,
        status: 'applied',
        kind: s.kind,
        summary: s.summary,
      })),
    );
    return () => {
      alive = false;
    };
  }, [selected?.id]);

  const readiness = computeReadiness(progress, selected);

  // Ingest one file: show "analyzing", then resolve to a classified doc.
  function ingest(file, i) {
    const id = ++idRef.current;
    // Keep the File so confirm() can run real extraction + persistence
    // (#877). Demo-seeded docs have no `file` and stay readiness-only.
    setDocs((d) => [{ id, name: file.name, status: 'analyzing', file }, ...d]);
    // Mocked latency so the "Merlin is reading…" state is visible on stage.
    const delay = 900 + (i % 3) * 500;
    window.setTimeout(() => {
      const res = mockAnalyze(file.name, idRef.current);
      setDocs((d) =>
        d.map((x) =>
          x.id === id
            ? {
                ...x,
                status: res.question ? 'needs_input' : 'ready',
                kind: res.kind,
                extracted: res.extracted,
                question: res.question,
              }
            : x,
        ),
      );
    }, delay);
  }

  function onFiles(list) {
    const files = Array.from(list || []);
    files.forEach((f, i) => ingest(f, i));
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    onFiles(e.dataTransfer?.files);
  }

  // Operator answered Merlin's clarifying question → doc becomes ready.
  function answer(id, text) {
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, status: 'ready', answer: text } : x)));
  }

  // Real persistence for a confirmed upload (#877). Contracts/SLAs go through
  // the /api/extract → saveExtractedContract path; rosters are parsed from the
  // workbook → saveWorkforce. Returns a short note for the doc row, or null
  // when there's nothing to persist (no file, or a kind without a writer yet).
  async function persistDoc(doc, locationId) {
    const orgId = org?.id;
    if (!doc.file || !orgId) return null;
    if (doc.kind === 'contract' || doc.kind === 'sla') {
      const { fields } = await extractDocument('contract', doc.file);
      await saveExtractedContract(orgId, locationId, fields);
      return `Saved contract · ${fields?.name || doc.name}`;
    }
    if (doc.kind === 'roster') {
      const buf = await doc.file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const n = await saveWorkforce(orgId, normalizeWorkforceRows(rows));
      return n ? `Saved ${n} team member${n === 1 ? '' : 's'}` : null;
    }
    return null; // floorplan / devices / suppliers: readiness-only for now
  }

  // Confirm a ready doc → mark its mapped section done (persisted) + flip the
  // doc to applied. Readiness updates instantly (snappy demo); the real
  // contract/workforce rows are written in the background so the UI never
  // blocks on extraction. Demo-seeded docs (no `file`) skip the real write.
  async function confirm(doc) {
    const meta = SETUP_DOC_KINDS[doc.kind];
    setDocs((d) => d.map((x) => (x.id === doc.id ? { ...x, status: 'applied' } : x)));
    if (meta?.section && selected?.id) {
      try {
        const next = await markSection(selected.id, meta.section, true, { source: 'document', doc: doc.name });
        setProgress(next || {});
      } catch (e) {
        setErr(e.message);
      }
    }
    if (doc.file && selected?.id) {
      persistDoc(doc, selected.id)
        .then((note) => {
          if (note) setDocs((d) => d.map((x) => (x.id === doc.id ? { ...x, summary: note } : x)));
        })
        .catch((e) => {
          // Readiness is already saved — surface a soft note, don't fail.
          setDocs((d) =>
            d.map((x) =>
              x.id === doc.id ? { ...x, summary: `Readiness saved · auto-import skipped (${e.message})` } : x,
            ),
          );
        });
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{t('setup.title')}</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-dim)', maxWidth: 620, lineHeight: 1.5 }}>
            {t('setup.v2.subtitle')}
          </p>
        </div>
        {targets.length > 0 && (
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-dim)',
            }}
          >
            {t('setup.pick_building')}
            <select
              value={selected?.id || ''}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{
                padding: '7px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                minWidth: 200,
              }}
            >
              {targets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {err && <ErrBanner msg={err} />}
      {!selected && (
        <Card>
          <div style={{ padding: 16, fontSize: 13, color: 'var(--text-dim)' }}>{t('setup.no_building')}</div>
        </Card>
      )}

      {selected && (
        <>
          {/* Readiness bar */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: `conic-gradient(var(--accent) ${readiness.pct}%, var(--surface-3) 0)`,
                  fontSize: 13,
                  fontWeight: 800,
                  color: 'var(--text)',
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--surface)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {readiness.pct}%
                </span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{t('setup.readiness')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                  {t('setup.readiness_count', { done: readiness.done, total: readiness.total })}
                </div>
              </div>
            </div>
          </Card>

          {/* The one drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              background: dragOver ? 'color-mix(in oklch, var(--accent) 7%, transparent)' : 'var(--surface-2)',
              borderRadius: 14,
              padding: '34px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color .15s, background .15s',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                marginBottom: 10,
              }}
            >
              <Icon.sparkle size={22} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{t('setup.v2.drop_title')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 4 }}>{t('setup.v2.drop_hint')}</div>
          </div>

          {/* Documents Merlin understands */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>{t('setup.v2.docs_title')}</div>
            {docs.length === 0 ? (
              <Card>
                <div style={{ padding: 16, fontSize: 12.5, color: 'var(--text-dim)' }}>{t('setup.v2.docs_empty')}</div>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {docs.map((doc) => (
                  <SetupDocRow key={doc.id} doc={doc} t={t} onAnswer={answer} onConfirm={confirm} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// One row in the "Documents Merlin understands" list. Renders the analyze /
// clarify / ready / applied states.
function SetupDocRow({ doc, t, onAnswer, onConfirm }) {
  const [reply, setReply] = useState('');
  const meta = SETUP_DOC_KINDS[doc.kind];
  const IconC = (meta && Icon[meta.icon]) || Icon.panel;

  const statusTone =
    doc.status === 'applied'
      ? 'var(--ok)'
      : doc.status === 'needs_input'
        ? 'var(--warn)'
        : doc.status === 'ready'
          ? 'var(--accent)'
          : 'var(--text-faint)';

  return (
    <Card>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-2)',
              color: 'var(--text-soft)',
            }}
          >
            <IconC size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {doc.name}
              </span>
              {meta && doc.status !== 'analyzing' && (
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 9.5,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--accent)',
                    background: 'var(--accent-soft)',
                    borderRadius: 999,
                    padding: '1px 7px',
                  }}
                >
                  {t(meta.labelKey)}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.45 }}>
              {doc.status === 'analyzing'
                ? t('setup.v2.analyzing', { name: doc.name })
                : doc.summary
                  ? doc.summary
                  : meta
                    ? `${t('setup.v2.understood_as')} ${t(meta.labelKey)} · ${meta.applies}`
                    : ''}
            </div>
          </div>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: statusTone,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {doc.status === 'analyzing'
              ? '···'
              : doc.status === 'needs_input'
                ? t('setup.v2.needs_input')
                : doc.status === 'applied'
                  ? t('setup.v2.applied')
                  : t('setup.v2.ready')}
          </span>
          {doc.status === 'ready' && (
            <button
              type="button"
              onClick={() => onConfirm(doc)}
              style={{
                padding: '5px 12px',
                fontSize: 11.5,
                fontWeight: 700,
                borderRadius: 7,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              {t('setup.v2.confirm')}
            </button>
          )}
        </div>

        {/* Merlin's clarifying question */}
        {doc.status === 'needs_input' && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: 6,
              }}
            >
              {t('setup.v2.merlin_asks')}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5, marginBottom: 10 }}>
              {doc.question}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && reply.trim()) onAnswer(doc.id, reply.trim());
                }}
                placeholder={t('setup.v2.answer_ph')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 12.5,
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                disabled={!reply.trim()}
                onClick={() => onAnswer(doc.id, reply.trim())}
                style={{
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 8,
                  border: 'none',
                  background: reply.trim() ? 'var(--accent)' : 'var(--surface-3)',
                  color: reply.trim() ? '#fff' : 'var(--text-faint)',
                  cursor: reply.trim() ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                {t('setup.v2.send')}
              </button>
            </div>
          </div>
        )}

        {/* Rich extracted-fields preview — the "Merlin understood it" moment.
            Shown once the doc is ready (or applied), when fields are present. */}
        {(doc.status === 'ready' || doc.status === 'applied') && doc.extracted && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px 18px' }}
            >
              {Object.entries(doc.extracted).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-dim)' }}>{k}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
