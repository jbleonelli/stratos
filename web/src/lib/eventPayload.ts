/** Best-effort JSON payload parse for event/device telemetry strings. */
export function parsePayload(payload: string | null | undefined): Record<string, unknown> | null {
  if (!payload) return null;
  try {
    const v = JSON.parse(payload) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function payloadNumber(payload: string | null | undefined, key: string): number | null {
  const obj = parsePayload(payload);
  const n = obj?.[key];
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}
