// @ts-check
// Broken-link audit for the Docs CMS.
//
// Internal doc links follow the reader's convention (see DocsPage.handleLinkClick):
//   `<page-slug>.md`            → another doc page
//   `<page-slug>.md#anchor`     → a heading within another page
//   `#anchor`                   → a heading within the current page
// External links (http:, mailto:, //…) are left alone. This scans every page's
// EN and FR body for markdown links and flags ones that resolve to a missing
// page or a missing heading anchor, so docs don't silently rot as pages get
// renamed or headings change.
//
// Pure (pages in → findings out) and unit-tested. Heading anchors are computed
// with the SAME extractHeadings/slugify the reader's TOC + deep-links use, so an
// anchor that the checker accepts is exactly one the reader can scroll to.

import { extractHeadings } from './doc-markdown.jsx';

// [label](href) or [label](href "title") — capture the href, stop at whitespace
// or the closing paren so a trailing title doesn't leak into the target.
const LINK_RE = /\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

/**
 * Hrefs of every markdown link in `body`.
 * @param {string} body
 * @returns {string[]}
 */
export function extractLinks(body) {
  const src = String(body ?? '');
  const hrefs = [];
  let m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(src)) !== null) hrefs.push(m[1]);
  return hrefs;
}

// A scheme (`http:`, `mailto:`) or a protocol-relative `//host` — i.e. not an
// internal doc reference.
function isExternal(href) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

/** Set of heading-anchor slugs (## / ###…) in a body. */
function anchorsOf(body) {
  return new Set(extractHeadings(String(body ?? '')).map((h) => h.slug));
}

/**
 * @typedef {{ id: string, body?: string, body_fr?: string, body_de?: string }} CheckPage
 * @typedef {{ pageId: string, lang: 'en' | 'fr' | 'de', href: string, reason: string }} LinkFinding
 */

// EN is the source body; the rest are translation bodies (body_<lang>).
const LANGS = /** @type {Array<'en'|'fr'|'de'>} */ (['en', 'fr', 'de']);
const bodyOf = (p, lang) => (lang === 'en' ? p.body || '' : p[`body_${lang}`] || '');

/**
 * Find broken internal links across all pages, checking each language body.
 * @param {CheckPage[]} pages
 * @returns {LinkFinding[]}
 */
export function findBrokenLinks(pages) {
  const list = Array.isArray(pages) ? pages : [];
  const ids = new Set(list.map((p) => p.id));
  // Precompute each page's per-language anchor sets once. A translation body
  // falls back to EN (matching the reader), so its anchors do too when empty.
  const anchorsById = new Map(
    list.map((p) => [p.id, Object.fromEntries(LANGS.map((l) => [l, anchorsOf(bodyOf(p, l) || p.body)]))]),
  );

  /** @type {LinkFinding[]} */
  const findings = [];
  for (const p of list) {
    for (const lang of LANGS) {
      // Only audit a translation body that actually exists — an empty one renders
      // as EN, so its links were already checked under `en`.
      const body = bodyOf(p, lang);
      if (!body) continue;

      for (const href of extractLinks(body)) {
        if (isExternal(href)) continue;
        const hashAt = href.indexOf('#');
        const path = hashAt === -1 ? href : href.slice(0, hashAt);
        const anchor = hashAt === -1 ? '' : href.slice(hashAt + 1);

        if (!path) {
          // Same-page anchor (`#heading`).
          if (anchor && !anchorsById.get(p.id)?.[lang]?.has(anchor)) {
            findings.push({ pageId: p.id, lang, href, reason: `no heading "#${anchor}" on this page` });
          }
          continue;
        }

        const base = path.replace(/^.*\//, '').replace(/\.md$/i, '');
        if (!ids.has(base)) {
          findings.push({ pageId: p.id, lang, href, reason: `no page "${base}"` });
          continue;
        }
        if (anchor && !anchorsById.get(base)?.[lang]?.has(anchor)) {
          findings.push({ pageId: p.id, lang, href, reason: `no heading "#${anchor}" on "${base}"` });
        }
      }
    }
  }
  return findings;
}
