// Stratos — seedDemoUsers unit tests (PGlite + injected Cognito stub).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { loadTestSchema } from './load-test-schema.mjs';
import { DEMO_PERSONAS } from '../src/demo-personas.mjs';
import { remapProfileUserId, seedDemoUsers } from '../src/seed-demo-users.mjs';
import { USER, ORG } from '../../db/proof/fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const db = join(here, '..', '..', 'db');

const FAKE_SUB = Object.fromEntries(
  DEMO_PERSONAS.map((p, i) => [p.seedUserId, `c1000001-0000-0000-0000-${String(i + 1).padStart(12, '0')}`]),
);

let pg;
let conn;

before(async () => {
  pg = new PGlite();
  await loadTestSchema(pg, db);
  conn = {
    query: (text, params) => pg.query(text, params),
  };
});

after(async () => {
  await pg?.close();
});

const fakeEnsureUser = async (persona) => ({ sub: FAKE_SUB[persona.seedUserId], created: true });

test('remapProfileUserId rewires org membership to the Cognito sub', async () => {
  const sub = FAKE_SUB[USER.betaAdmin];
  await remapProfileUserId(conn, USER.betaAdmin, sub);

  const profile = await pg.query('select user_id from public.profiles where email = $1', ['admin@beta.example']);
  assert.equal(profile.rows[0].user_id, sub);

  const member = await pg.query('select org_id from public.organization_members where user_id = $1', [sub]);
  assert.equal(member.rows[0].org_id, ORG.beta);
});

test('seedDemoUsers remaps all demo personas and resolve_login_claims works', async () => {
  const result = await seedDemoUsers(conn, { ensureUser: fakeEnsureUser });
  assert.equal(result.personas.length, DEMO_PERSONAS.length);
  assert.ok(result.personas.every((row) => row.dbAction === 'remapped' || row.dbAction === 'already_synced'));

  const alphaSub = FAKE_SUB[USER.alphaAdmin];
  const claims = await pg.query('select public.resolve_login_claims($1) as claims', [alphaSub]);
  assert.equal(claims.rows[0].claims.organization_id, ORG.alpha);

  const platformSub = FAKE_SUB[USER.platform];
  const platformClaims = await pg.query('select public.resolve_login_claims($1) as claims', [platformSub]);
  assert.equal(platformClaims.rows[0].claims.platform_role, 'platform_admin');
});
