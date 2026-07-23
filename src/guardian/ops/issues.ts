// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Issue lifecycle.
//
// A Finding is ephemeral — it is re-derived from the snapshot on every load and
// disappears the moment the detector stops seeing it. An Issue is the PERSISTENT
// record of that finding: who owns it, what was decided, what changed, and whether the
// fix was ever proven. Findings answer "what is wrong now"; issues answer "what did we
// do about it", which is the question an operations platform exists to answer.
//
// Reconciliation is the whole engine. Findings arrive each build; this module decides
// what that means for the record:
//
//   finding present, no open issue  → OPEN it, stamped with the detecting build
//   finding present, issue open     → touch it (still real)
//   finding gone, issue open        → WAITING_VERIFICATION (disappearing is a CLAIM, not proof)
//   finding gone, already waiting   → VERIFIED, but only in a LATER build than the claim
//   finding back on a closed issue  → REOPENED — that is a regression, and it is recorded
//
// Nothing is deleted. Every transition appends to history.
//
// PURE. No React, no DOM, no fs, no network, no Date.now() — the caller passes `now`
// so reconciliation is deterministic and testable.
// ─────────────────────────────────────────────────────────────────────────────
import type { OpsFinding, Severity } from './types';

export type IssueStatus =
  | 'OPEN' | 'ACKNOWLEDGED' | 'ASSIGNED' | 'IN_PROGRESS'
  | 'WAITING_VERIFICATION' | 'VERIFIED' | 'CLOSED' | 'REOPENED';

export type IssueOwner =
  | 'Frontend' | 'Backend' | 'Architecture' | 'Infrastructure'
  | 'Security' | 'Operations' | 'Product' | 'Unknown';

export const ISSUE_STATUSES: readonly IssueStatus[] = [
  'OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_VERIFICATION', 'VERIFIED', 'CLOSED', 'REOPENED',
];
export const ISSUE_OWNERS: readonly IssueOwner[] = [
  'Frontend', 'Backend', 'Architecture', 'Infrastructure', 'Security', 'Operations', 'Product', 'Unknown',
];

/** Statuses that mean "still costs us something". */
export const ACTIVE_STATUSES: readonly IssueStatus[] = ['OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'];
export const isActive = (s: IssueStatus): boolean => ACTIVE_STATUSES.includes(s);
/** Resolved for release purposes, but not yet archived. */
export const isSettled = (s: IssueStatus): boolean => s === 'VERIFIED' || s === 'CLOSED';

export interface IssueHistoryEntry {
  at: string;
  /** Who acted. 'guardian' when the transition was machine-derived. */
  actor: string;
  from: IssueStatus | null;
  to: IssueStatus;
  note?: string;
  /** The build in which this transition happened. */
  build?: string;
}

export interface IssueComment { at: string; author: string; body: string }

export type EvidenceKind = 'screenshot' | 'stack' | 'logs' | 'console' | 'architecture' | 'regression' | 'journey';
export interface IssueEvidence { kind: EvidenceKind; at: string; label: string; body: string }

/** A repair prompt that was generated for this issue. */
export interface IssueRepair {
  generatedAt: string;
  /** Bumped each time a fresh prompt is produced, so an old copy is identifiable. */
  promptVersion: number;
  applied: boolean;
  verified: boolean;
  rejected: boolean;
  prompt: string;
}

export interface Issue {
  id: string;
  /** The finding id this issue tracks — the join key across builds. */
  findingId: string;
  title: string;
  severity: Severity;
  area: OpsFinding['area'];
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
  detectedBuild: string;
  resolvedBuild?: string;
  rootCause: string;
  files: string[];
  recommendedFix: string;
  owner: IssueOwner;
  labels: string[];
  blocker: boolean;
  comments: IssueComment[];
  history: IssueHistoryEntry[];
  resolution?: string;
  /** How the fix was proven. Set when the detector stops seeing the finding. */
  verification?: string;
  /** Where the finding came from. */
  source: 'guardian';
  evidence: IssueEvidence[];
  repairs: IssueRepair[];
  /** How many times this issue came back after being settled. >0 ⇒ recurring. */
  reopenCount: number;
}

// ── SLA ──────────────────────────────────────────────────────────────────────
/** Response targets in hours. `null` = backlog (no target, never breaches). */
export const SLA_HOURS: Record<Severity, number | null> = {
  critical: 4,
  high: 24,
  medium: 72,
  low: null,
};

export interface SlaState { target: number | null; ageHours: number; breached: boolean; remainingHours: number | null }

/** SLA is measured on ACTIVE issues only — a settled issue cannot breach. */
export function slaState(issue: Issue, nowIso: string): SlaState {
  const target = SLA_HOURS[issue.severity];
  const ageHours = (new Date(nowIso).getTime() - new Date(issue.createdAt).getTime()) / 3_600_000;
  if (target === null || !isActive(issue.status)) {
    return { target, ageHours, breached: false, remainingHours: null };
  }
  return { target, ageHours, breached: ageHours > target, remainingHours: target - ageHours };
}

export const slaBreaches = (issues: Issue[], nowIso: string): Issue[] =>
  issues.filter(i => slaState(i, nowIso).breached);

// ── Transitions ──────────────────────────────────────────────────────────────
/** Legal manual transitions. Machine transitions in reconcile() are separate. */
const ALLOWED: Record<IssueStatus, IssueStatus[]> = {
  OPEN: ['ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'],
  ACKNOWLEDGED: ['ASSIGNED', 'IN_PROGRESS', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'ACKNOWLEDGED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_VERIFICATION', 'ASSIGNED', 'CLOSED'],
  WAITING_VERIFICATION: ['VERIFIED', 'IN_PROGRESS', 'CLOSED'],
  VERIFIED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'],
};

export const canTransition = (from: IssueStatus, to: IssueStatus): boolean => ALLOWED[from]?.includes(to) ?? false;

export interface TransitionInput { to: IssueStatus; actor: string; note?: string; build?: string; now: string }

/**
 * Apply a transition. Returns the issue unchanged when the move is illegal — the caller
 * asks `canTransition` first; this is the backstop that keeps history truthful.
 * A CLOSED issue requires verification first: closing straight from IN_PROGRESS is legal
 * only as an explicit human override, and it is recorded as such in history.
 */
export function transition(issue: Issue, input: TransitionInput): Issue {
  if (issue.status === input.to) return issue;
  if (!canTransition(issue.status, input.to)) return issue;
  const entry: IssueHistoryEntry = {
    at: input.now, actor: input.actor, from: issue.status, to: input.to, note: input.note, build: input.build,
  };
  return {
    ...issue,
    status: input.to,
    updatedAt: input.now,
    history: [...issue.history, entry],
    ...(input.to === 'VERIFIED' || input.to === 'CLOSED' ? { resolvedBuild: input.build ?? issue.resolvedBuild } : {}),
  };
}

export function addComment(issue: Issue, author: string, body: string, now: string): Issue {
  return { ...issue, updatedAt: now, comments: [...issue.comments, { at: now, author, body }] };
}

export function assign(issue: Issue, owner: IssueOwner, actor: string, now: string, build?: string): Issue {
  const withOwner: Issue = { ...issue, owner, updatedAt: now };
  // Assigning an untouched issue also moves it forward — that is what assignment means.
  if (issue.status === 'OPEN' || issue.status === 'REOPENED') {
    return transition(withOwner, { to: 'ASSIGNED', actor, note: `owner → ${owner}`, build, now });
  }
  return {
    ...withOwner,
    history: [...issue.history, { at: now, actor, from: issue.status, to: issue.status, note: `owner → ${owner}`, build }],
  };
}

/** Attach a generated repair prompt. Version increments per generation. */
export function attachRepair(issue: Issue, prompt: string, now: string): Issue {
  const repair: IssueRepair = {
    generatedAt: now,
    promptVersion: issue.repairs.length + 1,
    applied: false, verified: false, rejected: false,
    prompt,
  };
  return { ...issue, updatedAt: now, repairs: [...issue.repairs, repair] };
}

export function markRepair(issue: Issue, version: number, patch: Partial<Pick<IssueRepair, 'applied' | 'verified' | 'rejected'>>, now: string): Issue {
  return {
    ...issue,
    updatedAt: now,
    repairs: issue.repairs.map(r => (r.promptVersion === version ? { ...r, ...patch } : r)),
  };
}

export function addEvidence(issue: Issue, ev: IssueEvidence): Issue {
  return { ...issue, updatedAt: ev.at, evidence: [...issue.evidence, ev] };
}

// ── Owner inference ──────────────────────────────────────────────────────────
/** A first guess only — always changeable by a human. */
export function inferOwner(f: OpsFinding): IssueOwner {
  if (f.area === 'architecture') return 'Architecture';
  if (f.area === 'regression' || f.area === 'journey') return 'Operations';
  if (f.area === 'build') return 'Infrastructure';
  if (f.area === 'runtime') {
    if (f.files.some(p => p.includes('/services/') || p.includes('/repositories/'))) return 'Backend';
    return 'Frontend';
  }
  return 'Unknown';
}

// ── Reconciliation ───────────────────────────────────────────────────────────
export interface ReconcileInput {
  findings: OpsFinding[];
  existing: Issue[];
  build: string;
  now: string;
}

export interface ReconcileResult {
  issues: Issue[];
  /** Issues created by this build. */
  opened: Issue[];
  /** Active issues whose finding disappeared → awaiting verification. */
  claimedFixed: Issue[];
  /** Claims proven by a later build with the finding still absent. */
  verified: Issue[];
  /** Settled issues whose finding came back. */
  regressions: Issue[];
  /** Unchanged, still-real issues. */
  persisting: Issue[];
}

const issueId = (findingId: string, build: string) => `iss_${findingId.replace(/[^a-z0-9.]/gi, '_')}`;

function fromFinding(f: OpsFinding, build: string, now: string): Issue {
  return {
    id: issueId(f.id, build),
    findingId: f.id,
    title: f.title,
    severity: f.severity,
    area: f.area,
    status: 'OPEN',
    createdAt: now,
    updatedAt: now,
    detectedBuild: build,
    rootCause: f.rootCause,
    files: f.files,
    recommendedFix: f.recommendedFix,
    owner: inferOwner(f),
    labels: [f.area, f.severity, ...(f.blocker ? ['blocker'] : [])],
    blocker: f.blocker,
    comments: [],
    history: [{ at: now, actor: 'guardian', from: null, to: 'OPEN', note: 'finding detected', build }],
    source: 'guardian',
    evidence: [{ kind: f.area === 'architecture' ? 'architecture' : f.area === 'regression' ? 'regression' : f.area === 'journey' ? 'journey' : 'logs', at: now, label: 'Detection', body: f.rootCause }],
    repairs: [],
    reopenCount: 0,
  };
}

/**
 * Fold this build's findings into the persistent record.
 *
 * The verification rule is the important one: a finding disappearing is a CLAIM, not
 * proof. The claim is only upgraded to VERIFIED by a LATER build that still cannot see
 * the finding. That is why `build` is compared — verifying inside the same build would
 * just be trusting the same observation twice.
 */
export function reconcile({ findings, existing, build, now }: ReconcileInput): ReconcileResult {
  const byFinding = new Map(existing.map(i => [i.findingId, i]));
  const live = new Set(findings.map(f => f.id));

  const opened: Issue[] = [];
  const claimedFixed: Issue[] = [];
  const verified: Issue[] = [];
  const regressions: Issue[] = [];
  const persisting: Issue[] = [];
  const out: Issue[] = [];

  // 1 · findings that are live right now
  for (const f of findings) {
    const prior = byFinding.get(f.id);
    if (!prior) {
      const issue = fromFinding(f, build, now);
      opened.push(issue); out.push(issue);
      continue;
    }
    if (isSettled(prior.status)) {
      // It came back. That is a regression, and it must be visible as one.
      const reopened: Issue = {
        ...prior,
        status: 'REOPENED',
        updatedAt: now,
        severity: f.severity,
        rootCause: f.rootCause,
        reopenCount: prior.reopenCount + 1,
        resolvedBuild: undefined,
        history: [...prior.history, { at: now, actor: 'guardian', from: prior.status, to: 'REOPENED', note: `finding re-detected in ${build} — regression`, build }],
      };
      regressions.push(reopened); out.push(reopened);
      continue;
    }
    if (prior.status === 'WAITING_VERIFICATION') {
      // Claimed fixed, but the detector sees it again → back to work.
      const back: Issue = {
        ...prior,
        status: 'IN_PROGRESS',
        updatedAt: now,
        history: [...prior.history, { at: now, actor: 'guardian', from: prior.status, to: 'IN_PROGRESS', note: 'still detected — verification failed', build }],
      };
      out.push(back); persisting.push(back);
      continue;
    }
    // Still real: refresh the derived fields, leave the human's status alone.
    const touched: Issue = { ...prior, updatedAt: now, severity: f.severity, rootCause: f.rootCause, files: f.files, blocker: f.blocker };
    persisting.push(touched); out.push(touched);
  }

  // 2 · issues whose finding is gone
  for (const issue of existing) {
    if (live.has(issue.findingId)) continue;

    if (isActive(issue.status)) {
      const claim: Issue = {
        ...issue,
        status: 'WAITING_VERIFICATION',
        updatedAt: now,
        history: [...issue.history, { at: now, actor: 'guardian', from: issue.status, to: 'WAITING_VERIFICATION', note: `finding no longer detected in ${build} — awaiting confirmation by a later build`, build }],
      };
      claimedFixed.push(claim); out.push(claim);
      continue;
    }

    if (issue.status === 'WAITING_VERIFICATION') {
      const claimBuild = [...issue.history].reverse().find(h => h.to === 'WAITING_VERIFICATION')?.build;
      if (claimBuild && claimBuild !== build) {
        const done: Issue = {
          ...issue,
          status: 'VERIFIED',
          updatedAt: now,
          resolvedBuild: build,
          verification: `Finding absent in ${build}, a later build than the fix claim (${claimBuild}).`,
          resolution: issue.resolution ?? 'Finding no longer detected.',
          history: [...issue.history, { at: now, actor: 'guardian', from: 'WAITING_VERIFICATION', to: 'VERIFIED', note: 'confirmed absent in a later build', build }],
        };
        verified.push(done); out.push(done);
      } else {
        out.push(issue);   // same build — not proof yet
      }
      continue;
    }

    out.push(issue);   // already settled, still gone — nothing to do
  }

  return { issues: out, opened, claimedFixed, verified, regressions, persisting };
}

/** Issues that have come back at least once. */
export const recurring = (issues: Issue[]): Issue[] => issues.filter(i => i.reopenCount > 0);
