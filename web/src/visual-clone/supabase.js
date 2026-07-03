/**
 * Supabase stub for Merlin visual-clone mode.
 * Returns demo org + Meridian buildings so the real Merlin App.jsx renders.
 */
import { DEMO_LOCATIONS, DEMO_ORG, DEMO_PLATFORM_SETTINGS, DEMO_PROFILES } from './demo-data.js';

const TABLES = {
  organizations: [DEMO_ORG],
  locations: DEMO_LOCATIONS,
  profiles: DEMO_PROFILES,
  platform_settings: DEMO_PLATFORM_SETTINGS,
};

function matchRows(table, filters) {
  let rows = TABLES[table] ? [...TABLES[table]] : [];
  for (const f of filters) {
    if (f.op === 'eq') rows = rows.filter((r) => r[f.col] === f.val);
    if (f.op === 'is') rows = rows.filter((r) => (f.val === null ? r[f.col] == null : r[f.col] === f.val));
    if (f.op === 'in') rows = rows.filter((r) => f.val.includes(r[f.col]));
    if (f.op === 'gte') rows = rows.filter((r) => r[f.col] >= f.val);
    if (f.op === 'neq') rows = rows.filter((r) => r[f.col] !== f.val);
  }
  return rows;
}

function makeBuilder(table) {
  const filters = [];
  let orderCol = null;
  let ascending = true;
  let limitN = null;
  let wantSingle = false;
  let wantMaybeSingle = false;
  let insertPayload = null;
  let updatePayload = null;
  let isDelete = false;

  const builder = {
    select(_cols) {
      return builder;
    },
    eq(col, val) {
      filters.push({ op: 'eq', col, val });
      return builder;
    },
    neq(col, val) {
      filters.push({ op: 'neq', col, val });
      return builder;
    },
    is(col, val) {
      filters.push({ op: 'is', col, val });
      return builder;
    },
    in(col, val) {
      filters.push({ op: 'in', col, val });
      return builder;
    },
    gte(col, val) {
      filters.push({ op: 'gte', col, val });
      return builder;
    },
    or(_expr) {
      return builder;
    },
    order(col, opts) {
      orderCol = col;
      ascending = opts?.ascending !== false;
      return builder;
    },
    range(from, to) {
      limitN = to - from + 1;
      return builder;
    },
    limit(n) {
      limitN = n;
      return builder;
    },
    single() {
      wantSingle = true;
      return builder;
    },
    maybeSingle() {
      wantMaybeSingle = true;
      return builder;
    },
    insert(row) {
      insertPayload = row;
      return builder;
    },
    update(row) {
      updatePayload = row;
      return builder;
    },
    upsert(row) {
      insertPayload = row;
      return builder;
    },
    delete() {
      isDelete = true;
      return builder;
    },
    then(onFulfilled, onRejected) {
      return builder.execute().then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return builder.execute().catch(onRejected);
    },
    finally(fn) {
      return builder.execute().finally(fn);
    },
    async execute() {
      if (insertPayload || updatePayload || isDelete) {
        return { data: insertPayload || null, error: null };
      }
      let rows = matchRows(table, filters);
      if (orderCol) {
        rows.sort((a, b) => {
          const av = a[orderCol];
          const bv = b[orderCol];
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
        });
      }
      if (limitN != null) rows = rows.slice(0, limitN);
      if (wantSingle || wantMaybeSingle) {
        return { data: rows[0] ?? null, error: wantSingle && !rows[0] ? { message: 'not found' } : null };
      }
      return { data: rows, error: null };
    },
  };

  builder.then = (onFulfilled, onRejected) => builder.execute().then(onFulfilled, onRejected);

  return builder;
}

function makeChannel() {
  const channel = {
    on(_type, _filter, _cb) {
      return channel;
    },
    subscribe(_cb) {
      return { unsubscribe: () => undefined };
    },
  };
  return channel;
}

export const supabase = {
  from(table) {
    return makeBuilder(table);
  },
  rpc(fn, _params) {
    if (fn === 'get_effective_branding') {
      return Promise.resolve({ data: [], error: null });
    }
    return Promise.resolve({ data: null, error: null });
  },
  auth: {
    onAuthStateChange(cb) {
      queueMicrotask(() => cb('INITIAL_SESSION', null));
      return { data: { subscription: { unsubscribe: () => undefined } } };
    },
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: { session: null }, error: { message: 'Use demo mode' } }),
    resetPasswordForEmail: async () => ({ error: null }),
    updateUser: async () => ({ data: { user: null }, error: null }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
  channel: () => makeChannel(),
  removeChannel: () => undefined,
};

export function getRecoveryClient() {
  return supabase;
}
