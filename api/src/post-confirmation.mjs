// Stratos — Cognito post-confirmation Lambda.
//
// Runs after a user confirms signup (or sets a permanent password from an admin
// invite). Bootstraps the profile row and auto-accepts pending org invites for
// the signup email so the pre-token Lambda can inject organization_id on first
// sign-in.

export function createPostConfirmationHandler(getConnection) {
  return async function handler(event) {
    const attrs = event?.request?.userAttributes ?? {};
    const sub = attrs.sub;
    const email = attrs.email;
    if (!sub || !email) return event;

    const name = [attrs.given_name, attrs.family_name].filter(Boolean).join(' ') || attrs.name || null;

    const conn = await getConnection();
    try {
      await conn.query('select public.bootstrap_user_on_signup($1, $2, $3)', [sub, email, name]);
    } finally {
      await conn.release?.();
    }

    return event;
  };
}

export const handler = createPostConfirmationHandler(async () => {
  const { getConnection } = await import('./pg-client.mjs');
  return getConnection();
});
