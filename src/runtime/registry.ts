// ─────────────────────────────────────────────────────────────────────────────
// Runtime Registry — the single seam between the Studio and the applications.
//
// The Studio imports ONLY this module (and the interfaces). It never imports
// `features/<app>`. Each app registers a thin adapter (see runtime/adapters/*) at
// startup; the adapter lazy-loads the app's screens. This is what lets the Studio edit
// every application without an import cycle: the registry has no static edge to any app.
//
// PURE: a Map + three functions. No React, no services, no feature imports.
// ─────────────────────────────────────────────────────────────────────────────
import type { RuntimeAdapter, RuntimeId } from './RuntimeAdapter';

const adapters = new Map<RuntimeId, RuntimeAdapter>();

/** An app (or its adapter module) registers its runtime here. Idempotent by id. */
export function registerRuntime(adapter: RuntimeAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getRuntime(id: RuntimeId): RuntimeAdapter | undefined {
  return adapters.get(id);
}

export function listRuntimes(): RuntimeAdapter[] {
  return [...adapters.values()];
}

export function hasRuntime(id: RuntimeId): boolean {
  return adapters.has(id);
}
