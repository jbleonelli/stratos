// Typed Supabase client for the data layer.
//
// `supabase.js` stays untyped JS (it has ~hundreds of importers; converting it
// would be a big-bang change). New typed data code — React Query hooks under
// queries/, and any `.ts`/`.tsx` that talks to the DB — imports `sb` from here
// instead, so `.from('table').select('col')` is autocompleted and type-checked
// against the generated schema in types/db.ts.
//
// It's the SAME runtime client (same auth/session/storage) — only the static
// types differ. The cast is the one-time bridge from untyped JS to the typed
// world; remove it if/when supabase.js itself becomes TypeScript.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/db';
// eslint-disable-next-line import/extensions
import { supabase } from './supabase.js';

export const sb = supabase as unknown as SupabaseClient<Database>;
