// Stratos — AppSync Lambda resolver for the events/asks vertical slice.
//
// One Lambda handles every field on this slice. Flow per request:
//   1. derive the caller's claims from the AppSync Cognito identity
//   2. app-layer authorization (primary, mandated)
//   3. run the DB work through the claim bridge (RLS backstop) — reads go
//      straight to tables (RLS scopes them); writes go through SECURITY DEFINER
//      RPCs that scope to the caller's active org.
//
// The handler is transport-agnostic: `getConnection` yields a single DB
// connection (a pg Client in prod, a PGlite instance in tests).

import { withClaims, claimsFromIdentity } from './claim-bridge.mjs';
import { requireOrg } from './authz.mjs';
import { toOrganization, toEvent, toAsk } from './mappers.mjs';
import { defaultEmitter, signalFromEvent } from './event-emitter.mjs';

const one = (res) => res.rows[0] ?? null;

async function run(field, c, args, _claims) {
  const input = args?.input ?? {};
  switch (field) {
    case 'Query.organization':
      return toOrganization(
        one(await c.query('select * from public.organizations where id = (select public.current_user_org())')),
      );

    case 'Query.events': {
      const limit = Math.min(Math.max(args?.limit ?? 50, 1), 200);
      const res = await c.query(
        'select * from public.events order by created_at desc limit $1',
        [limit],
      );
      return res.rows.map(toEvent);
    }

    case 'Query.asks': {
      const res = await c.query(
        'select * from public.asks where ($1::text is null or status = $1::public.ask_status) order by created_at desc',
        [args?.status ?? null],
      );
      return res.rows.map(toAsk);
    }

    case 'Mutation.raiseAsk': {
      const id = one(
        await c.query('select public.raise_ask($1, $2, $3) as id', [
          input.question,
          input.locationId ?? null,
          input.eventId ?? null,
        ]),
      ).id;
      return toAsk(one(await c.query('select * from public.asks where id = $1', [id])));
    }

    case 'Mutation.answerAsk': {
      await c.query('select public.answer_ask($1, $2)', [input.askId, input.answer]);
      return toAsk(one(await c.query('select * from public.asks where id = $1', [input.askId])));
    }

    case 'Mutation.ingestEvent': {
      const payload = input.payload == null ? '{}' : typeof input.payload === 'string' ? input.payload : JSON.stringify(input.payload);
      const id = one(
        await c.query(
          'select public.ingest_event($1::public.event_kind, $2::public.event_severity, $3, $4, $5, $6::jsonb) as id',
          [input.kind, input.severity ?? 'info', input.locationId ?? null, input.deviceId ?? null, input.externalId ?? null, payload],
        ),
      ).id;
      return toEvent(one(await c.query('select * from public.events where id = $1', [id])));
    }

    default:
      throw new Error(`Unhandled field: ${field}`);
  }
}

/**
 * Factory.
 * @param {() => Promise<{query:Function, release?:Function}>} getConnection single connection
 * @param {{emit?: (signal:object) => Promise<unknown>}} [opts] `emit` pushes an
 *        ingested event onto the agent bus; defaults to a no-op. Production
 *        passes the EventBridge emitter.
 */
export function createResolver(getConnection, opts = {}) {
  const emit = opts.emit ?? defaultEmitter();
  return async function handler(event) {
    const claims = claimsFromIdentity(event.identity);
    const field = `${event.info.parentTypeName}.${event.info.fieldName}`;

    // App-layer authorization (primary). Every field on this slice requires an
    // authenticated caller with an active org (platform admins exempted).
    requireOrg(claims);

    const conn = await getConnection();
    let result;
    try {
      result = await withClaims(conn, claims, (c) => run(field, c, event.arguments ?? {}, claims));
    } finally {
      await conn.release?.();
    }

    // Signal the agent runtime that a new event landed (best-effort: the event
    // is already durable; a bus hiccup must not fail the mutation).
    if (field === 'Mutation.ingestEvent' && result) {
      try {
        await emit(signalFromEvent(result));
      } catch (err) {
        console.error('event signal emit failed', err);
      }
    }

    return result;
  };
}

// Default production handler: one pooled pg connection per invocation, emitting
// ingested events onto the agent bus.
export const handler = createResolver(
  async () => {
    const { getConnection } = await import('./pg-client.mjs');
    return getConnection();
  },
  { emit: (await import('./event-emitter.mjs')).makeEventBridgeEmitter() },
);
