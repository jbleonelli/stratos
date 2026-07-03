// Shared SLA UI primitives — SlaRow + SlaForm + supporting constants,
// extracted from Admin.jsx so both Admin (Agreements + Targets tabs)
// and the contractor surface (Operations → SLAs, PR 3) can render the
// same row/form chrome without dragging the Admin lazy chunk into the
// contractor bundle.
//
// Styles + a local Field helper live here too so this file has no
// dependencies on Admin.jsx internals.

import React, { useState } from 'react';
import { Icon } from './icons.jsx';
import { Pill } from './primitives.jsx';
import { useT } from './i18n.js';

// ────── Option catalogs ──────────────────────────────────────────────

export const SLA_DOMAIN_OPTIONS = [
  { id: 'hygiene', labelKey: 'admin.sla.domain.hygiene' },
  { id: 'comfort', labelKey: 'admin.sla.domain.comfort' },
  { id: 'air', labelKey: 'admin.sla.domain.air' },
  { id: 'supplies', labelKey: 'admin.sla.domain.supplies' },
  { id: 'security', labelKey: 'admin.sla.domain.security' },
  { id: 'compliance', labelKey: 'admin.sla.domain.compliance' },
];

export const SLA_METRIC_OPTIONS = [
  { id: 'response_time', labelKey: 'admin.sla.metric.response_time', descKey: 'admin.sla.metric.response_time_desc' },
  { id: 'count', labelKey: 'admin.sla.metric.count', descKey: 'admin.sla.metric.count_desc' },
  { id: 'compliance', labelKey: 'admin.sla.metric.compliance', descKey: 'admin.sla.metric.compliance_desc' },
  { id: 'threshold', labelKey: 'admin.sla.metric.threshold', descKey: 'admin.sla.metric.threshold_desc' },
];

export const SLA_DOMAIN_ICON = {
  hygiene: 'people',
  comfort: 'hvac',
  air: 'air',
  supplies: 'supply',
  security: 'security',
  compliance: 'shield',
};

// ────── Update-payload hygiene ───────────────────────────────────────
// Drop fields that are either create-time-only or move through dedicated
// RPCs (PR 4 accept, PR 6 visibility-bump). Mirrors what the
// slas_lock_accepted_terms trigger enforces server-side.
export function stripImmutable(patch) {
  const out = { ...patch };
  delete out.scope;
  delete out.accepted_at;
  delete out.authored_by_org;
  delete out.counterparty_org;
  delete out.contract_id;
  delete out.created_by;
  delete out.visibility;
  return out;
}

// ────── Local presentation helpers (no Admin.jsx dependency) ────────

const inputStyle = {
  padding: '7px 10px',
  fontSize: 12.5,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  outline: 'none',
};

const btnPrimary = {
  padding: '7px 12px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnGhost = {
  padding: '7px 12px',
  background: 'transparent',
  color: 'var(--text-soft)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnDanger = {
  padding: '7px 12px',
  background: 'transparent',
  color: 'var(--risk)',
  border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

function Field({ label, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.15,
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

export function ErrBanner({ text }) {
  return (
    <div
      style={{
        margin: '0 0 12px',
        padding: 10,
        fontSize: 12,
        background: 'color-mix(in oklch, var(--risk) 8%, transparent)',
        border: '1px solid color-mix(in oklch, var(--risk) 30%, transparent)',
        color: 'var(--risk)',
        borderRadius: 7,
      }}
    >
      {text}
    </div>
  );
}

// ────── SlaRow ──────────────────────────────────────────────────────
// scope-aware list row. Agreements show pending/accepted/superseded
// pills; targets show visibility pills. Edit disables on accepted
// agreements (terms locked — create a new version via PR 4 flow).

// SlaRow props:
//   sla            — the row
//   editing        — boolean, replaces row content with SlaForm
//   isAdmin        — can the caller edit/delete (Admin gate for org SLAs)
//   actorRole      — 'author' | 'accepter' | 'both' | 'observer' (PR 4)
//                    Controls which action buttons render on agreements.
//                    Defaults to 'both' for back-compat with targets and
//                    pre-PR-4 callers.
//   hasPendingSuccessor — boolean. When true on an accepted row, render
//                    a "v2 pending" indicator + suppress New Version
//                    (you can't propose v3 while v2 is still pending).
//   onAccept       — called when accepter clicks Accept on a pending row
//   onNewVersion   — called when accepted-row action invokes a new version
//   onCancelPending — called when author clicks Cancel on a pending row
//                    they authored. Soft-archive (active=false).
//   onEdit/onCancel/onSave/onDelete — existing in-place edit lifecycle
//   extraLine      — optional sub-line under the name (e.g. customer name)
//   onSetVisibility(next) — PR 6. When provided on a target row, the
//                    visibility pill renders as a <select> instead.
//                    Options drawn from `visibilityOptions` (defaults
//                    to private/team only — caller must opt-in to 'org'
//                    by passing ['private','team','org']).
//   visibilityOptions — array of permitted visibility values.
export function SlaRow({
  sla,
  editing,
  isAdmin,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  extraLine,
  actorRole = 'both',
  hasPendingSuccessor = false,
  onAccept,
  onNewVersion,
  onCancelPending,
  onSetVisibility,
  visibilityOptions = ['private', 'team'],
  // PR 6 (data-source bridge): per-row derived source health summary
  // from derive_sla_source_health. Shape: { derived_status, healthy,
  // degraded, offline_count, total } or undefined. 'no_sources' renders
  // nothing; 'impaired' / 'paused' surface as pills.
  sourceHealth = null,
  // Optional source_catalog rows for resolving id → name when rendering
  // edit form picker. Not used by SlaRow itself but passed through to
  // SlaForm via initial.
  catalogById = null,
  // When the row is rendered inside its own Card (a card grid, e.g. the
  // contractor SLAs surface) rather than stacked in a list, drop the
  // table-row top border + horizontal padding and let the pills/actions
  // wrap under the title in a narrow card.
  inCard = false,
}) {
  const t = useT();
  const IconC = Icon[SLA_DOMAIN_ICON[sla.domain] || 'sparkle'] || Icon.sparkle;
  const isAgreement = sla.scope === 'agreement';
  const isTarget = sla.scope === 'target';
  const isAccepted = isAgreement && !!sla.accepted_at;
  const isSuperseded = isAgreement && !!sla.superseded_by;
  // Terms-lock kicks in at accept. Once a row is accepted, the only
  // ways to change its terms are (a) propose a new version, or (b)
  // platform admin override. Edit button is suppressed.
  const termsLocked = isAccepted;

  if (editing) {
    return (
      <div style={{ borderTop: inCard ? 'none' : '1px solid var(--border)', padding: inCard ? 0 : '12px 0' }}>
        <SlaForm
          initial={sla}
          scope={sla.scope || 'agreement'}
          catalogById={catalogById}
          onCancel={onCancel}
          onSave={onSave}
        />
      </div>
    );
  }

  // Action visibility for agreements (PR 4):
  //   - Pending row, accepter side                → Accept
  //   - Pending row, author side                  → Edit + Cancel
  //   - Pending row, 'both' (internal pre-accept) → Edit + Cancel
  //   - Accepted row, author or 'both', no pending successor → New version
  //   - Accepted row with a pending successor     → no edit actions; the
  //                                                 caller should focus on
  //                                                 the pending v2 row instead
  // For targets, actorRole defaults to 'both' and the legacy edit/delete
  // affordance is shown when isAdmin is true (caller-side gate).
  const canActAsAuthor = actorRole === 'author' || actorRole === 'both';
  const canActAsAccepter = actorRole === 'accepter' || actorRole === 'both';
  const showAccept = isAgreement && !isAccepted && canActAsAccepter && actorRole !== 'both' && onAccept;
  const showCancelPend = isAgreement && !isAccepted && canActAsAuthor && onCancelPending;
  const showEditPend = isAgreement && !isAccepted && canActAsAuthor && !hasPendingSuccessor;
  const showNewVersion =
    isAgreement && isAccepted && !isSuperseded && !hasPendingSuccessor && canActAsAuthor && onNewVersion;
  const showLegacyEdit = isTarget && isAdmin && !termsLocked;
  const showLegacyDelete =
    (isAgreement && !isAccepted && canActAsAuthor && onDelete) || (isTarget && isAdmin && onDelete);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: inCard ? 'flex-start' : 'center',
        gap: 12,
        flexWrap: inCard ? 'wrap' : 'nowrap',
        padding: inCard ? 0 : '10px 6px',
        borderTop: inCard ? 'none' : '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          flexShrink: 0,
          background: 'var(--surface-2)',
          color: 'var(--text-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconC size={13} />
      </div>
      {/* In a card, take (almost) the whole first row so the status pills +
          actions wrap onto a clean second row below the title. */}
      <div style={{ flex: 1, minWidth: 0, flexBasis: inCard ? 'calc(100% - 40px)' : 'auto' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{sla.name}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1, fontFamily: 'var(--mono)' }}>
          {sla.domain} · {sla.metric_kind} · {t('admin.sla.target')} {Number(sla.target_pct).toFixed(0)}%
          {!sla.computable && ` · ${t('admin.sla.pending_inline')}`}
        </div>
        {isAgreement && sla.owner_label && (
          <div style={{ fontSize: 10.5, color: 'var(--text-soft)', marginTop: 2 }}>
            {t('admin.sla.owner')}: <b>{sla.owner_label}</b>
          </div>
        )}
        {extraLine && <div style={{ fontSize: 10.5, color: 'var(--text-soft)', marginTop: 2 }}>{extraLine}</div>}
        {isAgreement && hasPendingSuccessor && (
          <div style={{ fontSize: 10.5, color: 'var(--warn)', marginTop: 2, fontWeight: 600 }}>
            {t('admin.sla.has_pending_successor')}
          </div>
        )}
        {isAgreement && isSuperseded && (
          <div style={{ fontSize: 10.5, color: 'var(--text-soft)', marginTop: 2 }}>
            {t('admin.sla.supersedes', { predecessor: sla.superseded_by })}
          </div>
        )}
      </div>
      {isAgreement && isSuperseded && <Pill tone="off">{t('admin.sla.status.superseded')}</Pill>}
      {isAgreement && isAccepted && !isSuperseded && <Pill tone="ok">{t('admin.sla.status.accepted')}</Pill>}
      {isAgreement && !isAccepted && <Pill tone="warn">{t('admin.sla.status.pending')}</Pill>}
      {/* PR 6: derived source-health pill. 'no_sources' shows nothing.
          'computing' shows nothing (the normal state). 'impaired' /
          'paused' surface here. */}
      {sourceHealth?.derived_status === 'impaired' && (
        <Pill
          tone="warn"
          title={t('admin.sla.source_health.impaired_hint', {
            degraded: sourceHealth.degraded || 0,
            offline: sourceHealth.offline_count || 0,
            total: sourceHealth.total || 0,
          })}
        >
          {t('admin.sla.source_health.impaired')}
        </Pill>
      )}
      {sourceHealth?.derived_status === 'paused' && (
        <Pill
          tone="risk"
          title={t('admin.sla.source_health.paused_hint', {
            total: sourceHealth.total || 0,
          })}
        >
          {t('admin.sla.source_health.paused')}
        </Pill>
      )}
      {isTarget &&
        (onSetVisibility ? (
          <select
            value={sla.visibility || 'private'}
            onChange={(e) => onSetVisibility(e.target.value)}
            title={t('admin.sla.visibility_hint')}
            style={{
              padding: '3px 6px',
              fontSize: 11,
              fontWeight: 600,
              background:
                sla.visibility === 'org' ? 'color-mix(in oklch, var(--ok) 14%, transparent)' : 'var(--surface-2)',
              color: sla.visibility === 'org' ? 'var(--ok)' : 'var(--text-soft)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            {visibilityOptions.map((v) => (
              <option key={v} value={v}>
                {t(`admin.sla.visibility.${v}`)}
              </option>
            ))}
          </select>
        ) : (
          <Pill tone={sla.visibility === 'org' ? 'ok' : 'off'}>
            {t(`admin.sla.visibility.${sla.visibility || 'private'}`)}
          </Pill>
        ))}
      {!sla.computable && <Pill tone="off">{t('admin.sla.pending')}</Pill>}

      {/* Agreement actions (PR 4) */}
      {showAccept && (
        <button onClick={onAccept} style={{ ...btnPrimary, padding: '5px 12px', fontSize: 11 }}>
          {t('admin.sla.accept')}
        </button>
      )}
      {showEditPend && (
        <button onClick={onEdit} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>
          {t('admin.sla.edit')}
        </button>
      )}
      {showCancelPend && (
        <button onClick={onCancelPending} style={{ ...btnDanger, padding: '5px 10px', fontSize: 11 }}>
          {t('admin.sla.cancel_pending')}
        </button>
      )}
      {showNewVersion && (
        <button onClick={onNewVersion} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>
          {t('admin.sla.new_version')}
        </button>
      )}
      {showLegacyEdit && (
        <button onClick={onEdit} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>
          {t('admin.sla.edit')}
        </button>
      )}
      {showLegacyDelete && (
        <button onClick={onDelete} style={{ ...btnDanger, padding: '5px 10px', fontSize: 11 }}>
          {t('admin.sla.delete')}
        </button>
      )}
    </div>
  );
}

// ────── SlaForm ─────────────────────────────────────────────────────
// scope-aware editor. owner_label + computable are hidden when
// scope='target' (irrelevant for self-tracked KPIs).

export function SlaForm({
  initial,
  scope = 'agreement',
  onCancel,
  onSave,
  // PR 6: pass id → catalog row map for rendering pretty source names
  // in the multi-select. When omitted, the picker still works but
  // shows raw ids.
  catalogById = null,
}) {
  const t = useT();
  const isEdit = !!initial?.id;
  const isTarget = scope === 'target';
  const [name, setName] = useState(initial?.name || '');
  const [domain, setDomain] = useState(initial?.domain || 'hygiene');
  const [metricKind, setMetricKind] = useState(initial?.metric_kind || 'response_time');
  const [targetPct, setTargetPct] = useState(initial?.target_pct ?? 95);
  const [ownerLabel, setOwnerLabel] = useState(initial?.owner_label || '');
  const [computable, setComputable] = useState(initial?.computable ?? true);
  const [description, setDescription] = useState(initial?.config?.description || '');
  // PR 6: linked data source catalog ids. Empty array = no formal
  // source deps declared. Empty → no impaired/paused pill on row.
  const [sourceCatalogIds, setSourceCatalogIds] = useState(
    Array.isArray(initial?.source_catalog_ids) ? initial.source_catalog_ids : [],
  );
  const [maxMinutes, setMaxMinutes] = useState(initial?.config?.max_minutes ?? 20);
  const [maxOpenCount, setMaxOpenCount] = useState(initial?.config?.max_open_count ?? 0);
  const [windowStart, setWindowStart] = useState(initial?.config?.window_start || '19:00');
  const [windowEnd, setWindowEnd] = useState(initial?.config?.window_end || '20:00');
  const [thresholdMetric, setThresholdMetric] = useState(initial?.config?.metric || 'co2_ppm');
  const [thresholdMax, setThresholdMax] = useState(initial?.config?.max_value ?? 900);
  const [saving, setSaving] = useState(false);

  const targetValid = Number.isFinite(Number(targetPct)) && Number(targetPct) >= 0 && Number(targetPct) <= 100;
  const canSave = name.trim() && targetValid && !saving;

  const buildConfig = () => {
    const base = description ? { description } : {};
    if (metricKind === 'response_time') {
      return { ...base, max_minutes: Number(maxMinutes), source: 'device_requests' };
    }
    if (metricKind === 'count') {
      return { ...base, max_open_count: Number(maxOpenCount), source: 'device_requests' };
    }
    if (metricKind === 'compliance') {
      return { ...base, source: 'device_service_sessions', window_start: windowStart, window_end: windowEnd };
    }
    if (metricKind === 'threshold') {
      return { ...base, metric: thresholdMetric, max_value: Number(thresholdMax) };
    }
    return base;
  };

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const draft = {
        id: isEdit ? initial.id : null,
        name: name.trim(),
        domain,
        metric_kind: metricKind,
        target_pct: Number(targetPct),
        config: buildConfig(),
        computable: isTarget ? true : computable,
        owner_label: isTarget ? null : ownerLabel.trim() || null,
        // PR 6: pass through linked source ids. Targets keep them too
        // even though the bridge currently only consumes agreements —
        // future-proofing in case targets want source-aware perf too.
        source_catalog_ids: sourceCatalogIds,
      };
      await onSave(draft);
    } catch {
      /* parent surfaces error */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label={t('admin.sla.field.name')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('admin.sla.field.name_ph')}
            style={{ ...inputStyle, width: '100%' }}
          />
        </Field>
        <Field label={t('admin.sla.field.domain')}>
          <select value={domain} onChange={(e) => setDomain(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
            {SLA_DOMAIN_OPTIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {t(d.labelKey)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label={t('admin.sla.field.metric_kind')}>
          <select
            value={metricKind}
            onChange={(e) => setMetricKind(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          >
            {SLA_METRIC_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {t(m.labelKey)}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--text-dim)', lineHeight: 1.45 }}>
            {(() => {
              const o = SLA_METRIC_OPTIONS.find((m) => m.id === metricKind);
              return o ? t(o.descKey) : '';
            })()}
          </div>
        </Field>
        <Field label={t('admin.sla.field.target')}>
          <input
            type="number"
            min={0}
            max={100}
            value={targetPct}
            onChange={(e) => setTargetPct(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </Field>
      </div>

      {metricKind === 'response_time' && (
        <Field label={t('admin.sla.field.max_minutes')}>
          <input
            type="number"
            min={1}
            value={maxMinutes}
            onChange={(e) => setMaxMinutes(e.target.value)}
            style={{ ...inputStyle, width: 120 }}
          />
        </Field>
      )}
      {metricKind === 'count' && (
        <Field label={t('admin.sla.field.max_open')}>
          <input
            type="number"
            min={0}
            value={maxOpenCount}
            onChange={(e) => setMaxOpenCount(e.target.value)}
            style={{ ...inputStyle, width: 120 }}
          />
        </Field>
      )}
      {metricKind === 'compliance' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label={t('admin.sla.field.window_start')}>
            <input
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              placeholder="19:00"
              style={{ ...inputStyle, width: 100 }}
            />
          </Field>
          <Field label={t('admin.sla.field.window_end')}>
            <input
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              placeholder="20:00"
              style={{ ...inputStyle, width: 100 }}
            />
          </Field>
        </div>
      )}
      {metricKind === 'threshold' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label={t('admin.sla.field.metric')}>
            <input
              value={thresholdMetric}
              onChange={(e) => setThresholdMetric(e.target.value)}
              placeholder="co2_ppm"
              style={{ ...inputStyle, width: '100%' }}
            />
          </Field>
          <Field label={t('admin.sla.field.max_value')}>
            <input
              type="number"
              value={thresholdMax}
              onChange={(e) => setThresholdMax(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            />
          </Field>
        </div>
      )}

      {!isTarget && (
        <Field label={t('admin.sla.field.owner')}>
          <input
            value={ownerLabel}
            onChange={(e) => setOwnerLabel(e.target.value)}
            placeholder={t('admin.sla.field.owner_ph')}
            style={{ ...inputStyle, width: '100%' }}
          />
          <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--text-dim)', lineHeight: 1.45 }}>
            {t('admin.sla.field.owner_desc')}
          </div>
        </Field>
      )}

      <Field label={t('admin.sla.field.description')}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={t('admin.sla.field.description_ph')}
          style={{ ...inputStyle, width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>

      {/* PR 6: linked data sources. When set, the SlaRow shows
          impaired/paused pills based on the linked sources' connection
          health. Empty list = no source-aware health computation. */}
      {!isTarget && catalogById && (
        <Field label={t('admin.sla.field.linked_sources')}>
          <SourceMultiSelect value={sourceCatalogIds} onChange={setSourceCatalogIds} catalogById={catalogById} />
          <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--text-dim)', lineHeight: 1.45 }}>
            {t('admin.sla.field.linked_sources_desc')}
          </div>
        </Field>
      )}

      {!isTarget && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--text-soft)',
            cursor: 'pointer',
          }}
        >
          <input type="checkbox" checked={computable} onChange={(e) => setComputable(e.target.checked)} />
          {t('admin.sla.live_label')}
          <span style={{ color: 'var(--text-dim)' }}>{t('admin.sla.live_hint')}</span>
        </label>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} disabled={saving} style={btnGhost}>
          {t('admin.sla.cancel')}
        </button>
        <button onClick={submit} disabled={!canSave} style={{ ...btnPrimary, opacity: canSave ? 1 : 0.6 }}>
          {saving
            ? t('admin.sla.saving')
            : isEdit
              ? t('admin.sla.save_changes')
              : isTarget
                ? t('admin.sla.targets.create')
                : t('admin.sla.create')}
        </button>
      </div>
    </div>
  );
}

// ────── SourceMultiSelect (PR 6) ─────────────────────────────────────
// Compact checkbox list of source_catalog entries. Caller passes the
// id→catalog map so we render friendly names + provider hints.

function SourceMultiSelect({ value = [], onChange, catalogById }) {
  const t = useT();
  const ids = catalogById ? Object.keys(catalogById) : [];
  const selected = new Set(value);
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };
  if (ids.length === 0) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '6px 0' }}>
        {t('admin.sla.field.linked_sources_empty')}
      </div>
    );
  }
  // Sort by name; group selected on top for ergonomics.
  const sorted = ids
    .map((id) => ({ id, row: catalogById[id] }))
    .filter((x) => x.row)
    .sort((a, b) => {
      const aS = selected.has(a.id) ? 0 : 1;
      const bS = selected.has(b.id) ? 0 : 1;
      if (aS !== bS) return aS - bS;
      return (a.row.name || '').localeCompare(b.row.name || '');
    });
  return (
    <div
      style={{
        maxHeight: 200,
        overflowY: 'auto',
        padding: 8,
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--surface-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {sorted.map(({ id, row }) => (
        <label
          key={id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            padding: '2px 4px',
            cursor: 'pointer',
            color: selected.has(id) ? 'var(--text)' : 'var(--text-soft)',
          }}
        >
          <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name}
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{row.signal_kind}</span>
        </label>
      ))}
    </div>
  );
}
