# Advanced Visual Builder

> HaaT Now · Phase 10.5 · Design only (Part 8). **Extends** the Phase 10 `VISUAL_BUILDER_SPEC`
> (schema-driven blocks, inspector, drag-and-drop reorder RPC, global/reusable sections, live
> preview, revisions). This adds the professional editing layer (breakpoints, animation timeline,
> interactions, variants, constraints) without changing the block contract or rendering pipeline.

## 1. What stays the same (do not rebuild)
- The block model `{type, props, position, visibility, enabled}` + component registry + schema-driven
  inspector + one renderer for edit & published (Phase 10). All additions below are **editor-side**
  and compile into the same block props / snapshot — the runtime contract is unchanged.

## 2. Additions (Part 8)

| Feature | Design |
|---|---|
| **Drag & Drop** | already present; extend to cross-section + tree-outline drag; persisted via the transactional reorder RPC |
| **Snap Grid** | configurable grid + guides; positions snap; layout stored as responsive grid props |
| **Responsive Editing** | edit per breakpoint; per-device prop overrides (extends the existing `visibility`) |
| **Breakpoints** | named breakpoints per theme (mobile/tablet/desktop/wide); overrides cascade mobile-first |
| **Animations** | motion presets (fade/slide/scale/parallax) per block; respects `prefers-reduced-motion` (Theme Engine motion tokens) |
| **Timeline** | a scroll/enter timeline editor: keyframes per element (opacity/transform) compiled to CSS/Web-Animations; no heavy JS |
| **Interaction Builder** | trigger→action (on click/hover/scroll/in-view → show/hide/scrollTo/open form/emit event) using the **Low-Code** action grammar |
| **Component Inspector** | schema-driven props + style + animation + interaction + personalization bindings, all in one panel |
| **Constraints** | pin/stretch/center within a container (Figma-style) → responsive layout props |
| **Reusable Components** | save a configured block as a reusable component (tenant library) |
| **Global Components** | edit-once-update-everywhere (Phase 10 global sections, generalized to any block) |
| **Component Variants** | a component can define variants (e.g. Button: primary/ghost); switch via inspector or personalization |
| **Live Preview** | already present; add multi-breakpoint side-by-side + shareable preview link (Publishing Engine preview) |
| **Undo / Redo** | backed by the Phase 10 revision stack; grouped transactions |
| **Keyboard Shortcuts** | full shortcut map (copy/paste/duplicate/delete/move/wrap/group/nudge) |

## 3. Data model deltas (additive)
- `website_blocks.props` gains optional `responsive` (per-breakpoint overrides), `animation`,
  `interactions`, `variant`, `personalization` sub-objects — all **optional**, schema-versioned, and
  ignored by older renderers (forward-compatible; the Phase 10 component-version migration handles
  upgrades).
- `website_components` (tenant reusable components) reuses `website_templates` with `scope='section'`
  or a new `component` scope; global components are references, not copies.

## 4. Rendering & performance guardrails
- Animations compile to CSS/Web-Animations (island-hydrated only where interactive) → static blocks
  still ship zero JS (Phase 10 performance targets preserved).
- Interactions are declarative (Low-Code actions), so the published bundle stays small and CSP-safe
  (no arbitrary inline JS unless the gated Custom Code flag is on).
- Timeline/animation respect reduced-motion and never block LCP.

## 5. Collaboration (enterprise editing)
- **Presence + soft-lock**: show who is editing; last-writer conflict warning via `updated_at`
  (Phase 10). Real-time co-editing (CRDT) is a **later** enhancement — flagged, not required for v1.
- Comments/annotations on blocks (review workflow); tie into the Workflow Engine's review stage.

## 6. Integration with strict concerns
- Multi-tenant (component/variant libraries are tenant-scoped, RLS); RBAC (`website.edit`,
  `website.components.manage`); localized (per-locale prop overrides via Localization); animations/
  interactions are theme-token-driven; audited via revisions; flag-gated advanced features
  (timeline, interactions, custom code). Preview == production remains guaranteed (one renderer).
