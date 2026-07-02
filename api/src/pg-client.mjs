// Stratos — production DB connection for the Lambda handlers.
//
// Returns ONE pooled connection per request (the claim bridge needs a single
// connection for its transaction + SET LOCAL). The pool is reused across warm
// Lambda invocations. `pg` and the AWS SDK are imported dynamically so tests
// (which inject PGlite) never load them.
//
// Connection config resolution:
//   • DATABASE_URL if set (local/dev), else
//   • DB_HOST / DB_NAME / DB_PORT + username & password from the Secrets Manager
//     secret at DB_SECRET_ARN (the RDS-managed master credentials).
// The secret is fetched once per warm container and cached.

import process from 'node:process';

let pool;
let secretCache;

async function loadSecret() {
  if (secretCache) return secretCache;
  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    '@aws-sdk/client-secrets-manager'
  );
  const client = new SecretsManagerClient({});
  const res = await client.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }));
  secretCache = JSON.parse(res.SecretString);
  return secretCache;
}

async function poolConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  const secret = await loadSecret();
  return {
    host: process.env.DB_HOST ?? secret.host,
    port: Number(process.env.DB_PORT ?? secret.port ?? 5432),
    database: process.env.DB_NAME ?? secret.dbname ?? 'stratos',
    user: secret.username,
    password: secret.password,
    // In-VPC TLS to RDS. Harden with the RDS CA bundle for full verification.
    ssl: { rejectUnauthorized: false },
  };
}

export async function getConnection() {
  const { default: pg } = await import('pg');
  if (!pool) {
    pool = new pg.Pool({ ...(await poolConfig()), max: 1, idleTimeoutMillis: 30_000 });
  }
  const client = await pool.connect();
  // withClaims uses `.query`; `.release()` returns the connection to the pool.
  return {
    query: (text, params) => client.query(text, params),
    release: () => client.release(),
  };
}
