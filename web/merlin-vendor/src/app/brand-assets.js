// @ts-check
// Brand assets routed through Vite so they get a content-hashed filename
// (e.g. logo-adaptiv-a1b2c3.png). The wordmark used to live in public/ at a
// FIXED path (/assets/logo-adaptiv.png), so a swap could be served stale by the
// service worker / CDN until a hard refresh. Importing it here makes Vite emit a
// new hashed URL on every change → instant cache-bust, no hard refresh.
//
// The PNG is an alpha-only silhouette; every consumer uses it as a CSS
// mask-image and paints it with the brand gradient — so the URL is all callers
// need. Use: maskImage: `url(${WORDMARK_URL})`.
import wordmarkUrl from '../assets/logo-adaptiv.png';

export const WORDMARK_URL = wordmarkUrl;
