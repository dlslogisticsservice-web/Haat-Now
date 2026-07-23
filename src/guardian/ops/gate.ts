// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Release Gate.
//
// The gate answers a different question from the readiness score. Readiness asks "what
// does the code look like right now"; the gate asks "may we ship it", which also depends
// on the OPERATIONAL record — an open critical issue blocks a release even if this
// build's snapshot happens to look clean.
//
// It does NOT re-score anything. computeReadiness (readiness.ts) stays the only scoring
// engine; the gate consumes its output and adds the issue-state rules on top.
//
// PURE. No React, no DOM, no fs.
// ─────────────────────────────────────────────────────────────────────────────
import type { GuardianSnapshot, OpsFinding } from './types';
import type { Readiness } from './readiness';
import { computeReadiness } from './readiness';
import type { Issue } from './issues';
import { isActive, slaBreaches } from './issues';

export type GateVerdict = 'GO' | 'GO_WITH_RISK' | 'NO_GO';

export interface GateBlocker {
  rule: string;
  detail: string;
  /** Issue ids / route paths / suite names — whatever the operator must go look at. */
  refs: string[];
}

export interface ReleaseGate {
  verdict: GateVerdict;
  /** Straight from the existing readiness engine — not recomputed here. */
  readiness: Readiness;
  blockers: GateBlocker[];
  warnings: GateBlocker[];
  /** Every rule evaluated, passing or not — so a GO is auditable, not just asserted. */
  evaluated: { rule: string; passed: boolean; detail: string }[];
}

export interface GateInput {
  findings: OpsFinding[];
  issues: Issue[];
  snapshot: GuardianSnapshot | null;
  now: string;
  /** Journeys that must be proven before a release. */
  requiredJourneys?: string[];
  /** Authentication readiness. When present, its own gate rule is evaluated. */
  auth?: { ready: boolean; detail: string; requires?: string[] };
  /** Location readiness (device coordinate source). When present, its rule is evaluated. */
  location?: { ready: boolean; detail: string; requires?: string[] };
  /** Notification readiness (the in-app channel at minimum). When present, its rule runs. */
  notification?: { ready: boolean; detail: string; requires?: string[] };
  /** Payment readiness (at least one working method — COD at minimum). When present, its rule runs. */
  payment?: { ready: boolean; detail: string; requires?: string[] };
  /** Email readiness (templates render; vendor absence is an enhancement gap, not a block). */
  email?: { ready: boolean; detail: string; requires?: string[] };
}

const DEFAULT_REQUIRED_JOURNEYS = ['customer'];

/**
 * Deployment is blocked when any of these hold. Each rule explains itself — a gate that
 * says NO-GO without naming the reason just gets overridden.
 */
export function evaluateGate({ findings, issues, snapshot, now, requiredJourneys = DEFAULT_REQUIRED_JOURNEYS, auth, location, notification, payment, email }: GateInput): ReleaseGate {
  const readiness = computeReadiness(findings);
  const blockers: GateBlocker[] = [];
  const warnings: GateBlocker[] = [];
  const evaluated: { rule: string; passed: boolean; detail: string }[] = [];

  const rule = (name: string, failed: boolean, detail: string, refs: string[], warnOnly = false) => {
    evaluated.push({ rule: name, passed: !failed, detail });
    if (!failed) return;
    (warnOnly ? warnings : blockers).push({ rule: name, detail, refs });
  };

  // 1 · open critical issues
  const openCritical = issues.filter(i => isActive(i.status) && i.severity === 'critical');
  rule('No open critical issues', openCritical.length > 0,
    openCritical.length ? `${openCritical.length} critical issue(s) still active.` : 'No critical issue is active.',
    openCritical.map(i => i.id));

  // 2 · architecture violations
  const cycles = snapshot?.architecture.circular.length ?? 0;
  const violations = snapshot?.architecture.layerViolations.length ?? 0;
  rule('No architecture violations', cycles + violations > 0,
    snapshot ? `${cycles} circular dependency(ies), ${violations} layer violation(s).` : 'Unknown — no snapshot.',
    [...(snapshot?.architecture.circular.flat() ?? []), ...(snapshot?.architecture.layerViolations.map(v => v.from) ?? [])]);

  // 3 · regression suites
  const failing = (snapshot?.suites ?? []).filter(s => s.recorded && s.failed > 0);
  rule('Regression suites pass', failing.length > 0,
    failing.length ? `${failing.map(s => `${s.suite} (${s.failed} failing)`).join(', ')}` : 'No recorded suite is failing.',
    failing.map(s => s.suite));

  // 4 · required journeys proven
  const journeys = snapshot?.journeys ?? [];
  const unproven = requiredJourneys.filter(role => journeys.find(j => j.role === role)?.status !== 'passing');
  rule('Required journeys verified', unproven.length > 0,
    unproven.length ? `Not proven: ${unproven.join(', ')}. An unverified journey is not a passing one.` : `Proven: ${requiredJourneys.join(', ')}.`,
    unproven);

  // 5 · authentication ready (only when the caller supplies auth state)
  if (auth) {
    rule('Authentication ready', !auth.ready, auth.detail, auth.ready ? [] : (auth.requires ?? ['VITE_SMS_PROVIDER']));
  }

  // 6 · location ready — the device coordinate source, which driver tracking depends on.
  //     (Maps/geocoding is an enhancement surfaced as a finding, not a gate blocker.)
  if (location) {
    rule('Location ready', !location.ready, location.detail, location.ready ? [] : (location.requires ?? []));
  }

  // 7 · notification ready — the in-app channel must work. (Device push is an enhancement
  //     surfaced as a finding, not a gate blocker: in-app still reaches every user.)
  if (notification) {
    rule('Notification ready', !notification.ready, notification.detail, notification.ready ? [] : (notification.requires ?? []));
  }

  // 8 · payment ready — at least one working method. COD is the launch method, so this
  //     passes on COD alone; a missing card gateway is a finding, not a gate blocker.
  if (payment) {
    rule('Payment ready', !payment.ready, payment.detail, payment.ready ? [] : (payment.requires ?? []));
  }

  // 9 · email ready — templates render. A missing email vendor is an enhancement gap
  //     (in-app/SMS still reach users), so readiness turns on templates, not the vendor.
  if (email) {
    rule('Email ready', !email.ready, email.detail, email.ready ? [] : (email.requires ?? []));
  }

  // ── warnings: real, but not ship-blocking ──
  const breaches = slaBreaches(issues, now);
  rule('No SLA breaches', breaches.length > 0,
    breaches.length ? `${breaches.length} issue(s) past their response target.` : 'All active issues are within SLA.',
    breaches.map(i => i.id), true);

  const unrecorded = (snapshot?.suites ?? []).filter(s => !s.recorded);
  rule('All suites recorded', unrecorded.length > 0,
    unrecorded.length ? `${unrecorded.map(s => s.suite).join(', ')} never ran — state unknown, which is not a pass.` : 'Every suite has a recorded result.',
    unrecorded.map(s => s.suite), true);

  rule('Architecture snapshot published', !snapshot,
    snapshot ? `Snapshot from ${snapshot.generatedAt}.` : 'No snapshot — architecture state is unknown.',
    [], true);

  const verdict: GateVerdict = blockers.length ? 'NO_GO' : warnings.length ? 'GO_WITH_RISK' : 'GO';
  return { verdict, readiness, blockers, warnings, evaluated };
}
