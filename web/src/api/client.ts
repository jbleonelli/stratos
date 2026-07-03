// Thin AppSync client seam. Components/hooks call gql()/subscribe(); nothing else
// touches Amplify. Result typing is kept local so there's no coupling to
// Amplify's exported generics.

import { generateClient } from 'aws-amplify/api';
import { mockGql } from '../e2e/fixtures';

const isE2e = import.meta.env.VITE_E2E === '1';
const client = isE2e ? null : generateClient();

interface GqlResult<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface Observableish<T> {
  subscribe(handlers: {
    next: (msg: { data: T }) => void;
    error?: (err: unknown) => void;
  }): { unsubscribe: () => void };
}

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (isE2e) return mockGql<T>(query, variables);
  const res = (await client!.graphql({ query, variables })) as GqlResult<T>;
  if (res.errors?.length) {
    throw new Error(res.errors.map((e) => e.message).join('; '));
  }
  return res.data as T;
}

export function subscribe<T>(
  query: string,
  variables: Record<string, unknown>,
  onData: (value: T) => void,
  onError?: (err: unknown) => void,
): { unsubscribe: () => void } {
  if (isE2e) return { unsubscribe: () => undefined };
  const observable = client!.graphql({ query, variables }) as unknown as Observableish<T>;
  return observable.subscribe({
    next: (msg) => onData(msg.data),
    error: (err) => onError?.(err),
  });
}
