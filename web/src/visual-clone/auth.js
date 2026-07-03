/** Auth stub — always signed in as Meridian facility manager (visual clone). */
import { useEffect, useState } from 'react';
import { DEMO_SESSION } from './demo-data.js';

const listeners = new Set();
const adminListeners = new Set();
const recoveryListeners = new Set();
let current = DEMO_SESSION;
let recoveryMode = false;

function emit() {
  listeners.forEach((fn) => fn(current));
}
function emitAdmin(us) {
  adminListeners.forEach((fn) => fn(us));
}
function emitRecovery() {
  recoveryListeners.forEach((fn) => fn(recoveryMode));
}

export function onInviteOutcome(_fn) {
  return () => undefined;
}

export async function signup() {
  throw new Error('Signup disabled in visual clone mode');
}
export async function login() {
  current = DEMO_SESSION;
  emit();
}
export async function logout() {
  current = DEMO_SESSION;
  emit();
}
export async function resetPassword() {}
export function consumeRecoveryReturn() {
  return false;
}
export async function commitNewPassword() {}
export async function updateProfile() {}
export async function updatePreferences(prefs) {
  current = { ...current, preferences: { ...current.preferences, ...prefs } };
  emit();
}
export function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
}
export function getSession() {
  return current;
}
export function useSession() {
  const [s, setS] = useState(current);
  useEffect(() => {
    const fn = (next) => setS(next);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return s;
}
export function useRecoveryMode() {
  const [r, setR] = useState(recoveryMode);
  useEffect(() => {
    const fn = (v) => setR(v);
    recoveryListeners.add(fn);
    return () => recoveryListeners.delete(fn);
  }, []);
  return r;
}
export function canManageUser() {
  return true;
}
export function assignableRoles() {
  return ['facility', 'property_manager', 'executive'];
}
export function canAccessAdmin(role) {
  return role === 'superadmin' || role === 'property_manager';
}
export function canAccessAgentic(_role, isOrgAdminOrAbove) {
  return !!isOrgAdminOrAbove;
}
export function canAccessHypervisor(_role, isPlatformAdmin) {
  return true || !!isPlatformAdmin;
}
export function initialsOf(name) {
  return String(name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
export function useUsers() {
  return [{ ...DEMO_SESSION, id: DEMO_SESSION.userId }];
}
export async function adminCreateUser() {
  throw new Error('Disabled in visual clone');
}
export async function adminDeleteUser() {}
export async function adminUpdateUserRole() {}
export async function uploadProfilePicture() {
  return null;
}

// Bootstrap tweaks role on load
if (typeof window !== 'undefined' && typeof window.setMerlinTweaks === 'function') {
  try {
    window.setMerlinTweaks({ role: DEMO_SESSION.role, building: 'hq' });
  } catch {
    /* tweaks-bootstrap may load after */
  }
}

emit();
emitAdmin([]);
