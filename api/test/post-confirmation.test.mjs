// Stratos — Cognito post-confirmation Lambda proof.
//
// Proves signup bootstrap creates a profile and auto-accepts pending invites.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createPostConfirmationHandler } from '../src/post-confirmation.mjs';
import { createPreTokenHandler } from '../src/pre-token.mjs';
import { createResolver } from '../src/resolver.mjs';
import { loadTestSchema } from './load-test-schema.mjs';
import { ORG, USER } from '../../db/proof/fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const db = join(here, '..', '..', 'db');

const NEW_USER = '05e0dead-0000-0000-0000-000000000099';
const NEW_EMAIL = 'invited@alpha.example';

let pg;
let postConfirm;
let preToken;

const identity = (sub, organization_id = null, platform_role = null, email = null) => ({
  sub,
  claims: { organization_id, platform_role, email },
});
const ev = (parentTypeName, fieldName, args, ident) => ({
  info: { parentTypeName, fieldName },
  arguments: args,
  identity: ident,
});

before(async () => {
  pg = new PGlite();
  await loadTestSchema(pg, db);
  postConfirm = createPostConfirmationHandler(async () => pg);
  preToken = createPreTokenHandler(async () => pg);
});

after(async () => {
  await pg?.close();
});

const confirmEvent = (sub, email, name = null) => ({
  triggerSource: 'PostConfirmation_ConfirmSignUp',
  request: {
    userAttributes: {
      sub,
      email,
      ...(name ? { name } : {}),
    },
  },
});

test('post-confirmation bootstraps profile and auto-accepts a pending invite', async () => {
  const resolver = createResolver(async () => pg);
  const invite = await resolver(
    ev(
      'Mutation',
      'inviteOrgMember',
      { input: { email: NEW_EMAIL, role: 'member' } },
      identity(USER.alphaAdmin, ORG.alpha),
    ),
  );
  assert.ok(invite.inviteToken);

  await postConfirm(confirmEvent(NEW_USER, NEW_EMAIL, 'Invited User'));

  const { rows: profiles } = await pg.query(
    'select email, active_org_id from public.profiles where user_id = $1',
    [NEW_USER],
  );
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].email, NEW_EMAIL);
  assert.equal(profiles[0].active_org_id, ORG.alpha);

  const { rows: members } = await pg.query(
    'select org_id, role from public.organization_members where user_id = $1',
    [NEW_USER],
  );
  assert.equal(members.length, 1);
  assert.equal(members[0].org_id, ORG.alpha);
  assert.equal(members[0].role, 'member');

  const pre = await preToken({
    triggerSource: 'TokenGeneration_Authentication',
    request: { userAttributes: { sub: NEW_USER } },
    response: {},
  });
  assert.equal(pre.response.claimsOverrideDetails.claimsToAddOrOverride.organization_id, ORG.alpha);
});

test('post-confirmation is a no-op without sub or email', async () => {
  const out = await postConfirm({ request: { userAttributes: {} } });
  assert.deepEqual(out.request.userAttributes, {});
});
