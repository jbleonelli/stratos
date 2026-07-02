// Stratos claim bridge — the DB access pattern every resolver uses.
//
// Open a transaction, drop to the non-privileged resolver role, inject the
// caller's Cognito claims as request.jwt.claims, run the work, commit. The RLS
// helpers in db/helpers/001_authz.sql read those claims, so Postgres re-enforces
// tenant isolation behind the resolver's app-layer checks.
//
// `conn` is any single connection exposing `.query(sql, params)` — a pg Client
// or a PGlite instance. It MUST be a single connection (not a pool), because the
// transaction + SET LOCAL only apply to one connection.

export const RESOLVER_ROLE = 'stratos_resolver';

export async function withClaims(conn, claims, fn) {
  await conn.query('BEGIN');
  try {
    await conn.query("SELECT set_config('role', $1, true)", [RESOLVER_ROLE]);
    await conn.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(claims ?? {}),
    ]);
    const result = await fn(conn);
    await conn.query('COMMIT');
    return result;
  } catch (err) {
    await conn.query('ROLLBACK');
    throw err;
  }
}

/**
 * Build the claim set from an AppSync Cognito identity. The pre-token-generation
 * Lambda injects `organization_id` and `platform_role`; we also accept the
 * `custom:` attribute form as a fallback.
 */
export function claimsFromIdentity(identity) {
  const c = identity?.claims ?? {};
  return {
    sub: identity?.sub ?? c.sub ?? null,
    organization_id: c.organization_id ?? c['custom:organization_id'] ?? null,
    platform_role: c.platform_role ?? c['custom:platform_role'] ?? null,
  };
}
