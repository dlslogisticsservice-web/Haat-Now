// ─────────────────────────────────────────────────────────────────────────────
// Runtime Node model (Phase 8A · Runtime Selection Layer).
//
// A RuntimeNode is the DATA a selection produces — the minimum needed to identify and
// outline a selectable region of a Runtime-rendered surface. It is pure data: no DOM
// element, no React fiber, no component instance. The overlay keeps the DOM reference
// privately (for bounds recomputation); the node model never leaks it. This keeps the
// Selection Layer independent of React internals, exactly as the contracts require.
//
// `metadataRef` is the id into a RuntimeScreen's StudioComponentMetadata[] (see
// runtime/RuntimeAdapter.ts). It is undefined until screens declare metadata (a later
// sprint); selection works today without it.
// ─────────────────────────────────────────────────────────────────────────────

export interface RuntimeNodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RuntimeNode {
  /** Stable id within a screen: `${channel}:${screen}:${path}`. Survives re-renders. */
  id: string;
  channel: string;
  screen: string;
  /** Human label for the node (aria-label / role / tag heuristic, or declared metadata name). */
  component: string;
  /** Bounds relative to the overlay host, in CSS px. */
  bounds: RuntimeNodeBounds;
  /** Id into the screen's StudioComponentMetadata[] — undefined until metadata is declared. */
  metadataRef?: string;
  /** Child-index path from the screen root (the basis for `id`; useful for nesting later). */
  path: number[];
}

export interface RuntimeSelectionState {
  hover: RuntimeNode | null;
  selected: RuntimeNode | null;
}
