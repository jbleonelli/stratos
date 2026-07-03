# Events API

How external systems (device firmware, web service webhooks, custom
integrations) push signals into Merlin. Every event lands in
`public.events`; agents read events on their cron tick, decide what
to do, and surfaces (Activity, Hypervisor, My day) render the result.

**Base URL:** `https://merlin.adaptiv.systems/api/events`

---

## Authentication

Every request includes a key header. Keys are provisioned in
`/platform` and returned ONCE at creation time — Merlin stores only
`sha256(secret)` and the first 8 characters for display.

```
X-Device-Key: dvc_<32-char-secret>
```

or, equivalently, for web-service integrations:

```
X-Integration-Key: dvc_<32-char-secret>
```

The two headers are interchangeable; pick whichever reads more
naturally for the caller. Keys carry a `scope`:

```json
{
  "kinds": ["voc_spike", "water_leak"], // optional whitelist; empty = any kind
  "location_prefix": "hq-fl-32" // optional; events must have location_id starting with this
}
```

A request that violates the scope returns `400 Bad Request`. Revoked
keys return `401 Unauthorized`.

---

## Endpoints

### `POST /api/events/ingest`

Single-event ingest.

**Request body:**

| Field         | Type        | Required | Notes                                                                                                                                                                    |
| ------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `kind`        | string      | yes      | What this event represents. Free-text, but agents only act on kinds they recognise (e.g. `voc_spike`, `water_leak`, `badge_deny`, `setpoint_drift`).                     |
| `severity`    | enum string | no       | `info` \| `medium` \| `high` \| `critical`. Defaults to `medium`.                                                                                                        |
| `location_id` | string      | no       | Where the signal originated (e.g. `hq-fl-32-r-restroom-w`). If the key has a `location_prefix` scope, this must match it.                                                |
| `payload`     | object      | no       | Free-form. Raw + normalized readings, sensor IDs, etc.                                                                                                                   |
| `external_id` | string      | no       | Source-supplied idempotency key. Re-posting the same `(organization_id, external_id)` returns the existing event row with `dedup: true` instead of creating a duplicate. |

**Responses:**

- `201 Created` — new event:
  ```json
  { "event_id": "<uuid>", "received_at": "2026-05-27T08:30:12Z" }
  ```
- `200 OK` — idempotent replay:
  ```json
  { "event_id": "<existing-uuid>", "received_at": "...", "dedup": true }
  ```
- `400 Bad Request` — validation failure (missing `kind`, scope violation, malformed JSON).
- `401 Unauthorized` — missing, malformed, or revoked key.
- `429 Too Many Requests` — rate limit exceeded.

**Example (cURL):**

```bash
curl -X POST https://merlin.adaptiv.systems/api/events/ingest \
  -H "X-Device-Key: $DEVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "voc_spike",
    "severity": "high",
    "location_id": "hq-fl-32-r-restroom-w",
    "payload": { "tvoc_ppb": 1240, "baseline": 320 },
    "external_id": "probe-32w-1779862834"
  }'
```

### `POST /api/events/ingest/batch`

Bulk ingest. Up to 50 events per call.

**Request body:**

```json
{
  "events": [
    { "kind": "voc_spike", "severity": "high", ... },
    { "kind": "voc_spike", "severity": "medium", "external_id": "...", ... }
  ]
}
```

**Response:**

```json
{
  "results": [
    { "event_id": "<uuid>", "received_at": "..." },
    { "event_id": "<existing-uuid>", "received_at": "...", "dedup": true },
    { "error": "kind required", "index": 7 }
  ]
}
```

Per-item validation: bad items get an `error` field but the rest of
the batch still inserts. Status code is `200` if at least one item
was accepted, `400` if every item failed.

### `POST /api/events/heartbeat`

Updates `device_keys.last_seen_at` only. Use it from devices that
should stay marked "online" even when no real event has been sent in
a while.

```bash
curl -X POST https://merlin.adaptiv.systems/api/events/heartbeat \
  -H "X-Device-Key: $DEVICE_KEY"
```

Response: `200 OK { "last_seen_at": "..." }`.

---

## Rate limits

Per-key token bucket: **20 burst, ~100 req/min refill**. Excess
returns `429`. The bucket is in-process per Vercel instance, so a
distributed burst across many cold starts may briefly exceed the
nominal rate before settling — design retries with jitter regardless.

---

## Idempotency & retries

Devices on flaky networks should send an `external_id` on every
event. The server treats `(organization_id, external_id)` as a unique
key:

- First call → `201 Created` with the new `event_id`.
- Subsequent calls with the same `external_id` → `200 OK` with the
  same `event_id` and `dedup: true`.

The device can safely retry without coordinating with the server.

A reasonable `external_id` format:
`<source_short_name>-<location_short>-<unix_seconds>` or just a UUID
the device generates locally. Anything stable across retries.

---

## Severity & kind conventions

`severity` is an enum. `kind` is free-text — agents subscribe to the
kinds they care about. Existing kinds in use today (non-exhaustive):

| Kind                | Severity | Notes                                                                           |
| ------------------- | -------- | ------------------------------------------------------------------------------- |
| `voc_spike`         | high     | Air-quality sensor exceeded baseline. Payload: `tvoc_ppb`, `baseline`.          |
| `water_leak`        | critical | Moisture detected at a sensor. Payload: `sensor_id`, location detail.           |
| `badge_deny`        | medium   | Access reader denied an entry. Payload: `badge_id`, `door_id`.                  |
| `setpoint_drift`    | medium   | HVAC zone outside ±2°C of setpoint. Payload: `zone`, `delta_c`.                 |
| `cold_chain_drift`  | high     | Cold-storage probe outside acceptable range. Payload: `setpoint_c`, `actual_c`. |
| `consumption_spike` | info     | Utility-meter consumption above baseline. Payload: `kwh`, `baseline_kwh`.       |

Adding a new kind is free — just start posting; if no agent claims it
the event lands in the unprocessed pool and surfaces show it as a
raw event.

---

## Worked examples

### Node.js (web-service webhook adapter)

```js
import { fetch } from 'undici';

async function forwardToMerlin(observation) {
  const res = await fetch('https://merlin.adaptiv.systems/api/events/ingest', {
    method: 'POST',
    headers: {
      'X-Integration-Key': process.env.MERLIN_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      kind: 'voc_spike',
      severity: observation.tvoc_ppb > 1000 ? 'high' : 'medium',
      location_id: observation.location,
      payload: { tvoc_ppb: observation.tvoc_ppb, baseline: observation.baseline },
      external_id: `voc-${observation.sensor_id}-${observation.ts}`,
    }),
  });
  if (!res.ok) throw new Error(`Merlin ingest failed: ${res.status}`);
  return await res.json();
}
```

### Python (batch reporter)

```python
import requests, os, time, uuid

key = os.environ['MERLIN_KEY']
buffer = []

def buffer_event(kind, severity, location_id, payload):
    buffer.append({
        'kind': kind,
        'severity': severity,
        'location_id': location_id,
        'payload': payload,
        'external_id': f'{kind}-{location_id}-{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}',
    })
    if len(buffer) >= 25:
        flush()

def flush():
    if not buffer: return
    payload = {'events': buffer[:50]}
    r = requests.post(
        'https://merlin.adaptiv.systems/api/events/ingest/batch',
        headers={'X-Device-Key': key, 'Content-Type': 'application/json'},
        json=payload,
        timeout=10,
    )
    r.raise_for_status()
    buffer.clear()
```

### ESP32 / Arduino (device firmware)

```cpp
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

const char* DEVICE_KEY = "dvc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const char* MERLIN_URL = "https://merlin.adaptiv.systems/api/events/ingest";

void sendEvent(const char* kind, const char* severity, float tvoc_ppb, float baseline) {
  HTTPClient http;
  http.begin(MERLIN_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);

  String body = String("{")
    + "\"kind\":\"" + kind + "\","
    + "\"severity\":\"" + severity + "\","
    + "\"location_id\":\"hq-fl-32-r-restroom-w\","
    + "\"payload\":{\"tvoc_ppb\":" + tvoc_ppb + ",\"baseline\":" + baseline + "},"
    + "\"external_id\":\"voc-32w-" + millis() + "\""
    + "}";

  int status = http.POST(body);
  http.end();
  // On 401/429: back off + retry. On 5xx: queue + retry with the
  // SAME external_id. On 200/201: clear local queue.
}
```

---

## What happens after an event lands

1. `events` row created. Default state: `processed_at = NULL`,
   `resolved = false`.
2. The matching agent picks it up on its next cron tick (within ~5
   min), batches it with any other unprocessed events of the same
   kind, and makes a decision.
3. The agent writes an `agent_runs` row carrying its decision
   (`act` / `ask` / `skip`) and stamps every consumed event with
   `processed_at`, `processed_by_agent_id`, `agent_run_id`.
4. If `decision='act'` the event is marked `resolved=true` with
   `resolved_reason='agent_acted'`. If `decision='ask'` the event
   stays unresolved and shows up on Hypervisor + Activity + My day
   awaiting human Approve / Hold. Approve flips
   `resolved=true, resolved_reason='agent_acted'`; Hold flips
   `resolved=true, resolved_reason='human_dismissed'`.

For inspection of any single event:

```sql
select e.*, r.decision, r.ask_resolution
from public.events e
left join public.agent_runs r on r.id = e.agent_run_id
where e.id = '<event-id>';
```

---

## Provisioning a key

In `/platform`:

1. Open the target tenant → Devices.
2. Click **New device key**.
3. Choose:
   - `label` (display name — e.g. "HQ floor-32 IAQ probe")
   - `device_id` (link to an existing device, optional)
   - `scope` (kinds + location_prefix)
4. Click **Create**. The full secret is shown ONCE — copy it into your
   firmware / vault now. After this dialog closes, only the prefix is
   visible.

To rotate: revoke the old key, create a new one, deploy. To revoke:
click **Revoke** on the key row.

---

## See also

- [docs/architecture/events-pipeline.md](../architecture/events-pipeline.md)
  — design doc for the unified events model.
- [docs/architecture/message-event-stack.md](../architecture/message-event-stack.md)
  — overview of every store/hook/surface in the customer app.
