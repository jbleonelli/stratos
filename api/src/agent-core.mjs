// Stratos — agent decision core (pure).
//
// The deterministic policy that maps a normalized signal to a decision. Kept
// free of I/O so it is trivially unit-testable and so the same logic runs
// whether the caller is the SQS worker or a Step Functions task. The three
// decisions mirror the runtime doc: act / ask / skip.
//
//   critical → act   (would drive a remediation; LLM-backed, spend-guarded)
//   warning  → ask    (surface a question to operators; deterministic)
//   info/…   → skip   (log only)

/** @typedef {{organizationId:string, eventId?:string|null, locationId?:string|null, kind:string, severity:string, payload?:object}} Signal */
/** @typedef {{decision:'act'|'ask'|'skip', rationale:string, needsLlm:boolean, estCostCents:number, question:string|null}} Decision */

const KNOWN = new Set(['act', 'ask', 'skip']);

/**
 * @param {Signal} signal
 * @returns {Decision}
 */
export function decide(signal) {
  const kind = signal?.kind ?? 'event';
  const severity = signal?.severity ?? 'info';

  switch (severity) {
    case 'critical':
      return {
        decision: 'act',
        rationale: `Critical ${kind}: engaging automated remediation.`,
        needsLlm: true,
        estCostCents: 5,
        question: null,
      };
    case 'warning':
      return {
        decision: 'ask',
        rationale: `Warning ${kind}: operator input required.`,
        needsLlm: false,
        estCostCents: 0,
        question: `A ${kind} (${severity}) was detected. How should we respond?`,
      };
    default:
      return {
        decision: 'skip',
        rationale: `${severity} ${kind}: informational, no action taken.`,
        needsLlm: false,
        estCostCents: 0,
        question: null,
      };
  }
}

export function isDecision(value) {
  return typeof value === 'string' && KNOWN.has(value);
}
