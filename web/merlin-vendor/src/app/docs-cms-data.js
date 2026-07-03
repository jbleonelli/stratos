// Write/admin layer for the Docs CMS (Excalibur). Reads ALL sections + pages
// (incl. unpublished drafts) and writes them. RLS gates writes to platform
// admins; on the /platform surface the shared supabase client carries the
// platform-admin session, so these calls are authorized.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { captureException } from './sentry.js';
import { DOC_SECTIONS as BUNDLED } from './docs-manifest.js';

export function useDocsAdmin() {
  const [sections, setSections] = useState([]);
  const [pages, setPages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // error is distinct from "loaded with no rows": a failed read must NOT read as
  // an empty CMS (which would prompt a misleading "Seed from repo").
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoaded(false);
      setError(null);
      try {
        const [s, p] = await Promise.all([
          supabase.from('docs_sections').select('*').order('sort_order'),
          supabase.from('docs_pages').select('*').order('sort_order'),
        ]);
        if (cancelled) return;
        if (s.error || p.error) throw s.error || p.error;
        setSections(s.data || []);
        setPages(p.data || []);
      } catch (e) {
        if (cancelled) return;
        captureException(e, { where: 'useDocsAdmin' });
        setError(e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { sections, pages, loaded, error, refresh };
}

export async function savePage(row) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from('docs_pages').upsert({ ...row, updated_by: user?.id || null });
  if (error) throw error;
}

export async function deletePage(id) {
  const { error } = await supabase.from('docs_pages').delete().eq('id', id);
  if (error) throw error;
}

export async function saveSection(row) {
  const { error } = await supabase.from('docs_sections').upsert(row);
  if (error) throw error;
}

export async function deleteSection(id) {
  const { error } = await supabase.from('docs_sections').delete().eq('id', id);
  if (error) throw error;
}

// Persist a new ordering by rewriting sort_order = position. The revision
// trigger ignores ordering-only changes, so reordering doesn't spam history.
export async function reorderSections(orderedIds) {
  await Promise.all(orderedIds.map((id, i) => supabase.from('docs_sections').update({ sort_order: i }).eq('id', id)));
}

export async function reorderPages(orderedIds) {
  await Promise.all(orderedIds.map((id, i) => supabase.from('docs_pages').update({ sort_order: i }).eq('id', id)));
}

// Upload an image to the public docs-media bucket; returns its public URL for
// embedding as ![alt](url). Platform-admin write is enforced by storage RLS.
export async function uploadDocImage(file) {
  const ext = (file.name?.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${Date.now()}-${rand}.${ext}`;
  const { error } = await supabase.storage.from('docs-media').upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw error;
  const { data } = supabase.storage.from('docs-media').getPublicUrl(path);
  return data.publicUrl;
}

// Edit history for a page (newest first). `tick` lets the caller force a refetch
// after a save.
export function useRevisions(pageId, tick) {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!pageId) {
      setRevisions([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('docs_page_revisions')
        .select('*')
        .eq('page_id', pageId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!cancelled) {
        setRevisions(data || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageId, tick]);
  return { revisions, loading };
}

// One-click seed: push the bundled repo defaults (sections + pages, bodies
// included) into the DB. Upsert — re-running RESETS each page's English text to
// the repo default, so the UI confirms first. body_fr is intentionally NOT in
// the upsert payload, so admin-authored French bodies survive a re-seed (upsert
// only updates the columns it sends).
export async function seedFromDefaults() {
  const sectionRows = BUNDLED.map((s, i) => ({
    id: s.id,
    title_en: s.title[0],
    title_fr: s.title[1] || s.title[0],
    sort_order: i,
  }));
  const { error: se } = await supabase.from('docs_sections').upsert(sectionRows);
  if (se) throw se;

  const pageRows = BUNDLED.flatMap((s) =>
    s.pages.map((p, pi) => ({
      id: p.id,
      section_id: s.id,
      slug: p.id,
      title_en: p.title[0],
      title_fr: p.title[1] || p.title[0],
      blurb_en: (p.blurb && p.blurb[0]) || '',
      blurb_fr: (p.blurb && p.blurb[1]) || '',
      body: p.src,
      sort_order: pi,
      published: true,
    })),
  );
  const { error: pe } = await supabase.from('docs_pages').upsert(pageRows);
  if (pe) throw pe;
}
