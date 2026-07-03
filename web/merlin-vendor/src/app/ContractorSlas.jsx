// Operations → SLAs (contractor surface).
//
// Cross-customer roll-up of "Service Agreements I'm a party to" —
// agreements where this contractor org sits in counterparty_org. Rows
// live in the customer's organization_id; RLS lets both parties read.
//
// Primary list view groups by customer. Each row uses the shared
// SlaRow component from slas-ui.jsx so the chrome matches Admin →
// SLAs → Agreements on the customer side.
//
// Propose new agreement flow:
//   1. Pick contract  → carries customer + service_kind + covered locations
//   2. Pick location  → from that contract's covered locations
//   3. Standard SlaForm fields (name, domain, metric_kind, target, config)
//   4. Submit         → insert with scope='agreement',
//                       authored_by_org = current contractor org,
//                       organization_id = customer (contract.manager_org_id),
//                       counterparty_org = current contractor org
//                       (RLS reads "who's the deliverer"),
//                       contract_id, location_id, accepted_at = null
//
// The customer's Admin → SLAs → Agreements tab shows the same row
// with a Pending pill until they accept (accept flow in PR 4).

import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Card, Pill, AdaptivLoader } from './primitives.jsx';
import { useT } from './i18n.js';
import { confirmDialog } from './dialogs.jsx';
import { useSession } from './auth.js';
import { useAuthoredAgreements, acceptSla, actorRoleForAgreement } from './slas-data.js';
import { SlaForm, SlaRow, ErrBanner, stripImmutable } from './slas-ui.jsx';
import { useContractorActiveContracts } from './queries/contractor.ts';
import { useInsertSla, useUpdateSla, useDeleteSla } from './queries/slas.ts';

// ────── ContractorSlasPage ───────────────────────────────────────────

export function ContractorSlasPage() {
  const t = useT();
  const session = useSession();
  const orgId = session?.organizationId;
  const { rows, loaded } = useAuthoredAgreements(orgId);
  const insertSla = useInsertSla();
  const updateSla = useUpdateSla();
  const deleteSla = useDeleteSla();
  const [proposing, setProposing] = useState(false);
  const [editing, setEditing] = useState(null); // sla.id while edit-in-place (pending only)
  const [proposingVersionOf, setProposingVersionOf] = useState(null); // accepted sla.id (new-version author)
  const [error, setError] = useState(null);

  // Predecessor → pending successor map (across the entire list, so a
  // v2 proposed under any customer card hints the right predecessor).
  const successorMap = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (!r.accepted_at && r.superseded_by) map[r.superseded_by] = r;
    }
    return map;
  }, [rows]);

  // Group rows by customer for the list view.
  const grouped = useMemo(() => {
    const byCust = new Map();
    for (const r of rows) {
      const key = r.customer?.id || r.organization_id;
      if (!byCust.has(key)) byCust.set(key, { customer: r.customer, items: [] });
      byCust.get(key).items.push(r);
    }
    return [...byCust.values()].sort((a, b) => (a.customer?.name || '').localeCompare(b.customer?.name || ''));
  }, [rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon.shield size={14} style={{ color: 'var(--text-dim)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('contractor.slas.title')}</div>
          <Pill tone="info">{rows.length}</Pill>
          <div style={{ flex: 1 }} />
          {!proposing && (
            <button
              onClick={() => {
                setProposing(true);
                setError(null);
              }}
              style={btnPrimary}
            >
              {t('contractor.slas.propose')}
            </button>
          )}
        </div>

        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55, maxWidth: 720 }}>
          {t('contractor.slas.body')}
        </p>

        {!loaded && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
            <AdaptivLoader size="sm" />
          </div>
        )}

        {loaded && rows.length === 0 && !proposing && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.55 }}>
            {t('contractor.slas.empty')}
            <br />
            {t('contractor.slas.empty_hint')}
          </div>
        )}

        {error && <ErrBanner text={error} />}

        {proposing && (
          <ProposeForm
            orgId={orgId}
            onCancel={() => setProposing(false)}
            onError={setError}
            onSubmitted={() => setProposing(false)}
          />
        )}
      </Card>

      {/* Grouped by customer — one card per service agreement */}
      {grouped.map((g) => (
        <div key={g.customer?.id || 'unknown'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px' }}>
            <Icon.building size={13} style={{ color: 'var(--text-dim)' }} />
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>
              {g.customer?.name || t('contractor.slas.unknown_customer')}
            </div>
            <Pill tone="off">{g.items.length}</Pill>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 10,
              alignItems: 'start',
            }}
          >
            {g.items.map((sla) => (
              <Card key={sla.id}>
                {/* New-version form renders inline above the predecessor row */}
                {proposingVersionOf === sla.id && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 14,
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent-line)',
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-soft)' }}>
                      {t('admin.sla.new_version')} — <span style={{ color: 'var(--text)' }}>{sla.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
                      {t('admin.sla.new_version_hint')}
                    </div>
                    <SlaForm
                      initial={sla}
                      scope="agreement"
                      onCancel={() => setProposingVersionOf(null)}
                      onSave={async (draft) => {
                        setError(null);
                        const newId = `sla-${draft.domain}-${Date.now()}`;
                        const row = {
                          ...draft,
                          id: newId,
                          scope: 'agreement',
                          organization_id: sla.organization_id,
                          authored_by_org: orgId,
                          counterparty_org: sla.counterparty_org,
                          contract_id: sla.contract_id,
                          location_id: sla.location_id,
                          superseded_by: sla.id,
                          display_order: (sla.display_order || 0) + 1,
                          active: true,
                        };
                        try {
                          await insertSla.mutateAsync(row);
                        } catch (e) {
                          setError(e.message);
                          throw e;
                        }
                        setProposingVersionOf(null);
                      }}
                    />
                  </div>
                )}
                <SlaRow
                  sla={sla}
                  inCard
                  editing={editing === sla.id}
                  isAdmin={true}
                  actorRole={actorRoleForAgreement(sla, orgId)}
                  hasPendingSuccessor={!!successorMap[sla.id]}
                  extraLine={sla.location?.name ? `${t('contractor.slas.location')}: ${sla.location.name}` : null}
                  onEdit={() => {
                    setEditing(sla.id);
                    setError(null);
                  }}
                  onCancel={() => setEditing(null)}
                  onSave={async (draft) => {
                    setError(null);
                    const patch = stripImmutable({ ...draft, organization_id: undefined, id: undefined });
                    try {
                      await updateSla.mutateAsync({ id: sla.id, patch });
                    } catch (e) {
                      setError(e.message);
                      throw e;
                    }
                    setEditing(null);
                  }}
                  onAccept={async () => {
                    setError(null);
                    try {
                      await acceptSla(sla.id);
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                  onCancelPending={async () => {
                    if (!(await confirmDialog(t('admin.sla.cancel_pending_confirm')))) return;
                    setError(null);
                    try {
                      await updateSla.mutateAsync({ id: sla.id, patch: { active: false } });
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                  onNewVersion={() => {
                    setProposingVersionOf(sla.id);
                    setEditing(null);
                    setError(null);
                  }}
                  onDelete={async () => {
                    if (
                      !(await confirmDialog({ body: t('admin.sla.delete_confirm', { name: sla.name }), danger: true }))
                    )
                      return;
                    setError(null);
                    try {
                      await deleteSla.mutateAsync(sla.id);
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ────── ProposeForm ─────────────────────────────────────────────────
// Picks contract → location → standard SLA fields. Submits an
// agreement-scope row into the customer's org with the contractor as
// counterparty + authored_by.

function ProposeForm({ orgId, onCancel, onError, onSubmitted }) {
  const t = useT();
  const { data: contracts = [], isSuccess: loaded } = useContractorActiveContracts(orgId);
  const insertSla = useInsertSla();
  const [contractId, setContractId] = useState('');
  const [locationId, setLocationId] = useState('');

  const chosen = contracts.find((c) => c.id === contractId);
  const locs = chosen?.contract_locations || [];

  // Reset location when contract changes (covered locations differ).
  useEffect(() => {
    setLocationId('');
  }, [contractId]);

  if (!loaded) {
    return (
      <div style={{ padding: 12, color: 'var(--text-dim)', fontSize: 12 }}>
        {t('contractor.slas.loading_contracts')}
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div style={{ padding: 14, fontSize: 12.5, color: 'var(--text-soft)' }}>
        {t('contractor.slas.no_contracts')}
        <div style={{ marginTop: 10 }}>
          <button onClick={onCancel} style={btnGhost}>
            {t('admin.sla.cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 14,
        marginBottom: 12,
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent-line)',
        borderRadius: 10,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: 'var(--text-soft)' }}>
        {t('contractor.slas.propose_title')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={fieldLabelStyle}>{t('contractor.slas.contract')}</div>
          <select
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          >
            <option value="">{t('contractor.slas.pick_contract')}</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.manager_org?.name || '—') + ' · ' + c.name + ' (' + c.service_kind + ')'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={fieldLabelStyle}>{t('contractor.slas.location')}</div>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={!chosen}
            style={{ ...inputStyle, width: '100%' }}
          >
            <option value="">
              {chosen ? t('contractor.slas.pick_location') : t('contractor.slas.pick_contract_first')}
            </option>
            {locs.map((cl) => (
              <option key={cl.location_id} value={cl.location_id}>
                {cl.locations?.name || cl.location_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {chosen && locationId && (
        <SlaForm
          initial={null}
          scope="agreement"
          onCancel={onCancel}
          onSave={async (draft) => {
            const id = draft.id || `sla-${draft.domain}-${Date.now()}`;
            const row = {
              ...draft,
              id,
              scope: 'agreement',
              organization_id: chosen.manager_org_id,
              authored_by_org: orgId,
              counterparty_org: orgId,
              contract_id: chosen.id,
              location_id: locationId,
              display_order: 0,
              active: true,
            };
            try {
              await insertSla.mutateAsync(row);
            } catch (e) {
              onError(e.message);
              throw e;
            }
            onSubmitted();
          }}
        />
      )}

      {(!chosen || !locationId) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnGhost}>
            {t('admin.sla.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}

// Local styles (kept narrow; slas-ui.jsx has the row + form styles).
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
const fieldLabelStyle = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.15,
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  marginBottom: 4,
};
