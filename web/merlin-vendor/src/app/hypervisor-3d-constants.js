// @ts-check
// Shared constants for the Hypervisor 3D viewer. Live in their own module
// so the orchestrator (HypervisorViewer3D.jsx) and the scene primitives
// (Hypervisor3DScene.jsx) can both import them without a circular import.

// Procedural floor-stack geometry (metres-ish; just a visual scale).
export const FLOOR_HEIGHT = 3.5;
export const FLOOR_WIDTH = 22;
export const FLOOR_DEPTH = 30;

// Flash duration in ms — FloorBox and the viewer's flash-detection effect
// agree on the window length.
export const FLASH_MS = 3500;

// Card-layout insets. The orchestrator passes these to the de-overlap
// passes (CTAAutoLayout / AlertNumberAutoLayout), which also use
// CTA_BOUNDS_MARGIN as a default + canvas clamp.
export const CTA_BOUNDS_MARGIN = 18; // gap between card edge and canvas edge
// Top clearance when a button bar (SensingMetricBar / AgentFilterBar) is
// docked at top:12 — keeps the first card from riding up under it. Bar is
// ~30px tall from top:12, so ~44px bottom; 56 leaves a small breathing gap.
export const CTA_TOP_INSET_BAR = 56;
