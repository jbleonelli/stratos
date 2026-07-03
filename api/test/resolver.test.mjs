// Stratos — AppSync resolver vertical slice (events/asks).
//
// Runs the REAL Lambda resolver (src/resolver.mjs) against the baseline schema on
// PGlite, simulating AppSync events with Cognito identities. Proves the full
// resolver → claim-bridge → RLS path: queries, mutations, and app-layer authz.
// (Subscriptions are AppSync-native — declared in schema.graphql, triggered by
// the raiseAsk / ingestEvent mutations — so there is no resolver code to test.)
//
// Run: npm test   (from api/)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createResolver } from '../src/resolver.mjs';
import { loadTestSchema } from './load-test-schema.mjs';
import { ForbiddenError, UnauthenticatedError } from '../src/authz.mjs';
import { ORG, USER, ASK, LOC, CONTRACT } from '../../db/proof/fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const db = join(here, '..', '..', 'db');

let pg;
let handler;

before(async () => {
  pg = new PGlite();
  await loadTestSchema(pg, db);
  handler = createResolver(async () => pg); // single shared connection, no release
});

after(async () => {
  await pg?.close();
});

// AppSync identity + event helpers.
const identity = (sub, organization_id = null, platform_role = null, email = null) => ({
  sub,
  claims: { organization_id, platform_role, email },
});
const ev = (parentTypeName, fieldName, args, ident) => ({
  info: { parentTypeName, fieldName },
  arguments: args,
  identity: ident,
});

const AS = {
  alphaAdmin: identity(USER.alphaAdmin, ORG.alpha),
  alphaScoped: identity(USER.alphaScoped, ORG.alpha),
  betaAdmin: identity(USER.betaAdmin, ORG.beta),
  platform: identity(USER.platform, ORG.alpha, 'platform_admin'),
  swiftTech: identity(USER.swiftTech, ORG.swift, null, 'tech@swift.example'),
  noOrg: identity('05e0dead-0000-0000-0000-000000000001', null, null, 'newuser@example.com'),
  anonymous: null,
};

// ───────────────────────────── Queries ─────────────────────────────────────

test('Query.organization returns the caller active org', async () => {
  const org = await handler(ev('Query', 'organization', {}, AS.alphaAdmin));
  assert.equal(org.id, ORG.alpha);
  assert.equal(org.slug, 'alpha');
});

test('Query.events is org-scoped', async () => {
  const events = await handler(ev('Query', 'events', { limit: 50 }, AS.alphaAdmin));
  assert.equal(events.length, 2);
  assert.equal(events[0].organizationId, ORG.alpha);
});

test('Query.events for a platform admin spans tenants', async () => {
  const events = await handler(ev('Query', 'events', {}, AS.platform));
  assert.equal(events.length, 3);
});

test('Query.incidents returns only warning and critical events', async () => {
  const inc = await handler(ev('Query', 'incidents', {}, AS.alphaAdmin));
  assert.equal(inc.length, 2);
  assert.ok(inc.every((e) => e.severity === 'warning' || e.severity === 'critical'));
  assert.ok(!inc.some((e) => e.severity === 'info'));
});

test('Query.incidents respects per-user location grants', async () => {
  const inc = await handler(ev('Query', 'incidents', {}, AS.alphaScoped));
  assert.equal(inc.length, 1);
  assert.equal(inc[0].severity, 'warning');
});

test('Query.agentRuns is org-scoped', async () => {
  const runs = await handler(ev('Query', 'agentRuns', {}, AS.alphaAdmin));
  assert.equal(runs.length, 1);
  assert.equal(runs[0].decision, 'ask');
  assert.equal(runs[0].organizationId, ORG.alpha);
});

test('Query.agentRuns for a platform admin spans tenants', async () => {
  const runs = await handler(ev('Query', 'agentRuns', {}, AS.platform));
  assert.equal(runs.length, 2);
});

test('Query.orgMetrics aggregates org-scoped KPIs', async () => {
  const m = await handler(ev('Query', 'orgMetrics', {}, AS.alphaAdmin));
  assert.equal(m.organizationId, ORG.alpha);
  assert.equal(m.openAsks, 1);
  assert.equal(m.incidentsOpen, 2);
  assert.equal(m.locationCount, 2);
  assert.equal(m.devicesOnline, 2);
  assert.equal(m.agentDecisions.find((d) => d.decision === 'ask')?.count, 1);
  const sev = Object.fromEntries(m.eventsBySeverity.map((s) => [s.severity, s.count]));
  assert.equal(sev.warning, 1);
  assert.equal(sev.critical, 1);
});

test('Query.orgMetrics respects per-user location grants', async () => {
  const m = await handler(ev('Query', 'orgMetrics', {}, AS.alphaScoped));
  assert.equal(m.incidentsOpen, 1);
  assert.equal(m.locationCount, 1);
  assert.equal(m.devicesOnline, 1);
});

test('Query.orgMetrics for beta has no open incidents', async () => {
  const m = await handler(ev('Query', 'orgMetrics', {}, AS.betaAdmin));
  assert.equal(m.incidentsOpen, 0);
  assert.equal(m.openAsks, 1);
  const sev = Object.fromEntries(m.eventsBySeverity.map((s) => [s.severity, s.count]));
  assert.equal(sev.info, 1);
  assert.equal(sev.warning ?? 0, 0);
});

test('Query.me returns the caller org role', async () => {
  const me = await handler(ev('Query', 'me', {}, AS.alphaAdmin));
  assert.equal(me.userId, USER.alphaAdmin);
  assert.equal(me.orgRole, 'owner');
  assert.equal(me.email, 'admin@alpha.example');
});

test('Query.orgMembers lists the active org roster with profile fields', async () => {
  const members = await handler(ev('Query', 'orgMembers', {}, AS.alphaAdmin));
  assert.equal(members.length, 2);
  const worker = members.find((m) => m.userId === USER.alphaScoped);
  assert.equal(worker?.email, 'worker@alpha.example');
  assert.equal(worker?.orgRole, 'member');
  assert.equal(worker?.orgWideAccess, false);
  assert.deepEqual(worker?.locationGrantIds, [LOC.alphaTower]);
  const admin = members.find((m) => m.userId === USER.alphaAdmin);
  assert.equal(admin?.orgWideAccess, true);
  assert.deepEqual(admin?.locationGrantIds, []);
});

test('Mutation.setMemberLocationGrants lets an admin widen a member to org-wide', async () => {
  const m = await handler(
    ev('Mutation', 'setMemberLocationGrants', { input: { userId: USER.alphaScoped, locationIds: [] } }, AS.alphaAdmin),
  );
  assert.equal(m.orgWideAccess, true);
  assert.deepEqual(m.locationGrantIds, []);
  const scopedIncidents = await handler(ev('Query', 'incidents', {}, AS.alphaScoped));
  assert.equal(scopedIncidents.length, 2);
  // restore scoped worker
  await handler(
    ev('Mutation', 'setMemberLocationGrants', {
      input: { userId: USER.alphaScoped, locationIds: [LOC.alphaTower] },
    }, AS.alphaAdmin),
  );
});

test('Mutation.setMemberLocationGrants lets an admin add locations', async () => {
  const m = await handler(
    ev('Mutation', 'setMemberLocationGrants', {
      input: { userId: USER.alphaScoped, locationIds: [LOC.alphaTower, LOC.alphaAnnex] },
    }, AS.alphaAdmin),
  );
  assert.equal(m.orgWideAccess, false);
  assert.deepEqual(m.locationGrantIds.sort(), [LOC.alphaAnnex, LOC.alphaTower].sort());
  await handler(
    ev('Mutation', 'setMemberLocationGrants', {
      input: { userId: USER.alphaScoped, locationIds: [LOC.alphaTower] },
    }, AS.alphaAdmin),
  );
});

test('Mutation.setMemberLocationGrants is forbidden for non-admins', async () => {
  await assert.rejects(
    handler(
      ev('Mutation', 'setMemberLocationGrants', {
        input: { userId: USER.alphaScoped, locationIds: [LOC.alphaAnnex] },
      }, AS.alphaScoped),
    ),
  );
});

test('Mutation.updateOrganization renames the active org for admins', async () => {
  const org = await handler(
    ev('Mutation', 'updateOrganization', { input: { name: 'Alpha Property Group' } }, AS.alphaAdmin),
  );
  assert.equal(org.name, 'Alpha Property Group');
});

test('Mutation.updateOrganization is forbidden for non-admins', async () => {
  await assert.rejects(
    handler(ev('Mutation', 'updateOrganization', { input: { name: 'Hacked' } }, AS.alphaScoped)),
  );
});

test('Mutation.updateMemberRole lets an owner promote a member', async () => {
  const m = await handler(
    ev('Mutation', 'updateMemberRole', { input: { userId: USER.alphaScoped, role: 'admin' } }, AS.alphaAdmin),
  );
  assert.equal(m.orgRole, 'admin');
  // restore for downstream tests
  await handler(
    ev('Mutation', 'updateMemberRole', { input: { userId: USER.alphaScoped, role: 'member' } }, AS.alphaAdmin),
  );
});

test('Mutation.updateMemberRole is forbidden for non-admins', async () => {
  await assert.rejects(
    handler(
      ev('Mutation', 'updateMemberRole', { input: { userId: USER.alphaAdmin, role: 'member' } }, AS.alphaScoped),
    ),
  );
});

test('Query.asks is org-scoped and filterable by status', async () => {
  const all = await handler(ev('Query', 'asks', {}, AS.betaAdmin));
  assert.equal(all.length, 1);
  assert.equal(all[0].organizationId, ORG.beta);

  const open = await handler(ev('Query', 'asks', { status: 'open' }, AS.betaAdmin));
  assert.equal(open.length, 1);
  const answered = await handler(ev('Query', 'asks', { status: 'answered' }, AS.betaAdmin));
  assert.equal(answered.length, 0);
});

test('Query.locations is org-scoped and carries device counts', async () => {
  const locs = await handler(ev('Query', 'locations', {}, AS.alphaAdmin));
  assert.equal(locs.length, 2); // Alpha Tower + Alpha Annex
  assert.ok(locs.every((l) => l.organizationId === ORG.alpha));
  const tower = locs.find((l) => l.name === 'Alpha Tower');
  assert.equal(tower.deviceCount, 1);
});

test('Query.locations respects per-user location grants', async () => {
  // alphaScoped (worker) is confined to Alpha Tower.
  const locs = await handler(ev('Query', 'locations', {}, AS.alphaScoped));
  assert.equal(locs.length, 1);
  assert.equal(locs[0].name, 'Alpha Tower');
});

test('Query.devices is org-scoped', async () => {
  const devices = await handler(ev('Query', 'devices', {}, AS.alphaAdmin));
  assert.equal(devices.length, 2);
  assert.ok(devices.every((d) => d.organizationId === ORG.alpha));
});

test('Query.devices respects per-user location grants', async () => {
  const devices = await handler(ev('Query', 'devices', {}, AS.alphaScoped));
  assert.equal(devices.length, 1); // only the Alpha Tower device
  assert.equal(devices[0].name, 'Alpha Tower Thermostat');
});

test('Query.devices filters by locationId', async () => {
  const locs = await handler(ev('Query', 'locations', {}, AS.alphaAdmin));
  const annex = locs.find((l) => l.name === 'Alpha Annex');
  const devices = await handler(ev('Query', 'devices', { locationId: annex.id }, AS.alphaAdmin));
  assert.equal(devices.length, 1);
  assert.equal(devices[0].locationId, annex.id);
});

// ──────────────────────────── Mutations ────────────────────────────────────

test('Mutation.raiseAsk creates an open ask in the caller org', async () => {
  const ask = await handler(
    ev('Mutation', 'raiseAsk', { input: { question: 'AHU-3 tripped — dispatch?' } }, AS.alphaAdmin),
  );
  assert.equal(ask.organizationId, ORG.alpha);
  assert.equal(ask.status, 'open');
  assert.equal(ask.question, 'AHU-3 tripped — dispatch?');

  // Visible to the same tenant, not to another.
  const alpha = await handler(ev('Query', 'asks', {}, AS.alphaAdmin));
  assert.ok(alpha.some((a) => a.id === ask.id));
  const beta = await handler(ev('Query', 'asks', {}, AS.betaAdmin));
  assert.ok(!beta.some((a) => a.id === ask.id));
});

test('Mutation.answerAsk refuses another tenant’s ask', async () => {
  await assert.rejects(
    handler(ev('Mutation', 'answerAsk', { input: { askId: ASK.alpha, answer: 'no' } }, AS.betaAdmin)),
  );
});

test('Mutation.answerAsk resolves an ask in the caller org', async () => {
  const ask = await handler(
    ev('Mutation', 'answerAsk', { input: { askId: ASK.alpha, answer: 'Lower to 21°C' } }, AS.alphaAdmin),
  );
  assert.equal(ask.status, 'answered');
  assert.equal(ask.answer, 'Lower to 21°C');
});

test('Mutation.ingestEvent is idempotent on externalId', async () => {
  const input = { kind: 'device_alert', severity: 'warning', externalId: 'api-dup', payload: '{"x":1}' };
  const a = await handler(ev('Mutation', 'ingestEvent', { input }, AS.betaAdmin));
  const b = await handler(ev('Mutation', 'ingestEvent', { input }, AS.betaAdmin));
  assert.equal(a.id, b.id);
  assert.equal(a.organizationId, ORG.beta);
});

// ─────────────────────────── Ingest → agent bus ────────────────────────────

test('ingestEvent emits an agent signal shaped from the recorded event', async () => {
  const emitted = [];
  const h = createResolver(async () => pg, { emit: async (s) => emitted.push(s) });
  const event = await h(
    ev(
      'Mutation',
      'ingestEvent',
      { input: { kind: 'device_alert', severity: 'critical', externalId: 'sig-1' } },
      AS.alphaAdmin,
    ),
  );
  assert.equal(emitted.length, 1);
  const s = emitted[0];
  assert.equal(s.organizationId, ORG.alpha);
  assert.equal(s.eventId, event.id); // links the signal back to the event row
  assert.equal(s.kind, 'device_alert');
  assert.equal(s.severity, 'critical');
});

test('reads and non-ingest mutations never emit', async () => {
  let calls = 0;
  const h = createResolver(async () => pg, { emit: async () => (calls += 1) });
  await h(ev('Query', 'events', {}, AS.alphaAdmin));
  await h(ev('Mutation', 'raiseAsk', { input: { question: 'no emit?' } }, AS.alphaAdmin));
  assert.equal(calls, 0);
});

test('an emit failure is swallowed — the event write still returns', async () => {
  const h = createResolver(async () => pg, {
    emit: async () => {
      throw new Error('bus unreachable');
    },
  });
  const event = await h(
    ev(
      'Mutation',
      'ingestEvent',
      { input: { kind: 'webhook', severity: 'info', externalId: 'sig-swallow' } },
      AS.alphaAdmin,
    ),
  );
  assert.ok(event.id);
  assert.equal(event.organizationId, ORG.alpha);
});

// ─────────────────────────── Invites ─────────────────────────────────────

test('Mutation.inviteOrgMember creates a pending invite with token', async () => {
  const res = await handler(
    ev('Mutation', 'inviteOrgMember', { input: { email: 'guest@alpha.example', role: 'member' } }, AS.alphaAdmin),
  );
  assert.equal(res.invite.email, 'guest@alpha.example');
  assert.equal(res.invite.status, 'pending');
  assert.ok(res.inviteToken.length > 10);
  const invites = await handler(ev('Query', 'orgInvites', { status: 'pending' }, AS.alphaAdmin));
  assert.ok(invites.some((i) => i.email === 'guest@alpha.example'));
});

test('Mutation.acceptOrgInvite materializes membership for matching email', async () => {
  const res = await handler(
    ev('Mutation', 'inviteOrgMember', { input: { email: 'joiner@alpha.example' } }, AS.alphaAdmin),
  );
  await pg.query(
    `insert into public.profiles (user_id, email, role) values ($1, $2, 'viewer')
     on conflict (user_id) do update set email = excluded.email`,
    ['05e0dead-0000-0000-0000-000000000002', 'joiner@alpha.example'],
  );
  const member = await handler(
    ev(
      'Mutation',
      'acceptOrgInvite',
      { input: { token: res.inviteToken } },
      identity('05e0dead-0000-0000-0000-000000000002', null, null, 'joiner@alpha.example'),
    ),
  );
  assert.equal(member.email, 'joiner@alpha.example');
  assert.equal(member.orgRole, 'member');
});

// ─────────────────────────── Contracts + SLA ───────────────────────────────

test('Query.serviceContracts lists customer contracts', async () => {
  const contracts = await handler(ev('Query', 'serviceContracts', {}, AS.alphaAdmin));
  assert.equal(contracts.length, 1);
  assert.equal(contracts[0].id, CONTRACT.alphaHvac);
  assert.equal(contracts[0].status, 'active');
  assert.deepEqual(contracts[0].locationIds, [LOC.alphaTower]);
  assert.equal(contracts[0].slaRules.find((r) => r.severity === 'critical')?.responseMinutes, 60);
});

test('Query.serviceContracts lists assigned contractor portfolio', async () => {
  const contracts = await handler(ev('Query', 'serviceContracts', {}, AS.swiftTech));
  assert.equal(contracts.length, 1);
  assert.equal(contracts[0].contractorOrgName, 'Swift HVAC Services');
});

test('Query.locations includes geo coordinates', async () => {
  const locs = await handler(ev('Query', 'locations', {}, AS.alphaAdmin));
  const tower = locs.find((l) => l.name === 'Alpha Tower');
  assert.equal(tower?.latitude, 48.8566);
  assert.equal(tower?.longitude, 2.3522);
});

// ─────────────────────────── App-layer authz ───────────────────────────────

test('unauthenticated requests are rejected before the DB', async () => {
  await assert.rejects(
    handler(ev('Query', 'events', {}, AS.anonymous)),
    UnauthenticatedError,
  );
});

test('authenticated caller with no active org is forbidden', async () => {
  await assert.rejects(
    handler(ev('Query', 'events', {}, AS.noOrg)),
    ForbiddenError,
  );
});
