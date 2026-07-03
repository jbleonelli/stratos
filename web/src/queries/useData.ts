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
  SetMemberLocationGrantsInput,
  CreateOrganizationInput,
  InviteOrgMemberInput,
  InviteOrgMemberPayload,
  AcceptOrgInviteInput,
  OrgInvite,
  InviteStatus,
  ServiceContract,
  ContractStatus,
  CreateServiceContractInput,
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

export function useSetMemberLocationGrants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetMemberLocationGrantsInput) =>
      (await gql<{ setMemberLocationGrants: OrgMember }>(docs.SET_MEMBER_LOCATION_GRANTS, { input }))
        .setMemberLocationGrants,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgMembers'] }),
  });
}

export function useOrganization(enabled = true) {
  return useQuery({
    queryKey: ['organization'],
    enabled,
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

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrganizationInput) =>
      (await gql<{ createOrganization: Organization }>(docs.CREATE_ORGANIZATION, { input })).createOrganization,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization'] });
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useOrgInvites(status?: InviteStatus) {
  return useQuery({
    queryKey: ['orgInvites', status ?? 'all'],
    queryFn: async () =>
      (await gql<{ orgInvites: OrgInvite[] }>(docs.ORG_INVITES, { status: status ?? null })).orgInvites,
  });
}

export function useMyPendingInvites(enabled = true) {
  return useQuery({
    queryKey: ['myPendingInvites'],
    enabled,
    queryFn: async () =>
      (await gql<{ myPendingInvites: OrgInvite[] }>(docs.MY_PENDING_INVITES)).myPendingInvites,
  });
}

export function useInviteOrgMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteOrgMemberInput) =>
      (await gql<{ inviteOrgMember: InviteOrgMemberPayload }>(docs.INVITE_ORG_MEMBER, { input })).inviteOrgMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgInvites'] }),
  });
}

export function useRevokeOrgInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) =>
      (await gql<{ revokeOrgInvite: OrgInvite }>(docs.REVOKE_ORG_INVITE, { inviteId })).revokeOrgInvite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgInvites'] }),
  });
}

export function useAcceptOrgInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AcceptOrgInviteInput) =>
      (await gql<{ acceptOrgInvite: OrgMember }>(docs.ACCEPT_ORG_INVITE, { input })).acceptOrgInvite,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session'] });
      qc.invalidateQueries({ queryKey: ['organization'] });
      qc.invalidateQueries({ queryKey: ['myPendingInvites'] });
    },
  });
}

export function useServiceContracts(status?: ContractStatus) {
  return useQuery({
    queryKey: ['serviceContracts', status ?? 'all'],
    queryFn: async () =>
      (await gql<{ serviceContracts: ServiceContract[] }>(docs.SERVICE_CONTRACTS, { status: status ?? null }))
        .serviceContracts,
  });
}

export function useContractorOrganizations() {
  return useQuery({
    queryKey: ['contractorOrganizations'],
    queryFn: async () =>
      (await gql<{ contractorOrganizations: Organization[] }>(docs.CONTRACTOR_ORGANIZATIONS)).contractorOrganizations,
  });
}

export function useCreateServiceContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateServiceContractInput) =>
      (await gql<{ createServiceContract: ServiceContract }>(docs.CREATE_SERVICE_CONTRACT, { input }))
        .createServiceContract,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['serviceContracts'] }),
  });
}

export function useUpdateContractStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ContractStatus }) =>
      (await gql<{ updateContractStatus: ServiceContract }>(docs.UPDATE_CONTRACT_STATUS, { id, status }))
        .updateContractStatus,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['serviceContracts'] }),
  });
}
