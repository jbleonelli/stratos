// Stratos — agent worker (the decision loop's executor).
//
// Consumes signals (SQS batch from the EventBridge work queue, an EventBridge
// event, a Step Functions task input, or a direct invoke) and, per signal:
//   1. decide()            — deterministic policy (agent-core)
//   2. spend guard         — LLM-backed decisions must fit the org hourly budget
//                            (public.agent_run_allowed); a breach → 'skip'
//   3. [Bedrock invoke]    — where an 'act' decision would call the model
//   4. record_agent_run    — append to the decision log
//   5. agent_raise_ask     — for 'ask' decisions, surface the question
//
// It is a SYSTEM actor: it connects as the DB master and calls the SECURITY
// DEFINER system RPCs from db/migrations/002_agent_runtime.sql (no claim
// bridge). `createWorker(getConnection)` lets tests inject a PGlite connection.

import { decide } from './agent-core.mjs';

function parseSignal(body) {
  const b = body ?? {};
  return {
    organizationId: b.organizationId ?? b.organization_id ?? null,
    eventId: b.eventId ?? b.event_id ?? null,
    locationId: b.locationId ?? b.location_id ?? null,
    kind: b.kind ?? 'event',
    severity: b.severity ?? 'info',
    payload: b.payload ?? {},
  };
}

// Accept the shapes the runtime can deliver and normalize to a signal list.
export function normalize(event) {
  if (Array.isArray(event?.Records)) {
    // SQS batch: each record body is the EventBridge detail (JSON string).
    return event.Records.map((r) => {
      const parsed = typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
      return parseSignal(parsed?.detail ?? parsed);
    });
  }
  if (event?.detail) return [parseSignal(event.detail)]; // single EventBridge event
  return [parseSignal(event)]; // Step Functions task input / direct invoke
}

async function processSignal(conn, signal) {
  if (!signal.organizationId) {
    throw new Error('signal missing organizationId');
  }

  const d = decide(signal);
  let decision = d.decision;
  let rationale = d.rationale;
  let cost = 0;

  if (d.needsLlm) {
    const { rows } = await conn.query('select public.agent_run_allowed($1, $2) as ok', [
      signal.organizationId,
      d.estCostCents,
    ]);
    if (!rows[0]?.ok) {
      decision = 'skip';
      rationale = `Spend guard: hourly budget exhausted — deferring ${signal.kind}.`;
    } else {
      // A real remediation path would invoke Bedrock here; we book the
      // estimated cost so the spend guard accounts for it.
      cost = d.estCostCents;
    }
  }

  const run = await conn.query(
    'select public.record_agent_run($1, $2, $3, $4, $5) as id',
    [signal.organizationId, signal.eventId, decision, rationale, cost],
  );
  const runId = run.rows[0]?.id ?? null;

  let askId = null;
  if (decision === 'ask') {
    const ask = await conn.query('select public.agent_raise_ask($1, $2, $3, $4) as id', [
      signal.organizationId,
      signal.eventId,
      d.question,
      signal.locationId,
    ]);
    askId = ask.rows[0]?.id ?? null;
  }

  return {
    organizationId: signal.organizationId,
    eventId: signal.eventId,
    decision,
    costCents: cost,
    runId,
    askId,
  };
}

/** Factory: `getConnection()` returns a single connection, optionally with `.release()`. */
export function createWorker(getConnection) {
  return async function handler(event) {
    const signals = normalize(event);
    const conn = await getConnection();
    try {
      const results = [];
      for (const signal of signals) {
        results.push(await processSignal(conn, signal));
      }
      return { ok: true, processed: results.length, results };
    } finally {
      await conn.release?.();
    }
  };
}

// Default production handler: one pooled pg connection per invocation.
export const handler = createWorker(async () => {
  const { getConnection } = await import('./pg-client.mjs');
  return getConnection();
});
