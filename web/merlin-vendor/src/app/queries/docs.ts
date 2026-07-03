// Query hook for the docs full-text search (Postgres FTS via the docs_search
// RPC — stemmed, weighted, ranked). The caller debounces the query string it
// feeds in (so the queryKey only changes after typing settles) and maps the raw
// {id, rank} rows back to in-memory pages itself. Returns [] on empty input and
// null on error, so the page can fall back to its JS scan and never break.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { sb } from '../db-client';

export type DocsSearchHit = { id: string; rank: number };

export function useDocsSearch(q: string, lang: string, enabled: boolean) {
  return useQuery({
    queryKey: ['docs-search', q, lang],
    enabled: enabled && Boolean(q),
    // Hold the prior hits on screen while the next query runs, so typing doesn't
    // flash back to the JS-scan fallback between keystrokes.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<DocsSearchHit[] | null> => {
      const { data, error } = await sb.rpc('docs_search', { q, lang });
      if (error || !Array.isArray(data)) return null;
      return data as DocsSearchHit[];
    },
  });
}
