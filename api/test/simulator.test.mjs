// Stratos — signal simulator.
//
// Runs the REAL simulator (src/simulator.mjs) against the baseline schema + dev
// seed on PGlite, with a fake emitter. Proves each tick records a real event
// against a seeded device and emits a well-formed signal — the same shape the
// resolver front door emits — plus the pure generate() weighting. No AWS.
//
// Run: npm test   (from api/)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createSimulator, generate } from '../src/simulator.mjs';
import { loadTestSchema } from './load-test-schema.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const db = join(here, '..', '..', 'db');

let pg;

before(async () => {
  pg = new PGlite();
  await loadTestSchema(pg, db);
});

after(async () => {
  await pg?.close();
});

const eventCount = async () =>
  Number((await pg.query('select count(*)::int as c from public.events')).rows[0].c);

// ─────────────────────────────── generate() ────────────────────────────────

test('generate() maps the random draw to severity bands', () => {
  assert.equal(generate(() => 0.0).severity, 'critical'); // < 0.1
  assert.equal(generate(() => 0.2).severity, 'warning'); // < 0.4
  assert.equal(generate(() => 0.9).severity, 'info');
});

test('generate() always yields a valid kind + simulated payload', () => {
  const s = generate(() => 0.5);
  assert.ok(['sensor_reading', 'device_alert', 'webhook'].includes(s.kind));
  assert.equal(s.payload.simulated, true);
  assert.ok(s.payload.value >= 18 && s.payload.value <= 30);
});

// ─────────────────────────────── tick path ─────────────────────────────────

test('a tick records a real event against a seeded device and emits a coherent signal', async () => {
  const emitted = [];
  const sim = createSimulator(async () => pg, {
    emit: async (s) => emitted.push(s),
    count: 1,
    generate: () => ({ kind: 'device_alert', severity: 'warning', payload: { simulated: true } }),
  });

  const before = await eventCount();
  const out = await sim();

  assert.equal(out.ok, true);
  assert.equal(out.emitted, 1);
  assert.equal(await eventCount(), before + 1);

  const s = emitted[0];
  assert.ok(s.organizationId && s.eventId && s.deviceId); // coherent triple
  assert.equal(s.severity, 'warning');
  assert.equal(s.kind, 'device_alert');

  // The emitted event id points at a real, freshly-inserted row.
  const row = (await pg.query('select organization_id, device_id from public.events where id = $1', [s.eventId])).rows[0];
  assert.equal(row.organization_id, s.organizationId);
  assert.equal(row.device_id, s.deviceId);
});

test('count drives the number of signals emitted per tick', async () => {
  const emitted = [];
  const sim = createSimulator(async () => pg, {
    emit: async (s) => emitted.push(s),
    count: 3,
  });
  const out = await sim();
  assert.equal(out.emitted, 3);
  assert.equal(emitted.length, 3);
});

test('default emitter is a no-op — a tick still records without a real bus', async () => {
  const before = await eventCount();
  const sim = createSimulator(async () => pg, { count: 1 }); // no emit injected
  const out = await sim();
  assert.equal(out.ok, true);
  assert.equal(await eventCount(), before + 1);
});
