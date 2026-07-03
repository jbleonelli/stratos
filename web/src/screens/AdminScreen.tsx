import { useState } from 'react';
import {
  useLocations,
  useMe,
  useOrganization,
  useOrgMembers,
  useSetMemberLocationGrants,
  useUpdateMemberRole,
  useUpdateOrganization,
} from '../queries/useData';
import type { Location, OrgMember, OrgRole } from '../api/types';
import { Button, Card, DataError, PanelHead, Pill, TextInput } from '../ui/primitives';
import { Icon } from '../ui/icons';

const ORG_ROLES: OrgRole[] = ['owner', 'admin', 'member'];

const roleTone = (r: OrgRole) => (r === 'owner' ? 'accent' : r === 'admin' ? 'info' : 'neutral');

function initials(email: string, name?: string | null) {
  const src = (name || email || '?').trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function LocationScope({
  member,
  locations,
  canEdit,
  busy,
  onSave,
}: {
  member: OrgMember;
  locations: Location[];
  canEdit: boolean;
  busy: boolean;
  onSave: (locationIds: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const selected = draft ?? (member.orgWideAccess ? [] : member.locationGrantIds);
  const orgWide = selected.length === 0;
  const dirty =
    draft !== null &&
    (orgWide !== member.orgWideAccess ||
      selected.length !== member.locationGrantIds.length ||
      selected.some((id) => !member.locationGrantIds.includes(id)));

  const toggle = (id: string) => {
    const base = draft ?? (member.orgWideAccess ? [] : [...member.locationGrantIds]);
    setDraft(base.includes(id) ? base.filter((x) => x !== id) : [...base, id]);
  };

  const setOrgWide = () => setDraft([]);

  if (!canEdit) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {member.orgWideAccess ? (
          <Pill tone="ok">Org-wide</Pill>
        ) : (
          member.locationGrantIds.map((id) => {
            const loc = locations.find((l) => l.id === id);
            return (
              <Pill key={id} tone="neutral">
                {loc?.name ?? id.slice(0, 8)}
              </Pill>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Location access
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
        <input
          type="radio"
          name={`scope-${member.userId}`}
          checked={orgWide}
          disabled={busy}
          onChange={setOrgWide}
        />
        Org-wide (all locations)
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {locations.map((loc) => (
          <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!orgWide && selected.includes(loc.id)}
              disabled={busy || orgWide}
              onChange={() => toggle(loc.id)}
            />
            {loc.name}
          </label>
        ))}
      </div>
      {!orgWide && selected.length === 0 && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--warn)' }}>
          Select at least one location, or choose org-wide access.
        </p>
      )}
      {dirty && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Button
            disabled={busy || (!orgWide && selected.length === 0)}
            onClick={() => {
              onSave(orgWide ? [] : selected);
              setDraft(null);
            }}
          >
            {busy ? '…' : 'Save scope'}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setDraft(null)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  locations,
  canManage,
  isOwner,
  selfId,
  onRoleChange,
  onScopeSave,
  roleBusy,
  scopeBusy,
  scopeUserId,
}: {
  member: OrgMember;
  locations: Location[];
  canManage: boolean;
  isOwner: boolean;
  selfId?: string;
  onRoleChange: (userId: string, role: OrgRole) => void;
  onScopeSave: (userId: string, locationIds: string[]) => void;
  roleBusy: boolean;
  scopeBusy: boolean;
  scopeUserId?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const editable =
    canManage &&
    member.userId !== selfId &&
    (isOwner || (member.orgRole !== 'owner' && member.orgRole !== 'admin'));

  return (
    <li
      style={{
        padding: '10px 12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials(member.email, member.fullName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
            {member.fullName || member.email}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{member.email}</div>
        </div>
        {editable ? (
          <select
            value={member.orgRole}
            disabled={roleBusy}
            onChange={(e) => onRoleChange(member.userId, e.target.value as OrgRole)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-soft)',
              fontFamily: 'inherit',
            }}
          >
            {ORG_ROLES.filter((r) => isOwner || r !== 'owner').map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          <Pill tone={roleTone(member.orgRole)}>{member.orgRole}</Pill>
        )}
        {canManage && (
          <Button variant="ghost" onClick={() => setExpanded((v) => !v)} aria-label="Toggle location scope">
            {expanded ? '−' : '+'}
          </Button>
        )}
      </div>
      {(expanded || !canManage) && (
        <LocationScope
          member={member}
          locations={locations}
          canEdit={canManage && editable}
          busy={scopeBusy && scopeUserId === member.userId}
          onSave={(locationIds) => onScopeSave(member.userId, locationIds)}
        />
      )}
    </li>
  );
}

export function AdminScreen() {
  const { data: org } = useOrganization();
  const { data: me } = useMe();
  const { data: members = [], isLoading, isError, refetch } = useOrgMembers();
  const { data: locations = [] } = useLocations();
  const updateOrg = useUpdateOrganization();
  const updateRole = useUpdateMemberRole();
  const setScope = useSetMemberLocationGrants();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [scopeUserId, setScopeUserId] = useState<string | null>(null);

  const canAdmin = me?.orgRole === 'owner' || me?.orgRole === 'admin';
  const isOwner = me?.orgRole === 'owner';
  const editingName = nameDraft !== null;
  const displayName = nameDraft ?? org?.name ?? '';

  if (isError) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <DataError message="Couldn’t load admin settings." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <PanelHead title="Organization" />
        {org ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Pill tone="neutral">{org.slug}</Pill>
              <Pill tone={org.lifecycleState === 'active' ? 'ok' : 'warn'}>{org.lifecycleState}</Pill>
              <Pill tone="neutral">{org.kind}</Pill>
            </div>
            {canAdmin && editingName ? (
              <form
                style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!displayName.trim()) return;
                  updateOrg.mutate(
                    { name: displayName.trim() },
                    { onSuccess: () => setNameDraft(null) },
                  );
                }}
              >
                <TextInput value={displayName} onChange={setNameDraft} ariaLabel="Organization name" />
                <Button type="submit" disabled={updateOrg.isPending}>
                  {updateOrg.isPending ? '…' : 'Save'}
                </Button>
                <Button variant="ghost" onClick={() => setNameDraft(null)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{org.name}</span>
                {canAdmin && (
                  <Button variant="ghost" onClick={() => setNameDraft(org.name)}>
                    Rename
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
        )}
      </Card>

      <Card>
        <PanelHead
          title="Members"
          right={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon.people size={15} style={{ color: 'var(--text-dim)' }} />
              <Pill tone="neutral">{members.length}</Pill>
            </span>
          }
        />
        {isLoading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                locations={locations}
                canManage={canAdmin}
                isOwner={isOwner}
                selfId={me?.userId}
                roleBusy={updateRole.isPending}
                scopeBusy={setScope.isPending}
                scopeUserId={scopeUserId}
                onRoleChange={(userId, role) => updateRole.mutate({ userId, role })}
                onScopeSave={(userId, locationIds) => {
                  setScopeUserId(userId);
                  setScope.mutate(
                    { userId, locationIds },
                    { onSettled: () => setScopeUserId(null) },
                  );
                }}
              />
            ))}
          </ul>
        )}
        {!canAdmin && (
          <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--text-faint)' }}>
            You have read-only access to the roster.
          </p>
        )}
        {canAdmin && (
          <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--text-faint)' }}>
            Expand a member to set location scope. No locations selected means org-wide access.
          </p>
        )}
      </Card>
    </div>
  );
}
