// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Build history, trends and build-to-build comparison.
//
// A snapshot describes one moment. History is what makes it operational: whether
// readiness is improving, whether the same defect keeps coming back, and what actually
// changed between two builds. Each build contributes ONE compact record — the full
// snapshot is not archived, because history must stay cheap enough to keep forever.
//
// PURE. No React, no DOM, no fs, no clock.
// ─────────────────────────────────────────────────────────────────────────────
import type { GuardianSnapshot, Severity } from './types';
import type { Issue } from './issues';
import { isActive } from './issues';

/** One row per build. Small on purpose — this table is append-only and permanent. */
export interface BuildRecord {
  id: string;
  /** Short sha — the human-facing build identity. */
  build: string;
  commit: string;
  at: string;
  readiness: number;
  verdict: string;
  openIssues: number;
  criticalIssues: number;
  /** 'pass' | 'fail' | 'unknown' — regression state at that build. */
  regression: 'pass' | 'fail' | 'unknown';
  architectureFingerprint: string;
  runtimeErrors: number;
  journeysPassing: number;
  journeysTotal: number;
}

export interface BuildRecordInput {
  snapshot: GuardianSnapshot;
  issues: Issue[];
  readiness: number;
  verdict: string;
  runtimeErrors: number;
  now: string;
}

export function toBuildRecord({ snapshot, issues, readiness, verdict, runtimeErrors, now }: BuildRecordInput): BuildRecord {
  const recorded = snapshot.suites.filter(s => s.recorded);
  const regression: BuildRecord['regression'] =
    recorded.length === 0 ? 'unknown' : recorded.some(s => s.failed > 0) ? 'fail' : 'pass';
  return {
    id: `bld_${snapshot.sha.slice(0, 12)}`,
    build: snapshot.sha.slice(0, 7),
    commit: snapshot.sha,
    at: now,
    readiness,
    verdict,
    openIssues: issues.filter(i => isActive(i.status)).length,
    criticalIssues: issues.filter(i => isActive(i.status) && i.severity === 'critical').length,
    regression,
    architectureFingerprint: snapshot.fingerprint.architecture,
    runtimeErrors,
    journeysPassing: snapshot.journeys.filter(j => j.status === 'passing').length,
    journeysTotal: snapshot.journeys.length,
  };
}

/** Newest last — charts read left→right. */
export const sortHistory = (rows: BuildRecord[]): BuildRecord[] =>
  [...rows].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

export type TrendKey = 'readiness' | 'openIssues' | 'criticalIssues' | 'runtimeErrors' | 'journeysPassing';

export interface TrendSeries {
  key: TrendKey;
  points: { build: string; at: string; value: number }[];
  first: number;
  last: number;
  delta: number;
  /** 'up' is literal direction, not goodness — see `improving`. */
  direction: 'up' | 'down' | 'flat';
  /** True when the movement is the direction we WANT for this metric. */
  improving: boolean;
}

/** For these, a rising number is worse. */
const LOWER_IS_BETTER: TrendKey[] = ['openIssues', 'criticalIssues', 'runtimeErrors'];

export function trend(rows: BuildRecord[], key: TrendKey): TrendSeries {
  const sorted = sortHistory(rows);
  const points = sorted.map(r => ({ build: r.build, at: r.at, value: Number(r[key] ?? 0) }));
  const first = points.length ? points[0].value : 0;
  const last = points.length ? points[points.length - 1].value : 0;
  const delta = last - first;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const improving = delta === 0 ? true : LOWER_IS_BETTER.includes(key) ? delta < 0 : delta > 0;
  return { key, points, first, last, delta, direction, improving };
}

export const allTrends = (rows: BuildRecord[]): TrendSeries[] =>
  (['readiness', 'openIssues', 'criticalIssues', 'runtimeErrors', 'journeysPassing'] as TrendKey[]).map(k => trend(rows, k));

/** Architecture stability: share of builds whose architecture fingerprint matched the one before. */
export function architectureStability(rows: BuildRecord[]): { builds: number; changes: number; stablePct: number } {
  const sorted = sortHistory(rows);
  if (sorted.length < 2) return { builds: sorted.length, changes: 0, stablePct: 100 };
  let changes = 0;
  for (let i = 1; i < sorted.length; i++) if (sorted[i].architectureFingerprint !== sorted[i - 1].architectureFingerprint) changes++;
  const transitions = sorted.length - 1;
  return { builds: sorted.length, changes, stablePct: Math.round(((transitions - changes) / transitions) * 100) };
}

/** Release quality: share of recorded builds that were shippable. */
export function releaseQuality(rows: BuildRecord[]): { builds: number; go: number; pct: number } {
  const go = rows.filter(r => r.verdict === 'GO').length;
  return { builds: rows.length, go, pct: rows.length ? Math.round((go / rows.length) * 100) : 0 };
}

// ── build-to-build comparison ────────────────────────────────────────────────
export interface IssueDelta {
  /** Present now, absent in the baseline build. */
  newIssues: Issue[];
  /** Settled since the baseline. */
  resolved: Issue[];
  /** Settled at the baseline, active again now — the ones that matter most. */
  regressions: Issue[];
  /** Have been reopened at least once, ever. */
  recurring: Issue[];
  /** Active in both builds. */
  carriedOver: Issue[];
}

/**
 * Compare the issue record between two builds using each issue's own history, so the
 * answer is derived from what was recorded rather than from a second stored copy.
 */
export function compareBuilds(issues: Issue[], baselineBuild: string, currentBuild: string): IssueDelta {
  const statusAt = (issue: Issue, build: string): 'active' | 'settled' | 'absent' => {
    if (issue.detectedBuild === build) return 'active';
    const upTo = issue.history.filter(h => h.build === build);
    if (upTo.length) {
      const last = upTo[upTo.length - 1].to;
      return isActive(last) ? 'active' : 'settled';
    }
    // No transition in that build: it existed if it was detected earlier.
    const detectedBefore = issue.history.some(h => h.build && h.build !== currentBuild);
    return detectedBefore ? (isActive(issue.status) ? 'active' : 'settled') : 'absent';
  };

  const newIssues: Issue[] = [];
  const resolved: Issue[] = [];
  const regressions: Issue[] = [];
  const carriedOver: Issue[] = [];

  for (const i of issues) {
    const was = statusAt(i, baselineBuild);
    const now = isActive(i.status) ? 'active' : 'settled';
    if (i.detectedBuild === currentBuild) { newIssues.push(i); continue; }
    if (was === 'active' && now === 'settled') { resolved.push(i); continue; }
    if (was === 'settled' && now === 'active') { regressions.push(i); continue; }
    if (was === 'active' && now === 'active') carriedOver.push(i);
  }

  return { newIssues, resolved, regressions, recurring: issues.filter(i => i.reopenCount > 0), carriedOver };
}

export const countBySeverity = (issues: Issue[]): Record<Severity, number> => {
  const out: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const i of issues) out[i.severity]++;
  return out;
};
