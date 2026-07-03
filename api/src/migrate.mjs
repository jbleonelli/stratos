// Stratos — schema migration Lambda entry point.
//
// Invoked on deploy (or manually) to bring an Aurora database up to the current
// schema. The SQL slices are inlined at build time by esbuild's text loader, so
// the deployment package is self-contained. Order matters: the authz helpers
// must exist before the baseline policies that call them.
//
// Invoke with { "applySeed": true } (or env APPLY_SEED=true) to also load the
// deterministic dev/demo seed — never in production.
//
// Onboarding path: invoke with
//   { "linkUser": { "sub": "<cognito-sub>", "email": "...", "orgId": "<uuid>" } }
// to link a Cognito identity to an org (profile + membership upsert). This is how
// the first admin of an org gets their organization_id/platform_role claims (the
// pre-token Lambda resolves them from these rows). Idempotent.

import authz from '../../db/helpers/001_authz.sql';
import baseline from '../../db/V1_baseline.sql';
import agentRuntime from '../../db/migrations/002_agent_runtime.sql';
import admin from '../../db/migrations/003_admin.sql';
import locationGrantsAdmin from '../../db/migrations/004_location_grants_admin.sql';
import seed from '../../db/seed/dev.sql';
import process from 'node:process';
import { runMigrations } from './migrate-core.mjs';
import { getConnection } from './pg-client.mjs';

const MIGRATIONS = [
  { version: '001_authz', sql: authz },
  { version: 'V1_baseline', sql: baseline },
  { version: '002_agent_runtime', sql: agentRuntime },
  { version: '003_admin', sql: admin },
  { version: '004_location_grants_admin', sql: locationGrantsAdmin },
  { version: 'dev_seed', sql: seed, seed: true },
];

export async function linkUser(conn, { sub, email, orgId, role = 'owner', memberRole = 'owner' }) {
  if (!sub || !orgId) throw new Error('linkUser requires sub and orgId');
  await conn.query(
    `insert into public.profiles (user_id, email, full_name, role, active_org_id)
     values ($1, $2, $3, $4::public.user_role, $5)
     on conflict (user_id) do update
       set email = excluded.email, active_org_id = excluded.active_org_id, updated_at = now()`,
    [sub, email ?? '', email ?? '', role, orgId],
  );
  await conn.query(
    `insert into public.organization_members (org_id, user_id, role)
     values ($1, $2, $3::public.org_role)
     on conflict (org_id, user_id) do nothing`,
    [orgId, sub, memberRole],
  );
  return { linked: { sub, orgId } };
}

export async function handler(event = {}) {
  const conn = await getConnection();
  try {
    if (event.linkUser) {
      const result = await linkUser(conn, event.linkUser);
      return { ok: true, ...result };
    }
    const applySeed = event.applySeed === true || process.env.APPLY_SEED === 'true';
    const result = await runMigrations(conn, MIGRATIONS, { applySeed });
    return { ok: true, ...result };
  } finally {
    await conn.release?.();
  }
}
