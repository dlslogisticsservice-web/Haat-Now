// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · visual component-tree models (STEP 12).
//
// DESIGN ONLY — no UI, no rendering. These shapes describe an experience as a tree the
// Layout/Component engines resolve and the Studio inspects. The runtime tree (TreeNode /
// ComponentNode / LayoutNode) is channel-neutral; the Studio-facing views (CanvasNode,
// SelectionNode, InspectorNode, HierarchyNode) are projections over it for authoring.
// ─────────────────────────────────────────────────────────────────────────────
import type { ComponentId, Json } from './types';

/** The base node every tree node shares. `type` discriminates the concrete kind. */
export interface TreeNode {
  id: string;
  type: 'layout' | 'component';
  children?: TreeNode[];
}

/** A concrete component instance in the tree. Props are opaque JSON validated by metadata. */
export interface ComponentNode extends TreeNode {
  type: 'component';
  componentId: ComponentId;
  props: { [key: string]: Json };
  /** Optional per-instance visibility flag key (rules/flags decide at runtime). */
  visibleWhenFlag?: string;
}

/** A layout container arranging its children. */
export interface LayoutNode extends TreeNode {
  type: 'layout';
  layout: 'stack' | 'row' | 'grid' | 'section' | (string & {});
  children: TreeNode[];
  /** Layout hints (gap, columns, padding …) — opaque to the engine, honoured by renderers. */
  options?: { [key: string]: Json };
}

// ── Studio-facing projections over the runtime tree (authoring only) ───────────
export interface CanvasNode {
  node: TreeNode;
  /** Bounding box on the design canvas. */
  rect?: { x: number; y: number; width: number; height: number };
  locked?: boolean;
  hidden?: boolean;
}

export interface SelectionNode {
  /** The id of the currently selected node. */
  nodeId: string;
  /** Path from the root to the node, by id. */
  path: string[];
}

export interface InspectorNode {
  nodeId: string;
  /** Editable fields surfaced for the selected node, derived from its component metadata. */
  fields: Array<{ key: string; label: string; kind: 'text' | 'number' | 'boolean' | 'select' | 'color' | 'asset' | (string & {}); value: Json }>;
}

export interface HierarchyNode {
  nodeId: string;
  label: string;
  kind: TreeNode['type'];
  children: HierarchyNode[];
}
