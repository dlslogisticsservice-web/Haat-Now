// ─────────────────────────────────────────────────────────────────────────────
// Studio Metadata — the contract every Studio-editable component exposes.
//
// The Studio reads DECLARED metadata, never React internals. This matters because React
// 19 removed `_debugSource`, so there is no reliable runtime way to recover a component's
// source file, props, or bindings from the fiber tree. Instead, each editable surface
// declares its metadata; the Studio inspector renders from these declarations.
//
// This file is PURE TYPES — no React, no services, no feature imports. It is the stable
// vocabulary the Runtime Adapters (see RuntimeAdapter.ts) speak.
// ─────────────────────────────────────────────────────────────────────────────

export type PropType =
  | 'text' | 'richtext' | 'number' | 'boolean'
  | 'color' | 'image' | 'icon' | 'select' | 'spacing' | 'enum';

/** Where an editable value is read from / written to. The Studio uses this to bind. */
export interface BindingRef {
  source: 'content' | 'theme' | 'data' | 'i18n' | 'static';
  /** Dotted path within the source, e.g. 'flag.customer_offers.title' or 'theme.primary'. */
  path: string;
  /** True when the binding is read-only in the Studio (e.g. a live data value). */
  readonly?: boolean;
}

export interface ValidationSpec {
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: string;
}

export interface EditablePropSpec {
  key: string;
  label: { ar: string; en: string };
  type: PropType;
  /** Options for select/enum props. */
  options?: { value: string; label: { ar: string; en: string } }[];
  binding?: BindingRef;
  validation?: ValidationSpec;
}

export interface EventSpec {
  name: string;
  label: { ar: string; en: string };
}

/** The metadata one editable component declares to the Studio. */
export interface StudioComponentMetadata {
  /** Stable id — survives refactors; the Studio addresses components by this, not by file. */
  id: string;
  displayName: { ar: string; en: string };
  /** Informational only (human hint); never used for editing logic. */
  reactName?: string;
  editableProps: EditablePropSpec[];
  bindings: BindingRef[];
  events: EventSpec[];
  /** CSS custom properties this component consumes (drives the Theme editor). */
  themeTokens: string[];
  /** Named animations this component can play. */
  animations: string[];
  validation?: ValidationSpec;
  /** Child component ids (the component tree, declared not inferred). */
  children?: string[];
}
