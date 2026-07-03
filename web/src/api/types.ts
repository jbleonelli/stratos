// GraphQL shapes mirroring api/schema.graphql (events/asks slice).

export type EventKind = 'sensor_reading' | 'device_alert' | 'manual' | 'webhook' | 'schedule';
export type EventSeverity = 'info' | 'warning' | 'critical';
export type AskStatus = 'open' | 'answered' | 'dismissed' | 'expired';
export type OrgKind = 'customer' | 'platform';
export type OrgLifecycle = 'trial' | 'active' | 'suspended' | 'deleted';
export type OrgRole = 'owner' | 'admin' | 'member';
export type LocationKind = 'building' | 'floor' | 'zone' | 'room';
export type DeviceStatus = 'online' | 'offline' | 'maintenance';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  kind: OrgKind;
  lifecycleState: OrgLifecycle;
  createdAt: string;
}

export interface Me {
  userId: string;
  email: string;
  fullName: string | null;
  orgRole: OrgRole;
}

export interface OrgMember {
  userId: string;
  email: string;
  fullName: string | null;
  orgRole: OrgRole;
  userRole: string;
  joinedAt: string;
}

export interface SeverityCount {
  severity: EventSeverity;
  count: number;
}

export interface DecisionCount {
  decision: string;
  count: number;
}

export interface DayCount {
  day: string;
  count: number;
}

export interface OrgMetrics {
  organizationId: string;
  openAsks: number;
  incidentsOpen: number;
  eventsBySeverity: SeverityCount[];
  agentDecisions: DecisionCount[];
  agentCostCents24h: number;
  devicesOnline: number;
  devicesOffline: number;
  devicesMaintenance: number;
  locationCount: number;
  eventsTrend7d: DayCount[];
}

export interface Location {
  id: string;
  organizationId: string;
  parentId: string | null;
  name: string;
  kind: LocationKind;
  deviceCount: number;
  createdAt: string;
}

export interface Device {
  id: string;
  organizationId: string;
  locationId: string;
  name: string;
  kind: string;
  status: DeviceStatus;
  externalId: string | null;
  createdAt: string;
}

export interface Event {
  id: string;
  organizationId: string;
  locationId: string | null;
  deviceId: string | null;
  kind: EventKind;
  severity: EventSeverity;
  externalId: string | null;
  payload: string | null;
  createdAt: string;
}

export interface Ask {
  id: string;
  organizationId: string;
  locationId: string | null;
  eventId: string | null;
  question: string;
  status: AskStatus;
  answer: string | null;
  createdBy: string | null;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export type AgentDecision = 'act' | 'ask' | 'skip';

export interface AgentActivity {
  id: string;
  organizationId: string;
  eventId: string | null;
  decision: AgentDecision;
  rationale: string | null;
  costCents: number;
  askId: string | null;
  createdAt: string;
}

export interface RaiseAskInput {
  question: string;
  locationId?: string | null;
  eventId?: string | null;
}

export interface AnswerAskInput {
  askId: string;
  answer: string;
}

export interface IngestEventInput {
  kind: EventKind;
  severity?: EventSeverity;
  locationId?: string | null;
  deviceId?: string | null;
  externalId?: string | null;
  payload?: string | null;
}

export interface UpdateOrganizationInput {
  name: string;
}

export interface UpdateMemberRoleInput {
  userId: string;
  role: OrgRole;
}
