// Stratos — Cognito pre-token-generation Lambda.
//
// Runs on every token issuance (sign-in, refresh, org switch). It resolves the
// caller's active org + platform role from the database and injects them as the
// `organization_id` and `platform_role` claims — the source of truth the claim
// bridge and RLS helpers (current_user_org(), is_platform_admin()) read.
//
// The lookup uses public.resolve_login_claims(sub), a BYPASSRLS-owned function,
// because at this point the token (and therefore the caller's claims) does not
// exist yet. Transport-agnostic: `getConnection` yields a single DB connection
// (a pg Client in prod, a PGlite instance in tests).

export function createPreTokenHandler(getConnection) {
  return async function handler(event) {
    const sub = event?.request?.userAttributes?.sub;
    if (!sub) return event; // no subject → nothing to enrich

    const conn = await getConnection();
    let claims = {};
    try {
      const res = await conn.query('select public.resolve_login_claims($1) as claims', [sub]);
      claims = res.rows[0]?.claims ?? {};
    } finally {
      await conn.release?.();
    }

    const add = {};
    if (claims.organization_id) add.organization_id = claims.organization_id;
    if (claims.platform_role) add.platform_role = claims.platform_role;

    const existing = event.response?.claimsOverrideDetails ?? {};
    event.response = {
      ...event.response,
      claimsOverrideDetails: {
        ...existing,
        claimsToAddOrOverride: { ...(existing.claimsToAddOrOverride ?? {}), ...add },
      },
    };
    return event;
  };
}

// Default production handler: one pooled pg connection (as the DB master, which
// has EXECUTE on resolve_login_claims via the stratos_auth membership).
export const handler = createPreTokenHandler(async () => {
  const { getConnection } = await import('./pg-client.mjs');
  return getConnection();
});
