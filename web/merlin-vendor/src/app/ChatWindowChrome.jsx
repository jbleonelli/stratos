// Chat floating-window chrome — extracted from Chat.jsx.
//
// The window-management layer for the chat panel's two non-inline modes:
// the draggable/resizable FLOATING window (FloatingDragLayer + CornerGrip +
// the CHAT_WIN_* geometry consts + readWindowGeom/clampGeom persistence) and
// the docked-right SIDEBAR rail (SidebarResizeHandle + CHAT_WIDTH_* consts).
// DockIcon / FloatIcon are the little mode-toggle glyphs.
//
// ChatPanel composes these; it imports the components plus the geometry
// helpers (readWindowGeom / clampGeom) and the sidebar-width consts it shares
// with SidebarResizeHandle. The CHAT_WIN_* floating consts and CornerGrip stay
// private to this module. (nowTime stayed in Chat.jsx — it's a generic message
// timestamp helper, not window chrome, and the window code never uses it.)

import React, { useEffect, useRef } from 'react';
import { useT } from './i18n.js';

// Floating-window geometry. Persisted as a single key so position +
// size move together.
export const CHAT_WINDOW_KEY = 'merlinChatWindow';
const CHAT_WIN_W_MIN = 360;
const CHAT_WIN_W_MAX = 1200;
const CHAT_WIN_H_MIN = 480;
const CHAT_WIN_H_MAX = 1400;
const CHAT_WIN_W_DEFAULT = 520;
const CHAT_WIN_H_DEFAULT = 680;
const CHAT_WIN_EDGE = 24; // gap to viewport edge for the default dock
const CHAT_WIN_KEEP_VISIBLE = 80; // drag clamp: at least this many px must stay on-screen

// Sidebar mode: docked-right rail with edge resize.
export const CHAT_WIDTH_KEY = 'merlinChatWidth';
export const CHAT_WIDTH_MIN = 360;
export const CHAT_WIDTH_MAX = 900;
export const CHAT_WIDTH_DEFAULT = 520;

// Read the floating-window geometry from localStorage. Falls back to a
// bottom-right dock that fits the current viewport. Always clamps so a
// stale localStorage entry doesn't trap the window off-screen.
export function readWindowGeom() {
  if (typeof window === 'undefined') {
    return { left: 0, top: 0, width: CHAT_WIN_W_DEFAULT, height: CHAT_WIN_H_DEFAULT };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fallbackW = Math.min(CHAT_WIN_W_DEFAULT, Math.max(CHAT_WIN_W_MIN, vw - CHAT_WIN_EDGE * 2));
  const fallbackH = Math.min(CHAT_WIN_H_DEFAULT, Math.max(CHAT_WIN_H_MIN, vh - CHAT_WIN_EDGE * 2));
  const fallback = {
    left: Math.max(CHAT_WIN_EDGE, vw - fallbackW - CHAT_WIN_EDGE),
    top: Math.max(CHAT_WIN_EDGE, vh - fallbackH - CHAT_WIN_EDGE),
    width: fallbackW,
    height: fallbackH,
  };
  try {
    const raw = localStorage.getItem(CHAT_WINDOW_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || !parsed) return fallback;
    const clamped = clampGeom({
      left: Number.isFinite(parsed.left) ? parsed.left : fallback.left,
      top: Number.isFinite(parsed.top) ? parsed.top : fallback.top,
      width: Number.isFinite(parsed.width) ? parsed.width : fallback.width,
      height: Number.isFinite(parsed.height) ? parsed.height : fallback.height,
    });
    // PR #749: if the clamped position leaves less than ~240px on-screen
    // (e.g. user dragged the chat mostly off-screen, or viewport shrank
    // since last save), reset to the fallback. The previous 80px keep-
    // visible threshold meant the chat could open as a sliver JB
    // couldn't see, looking like the panel "didn't open" at all.
    const visibleW = Math.min(clamped.left + clamped.width, vw) - Math.max(clamped.left, 0);
    const visibleH = Math.min(clamped.top + clamped.height, vh) - Math.max(clamped.top, 0);
    if (visibleW < 240 || visibleH < 240) return fallback;
    return clamped;
  } catch {
    return fallback;
  }
}

// Keep the window's size + position inside sane viewport bounds. Width
// and height clamp to their min/max; position is allowed to push some
// of the window off-screen (CHAT_WIN_KEEP_VISIBLE px must remain
// reachable so the user can always grab the title bar to drag back).
export function clampGeom(g) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const width = Math.max(CHAT_WIN_W_MIN, Math.min(CHAT_WIN_W_MAX, Math.min(vw - 16, g.width)));
  const height = Math.max(CHAT_WIN_H_MIN, Math.min(CHAT_WIN_H_MAX, Math.min(vh - 16, g.height)));
  const left = Math.max(-(width - CHAT_WIN_KEEP_VISIBLE), Math.min(vw - CHAT_WIN_KEEP_VISIBLE, g.left));
  const top = Math.max(0, Math.min(vh - 40, g.top));
  return { left, top, width, height };
}

// Single component that owns the global mousemove/mouseup listeners
// while the user is dragging-to-move OR resizing-from-corner. It also
// renders the two visible corner grips (bottom-left + bottom-right).
export function FloatingDragLayer({ draggingMove, setDraggingMove, resizing, setResizing, setWindowGeom }) {
  // Drag-to-move: the header's mousedown sets `draggingMove` to a
  // start-snapshot; this effect owns the move/up listeners while the
  // gesture is active.
  useEffect(() => {
    if (!draggingMove) return;
    const onMove = (e) => {
      const dx = e.clientX - draggingMove.startX;
      const dy = e.clientY - draggingMove.startY;
      setWindowGeom((g) =>
        clampGeom({
          ...g,
          left: draggingMove.startLeft + dx,
          top: draggingMove.startTop + dy,
        }),
      );
    };
    const onUp = () => setDraggingMove(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [draggingMove, setDraggingMove, setWindowGeom]);

  // Corner-grip resize. `resizing` carries which corner ('br' or 'bl')
  // plus a snapshot of the geometry at gesture start.
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
      const dx = e.clientX - resizing.startX;
      const dy = e.clientY - resizing.startY;
      setWindowGeom((g) => {
        if (resizing.corner === 'br') {
          // Bottom-right: width grows with +dx, height with +dy.
          return clampGeom({
            ...g,
            width: resizing.startWidth + dx,
            height: resizing.startHeight + dy,
          });
        }
        // Bottom-left: width grows with -dx (left edge moves), height with +dy.
        const targetWidth = resizing.startWidth - dx;
        const clampedW = Math.max(CHAT_WIN_W_MIN, Math.min(CHAT_WIN_W_MAX, targetWidth));
        // Keep the right edge anchored: left = startLeft + (startWidth - clampedW).
        return clampGeom({
          ...g,
          left: resizing.startLeft + (resizing.startWidth - clampedW),
          width: clampedW,
          height: resizing.startHeight + dy,
        });
      });
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = resizing.corner === 'br' ? 'nwse-resize' : 'nesw-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing, setResizing, setWindowGeom]);

  const startResize = (corner) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    const win = e.currentTarget.parentElement;
    const rect = win.getBoundingClientRect();
    setResizing({
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      startWidth: rect.width,
      startHeight: rect.height,
    });
  };

  return (
    <>
      <CornerGrip corner="br" onMouseDown={startResize('br')} />
      <CornerGrip corner="bl" onMouseDown={startResize('bl')} />
    </>
  );
}

// Sidebar mode: vertical drag handle on the left edge of the docked
// rail. Drag left → wider chat / narrower main; double-click resets
// to the default width.
export function SidebarResizeHandle({ onResize, dragging, setDragging }) {
  const t = useT();
  const dragRef = useRef({ startX: 0, startWidth: 0 });

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = dragRef.current.startX - e.clientX;
      const next = Math.max(CHAT_WIDTH_MIN, Math.min(CHAT_WIDTH_MAX, dragRef.current.startWidth + dx));
      onResize(next);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, onResize, setDragging]);

  const onMouseDown = (e) => {
    const aside = e.currentTarget.parentElement;
    dragRef.current = { startX: e.clientX, startWidth: aside.getBoundingClientRect().width };
    setDragging(true);
  };
  const onDoubleClick = () => onResize(CHAT_WIDTH_DEFAULT);

  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title={t('sidebar.resize_handle')}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 6,
        marginLeft: -3,
        cursor: 'col-resize',
        zIndex: 5,
        background: dragging ? 'color-mix(in oklch, var(--accent) 35%, transparent)' : 'transparent',
        transition: dragging ? 'none' : 'background .12s',
      }}
      onMouseEnter={(e) => {
        if (!dragging) e.currentTarget.style.background = 'color-mix(in oklch, var(--accent) 18%, transparent)';
      }}
      onMouseLeave={(e) => {
        if (!dragging) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 1,
          transform: 'translateY(-50%)',
          width: 2,
          height: 36,
          borderRadius: 2,
          background: dragging ? 'var(--accent)' : 'var(--border-strong)',
          opacity: dragging ? 1 : 0.5,
        }}
      />
    </div>
  );
}

// "Dock to sidebar" icon for the floating-window header. Drawn inline
// because the shared icon set doesn't have a right-anchored rail
// glyph yet.
export function DockIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <line x1="10" y1="3" x2="10" y2="13" />
      <rect x="10" y="3" width="4" height="10" rx="1" fill="currentColor" stroke="none" opacity="0.18" />
    </svg>
  );
}

// "Float as window" icon for the sidebar-mode header. Two stacked
// rectangles with the front one offset toward the bottom-right —
// reads as "lift this rail off the side and float it".
export function FloatIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="9" height="9" rx="1.4" opacity="0.45" />
      <rect x="5" y="5" width="9" height="9" rx="1.4" fill="currentColor" stroke="none" opacity="0.14" />
      <rect x="5" y="5" width="9" height="9" rx="1.4" />
    </svg>
  );
}

// Invisible-but-active corner-resize hit area. The cursor + onMouseDown
// drive the gesture; no painted SVG so the chat shell stays clean.
// Slightly larger hit area (20×20) than the previous visual grip so
// users can land on it without aiming.
function CornerGrip({ corner, onMouseDown }) {
  const isBR = corner === 'br';
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        bottom: 0,
        [isBR ? 'right' : 'left']: 0,
        width: 20,
        height: 20,
        cursor: isBR ? 'nwse-resize' : 'nesw-resize',
        zIndex: 5,
        // Transparent — keeps the corner clean. The cursor change on
        // hover is the only affordance, which feels native.
        background: 'transparent',
      }}
    />
  );
}
