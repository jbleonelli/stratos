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
import { requireOrg, requireAuth } from './authz.mjs';
import {
  toOrganization,
  toMe,
  toOrgMember,
  toOrgInvite,
  orgMemberByUserId,
  orgMemberInOrg,
  orgMembersAll,
  toLocation,
  toDevice,
  toEvent,
  toAgentRun,
  toOrgMetrics,
  toAsk,
  toServiceContract,
  serviceContractById,
  serviceContractsAll,
} from './mappers.mjs';
import { inviteCognitoUser } from './cognito-admin.mjs';
import { defaultEmitter, signalFromEvent } from './event-emitter.mjs';

const AUTH_ONLY = new Set([
  'Mutation.createOrganization',
  'Mutation.acceptOrgInvite',
  'Query.myPendingInvites',
]);

const one = (res) => res.rows[0] ?? null;

async function fetchServiceContract(c, id) {
  const row = one(await c.query(serviceContractById(id), [id]));
  const sla = await c.query('select * from public.contract_sla_rules where contract_id = $1 order by severity', [id]);
  return toServiceContract(row, sla.rows);
}

async function fetchOrgMetrics(c) {
  const orgId = one(await c.query('select public.current_user_org() as id'))?.id;
  const [openAsks, incidents, severity, decisions, cost, devices, locations, trend] = await Promise.all([
    c.query(`select count(*)::int as c from public.asks where status = 'open'`),
    c.query(`select count(*)::int as c from public.events where severity in ('warning', 'critical')`),
    c.query(`select severity, count(*)::int as count from public.events group by severity`),
    c.query(`select decision, count(*)::int as count from public.agent_runs group by decision`),
    c.query(
      `select coalesce(sum(cost_cents), 0)::int as c
         from public.agent_runs
        where created_at > now() - interval '24 hours'`,
    ),
    c.query(`select status, count(*)::int as count from public.devices group by status`),
    c.query(`select count(*)::int as c from public.locations`),
    c.query(
      `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as count
         from public.events
        where created_at > now() - interval '7 days'
        group by 1
        order by 1`,
    ),
  ]);
  return toOrgMetrics(orgId, { openAsks, incidents, severity, decisions, cost, devices, locations, trend });
}

async function run(field, c, args, _claims) {
  const input = args?.input ?? {};
  switch (field) {
    case 'Query.me':
      return toMe(
        one(
          await c.query(
            `select p.user_id, p.email, p.full_name, om.role as org_role
               from public.profiles p
               join public.organization_members om
                 on om.user_id = p.user_id and om.org_id = (select public.current_user_org())
              where p.user_id = (select auth.uid())`,
          ),
        ),
      );

    case 'Query.organization':
      return toOrganization(
        one(await c.query('select * from public.organizations where id = (select public.current_user_org())')),
      );

    case 'Query.orgMembers': {
      const res = await c.query(orgMembersAll());
      return res.rows.map(toOrgMember);
    }

    case 'Query.orgInvites': {
      const res = await c.query(
        `select * from public.organization_invites
          where org_id = (select public.current_user_org())
            and ($1::public.invite_status is null or status = $1::public.invite_status)
          order by created_at desc`,
        [args?.status ?? null],
      );
      return res.rows.map(toOrgInvite);
    }

    case 'Query.myPendingInvites': {
      const res = await c.query('select * from public.my_pending_invites()');
      return res.rows.map(toOrgInvite);
    }

    case 'Query.contractorOrganizations': {
      const res = await c.query('select * from public.list_contractor_organizations()');
      return res.rows.map(toOrganization);
    }

    case 'Query.serviceContracts': {
      const res = await c.query(serviceContractsAll(args?.status ?? null), [args?.status ?? null]);
      const contracts = [];
      for (const row of res.rows) {
        const sla = await c.query('select * from public.contract_sla_rules where contract_id = $1 order by severity', [row.id]);
        contracts.push(toServiceContract(row, sla.rows));
      }
      return contracts;
    }

    case 'Query.locations': {
      const res = await c.query(
        `select l.*,
                (select count(*) from public.devices d where d.location_id = l.id)::int as device_count
           from public.locations l
          order by l.name`,
      );
      return res.rows.map(toLocation);
    }

    case 'Query.devices': {
      const limit = Math.min(Math.max(args?.limit ?? 200, 1), 500);
      const res = await c.query(
        `select * from public.devices
          where ($1::uuid is null or location_id = $1::uuid)
          order by name
          limit $2`,
        [args?.locationId ?? null, limit],
      );
      return res.rows.map(toDevice);
    }

    case 'Query.events': {
      const limit = Math.min(Math.max(args?.limit ?? 50, 1), 200);
      const res = await c.query(
        'select * from public.events order by created_at desc limit $1',
        [limit],
      );
      return res.rows.map(toEvent);
    }

    case 'Query.incidents': {
      const limit = Math.min(Math.max(args?.limit ?? 50, 1), 200);
      const res = await c.query(
        `select * from public.events
          where severity in ('warning', 'critical')
          order by created_at desc
          limit $1`,
        [limit],
      );
      return res.rows.map(toEvent);
    }

    case 'Query.agentRuns': {
      const limit = Math.min(Math.max(args?.limit ?? 50, 1), 200);
      const res = await c.query(
        'select * from public.agent_runs order by created_at desc limit $1',
        [limit],
      );
      return res.rows.map(toAgentRun);
    }

    case 'Query.orgMetrics':
      return fetchOrgMetrics(c);

    case 'Query.asks': {
      const res = await c.query(
        'select * from public.asks where ($1::text is null or status = $1::public.ask_status) order by created_at desc',
        [args?.status ?? null],
      );
      return res.rows.map(toAsk);
    }

    case 'Mutation.createOrganization': {
      await c.query('select public.ensure_profile($1, $2)', [_claims.email ?? '', null]);
      const orgId = one(await c.query('select public.self_serve_create_org($1) as id', [input.companyName])).id;
      return toOrganization(one(await c.query('select * from public.organizations where id = $1', [orgId])));
    }

    case 'Mutation.inviteOrgMember': {
      const row = one(
        await c.query('select * from public.create_org_invite($1, $2::public.org_role, $3::uuid[])', [
          input.email,
          input.role ?? 'member',
          input.locationIds ?? [],
        ]),
      );
      const invite = toOrgInvite(
        one(await c.query('select * from public.organization_invites where id = $1', [row.invite_id])),
      );
      return { invite, inviteToken: row.invite_token };
    }

    case 'Mutation.revokeOrgInvite': {
      const inviteId = args?.inviteId;
      await c.query('select public.revoke_org_invite($1)', [inviteId]);
      return toOrgInvite(one(await c.query('select * from public.organization_invites where id = $1', [inviteId])));
    }

    case 'Mutation.acceptOrgInvite': {
      const orgId = one(await c.query('select public.accept_org_invite($1) as id', [input.token])).id;
      return toOrgMember(one(await c.query(orgMemberInOrg(orgId, _claims.sub), [orgId, _claims.sub])));
    }

    case 'Mutation.createServiceContract': {
      const slaJson = JSON.stringify(
        (input.slaRules ?? []).map((r) => ({ severity: r.severity, responseMinutes: r.responseMinutes })),
      );
      const id = one(
        await c.query('select public.create_service_contract($1, $2, $3, $4::uuid[], $5::jsonb) as id', [
          input.contractorOrgId,
          input.name,
          input.referenceCode ?? null,
          input.locationIds,
          slaJson,
        ]),
      ).id;
      return fetchServiceContract(c, id);
    }

    case 'Mutation.updateContractStatus': {
      await c.query('select public.update_contract_status($1, $2::public.contract_status)', [args.id, args.status]);
      return fetchServiceContract(c, args.id);
    }

    case 'Mutation.assignContractMember': {
      await c.query('select public.assign_contract_member($1, $2)', [args.contractId, args.userId]);
      return fetchServiceContract(c, args.contractId);
    }

    case 'Mutation.updateOrganization': {
      await c.query('select public.update_org_name($1)', [input.name]);
      return toOrganization(
        one(await c.query('select * from public.organizations where id = (select public.current_user_org())')),
      );
    }

    case 'Mutation.updateMemberRole': {
      await c.query('select public.update_member_role($1, $2::public.org_role)', [input.userId, input.role]);
      return toOrgMember(one(await c.query(orgMemberByUserId(input.userId), [input.userId])));
    }

    case 'Mutation.setMemberLocationGrants': {
      await c.query('select public.set_member_location_grants($1, $2::uuid[])', [
        input.userId,
        input.locationIds ?? [],
      ]);
      return toOrgMember(one(await c.query(orgMemberByUserId(input.userId), [input.userId])));
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

    // App-layer authorization (primary).
    if (AUTH_ONLY.has(field)) {
      requireAuth(claims);
    } else {
      requireOrg(claims);
    }

    const conn = await getConnection();
    let result;
    try {
      result = await withClaims(conn, claims, (c) => run(field, c, event.arguments ?? {}, claims));
    } finally {
      await conn.release?.();
    }

    if (field === 'Mutation.inviteOrgMember' && result?.invite?.email) {
      try {
        await inviteCognitoUser(result.invite.email);
      } catch (err) {
        console.error('cognito invite failed', err);
      }
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
