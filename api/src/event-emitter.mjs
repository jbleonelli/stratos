// Stratos — the signal front door (ingest → EventBridge).
//
// When an event is recorded (Mutation.ingestEvent), the resolver emits a signal
// onto the EventBridge bus so the agent runtime evaluates it. The routing rule
// (infra/modules/eventbridge) forwards it to the SQS work queue → agent worker.
//
// Like the reasoner/publisher, this is a function seam: tests inject a fake; the
// default is a no-op so a missing bus (local dev / tests) never breaks the write.
// The AWS SDK is imported lazily so tests never load it. Emitting is best-effort
// at the call site — the event is already durable in Aurora.

import process from 'node:process';

// EventBridge `source` for API-originated events; must be in the routing rule's
// matched sources (infra/modules/eventbridge var.event_sources).
const SOURCE = 'stratos.api';
const DETAIL_TYPE = 'event.ingested';

// No-op emitter (tests / unconfigured environments).
export function defaultEmitter() {
  return async () => ({ emitted: false, skipped: true });
}

/**
 * Production emitter: PutEvents onto the bus named by EVENT_BUS_NAME.
 * @param {{region?:string, busName?:string}} [opts]
 */
export function makeEventBridgeEmitter(opts = {}) {
  const region = opts.region ?? process.env.AWS_REGION ?? 'us-east-1';
  const busName = opts.busName ?? process.env.EVENT_BUS_NAME ?? '';
  let client;

  return async function emit(signal) {
    if (!busName) return { emitted: false, skipped: true };

    const { EventBridgeClient, PutEventsCommand } = await import('@aws-sdk/client-eventbridge');
    client ??= new EventBridgeClient({ region });

    const res = await client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: busName,
            Source: SOURCE,
            DetailType: DETAIL_TYPE,
            Detail: JSON.stringify(signal),
          },
        ],
      }),
    );
    if (res.FailedEntryCount) {
      throw new Error(`EventBridge PutEvents failed: ${JSON.stringify(res.Entries)}`);
    }
    return { emitted: true };
  };
}

// Build the agent signal from a recorded event (camelCase mapper output).
export function signalFromEvent(event) {
  return {
    organizationId: event.organizationId,
    eventId: event.id,
    locationId: event.locationId ?? null,
    deviceId: event.deviceId ?? null,
    kind: event.kind,
    severity: event.severity,
    payload: event.payload ?? null,
  };
}
