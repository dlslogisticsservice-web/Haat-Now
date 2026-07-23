// Production payment platform — the reconciliation policy and Guardian's payment
// detection. Two rules dominate: an unknown status is NEVER assumed paid, and a missing
// card gateway is NOT a launch blocker because COD is the launch method.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPayment, isPaymentSettled, isPaymentFailed, isPaymentPending,
  isStuck, reconcileStats, PAYMENT_POLICY, type ReconRecord,
} from '../../services/payment-policy';
import { paymentFindings, type PaymentHealthInput } from '../ops/findings';
import { evaluateGate } from '../ops/gate';
import type { GuardianSnapshot } from '../ops/types';

const T = 1_000_000_000_000;

// ── classification of EXISTING status vocabularies ───────────────────────────
test('the real status strings collapse to the right outcome', () => {
  // PaymentAttempt / PaymentTransaction / COD / orders.payment_status vocabularies.
  for (const s of ['captured', 'succeeded', 'paid', 'collected']) assert.equal(classifyPayment(s), 'success', s);
  for (const s of ['failed', 'cancelled', 'canceled']) assert.equal(classifyPayment(s), 'failed', s);
  for (const s of ['refunded', 'partially_refunded']) assert.equal(classifyPayment(s), 'refunded', s);
  for (const s of ['pending', 'locked', 'unpaid', 'processing']) assert.equal(classifyPayment(s), 'pending', s);
});

test('an unknown status is treated as pending — never assumed paid', () => {
  assert.equal(classifyPayment('weird_new_status'), 'pending');
  assert.equal(classifyPayment(''), 'pending');
  assert.equal(isPaymentSettled('weird_new_status'), false);
});

test('settled / failed / pending predicates agree with classification', () => {
  assert.ok(isPaymentSettled('captured') && isPaymentSettled('refunded'));
  assert.ok(isPaymentFailed('failed') && !isPaymentFailed('pending'));
  assert.ok(isPaymentPending('locked') && !isPaymentPending('paid'));
});

// ── stuck / reconciliation ────────────────────────────────────────────────────
test('a pending payment within the window is in-flight, not stuck', () => {
  const rec: ReconRecord = { status: 'pending', createdAt: T };
  assert.equal(isStuck(rec, T + 1000), false);
});

test('a pending payment past the threshold is stuck', () => {
  const rec: ReconRecord = { status: 'locked', createdAt: T };
  assert.equal(isStuck(rec, T + PAYMENT_POLICY.stuckAfterMs + 1), true);
});

test('a settled or failed payment is never stuck, however old', () => {
  const old = T + PAYMENT_POLICY.stuckAfterMs * 100;
  assert.equal(isStuck({ status: 'captured', createdAt: T }, old), false);
  assert.equal(isStuck({ status: 'failed', createdAt: T }, old), false);
});

test('reconcile stats separate in-flight from genuinely stuck', () => {
  const now = T + PAYMENT_POLICY.stuckAfterMs + 1;
  const s = reconcileStats([
    { status: 'captured', createdAt: T },
    { status: 'refunded', createdAt: T },
    { status: 'failed', createdAt: T },
    { status: 'pending', createdAt: now - 1000 },   // fresh → in-flight
    { status: 'locked', createdAt: T },             // old → stuck
  ], now);
  assert.deepEqual(s, { success: 1, failed: 1, refunded: 1, pending: 1, stuck: 1 });
});

// ── Guardian payment detection ────────────────────────────────────────────────
const pay = (over: Partial<PaymentHealthInput> = {}): PaymentHealthInput => ({
  codAvailable: true, gatewayStatus: 'active', isProduction: true, gatewayVendor: 'moyasar',
  gatewayFailures: 0, codLedgerFailures: 0, stuck: 0, ...over,
});

test('a healthy payment platform yields no findings', () => {
  assert.deepEqual(paymentFindings(pay()), []);
});

test('no payment method at all is a critical blocker', () => {
  const f = paymentFindings(pay({ codAvailable: false, gatewayStatus: 'not-configured' }));
  assert.equal(f[0].id, 'payment.no-method');
  assert.equal(f[0].severity, 'critical');
  assert.equal(f[0].blocker, true);
});

test('a missing card gateway is COD-only — surfaced but NOT a blocker', () => {
  const f = paymentFindings(pay({ gatewayStatus: 'not-configured' }));
  const g = f.find(x => x.id === 'payment.gateway-not-configured')!;
  assert.equal(g.severity, 'medium');
  assert.equal(g.blocker, false);
});

test('gateway failures and stuck payments are high; COD ledger failures are medium; none block', () => {
  const f = paymentFindings(pay({ gatewayFailures: 2, stuck: 3, codLedgerFailures: 1 }));
  assert.equal(f.find(x => x.id === 'payment.gateway-failures')!.severity, 'high');
  assert.equal(f.find(x => x.id === 'payment.stuck')!.severity, 'high');
  assert.equal(f.find(x => x.id === 'payment.cod-ledger')!.severity, 'medium');
  assert.ok(f.every(x => !x.blocker));
});

// ── Release Gate includes Payment readiness ──────────────────────────────────
const snapshot = (): GuardianSnapshot => ({
  schema: 1, generatedAt: '2026-01-01T00:00:00.000Z', sha: 'abc', env: 'test',
  architecture: { files: 1, totalLoc: 1, circular: [], layerViolations: [], duplicates: [], deadCode: [], largeFiles: [], coupling: [] },
  navigation: { routes: [], duplicateRoutes: [], unreachable: [] },
  fingerprint: { composite: 'a', architecture: 'b', dependency: 'c', repository: 'd' },
  drift: { hasBaseline: true, changed: false, architectureChanged: false, dependencyChanged: false, summary: '' },
  suites: [{ suite: 'Unit', cmd: 'c', passed: 1, failed: 0, recorded: true }],
  journeys: [{ role: 'customer', journey: 'j', status: 'passing', evidence: 'e' }],
  inventory: { services: 0, features: 0, routes: 0, apis: 0, events: 0, permissions: 0, integrations: 0, envKeys: 0 },
});

test('the gate passes payment on COD alone — no card gateway required to launch', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now',
    payment: { ready: true, detail: 'COD available' } });
  assert.equal(g.verdict, 'GO');
  assert.ok(g.evaluated.some(e => e.rule === 'Payment ready' && e.passed));
});

test('the gate blocks payment only when NO method works', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now',
    payment: { ready: false, detail: 'no payment method available' } });
  assert.equal(g.verdict, 'NO_GO');
  assert.ok(g.blockers.some(b => b.rule === 'Payment ready'));
});

test('the payment rule is skipped when no payment state is supplied', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now' });
  assert.ok(!g.evaluated.some(e => e.rule === 'Payment ready'));
});
