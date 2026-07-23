// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Launch Readiness — one score, and the blockers behind it.
//
// The score is DERIVED from findings, never asserted. Two rules keep it honest:
//
//   1. Any blocker caps the score below GO. A green number with a red blocker
//      underneath it is how launch checklists lie.
//   2. Unknown ≠ healthy. A suite that never ran, or a missing snapshot, costs
//      points — it does not silently score full marks.
//
// PURE. No React, no DOM, no fs.
// ─────────────────────────────────────────────────────────────────────────────
import type { OpsFinding, Severity } from './types';

export interface ReadinessBlocker { id: string; title: string; area: OpsFinding['area']; why: string }

export interface Readiness {
  /** 0–100. */
  score: number;
  verdict: 'go' | 'go-with-risk' | 'no-go';
  blockers: ReadinessBlocker[];
  counts: Record<Severity, number>;
  /** Every deduction, so the number can be audited rather than trusted. */
  breakdown: { reason: string; cost: number }[];
}

/** What each severity costs. Blockers are handled separately — they cap, not subtract. */
const COST: Record<Severity, number> = { critical: 25, high: 10, medium: 4, low: 1 };

/** Highest score a build with any blocker may report. */
const BLOCKED_CEILING = 59;

export function computeReadiness(findings: OpsFinding[]): Readiness {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const breakdown: { reason: string; cost: number }[] = [];

  let score = 100;
  for (const f of findings) {
    counts[f.severity]++;
    const cost = COST[f.severity];
    score -= cost;
    breakdown.push({ reason: `${f.severity}: ${f.title}`, cost });
  }
  score = Math.max(0, score);

  const blockers = findings.filter(f => f.blocker).map(f => ({ id: f.id, title: f.title, area: f.area, why: f.rootCause }));

  // A blocker cannot be out-scored by everything else being fine.
  if (blockers.length && score > BLOCKED_CEILING) {
    breakdown.push({ reason: `capped: ${blockers.length} launch blocker(s) present`, cost: score - BLOCKED_CEILING });
    score = BLOCKED_CEILING;
  }

  const verdict: Readiness['verdict'] = blockers.length ? 'no-go' : score >= 90 ? 'go' : 'go-with-risk';
  return { score, verdict, blockers, counts, breakdown };
}
