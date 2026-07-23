// Guardian · Operations Workspace — the pure engines behind the score and the repair
// packets. These decide what a human is told about production, so the rules that keep
// them honest (a blocker caps the score; unknown is never a pass) are pinned here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeReadiness } from '../ops/readiness';
import { buildRepairPacket, buildRepairPackets } from '../ops/repair';
import { regressionFindings, journeyFindings, architectureFindings, bySeverity } from '../ops/findings';
import type { OpsFinding, GuardianSnapshot, SuiteResult, JourneyResult } from '../ops/types';

const finding = (over: Partial<OpsFinding> = {}): OpsFinding => ({
  id: 'x', area: 'architecture', severity: 'low', title: 't',
  rootCause: 'c', files: [], recommendedFix: 'f', blocker: false, ...over,
});

// ── readiness ────────────────────────────────────────────────────────────────
test('a clean build scores 100 and is GO', () => {
  const r = computeReadiness([]);
  assert.equal(r.score, 100);
  assert.equal(r.verdict, 'go');
  assert.deepEqual(r.blockers, []);
});

test('severity costs are deducted and itemised so the score can be audited', () => {
  const r = computeReadiness([finding({ severity: 'high' }), finding({ id: 'y', severity: 'low' })]);
  assert.equal(r.score, 100 - 10 - 1);
  assert.equal(r.breakdown.length, 2);
  assert.equal(r.counts.high, 1);
  assert.equal(r.counts.low, 1);
});

test('ANY blocker caps the score below GO — a green number can never hide a red blocker', () => {
  // One trivial blocker: without the cap this would score 99 and read as launch-ready.
  const r = computeReadiness([finding({ severity: 'low', blocker: true })]);
  assert.ok(r.score <= 59, `expected capped score, got ${r.score}`);
  assert.equal(r.verdict, 'no-go');
  assert.equal(r.blockers.length, 1);
  assert.ok(r.breakdown.some(b => b.reason.includes('capped')), 'the cap must be itemised, not silent');
});

test('the score never goes negative', () => {
  const many = Array.from({ length: 40 }, (_, i) => finding({ id: `f${i}`, severity: 'critical' }));
  assert.equal(computeReadiness(many).score, 0);
});

test('minor issues alone still read GO — the score must not cry wolf', () => {
  // One medium (cost 4) → 96. No blocker, comfortably above the GO threshold.
  assert.equal(computeReadiness([finding({ severity: 'medium' })]).verdict, 'go');
});

test('accumulated unblocked issues drop the verdict to go-with-risk below 90', () => {
  const three = ['a', 'b', 'c'].map(id => finding({ id, severity: 'medium' }));
  const r = computeReadiness(three);          // 100 - 12 = 88
  assert.equal(r.score, 88);
  assert.equal(r.verdict, 'go-with-risk');
});

// ── findings: unknown is not health ──────────────────────────────────────────
test('a suite that never ran is reported, not silently treated as passing', () => {
  const suites: SuiteResult[] = [{ suite: 'Unit', cmd: 'npm test', passed: 0, failed: 0, recorded: false }];
  const f = regressionFindings(suites);
  assert.equal(f.length, 1);
  assert.match(f[0].title, /no recorded result/);
  assert.equal(f[0].blocker, false);
});

test('a recorded passing suite produces no finding', () => {
  assert.deepEqual(regressionFindings([{ suite: 'Unit', cmd: 'c', passed: 215, failed: 0, recorded: true }]), []);
});

test('a failing suite is a critical launch blocker', () => {
  const f = regressionFindings([{ suite: 'Unit', cmd: 'c', passed: 3, failed: 2, recorded: true }]);
  assert.equal(f[0].severity, 'critical');
  assert.equal(f[0].blocker, true);
});

test('an unverified journey is surfaced but does not block; a failing one blocks', () => {
  const journeys: JourneyResult[] = [
    { role: 'customer', journey: 'j', status: 'passing', evidence: 'e' },
    { role: 'partner', journey: 'j', status: 'not-verified', evidence: 'no runner' },
    { role: 'driver', journey: 'j', status: 'failing', evidence: 'step 3 failed' },
  ];
  const f = journeyFindings(journeys);
  assert.equal(f.length, 2, 'a passing journey must produce no finding');
  const partner = f.find(x => x.id === 'journey.partner')!;
  const driver = f.find(x => x.id === 'journey.driver')!;
  assert.equal(partner.blocker, false);
  assert.equal(driver.blocker, true);
  assert.equal(driver.severity, 'critical');
});

// ── findings: architecture ───────────────────────────────────────────────────
const snap = (arch: Partial<GuardianSnapshot['architecture']>): GuardianSnapshot => ({
  schema: 1, generatedAt: '2026-01-01T00:00:00.000Z', sha: 'abc', env: 'test',
  architecture: { files: 1, totalLoc: 1, circular: [], layerViolations: [], duplicates: [], deadCode: [], largeFiles: [], coupling: [], ...arch },
  navigation: { routes: [], duplicateRoutes: [], unreachable: [] },
  fingerprint: { composite: 'a', architecture: 'b', dependency: 'c', repository: 'd' },
  drift: { hasBaseline: true, changed: false, architectureChanged: false, dependencyChanged: false, summary: '' },
  suites: [], journeys: [],
  inventory: { services: 0, features: 0, routes: 0, apis: 0, events: 0, permissions: 0, integrations: 0, envKeys: 0 },
});

test('a circular dependency blocks launch and names the whole cycle', () => {
  const f = architectureFindings(snap({ circular: [['src/a.ts', 'src/b.ts']] }));
  assert.equal(f.length, 1);
  assert.equal(f[0].blocker, true);
  assert.deepEqual(f[0].files, ['src/a.ts', 'src/b.ts']);
  assert.match(f[0].rootCause, /a\.ts → b\.ts → a\.ts/);
});

test('dead code is reported but never blocks a launch', () => {
  const f = architectureFindings(snap({ deadCode: ['src/x.ts'] }));
  assert.equal(f[0].blocker, false);
  assert.equal(f[0].severity, 'low');
});

test('a clean architecture yields no findings', () => {
  assert.deepEqual(architectureFindings(snap({})), []);
});

// ── repair packets ───────────────────────────────────────────────────────────
test('a repair packet carries root cause, files, severity and fix', () => {
  const p = buildRepairPacket(finding({ severity: 'critical', title: 'Boom', rootCause: 'because', files: ['src/a.ts'], recommendedFix: 'do x' }));
  assert.equal(p.severity, 'critical');
  assert.equal(p.rootCause, 'because');
  assert.deepEqual(p.files, ['src/a.ts']);
  assert.equal(p.recommendedFix, 'do x');
});

test('the prompt is self-contained: defect, cause, files, fix, house rules and a verify step', () => {
  const p = buildRepairPacket(finding({ title: 'Boom', rootCause: 'because', files: ['src/a.ts'], recommendedFix: 'do x' }), { sha: 'deadbee', env: 'production' });
  for (const needle of ['Boom', 'because', 'src/a.ts', 'do x', 'deadbee', 'production', 'npm run lint', 'DEMO_CONTENT_ENABLED', 'strictNullChecks']) {
    assert.ok(p.prompt.includes(needle), `prompt must mention "${needle}"`);
  }
});

test('a blocker is flagged as such inside the prompt', () => {
  assert.match(buildRepairPacket(finding({ blocker: true, severity: 'critical' })).prompt, /LAUNCH BLOCKER/);
});

test('a finding with no attributable files still yields a usable prompt', () => {
  const p = buildRepairPacket(finding({ files: [] }));
  assert.ok(!p.prompt.includes('- \n'), 'must not emit an empty file bullet');
  assert.match(p.prompt, /not attributable to specific files/);
});

test('packets are ordered worst-first', () => {
  const packets = buildRepairPackets([
    finding({ id: 'low', severity: 'low' }),
    finding({ id: 'crit', severity: 'critical' }),
    finding({ id: 'med', severity: 'medium' }),
  ]);
  assert.deepEqual(packets.map(p => p.id), ['crit', 'med', 'low']);
});

test('bySeverity sorts critical first and low last', () => {
  const sorted = [finding({ severity: 'low' }), finding({ severity: 'critical' })].sort(bySeverity);
  assert.equal(sorted[0].severity, 'critical');
});
