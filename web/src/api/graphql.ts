// GraphQL documents for the events/asks slice. Kept as plain strings so the
// data layer has no codegen dependency (README: one thin, mockable seam).

export const ME = /* GraphQL */ `
  query Me {
    me { userId email fullName orgRole }
  }
`;

export const ORG_MEMBERS = /* GraphQL */ `
  query OrgMembers {
    orgMembers {
      userId email fullName orgRole userRole joinedAt locationGrantIds orgWideAccess
    }
  }
`;

export const UPDATE_ORGANIZATION = /* GraphQL */ `
  mutation UpdateOrganization($input: UpdateOrganizationInput!) {
    updateOrganization(input: $input) { id name slug kind lifecycleState createdAt }
  }
`;

export const UPDATE_MEMBER_ROLE = /* GraphQL */ `
  mutation UpdateMemberRole($input: UpdateMemberRoleInput!) {
    updateMemberRole(input: $input) {
      userId email fullName orgRole userRole joinedAt locationGrantIds orgWideAccess
    }
  }
`;

export const SET_MEMBER_LOCATION_GRANTS = /* GraphQL */ `
  mutation SetMemberLocationGrants($input: SetMemberLocationGrantsInput!) {
    setMemberLocationGrants(input: $input) {
      userId email fullName orgRole userRole joinedAt locationGrantIds orgWideAccess
    }
  }
`;

export const CREATE_ORGANIZATION = /* GraphQL */ `
  mutation CreateOrganization($input: CreateOrganizationInput!) {
    createOrganization(input: $input) { id name slug kind lifecycleState createdAt }
  }
`;

export const ORG_INVITES = /* GraphQL */ `
  query OrgInvites($status: InviteStatus) {
    orgInvites(status: $status) {
      id email orgRole status locationGrantIds orgWideAccess invitedBy expiresAt createdAt
    }
  }
`;

export const MY_PENDING_INVITES = /* GraphQL */ `
  query MyPendingInvites {
    myPendingInvites {
      id email orgRole status locationGrantIds orgWideAccess invitedBy expiresAt createdAt
    }
  }
`;

export const INVITE_ORG_MEMBER = /* GraphQL */ `
  mutation InviteOrgMember($input: InviteOrgMemberInput!) {
    inviteOrgMember(input: $input) {
      invite { id email orgRole status expiresAt createdAt }
      inviteToken
    }
  }
`;

export const REVOKE_ORG_INVITE = /* GraphQL */ `
  mutation RevokeOrgInvite($inviteId: ID!) {
    revokeOrgInvite(inviteId: $inviteId) { id email status }
  }
`;

export const ACCEPT_ORG_INVITE = /* GraphQL */ `
  mutation AcceptOrgInvite($input: AcceptOrgInviteInput!) {
    acceptOrgInvite(input: $input) {
      userId email fullName orgRole userRole joinedAt locationGrantIds orgWideAccess
    }
  }
`;

export const SERVICE_CONTRACTS = /* GraphQL */ `
  query ServiceContracts($status: ContractStatus) {
    serviceContracts(status: $status) {
      id customerOrgId contractorOrgId customerOrgName contractorOrgName
      name referenceCode status startsAt endsAt locationIds assigneeUserIds createdAt
      slaRules { severity responseMinutes }
    }
  }
`;

export const CONTRACTOR_ORGANIZATIONS = /* GraphQL */ `
  query ContractorOrganizations {
    contractorOrganizations { id name slug kind lifecycleState createdAt }
  }
`;

export const CREATE_SERVICE_CONTRACT = /* GraphQL */ `
  mutation CreateServiceContract($input: CreateServiceContractInput!) {
    createServiceContract(input: $input) {
      id name status referenceCode locationIds slaRules { severity responseMinutes }
    }
  }
`;

export const UPDATE_CONTRACT_STATUS = /* GraphQL */ `
  mutation UpdateContractStatus($id: ID!, $status: ContractStatus!) {
    updateContractStatus(id: $id, status: $status) { id status }
  }
`;

export const ORGANIZATION = /* GraphQL */ `
  query Organization {
    organization { id name slug kind lifecycleState createdAt }
  }
`;

export const LOCATIONS = /* GraphQL */ `
  query Locations {
    locations {
      id organizationId parentId name kind deviceCount latitude longitude floorPlanUrl floorElevation createdAt
    }
  }
`;

export const DEVICES = /* GraphQL */ `
  query Devices($locationId: ID, $limit: Int) {
    devices(locationId: $locationId, limit: $limit) {
      id organizationId locationId name kind status externalId positionX positionY createdAt
    }
  }
`;

export const WORK_ORDERS = /* GraphQL */ `
  query WorkOrders($status: WorkOrderStatus) {
    workOrders(status: $status) {
      id organizationId locationId deviceId contractId title description status photoUrl
      createdBy assignedTo createdAt completedAt
    }
  }
`;

export const CREATE_WORK_ORDER = /* GraphQL */ `
  mutation CreateWorkOrder($input: CreateWorkOrderInput!) {
    createWorkOrder(input: $input) {
      id title description status locationId deviceId contractId createdAt
    }
  }
`;

export const COMPLETE_WORK_ORDER = /* GraphQL */ `
  mutation CompleteWorkOrder($input: CompleteWorkOrderInput!) {
    completeWorkOrder(input: $input) {
      id status photoUrl completedAt
    }
  }
`;

export const ORG_METRICS = /* GraphQL */ `
  query OrgMetrics {
    orgMetrics {
      organizationId
      openAsks
      incidentsOpen
      eventsBySeverity { severity count }
      agentDecisions { decision count }
      agentCostCents24h
      devicesOnline
      devicesOffline
      devicesMaintenance
      locationCount
      eventsTrend7d { day count }
    }
  }
`;

export const INCIDENTS = /* GraphQL */ `
  query Incidents($limit: Int) {
    incidents(limit: $limit) {
      id organizationId locationId deviceId kind severity externalId payload createdAt
    }
  }
`;

export const AGENT_RUNS = /* GraphQL */ `
  query AgentRuns($limit: Int) {
    agentRuns(limit: $limit) {
      id organizationId eventId decision rationale costCents askId createdAt
    }
  }
`;

export const EVENTS = /* GraphQL */ `
  query Events($limit: Int) {
    events(limit: $limit) {
      id organizationId locationId deviceId kind severity externalId payload createdAt
    }
  }
`;

export const ASKS = /* GraphQL */ `
  query Asks($status: AskStatus) {
    asks(status: $status) {
      id organizationId locationId eventId question status answer createdAt resolvedAt
    }
  }
`;

export const RAISE_ASK = /* GraphQL */ `
  mutation RaiseAsk($input: RaiseAskInput!) {
    raiseAsk(input: $input) {
      id organizationId question status answer createdAt
    }
  }
`;

export const ANSWER_ASK = /* GraphQL */ `
  mutation AnswerAsk($input: AnswerAskInput!) {
    answerAsk(input: $input) {
      id status answer resolvedAt
    }
  }
`;

export const INGEST_EVENT = /* GraphQL */ `
  mutation IngestEvent($input: IngestEventInput!) {
    ingestEvent(input: $input) {
      id organizationId kind severity createdAt
    }
  }
`;

export const ON_ASK_RAISED = /* GraphQL */ `
  subscription OnAskRaised($organizationId: ID!) {
    onAskRaised(organizationId: $organizationId) {
      id organizationId question status createdAt
    }
  }
`;

export const ON_EVENT_INGESTED = /* GraphQL */ `
  subscription OnEventIngested($organizationId: ID!) {
    onEventIngested(organizationId: $organizationId) {
      id organizationId kind severity createdAt
    }
  }
`;

export const ON_AGENT_ACTIVITY = /* GraphQL */ `
  subscription OnAgentActivity($organizationId: ID!) {
    onAgentActivity(organizationId: $organizationId) {
      id organizationId eventId decision rationale costCents askId createdAt
    }
  }
`;
