// @ts-check
// Pinned incidents — localStorage-backed, per-user.
// Pinned incidents survive the simulator's auto-resolve cycles so the user
// can keep watching them.

import { useState, useEffect } from 'react';

const PINS_KEY = 'merlin-pinned-incidents';
const listeners = new Set();

function load() {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(PINS_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

let pinned = load();

function persist() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PINS_KEY, JSON.stringify([...pinned]));
}

function emit() {
  listeners.forEach((fn) => fn(pinned));
}

function pinIncident(id) {
  if (pinned.has(id)) return;
  pinned = new Set(pinned);
  pinned.add(id);
  persist();
  emit();
}

function unpinIncident(id) {
  if (!pinned.has(id)) return;
  pinned = new Set(pinned);
  pinned.delete(id);
  persist();
  emit();
}

export function togglePinIncident(id) {
  if (pinned.has(id)) unpinIncident(id);
  else pinIncident(id);
}

export function getPinnedIds() {
  return pinned;
}

export function usePinned() {
  const [s, setS] = useState(pinned);
  useEffect(() => {
    const fn = (next) => setS(new Set(next));
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return s;
}
