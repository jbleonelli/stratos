// React Query hooks over the GraphQL slice. Components never import the client
// or documents directly — they use these.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gql } from '../api/client';
import * as docs from '../api/graphql';
import type {
  Ask,
  AskStatus,
  Event,
  Organization,
  RaiseAskInput,
  AnswerAskInput,
  IngestEventInput,
} from '../api/types';

export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: async () => (await gql<{ organization: Organization | null }>(docs.ORGANIZATION)).organization,
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
