// GraphQL documents for the events/asks slice. Kept as plain strings so the
// data layer has no codegen dependency (README: one thin, mockable seam).

export const ORGANIZATION = /* GraphQL */ `
  query Organization {
    organization { id name slug kind lifecycleState createdAt }
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
