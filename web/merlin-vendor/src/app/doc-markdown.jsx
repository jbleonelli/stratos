// Shared markdown renderer for the in-app docs (the DocsPage browser + the
// Excalibur CMS live preview). Doc bodies come from the docs_pages DB, falling
// back to the bundled repo docs/*.md. Keeps doc styling in one place + exposes
// the heading helpers the "On this page" TOC needs.

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// GitHub-ish heading slug. Used for both the rendered <h2>/<h3> id and the TOC
// anchor so they line up.
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Flatten React children (string | array | element) to plain text — for the
// heading id.
function textOf(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node.props && node.props.children) return textOf(node.props.children);
  return '';
}

// Parse the raw markdown for ## / ### headings → the "On this page" list.
// Skips fenced code blocks. Strips inline markdown so the slug matches the
// rendered heading's id.
export function extractHeadings(src) {
  const out = [];
  let inFence = false;
  for (const raw of String(src || '').split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!m) continue;
    const level = m[1].length; // 2 or 3
    const text = m[2]
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .trim();
    out.push({ level, text, slug: slugify(text) });
  }
  return out;
}

// Safety net: these docs are client-facing, so a link whose visible text is a
// raw `.md` filename (a repo detail) must never show. Humanize it.
function humanizeDocName(s) {
  const base = String(s).replace(/^.*\//, '').replace(/\.md$/i, '').replace(/[-_]+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : s;
}

// The rendered doc body. `onLinkClick(href, event)` lets the host intercept
// cross-doc links + same-page anchors.
export function DocMarkdown({ src, onLinkClick }) {
  const link = (href, e) => {
    if (onLinkClick) onLinkClick(href, e);
  };
  return (
    <div className="help-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const t = textOf(children).trim();
            const display = /\.md$/i.test(t) ? humanizeDocName(t) : children;
            return (
              <a
                href={href}
                onClick={(e) => link(href, e)}
                style={{
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  borderBottom: '1px dotted var(--accent-line)',
                }}
              >
                {display}
              </a>
            );
          },
          h1: ({ children }) => (
            <h1
              id={slugify(textOf(children))}
              style={{
                fontSize: 28,
                fontWeight: 800,
                marginTop: 0,
                marginBottom: 14,
                color: 'var(--text)',
                letterSpacing: -0.01,
              }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              id={slugify(textOf(children))}
              style={{
                fontSize: 19,
                fontWeight: 700,
                marginTop: 34,
                marginBottom: 10,
                color: 'var(--text)',
                borderBottom: '1px solid var(--border)',
                paddingBottom: 6,
                scrollMarginTop: 80,
              }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              id={slugify(textOf(children))}
              style={{
                fontSize: 15,
                fontWeight: 700,
                marginTop: 22,
                marginBottom: 6,
                color: 'var(--text)',
                scrollMarginTop: 80,
              }}
            >
              {children}
            </h3>
          ),
          // Screenshots: frame + round + center, capped so a tall full-page
          // capture doesn't dominate the column. alt becomes a caption.
          img: ({ src, alt }) => (
            <figure style={{ margin: '14px 0 20px', textAlign: 'center' }}>
              <img
                src={src}
                alt={alt || ''}
                loading="lazy"
                style={{
                  display: 'block',
                  margin: '0 auto',
                  maxWidth: '100%',
                  maxHeight: 'min(58vh, 460px)',
                  width: 'auto',
                  height: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  boxShadow: '0 2px 14px rgba(0,0,0,0.07)',
                  background: 'var(--surface-2)',
                }}
              />
              {alt && (
                <figcaption style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                  {alt}
                </figcaption>
              )}
            </figure>
          ),
          hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />,
          p: ({ children }) => <p style={{ margin: '0 0 12px', color: 'var(--text-soft)' }}>{children}</p>,
          ul: ({ children }) => (
            <ul style={{ margin: '0 0 14px', paddingLeft: 22, color: 'var(--text-soft)' }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: '0 0 14px', paddingLeft: 22, color: 'var(--text-soft)' }}>{children}</ol>
          ),
          li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>,
          code: ({ inline, children }) =>
            inline ? (
              <code
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 12.5,
                  padding: '1px 5px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text)',
                }}
              >
                {children}
              </code>
            ) : (
              <code style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--text)' }}>{children}</code>
            ),
          pre: ({ children }) => (
            <pre
              style={{
                margin: '0 0 14px',
                padding: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                overflow: 'auto',
                fontSize: 12.5,
              }}
            >
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote
              style={{
                margin: '0 0 14px',
                padding: '10px 16px',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
                borderRadius: 8,
                color: 'var(--text-soft)',
                borderLeft: '3px solid var(--accent)',
              }}
            >
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div style={{ overflow: 'auto', margin: '0 0 16px' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th
              style={{
                textAlign: 'left',
                padding: '7px 11px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              style={{
                padding: '7px 11px',
                border: '1px solid var(--border)',
                verticalAlign: 'top',
                color: 'var(--text-soft)',
              }}
            >
              {children}
            </td>
          ),
          strong: ({ children }) => <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{children}</strong>,
          em: ({ children }) => <em style={{ color: 'var(--text-soft)' }}>{children}</em>,
        }}
      >
        {src}
      </ReactMarkdown>
    </div>
  );
}
