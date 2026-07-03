// Stratos — the agent's reasoning seam (Amazon Bedrock).
//
// A "reasoner" turns an `act` signal into a concrete remediation plan:
//   reason(signal, decision) → { rationale: string, costCents: number, plan?: object }
//
// The worker owns routing + the spend guard (agent-core / agent-worker); the
// reasoner owns the model call. Keeping it behind a function seam means:
//   • tests inject a deterministic fake — no network, no model
//   • the deterministic default (below) is used when no reasoner is supplied,
//     so the worker degrades to "book the estimate" rather than failing
//   • the Bedrock SDK is imported lazily, only in the production adapter, so it
//     never loads in tests
//
// Bedrock pricing is per-token; we approximate a per-invoke cost so the spend
// guard has something concrete to meter until token accounting is wired.

import process from 'node:process';

// Fallback reasoner: no model call. Returns the deterministic rationale/estimate
// the decision core already computed. This is what the worker uses in tests and
// if BEDROCK is not configured.
export function defaultReasoner() {
  return async (_signal, decision) => ({
    rationale: decision.rationale,
    costCents: decision.estCostCents,
    plan: null,
  });
}

const SYSTEM_PROMPT =
  'You are Stratos, a building-operations agent. Given a device/building signal, ' +
  'respond with a short remediation plan: what to do and why, in two sentences. ' +
  'Be concrete and conservative; never invent devices or locations.';

/**
 * Production reasoner backed by Bedrock. The SDK is dynamically imported so it
 * is only loaded when actually invoked.
 *
 * @param {{modelId?:string, region?:string, invokeCostCents?:number}} [opts]
 */
export function makeBedrockReasoner(opts = {}) {
  // Default is a current cross-region inference profile. Newer Claude models on
  // Bedrock are only invokable on-demand via an inference profile (the region
  // prefix, e.g. `us.`), not the bare foundation-model id. The account must have
  // model access enabled for whatever id is used here. Override per environment
  // with BEDROCK_MODEL_ID (e.g. us.anthropic.claude-sonnet-4-5-20250929-v1:0 for
  // stronger reasoning). Haiku 4.5 is the cost-effective default for the agent's
  // short remediation plans.
  const modelId = opts.modelId ?? process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
  const invokeCostCents = opts.invokeCostCents ?? Number(process.env.BEDROCK_INVOKE_COST_CENTS ?? 3);

  let client;
  return async function reason(signal, decision) {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    client ??= new BedrockRuntimeClient(opts.region ? { region: opts.region } : {});

    const prompt = [
      `Signal kind: ${signal.kind}`,
      `Severity: ${signal.severity}`,
      signal.locationId ? `Location: ${signal.locationId}` : null,
      `Payload: ${JSON.stringify(signal.payload ?? {})}`,
    ]
      .filter(Boolean)
      .join('\n');

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    });

    const res = await client.send(
      new InvokeModelCommand({ modelId, contentType: 'application/json', accept: 'application/json', body }),
    );
    const decoded = JSON.parse(new TextDecoder().decode(res.body));
    const text = decoded?.content?.map((c) => c.text).join('').trim() || decision.rationale;

    return { rationale: text, costCents: invokeCostCents, plan: { modelId } };
  };
}
