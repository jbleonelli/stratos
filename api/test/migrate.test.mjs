// Stratos — migration runner proof.
//
// Runs the real runMigrations() against PGlite: applies the ordered slices,
// proves idempotency (a second run applies nothing), and that the seed slice is
// gated behind applySeed.
//
// Run: npm test   (from api/)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { runMigrations } from '../src/migrate-core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const db = join(here, '..', '..', 'db');

let pg;
let migrations;

before(async () => {
  pg = new PGlite();
  migrations = [
    { version: '001_authz', sql: await readFile(join(db, 'helpers', '001_authz.sql'), 'utf8') },
    { version: 'V1_baseline', sql: await readFile(join(db, 'V1_baseline.sql'), 'utf8') },
    { version: 'dev_seed', sql: await readFile(join(db, 'seed', 'dev.sql'), 'utf8'), seed: true },
  ];
});

after(async () => {
  await pg?.close();
});

test('applies core slices but skips the seed by default', async () => {
  const { applied } = await runMigrations(pg, migrations);
  assert.deepEqual(applied, ['001_authz', 'V1_baseline']);

  const { rows } = await pg.query('select count(*)::int as n from public.organizations');
  assert.equal(rows[0].n, 0); // seed not applied
});

test('a second run is a no-op (idempotent)', async () => {
  const { applied } = await runMigrations(pg, migrations);
  assert.deepEqual(applied, []);
});

test('applySeed loads the seed exactly once', async () => {
  const first = await runMigrations(pg, migrations, { applySeed: true });
  assert.deepEqual(first.applied, ['dev_seed']);

  const { rows } = await pg.query('select count(*)::int as n from public.organizations');
  assert.equal(rows[0].n, 3);

  const second = await runMigrations(pg, migrations, { applySeed: true });
  assert.deepEqual(second.applied, []);
});
