// Stratos — application-layer authorization (the primary enforcement point).
//
// Resolvers call these BEFORE touching the database. RLS is the backstop: even
// if a check here is missing or wrong, the policies in db/helpers + V1_baseline
// still scope every row. Keeping both is deliberate defense in depth.

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.extensions = { code: 'FORBIDDEN' };
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthenticatedError';
    this.extensions = { code: 'UNAUTHENTICATED' };
  }
}

export const isPlatformAdmin = (claims) => claims?.platform_role === 'platform_admin';

/** A valid Cognito subject must be present. */
export function requireAuth(claims) {
  if (!claims?.sub) throw new UnauthenticatedError();
}

/** The caller must have an active org, or be a platform admin. */
export function requireOrg(claims) {
  requireAuth(claims);
  if (isPlatformAdmin(claims)) return;
  if (!claims.organization_id) {
    throw new ForbiddenError('No active organization for caller');
  }
}

/** Explicit cross-tenant guard for operations that name a target org. */
export function assertOrgAccess(claims, targetOrgId) {
  requireAuth(claims);
  if (isPlatformAdmin(claims)) return;
  if (claims.organization_id && claims.organization_id === targetOrgId) return;
  throw new ForbiddenError(
    `Caller org ${claims.organization_id ?? '(none)'} may not access org ${targetOrgId}`,
  );
}
