// ─────────────────────────────────────────────────────────────────────────────
// Component Registry (Phase 9A).
//
// The single source of truth for every platform component — the same registry pattern as the
// Runtime Registry. Components self-register (side-effect import of components.tsx); the builder
// and any future screen resolve them by id. No component is imported directly by a surface.
// ─────────────────────────────────────────────────────────────────────────────
import type { ComponentSpec, ComponentCategory } from './types';
import { CATEGORIES } from './types';

const REGISTRY = new Map<string, ComponentSpec>();

/** Register a component. Idempotent by id (last registration wins — supports HMR). */
export function registerComponent(spec: ComponentSpec): void { REGISTRY.set(spec.id, spec); }

export function getComponent(id: string): ComponentSpec | undefined { return REGISTRY.get(id); }
export function listComponents(): ComponentSpec[] { return [...REGISTRY.values()]; }

/** category → its components, in registration order, only non-empty categories. */
export function componentsByCategory(): { category: ComponentCategory; items: ComponentSpec[] }[] {
  return CATEGORIES.map(category => ({ category, items: listComponents().filter(c => c.category === category) }))
    .filter(g => g.items.length > 0);
}

/** Full-text search over name / description / tags / category. */
export function searchComponents(query: string): ComponentSpec[] {
  const q = query.trim().toLowerCase();
  if (!q) return listComponents();
  return listComponents().filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.description.toLowerCase().includes(q) ||
    c.category.toLowerCase().includes(q) ||
    c.tags.some(t => t.toLowerCase().includes(q)));
}
