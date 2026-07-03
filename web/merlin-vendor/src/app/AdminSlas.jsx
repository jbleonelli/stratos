// SLAs admin section — the Organization → SLAs tab. Extracted from Admin.jsx
// (god-file split) as a self-contained island: SlasSection (the public,
// dispatcher-mounted shell) plus its TabBtn / AgreementsList / TargetsList
// internals. Reuses the shared SLA form/row primitives from slas-ui.jsx (also
// used by the contractor Operations → SLAs surface) and the Admin button style
// from admin-ui.jsx. Behaviour-preserving move; see the god-file recipe.
import React, { useState, useMemo } from 'react';
import { Icon } from './icons.jsx';
import { Pill, Card, AdaptivLoader } from './primitives.jsx';
import { btnPrimary } from './admin-ui.tsx';
import { useSlas, acceptSla, actorRoleForAgreement, setTargetVisibility, useSlaSourceHealth } from './slas-data.js';
import { useSourceCatalog } from './sources-data.js';
import { SlaForm, SlaRow, ErrBanner, stripImmutable } from './slas-ui.jsx';
import { useInsertSla, useUpdateSla, useDeleteSla } from './queries/slas.ts';
import { useSession } from './auth.js';
import { useIsOrgAdmin } from './org-data.js';
import { confirmDialog } from './dialogs.jsx';
import { useT } from './i18n.js';

// ─────────────────────────── SLAs (Track S) ───────────────────────────
//
// Per-org SLA editor. Lists active SLAs from public.slas with quick actions
// (edit, delete) and an inline create form. RLS gates writes to facility +
// superadmin members of the org. Realtime keeps the list in sync with
// other tabs that may be editing.

// SLA_DOMAIN_OPTIONS, SLA_METRIC_OPTIONS, SLA_DOMAIN_ICON moved to
// slas-ui.jsx so the contractor surface (Operations → SLAs) can share
// the same option catalogs without dragging the Admin lazy chunk in.

// SlasSection — tabbed shell. "Agreements" (scope='agreement', the
// formal commitments) is the default; "Targets" (scope='target',
// informal KPIs anyone can author) is the new tab. The two share
// SlaForm + SlaRow with scope-aware variations.
export function SlasSection() {
  const t = useT();
  const [tab, setTab] = useState('agreements');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad)' }}>
      <div style={{ display: 'flex', gap: 4, padding: '0 2px' }}>
        <TabBtn active={tab === 'agreements'} onClick={() => setTab('agreements')}>
          {t('admin.sla.tab.agreements')}
        </TabBtn>
        <TabBtn active={tab === 'targets'} onClick={() => setTab('targets')}>
          {t('admin.sla.tab.targets')}
        </TabBtn>
      </div>
      {tab === 'agreements' ? <AgreementsList /> : <TargetsList />}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        fontSize: 12.5,
        fontWeight: 600,
        background: active ? 'var(--surface)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-soft)',
        border: '1px solid var(--border)',
        borderBottom: active ? '1px solid var(--surface)' : '1px solid var(--border)',
        borderRadius: '7px 7px 0 0',
        marginBottom: -1,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function AgreementsList() {
  const t = useT();
  const session = useSession();
  const orgId = session?.organizationId;
  const { slas, loaded } = useSlas(orgId, { scope: 'agreement' });
  const isAdmin = useIsOrgAdmin();
  const insertSla = useInsertSla();
  const updateSla = useUpdateSla();
  const deleteSla = useDeleteSla();
  const [editing, setEditing] = useState(null); // null | 'new' | sla.id (in-place edit on pending rows)
  const [proposingVersionOf, setProposingVersionOf] = useState(null); // null | accepted-sla.id (new-version author)
  const [error, setError] = useState(null);

  // PR 6: catalog list (no per-building filter — every catalog entry
  // available org-wide as a potential source dep) + derived source
  // health for each SLA.
  const { rows: catalogRows } = useSourceCatalog(orgId, { buildingId: 'all' });
  const { byId: sourceHealthById } = useSlaSourceHealth(orgId);
  const catalogById = useMemo(() => {
    const m = {};
    for (const c of catalogRows) m[c.id] = c;
    return m;
  }, [catalogRows]);

  // Map predecessor-id → pending successor row. Used to render the
  // "v2 pending — review it instead" hint on accepted rows that have
  // a proposed amendment waiting on the counterparty.
  const successorMap = useMemo(() => {
    const map = {};
    for (const s of slas) {
      if (s.scope === 'agreement' && !s.accepted_at && s.superseded_by) {
        map[s.superseded_by] = s;
      }
    }
    return map;
  }, [slas]);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon.shield size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.sla.title')}</div>
        <Pill tone="info">{slas.length}</Pill>
        <div style={{ flex: 1 }} />
        {isAdmin && editing !== 'new' && !proposingVersionOf && (
          <button
            onClick={() => {
              setEditing('new');
              setError(null);
            }}
            style={btnPrimary}
          >
            {t('admin.sla.new')}
          </button>
        )}
      </div>

      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55, maxWidth: 720 }}>
        {t('admin.sla.body')}
      </p>

      {!loaded && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <AdaptivLoader size="sm" />
        </div>
      )}

      {loaded && slas.length === 0 && editing !== 'new' && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.55 }}>
          {t('admin.sla.empty')}
          <br />
          {isAdmin
            ? (() => {
                const tmpl = t('admin.sla.empty_admin', { strong: 'XSTRONGX' });
                const [pre, post = ''] = tmpl.split('XSTRONGX');
                return (
                  <>
                    {pre}
                    <b>{t('admin.sla.new')}</b>
                    {post}
                  </>
                );
              })()
            : t('admin.sla.empty_non_admin')}
        </div>
      )}

      {error && <ErrBanner text={error} />}

      {editing === 'new' && (
        <SlaForm
          initial={null}
          scope="agreement"
          catalogById={catalogById}
          onCancel={() => setEditing(null)}
          onSave={async (draft) => {
            setError(null);
            const id = draft.id || `sla-${draft.domain}-${Date.now()}`;
            const row = {
              ...draft,
              id,
              scope: 'agreement',
              organization_id: orgId,
              authored_by_org: orgId,
              display_order: (slas[slas.length - 1]?.display_order || 0) + 1,
              active: true,
            };
            try {
              await insertSla.mutateAsync(row);
            } catch (e) {
              setError(e.message);
              throw e;
            }
            setEditing(null);
          }}
        />
      )}

      {/* Inline new-version author. Predecessor terms pre-fill the form
          via `initial`; on save we INSERT a fresh row with superseded_by
          pointing at the predecessor + accepted_at=null. The counterparty
          (or, for internal SLAs where author = accepter, the same admin
          back at their desk) then sees a pending v2 to accept. */}
      {proposingVersionOf &&
        (() => {
          const predecessor = slas.find((s) => s.id === proposingVersionOf);
          if (!predecessor) return null;
          return (
            <div
              style={{
                marginBottom: 12,
                padding: 14,
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-soft)' }}>
                {t('admin.sla.new_version')} — <span style={{ color: 'var(--text)' }}>{predecessor.name}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
                {t('admin.sla.new_version_hint')}
              </div>
              <SlaForm
                initial={predecessor}
                scope="agreement"
                catalogById={catalogById}
                onCancel={() => setProposingVersionOf(null)}
                onSave={async (draft) => {
                  setError(null);
                  const newId = `sla-${draft.domain}-${Date.now()}`;
                  const row = {
                    ...draft,
                    id: newId,
                    scope: 'agreement',
                    organization_id: predecessor.organization_id,
                    authored_by_org: orgId,
                    counterparty_org: predecessor.counterparty_org,
                    contract_id: predecessor.contract_id,
                    location_id: predecessor.location_id,
                    superseded_by: predecessor.id,
                    display_order: (predecessor.display_order || 0) + 1,
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
          );
        })()}

      {slas.map((sla) => (
        <SlaRow
          key={sla.id}
          sla={sla}
          editing={editing === sla.id}
          isAdmin={isAdmin}
          actorRole={actorRoleForAgreement(sla, orgId)}
          hasPendingSuccessor={!!successorMap[sla.id]}
          sourceHealth={sourceHealthById[sla.id]}
          catalogById={catalogById}
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
            if (!(await confirmDialog({ body: t('admin.sla.cancel_pending_confirm'), danger: true }))) return;
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
            if (!(await confirmDialog({ body: t('admin.sla.delete_confirm', { name: sla.name }), danger: true })))
              return;
            setError(null);
            try {
              await deleteSla.mutateAsync(sla.id);
            } catch (e) {
              setError(e.message);
            }
          }}
        />
      ))}
    </Card>
  );
}

function TargetsList() {
  const t = useT();
  const session = useSession();
  const { slas, loaded } = useSlas(session?.organizationId, { scope: 'target' });
  const isAdmin = useIsOrgAdmin(); // PR 6: admin can promote a target's visibility to org-wide
  const insertSla = useInsertSla();
  const updateSla = useUpdateSla();
  const deleteSla = useDeleteSla();
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  // Anyone in the org can author a target — no isAdmin gate on create.
  // Admin status only changes which visibility values are available in
  // the per-row visibility selector below (org-wide requires admin).
  const visibilityOpts = isAdmin ? ['private', 'team', 'org'] : ['private', 'team'];

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon.sparkle size={14} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.sla.tab.targets')}</div>
        <Pill tone="info">{slas.length}</Pill>
        <div style={{ flex: 1 }} />
        {editing !== 'new' && (
          <button
            onClick={() => {
              setEditing('new');
              setError(null);
            }}
            style={btnPrimary}
          >
            {t('admin.sla.targets.new')}
          </button>
        )}
      </div>

      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-soft)', lineHeight: 1.55, maxWidth: 720 }}>
        {t('admin.sla.targets.body')}
      </p>

      {!loaded && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <AdaptivLoader size="sm" />
        </div>
      )}

      {loaded && slas.length === 0 && editing !== 'new' && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.55 }}>
          {t('admin.sla.targets.empty')}
          <br />
          {t('admin.sla.targets.empty_hint')}
        </div>
      )}

      {error && <ErrBanner text={error} />}

      {editing === 'new' && (
        <SlaForm
          initial={null}
          scope="target"
          onCancel={() => setEditing(null)}
          onSave={async (draft) => {
            setError(null);
            const id = draft.id || `tgt-${draft.domain}-${Date.now()}`;
            const row = {
              ...draft,
              id,
              scope: 'target',
              organization_id: session.organizationId,
              created_by: session.userId,
              visibility: 'private',
              display_order: (slas[slas.length - 1]?.display_order || 0) + 1,
              active: true,
            };
            try {
              await insertSla.mutateAsync(row);
            } catch (e) {
              setError(e.message);
              throw e;
            }
            setEditing(null);
          }}
        />
      )}

      {slas.map((sla) => {
        // Visibility is editable when the caller is either the creator
        // or an admin. Creator gets private/team; admin gets all three
        // (the RPC enforces this server-side too, the client gate just
        // avoids surfacing options that'd fail).
        const isCreator = sla.created_by === session?.userId;
        const canEditVis = isAdmin || isCreator;
        const visOpts = isAdmin ? visibilityOpts : ['private', 'team'];
        return (
          <SlaRow
            key={sla.id}
            sla={sla}
            editing={editing === sla.id}
            isAdmin={true} // Creator can always edit their own target's terms (RLS gates it).
            visibilityOptions={visOpts}
            onSetVisibility={
              canEditVis
                ? async (next) => {
                    setError(null);
                    try {
                      await setTargetVisibility(sla.id, next);
                    } catch (e) {
                      setError(e.message);
                    }
                  }
                : undefined
            }
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
            onDelete={async () => {
              if (
                !(await confirmDialog({
                  body: t('admin.sla.targets.delete_confirm', { name: sla.name }),
                  danger: true,
                }))
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
        );
      })}
    </Card>
  );
}

// stripImmutable + ErrBanner live in slas-ui.jsx (shared with contractor surface).

// SlaRow + SlaForm imported from slas-ui.jsx.
