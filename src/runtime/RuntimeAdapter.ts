// ─────────────────────────────────────────────────────────────────────────────
// Runtime Adapter — the ONE interface every application (Customer, Merchant, Driver,
// Website, and future channels) implements so the Studio can edit it WITHOUT importing
// the application's implementation.
//
// The cycle-elimination principle lives here: `RuntimeScreen.load` is a LAZY factory
// (`() => import(...)`). A dynamic import does not create a static edge in the module
// graph, so the Studio can reach any app's screens through an adapter while the Studio's
// STATIC dependency graph stays free of `features/<app>` — no admin↔merchant↔driver cycle.
//
// PURE TYPES + a registry (registry.ts). No React, no services, no feature imports.
// ─────────────────────────────────────────────────────────────────────────────
import type { ComponentType } from 'react';
import type { StudioComponentMetadata } from './StudioMetadata';

export type RuntimeId = 'customer' | 'merchant' | 'driver' | 'website' | (string & {});

/** The environment a screen mounts in — supplied by the Studio, consumed by the adapter. */
export interface RuntimeContext {
  identity: { id: string; role: string } | null;
  locale: 'ar' | 'en';
  country: string;
  /** True in sandbox mode; adapters must not mount seeded preview identities in production. */
  sandbox: boolean;
}

/** Props every runtime screen component receives. Adapters wrap real screens to this shape. */
export interface RuntimeScreenProps {
  ctx: RuntimeContext;
}

export interface RuntimeScreen {
  id: string;
  label: { ar: string; en: string };
  /**
   * Lazy loader — dynamic import keeps the app implementation OUT of the Studio's static
   * graph. Returns a component that accepts RuntimeScreenProps (the adapter is responsible
   * for wrapping the real screen's native props to `ctx`).
   */
  load: () => Promise<ComponentType<RuntimeScreenProps>>;
  /** Declared editable components on this screen (Studio reads these, not React internals). */
  metadata?: StudioComponentMetadata[];
  /** Context keys the screen needs; if unmet, the Studio shows a canvas fallback, never a fake. */
  requires?: (keyof RuntimeContext | string)[];
}

export interface RuntimeAdapter {
  id: RuntimeId;
  label: { ar: string; en: string };
  form: 'mobile' | 'desktop';
  screens: RuntimeScreen[];
  /** CSS custom properties the app theme exposes (drives the Studio Theme editor). */
  themeTokens: string[];
  getScreen(id: string): RuntimeScreen | undefined;
}

/** Convenience base for authoring adapters (screens array + derived getScreen). */
export function defineRuntime(a: Omit<RuntimeAdapter, 'getScreen'>): RuntimeAdapter {
  return { ...a, getScreen: (id: string) => a.screens.find(s => s.id === id) };
}
