// Stratos — cross-tenant leak suite (claim-bridge proof).
//
// Proves that tenant isolation survives the mandated move off PostgREST, using
// a real Postgres (PGlite / WASM) so RLS is genuinely enforced. Two modes:
//
//   1. App-layer ON,  RLS ON  — production shape. App-layer authz blocks the
//      obvious cross-tenant request; RLS scopes every row that is returned.
//   2. App-layer BYPASSED, RLS ON — simulates a resolver bug (a missing/incorrect
//      app-layer check). RLS must STILL block the leak. This is the backstop the
//      whole architecture rests on.
//
// Run: npm test   (from db/proof/)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { withClaims, assertOrgAccess, ForbiddenError } from './claim-bridge.mjs';
import { AS, ORG, LOC } from './fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoDb = join(here, '..');

let db;

before(async () => {
  db = new PGlite();
  const helpers = await readFile(join(repoDb, 'helpers', '001_authz.sql'), 'utf8');
  const schema = await readFile(join(here, 'schema.sql'), 'utf8');
  const seed = await readFile(join(here, 'seed.sql'), 'utf8');
  await db.exec(helpers);
  await db.exec(schema);
  await db.exec(seed);
});

after(async () => {
  await db?.close();
});

// Read helpers — each runs a single SELECT inside a claim-scoped transaction,
// exactly as a resolver would.
const asks = (claims) =>
  withClaims(db, claims, async (c) =>
    (await c.query('select organization_id, question from public.asks order by question')).rows,
  );

const devices = (claims) =>
  withClaims(db, claims, async (c) =>
    (await c.query('select organization_id, location_id, name from public.devices order by name')).rows,
  );

// ─────────────────────────── Mode 1: app-layer ON, RLS ON ───────────────────

test('caller sees only their own org rows (org-scoped table)', async () => {
  const rows = await asks(AS.alphaAdmin);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].organization_id, ORG.alpha);
  assert.ok(rows.every((r) => r.organization_id !== ORG.beta), 'no Beta rows leaked to Alpha');
});

test('app layer blocks an explicit cross-tenant request before the DB', () => {
  // Alpha admin tries to act on Beta's org id — the mandated primary check.
  assert.throws(() => assertOrgAccess(AS.alphaAdmin, ORG.beta), ForbiddenError);
  // Same request against their own org is allowed.
  assert.doesNotThrow(() => assertOrgAccess(AS.alphaAdmin, ORG.alpha));
});

test('org-wide user (no grants) sees all devices in their org, none in others', async () => {
  const rows = await devices(AS.alphaAdmin);
  assert.equal(rows.length, 2, 'both Alpha devices visible');
  assert.ok(rows.every((r) => r.organization_id === ORG.alpha));
});

test('location-scoped user sees only granted-location devices', async () => {
  const rows = await devices(AS.alphaScoped);
  assert.equal(rows.length, 1, 'only the Alpha Tower device');
  assert.equal(rows[0].location_id, LOC.alphaTower);
  assert.equal(rows[0].name, 'Alpha Tower Thermostat');
});

test('beta admin sees only Beta rows', async () => {
  const rows = await asks(AS.betaAdmin);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].organization_id, ORG.beta);
});

test('platform admin sees across all tenants', async () => {
  const rows = await asks(AS.platform);
  assert.equal(rows.length, 2, 'both orgs visible to platform admin');
  const orgs = new Set(rows.map((r) => r.organization_id));
  assert.ok(orgs.has(ORG.alpha) && orgs.has(ORG.beta));
});

// ────────────────────── Mode 2: app-layer BYPASSED, RLS ON ──────────────────
// The resolver "forgot" to call assertOrgAccess and even injected an attacker's
// WHERE clause. RLS must still return zero foreign rows.

test('BACKSTOP: targeted cross-tenant SELECT returns nothing', async () => {
  // Alpha's claims, but query explicitly filtered to Beta's org id.
  const rows = await withClaims(db, AS.alphaAdmin, async (c) =>
    (
      await c.query('select * from public.asks where organization_id = $1', [ORG.beta])
    ).rows,
  );
  assert.equal(rows.length, 0, 'RLS blocks the cross-tenant read despite the app-layer bug');
});

test('BACKSTOP: unfiltered SELECT cannot leak other tenants', async () => {
  // The classic missing-WHERE resolver bug: SELECT * with no scoping.
  const rows = await withClaims(db, AS.alphaAdmin, async (c) =>
    (await c.query('select organization_id from public.asks')).rows,
  );
  assert.ok(rows.length > 0, 'own rows still returned');
  assert.ok(rows.every((r) => r.organization_id === ORG.alpha), 'only own-org rows survive RLS');
});

test('BACKSTOP: unfiltered device SELECT respects location grants', async () => {
  const rows = await withClaims(db, AS.alphaScoped, async (c) =>
    (await c.query('select location_id from public.devices')).rows,
  );
  assert.equal(rows.length, 1, 'grant confines even an unfiltered read');
  assert.equal(rows[0].location_id, LOC.alphaTower);
});

test('BACKSTOP: no claims (missing token) sees nothing', async () => {
  const rows = await asks(AS.anonymous);
  assert.equal(rows.length, 0, 'null current_user_org() matches no rows');
});
