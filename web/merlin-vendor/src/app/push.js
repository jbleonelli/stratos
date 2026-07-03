// Web Push client helpers for Merlin Mobile (backend item #2).
// Subscribe via the Push API and store the subscription in public.push_subscriptions
// (RLS: own rows). The VAPID public key comes from /api/push (GET); the sender
// lives in api/push.ts. Everything degrades gracefully when push isn't supported
// or the VAPID env vars aren't configured yet.

import { supabase } from './supabase.js';

let cachedKey; // undefined = not yet fetched, null = unconfigured, string = key

export function pushSupported() {
  return (
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  );
}

async function getVapidPublicKey() {
  if (cachedKey !== undefined) return cachedKey;
  try {
    const res = await fetch('/api/push', { method: 'GET' });
    const data = await res.json();
    cachedKey = data?.publicKey || null;
  } catch {
    cachedKey = null;
  }
  return cachedKey;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

function keyToB64Url(sub, name) {
  const k = sub.getKey(name);
  if (!k) return null;
  return btoa(String.fromCharCode(...new Uint8Array(k)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// { supported, configured, subscribed, permission }
export async function getPushState() {
  if (!pushSupported()) {
    return { supported: false, configured: false, subscribed: false, permission: 'default' };
  }
  const key = await getVapidPublicKey();
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    subscribed = !!(await reg.pushManager.getSubscription());
  } catch {
    /* ignore */
  }
  return { supported: true, configured: !!key, subscribed, permission: Notification.permission };
}

// Request permission, subscribe, and persist. Returns { ok, reason? }.
export async function enablePush(session) {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  const key = await getVapidPublicKey();
  if (!key) return { ok: false, reason: 'unconfigured' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  let sub;
  try {
    const reg = await navigator.serviceWorker.ready;
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }
  } catch {
    return { ok: false, reason: 'subscribe_failed' };
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: session?.userId,
      organization_id: session?.organizationId || null,
      endpoint: sub.endpoint,
      p256dh: keyToB64Url(sub, 'p256dh'),
      auth: keyToB64Url(sub, 'auth'),
      ua: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  if (error) return { ok: false, reason: 'store_failed' };
  return { ok: true };
}

// Fire a test push to the caller's own subscriptions.
export async function sendTestPush() {
  const headers = { 'content-type': 'application/json' };
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) headers.authorization = `Bearer ${session.access_token}`;
  } catch {
    /* proceed unauthenticated — server will 401 */
  }
  try {
    const res = await fetch('/api/push', { method: 'POST', headers, body: JSON.stringify({ test: true }) });
    return res.ok ? await res.json() : { ok: false };
  } catch {
    return { ok: false };
  }
}
