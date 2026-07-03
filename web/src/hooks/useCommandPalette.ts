import { useCallback, useEffect, useState } from 'react';

const subscribers = new Set<(open: boolean) => void>();
let openState = false;

function emit() {
  for (const fn of subscribers) fn(openState);
}

export function openCommandPalette() {
  if (openState) return;
  openState = true;
  emit();
}

export function closeCommandPalette() {
  if (!openState) return;
  openState = false;
  emit();
}

export function toggleCommandPalette() {
  openState = !openState;
  emit();
}

export function useCommandPalette() {
  const [open, setOpen] = useState(openState);

  useEffect(() => {
    subscribers.add(setOpen);
    return () => {
      subscribers.delete(setOpen);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (cmdK) {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }
      if (e.key === 'Escape' && openState) {
        e.preventDefault();
        closeCommandPalette();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = useCallback(() => closeCommandPalette(), []);
  const openPalette = useCallback(() => openCommandPalette(), []);

  return { open, openPalette, closePalette: close };
}
