// Stratos — agent runtime worker + spend guard.
//
// Runs the REAL worker (src/agent-worker.mjs) against the baseline + agent
// runtime schema on PGlite. Proves the system write path (record_agent_run,
// agent_raise_ask), the deterministic policy (agent-core), and the spend guard
// (public.agent_run_allowed) — no AWS, no Docker.
//
// Run: npm test   (from api/)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { decide } from '../src/agent-core.mjs';
import { createWorker } from '../src/agent-worker.mjs';
import { ORG, LOC, EVENT } from '../../db/proof/fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const db = join(here, '..', '..', 'db');

let pg;
let worker;

before(async () => {
  pg = new PGlite();
  await pg.exec(await readFile(join(db, 'helpers', '001_authz.sql'), 'utf8'));
  await pg.exec(await readFile(join(db, 'V1_baseline.sql'), 'utf8'));
  await pg.exec(await readFile(join(db, 'migrations', '002_agent_runtime.sql'), 'utf8'));
  await pg.exec(await readFile(join(db, 'seed', 'dev.sql'), 'utf8'));
  worker = createWorker(async () => pg); // shared connection, no release
});

after(async () => {
  await pg?.close();
});

const runsFor = async (org) =>
  (await pg.query('select * from public.agent_runs where organization_id = $1 order by created_at', [org])).rows;
const asksFor = async (org) =>
  (await pg.query('select * from public.asks where organization_id = $1', [org])).rows;

// EventBridge-style signal → the shape the bus rule forwards to the queue.
const signal = (overrides) => ({
  organizationId: ORG.alpha,
  kind: 'device_alert',
  severity: 'info',
  ...overrides,
});

// ───────────────────────────── decision core ───────────────────────────────

test('decide() maps severity → decision', () => {
  assert.equal(decide({ kind: 'device_alert', severity: 'critical' }).decision, 'act');
  assert.equal(decide({ kind: 'device_alert', severity: 'warning' }).decision, 'ask');
  assert.equal(decide({ kind: 'device_alert', severity: 'info' }).decision, 'skip');
  assert.equal(decide({}).decision, 'skip'); // defaults
});

test('only act (LLM-backed) needs the spend guard', () => {
  assert.equal(decide({ severity: 'critical' }).needsLlm, true);
  assert.equal(decide({ severity: 'warning' }).needsLlm, false);
  assert.equal(decide({ severity: 'info' }).needsLlm, false);
});

// ─────────────────────────────── worker path ───────────────────────────────

test('info signal → skip, logged, no ask', async () => {
  const before = (await asksFor(ORG.alpha)).length;
  const out = await worker(signal({ severity: 'info', eventId: EVENT.alpha }));
  assert.equal(out.results[0].decision, 'skip');
  assert.equal(out.results[0].costCents, 0);
  assert.ok(out.results[0].runId);
  assert.equal(out.results[0].askId, null);
  assert.equal((await asksFor(ORG.alpha)).length, before);
});

test('warning signal → ask, and an operator ask is created', async () => {
  const before = (await asksFor(ORG.alpha)).length;
  const out = await worker(
    signal({ severity: 'warning', eventId: EVENT.alpha, locationId: LOC.alphaTower }),
  );
  assert.equal(out.results[0].decision, 'ask');
  assert.ok(out.results[0].askId);
  const asks = await asksFor(ORG.alpha);
  assert.equal(asks.length, before + 1);
  assert.ok(asks.some((a) => a.id === out.results[0].askId && a.location_id === LOC.alphaTower));
});

test('critical signal within budget → act, books cost', async () => {
  const out = await worker(signal({ severity: 'critical', eventId: EVENT.alpha }));
  assert.equal(out.results[0].decision, 'act');
  assert.equal(out.results[0].costCents, 5);
  const spent = (await pg.query("select public.agent_spend_cents($1, interval '1 hour') as c", [ORG.alpha])).rows[0].c;
  assert.ok(spent >= 5);
});

test('spend guard short-circuits act → skip when the org budget is exhausted', async () => {
  // Zero out Beta's hourly budget; any LLM-backed decision must defer.
  await pg.query('update public.organizations set agent_hourly_budget_cents = 0 where id = $1', [ORG.beta]);
  const asksBefore = (await asksFor(ORG.beta)).length;

  const out = await worker(signal({ organizationId: ORG.beta, severity: 'critical', eventId: EVENT.beta }));
  assert.equal(out.results[0].decision, 'skip');
  assert.equal(out.results[0].costCents, 0);
  assert.match(out.results[0].runId ? 'ok' : '', /ok/); // still logged
  const run = (await runsFor(ORG.beta)).at(-1);
  assert.match(run.rationale, /Spend guard/);
  assert.equal((await asksFor(ORG.beta)).length, asksBefore); // no ask on skip
});

// ─────────────────────────── reasoner seam ─────────────────────────────────

test('act path invokes the injected reasoner; model cost + rationale are recorded', async () => {
  const calls = [];
  const w = createWorker(async () => pg, {
    reason: async (sig) => {
      calls.push(sig);
      return { rationale: 'Model plan: throttle intake and alert facilities.', costCents: 7 };
    },
  });
  const out = await w(signal({ organizationId: ORG.platform, severity: 'critical' }));
  assert.equal(out.results[0].decision, 'act');
  assert.equal(out.results[0].costCents, 7); // from the model, not the estimate
  assert.equal(calls.length, 1);
  const run = (await runsFor(ORG.platform)).at(-1);
  assert.equal(run.rationale, 'Model plan: throttle intake and alert facilities.');
  assert.equal(run.cost_cents, 7);
});

test('reasoner is never called for ask/skip decisions', async () => {
  let called = 0;
  const w = createWorker(async () => pg, {
    reason: async () => {
      called += 1;
      return { rationale: 'x', costCents: 1 };
    },
  });
  await w(signal({ organizationId: ORG.platform, severity: 'warning' }));
  await w(signal({ organizationId: ORG.platform, severity: 'info' }));
  assert.equal(called, 0);
});

test('spend guard precedes the reasoner — no model call when budget exhausted', async () => {
  await pg.query('update public.organizations set agent_hourly_budget_cents = 0 where id = $1', [ORG.platform]);
  let called = 0;
  const w = createWorker(async () => pg, {
    reason: async () => {
      called += 1;
      return { rationale: 'x', costCents: 1 };
    },
  });
  const out = await w(signal({ organizationId: ORG.platform, severity: 'critical' }));
  assert.equal(out.results[0].decision, 'skip');
  assert.equal(called, 0);
});

// ─────────────────────────── publish seam ──────────────────────────────────

test('every processed signal publishes an activity (org-scoped, decision-tagged)', async () => {
  const published = [];
  const w = createWorker(async () => pg, {
    publish: async (a) => {
      published.push(a);
      return { published: true };
    },
  });
  const out = await w(signal({ organizationId: ORG.alpha, severity: 'warning', eventId: EVENT.alpha }));
  assert.equal(published.length, 1);
  const a = published[0];
  assert.equal(a.organizationId, ORG.alpha);
  assert.equal(a.decision, 'ask');
  assert.equal(a.eventId, EVENT.alpha);
  assert.equal(a.askId, out.results[0].askId); // the ask it just raised
  assert.ok(a.id && a.createdAt); // fan-out payload is fully formed
  assert.equal(out.results[0].published, true);
});

test('a publish failure is swallowed — the run still succeeds', async () => {
  const w = createWorker(async () => pg, {
    publish: async () => {
      throw new Error('appsync unreachable');
    },
  });
  const out = await w(signal({ organizationId: ORG.alpha, severity: 'info', eventId: EVENT.alpha }));
  assert.equal(out.ok, true);
  assert.equal(out.results[0].decision, 'skip');
  assert.ok(out.results[0].runId); // decision was durably recorded
  assert.equal(out.results[0].published, false);
});

test('default publisher is a no-op (published=false), never blocks a run', async () => {
  const w = createWorker(async () => pg); // no publish injected
  const out = await w(signal({ organizationId: ORG.alpha, severity: 'info', eventId: EVENT.alpha }));
  assert.equal(out.results[0].published, false);
});

// ─────────────────────────── delivery shapes ───────────────────────────────

test('normalize handles an SQS batch of EventBridge envelopes', async () => {
  const out = await worker({
    Records: [
      { body: JSON.stringify({ detail: signal({ severity: 'info', eventId: EVENT.alpha }) }) },
      { body: JSON.stringify({ detail: signal({ severity: 'warning', eventId: EVENT.alpha }) }) },
    ],
  });
  assert.equal(out.processed, 2);
  assert.equal(out.results[0].decision, 'skip');
  assert.equal(out.results[1].decision, 'ask');
});

test('a signal without an organization is rejected', async () => {
  await assert.rejects(worker({ kind: 'device_alert', severity: 'info' }));
});
