// ─────────────────────────────────────────────────────────────────────────────
// Experience Content persistence — authored overrides for the experience surfaces.
//
// The shipped copy lives in the pure `experience-content/content.ts`. What an operator
// EDITS in the Experience Studio is stored here as an override, through the SAME
// persistence every other platform-state piece uses (adminCrud → a real table when
// live, localStorage in the sandbox). No parallel store.
//
// Both the Studio and the live Customer/Merchant/Driver screens resolve their copy
// through `resolveMergedContent` here, so an edit in the Studio changes the live app —
// the single source of truth the Visual Authoring sprint required. Saving notifies the
// EXISTING experience change bus, so mounted screens re-render with no new event system.
// ─────────────────────────────────────────────────────────────────────────────
import { adminCrud } from './admin-crud.service';
import { notifyExperienceChange } from './experience-platform.service';
import {
  resolveContent, type ExperienceContent, type ExperienceContentOverride,
} from '../experience-content/content';

export interface ExperienceContentRow { id: string; experience_id: string; override: string }

const repo = adminCrud<ExperienceContentRow>('experience_content');
const cache = new Map<string, ExperienceContentOverride>();
let hydrated = false;

/** Load persisted overrides. Safe to call repeatedly; never throws. */
export async function hydrateExperienceContent(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const { data } = await repo.list();
    (data ?? []).forEach(row => {
      if (!row?.experience_id) return;
      try { cache.set(row.experience_id, JSON.parse(row.override)); } catch { /* skip a corrupt row */ }
    });
  } catch { /* storage unavailable — defaults stand */ }
}

/** The raw override for an experience (what was authored), or undefined. */
export const contentOverride = (id: string): ExperienceContentOverride | undefined => cache.get(id);

/** Whether an experience has been edited away from its shipped default. */
export const isContentOverridden = (id: string): boolean => cache.has(id);

/** Every experience id that currently carries an override. */
export const overriddenContentIds = (): string[] => [...cache.keys()];

/**
 * The merged content the runtime should render: shipped default with the operator's
 * override applied. This is the function BOTH the live screens and the Studio call.
 */
export function resolveMergedContent(id: string): ExperienceContent | null {
  return resolveContent(id, cache.get(id) ?? null);
}

/**
 * Author an override. Deep-merges the patch onto any existing override, persists it,
 * updates the in-memory mirror immediately, and rings the shared change bus so mounted
 * live screens re-render with the new copy.
 */
export async function saveExperienceContentOverride(id: string, patch: ExperienceContentOverride): Promise<void> {
  const prev = cache.get(id) ?? {};
  const merged: ExperienceContentOverride = {
    ...prev, ...patch,
    title: { ...(prev.title ?? {}), ...(patch.title ?? {}) },
    body: { ...(prev.body ?? {}), ...(patch.body ?? {}) },
    cta: patch.cta || prev.cta ? { ...(prev.cta ?? {}), ...(patch.cta ?? {}), label: { ...(prev.cta?.label ?? {}), ...(patch.cta?.label ?? {}) } } : undefined,
  };
  // Drop empty sub-objects so a cleared field reverts to the default cleanly.
  if (merged.title && !merged.title.ar && !merged.title.en) delete merged.title;
  if (merged.body && !merged.body.ar && !merged.body.en) delete merged.body;
  cache.set(id, merged);
  notifyExperienceChange();
  try {
    const payload = JSON.stringify(merged);
    const { data } = await repo.list();
    const existing = (data ?? []).find(r => r.experience_id === id);
    if (existing) await repo.update(existing.id, { override: payload } as Partial<ExperienceContentRow>);
    else await repo.create({ experience_id: id, override: payload } as Partial<ExperienceContentRow>);
  } catch { /* the mirror still serves this session */ }
}

/** Revert an experience to its shipped default (remove the override). */
export async function resetExperienceContent(id: string): Promise<void> {
  cache.delete(id);
  notifyExperienceChange();
  try {
    const { data } = await repo.list();
    const existing = (data ?? []).find(r => r.experience_id === id);
    if (existing) await repo.remove(existing.id);
  } catch { /* ignore */ }
}

/** Replace the entire override cache (used by Studio undo/redo snapshot restore). */
export function restoreContentSnapshot(snapshot: Record<string, ExperienceContentOverride>): void {
  cache.clear();
  for (const [id, ov] of Object.entries(snapshot)) cache.set(id, ov);
  notifyExperienceChange();
  // Persist the restored set so the snapshot is durable, not just in-memory.
  void persistAll();
}

/** A snapshot of all current overrides (for the undo/redo history stack). */
export function contentSnapshot(): Record<string, ExperienceContentOverride> {
  return JSON.parse(JSON.stringify(Object.fromEntries(cache)));
}

async function persistAll(): Promise<void> {
  try {
    const { data } = await repo.list();
    const rows = data ?? [];
    // Upsert current cache entries.
    for (const [id, ov] of cache) {
      const existing = rows.find(r => r.experience_id === id);
      const payload = JSON.stringify(ov);
      if (existing) await repo.update(existing.id, { override: payload } as Partial<ExperienceContentRow>);
      else await repo.create({ experience_id: id, override: payload } as Partial<ExperienceContentRow>);
    }
    // Remove rows no longer in the cache (reverted).
    for (const row of rows) if (!cache.has(row.experience_id)) await repo.remove(row.id);
  } catch { /* ignore */ }
}
