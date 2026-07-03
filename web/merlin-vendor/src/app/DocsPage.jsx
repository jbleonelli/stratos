// DocsPage — the full-screen, Supabase-style in-app documentation browser.
// Left: grouped nav (or full-text search results). Center: the rendered guide.
// Right: an auto-generated "On this page" TOC with scroll-spy. Content is the
// docs_pages DB (editable from Excalibur), falling back to the bundled repo md.
//
// Search: when the box is non-empty the nav switches to ranked results that
// search titles, blurbs AND page bodies (current language), each with a
// highlighted snippet that deep-links to the nearest heading.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { useSL } from './servicing-i18n.js';
import { DocMarkdown, extractHeadings, slugify } from './doc-markdown.jsx';
import { useDocsContent } from './docs-content.js';
import { useDocsSearch } from './queries/docs.ts';

// Slugify the nearest ## / ### heading at or before a body offset, so a body
// match can deep-link to its section. Mirrors extractHeadings' inline-strip.
function headingHashBeforeIndex(body, idx) {
  const lines = String(body || '')
    .slice(0, idx)
    .split('\n');
  for (let k = lines.length - 1; k >= 0; k--) {
    const m = /^(#{2,3})\s+(.+)$/.exec(lines[k].trimEnd());
    if (m) {
      const text = m[2]
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .trim();
      return slugify(text);
    }
  }
  return null;
}

// A short context window around the first match in `text`, ellipsized.
function buildSnippet(text, qLower) {
  const i = String(text).toLowerCase().indexOf(qLower);
  if (i < 0) return '';
  const start = Math.max(0, i - 40);
  const end = Math.min(text.length, i + qLower.length + 90);
  let snip = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = '…' + snip;
  if (end < text.length) snip = snip + '…';
  return snip;
}

// Wrap every case-insensitive occurrence of `qLower` in <mark>.
function highlight(text, qLower) {
  if (!qLower) return text;
  const lower = String(text).toLowerCase();
  const out = [];
  let i = 0;
  let key = 0;
  for (;;) {
    const idx = lower.indexOf(qLower, i);
    if (idx < 0) {
      out.push(text.slice(i));
      break;
    }
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark
        key={key++}
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 3, padding: '0 1px' }}
      >
        {text.slice(idx, idx + qLower.length)}
      </mark>,
    );
    i = idx + qLower.length;
  }
  return out;
}

export function DocsPage({ open, onClose, initialPageId }) {
  const sl = useSL();
  // Content (sections + pages) comes from the DB, falling back to the bundled
  // repo defaults — see docs-content.js. Editable from the Excalibur CMS.
  const { sections: DOC_SECTIONS, allPages: ALL_DOC_PAGES, pageById, filenameToPage, source } = useDocsContent();
  const [activeId, setActiveId] = useState(initialPageId || null);
  const [query, setQuery] = useState('');
  const [activeSlug, setActiveSlug] = useState(null);
  // Debounced query string that feeds the DB search queryKey (so it only fires
  // after typing settles). '' = no DB search → fall back to the JS scan below.
  const [debouncedQ, setDebouncedQ] = useState('');
  const contentRef = useRef(null);

  const active = pageById(activeId) || ALL_DOC_PAGES[0];
  const section = DOC_SECTIONS.find((s) => s.id === active?.sectionId);
  // Render the body in the active language (FR falls back to EN).
  const activeBody = sl(active?.src || '', active?.srcFr || active?.src || '', active?.srcDe || active?.src || '');
  const headings = useMemo(() => extractHeadings(activeBody), [activeBody]);

  // Resizable nav + TOC widths — drag the column edges; persisted to localStorage.
  const bodyRef = useRef(null);
  const dragRef = useRef(null);
  const clampL = (w) => Math.max(200, Math.min(440, w));
  const clampR = (w) => Math.max(150, Math.min(380, w));
  const loadW = (k, d) => {
    try {
      const v = parseInt(localStorage.getItem(k), 10);
      return Number.isFinite(v) ? v : d;
    } catch {
      return d;
    }
  };
  const [leftW, setLeftW] = useState(() => clampL(loadW('docsLeftW', 270)));
  const [rightW, setRightW] = useState(() => clampR(loadW('docsRightW', 230)));
  const [dragSide, setDragSide] = useState(null);
  const leftWRef = useRef(leftW);
  leftWRef.current = leftW;
  const rightWRef = useRef(rightW);
  rightWRef.current = rightW;

  const startDrag = (side) => (e) => {
    e.preventDefault();
    dragRef.current = side;
    setDragSide(side);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  useEffect(() => {
    const onMove = (e) => {
      const side = dragRef.current;
      if (!side) return;
      const rect = bodyRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (side === 'left') setLeftW(clampL(e.clientX - rect.left));
      else setRightW(clampR(rect.right - e.clientX));
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setDragSide(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem('docsLeftW', String(Math.round(leftWRef.current)));
        localStorage.setItem('docsRightW', String(Math.round(rightWRef.current)));
      } catch {
        /* noop */
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // On page switch: jump content back to the top.
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setActiveSlug(headings[0]?.slug || null);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll-spy: highlight the heading nearest the top of the content pane.
  useEffect(() => {
    if (!open) return;
    const root = contentRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll('h2[id], h3[id]'));
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSlug(visible[0].target.id);
      },
      { root, rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [open, activeId]);

  const goToPage = (id, hash) => {
    setActiveId(id);
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveSlug(hash);
      }, 60);
    }
  };

  const handleLinkClick = (href, ev) => {
    if (!href) return;
    const [path, hash] = href.split('#');
    const bare = path.replace(/^.*\//, '');
    const target = filenameToPage[bare];
    if (target) {
      ev.preventDefault();
      goToPage(target, hash);
      return;
    }
    if (href.startsWith('#')) {
      ev.preventDefault();
      const el = document.getElementById(href.slice(1));
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSlug(href.slice(1));
      return;
    }
    ev.preventDefault();
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const tocClick = (slug, ev) => {
    ev.preventDefault();
    document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSlug(slug);
  };

  // Full-text search across titles, blurbs AND bodies (active language). When
  // `q` is set the nav swaps from the grouped tree to a ranked results list.
  const q = query.trim().toLowerCase();
  const clientResults = useMemo(() => {
    if (!q) return [];
    return ALL_DOC_PAGES.map((p) => {
      const title = sl(p.title[0], p.title[1], p.title[2]);
      const blurb = sl(p.blurb?.[0] || '', p.blurb?.[1] || '', p.blurb?.[2] || '');
      const body = sl(p.src || '', p.srcFr || p.src || '', p.srcDe || p.src || '');
      const inTitle = title.toLowerCase().includes(q);
      const inBlurb = blurb.toLowerCase().includes(q);
      const bodyIdx = body.toLowerCase().indexOf(q);
      if (!inTitle && !inBlurb && bodyIdx < 0) return null;
      const sec = DOC_SECTIONS.find((s) => s.id === p.sectionId);
      return {
        page: p,
        title,
        sectionTitle: sec ? sl(sec.title[0], sec.title[1], sec.title[2]) : '',
        rank: inTitle ? 0 : inBlurb ? 1 : 2,
        snippet: bodyIdx >= 0 ? buildSnippet(body, q) : blurb,
        hash: bodyIdx >= 0 ? headingHashBeforeIndex(body, bodyIdx) : null,
      };
    })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));
  }, [q, ALL_DOC_PAGES, DOC_SECTIONS, sl]);

  // DB-backed full-text search (Postgres FTS — stemmed, weighted, ranked) when
  // the docs come from the DB. Debounced; each match maps back to its in-memory
  // page for the snippet + heading deep-link. Falls back to the JS scan above on
  // any error or when content is the bundled default, so search never breaks.
  const langCode = sl('en', 'fr', 'de');

  // Debounce the query 180ms before it feeds the search queryKey, so we don't
  // fire the RPC on every keystroke. Clears to '' when search isn't applicable.
  useEffect(() => {
    if (source !== 'db' || !q) {
      setDebouncedQ('');
      return undefined;
    }
    const handle = setTimeout(() => setDebouncedQ(q), 180);
    return () => clearTimeout(handle);
  }, [q, source]);

  // DB-backed full-text search (Postgres FTS — stemmed, weighted, ranked).
  const { data: searchRows } = useDocsSearch(debouncedQ, langCode, source === 'db');

  // Map the raw {id, rank} hits back to in-memory pages for the snippet +
  // heading deep-link. null (no DB search / error) falls back to the JS scan.
  const dbResults = useMemo(() => {
    if (source !== 'db' || !debouncedQ || searchRows == null) return null;
    return searchRows
      .map((r) => {
        const p = pageById(r.id);
        if (!p) return null;
        const body = sl(p.src || '', p.srcFr || p.src || '', p.srcDe || p.src || '');
        const blurb = sl(p.blurb?.[0] || '', p.blurb?.[1] || '', p.blurb?.[2] || '');
        const idx = body.toLowerCase().indexOf(debouncedQ);
        const sec = DOC_SECTIONS.find((s) => s.id === p.sectionId);
        return {
          page: p,
          title: sl(p.title[0], p.title[1], p.title[2]),
          sectionTitle: sec ? sl(sec.title[0], sec.title[1], sec.title[2]) : '',
          rank: r.rank,
          // FTS can match a stemmed/prefixed word that isn't a literal
          // substring, so fall back to the blurb when there's no exact hit.
          snippet: idx >= 0 ? buildSnippet(body, debouncedQ) : blurb,
          hash: idx >= 0 ? headingHashBeforeIndex(body, idx) : null,
        };
      })
      .filter(Boolean);
    // pageById / DOC_SECTIONS / sl are read at map time; searchRows+debouncedQ drive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchRows, debouncedQ, source]);

  // Prefer DB results when available; otherwise the in-memory scan.
  const results = source === 'db' && dbResults != null ? dbResults : clientResults;

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'var(--surface)',
        display: 'grid',
        gridTemplateRows: '56px minmax(0, 1fr)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <Icon.help size={16} style={{ color: 'var(--accent)' }} />
        <div style={{ fontSize: 15, fontWeight: 800 }}>{sl('Docs', 'Docs')}</div>
        {section && active && (
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon.chevR size={11} /> {sl(section.title[0], section.title[1], section.title[2])}
            <Icon.chevR size={11} />{' '}
            <span style={{ color: 'var(--text-dim)' }}>{sl(active.title[0], active.title[1], active.title[2])}</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: 'pointer',
            color: 'var(--text-dim)',
            padding: '6px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'inherit',
          }}
        >
          <Icon.close size={12} /> {sl('Back to app', 'Retour à l’app', 'Zurück zur App')}
          <kbd
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--text-faint)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              padding: '1px 5px',
              borderRadius: 4,
            }}
          >
            Esc
          </kbd>
        </button>
      </div>

      {/* Body: nav · content · TOC (the two column edges are drag-resizable) */}
      <div
        ref={bodyRef}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `${leftW}px minmax(0, 1fr) ${rightW}px`,
          minHeight: 0,
        }}
      >
        {/* Left nav */}
        <nav
          style={{
            borderRight: '1px solid var(--border)',
            overflow: 'auto',
            padding: '14px 12px',
            background: 'var(--surface-2)',
          }}
        >
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Icon.search size={13} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-faint)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={sl('Search docs…', 'Rechercher…', 'Dokumente durchsuchen…')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '7px 26px 7px 30px',
                fontSize: 12.5,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text)',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                title={sl('Clear', 'Effacer')}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 6,
                  display: 'inline-flex',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-faint)',
                  padding: 2,
                }}
              >
                <Icon.close size={12} />
              </button>
            )}
          </div>

          {q ? (
            /* Search results: ranked across titles, blurbs + bodies */
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                  padding: '0 8px 8px',
                }}
              >
                {results.length === 0
                  ? sl('No matches', 'Aucun résultat', 'Keine Treffer')
                  : `${results.length} ${results.length === 1 ? sl('result', 'résultat', 'Ergebnis') : sl('results', 'résultats', 'Ergebnisse')}`}
              </div>
              {results.map(({ page, title, sectionTitle, snippet, hash }) => {
                const isActive = page.id === activeId;
                return (
                  <button
                    key={page.id}
                    onClick={() => goToPage(page.id, hash)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'block',
                      padding: '9px 10px',
                      marginBottom: 6,
                      background: isActive ? 'var(--accent-soft)' : 'var(--surface)',
                      border: `1px solid ${isActive ? 'var(--accent-line)' : 'var(--border)'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: 0.3,
                        textTransform: 'uppercase',
                        color: 'var(--text-faint)',
                        marginBottom: 2,
                      }}
                    >
                      {sectionTitle}
                    </div>
                    <div
                      style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: snippet ? 3 : 0 }}
                    >
                      {highlight(title, q)}
                    </div>
                    {snippet && (
                      <div style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-dim)' }}>
                        {highlight(snippet, q)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            DOC_SECTIONS.map((s) => {
              if (!s.pages.length) return null;
              return (
                <div key={s.id} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      color: 'var(--text-faint)',
                      padding: '0 8px 6px',
                    }}
                  >
                    {sl(s.title[0], s.title[1], s.title[2])}
                  </div>
                  {s.pages.map((p) => {
                    const isActive = p.id === activeId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => goToPage(p.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          display: 'block',
                          padding: '7px 9px',
                          marginBottom: 2,
                          background: isActive ? 'var(--accent-soft)' : 'transparent',
                          color: isActive ? 'var(--accent)' : 'var(--text-soft)',
                          border: `1px solid ${isActive ? 'var(--accent-line)' : 'transparent'}`,
                          borderRadius: 7,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 12.5,
                          fontWeight: isActive ? 700 : 500,
                          transition: 'background .12s',
                        }}
                      >
                        {sl(p.title[0], p.title[1], p.title[2])}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </nav>

        {/* Content */}
        <div ref={contentRef} id="docs-content" style={{ overflow: 'auto', padding: '32px 0' }}>
          <div
            style={{
              maxWidth: 760,
              margin: '0 auto',
              padding: '0 40px',
              fontSize: 14.5,
              lineHeight: 1.65,
              color: 'var(--text)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                marginBottom: 10,
              }}
            >
              {section ? sl(section.title[0], section.title[1], section.title[2]) : ''}
            </div>
            <DocMarkdown src={activeBody} onLinkClick={handleLinkClick} />
          </div>
        </div>

        {/* Right: On this page */}
        <aside style={{ borderLeft: '1px solid var(--border)', overflow: 'auto', padding: '32px 16px' }}>
          {headings.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                  marginBottom: 10,
                }}
              >
                {sl('On this page', 'Sur cette page', 'Auf dieser Seite')}
              </div>
              {headings.map((h) => {
                const isActive = h.slug === activeSlug;
                return (
                  <a
                    key={h.slug}
                    href={`#${h.slug}`}
                    onClick={(e) => tocClick(h.slug, e)}
                    style={{
                      display: 'block',
                      padding: '3px 0 3px ' + (h.level === 3 ? '14px' : '0'),
                      fontSize: 12,
                      lineHeight: 1.4,
                      textDecoration: 'none',
                      color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                      fontWeight: isActive ? 700 : 400,
                      borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                      paddingLeft: h.level === 3 ? 18 : 8,
                    }}
                  >
                    {h.text}
                  </a>
                );
              })}
            </>
          )}
        </aside>

        {/* Drag handles on the two column edges */}
        <div
          onMouseDown={startDrag('left')}
          title={sl('Drag to resize', 'Glisser pour redimensionner')}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: leftW,
            width: 9,
            transform: 'translateX(-4.5px)',
            cursor: 'col-resize',
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: 2,
              height: '100%',
              margin: '0 auto',
              background: dragSide === 'left' ? 'var(--accent)' : 'transparent',
              transition: 'background .1s',
            }}
          />
        </div>
        <div
          onMouseDown={startDrag('right')}
          title={sl('Drag to resize', 'Glisser pour redimensionner')}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: rightW,
            width: 9,
            transform: 'translateX(4.5px)',
            cursor: 'col-resize',
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: 2,
              height: '100%',
              margin: '0 auto',
              background: dragSide === 'right' ? 'var(--accent)' : 'transparent',
              transition: 'background .1s',
            }}
          />
        </div>
      </div>
    </div>
  );
}
