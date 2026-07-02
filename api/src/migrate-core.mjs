// Stratos — forward-only migration runner (pure logic, transport-agnostic).
//
// Applies ordered SQL slices exactly once, tracked in public.schema_migrations.
// Each slice runs as a single simple-query batch wrapped in its own
// transaction, so a failure rolls the slice back atomically and leaves earlier
// slices applied.
//
// `conn` is a single connection. Multi-statement SQL must go over the simple
// query protocol: node-postgres does this for `.query(sql)` with no params;
// PGlite exposes it as `.exec(sql)`. We pick whichever the connection offers.

export async function runMigrations(conn, migrations, { applySeed = false } = {}) {
  const execRaw = (sql) => (typeof conn.exec === 'function' ? conn.exec(sql) : conn.query(sql));

  await execRaw(
    'create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now());',
  );

  const applied = [];
  for (const { version, sql, seed } of migrations) {
    if (seed && !applySeed) continue;
    if (/[^A-Za-z0-9_.-]/.test(version)) throw new Error(`Invalid migration version: ${version}`);

    const { rows } = await conn.query('select 1 from public.schema_migrations where version = $1', [
      version,
    ]);
    if (rows.length > 0) continue;

    // One transactional batch: an error anywhere aborts and rolls back the slice.
    await execRaw(
      `BEGIN;\n${sql}\n;\ninsert into public.schema_migrations (version) values ('${version}');\nCOMMIT;`,
    );
    applied.push(version);
  }
  return { applied };
}
