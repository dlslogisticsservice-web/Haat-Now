// Guardian · Issue lifecycle, release gate and history.
// These encode the rules that keep the operations record honest:
//   · a finding disappearing is a CLAIM, not proof — verification needs a LATER build
//   · a finding coming back after settlement is a REGRESSION, and it is recorded as one
//   · the gate blocks on operational state, and never re-scores (readiness stays the engine)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reconcile, transition, canTransition, assign, addComment, attachRepair, markRepair,
  slaState, slaBreaches, inferOwner, recurring, isActive, isSettled, SLA_HOURS, type Issue,
} from '../ops/issues';
import { evaluateGate } from '../ops/gate';
import { toBuildRecord, trend, allTrends, architectureStability, releaseQuality, compareBuilds } from '../ops/history';
import type { OpsFinding, GuardianSnapshot } from '../ops/types';

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-01T06:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

const finding = (over: Partial<OpsFinding> = {}): OpsFinding => ({
  id: 'arch.cycle.0', area: 'architecture', severity: 'high', title: 'Cycle',
  rootCause: 'a→b→a', files: ['src/a.ts'], recommendedFix: 'break it', blocker: true, ...over,
});

const open = (findings: OpsFinding[], build = 'b1', now = T0) =>
  reconcile({ findings, existing: [], build, now });

// ── detection → issue ────────────────────────────────────────────────────────
test('a finding becomes a traceable issue stamped with the detecting build', () => {
  const { issues, opened } = open([finding()]);
  assert.equal(opened.length, 1);
  const i = issues[0];
  assert.equal(i.status, 'OPEN');
  assert.equal(i.findingId, 'arch.cycle.0');
  assert.equal(i.detectedBuild, 'b1');
  assert.equal(i.source, 'guardian');
  assert.equal(i.history.length, 1);
  assert.deepEqual({ from: i.history[0].from, to: i.history[0].to }, { from: null, to: 'OPEN' });
  assert.ok(i.evidence.length >= 1, 'detection must leave evidence');
});

test('the same finding twice does not create a second issue', () => {
  const first = open([finding()]);
  const second = reconcile({ findings: [finding()], existing: first.issues, build: 'b2', now: T1 });
  assert.equal(second.issues.length, 1);
  assert.equal(second.opened.length, 0);
  assert.equal(second.persisting.length, 1);
});

test('a human status is not overwritten while the finding is still live', () => {
  const first = open([finding()]);
  const acked = transition(first.issues[0], { to: 'ACKNOWLEDGED', actor: 'hany', now: T1, build: 'b1' });
  const next = reconcile({ findings: [finding({ severity: 'critical' })], existing: [acked], build: 'b2', now: T2 });
  assert.equal(next.issues[0].status, 'ACKNOWLEDGED', 'reconcile must not stomp a human decision');
  assert.equal(next.issues[0].severity, 'critical', 'but derived fields do refresh');
});

// ── verification: a claim is not proof ───────────────────────────────────────
test('a vanished finding is only CLAIMED fixed — never auto-verified in the same build', () => {
  const first = open([finding()]);
  const gone = reconcile({ findings: [], existing: first.issues, build: 'b2', now: T1 });
  assert.equal(gone.issues[0].status, 'WAITING_VERIFICATION');
  assert.equal(gone.verified.length, 0, 'disappearing once must not close an issue');
  assert.equal(gone.claimedFixed.length, 1);
});

test('the claim is upgraded to VERIFIED only by a LATER build that still cannot see it', () => {
  const first = open([finding()]);
  const claimed = reconcile({ findings: [], existing: first.issues, build: 'b2', now: T1 });
  // same build again → still not proof
  const same = reconcile({ findings: [], existing: claimed.issues, build: 'b2', now: T1 });
  assert.equal(same.issues[0].status, 'WAITING_VERIFICATION');
  assert.equal(same.verified.length, 0);
  // a later build → proven
  const later = reconcile({ findings: [], existing: claimed.issues, build: 'b3', now: T2 });
  assert.equal(later.issues[0].status, 'VERIFIED');
  assert.equal(later.issues[0].resolvedBuild, 'b3');
  assert.ok(later.issues[0].verification?.includes('b3'));
  assert.equal(later.verified.length, 1);
});

test('a fix claim that the detector contradicts goes back to IN_PROGRESS', () => {
  const first = open([finding()]);
  const claimed = reconcile({ findings: [], existing: first.issues, build: 'b2', now: T1 });
  const back = reconcile({ findings: [finding()], existing: claimed.issues, build: 'b3', now: T2 });
  assert.equal(back.issues[0].status, 'IN_PROGRESS');
  assert.ok(back.issues[0].history.some(h => /verification failed/.test(h.note || '')));
});

// ── regression ───────────────────────────────────────────────────────────────
test('a finding returning after settlement is REOPENED and counted as a regression', () => {
  const first = open([finding()]);
  const claimed = reconcile({ findings: [], existing: first.issues, build: 'b2', now: T1 });
  const verified = reconcile({ findings: [], existing: claimed.issues, build: 'b3', now: T2 });
  assert.equal(verified.issues[0].status, 'VERIFIED');

  const regressed = reconcile({ findings: [finding()], existing: verified.issues, build: 'b4', now: T2 });
  assert.equal(regressed.issues[0].status, 'REOPENED');
  assert.equal(regressed.regressions.length, 1);
  assert.equal(regressed.issues[0].reopenCount, 1);
  assert.equal(regressed.issues[0].resolvedBuild, undefined, 'a reopened issue is not resolved');
  assert.equal(recurring(regressed.issues).length, 1);
});

test('history is append-only across the whole lifecycle', () => {
  const first = open([finding()]);
  const claimed = reconcile({ findings: [], existing: first.issues, build: 'b2', now: T1 });
  const verified = reconcile({ findings: [], existing: claimed.issues, build: 'b3', now: T2 });
  const regressed = reconcile({ findings: [finding()], existing: verified.issues, build: 'b4', now: T2 });
  const h = regressed.issues[0].history;
  assert.deepEqual(h.map(x => x.to), ['OPEN', 'WAITING_VERIFICATION', 'VERIFIED', 'REOPENED']);
  assert.ok(h.every(x => !!x.at && !!x.actor), 'every transition records when and who');
});

// ── transitions ──────────────────────────────────────────────────────────────
test('illegal transitions are refused and leave no history', () => {
  const i = open([finding()]).issues[0];
  assert.equal(canTransition('OPEN', 'VERIFIED'), false);
  const bad = transition(i, { to: 'VERIFIED', actor: 'hany', now: T1 });
  assert.equal(bad.status, 'OPEN');
  assert.equal(bad.history.length, 1, 'a refused transition must not be recorded as one');
});

test('closing requires passing through verification', () => {
  assert.equal(canTransition('WAITING_VERIFICATION', 'VERIFIED'), true);
  assert.equal(canTransition('VERIFIED', 'CLOSED'), true);
  assert.equal(canTransition('CLOSED', 'REOPENED'), true);
});

test('assigning an open issue also moves it to ASSIGNED and records the owner', () => {
  const i = assign(open([finding()]).issues[0], 'Backend', 'hany', T1, 'b1');
  assert.equal(i.owner, 'Backend');
  assert.equal(i.status, 'ASSIGNED');
  assert.ok(i.history.some(h => /owner → Backend/.test(h.note || '')));
});

test('comments and evidence accumulate without touching status', () => {
  const i = addComment(open([finding()]).issues[0], 'hany', 'looking at it', T1);
  assert.equal(i.comments.length, 1);
  assert.equal(i.status, 'OPEN');
});

test('owner inference is a sensible first guess, always overridable', () => {
  assert.equal(inferOwner(finding({ area: 'architecture' })), 'Architecture');
  assert.equal(inferOwner(finding({ area: 'runtime', files: ['src/services/x.ts'] })), 'Backend');
  assert.equal(inferOwner(finding({ area: 'runtime', files: ['src/features/x.tsx'] })), 'Frontend');
  assert.equal(inferOwner(finding({ area: 'build' })), 'Infrastructure');
});

// ── repair linkage ───────────────────────────────────────────────────────────
test('repair prompts attach to the issue and version on each generation', () => {
  let i = attachRepair(open([finding()]).issues[0], 'prompt v1', T0);
  i = attachRepair(i, 'prompt v2', T1);
  assert.deepEqual(i.repairs.map(r => r.promptVersion), [1, 2]);
  assert.equal(i.repairs[0].applied, false);
  i = markRepair(i, 1, { applied: true, verified: true }, T2);
  assert.equal(i.repairs[0].applied, true);
  assert.equal(i.repairs[0].verified, true);
  assert.equal(i.repairs[1].applied, false, 'marking one version must not touch another');
});

// ── SLA ──────────────────────────────────────────────────────────────────────
test('SLA breaches are detected per severity', () => {
  const base = open([finding({ severity: 'critical' })]).issues[0];
  assert.equal(SLA_HOURS.critical, 4);
  assert.equal(slaState(base, T0).breached, false);
  assert.equal(slaState(base, T1).breached, true, '6h > 4h target');
  assert.equal(slaBreaches([base], T1).length, 1);
});

test('a settled issue cannot breach SLA', () => {
  const i: Issue = { ...open([finding({ severity: 'critical' })]).issues[0], status: 'VERIFIED' };
  assert.equal(slaState(i, T2).breached, false);
});

test('low severity is backlog — it has no target and never breaches', () => {
  const i = open([finding({ severity: 'low' })]).issues[0];
  assert.equal(SLA_HOURS.low, null);
  assert.equal(slaState(i, '2027-01-01T00:00:00.000Z').breached, false);
});

test('isActive / isSettled agree with the lifecycle', () => {
  assert.ok(isActive('OPEN') && isActive('REOPENED') && isActive('IN_PROGRESS'));
  assert.ok(!isActive('VERIFIED') && !isActive('CLOSED'));
  assert.ok(isSettled('VERIFIED') && isSettled('CLOSED'));
  assert.ok(!isSettled('WAITING_VERIFICATION'), 'a claim is not a settlement');
});

// ── release gate ─────────────────────────────────────────────────────────────
const snapshot = (over: Partial<GuardianSnapshot> = {}): GuardianSnapshot => ({
  schema: 1, generatedAt: T0, sha: 'abcdef1234', env: 'test',
  architecture: { files: 1, totalLoc: 1, circular: [], layerViolations: [], duplicates: [], deadCode: [], largeFiles: [], coupling: [] },
  navigation: { routes: [], duplicateRoutes: [], unreachable: [] },
  fingerprint: { composite: 'a', architecture: 'b', dependency: 'c', repository: 'd' },
  drift: { hasBaseline: true, changed: false, architectureChanged: false, dependencyChanged: false, summary: '' },
  suites: [{ suite: 'Unit', cmd: 'c', passed: 10, failed: 0, recorded: true }],
  journeys: [{ role: 'customer', journey: 'j', status: 'passing', evidence: 'e' }],
  inventory: { services: 0, features: 0, routes: 0, apis: 0, events: 0, permissions: 0, integrations: 0, envKeys: 0 },
  ...over,
});

test('a clean build with a proven journey is GO', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: T0 });
  assert.equal(g.verdict, 'GO');
  assert.deepEqual(g.blockers, []);
  assert.ok(g.evaluated.length >= 4, 'every rule is listed so a GO is auditable');
  assert.ok(g.evaluated.every(e => e.passed));
});

test('an open critical issue blocks the release even when the snapshot is clean', () => {
  const iss = open([finding({ severity: 'critical' })]).issues;
  const g = evaluateGate({ findings: [], issues: iss, snapshot: snapshot(), now: T0 });
  assert.equal(g.verdict, 'NO_GO');
  assert.ok(g.blockers.some(b => /critical/i.test(b.rule)));
  assert.deepEqual(g.blockers.find(b => /critical/i.test(b.rule))!.refs, [iss[0].id], 'the blocker names the issue');
});

test('architecture violations block the release', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot({
    architecture: { ...snapshot().architecture, circular: [['src/a.ts', 'src/b.ts']] },
  }), now: T0 });
  assert.equal(g.verdict, 'NO_GO');
  assert.ok(g.blockers.some(b => /architecture/i.test(b.rule)));
});

test('a failing regression suite blocks the release', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot({
    suites: [{ suite: 'Unit', cmd: 'c', passed: 8, failed: 2, recorded: true }],
  }), now: T0 });
  assert.equal(g.verdict, 'NO_GO');
  assert.ok(g.blockers.some(b => /regression/i.test(b.rule)));
});

test('an unverified required journey blocks the release', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot({
    journeys: [{ role: 'customer', journey: 'j', status: 'not-verified', evidence: 'none' }],
  }), now: T0 });
  assert.equal(g.verdict, 'NO_GO');
  assert.ok(g.blockers.some(b => /journeys/i.test(b.rule)));
});

test('every blocker explains itself and names what to look at', () => {
  const g = evaluateGate({ findings: [], issues: open([finding({ severity: 'critical' })]).issues, snapshot: snapshot(), now: T0 });
  for (const b of g.blockers) {
    assert.ok(b.detail.length > 10, `blocker "${b.rule}" must explain itself`);
    assert.ok(Array.isArray(b.refs));
  }
});

test('unknowns warn but do not block — and a missing snapshot is a warning, not health', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: null, now: T0 });
  assert.ok(g.warnings.some(w => /snapshot/i.test(w.rule)));
  assert.ok(g.verdict !== 'GO', 'unknown architecture must not read as GO');
});

test('the gate reuses the readiness engine rather than re-scoring', () => {
  const f = [finding({ severity: 'medium', blocker: false })];
  const g = evaluateGate({ findings: f, issues: [], snapshot: snapshot(), now: T0 });
  assert.equal(g.readiness.score, 96, 'score must come from computeReadiness (100 - 4)');
});

// ── history / trends ─────────────────────────────────────────────────────────
const rec = (build: string, over: Partial<ReturnType<typeof toBuildRecord>> = {}) => ({
  ...toBuildRecord({ snapshot: snapshot({ sha: build + '0000000' }), issues: [], readiness: 90, verdict: 'GO', runtimeErrors: 0, now: T0 }),
  build, ...over,
});

test('a build record captures the shippability of that build', () => {
  const r = toBuildRecord({ snapshot: snapshot(), issues: open([finding({ severity: 'critical' })]).issues, readiness: 70, verdict: 'NO_GO', runtimeErrors: 2, now: T0 });
  assert.equal(r.build, 'abcdef1');
  assert.equal(r.openIssues, 1);
  assert.equal(r.criticalIssues, 1);
  assert.equal(r.regression, 'pass');
  assert.equal(r.runtimeErrors, 2);
  assert.equal(r.journeysPassing, 1);
});

test('regression state is "unknown" when nothing was recorded — never "pass"', () => {
  const r = toBuildRecord({ snapshot: snapshot({ suites: [{ suite: 'Unit', cmd: 'c', passed: 0, failed: 0, recorded: false }] }), issues: [], readiness: 1, verdict: 'x', runtimeErrors: 0, now: T0 });
  assert.equal(r.regression, 'unknown');
});

test('trend direction is literal, but "improving" knows which way is good', () => {
  const rows = [rec('b1', { readiness: 60, openIssues: 10 }), rec('b2', { at: T1, readiness: 80, openIssues: 4 })];
  const readiness = trend(rows, 'readiness');
  assert.equal(readiness.delta, 20);
  assert.equal(readiness.direction, 'up');
  assert.equal(readiness.improving, true);

  const openIssues = trend(rows, 'openIssues');
  assert.equal(openIssues.direction, 'down');
  assert.equal(openIssues.improving, true, 'fewer open issues is an improvement');
});

test('rising open issues is a regression in trend terms', () => {
  const rows = [rec('b1', { openIssues: 1 }), rec('b2', { at: T1, openIssues: 9 })];
  assert.equal(trend(rows, 'openIssues').improving, false);
});

test('all trend series are produced', () => {
  assert.equal(allTrends([rec('b1')]).length, 5);
});

test('architecture stability measures fingerprint churn across builds', () => {
  const rows = [rec('b1', { architectureFingerprint: 'x' }), rec('b2', { at: T1, architectureFingerprint: 'x' }), rec('b3', { at: T2, architectureFingerprint: 'y' })];
  const s = architectureStability(rows);
  assert.equal(s.builds, 3);
  assert.equal(s.changes, 1);
  assert.equal(s.stablePct, 50);
});

test('release quality is the share of shippable builds', () => {
  const q = releaseQuality([rec('b1', { verdict: 'GO' }), rec('b2', { verdict: 'NO_GO' })]);
  assert.equal(q.pct, 50);
});

test('build comparison separates new issues from carried-over ones', () => {
  const first = open([finding()], 'b1', T0);
  const second = reconcile({ findings: [finding(), finding({ id: 'arch.dupe.0', title: 'Dupe' })], existing: first.issues, build: 'b2', now: T1 });
  const d = compareBuilds(second.issues, 'b1', 'b2');
  assert.equal(d.newIssues.length, 1, 'the dupe is new in b2');
  assert.equal(d.newIssues[0].findingId, 'arch.dupe.0');
  assert.ok(d.carriedOver.some(i => i.findingId === 'arch.cycle.0'));
});
