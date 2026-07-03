// 3D scene primitives + canvas-coupled cards for the Hypervisor viewer
// (procedural floor stack, pill rows, floor-number badges, CTA cards, and
// the per-frame de-overlap passes). Extracted from HypervisorViewer3D.jsx
// so the orchestrator holds only data + composition. Everything here is
// r3f / DOM-overlay rendering; the orchestrator imports the exported
// components and renders them inside its <Canvas>.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import { openMessage } from './MessageDrawer.jsx';
import {
  formatCount,
  summarizeTitle,
  resolveVerticalLayout,
  SERVICING_ZONE_META,
  servicingSeverity,
  trLabel,
} from './hypervisor-3d-utils.js';
import { FLOOR_WIDTH, FLOOR_DEPTH, FLASH_MS, CTA_BOUNDS_MARGIN } from './hypervisor-3d-constants.js';
import { domainAccent } from './servicing-areas.js';

// One floor — a wireframe box rendered as line segments (EdgesGeometry
// strips the diagonals you'd otherwise get from BoxGeometry's
// triangles). Memo'd so resizes/re-renders don't recreate the geometry.
// When another floor is selected (`dim`), the box fades to 25% so the
// active floor reads as the focal point. Alerts are now visualised by
// floating pink pills on the side (see AlertPill) rather than by
// recolouring the wireframe — a single accent flourish per floor
// reads better than 50 pink floors.
// A fully-transparent box mesh sits inside the wireframe to receive
// raycasts — lineSegments don't reliably catch pointer events.
export function FloorBox({ y, width, depth, height, color, highlightColor, flashUntil, onSelect }) {
  const geom = useMemo(() => {
    const box = new THREE.BoxGeometry(width, height, depth);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [width, depth, height]);
  useEffect(() => () => geom.dispose(), [geom]);
  // When highlighted, the hit-test mesh doubles as a translucent
  // coloured slab + the wireframe edges thicken in the same colour.
  // During a flash window the slab pulses — animated per-frame via
  // useFrame below. Outside a flash, opacity is static.
  const isHi = !!highlightColor;
  const strokeColor = isHi ? highlightColor : color;
  const lineOpacity = isHi ? 1 : 0.9;
  const linewidth = isHi ? 2.5 : 1;
  // useFrame for flash pulse. Refs grabbed by the materials below so
  // we can tweak opacity each frame without forcing a React rerender.
  const slabMatRef = useRef(null);
  const lineMatRef = useRef(null);
  useFrame(() => {
    if (!slabMatRef.current || !lineMatRef.current) return;
    if (flashUntil && flashUntil > Date.now()) {
      // Pulse 4 cycles across the flash window, fading toward the end.
      const remaining = flashUntil - Date.now();
      const t = 1 - remaining / FLASH_MS; // 0 → 1
      const pulse = (Math.sin(t * Math.PI * 8) + 1) / 2;
      const fade = 1 - 0.4 * t; // fade slightly toward end
      slabMatRef.current.opacity = 0.15 + pulse * 0.45 * fade;
      lineMatRef.current.opacity = 0.5 + pulse * 0.5 * fade;
    } else {
      // No flash — restore static highlight opacity.
      slabMatRef.current.opacity = isHi ? 0.35 : 0;
      lineMatRef.current.opacity = lineOpacity;
    }
  });
  return (
    <group position={[0, y, 0]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect && onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (onSelect && typeof document !== 'undefined') document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          if (typeof document !== 'undefined') document.body.style.cursor = '';
        }}
      >
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial
          ref={slabMatRef}
          transparent
          color={isHi ? highlightColor : '#000000'}
          opacity={isHi ? 0.35 : 0}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={geom}>
        <lineBasicMaterial
          ref={lineMatRef}
          color={strokeColor}
          transparent
          opacity={lineOpacity}
          linewidth={linewidth}
        />
      </lineSegments>
    </group>
  );
}

// All pills for an alerting floor live in a SINGLE <Html> anchored at
// one 3D point on the floor's right edge. Inside the Html, a flex row
// of plain DOM buttons handles the layout — 10px gap, all on the same
// horizontal line.
//
// Why a single Html and not one per pill: <Html> projects its 3D
// anchor to screen, but with multiple Html anchors at different X
// positions in world space, each one projects to a different screen
// position. Once the camera tilts, those screen positions drift in
// different directions and the pill row degenerates into a staircase.
// One anchor + DOM flex layout keeps every pill rigidly together
// regardless of camera angle.
// FloorPillRow now anchors at the building's back-right corner in
// world space — (FLOOR_WIDTH/2, y, -FLOOR_DEPTH/2) — which is the
// visually rightmost point of the floor under the iso 3/4 camera
// angle. The connector tick + pills then live INSIDE the Html, laid
// out by CSS flex in pure SCREEN space. Net effect: the connector
// always reads as a clean horizontal tick perpendicular to the
// building, regardless of how the camera is angled (3D-anchored
// connectors looked angled because of the iso projection).
const PILL_DOM_GAP = 10; // pure CSS gap between pills (px)
const CONNECTOR_PX = 36; // screen-pixel length of the connector tick
const CONNECTOR_GAP_PX = 6; // gap between the corner anchor and the tick start

export function FloorPillRow({ y, name, pills, highlightColor, onFloorClick, onAgentClick }) {
  return (
    <Html
      position={[FLOOR_WIDTH / 2, y, -FLOOR_DEPTH / 2]}
      center={false}
      style={{ pointerEvents: 'auto', transform: 'translate(0, -50%)' }}
      zIndexRange={[10, 0]}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: PILL_DOM_GAP,
          whiteSpace: 'nowrap',
          paddingLeft: CONNECTOR_GAP_PX,
        }}
      >
        <span
          aria-hidden
          style={{
            width: CONNECTOR_PX,
            height: 1.5,
            background: '#cbd5e1',
            opacity: 0.75,
            flexShrink: 0,
          }}
        />
        <PillButton
          label={name}
          color={highlightColor || 'var(--text)'}
          border={highlightColor || 'var(--border-strong)'}
          minWidth={64}
          title={name}
          ariaLabel={`Alerts on ${name}`}
          onClick={onFloorClick}
        />
        {pills.map((p) => (
          <PillButton
            key={p.agentId}
            label={formatCount(p.count)}
            color={p.color}
            border={p.color}
            minWidth={40}
            title={`${p.agentId} · ${p.count.toLocaleString()}`}
            ariaLabel={`${p.count} ${p.agentId} alerts on ${name}`}
            onClick={() => onAgentClick(p.agentId)}
          />
        ))}
      </div>
    </Html>
  );
}

// Pure-DOM pill button shared by floor + agent pills. Same outline
// aesthetic; color + border + min-width vary per role.
function PillButton({ label, color, border, minWidth, title, ariaLabel, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick && onClick();
      }}
      aria-label={ariaLabel}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3px 12px',
        minWidth,
        background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
        color,
        border: `1.5px solid ${border}`,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1.2,
        fontFamily: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        backdropFilter: 'blur(6px)',
      }}
    >
      {label}
    </button>
  );
}

// Floor name label rendered off the LEFT edge of the floor box.
// Same screen-space approach as FloorPillRow but with two extra
// tweaks to handle the density of 50+ floors:
//   - Compact pill size (~12px tall vs the right-side's 18px) so
//     each label fits within one floor's screen height.
//   - Two-column horizontal stagger: even-index floors use a short
//     connector (close to building), odd-index use a longer one so
//     their pills sit further left. Adjacent labels never share the
//     same X — overlap is impossible regardless of how zoomed-in.
const LABEL_TICK_NEAR = 22;
const LABEL_TICK_FAR = 70;
export function FloorLabel({ y, name, index }) {
  const tickWidth = index % 2 === 0 ? LABEL_TICK_NEAR : LABEL_TICK_FAR;
  return (
    <Html
      position={[-FLOOR_WIDTH / 2, y, FLOOR_DEPTH / 2]}
      center={false}
      style={{ pointerEvents: 'none', transform: 'translate(-100%, -50%)' }}
      zIndexRange={[5, 0]}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
          paddingRight: CONNECTOR_GAP_PX,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 7px',
            minWidth: 32,
            height: 14,
            background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
            color: 'var(--text-soft)',
            border: '1.25px solid var(--border-strong)',
            borderRadius: 999,
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            backdropFilter: 'blur(6px)',
          }}
        >
          {name}
        </div>
        <span
          aria-hidden
          style={{
            width: tickWidth,
            height: 1.5,
            background: '#cbd5e1',
            opacity: 0.75,
            flexShrink: 0,
          }}
        />
      </div>
    </Html>
  );
}

// Floor-number pill on the LEFT side of the building, only rendered
// for floors that currently carry an alert (CTA or agent activity).
// Pulled out of name (e.g. "Floor 41" → "41") so the pill stays
// compact even on long floor names. Colored to match the alert.
export function FloorAlertNumber({ y, name, color, floorId }) {
  const match = typeof name === 'string' ? name.match(/\d+/) : null;
  const num = match ? match[0] : name || '';
  // Vertical de-overlap offset (px), driven by AlertNumberAutoLayout so
  // badges on adjacent callout floors don't stack. 0 = natural position
  // (centered on the floor). Mirrored into a ref so the layout pass can
  // read the latest value from inside useFrame.
  const [dy, setDy] = useState(0);
  const dyRef = useRef(0);
  dyRef.current = dy;
  useEffect(() => {
    const key = floorId || name;
    ALERT_NUM_REGISTRY.set(key, { y_world: y, dyRef, setDy });
    return () => {
      ALERT_NUM_REGISTRY.delete(key);
    };
  }, [floorId, name, y]);
  // Connector from the floor anchor (0,0) out to the badge, which sits to
  // the LEFT at vertical offset `dy` (set by AlertNumberAutoLayout). Mirrors
  // the CTACard connector: the line angles back to the true floor edge when
  // the badge is shifted up/down to de-overlap, instead of a fixed stub that
  // drifts off the floor.
  const BADGE_RUN = 40; // horizontal px from floor edge out to the badge
  const lineEndX = -BADGE_RUN;
  const lineEndY = dy;
  const lineLength = Math.sqrt(lineEndX * lineEndX + lineEndY * lineEndY);
  const lineAngleRad = Math.atan2(lineEndY, lineEndX);
  // Unit vector anchor → badge, used to inset both ends of the connector so
  // it touches neither the building edge nor the pill.
  const ux = lineLength > 0.001 ? lineEndX / lineLength : -1;
  const uy = lineLength > 0.001 ? lineEndY / lineLength : 0;
  const BADGE_FLOOR_GAP = 14; // line lifts off the building edge
  const lineStartX = BADGE_FLOOR_GAP * ux;
  const lineStartY = BADGE_FLOOR_GAP * uy;
  const visibleLen = Math.max(0, lineLength - BADGE_FLOOR_GAP - CONNECTOR_GAP_PX);
  return (
    <Html
      position={[-FLOOR_WIDTH / 2, y, FLOOR_DEPTH / 2]}
      center={false}
      style={{ pointerEvents: 'none' }}
      zIndexRange={[8, 0]}
    >
      <div style={{ position: 'relative' }}>
        {/* Angled connector: starts BADGE_FLOOR_GAP off the building edge and
            stops CONNECTOR_GAP_PX short of the pill — touches neither. */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: lineStartY,
            left: lineStartX,
            width: visibleLen,
            height: 1.5,
            background: color,
            opacity: 0.6,
            transformOrigin: '0 50%',
            transform: `rotate(${lineAngleRad}rad)`,
          }}
        />
        {/* Number pill — right edge pinned to the connector's far end,
            vertically centered on the (possibly shifted) badge slot. */}
        <div
          style={{
            position: 'absolute',
            left: lineEndX,
            top: lineEndY,
            transform: 'translate(-100%, -50%)',
            whiteSpace: 'nowrap',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 12px',
              minWidth: 44,
              height: 22,
              background: 'color-mix(in oklch, var(--surface) 94%, transparent)',
              color,
              border: `1.5px solid ${color}`,
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              lineHeight: 1,
              fontFamily: 'inherit',
              userSelect: 'none',
              backdropFilter: 'blur(6px)',
              boxShadow: `0 2px 6px color-mix(in oklch, ${color} 22%, transparent)`,
            }}
          >
            {num}
          </div>
        </div>
      </div>
    </Html>
  );
}

// Phase 4 — hero-building override. When `locations.model_url` is set,
// the viewer renders this GLB/glTF model instead of the procedural
// floor stack. We traverse the loaded scene and override every mesh
// material with a wireframe MeshBasicMaterial so a real architectural
// model still reads as the line-drawing aesthetic the rest of the
// viewer uses.
//
// `useGLTF` from drei suspends while the file downloads — wrap in a
// <Suspense> on the caller side. The cache is keyed by URL so
// switching tabs back doesn't re-fetch.
export function GLBBuilding({ url, scale, offsetY, lineColor }) {
  const { scene } = useGLTF(url);
  // One-time material override per load. Mutating the loaded scene's
  // mesh materials is the cheapest way to recolor without rebuilding
  // a parallel scene graph; the dispose-on-unmount cleans up the new
  // materials so reloads don't leak.
  const overridden = useMemo(() => {
    const created = [];
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = new THREE.MeshBasicMaterial({
          color: lineColor,
          wireframe: true,
          transparent: true,
          opacity: 0.85,
        });
        created.push(obj.material);
      }
    });
    return created;
  }, [scene, lineColor]);
  useEffect(
    () => () => {
      for (const m of overridden) m.dispose();
    },
    [overridden],
  );
  return (
    <group position={[0, offsetY, 0]} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

// Fit-to-view. Computes the bounding box of whatever's inside
// `contentRef` (procedural floor stack OR loaded GLB) and positions
// the camera so the whole thing frames the canvas viewport. Driven
// by a monotonically-increasing `trigger` int — the controller fires
// once per unique value and uses useFrame so it can wait until the
// async-loaded GLB scene actually has geometry before measuring.
//
// `mode` controls the framing offset:
//   - 'centered' (⛶ button): building centred in the canvas.
//   - 'default' (⌂ button + initial mount): target shifted right so
//     the building appears on the LEFT third of the canvas, leaving
//     room on the right for the alerts panel + alert details. Same
//     3/4 isometric angle either way.
export function FitController({ contentRef, trigger, mode, controlsRef }) {
  const { camera, size } = useThree();
  const lastFire = useRef(-1);

  useFrame(() => {
    if (trigger === lastFire.current) return;
    if (!contentRef.current || !controlsRef.current) return;

    const box = new THREE.Box3().setFromObject(contentRef.current);
    if (box.isEmpty()) return; // wait for content (GLB still loading)

    lastFire.current = trigger;

    const center = box.getCenter(new THREE.Vector3());
    const dims = box.getSize(new THREE.Vector3());

    // Orthographic projection — eliminates the keystone tilt that
    // perspective gave us on off-centre buildings. With ortho, the
    // building's verticals stay parallel regardless of camera angle
    // or screen position; "zooming" means scaling, not moving the
    // camera closer.
    //
    // Fit math: drei sets camera.left/right to ±size.width/2 and
    // top/bottom to ±size.height/2 in world units BEFORE applying
    // zoom. So visible world extent = canvas_pixels / zoom. To fit
    // the building with PAD padding:
    //   zoom = min(canvas_w / building_w, canvas_h / building_h) / PAD
    // PAD applies to BOTH dimensions, but we also reserve fixed pixel
    // space at the top of the canvas for the agent-filter buttons
    // strip — otherwise the building's top edge clips into that row.
    // Effective vertical space is canvas_height minus the reserved
    // band.
    const PAD = 1.15;
    const TOP_RESERVED_PX = 80; // agent filter strip + breathing room
    const buildingW = Math.max(dims.x, dims.z); // depth or width, whichever's wider on screen
    const availableHeight = Math.max(100, size.height - TOP_RESERVED_PX);
    const zoomH = size.width / (buildingW * PAD);
    const zoomV = availableHeight / (dims.y * PAD);
    const zoom = Math.min(zoomH, zoomV);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();

    // Camera angle — more side-on than the original (1, 0.7, 1) so
    // the building's right face is clearly visible, separating the
    // wireframe silhouette from the floor pills sitting to its
    // right. (1.6, 0.55, 1) puts the camera more to the +X side and
    // a touch lower, reading as a steeper 3/4 view.
    const dir = new THREE.Vector3(1.6, 0.55, 1).normalize();

    // Shift the orbit target UP in world space by half of the
    // top-reserved band so the building's centre appears BELOW the
    // canvas vertical centre by the same amount. Net effect: the
    // building's top edge clears the agent-filter strip cleanly.
    const target = center.clone();
    target.y += TOP_RESERVED_PX / (2 * zoom);

    // 'default' mode shifts the orbit target horizontally so the
    // building lands in the left third of the canvas. With ortho,
    // visible_world_width = canvas_width_px / zoom, so a TARGET_NDC
    // offset translates to: target.x += NDC * canvas_w / (2 * zoom).
    // Applied along screen-right in world coords.
    if (mode === 'default') {
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
      const TARGET_NDC = 0.55;
      const halfVisibleWidthWorld = size.width / (2 * zoom);
      target.addScaledVector(right, TARGET_NDC * halfVisibleWidthWorld);
    }

    // For orthographic, camera distance only affects depth-sorting,
    // not apparent size. Keep it generous so the whole building is
    // safely inside near/far.
    const dist = Math.max(dims.x, dims.y, dims.z) * 3;
    camera.position.copy(target).addScaledVector(dir, dist);
    controlsRef.current.target.copy(target);
    controlsRef.current.update();
  });

  return null;
}

// Rich CTA card pinned next to a CTA-mode floor (used by My Day).
// Anchored at the floor's back-right corner like FloorPillRow, with
// a screen-space CSS connector tick + a colored dot at the floor edge
// so the card visibly LINKS to its floor. Border colour matches the
// CTA's highlight colour so the card visually pairs with the red
// floor slab + connector.
//
// Layout (all pure DOM, in screen space — no 3D Lines, which always
// project diagonally under iso projection):
//   [floor corner anchor] ─── tick ── [card]
//
// The card carries Approve / Hold action buttons that fire
// cta.onApprove / cta.onHold (passed through by the caller). If
// either handler is omitted, the corresponding button is omitted —
// so a read-only card just has no action row.
const CTA_DOT_PX = 9; // colored dot at the floor edge
const CTA_CARD_W = 280; // card width
// PR #663: bumped 95 → 132 to match actual rendered height (header
// strip 30 + title row 30 + actions row 36 + paddings ≈ 132). The
// 95 estimate undercounted by ~40px so auto-layout's overlap test
// was permissive — cards visually overlapped while the algorithm
// thought they were clear.
const CTA_CARD_H = 132;
// Height when collapsed — drag header (~24) + title bar (~32) + 4px
// breathing room. No body rendered in this state. PR #736.
const CTA_CARD_H_COLLAPSED = 60;

// PR #661/663: per-card initial positions form a staircase fan.
// cardIndex is assigned by FLOOR POSITION (top → 0, middle → 1,
// bottom → 2), NOT by CTA recency, so the staircase always reads
// correctly regardless of which floor fired most recently.
//
// All cards default BELOW or level with their anchor — none above,
// because a card placed above its anchor pushes off-screen when
// the CTA happens to be on a top floor (Floor 41+ on Meridian HQ).
//
// PR #742 (re-apply of #740, after #741 mis-reverted): default
// offset for every cardIndex uses dy = -CTA_CARD_H/2 so the card
// sits LEVEL with its anchor floor and the connector reads as a
// clean horizontal line. Per-card dx still varies a bit so cards
// don't all land at the exact same X.
//
// Cards remain draggable: lineEndY = offset.dy + cardH/2 is
// computed at render, so when the user drags the card vertically
// offset.dy changes and the connector angles to follow naturally.
// CTAAutoLayout also continues to nudge dy when cards would
// visually collide.
const CTA_DEFAULT_LAYOUT = [
  { dx: 220, dy: -CTA_CARD_H / 2 },
  { dx: 280, dy: -CTA_CARD_H / 2 },
  { dx: 240, dy: -CTA_CARD_H / 2 },
];
function defaultOffsetFor(cardIndex) {
  const i = Math.max(0, Math.min(CTA_DEFAULT_LAYOUT.length - 1, cardIndex || 0));
  return { ...CTA_DEFAULT_LAYOUT[i] };
}

// PR #662 — module-level registry for cross-card collision avoidance.
// Each CTACard registers its floor world-Y + setOffset callback on
// mount; the CTAAutoLayout component (inside <Canvas>) reads the
// registry every frame, projects floor anchors to screen pixels,
// detects card overlap, and nudges later cards down via setOffset.
// Manually-dragged cards set a `manualLockRef` and are skipped by
// the layout pass.
const CTA_REGISTRY = new Map(); // runId -> { y_world, offsetRef, manualRef, setOffset }
const CTA_LAYOUT_GAP_PX = 10; // min vertical pixels between two cards

// Parallel registry for the left-edge floor-number badges (FloorAlertNumber).
// Same de-overlap problem as the cards — adjacent callout floors (24/25/26)
// stack their badges — solved the same way via resolveVerticalLayout. Keyed
// by floor id. Entry: { y_world, dyRef, setDy }.
const ALERT_NUM_REGISTRY = new Map();
const ALERT_NUM_H = 24; // badge bounding height for spacing
const ALERT_NUM_GAP = 7; // min vertical px between two badges

// PR #808: minimal-displacement de-overlap solver (re-enabled after the
// PR #743 disable, which killed the old pass for cascade-overriding every
// card's dy each frame and flattening the level-with-anchor connector).
// Runs in useFrame so it tracks zoom/pan. Each frame:
//   1. Project every (non-manual) card's floor anchor to screen-Y.
//   2. Sort by ANCHOR-Y (floor order top→bottom) so the vertical stack
//      matches floor order and connectors never cross. (The old pass
//      sorted by cardIndex — wrong for sensing, where index is best→worst
//      not top→bottom, so cards landed out of order.)
//   3. Resolve overlaps with an isotonic pool-adjacent-violators (PAVA)
//      pass — the L2-optimal way to enforce a minimum top-to-top gap of
//      (height_i + GAP) while moving each card as LITTLE as possible.
//      A card with no neighbour conflict keeps its desired position
//      EXACTLY, so isolated cards retain the clean horizontal connector
//      (the precise behaviour #743 was protecting). Uses each card's LIVE
//      height (collapsed vs expanded), not a fixed constant.
//   4. Clamp the packed stack inside the canvas; even-distribute only in
//      the pathological case where it genuinely can't fit.
// Manually-dragged cards are pinned (filtered out) — the user's placement
// wins and is left untouched.
export function CTAAutoLayout({ topInset = CTA_BOUNDS_MARGIN }) {
  const { camera, size } = useThree();
  const vecRef = useRef(new THREE.Vector3());
  useFrame(() => {
    const cards = Array.from(CTA_REGISTRY.values()).filter((e) => !e.manualRef.current);
    if (cards.length < 2) return; // 0–1 card: nothing can overlap

    // 1. Project anchors → screen-Y; capture desired top + live height.
    const DEFAULT_DY = -CTA_CARD_H / 2; // level-with-anchor default pose
    const items = cards.map((entry) => {
      const v = vecRef.current.set(FLOOR_WIDTH / 2, entry.y_world, -FLOOR_DEPTH / 2);
      v.project(camera);
      const anchorY = ((1 - v.y) / 2) * size.height;
      return {
        entry,
        anchorY,
        desiredTop: anchorY + DEFAULT_DY,
        height: entry.heightRef?.current || CTA_CARD_H_COLLAPSED,
        currentDy: entry.offsetRef.current.dy,
      };
    });

    // 2. Sort by anchor-Y (floor order) so connectors don't cross.
    items.sort((a, b) => a.anchorY - b.anchorY);

    // 3. Resolve overlaps + clamp to canvas (pure isotonic solver).
    const tops = resolveVerticalLayout(items, {
      gap: CTA_LAYOUT_GAP_PX,
      topMargin: topInset, // clear the metric/agent button bar
      bottomMargin: CTA_BOUNDS_MARGIN,
      canvasHeight: size.height,
    });

    // 4. Apply — write dy only when it moved (>0.5px) so converged
    //    layouts stop re-rendering and unconflicted cards keep their
    //    exact default pose (no connector flattening).
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      const newDy = tops[i] - it.anchorY;
      if (Math.abs(newDy - it.currentDy) > 0.5) {
        it.entry.setOffset((o) => ({ ...o, dy: newDy }));
      }
    }
  });
  return null;
}

// Same de-overlap pass for the left-edge floor-number badges. Reuses the
// shared solver; badges are smaller and centered on their floor, so their
// desired top is anchorY − H/2 and the applied shift re-centers the badge
// on its resolved slot (shift 0 when there's no conflict).
export function AlertNumberAutoLayout({ topInset = CTA_BOUNDS_MARGIN }) {
  const { camera, size } = useThree();
  const vecRef = useRef(new THREE.Vector3());
  useFrame(() => {
    const entries = Array.from(ALERT_NUM_REGISTRY.values());
    if (entries.length < 2) return;
    const items = entries.map((entry) => {
      const v = vecRef.current.set(-FLOOR_WIDTH / 2, entry.y_world, FLOOR_DEPTH / 2);
      v.project(camera);
      const anchorY = ((1 - v.y) / 2) * size.height;
      return {
        entry,
        anchorY,
        desiredTop: anchorY - ALERT_NUM_H / 2, // centered on the floor
        height: ALERT_NUM_H,
        currentDy: entry.dyRef.current,
      };
    });
    items.sort((a, b) => a.anchorY - b.anchorY);
    const tops = resolveVerticalLayout(items, {
      gap: ALERT_NUM_GAP,
      topMargin: topInset,
      bottomMargin: CTA_BOUNDS_MARGIN,
      canvasHeight: size.height,
    });
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      // top = anchorY − H/2 + dy  ⇒  dy = top − anchorY + H/2.
      const newDy = tops[i] - it.anchorY + ALERT_NUM_H / 2;
      if (Math.abs(newDy - it.currentDy) > 0.5) it.entry.setDy(newDy);
    }
  });
  return null;
}

// Connector from a selected floor's right edge to the floating Activity
// panel (the top-right DOM overlay). The CTA / pill connectors get to be
// static rotated divs because their card lives INSIDE the same <Html> as
// the floor anchor, so both ends ride the camera together for free. The
// Activity panel is different: it's pinned to the viewer's top-right corner
// in SCREEN space, not Html-local space — so under pan/zoom the floor
// anchor moves while the panel stays put, and the line between them must be
// recomputed. This component lives inside <Canvas>, projects the floor's
// right-edge anchor to screen pixels every frame, and mutates a plain SVG
// <line> + dot (rendered as a sibling of the panel, OUTSIDE the canvas) via
// shared refs — no React re-render per frame. Neutral slate styling matches
// the floor-label / pill ticks; the dot at the card end echoes CTACard.
const ACT_CONN_GAP_FLOOR = 14; // line lifts off the building edge
const ACT_CONN_GAP_CARD = 6; // gap between dot and panel edge
const ACT_CONN_DOT_R = 4; // dot radius (px) — mirror in the SVG <circle>
export function ActivityConnector({ floorY, lineRef, dotRef, groupRef, panelElRef }) {
  const { camera, size } = useThree();
  const vecRef = useRef(new THREE.Vector3());
  useFrame(() => {
    const lineEl = lineRef.current;
    const dotEl = dotRef.current;
    const groupEl = groupRef.current;
    const panelEl = panelElRef.current;
    if (!lineEl || !dotEl || !groupEl || !panelEl) return;
    // Floor right-edge anchor (same point the pill rows / CTA cards use)
    // → screen pixels. The canvas fills the viewer container, so canvas
    // px == container px, which is also the SVG overlay's coordinate space.
    const v = vecRef.current.set(FLOOR_WIDTH / 2, floorY, -FLOOR_DEPTH / 2);
    v.project(camera);
    const ax = (v.x * 0.5 + 0.5) * size.width;
    const ay = (1 - (v.y * 0.5 + 0.5)) * size.height;
    // Panel target: its left edge, vertically tracking the floor anchor but
    // clamped inside the panel body so the line always lands on the card.
    // offsetLeft/Top/Height are relative to the same positioned container.
    const pLeft = panelEl.offsetLeft;
    const pTop = panelEl.offsetTop;
    const pH = panelEl.offsetHeight;
    const tx = pLeft;
    const ty = Math.max(pTop + 16, Math.min(pTop + pH - 16, ay));
    const dx = tx - ax;
    const dy = ty - ay;
    const len = Math.sqrt(dx * dx + dy * dy);
    // Hide if the building edge has panned to/over the panel (no clean run).
    if (len < 1 || ax >= tx) {
      groupEl.style.display = 'none';
      return;
    }
    groupEl.style.display = '';
    const ux = dx / len;
    const uy = dy / len;
    const sx = ax + ACT_CONN_GAP_FLOOR * ux; // start clear of the building
    const sy = ay + ACT_CONN_GAP_FLOOR * uy;
    const dotX = tx - (ACT_CONN_GAP_CARD + ACT_CONN_DOT_R) * ux; // dot near card
    const dotY = ty - (ACT_CONN_GAP_CARD + ACT_CONN_DOT_R) * uy;
    const ex = dotX - ACT_CONN_DOT_R * ux; // line stops at the dot's near edge
    const ey = dotY - ACT_CONN_DOT_R * uy;
    lineEl.setAttribute('x1', sx);
    lineEl.setAttribute('y1', sy);
    lineEl.setAttribute('x2', ex);
    lineEl.setAttribute('y2', ey);
    dotEl.setAttribute('cx', dotX);
    dotEl.setAttribute('cy', dotY);
  });
  return null;
}

// PR #659: cards are draggable. The dot stays pinned at the floor's
// back-right corner (anchored via Html's 3D position), but the card
// body floats freely. PR #661: initial position now varies by
// cardIndex for a more dynamic composition (see CTA_DEFAULT_LAYOUT).
// PR #662: auto-layout pass adjusts dy on zoom/pan to keep cards from
// overlapping each other.
export function CTACard({ y, cta, floorName, cardIndex = 0 }) {
  const accent = cta.color || '#ef4444';
  const [offset, setOffset] = useState(() => defaultOffsetFor(cardIndex));
  // PR #724: double-click on the card's drag-handle header toggles a
  // "show full reason" expand. Default state shows summarized body;
  // expanded reveals the full reason text with no clamp. minHeight
  // stays at CTA_CARD_H so the connector geometry is unchanged;
  // expanded cards grow downward.
  const [expanded, setExpanded] = useState(false);
  // `manualLockRef` flips true the first time the user drags this
  // card. While locked, CTAAutoLayout skips it — the user's manual
  // position is sticky until the card unmounts (resolve / building
  // switch). Reset is implicit via remount.
  const manualLockRef = useRef(false);
  // `offsetRef` mirrors `offset` so the registry can read the latest
  // value from inside useFrame without going through state. Avoids a
  // stale closure on the setOffset callback.
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  // Live rendered height (collapsed vs expanded) mirrored into a ref so
  // the layout pass can space cards by their ACTUAL height — set below
  // once `cardH` is computed.
  const heightRef = useRef(CTA_CARD_H_COLLAPSED);
  // Ref to the card DOM node so a ResizeObserver can feed heightRef the
  // real measured height (a wrapped multi-line title makes the card taller
  // than the constant, which would otherwise let the de-overlap pass let
  // tall cards collide).
  const cardElRef = useRef(null);

  // Register / unregister with CTA_REGISTRY so the auto-layout pass
  // can see this card. Re-registers if cta.id, y, or cardIndex change
  // (rare — happens when CTAs are reshuffled).
  useEffect(() => {
    CTA_REGISTRY.set(cta.id, {
      y_world: y,
      cardIndex,
      offsetRef,
      heightRef,
      manualRef: manualLockRef,
      setOffset,
    });
    return () => {
      CTA_REGISTRY.delete(cta.id);
    };
  }, [cta.id, y, cardIndex]);
  const dragRef = useRef(null);

  const onDragStart = (e) => {
    if (e.button !== 0) return; // left click only
    e.preventDefault();
    e.stopPropagation();
    manualLockRef.current = true; // skip future auto-layout passes
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startDx: offset.dx,
      startDy: offset.dy,
    };
    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd, { once: true });
  };
  const onDragMove = (e) => {
    if (!dragRef.current) return;
    setOffset({
      dx: dragRef.current.startDx + (e.clientX - dragRef.current.startX),
      dy: dragRef.current.startDy + (e.clientY - dragRef.current.startY),
    });
  };
  const onDragEnd = () => {
    dragRef.current = null;
    document.body.style.cursor = '';
    window.removeEventListener('pointermove', onDragMove);
  };

  // Card height — collapses to ~60px (drag-strip + title bar) when
  // not expanded so the body whitespace doesn't drag the connector
  // off the card. Double-clicking the drag header toggles expand.
  const cardH = expanded ? CTA_CARD_H : CTA_CARD_H_COLLAPSED;
  // Seed with the constant; the ResizeObserver below replaces it with the
  // real measured height once the card lays out (and on every reflow, e.g.
  // when the title wraps or the card expands).
  heightRef.current = Math.max(heightRef.current, cardH);
  useEffect(() => {
    const el = cardElRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (h > 0) heightRef.current = h;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Connector geometry: line from dot (0,0) to the card's left-edge
  // midpoint (offset.dx, offset.dy + cardH/2). atan2 + sqrt give us
  // the rotation + length for a CSS-rotated div, which paints a clean
  // diagonal regardless of where the card is dragged.
  const lineEndX = offset.dx;
  const lineEndY = offset.dy + cardH / 2;
  const lineLength = Math.sqrt(lineEndX * lineEndX + lineEndY * lineEndY);
  const lineAngleRad = Math.atan2(lineEndY, lineEndX);

  return (
    <Html
      position={[FLOOR_WIDTH / 2, y, -FLOOR_DEPTH / 2]}
      center={false}
      /* pointerEvents: 'none' on the Html wrapper lets canvas pan/zoom
         pass through the empty area between dot and card. Inner
         elements re-enable pointerEvents where they need clicks. */
      style={{ pointerEvents: 'none' }}
      zIndexRange={[15, 0]}
    >
      <div style={{ position: 'relative' }}>
        {/* Connector (PR #745) — per JB:
            - Floor side: no dot, line doesn't touch the building.
            - Card side: small colored dot just before the card edge.
            Geometry: line travels from (GAP_FLOOR * ux, GAP_FLOOR * uy)
            to a stop short of the card edge, leaving room for the dot
            + a visual gap. */}
        {(() => {
          const ux = lineLength > 0.001 ? lineEndX / lineLength : 1;
          const uy = lineLength > 0.001 ? lineEndY / lineLength : 0;
          const GAP_FLOOR = 14; // line doesn't touch building
          const GAP_CARD = 6; // visual gap dot ↔ card edge
          const DOT_R = CTA_DOT_PX / 2;
          // Dot center: pulled inward from the card edge by (GAP_CARD + DOT_R).
          const dotX = lineEndX - (GAP_CARD + DOT_R) * ux;
          const dotY = lineEndY - (GAP_CARD + DOT_R) * uy;
          // Line ends at the LEFT edge of the dot.
          const lineLeft = GAP_FLOOR * ux;
          const lineTop = GAP_FLOOR * uy;
          const visibleLen = Math.max(0, lineLength - GAP_FLOOR - GAP_CARD - CTA_DOT_PX);
          return (
            <>
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: lineTop,
                  left: lineLeft,
                  width: visibleLen,
                  height: 2,
                  background: accent,
                  opacity: 0.85,
                  transformOrigin: '0 50%',
                  transform: `rotate(${lineAngleRad}rad)`,
                }}
              />
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: dotY - DOT_R,
                  left: dotX - DOT_R,
                  width: CTA_DOT_PX,
                  height: CTA_DOT_PX,
                  borderRadius: '50%',
                  background: accent,
                  boxShadow: `0 0 0 2px color-mix(in oklch, ${accent} 28%, transparent)`,
                }}
              />
            </>
          );
        })()}
        {/* The card — absolutely positioned at the offset, draggable
            via the header strip. minHeight pegs the rendered height
            to CTA_CARD_H so the connector geometry (which closes over
            CTA_CARD_H to find the midpoint) always lands on the
            card's actual middle. After PR #721 removed the inline
            Approve/Hold row the card shrank to ~50px while
            CTA_CARD_H stayed 132, leaving the connector terminating
            below the card — fixed by pinning the height here. */}
        <div
          ref={cardElRef}
          style={{
            position: 'absolute',
            top: offset.dy,
            left: offset.dx,
            width: CTA_CARD_W,
            minHeight: cardH,
            pointerEvents: 'auto',
            background: 'color-mix(in oklch, var(--surface) 96%, transparent)',
            border: `1.5px solid ${accent}`,
            borderRadius: 10,
            boxShadow: `0 6px 22px color-mix(in oklch, ${accent} 22%, transparent)`,
            overflow: 'hidden',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header strip is the drag handle. Double-click toggles
              expanded (full reason text vs summarized body). */}
          <div
            onPointerDown={onDragStart}
            onDoubleClick={() => setExpanded((v) => !v)}
            title="Double-click to expand"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '5px 10px',
              background: `color-mix(in oklch, ${accent} 9%, transparent)`,
              borderBottom: `1px solid color-mix(in oklch, ${accent} 18%, transparent)`,
              cursor: 'grab',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '1px 7px',
                background: accent,
                color: '#fff',
                borderRadius: 999,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                lineHeight: 1.4,
              }}
            >
              {cta.priority || 'attention'}
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'var(--text-dim)',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}
            >
              {floorName}
              {cta.agentId ? ` · ${cta.agentId}` : ''}
            </span>
          </div>
          {/* Title bar — accent-colored band. JB 2026-05-30: the card is a
              GLANCE surface, so it shows a compact summarized headline
              (summarizeTitle = first clause, cut at a clean word boundary —
              never mid-word) clamped to 2 lines. The full reason text lives
              in the Details drawer, which is now exhaustive. This keeps every
              card the same compact height so the canvas stays clean and the
              de-overlap pass can space them tidily. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '7px 10px',
              background: accent,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12.5,
                fontWeight: 800,
                color: '#fff',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.3,
              }}
            >
              {summarizeTitle(cta.title)}
            </span>
            {/* Raw sensor reading — always-visible number backing the
                qualitative title (sensing cards only; absent elsewhere). */}
            {cta.reading && (
              <span
                style={{
                  flexShrink: 0,
                  padding: '2px 8px',
                  background: 'rgba(255,255,255,0.22)',
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 800,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {cta.reading}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openMessage({ type: cta.drawerKind || 'agent_run', id: cta.id, payload: { ...cta, floorName } });
              }}
              style={{
                padding: '3px 10px',
                background: 'rgba(255,255,255,0.22)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              Details
            </button>
          </div>
          {/* Body — hidden in the default (collapsed) state per JB.
              Double-click the drag-handle header to expand; click the
              body itself (or the Details button above) to open the
              drawer with the full payload. PR #736. */}
          {expanded && cta.title && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openMessage({ type: cta.drawerKind || 'agent_run', id: cta.id, payload: { ...cta, floorName } });
              }}
              title={cta.title}
              style={{
                width: '100%',
                flex: 1,
                padding: '10px 12px',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--text)',
                lineHeight: 1.45,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                overflow: 'visible',
                whiteSpace: 'normal',
              }}
            >
              {cta.title}
            </button>
          )}
        </div>
      </div>
    </Html>
  );
}

// Floating toast that appears next to a flashing floor when a new
// alert arrives (real or TEST). Anchors at the floor's back-right
// corner like FloorPillRow, but with a much larger paddingLeft so
// it floats well clear of the pill column. Pink header bar +
// per-agent dot + reason text. Auto-dismisses via parent after
// TOAST_MS; clickable × also dismisses.
export function AlertToast({ y, floor, row, agentId, color, onDismiss }) {
  return (
    <Html
      position={[FLOOR_WIDTH / 2, y, -FLOOR_DEPTH / 2]}
      center={false}
      style={{ pointerEvents: 'auto', transform: 'translate(0, -50%)' }}
      zIndexRange={[30, 0]}
    >
      <div
        style={{
          marginLeft: 220, // clear the pill row + a comfortable gap
          width: 280,
          background: 'var(--surface)',
          border: `2px solid ${color}`,
          borderRadius: 12,
          boxShadow: `0 8px 32px color-mix(in oklch, ${color} 30%, transparent)`,
          overflow: 'hidden',
        }}
      >
        {/* Header bar (agent colour) */}
        <div
          style={{
            background: color,
            color: '#fff',
            padding: '8px 12px',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            New alert · {floor?.name || 'Floor'}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{
              width: 20,
              height: 20,
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
              userSelect: 'none',
            }}
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '10px 12px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: color,
              }}
            />
            {agentId}
          </div>
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.45,
              color: 'var(--text)',
              fontWeight: 500,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {row?.decision_reason || 'New alert reported (no reason recorded)'}
          </div>
        </div>
      </div>
    </Html>
  );
}

// A translucent severity-tinted box with crisp edges (same wireframe-over-fill
// treatment as FloorBox) — the building block for the roof cap + basement
// plinth. Edges geometry is memoized + disposed.
function ZoneBox({ size, color, opacity }) {
  const edges = useMemo(() => {
    const box = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const e = new THREE.EdgesGeometry(box);
    box.dispose();
    return e;
  }, [size[0], size[1], size[2]]);
  useEffect(() => () => edges.dispose(), [edges]);
  return (
    <group>
      <mesh>
        <boxGeometry args={size} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={color} transparent opacity={0.95} />
      </lineSegments>
    </group>
  );
}

// One off-stack zone marker — REAL geometry tinted by the zone's worst severity,
// a compact count label, and click-to-drill (Phase 2 upgrade of the flat <Html>
// pill). `geom` is a [w,h,d] box (roof cap / basement plinth) or the string
// 'ring' (the ground perimeter torus).
function OffFloorMarker({ zone, position, geom, bucket, onClick, colorMode, t }) {
  const meta = SERVICING_ZONE_META[zone] || { label: zone, hint: '' };
  const label = trLabel(t, meta.labelKey, meta.label);
  const sev = servicingSeverity(bucket.maxHoursOver);
  // Severity hue by default; the service line of the zone's worst item when the
  // colour-by-service-line toggle is on.
  const markerColor = colorMode === 'line' && bucket.worstLine ? domainAccent(bucket.worstLine) : sev.color;
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.style.cursor = hover ? 'pointer' : '';
    return () => {
      if (typeof document !== 'undefined') document.body.style.cursor = '';
    };
  }, [hover]);
  const labelY = geom === 'ring' ? 1.4 : geom[1] / 2 + 0.7;
  return (
    <group position={position}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          onClick && onClick(zone);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        {geom === 'ring' ? (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[Math.max(FLOOR_WIDTH, FLOOR_DEPTH) * 0.74, 0.5, 14, 56]} />
            <meshBasicMaterial color={markerColor} transparent opacity={hover ? 0.85 : 0.6} />
          </mesh>
        ) : (
          <ZoneBox size={geom} color={markerColor} opacity={hover ? 0.72 : 0.55} />
        )}
      </group>
      <Html position={[0, labelY, 0]} center zIndexRange={[14, 0]} style={{ pointerEvents: 'none' }}>
        <div
          title={`${label} · ${meta.hint} — ${bucket.maxHoursOver}h over SLA`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
            padding: '4px 9px 4px 7px',
            borderRadius: 999,
            background: 'color-mix(in oklch, var(--surface) 92%, transparent)',
            border: `1px solid ${markerColor}`,
            boxShadow: '0 6px 18px rgba(15,23,42,0.16)',
            backdropFilter: 'blur(10px) saturate(170%)',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          <span
            aria-hidden
            style={{ width: 8, height: 8, borderRadius: 999, background: markerColor, flexShrink: 0 }}
          />
          <span>{label}</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: markerColor,
              color: '#fff',
              fontSize: 10.5,
              fontWeight: 800,
            }}
          >
            {formatCount(bucket.items.length)}
          </span>
        </div>
      </Html>
    </group>
  );
}

// The roof / basement / perimeter marker cluster for servicing mode. `topY` is
// the tower's roofline world-Y (floors.length * FLOOR_HEIGHT); the base slab is
// at y=0. A roof CAP sits on the slab, a basement/dock PLINTH below grade, and a
// PERIMETER ring encircles the footprint at ground. Clicking one calls
// onZoneClick(zone) → the viewer drills into that zone's items. Renders only the
// zones that actually have open items.
export function ServicingOffFloorMarkers({ offStack, topY, onZoneClick, colorMode, t }) {
  if (!offStack) return null;
  const CAP = [FLOOR_WIDTH * 0.62, 2.2, FLOOR_DEPTH * 0.62];
  const PLINTH = [FLOOR_WIDTH * 1.16, 2.6, FLOOR_DEPTH * 1.16];
  const markers = [];
  if (offStack.roof)
    markers.push({ zone: 'roof', position: [0, topY + 0.12 + CAP[1] / 2, 0], geom: CAP, bucket: offStack.roof });
  if (offStack.basement)
    markers.push({
      zone: 'basement',
      position: [0, -0.12 - PLINTH[1] / 2, 0],
      geom: PLINTH,
      bucket: offStack.basement,
    });
  if (offStack.perimeter)
    markers.push({ zone: 'perimeter', position: [0, 0.6, 0], geom: 'ring', bucket: offStack.perimeter });
  if (markers.length === 0) return null;
  return (
    <>
      {markers.map((m) => (
        <OffFloorMarker
          key={m.zone}
          zone={m.zone}
          position={m.position}
          geom={m.geom}
          bucket={m.bucket}
          onClick={onZoneClick}
          colorMode={colorMode}
          t={t}
        />
      ))}
    </>
  );
}
