// Load the full schema + dev seed for PGlite integration tests.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function loadTestSchema(pg, dbRoot) {
  const sql = (name) => readFile(join(dbRoot, name), 'utf8');
  await pg.exec(await sql('helpers/001_authz.sql'));
  await pg.exec(await sql('V1_baseline.sql'));
  await pg.exec(await sql('migrations/002_agent_runtime.sql'));
  await pg.exec(await sql('migrations/003_admin.sql'));
  await pg.exec(await sql('migrations/004_location_grants_admin.sql'));
  await pg.exec(await sql('migrations/005_invites.sql'));
  await pg.exec(await sql('migrations/006a_contractor_kind.sql'));
  await pg.exec(await sql('migrations/006_contracts.sql'));
  await pg.exec(await sql('migrations/007_location_geo.sql'));
  await pg.exec(await sql('seed/dev.sql'));
}
