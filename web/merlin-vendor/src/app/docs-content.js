// @ts-check
// Docs content source for the in-app Docs section.
//
// Source of truth: the docs_sections / docs_pages tables (editable from the
// Excalibur CMS). The repo markdown (docs-manifest.js, bundled via ?raw) is the
// built-in DEFAULT — used instantly on first render and as a fallback whenever
// the DB has no docs yet or a read fails, so the Docs section never breaks.
//
// useDocsContent() returns the same normalized shape regardless of source:
//   { sections, allPages, pageById(id), filenameToPage, loaded, source }
// where a section = { id, title:[en,fr], pages:[page] } and a
//       page    = { id, sectionId, title:[en,fr], blurb:[en,fr], src, srcFr }.
// `src` is the EN body; `srcFr` the FR body (falls back to EN when untranslated).

import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { DOC_SECTIONS as BUNDLED } from './docs-manifest.js';

function finalize(sections) {
  const allPages = sections.flatMap((s) => s.pages);
  const pageById = (id) => allPages.find((p) => p.id === id) || null;
  const filenameToPage = Object.fromEntries(allPages.map((p) => [`${p.id}.md`, p.id]));
  return { sections, allPages, pageById, filenameToPage };
}

function fromBundle() {
  const sections = BUNDLED.map((s) => ({
    id: s.id,
    title: s.title,
    pages: s.pages.map((p) => ({
      id: p.id,
      sectionId: s.id,
      title: p.title,
      blurb: p.blurb || ['', ''],
      src: p.src,
      srcFr: p.src,
      srcDe: p.src,
    })),
  }));
  return finalize(sections);
}

function fromDb(sectionRows, pageRows) {
  const bySection = {};
  for (const p of pageRows) (bySection[p.section_id] ||= []).push(p);
  const sections = sectionRows
    .map((s) => ({
      id: s.id,
      title: [s.title_en, s.title_fr || s.title_en, s.title_de || s.title_en],
      pages: (bySection[s.id] || [])
        .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
        .map((p) => ({
          id: p.id,
          sectionId: s.id,
          title: [p.title_en, p.title_fr || p.title_en, p.title_de || p.title_en],
          blurb: [p.blurb_en || '', p.blurb_fr || '', p.blurb_de || ''],
          src: p.body || '',
          srcFr: p.body_fr || p.body || '',
          srcDe: p.body_de || p.body || '',
        })),
    }))
    .filter((s) => s.pages.length > 0);
  return finalize(sections);
}

export function useDocsContent() {
  // Start from the bundled defaults so the first render is instant — no blank
  // flash — then swap in the DB content once it loads.
  const [data, setData] = useState(() => ({ ...fromBundle(), loaded: false, source: 'bundle' }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sres, pres] = await Promise.all([
          supabase.from('docs_sections').select('id,title_en,title_fr,title_de,sort_order').order('sort_order'),
          supabase
            .from('docs_pages')
            .select(
              'id,section_id,slug,title_en,title_fr,title_de,blurb_en,blurb_fr,blurb_de,body,body_fr,body_de,sort_order',
            )
            .order('sort_order'),
        ]);
        if (cancelled) return;
        // A read error still falls back to the bundle (docs never break), but
        // report it — otherwise a broken DB read is invisible.
        if (sres.error || pres.error) captureException(sres.error || pres.error, { where: 'useDocsContent' });
        const haveDb = !sres.error && !pres.error && (sres.data?.length || 0) > 0;
        setData(
          haveDb
            ? { ...fromDb(sres.data, pres.data), loaded: true, source: 'db' }
            : { ...fromBundle(), loaded: true, source: 'bundle' },
        );
      } catch (e) {
        if (cancelled) return;
        captureException(e, { where: 'useDocsContent' });
        setData({ ...fromBundle(), loaded: true, source: 'bundle' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
