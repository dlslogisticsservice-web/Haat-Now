// ─────────────────────────────────────────────────────────────────────────────
// Component Platform types (Phase 9A).
//
// The contract every platform component declares, and the builder-tree model. Pure types +
// (in components.tsx) declarative specs — the platform is DATA + one renderer, never a second
// rendering engine. Every surface (Customer/Merchant/Driver/Admin/Website/CMS) consumes it.
// ─────────────────────────────────────────────────────────────────────────────
import type React from 'react';

export type ComponentCategory =
  | 'Layout' | 'Content' | 'Media' | 'Forms' | 'Commerce' | 'Navigation' | 'Marketing'
  | 'Dashboard' | 'Charts' | 'Maps' | 'Social' | 'Authentication' | 'Utilities' | 'Feedback';

export const CATEGORIES: ComponentCategory[] = [
  'Layout', 'Content', 'Media', 'Forms', 'Commerce', 'Navigation', 'Marketing',
  'Dashboard', 'Charts', 'Maps', 'Social', 'Authentication', 'Utilities', 'Feedback',
];

export type PropType = 'text' | 'longtext' | 'number' | 'boolean' | 'color' | 'token' | 'select' | 'url' | 'space';

export interface PropSpec {
  key: string;
  label: string;
  type: PropType;
  /** For select. */
  options?: string[];
  /** Inspector grouping: Typography / Colors / Spacing / Borders / Background / Effects / …. */
  group?: string;
}

/** Everything a component's render function receives. */
export interface RenderInput {
  props: Record<string, unknown>;
  children: React.ReactNode;
  /** Selected/hover chrome is added by the canvas; render stays presentational. */
  editing?: boolean;
}

export interface ComponentSpec {
  id: string;
  category: ComponentCategory;
  name: string;
  description: string;
  /** lucide icon name (resolved in the library UI). */
  icon: string;
  version: string;
  tags: string[];
  /** Can this component hold children (a layout/container)? */
  container?: boolean;
  defaultProps: Record<string, unknown>;
  props: PropSpec[];
  /** Every platform component is responsive by construction. */
  responsive: true;
  /** Whether the component participates in Motion Studio animation. */
  motion: boolean;
  a11y: { role?: string; label?: string; notes?: string };
  render: (input: RenderInput) => React.ReactNode;
}

export type Breakpoint = 'desktop' | 'laptop' | 'tablet' | 'phone';
export const BREAKPOINTS: Breakpoint[] = ['desktop', 'laptop', 'tablet', 'phone'];

/** One node in the builder tree — an instance of a ComponentSpec. */
export interface BuilderNode {
  id: string;
  specId: string;
  props: Record<string, unknown>;
  children: BuilderNode[];
  /** Per-breakpoint prop overrides (Responsive Overrides). */
  responsive?: Partial<Record<Breakpoint, Record<string, unknown>>>;
  /** If set, this node is an INSTANCE of a saved master component. */
  masterId?: string;
  /** Instance-local overrides layered on top of the master's props. */
  overrides?: Record<string, unknown>;
  /** Accessibility overrides. */
  a11y?: { label?: string; role?: string };
  /** Editor metadata. */
  meta?: { name?: string; hidden?: boolean; locked?: boolean };
  // ── Phase 9B · Application Logic ──
  /** Data bindings: propKey → Binding (resolved against the logic scope at render). */
  bindings?: Record<string, import('./logic/logicTypes').Binding>;
  /** Actions this node owns, keyed per event. */
  actions?: import('./logic/logicTypes').ActionSpec[];
  /** Conditional logic (visibility / enabled) via expressions. */
  conditions?: import('./logic/logicTypes').Condition[];
  /** Form-field validators (form components). */
  validators?: import('./logic/logicTypes').Validator[];
}

/** A saved reusable (master) component: a name + a subtree the instances mirror. */
export interface MasterComponent {
  id: string;
  name: string;
  version: number;
  root: BuilderNode;
  createdAt: number;
}
