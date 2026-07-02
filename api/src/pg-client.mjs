// Stratos — production DB connection for the resolver Lambda.
//
// Returns ONE pooled connection per request (the claim bridge needs a single
// connection for its transaction + SET LOCAL). The pool is reused across warm
// Lambda invocations. `pg` is imported dynamically so tests (which inject PGlite)
// never load it.
//
// DATABASE_URL is resolved from Secrets Manager at cold start in the deployed
// stack. An RDS Data API adapter can replace this later without touching the
// resolver — it only needs `.query(sql, params)`.

import process from 'node:process';

let pool;

export async function getConnection() {
  const { default: pg } = await import('pg');
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 30_000,
    });
  }
  const client = await pool.connect();
  // withClaims uses `.query`; `.release()` returns the connection to the pool.
  return {
    query: (text, params) => client.query(text, params),
    release: () => client.release(),
  };
}
