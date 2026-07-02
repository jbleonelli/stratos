// Stratos claim bridge (DB side of an AppSync/Lambda resolver).
//
// This is the exact pattern every resolver DB call uses in production: open a
// transaction, drop to the non-privileged resolver role, inject the caller's
// Cognito claims as `request.jwt.claims`, run the work, commit. The RLS helpers
// in db/helpers/001_authz.sql read those claims, so Postgres re-enforces tenant
// isolation as a backstop behind the app-layer checks.
//
// In production `db` is an RDS Data API / RDS Proxy connection; here it is a
// PGlite instance. The shape is identical.

export const RESOLVER_ROLE = 'stratos_resolver';

/**
 * Run `fn` inside a transaction scoped to the caller's claims.
 * @param {{query: Function}} db   connection (PGlite or pg client)
 * @param {object} claims          Cognito claims: { sub, organization_id, platform_role }
 * @param {(db) => Promise<any>} fn the resolver body
 */
export async function withClaims(db, claims, fn) {
  await db.query('BEGIN');
  try {
    // SET LOCAL ROLE stratos_resolver — RLS is enforced (role has no BYPASSRLS).
    await db.query("SELECT set_config('role', $1, true)", [RESOLVER_ROLE]);
    // SET LOCAL request.jwt.claims = '{...}' — the bridge the RLS helpers read.
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(claims ?? {}),
    ]);
    const result = await fn(db);
    await db.query('COMMIT');
    return result;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

/** Thrown by the app-layer authorization check (the mandated primary layer). */
export class ForbiddenError extends Error {
  constructor(message = 'Forbidden: cross-tenant access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * App-layer authorization: the primary, mandated enforcement point. A resolver
 * calls this BEFORE touching the DB. Skipping it (a resolver bug) is what the
 * "app-layer bypassed" test mode simulates — RLS must then catch the leak.
 */
export function assertOrgAccess(claims, targetOrgId) {
  if (claims?.platform_role === 'platform_admin') return;
  if (claims?.organization_id && claims.organization_id === targetOrgId) return;
  throw new ForbiddenError(
    `Forbidden: caller org ${claims?.organization_id ?? '(none)'} may not access org ${targetOrgId}`,
  );
}
