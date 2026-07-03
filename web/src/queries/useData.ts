// React Query hooks over the GraphQL slice. Components never import the client
// or documents directly — they use these.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gql } from '../api/client';
import * as docs from '../api/graphql';
import type {
  AgentActivity,
  Ask,
  AskStatus,
  Device,
  Event,
  Location,
  Me,
  OrgMember,
  Organization,
  OrgMetrics,
  RaiseAskInput,
  AnswerAskInput,
  IngestEventInput,
  UpdateOrganizationInput,
  UpdateMemberRoleInput,
} from '../api/types';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => (await gql<{ me: Me }>(docs.ME)).me,
  });
}

export function useOrgMembers() {
  return useQuery({
    queryKey: ['orgMembers'],
    queryFn: async () => (await gql<{ orgMembers: OrgMember[] }>(docs.ORG_MEMBERS)).orgMembers,
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateOrganizationInput) =>
      (await gql<{ updateOrganization: Organization }>(docs.UPDATE_ORGANIZATION, { input })).updateOrganization,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization'] });
    },
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateMemberRoleInput) =>
      (await gql<{ updateMemberRole: OrgMember }>(docs.UPDATE_MEMBER_ROLE, { input })).updateMemberRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgMembers'] }),
  });
}

export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: async () => (await gql<{ organization: Organization | null }>(docs.ORGANIZATION)).organization,
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await gql<{ locations: Location[] }>(docs.LOCATIONS)).locations,
  });
}

export function useDevices(locationId?: string | null) {
  return useQuery({
    queryKey: ['devices', locationId ?? 'all'],
    queryFn: async () =>
      (await gql<{ devices: Device[] }>(docs.DEVICES, { locationId: locationId ?? null, limit: 200 })).devices,
  });
}

export function useOrgMetrics() {
  return useQuery({
    queryKey: ['orgMetrics'],
    queryFn: async () => (await gql<{ orgMetrics: OrgMetrics }>(docs.ORG_METRICS)).orgMetrics,
  });
}

export function useIncidents(limit = 50) {
  return useQuery({
    queryKey: ['incidents', limit],
    queryFn: async () => (await gql<{ incidents: Event[] }>(docs.INCIDENTS, { limit })).incidents,
  });
}

export function useAgentRuns(limit = 50) {
  return useQuery({
    queryKey: ['agentRuns', limit],
    queryFn: async () => (await gql<{ agentRuns: AgentActivity[] }>(docs.AGENT_RUNS, { limit })).agentRuns,
  });
}

export function useEvents(limit = 50) {
  return useQuery({
    queryKey: ['events', limit],
    queryFn: async () => (await gql<{ events: Event[] }>(docs.EVENTS, { limit })).events,
  });
}

export function useAsks(status?: AskStatus) {
  return useQuery({
    queryKey: ['asks', status ?? 'all'],
    queryFn: async () => (await gql<{ asks: Ask[] }>(docs.ASKS, { status: status ?? null })).asks,
  });
}

export function useRaiseAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RaiseAskInput) =>
      (await gql<{ raiseAsk: Ask }>(docs.RAISE_ASK, { input })).raiseAsk,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asks'] }),
  });
}

export function useAnswerAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AnswerAskInput) =>
      (await gql<{ answerAsk: Ask }>(docs.ANSWER_ASK, { input })).answerAsk,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asks'] }),
  });
}

export function useIngestEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IngestEventInput) =>
      (await gql<{ ingestEvent: Event }>(docs.INGEST_EVENT, { input })).ingestEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}
