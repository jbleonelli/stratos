// Stratos — Cognito pre-token-generation Lambda proof.
//
// Runs the REAL pre-token handler against the baseline schema on PGlite and
// asserts it resolves the correct organization_id / platform_role claims for
// each persona — the input side of the whole claim bridge.
//
// Run: npm test   (from api/)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createPreTokenHandler } from '../src/pre-token.mjs';
import { loadTestSchema } from './load-test-schema.mjs';
import { ORG, USER } from '../../db/proof/fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const db = join(here, '..', '..', 'db');

let pg;
let handler;

before(async () => {
  pg = new PGlite();
  await loadTestSchema(pg, db);
  handler = createPreTokenHandler(async () => pg);
});

after(async () => {
  await pg?.close();
});

// Minimal Cognito pre-token-generation event.
const event = (sub) => ({
  triggerSource: 'TokenGeneration_Authentication',
  request: { userAttributes: sub ? { sub } : {} },
  response: {},
});

const added = (out) => out.response.claimsOverrideDetails.claimsToAddOrOverride;

test('a customer user gets their active org and no platform role', async () => {
  const out = await handler(event(USER.alphaAdmin));
  assert.equal(added(out).organization_id, ORG.alpha);
  assert.equal(added(out).platform_role, undefined);
});

test('a scoped user still resolves the org claim', async () => {
  const out = await handler(event(USER.alphaScoped));
  assert.equal(added(out).organization_id, ORG.alpha);
});

test('platform staff get platform_admin + the platform org', async () => {
  const out = await handler(event(USER.platform));
  assert.equal(added(out).organization_id, ORG.platform);
  assert.equal(added(out).platform_role, 'platform_admin');
});

test('an unknown subject yields no injected claims', async () => {
  const out = await handler(event('05e0dead-0000-0000-0000-000000000099'));
  assert.deepEqual(added(out), {});
});

test('an event without a subject passes through untouched', async () => {
  const out = await handler(event(null));
  assert.equal(out.response.claimsOverrideDetails, undefined);
});
