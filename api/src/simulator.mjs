// Stratos — signal simulator (demo/load driver for the agent loop).
//
// A scheduled Lambda (EventBridge rule → this handler) that, per tick, picks a
// real seeded device, records a synthetic event, and emits a signal onto the
// EventBridge bus — exactly the shape the resolver's front door emits. The bus
// rule routes it to the agent worker, so the whole loop (decide → record →
// ask/act → push) runs without real devices.
//
// It is a SYSTEM actor (like the worker): it connects as the DB master and
// inserts directly (no claim bridge). `createSimulator(getConnection, opts)`
// lets tests inject a PGlite connection + a fake emitter.

import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { defaultEmitter } from './event-emitter.mjs';

// Weighted synthetic signal. `critical` is deliberately rare so the act path
// (Bedrock) fires occasionally, not on every tick.
const KINDS = ['sensor_reading', 'device_alert', 'webhook'];

export function generate(rand = Math.random) {
  const r = rand();
  const severity = r < 0.1 ? 'critical' : r < 0.4 ? 'warning' : 'info';
  const kind = KINDS[Math.floor(rand() * KINDS.length)] ?? 'sensor_reading';
  const payload = {
    simulated: true,
    metric: 'temp_c',
    value: Math.round((18 + rand() * 12) * 10) / 10, // 18.0–30.0
  };
  return { kind, severity, payload };
}

async function emitOne(conn, emit, generate) {
  // A coherent org/location/device triple from a real seeded device.
  const dev = await conn.query(
    'select id, organization_id, location_id from public.devices order by random() limit 1',
  );
  const d = dev.rows[0];
  if (!d) return null; // nothing seeded to simulate against

  const { kind, severity, payload } = generate();
  const externalId = `sim-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const ev = await conn.query(
    `insert into public.events
       (organization_id, location_id, device_id, kind, severity, external_id, payload)
     values ($1, $2, $3, $4::public.event_kind, $5::public.event_severity, $6, $7::jsonb)
     returning id`,
    [d.organization_id, d.location_id, d.id, kind, severity, externalId, JSON.stringify(payload)],
  );
  const eventId = ev.rows[0]?.id ?? null;

  const signal = {
    organizationId: d.organization_id,
    eventId,
    locationId: d.location_id,
    deviceId: d.id,
    kind,
    severity,
    payload,
  };
  await emit(signal);
  return signal;
}

/**
 * Factory.
 * @param {() => Promise<{query:Function, release?:Function}>} getConnection
 * @param {{emit?:Function, count?:number, generate?:Function}} [opts]
 */
export function createSimulator(getConnection, opts = {}) {
  const emit = opts.emit ?? defaultEmitter();
  const gen = opts.generate ?? generate;
  const count = Math.max(1, opts.count ?? Number(process.env.SIGNALS_PER_TICK ?? 1));

  return async function handler() {
    const conn = await getConnection();
    try {
      const emitted = [];
      for (let i = 0; i < count; i += 1) {
        const s = await emitOne(conn, emit, gen);
        if (s) emitted.push(s);
      }
      return { ok: true, emitted: emitted.length, signals: emitted };
    } finally {
      await conn.release?.();
    }
  };
}

// Default production handler: one pooled pg connection, emitting to EventBridge.
export const handler = createSimulator(
  async () => {
    const { getConnection } = await import('./pg-client.mjs');
    return getConnection();
  },
  { emit: (await import('./event-emitter.mjs')).makeEventBridgeEmitter() },
);
