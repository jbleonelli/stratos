// Operations → Sources (contractor surface).
//
// Cross-customer roll-up of "Data source catalog entries I propose" —
// source_catalog rows where this contractor org sits in
// counterparty_org. Rows live in the customer's organization_id;
// RLS lets both parties read (via the counterparty_org branch of the
// source_catalog_read policy).
//
// Primary list view groups by customer. Each row uses the shared
// CatalogRow component from sources-ui.jsx so the chrome matches
// Agentic → Sources on the customer side.
//
// Propose new catalog entry flow:
//   1. Pick contract  → carries customer + service_kind + covered locations
//   2. (optional) Pick location  → leave blank for org-wide entry
//   3. Standard CatalogForm fields (name, signal_kind, transport, description)
//   4. Submit → insert with provider_kind='contractor',
//               authored_by_org    = current contractor org,
//               organization_id    = customer (contract.manager_org_id),
//               counterparty_org   = current contractor org,
//               contract_id, location_id, accepted_at = null
//
// The customer's Agentic → Sources → Catalog tab shows the same row
// with a Pending pill until they accept (accept_source_catalog RPC,
// PR 5 migration 148).

import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Card, Pill, AdaptivLoader } from './primitives.jsx';
import { useT } from './i18n.js';
import { confirmDialog } from './dialogs.jsx';
import { useSession } from './auth.js';
import {
  useContractorAuthoredCatalog,
  actorRoleForCatalog,
  updateCatalogEntry,
  deleteCatalogEntry,
} from './sources-data.js';
import { useContractorActiveContracts } from './queries/contractor.ts';
import { useInsertSourceCatalog } from './queries/sources.ts';
import { CatalogForm, CatalogRow, ErrBanner } from './sources-ui.jsx';

// ────── ContractorSourcesPage ────────────────────────────────────────

export function ContractorSourcesPage() {
  const t = useT();
  const session = useSession();
  const orgId = session?.organizationId;
  const { rows, loaded } = useContractorAuthoredCatalog(orgId);
  const [proposing, setProposing] = useState(false);
  const [editing, setEditing] = useState(null); // sla.id while edit-in-place (pending only)
  const [error, setError] = useState(null);

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
          <Icon.gateway size={14} style={{ color: 'var(--text-dim)' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t('contractor.sources.title')}</div>
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
              {t('contractor.sources.propose')}
            </button>
          )}
        </div>

        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55, maxWidth: 720 }}>
          {t('contractor.sources.body')}
        </p>

        {!loaded && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
            <AdaptivLoader size="sm" />
          </div>
        )}

        {loaded && rows.length === 0 && !proposing && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.55 }}>
            {t('contractor.sources.empty')}
            <br />
            {t('contractor.sources.empty_hint')}
          </div>
        )}

        <ErrBanner text={error} />

        {proposing && (
          <ProposeForm
            orgId={orgId}
            onCancel={() => setProposing(false)}
            onError={setError}
            onSubmitted={() => setProposing(false)}
          />
        )}
      </Card>

      {/* List grouped by customer */}
      {grouped.map((g) => (
        <Card key={g.customer?.id || 'unknown'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Icon.building size={13} style={{ color: 'var(--text-dim)' }} />
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>
              {g.customer?.name || t('contractor.sources.unknown_customer')}
            </div>
            <Pill tone="off">{g.items.length}</Pill>
          </div>
          {g.items.map((row) => (
            <CatalogRow
              key={row.id}
              row={row}
              editing={editing === row.id}
              isAdmin={true}
              actorRole={actorRoleForCatalog(row, orgId)}
              extraLine={row.location?.name ? `${t('contractor.sources.location')}: ${row.location.name}` : null}
              onEdit={() => {
                setEditing(row.id);
                setError(null);
              }}
              onCancel={() => setEditing(null)}
              onSave={async (patch) => {
                setError(null);
                // Strip scope (CatalogForm injects it for the same-org
                // toggle path; doesn't apply here).
                const { scope: _scope, ...rest } = patch;
                try {
                  await updateCatalogEntry(row.id, rest);
                  setEditing(null);
                } catch (e) {
                  setError(e.message);
                  throw e;
                }
              }}
              onAccept={undefined /* contractor proposed — customer accepts, not us */}
              onDelete={async () => {
                if (
                  !(await confirmDialog({
                    body: t('sources.catalog.delete_confirm', { name: row.name }),
                    danger: true,
                  }))
                )
                  return;
                setError(null);
                try {
                  await deleteCatalogEntry(row.id);
                } catch (e) {
                  setError(e.message);
                }
              }}
            />
          ))}
        </Card>
      ))}
    </div>
  );
}

// ────── ProposeForm ─────────────────────────────────────────────────

function ProposeForm({ orgId, onCancel, onError, onSubmitted }) {
  const t = useT();
  const { data: contracts = [], isSuccess: loaded } = useContractorActiveContracts(orgId);
  const insertSourceCatalog = useInsertSourceCatalog();
  const [contractId, setContractId] = useState('');
  const [locationId, setLocationId] = useState('');

  const chosen = contracts.find((c) => c.id === contractId);
  const locs = chosen?.contract_locations || [];

  // Reset location when contract changes.
  useEffect(() => {
    setLocationId('');
  }, [contractId]);

  if (!loaded) {
    return (
      <div style={{ padding: 12, color: 'var(--text-dim)', fontSize: 12 }}>
        {t('contractor.sources.loading_contracts')}
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div style={{ padding: 14, fontSize: 12.5, color: 'var(--text-soft)' }}>
        {t('contractor.sources.no_contracts')}
        <div style={{ marginTop: 10 }}>
          <button onClick={onCancel} style={btnGhost}>
            {t('sources.cancel')}
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
        {t('contractor.sources.propose_title')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={fieldLabelStyle}>{t('contractor.sources.contract')}</div>
          <select
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          >
            <option value="">{t('contractor.sources.pick_contract')}</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.manager_org?.name || '—') + ' · ' + c.name + ' (' + c.service_kind + ')'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={fieldLabelStyle}>{t('contractor.sources.location_optional')}</div>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={!chosen}
            style={{ ...inputStyle, width: '100%' }}
          >
            <option value="">
              {chosen ? t('contractor.sources.org_wide_location') : t('contractor.sources.pick_contract_first')}
            </option>
            {locs.map((cl) => (
              <option key={cl.location_id} value={cl.location_id}>
                {cl.locations?.name || cl.location_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {chosen && (
        <CatalogForm
          initial={null}
          allowContractor={true}
          lockProviderToContractor={true}
          onCancel={onCancel}
          onSave={async (draft) => {
            // Strip scope (form may inject it; doesn't apply here).
            const { scope: _scope, ...rest } = draft;
            // Build catalog row id with a sensible slug + uniqueness.
            const slug = (rest.name || 'entry').toLowerCase().replace(/[^a-z0-9]+/g, '_');
            const id = `ctr-${orgId}-${chosen.manager_org_id}-${slug}-${Date.now().toString(36)}`;
            const row = {
              ...rest,
              id,
              organization_id: chosen.manager_org_id,
              authored_by_org: orgId,
              counterparty_org: orgId,
              contract_id: chosen.id,
              location_id: locationId || null,
              provider_kind: 'contractor',
              status: 'available',
              active: true,
              display_order: 100,
            };
            try {
              await insertSourceCatalog.mutateAsync(row);
            } catch (e) {
              onError(e.message);
              throw e;
            }
            onSubmitted();
          }}
        />
      )}

      {!chosen && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnGhost}>
            {t('sources.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}

// Local styles (kept narrow; sources-ui.jsx has the row + form styles).
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
