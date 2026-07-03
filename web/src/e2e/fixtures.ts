/** Deterministic fixtures aligned with db/seed/dev.sql (Alpha org). */

const ORG_ID = '0a1a0a1a-0000-0000-0000-000000000001';
const NOW = '2026-07-03T12:00:00.000Z';

export const E2E_SESSION = {
  orgId: ORG_ID,
  platformRole: null as string | null,
  email: 'admin@alpha.example',
};

export const E2E_FIXTURES = {
  organization: {
    id: ORG_ID,
    name: 'Alpha Properties',
    slug: 'alpha',
    kind: 'customer',
    lifecycleState: 'active',
    createdAt: NOW,
  },
  locations: [
    {
      id: '10c0a001-0000-0000-0000-000000000001',
      organizationId: ORG_ID,
      parentId: null,
      name: 'Alpha Tower',
      kind: 'building',
      deviceCount: 1,
      latitude: 40.7128,
      longitude: -74.006,
      floorPlanUrl: '/floor-plans/alpha-tower.svg',
      floorElevation: 0,
      createdAt: NOW,
    },
    {
      id: '10c0a001-0000-0000-0000-000000000002',
      organizationId: ORG_ID,
      parentId: '10c0a001-0000-0000-0000-000000000001',
      name: 'Alpha Annex',
      kind: 'floor',
      deviceCount: 1,
      latitude: null,
      longitude: null,
      floorPlanUrl: null,
      floorElevation: null,
      createdAt: NOW,
    },
  ],
  devices: [
    {
      id: 'de000a01-0000-0000-0000-000000000001',
      organizationId: ORG_ID,
      locationId: '10c0a001-0000-0000-0000-000000000001',
      name: 'Alpha Tower Thermostat',
      kind: 'thermostat',
      status: 'online',
      externalId: 'alpha-tower-t1',
      positionX: 0.7,
      positionY: 0.35,
      createdAt: NOW,
    },
    {
      id: 'de000a01-0000-0000-0000-000000000002',
      organizationId: ORG_ID,
      locationId: '10c0a001-0000-0000-0000-000000000002',
      name: 'Alpha Annex Thermostat',
      kind: 'thermostat',
      status: 'online',
      externalId: 'alpha-annex-t1',
      positionX: null,
      positionY: null,
      createdAt: NOW,
    },
  ],
  events: [
    {
      id: 'e5e00a01-0000-0000-0000-000000000001',
      organizationId: ORG_ID,
      locationId: '10c0a001-0000-0000-0000-000000000001',
      deviceId: 'de000a01-0000-0000-0000-000000000001',
      kind: 'device_alert',
      severity: 'warning',
      externalId: 'alpha-evt-1',
      payload: '{"temp_c":26.5}',
      createdAt: NOW,
    },
  ],
  incidents: [
    {
      id: 'e5e00a01-0000-0000-0000-000000000001',
      organizationId: ORG_ID,
      locationId: '10c0a001-0000-0000-0000-000000000001',
      deviceId: 'de000a01-0000-0000-0000-000000000001',
      kind: 'device_alert',
      severity: 'warning',
      externalId: 'alpha-evt-1',
      payload: '{"temp_c":26.5}',
      createdAt: NOW,
    },
    {
      id: 'e5e00a02-0000-0000-0000-000000000001',
      organizationId: ORG_ID,
      locationId: '10c0a001-0000-0000-0000-000000000002',
      deviceId: 'de000a01-0000-0000-0000-000000000002',
      kind: 'device_alert',
      severity: 'critical',
      externalId: 'alpha-evt-2',
      payload: '{"temp_c":31.2}',
      createdAt: NOW,
    },
  ],
  asks: [
    {
      id: 'a5c00a01-0000-0000-0000-000000000001',
      organizationId: ORG_ID,
      locationId: '10c0a001-0000-0000-0000-000000000001',
      eventId: 'e5e00a01-0000-0000-0000-000000000001',
      question: 'Alpha Tower is warm — lower the setpoint overnight?',
      status: 'open',
      answer: null,
      createdAt: NOW,
      resolvedAt: null,
    },
  ],
  agentRuns: [
    {
      id: 'a5000a01-0000-0000-0000-000000000001',
      organizationId: ORG_ID,
      eventId: 'e5e00a01-0000-0000-0000-000000000001',
      decision: 'ask',
      rationale: 'Temperature elevated — surfaced a question for the operator.',
      costCents: 2,
      askId: 'a5c00a01-0000-0000-0000-000000000001',
      createdAt: NOW,
    },
  ],
  orgMetrics: {
    organizationId: ORG_ID,
    openAsks: 1,
    incidentsOpen: 2,
    eventsBySeverity: [
      { severity: 'warning', count: 1 },
      { severity: 'critical', count: 1 },
    ],
    agentDecisions: [{ decision: 'ask', count: 1 }],
    agentCostCents24h: 2,
    devicesOnline: 2,
    devicesOffline: 0,
    devicesMaintenance: 0,
    locationCount: 2,
    eventsTrend7d: [
      { day: '2026-06-27', count: 0 },
      { day: '2026-06-28', count: 0 },
      { day: '2026-06-29', count: 0 },
      { day: '2026-06-30', count: 0 },
      { day: '2026-07-01', count: 1 },
      { day: '2026-07-02', count: 1 },
      { day: '2026-07-03', count: 1 },
    ],
  },
  serviceContracts: [
    {
      id: '5c000a01-0000-0000-0000-000000000001',
      customerOrgId: ORG_ID,
      contractorOrgId: '0c1c0c1c-0000-0000-0000-000000000001',
      customerOrgName: 'Alpha Properties',
      contractorOrgName: 'Swift HVAC',
      name: 'Alpha Tower HVAC',
      referenceCode: 'ALPHA-HVAC-01',
      status: 'active',
      startsAt: '2026-01-01',
      endsAt: null,
      locationIds: ['10c0a001-0000-0000-0000-000000000001'],
      assigneeUserIds: ['05e00c01-0000-0000-0000-000000000001'],
      slaRules: [
        { severity: 'critical', responseMinutes: 60 },
        { severity: 'warning', responseMinutes: 240 },
      ],
      createdAt: NOW,
    },
  ],
  workOrders: [
    {
      id: 'a9000a01-0000-0000-0000-000000000001',
      organizationId: ORG_ID,
      locationId: '10c0a001-0000-0000-0000-000000000001',
      deviceId: 'de000a01-0000-0000-0000-000000000001',
      contractId: '5c000a01-0000-0000-0000-000000000001',
      title: 'Inspect warm zone sensor',
      description: 'Alpha Tower thermostat reading elevated — verify HVAC response.',
      status: 'open',
      photoUrl: null,
      createdBy: '05e00c01-0000-0000-0000-000000000001',
      assignedTo: null,
      createdAt: NOW,
      completedAt: null,
    },
  ],
  orgMembers: [
    {
      userId: '05e00a01-0000-0000-0000-000000000001',
      email: 'admin@alpha.example',
      fullName: 'Alpha Admin',
      orgRole: 'admin',
      userRole: 'facility_manager',
      joinedAt: NOW,
      locationGrantIds: [],
      orgWideAccess: true,
    },
  ],
  orgInvites: [] as unknown[],
  contractorOrganizations: [
    {
      id: '0c1c0c1c-0000-0000-0000-000000000001',
      name: 'Swift HVAC',
      slug: 'swift-hvac',
      kind: 'contractor',
      lifecycleState: 'active',
      createdAt: NOW,
    },
  ],
  me: {
    userId: '05e00a01-0000-0000-0000-000000000001',
    email: 'admin@alpha.example',
    fullName: 'Alpha Admin',
    orgRole: 'admin',
  },
};

function opName(query: string): string | null {
  const m = query.match(/\b(query|mutation)\s+(\w+)/);
  return m?.[2] ?? null;
}

export async function mockGql<T>(query: string, _variables?: Record<string, unknown>): Promise<T> {
  const op = opName(query);
  const f = E2E_FIXTURES;

  switch (op) {
    case 'Me':
      return { me: f.me } as T;
    case 'Organization':
      return { organization: f.organization } as T;
    case 'Locations':
      return { locations: f.locations } as T;
    case 'Devices':
      return { devices: f.devices } as T;
    case 'Events':
      return { events: f.events } as T;
    case 'Incidents':
      return { incidents: f.incidents } as T;
    case 'Asks':
      return { asks: f.asks } as T;
    case 'AgentRuns':
      return { agentRuns: f.agentRuns } as T;
    case 'OrgMetrics':
      return { orgMetrics: f.orgMetrics } as T;
    case 'ServiceContracts':
      return { serviceContracts: f.serviceContracts } as T;
    case 'WorkOrders':
      return { workOrders: f.workOrders } as T;
    case 'OrgMembers':
      return { orgMembers: f.orgMembers } as T;
    case 'OrgInvites':
      return { orgInvites: f.orgInvites } as T;
    case 'ContractorOrganizations':
      return { contractorOrganizations: f.contractorOrganizations } as T;
    case 'MyPendingInvites':
      return { myPendingInvites: [] } as T;
    case 'RaiseAsk':
      return {
        raiseAsk: {
          id: 'e2e-ask-new',
          organizationId: ORG_ID,
          question: String(_variables?.input && typeof _variables.input === 'object' ? (_variables.input as { question?: string }).question : 'New ask'),
          status: 'open',
          answer: null,
          createdAt: NOW,
        },
      } as T;
    case 'AnswerAsk':
      return {
        answerAsk: {
          id: String(_variables?.input && typeof _variables.input === 'object' ? (_variables.input as { askId?: string }).askId : ''),
          status: 'answered',
          answer: 'Acknowledged in E2E.',
          resolvedAt: NOW,
        },
      } as T;
    default:
      return {} as T;
  }
}
