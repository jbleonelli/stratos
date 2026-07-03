// @ts-check
// Provider-agnostic realtime subscription wrapper.
//
// Why: every realtime callsite in this codebase currently calls
// `supabase.channel(...).on('postgres_changes', ...)` directly, which
// hard-couples the codebase to supabase-js v2's quirks and makes any
// future provider swap (AppSync, Ably, Pusher, custom WebSockets) a
// 10-file rewrite. Routing through this wrapper means future-us
// changes one file.
//
// The wrapper API uses generic vocabulary — table / event / filter /
// onChange — not channel / binding / subscribe / postgres_changes.
// Callers describe WHAT they want to watch, not HOW it's wired.
//
// Hidden inside the wrapper are two supabase-js v2 gotchas the rest
// of the codebase used to copy-paste around:
//
//   1. `channel('topic')` is dedup'd by topic. Two hooks subscribing
//      the same literal topic throw "cannot add postgres_changes
//      callbacks". We auto-suffix every topic with a random id.
//
//   2. Chained `.on('postgres_changes', ...)` on the same channel
//      registers only the first binding. We give each binding its
//      own channel under a topic prefix.
//
// Both behaviours are Supabase-specific. A future provider swap can
// drop those internals; the public API is unchanged.

import { supabase } from './supabase.js';

let nextInstanceId = 0;
function uniqueTopic(prefix) {
  // Counter + random keeps topics unique under React StrictMode
  // double-invoke (counter alone would collide on the second mount).
  return `${prefix}_i${++nextInstanceId}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Subscribe to row-change events on one or more tables.
 *
 * @param {object} args
 * @param {string} args.topic      Logical name for this subscription. Used as a
 *                                 prefix; the wrapper appends a unique suffix to
 *                                 avoid topic collisions.
 * @param {Array<{
 *   table: string,
 *   event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
 *   filter?: string,
 *   onChange: (payload: { eventType: string, new: any, old: any }) => void,
 * }>} args.bindings
 * @param {string} [args.schema='public']
 * @returns {() => void} unsubscribe — call to tear down all subscriptions.
 */
export function subscribeToChanges({ topic, bindings, schema = 'public' }) {
  if (typeof window === 'undefined') return () => {};
  if (!bindings || bindings.length === 0) return () => {};

  // One channel per binding (supabase-js v2 chained-.on() limitation).
  const channels = bindings.map((b, i) => {
    const ch = supabase
      .channel(uniqueTopic(`${topic}_b${i}`))
      .on('postgres_changes', { event: b.event || '*', schema, table: b.table, filter: b.filter }, b.onChange);
    ch.subscribe();
    return ch;
  });

  return () => {
    for (const ch of channels) {
      try {
        supabase.removeChannel(ch);
      } catch {
        /* ignore */
      }
    }
  };
}
