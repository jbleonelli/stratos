import { useState } from 'react';
import {
  useMe,
  useOrganization,
  useOrgMembers,
  useUpdateMemberRole,
  useUpdateOrganization,
} from '../queries/useData';
import type { OrgMember, OrgRole } from '../api/types';
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

function MemberRow({
  member,
  canManage,
  isOwner,
  selfId,
  onRoleChange,
  busy,
}: {
  member: OrgMember;
  canManage: boolean;
  isOwner: boolean;
  selfId?: string;
  onRoleChange: (userId: string, role: OrgRole) => void;
  busy: boolean;
}) {
  const editable =
    canManage &&
    member.userId !== selfId &&
    (isOwner || (member.orgRole !== 'owner' && member.orgRole !== 'admin'));

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
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
          disabled={busy}
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
    </li>
  );
}

export function AdminScreen() {
  const { data: org } = useOrganization();
  const { data: me } = useMe();
  const { data: members = [], isLoading, isError, refetch } = useOrgMembers();
  const updateOrg = useUpdateOrganization();
  const updateRole = useUpdateMemberRole();
  const [nameDraft, setNameDraft] = useState<string | null>(null);

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
                canManage={canAdmin}
                isOwner={isOwner}
                selfId={me?.userId}
                busy={updateRole.isPending}
                onRoleChange={(userId, role) => updateRole.mutate({ userId, role })}
              />
            ))}
          </ul>
        )}
        {!canAdmin && (
          <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--text-faint)' }}>
            You have read-only access to the roster.
          </p>
        )}
      </Card>
    </div>
  );
}
