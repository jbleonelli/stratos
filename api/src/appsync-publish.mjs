// Stratos — the agent's push-to-UI seam (AppSync fan-out).
//
// After the worker records a decision, it publishes an AgentActivity to AppSync
// so the SPA's onAgentActivity subscribers update live. AppSync only fans out
// to subscribers when a *mutation* runs, so we invoke the IAM-only
// `publishAgentActivity` mutation (a NONE-data-source passthrough) with SigV4.
//
// Like the reasoner, this is a function seam: tests inject a fake; the default
// is a no-op so a missing endpoint (or local dev) never breaks a run. All AWS
// SDK / signing modules are imported lazily so tests never load them.

import process from 'node:process';

const PUBLISH_MUTATION = /* GraphQL */ `
  mutation Publish($input: PublishAgentActivityInput!) {
    publishAgentActivity(input: $input) {
      id organizationId decision createdAt
    }
  }
`;

// No-op publisher (tests / unconfigured environments).
export function defaultPublisher() {
  return async () => ({ published: false, skipped: true });
}

/**
 * Production publisher: SigV4-signed POST of the publishAgentActivity mutation.
 * The GraphQL URL comes from APPSYNC_URL (if set) or the SSM parameter named by
 * APPSYNC_URL_PARAM (written by the appsync module). Both are cached warm.
 *
 * @param {{region?:string}} [opts]
 */
export function makeAppSyncPublisher(opts = {}) {
  const region = opts.region ?? process.env.AWS_REGION ?? 'us-east-1';
  let endpointCache;

  async function endpoint() {
    if (endpointCache !== undefined) return endpointCache;
    if (process.env.APPSYNC_URL) {
      endpointCache = process.env.APPSYNC_URL;
      return endpointCache;
    }
    const name = process.env.APPSYNC_URL_PARAM;
    if (!name) {
      endpointCache = null;
      return endpointCache;
    }
    const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
    const ssm = new SSMClient({ region });
    const res = await ssm.send(new GetParameterCommand({ Name: name }));
    endpointCache = res.Parameter?.Value ?? null;
    return endpointCache;
  }

  return async function publish(activity) {
    const url = await endpoint();
    if (!url) return { published: false, skipped: true };

    const { SignatureV4 } = await import('@smithy/signature-v4');
    const { HttpRequest } = await import('@smithy/protocol-http');
    const { Sha256 } = await import('@aws-crypto/sha256-js');
    const { fromNodeProviderChain } = await import('@aws-sdk/credential-providers');

    const parsed = new URL(url);
    const body = JSON.stringify({ query: PUBLISH_MUTATION, variables: { input: activity } });

    const request = new HttpRequest({
      method: 'POST',
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      path: parsed.pathname,
      headers: { 'content-type': 'application/json', host: parsed.hostname },
      body,
    });

    const signer = new SignatureV4({
      service: 'appsync',
      region,
      credentials: fromNodeProviderChain(),
      sha256: Sha256,
    });
    const signed = await signer.sign(request);

    const res = await fetch(url, { method: 'POST', headers: signed.headers, body });
    const json = await res.json();
    if (json.errors?.length) {
      throw new Error(`AppSync publish failed: ${json.errors.map((e) => e.message).join('; ')}`);
    }
    return { published: true };
  };
}
