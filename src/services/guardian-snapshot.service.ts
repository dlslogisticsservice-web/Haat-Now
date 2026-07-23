// ─────────────────────────────────────────────────────────────────────────────
// Guardian snapshot reader — the ops workspace's window onto build-time analysis.
//
// The browser cannot analyze the repository (no filesystem, and the node reader is kept
// out of the bundle on purpose). scripts/gen-guardian-snapshot.ts runs the SAME
// DiscoveryEngine at build time and emits dist/guardian-snapshot.json; this service just
// fetches it. No analysis happens here — there is exactly one analyzer in this codebase.
//
// A missing/stale/unknown-schema snapshot resolves to `null`. The workspace then reports
// "unknown", which is the truth — it must never imply health it has not measured.
// ─────────────────────────────────────────────────────────────────────────────
import type { GuardianSnapshot } from '../guardian/ops/types';
import { SNAPSHOT_SCHEMA, SNAPSHOT_URL } from '../guardian/ops/types';

export interface SnapshotState {
  snapshot: GuardianSnapshot | null;
  /** Why there is no snapshot — shown verbatim to the operator. */
  reason?: string;
  /** Build age in ms at read time, when the snapshot carries a timestamp. */
  ageMs?: number;
}

let cache: SnapshotState | null = null;

export const guardianSnapshotService = {
  /** Fetch (and cache) the snapshot. `force` re-reads it. */
  async load(force = false): Promise<SnapshotState> {
    if (cache && !force) return cache;
    try {
      const res = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        cache = { snapshot: null, reason: `snapshot not published (HTTP ${res.status}) — run \`npm run build\`` };
        return cache;
      }
      const json = (await res.json()) as GuardianSnapshot;
      if (json?.schema !== SNAPSHOT_SCHEMA) {
        cache = { snapshot: null, reason: `snapshot schema ${json?.schema ?? '?'} is not readable by this build (expects ${SNAPSHOT_SCHEMA}) — rebuild` };
        return cache;
      }
      const ageMs = json.generatedAt ? Date.now() - new Date(json.generatedAt).getTime() : undefined;
      cache = { snapshot: json, ageMs };
      return cache;
    } catch (e) {
      cache = { snapshot: null, reason: `snapshot unreadable: ${e instanceof Error ? e.message : String(e)}` };
      return cache;
    }
  },

  /** Drop the cache (used by the workspace's Refresh). */
  invalidate(): void { cache = null; },
};
