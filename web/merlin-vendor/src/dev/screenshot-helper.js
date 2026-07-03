// Dev-only screenshot helper.
//
// Loaded on demand via preview_eval (dynamic `import('/src/dev/screenshot-helper.js')`)
// when the user-guide screenshot pipeline is capturing a page. NEVER imported
// from the production bundle — Vite tree-shakes it away because nothing in
// `src/app/` references it.
//
// Usage from preview_eval:
//   const m = await import('/src/dev/screenshot-helper.js');
//   await m.capturePng('screenshots/contractor/buildings.png');
//
// The companion vite plugin at `vite.config.js#screenshotSaver` exposes
// /__capture/save to persist the bytes to disk under public/screenshots/.

import { toPng } from 'html-to-image';

export async function capturePng(relPath, opts = {}) {
  if (!relPath || !relPath.startsWith('screenshots/')) {
    throw new Error('relPath must start with screenshots/');
  }
  // Render the whole document for full-page captures by default; callers can
  // pass a CSS selector to capture a sub-tree (e.g. just the right pane).
  const target = opts.selector ? document.querySelector(opts.selector) : document.documentElement;
  if (!target) throw new Error(`selector "${opts.selector}" not found`);

  const dataUrl = await toPng(target, {
    pixelRatio: opts.pixelRatio || 1.5,
    backgroundColor: opts.backgroundColor || '#ffffff',
    cacheBust: true,
    // Skip font embedding — Akkurat LL is local and html-to-image's CSSOM
    // walk chokes on it. The captured PNG uses the page's actual rendered
    // fonts via the DOM clone, which is what we want for the guides.
    skipFonts: true,
  });
  const base64 = dataUrl.split(',')[1];
  const r = await fetch('/__capture/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: relPath, png_base64: base64 }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`save failed: ${r.status} ${body}`);
  }
  return r.json();
}
