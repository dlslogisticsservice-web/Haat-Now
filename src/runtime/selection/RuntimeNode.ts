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

import type { StudioComponentMetadata } from '../StudioMetadata';

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
  /** Display label — the resolved business name (Phase 8B) if mapped, else a DOM heuristic. */
  component: string;
  /** Bounds relative to the overlay host, in CSS px. */
  bounds: RuntimeNodeBounds;
  /** Id into the screen's StudioComponentMetadata[] — the resolved component id, if mapped. */
  metadataRef?: string;
  /** Child-index path from the screen root (the basis for `id`; useful for nesting later). */
  path: number[];
  // ── Phase 8B — resolved Studio identity (undefined when the node is an unmapped element) ──
  /** The declared component metadata this node resolves to (real business identity). */
  studioComponent?: StudioComponentMetadata;
  /** Component display-name chain from the outermost mapped ancestor → this node. */
  breadcrumb?: string[];
  /** Declared child component display-names found inside this node. */
  childComponents?: string[];
  /** True when resolved to a declared component; false for an unmapped DOM element. */
  mapped?: boolean;
  /** Phase 8C — live values resolved from the runtime, keyed by editable-prop key. */
  resolvedValues?: Record<string, ResolvedValue>;
}

export interface RuntimeSelectionState {
  hover: RuntimeNode | null;
  selected: RuntimeNode | null;
}

// ── Phase 8C — a live value resolved from the running runtime (read-only, never fabricated) ──
export interface ResolvedValue {
  kind: 'text' | 'image' | 'color' | 'bool' | 'number' | 'count' | 'empty';
  value: string | number | boolean | null;
}
