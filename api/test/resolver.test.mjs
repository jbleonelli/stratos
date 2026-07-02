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
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createResolver } from '../src/resolver.mjs';
import { ForbiddenError, UnauthenticatedError } from '../src/authz.mjs';
import { ORG, USER, ASK } from '../../db/proof/fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const db = join(here, '..', '..', 'db');

let pg;
let handler;

before(async () => {
  pg = new PGlite();
  await pg.exec(await readFile(join(db, 'helpers', '001_authz.sql'), 'utf8'));
  await pg.exec(await readFile(join(db, 'V1_baseline.sql'), 'utf8'));
  await pg.exec(await readFile(join(db, 'seed', 'dev.sql'), 'utf8'));
  handler = createResolver(async () => pg); // single shared connection, no release
});

after(async () => {
  await pg?.close();
});

// AppSync identity + event helpers.
const identity = (sub, organization_id = null, platform_role = null) => ({
  sub,
  claims: { organization_id, platform_role },
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
  noOrg: identity('05e0dead-0000-0000-0000-000000000001', null),
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
  assert.equal(events.length, 1);
  assert.equal(events[0].organizationId, ORG.alpha);
});

test('Query.events for a platform admin spans tenants', async () => {
  const events = await handler(ev('Query', 'events', {}, AS.platform));
  assert.equal(events.length, 2);
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
