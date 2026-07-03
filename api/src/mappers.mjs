// Stratos — map snake_case DB rows to the camelCase GraphQL shapes in
// schema.graphql. AppSync serves AWSJSON as a JSON string and AWSDateTime as an
// ISO-8601 string; we normalize both here.

const iso = (v) => (v instanceof Date ? v.toISOString() : v ?? null);
const json = (v) => (v == null ? null : typeof v === 'string' ? v : JSON.stringify(v));

export const toOrganization = (r) =>
  r && {
    id: r.id,
    name: r.name,
    slug: r.slug,
    kind: r.kind,
    lifecycleState: r.lifecycle_state,
    createdAt: iso(r.created_at),
  };

export const toMe = (r) =>
  r && {
    userId: r.user_id,
    email: r.email,
    fullName: r.full_name,
    orgRole: r.org_role,
  };

export const toOrgMember = (r) => {
  if (!r) return null;
  const grantIds = Array.isArray(r.location_grant_ids)
    ? r.location_grant_ids.map(String)
    : r.location_grant_ids
      ? [String(r.location_grant_ids)]
      : [];
  return {
    userId: r.user_id,
    email: r.email,
    fullName: r.full_name,
    orgRole: r.org_role,
    userRole: r.user_role,
    joinedAt: iso(r.joined_at),
    locationGrantIds: grantIds,
    orgWideAccess: grantIds.length === 0,
  };
};

const ORG_MEMBER_SELECT = `
  select om.user_id, om.role as org_role, om.joined_at, p.email, p.full_name, p.role as user_role,
         coalesce(
           (select array_agg(g.location_id order by g.location_id)
              from public.user_location_grants g
             where g.user_id = om.user_id and g.organization_id = om.org_id),
           '{}'::uuid[]
         ) as location_grant_ids
  from public.organization_members om
  join public.profiles p on p.user_id = om.user_id
  where om.org_id = (select public.current_user_org())
`;

export const orgMemberByUserId = (userId) =>
  `${ORG_MEMBER_SELECT} and om.user_id = $1`;

export const orgMemberInOrg = (orgId, userId) => `
  select om.user_id, om.role as org_role, om.joined_at, p.email, p.full_name, p.role as user_role,
         coalesce(
           (select array_agg(g.location_id order by g.location_id)
              from public.user_location_grants g
             where g.user_id = om.user_id and g.organization_id = om.org_id),
           '{}'::uuid[]
         ) as location_grant_ids
  from public.organization_members om
  join public.profiles p on p.user_id = om.user_id
  where om.org_id = $1 and om.user_id = $2
`;

export const orgMembersAll = () => `${ORG_MEMBER_SELECT} order by om.joined_at`;

export const toLocation = (r) =>
  r && {
    id: r.id,
    organizationId: r.organization_id,
    parentId: r.parent_id,
    name: r.name,
    kind: r.kind,
    deviceCount: Number(r.device_count ?? 0),
    latitude: r.latitude == null ? null : Number(r.latitude),
    longitude: r.longitude == null ? null : Number(r.longitude),
    floorPlanUrl: r.floor_plan_url,
    floorElevation: r.floor_elevation == null ? null : Number(r.floor_elevation),
    createdAt: iso(r.created_at),
  };

export const toDevice = (r) =>
  r && {
    id: r.id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    name: r.name,
    kind: r.kind,
    status: r.status,
    externalId: r.external_id,
    positionX: r.position_x == null ? null : Number(r.position_x),
    positionY: r.position_y == null ? null : Number(r.position_y),
    createdAt: iso(r.created_at),
  };

export const toEvent = (r) =>
  r && {
    id: r.id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    deviceId: r.device_id,
    kind: r.kind,
    severity: r.severity,
    externalId: r.external_id,
    payload: json(r.payload),
    createdAt: iso(r.created_at),
  };

export const toAgentRun = (r) =>
  r && {
    id: r.id,
    organizationId: r.organization_id,
    eventId: r.event_id,
    decision: r.decision,
    rationale: r.rationale,
    costCents: r.cost_cents,
    askId: null,
    createdAt: iso(r.created_at),
  };

/** Build OrgMetrics from parallel aggregate query results (RLS-scoped). */
export function toOrgMetrics(orgId, parts) {
  const deviceStatus = { online: 0, offline: 0, maintenance: 0 };
  for (const r of parts.devices.rows) deviceStatus[r.status] = Number(r.count);

  return {
    organizationId: orgId,
    openAsks: Number(parts.openAsks.rows[0]?.c ?? 0),
    incidentsOpen: Number(parts.incidents.rows[0]?.c ?? 0),
    eventsBySeverity: parts.severity.rows.map((r) => ({ severity: r.severity, count: Number(r.count) })),
    agentDecisions: parts.decisions.rows.map((r) => ({ decision: r.decision, count: Number(r.count) })),
    agentCostCents24h: Number(parts.cost.rows[0]?.c ?? 0),
    devicesOnline: deviceStatus.online,
    devicesOffline: deviceStatus.offline,
    devicesMaintenance: deviceStatus.maintenance,
    locationCount: Number(parts.locations.rows[0]?.c ?? 0),
    eventsTrend7d: parts.trend.rows.map((r) => ({ day: r.day, count: Number(r.count) })),
  };
}

export const toAsk = (r) =>
  r && {
    id: r.id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    eventId: r.event_id,
    question: r.question,
    status: r.status,
    answer: r.answer,
    createdBy: r.created_by,
    resolvedBy: r.resolved_by,
    createdAt: iso(r.created_at),
    resolvedAt: iso(r.resolved_at),
  };

const grantIdsFromRow = (ids) => {
  const grantIds = Array.isArray(ids) ? ids.map(String) : ids ? [String(ids)] : [];
  return { locationGrantIds: grantIds, orgWideAccess: grantIds.length === 0 };
};

export const toOrgInvite = (r) => {
  if (!r) return null;
  const grants = grantIdsFromRow(r.location_ids);
  return {
    id: r.id,
    email: r.email,
    orgRole: r.org_role,
    status: r.status,
    invitedBy: r.invited_by,
    expiresAt: iso(r.expires_at),
    createdAt: iso(r.created_at),
    ...grants,
  };
};

export const toSlaRule = (r) =>
  r && {
    severity: r.severity,
    responseMinutes: Number(r.response_minutes),
  };

export const toServiceContract = (r, slaRules = []) => {
  if (!r) return null;
  const locationIds = Array.isArray(r.location_ids) ? r.location_ids.map(String) : [];
  const assigneeUserIds = Array.isArray(r.assignee_user_ids) ? r.assignee_user_ids.map(String) : [];
  return {
    id: r.id,
    customerOrgId: r.customer_org_id,
    contractorOrgId: r.contractor_org_id,
    customerOrgName: r.customer_org_name,
    contractorOrgName: r.contractor_org_name,
    name: r.name,
    referenceCode: r.reference_code,
    status: r.status,
    startsAt: r.starts_at ?? null,
    endsAt: r.ends_at ?? null,
    locationIds,
    slaRules: slaRules.map(toSlaRule),
    assigneeUserIds,
    createdAt: iso(r.created_at),
  };
};

export const SERVICE_CONTRACT_SELECT = `
  select sc.*,
         co.name as customer_org_name,
         ctr.name as contractor_org_name,
         coalesce(
           (select array_agg(cl.location_id order by cl.location_id)
              from public.contract_locations cl where cl.contract_id = sc.id),
           '{}'::uuid[]
         ) as location_ids,
         coalesce(
           (select array_agg(ca.user_id order by ca.user_id)
              from public.contract_assignments ca where ca.contract_id = sc.id),
           '{}'::uuid[]
         ) as assignee_user_ids
    from public.service_contracts sc
    join public.organizations co on co.id = sc.customer_org_id
    join public.organizations ctr on ctr.id = sc.contractor_org_id
`;

export const serviceContractById = (id) => `${SERVICE_CONTRACT_SELECT} where sc.id = $1`;

export const serviceContractsAll = (status) =>
  `${SERVICE_CONTRACT_SELECT}
   where ($1::public.contract_status is null or sc.status = $1::public.contract_status)
     and (
       (select public.is_platform_admin())
       or sc.customer_org_id = (select public.current_user_org())
       or (
         sc.contractor_org_id = (select public.current_user_org())
         and (
           exists (
             select 1 from public.organization_members om
             where om.org_id = sc.contractor_org_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
           )
           or exists (
             select 1 from public.contract_assignments ca
             where ca.contract_id = sc.id and ca.user_id = auth.uid()
           )
         )
       )
     )
   order by sc.created_at desc`;

export const toWorkOrder = (r) =>
  r && {
    id: r.id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    deviceId: r.device_id,
    contractId: r.contract_id,
    title: r.title,
    description: r.description,
    status: r.status,
    photoUrl: r.photo_url,
    createdBy: r.created_by,
    assignedTo: r.assigned_to,
    createdAt: iso(r.created_at),
    completedAt: iso(r.completed_at),
  };
