// Stratos — map snake_case DB rows to the camelCase GraphQL shapes in
// schema.graphql. AppSync serves AWSJSON as a JSON string and AWSDateTime as an
// ISO-8601 string; we normalize both here.

const iso = (v) => (v instanceof Date ? v.toISOString() : v ?? null);
const json = (v) => (v == null ? null : typeof v === 'string' ? v : JSON.stringify(v));

export const toOrganization = (r) =>
  r && {
    id: r.id,
    name: r.name,
    slug: r.slug,
    kind: r.kind,
    lifecycleState: r.lifecycle_state,
    createdAt: iso(r.created_at),
  };

export const toEvent = (r) =>
  r && {
    id: r.id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    deviceId: r.device_id,
    kind: r.kind,
    severity: r.severity,
    externalId: r.external_id,
    payload: json(r.payload),
    createdAt: iso(r.created_at),
  };

export const toAsk = (r) =>
  r && {
    id: r.id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    eventId: r.event_id,
    question: r.question,
    status: r.status,
    answer: r.answer,
    createdBy: r.created_by,
    resolvedBy: r.resolved_by,
    createdAt: iso(r.created_at),
    resolvedAt: iso(r.resolved_at),
  };
