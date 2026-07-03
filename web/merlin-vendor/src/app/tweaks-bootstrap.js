// Tweaks protocol — global state for Tweaks panel.
// Phase J-1: persisted to localStorage so things like the active
// building selector survive a reload. Before this, loading a demo +
// reloading always snapped tweaks.building back to 'hq' (Meridian),
// making every scenario look wrong regardless of what the user picked.
const TWEAK_DEFAULTS = {
  theme: 'light',
  accent: 'pink',
  density: 'comfortable',
  sidebar: 'collapsed',
  tone: 'friendly',
  building: 'hq',
  variant: 'conservative',
  devicesLayout: 'cards',
  deployView: 'rail',
  role: 'facility',
  chatMode: 'floating', // 'floating' (draggable window) | 'sidebar' (docked rail)
};

const TWEAKS_STORAGE_KEY = 'merlin-tweaks';

function loadPersistedTweaks() {
  try {
    const raw = localStorage.getItem(TWEAKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function persistTweaks(tweaks) {
  try {
    localStorage.setItem(TWEAKS_STORAGE_KEY, JSON.stringify(tweaks));
  } catch {}
}

window.__MERLIN_TWEAKS__ = { ...TWEAK_DEFAULTS, ...loadPersistedTweaks() };
window.__MERLIN_LISTENERS__ = new Set();
window.setMerlinTweaks = function (edits) {
  Object.assign(window.__MERLIN_TWEAKS__, edits);
  persistTweaks(window.__MERLIN_TWEAKS__);
  window.__MERLIN_LISTENERS__.forEach((l) => l(window.__MERLIN_TWEAKS__));
  try {
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
  } catch {}
};

window.__MERLIN_EDIT_MODE__ = false;
window.addEventListener('message', (e) => {
  if (!e.data || !e.data.type) return;
  if (e.data.type === '__activate_edit_mode') {
    window.__MERLIN_EDIT_MODE__ = true;
    window.__MERLIN_LISTENERS__.forEach((l) => l(window.__MERLIN_TWEAKS__));
  }
  if (e.data.type === '__deactivate_edit_mode') {
    window.__MERLIN_EDIT_MODE__ = false;
    window.__MERLIN_LISTENERS__.forEach((l) => l(window.__MERLIN_TWEAKS__));
  }
});
try {
  window.parent.postMessage({ type: '__edit_mode_available' }, '*');
} catch {}
