// Stratos — V1 baseline vertical slice (DB layer).
//
// Exercises the authored baseline schema (db/V1_baseline.sql) through the claim
// bridge: reads scoped by RLS, writes via the SECURITY DEFINER RPCs, tenant
// authorization, and the RLS write backstop. This is the events/asks slice
// proven at the database layer (AppSync/Lambda resolvers + subscriptions land on
// top of this later).
//
// Run: npm test   (from db/proof/)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { withClaims } from './claim-bridge.mjs';
import { AS, ORG, DEVICE, ASK } from './fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoDb = join(here, '..');

let db;

before(async () => {
  db = new PGlite();
  await db.exec(await readFile(join(repoDb, 'helpers', '001_authz.sql'), 'utf8'));
  await db.exec(await readFile(join(repoDb, 'V1_baseline.sql'), 'utf8'));
  await db.exec(await readFile(join(repoDb, 'seed', 'dev.sql'), 'utf8'));
});

after(async () => {
  await db?.close();
});

const rows = (claims, sql, params = []) =>
  withClaims(db, claims, async (c) => (await c.query(sql, params)).rows);

// ───────────────────────────── Reads (RLS) ─────────────────────────────────

test('caller reads only their org events', async () => {
  const r = await rows(AS.alphaAdmin, 'select organization_id from public.events');
  assert.equal(r.length, 1);
  assert.equal(r[0].organization_id, ORG.alpha);
});

test('location-scoped user reads only granted-location devices', async () => {
  const r = await rows(AS.alphaScoped, 'select id, location_id from public.devices');
  assert.equal(r.length, 1);
  assert.equal(r[0].id, DEVICE.alphaTower);
});

test('beta admin reads only beta asks', async () => {
  const r = await rows(AS.betaAdmin, 'select organization_id from public.asks');
  assert.equal(r.length, 1);
  assert.equal(r[0].organization_id, ORG.beta);
});

test('platform admin reads events across all tenants', async () => {
  const r = await rows(AS.platform, 'select organization_id from public.events');
  assert.equal(r.length, 2);
});

test('missing token reads nothing', async () => {
  const r = await rows(AS.anonymous, 'select id from public.asks');
  assert.equal(r.length, 0);
});

// ────────────────────────── Mutations via RPCs ─────────────────────────────

test('raise_ask writes an ask scoped to the caller org, visible only there', async () => {
  const [{ raise_ask: askId }] = await rows(AS.alphaAdmin, "select public.raise_ask('Roof unit tripped — dispatch?') as raise_ask");
  assert.ok(askId);

  const mine = await rows(AS.alphaAdmin, 'select organization_id from public.asks where id = $1', [askId]);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].organization_id, ORG.alpha);

  const theirs = await rows(AS.betaAdmin, 'select id from public.asks where id = $1', [askId]);
  assert.equal(theirs.length, 0, 'other tenant cannot see the new ask');
});

test('ingest_event is idempotent on external_id', async () => {
  const first = await rows(AS.betaAdmin, "select public.ingest_event('device_alert','warning',null,null,'dup-1','{}') as id");
  const second = await rows(AS.betaAdmin, "select public.ingest_event('device_alert','warning',null,null,'dup-1','{}') as id");
  assert.equal(first[0].id, second[0].id, 'same event id returned');

  const count = await rows(AS.betaAdmin, "select count(*)::int as n from public.events where external_id = 'dup-1'");
  assert.equal(count[0].n, 1, 'only one row despite two ingests');
});

test('answer_ask refuses to resolve another tenant’s ask', async () => {
  await assert.rejects(
    rows(AS.betaAdmin, 'select public.answer_ask($1, $2)', [ASK.alpha, 'nope']),
    /not found|not open|not in your organization/i,
  );
  // Still open afterwards.
  const r = await rows(AS.alphaAdmin, 'select status from public.asks where id = $1', [ASK.alpha]);
  assert.equal(r[0].status, 'open');
});

test('answer_ask resolves an ask in the caller org', async () => {
  await rows(AS.alphaAdmin, 'select public.answer_ask($1, $2)', [ASK.alpha, 'Yes, lower to 21°C']);
  const r = await rows(AS.alphaAdmin, 'select status, answer from public.asks where id = $1', [ASK.alpha]);
  assert.equal(r[0].status, 'answered');
  assert.equal(r[0].answer, 'Yes, lower to 21°C');
});

test('self_serve_create_org provisions an org + owner membership', async () => {
  const newUser = '05e0c001-0000-0000-0000-000000000001';
  // A profile exists after first sign-in (post-confirmation Lambda); create it.
  await db.query(
    'insert into public.profiles (user_id, email, full_name) values ($1, $2, $3)',
    [newUser, 'founder@gamma.example', 'Gamma Founder'],
  );

  const [{ self_serve_create_org: orgId }] = await rows(
    { sub: newUser },
    "select public.self_serve_create_org('Gamma Estates') as self_serve_create_org",
  );
  assert.ok(orgId);

  // Verify as superuser (setup/admin path bypasses RLS).
  const member = await db.query(
    'select role from public.organization_members where org_id = $1 and user_id = $2',
    [orgId, newUser],
  );
  assert.equal(member.rows[0].role, 'owner');
  const prof = await db.query('select active_org_id from public.profiles where user_id = $1', [newUser]);
  assert.equal(prof.rows[0].active_org_id, orgId);
});

// ─────────────────────── RLS write backstop (direct) ───────────────────────

test('BACKSTOP: direct cross-tenant INSERT is blocked by WITH CHECK', async () => {
  await assert.rejects(
    rows(AS.alphaAdmin, "insert into public.asks (organization_id, question) values ($1, 'spoofed')", [ORG.beta]),
    /row-level security|violates/i,
  );
});

test('BACKSTOP: unfiltered ask SELECT returns only own-org rows', async () => {
  const r = await rows(AS.alphaAdmin, 'select organization_id from public.asks');
  assert.ok(r.length > 0);
  assert.ok(r.every((x) => x.organization_id === ORG.alpha), 'no foreign-org asks survive RLS');
});
