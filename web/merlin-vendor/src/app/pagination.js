// @ts-check
// PostgREST silently caps single-request SELECTs at 1000 rows
// (the configured `db-max-rows`). For multi-tenant tables that can
// exceed that per-tenant — devices, locations, asks, overrides — an
// unbounded `.select()` truncates without error and the caller never
// notices until rows go missing.
//
// fetchAllPaginated walks a query in 1000-row pages until the server
// returns a partial page. Use it whenever the query's natural answer
// could realistically grow past the cap (per-tenant data tables,
// time-windowed history queries with high volume, cross-tenant
// platform-admin queries, etc).
//
// Usage:
//   const rows = await fetchAllPaginated(() =>
//     supabase.from('locations').select('*').order('id')
//   );
//
// Caller passes a *function* that returns a fresh query each call so
// we can chain a different `.range()` per page. Original ordering /
// filters / column lists carry through unchanged.

const DEFAULT_PAGE_SIZE = 1000;

export async function fetchAllPaginated(buildQuery, { pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const q = buildQuery().range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}
