// GraphQL documents for the events/asks slice. Kept as plain strings so the
// data layer has no codegen dependency (README: one thin, mockable seam).

export const ME = /* GraphQL */ `
  query Me {
    me { userId email fullName orgRole }
  }
`;

export const ORG_MEMBERS = /* GraphQL */ `
  query OrgMembers {
    orgMembers { userId email fullName orgRole userRole joinedAt }
  }
`;

export const UPDATE_ORGANIZATION = /* GraphQL */ `
  mutation UpdateOrganization($input: UpdateOrganizationInput!) {
    updateOrganization(input: $input) { id name slug kind lifecycleState createdAt }
  }
`;

export const UPDATE_MEMBER_ROLE = /* GraphQL */ `
  mutation UpdateMemberRole($input: UpdateMemberRoleInput!) {
    updateMemberRole(input: $input) { userId email fullName orgRole userRole joinedAt }
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
      id organizationId parentId name kind deviceCount createdAt
    }
  }
`;

export const DEVICES = /* GraphQL */ `
  query Devices($locationId: ID, $limit: Int) {
    devices(locationId: $locationId, limit: $limit) {
      id organizationId locationId name kind status externalId createdAt
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
