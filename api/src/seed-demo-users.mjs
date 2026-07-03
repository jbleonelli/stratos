// Stratos — one-shot demo Cognito users + DB profile remap.
//
// Creates (or resets) Cognito users for each dev persona, then remaps
// profiles.user_id from the deterministic seed UUIDs to the real Cognito `sub`
// so resolve_login_claims works after sign-in.
//
// Invoke via the migrate Lambda: { "seedDemoUsers": true }
// (run { "applySeed": true } first on a fresh database).

import { DEMO_PASSWORD, DEMO_PERSONAS } from './demo-personas.mjs';

const FK_UPDATES = [
  'update public.organization_members set user_id = $2 where user_id = $1',
  'update public.user_location_grants set user_id = $2 where user_id = $1',
  'update public.contract_assignments set user_id = $2 where user_id = $1',
  'update public.organization_invites set invited_by = $2 where invited_by = $1',
  'update public.organization_invites set accepted_by = $2 where accepted_by = $1',
  'update public.asks set created_by = $2 where created_by = $1',
  'update public.asks set resolved_by = $2 where resolved_by = $1',
  'update public.work_orders set created_by = $2 where created_by = $1',
  'update public.work_orders set assigned_to = $2 where assigned_to = $1',
];

async function cognitoClient() {
  const poolId = process.env.COGNITO_USER_POOL_ID;
  if (!poolId) throw new Error('COGNITO_USER_POOL_ID is required for seedDemoUsers');

  const {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminGetUserCommand,
    AdminSetUserPasswordCommand,
    AdminDeleteUserCommand,
  } = await import('@aws-sdk/client-cognito-identity-provider');

  return {
    poolId,
    client: new CognitoIdentityProviderClient({}),
    AdminCreateUserCommand,
    AdminGetUserCommand,
    AdminSetUserPasswordCommand,
    AdminDeleteUserCommand,
  };
}

function readSub(user) {
  const sub = user.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
  if (!sub) throw new Error(`Cognito user ${user.Username} has no sub`);
  return sub;
}

export async function ensureCognitoDemoUser(persona, password = DEMO_PASSWORD) {
  const {
    poolId,
    client,
    AdminCreateUserCommand,
    AdminGetUserCommand,
    AdminSetUserPasswordCommand,
    AdminDeleteUserCommand,
  } = await cognitoClient();

  try {
    await client.send(
      new AdminGetUserCommand({
        UserPoolId: poolId,
        Username: persona.email,
      }),
    );
    // Drop partial users from a prior failed seed so we recreate cleanly.
    await client.send(
      new AdminDeleteUserCommand({
        UserPoolId: poolId,
        Username: persona.email,
      }),
    );
  } catch (err) {
    if (err?.name !== 'UserNotFoundException') throw err;
  }

  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: poolId,
      Username: persona.email,
      MessageAction: 'SUPPRESS',
      TemporaryPassword: password,
      UserAttributes: [
        { Name: 'email', Value: persona.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: persona.fullName },
      ],
    }),
  );

  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: poolId,
      Username: persona.email,
      Password: password,
      Permanent: true,
    }),
  );

  const user = await client.send(
    new AdminGetUserCommand({
      UserPoolId: poolId,
      Username: persona.email,
    }),
  );

  return { sub: readSub(user), created: true };
}

export async function remapProfileUserId(conn, oldUserId, newUserId) {
  if (oldUserId === newUserId) return { remapped: false };

  const existing = await conn.query('select user_id from public.profiles where user_id = $1', [newUserId]);
  if (existing.rows.length > 0) {
    throw new Error(`profile ${newUserId} already exists — cannot remap from ${oldUserId}`);
  }

  const source = await conn.query('select * from public.profiles where user_id = $1', [oldUserId]);
  if (source.rows.length === 0) {
    throw new Error(`seed profile ${oldUserId} not found — run applySeed first`);
  }

  const p = source.rows[0];
  await conn.query('begin');
  try {
    await conn.query(
      `insert into public.profiles (user_id, email, full_name, role, active_org_id, impersonating_org_id, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        newUserId,
        p.email,
        p.full_name,
        p.role,
        p.active_org_id,
        p.impersonating_org_id,
        p.created_at,
        p.updated_at,
      ],
    );

    for (const sql of FK_UPDATES) {
      await conn.query(sql, [oldUserId, newUserId]);
    }

    await conn.query('delete from public.profiles where user_id = $1', [oldUserId]);
    await conn.query('commit');
    return { remapped: true };
  } catch (err) {
    await conn.query('rollback');
    throw err;
  }
}

export async function seedDemoUsers(conn, { password = DEMO_PASSWORD, ensureUser = ensureCognitoDemoUser } = {}) {
  const results = [];

  for (const persona of DEMO_PERSONAS) {
    const { sub, created } = await ensureUser(persona, password);

    const row = await conn.query('select user_id from public.profiles where lower(email) = lower($1)', [
      persona.email,
    ]);

    let dbAction = 'unchanged';
    if (row.rows.length === 0) {
      throw new Error(`no profile for ${persona.email} — run applySeed before seedDemoUsers`);
    }

    const currentId = row.rows[0].user_id;
    if (currentId === sub) {
      dbAction = 'already_synced';
    } else {
      await remapProfileUserId(conn, currentId, sub);
      dbAction = 'remapped';
    }

    results.push({
      email: persona.email,
      sub,
      cognitoCreated: created,
      dbAction,
    });
  }

  return { password, personas: results };
}
