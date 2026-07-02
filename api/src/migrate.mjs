// Stratos — schema migration Lambda entry point.
//
// Invoked on deploy (or manually) to bring an Aurora database up to the current
// schema. The SQL slices are inlined at build time by esbuild's text loader, so
// the deployment package is self-contained. Order matters: the authz helpers
// must exist before the baseline policies that call them.
//
// Invoke with { "applySeed": true } (or env APPLY_SEED=true) to also load the
// deterministic dev/demo seed — never in production.

import authz from '../../db/helpers/001_authz.sql';
import baseline from '../../db/V1_baseline.sql';
import seed from '../../db/seed/dev.sql';
import process from 'node:process';
import { runMigrations } from './migrate-core.mjs';
import { getConnection } from './pg-client.mjs';

const MIGRATIONS = [
  { version: '001_authz', sql: authz },
  { version: 'V1_baseline', sql: baseline },
  { version: 'dev_seed', sql: seed, seed: true },
];

export async function handler(event = {}) {
  const applySeed = event.applySeed === true || process.env.APPLY_SEED === 'true';
  const conn = await getConnection();
  try {
    const result = await runMigrations(conn, MIGRATIONS, { applySeed });
    return { ok: true, ...result };
  } finally {
    await conn.release?.();
  }
}
