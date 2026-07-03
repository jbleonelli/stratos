// @ts-check
// PWA install-prompt plumbing. Chrome fires `beforeinstallprompt` when the
// app meets the install criteria AND isn't already installed — but it can
// fire before React mounts, so we capture it at module scope and notify any
// mounted hook. We call preventDefault() to suppress Chrome's own mini-infobar
// and drive the prompt from our in-app "Install Merlin" menu item instead.

import { useEffect, useState } from 'react';

let deferredPrompt = null;
const listeners = new Set();
function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  // Once installed, Chrome won't re-fire beforeinstallprompt — drop the stash
  // so the menu item disappears.
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

// Already running as an installed app (any standalone-ish display mode)? Then
// there's nothing to offer.
function isStandalone() {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches ||
      window.matchMedia?.('(display-mode: minimal-ui)')?.matches ||
      // navigator.standalone is a non-standard iOS-Safari flag, absent from the DOM types.
      /** @type {any} */ (window.navigator)?.standalone === true,
    );
  } catch {
    return false;
  }
}

// { canInstall, promptInstall } — canInstall is true only when Chrome has
// handed us a deferred prompt and we're not already installed. promptInstall
// shows the native install dialog and resolves to 'accepted' | 'dismissed'
// | null.
export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const canInstall = Boolean(deferredPrompt) && !isStandalone();

  const promptInstall = async () => {
    const ev = deferredPrompt;
    if (!ev) return null;
    deferredPrompt = null; // a deferred prompt can only be used once
    notify();
    try {
      ev.prompt();
      const choice = await ev.userChoice;
      return choice?.outcome || null;
    } catch {
      return null;
    }
  };

  return { canInstall, promptInstall };
}
