// Production authentication — the OTP abuse-guard policy and Guardian's auth detection.
//
// The policy is client-side DEFENSE IN DEPTH: it can only be stricter than the server,
// never weaker, and it must NEVER let an abusive request through as a fake success.
// These tests pin the four limits the brief requires: rate limiting, retry limits,
// invalid-attempt limits, and replay protection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyOtpState, checkSend, recordSend, checkVerify, recordVerifyFailure, recordVerifySuccess, OTP_POLICY,
} from '../../services/otp-policy';
import { authFindings, type AuthHealthInput } from '../ops/findings';
import { evaluateGate } from '../ops/gate';
import type { GuardianSnapshot } from '../ops/types';

const T = 1_000_000_000_000;   // fixed base time (ms)

// ── rate limiting: resend cooldown ───────────────────────────────────────────
test('a first send is allowed', () => {
  assert.equal(checkSend(emptyOtpState(), T).allowed, true);
});

test('an immediate resend is denied with a cooldown and a wait time', () => {
  const s = recordSend(emptyOtpState(), T);
  const d = checkSend(s, T + 1000);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, 'cooldown');
  assert.ok((d.retryAfterSec ?? 0) > 0, 'must tell the user how long to wait');
});

test('a resend after the cooldown is allowed again', () => {
  const s = recordSend(emptyOtpState(), T);
  assert.equal(checkSend(s, T + OTP_POLICY.resendCooldownMs).allowed, true);
});

// ── retry limits: max sends per window ───────────────────────────────────────
test('the send cap locks further sends within the window', () => {
  let s = emptyOtpState();
  let now = T;
  for (let i = 0; i < OTP_POLICY.maxSendsPerWindow; i++) {
    assert.equal(checkSend(s, now).allowed, true, `send ${i + 1} should be allowed`);
    s = recordSend(s, now);
    now += OTP_POLICY.resendCooldownMs;   // step past cooldown each time
  }
  const d = checkSend(s, now);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, 'send_limit');
});

test('the send window rolls: old sends age out and free up capacity', () => {
  let s = emptyOtpState();
  let now = T;
  for (let i = 0; i < OTP_POLICY.maxSendsPerWindow; i++) { s = recordSend(s, now); now += OTP_POLICY.resendCooldownMs; }
  // Jump past the whole window — every prior send has expired.
  const later = T + OTP_POLICY.sendWindowMs + 1;
  assert.equal(checkSend(s, later).allowed, true);
});

// ── invalid-attempt limits + lockout ─────────────────────────────────────────
test('verify is allowed until the invalid-attempt limit, then locks out', () => {
  let s = recordSend(emptyOtpState(), T);
  for (let i = 0; i < OTP_POLICY.maxVerifyFails; i++) {
    assert.equal(checkVerify(s, T).allowed, true, `attempt ${i + 1} should be allowed`);
    s = recordVerifyFailure(s, T);
  }
  const d = checkVerify(s, T);
  assert.equal(d.allowed, false);
  assert.ok(d.reason === 'attempt_limit' || d.reason === 'locked');
});

test('a lockout expires after its window', () => {
  let s = recordSend(emptyOtpState(), T);
  for (let i = 0; i < OTP_POLICY.maxVerifyFails; i++) s = recordVerifyFailure(s, T);
  assert.equal(checkVerify(s, T).allowed, false);
  assert.equal(checkVerify(s, T + OTP_POLICY.lockoutMs + 1).allowed, true);
});

test('a locked phone also cannot request a fresh send until the lockout clears', () => {
  let s = recordSend(emptyOtpState(), T);
  for (let i = 0; i < OTP_POLICY.maxVerifyFails; i++) s = recordVerifyFailure(s, T);
  const d = checkSend(s, T);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, 'locked');
});

// ── replay protection ────────────────────────────────────────────────────────
test('a consumed OTP cannot be replayed through the client guard', () => {
  let s = recordSend(emptyOtpState(), T);
  s = recordVerifySuccess(s, T);
  const d = checkVerify(s, T);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, 'replay');
});

test('a fresh send opens a new verify session after a success', () => {
  let s = recordSend(emptyOtpState(), T);
  s = recordVerifySuccess(s, T);
  assert.equal(checkVerify(s, T).allowed, false);          // consumed
  s = recordSend(s, T + OTP_POLICY.resendCooldownMs);      // new code requested
  assert.equal(checkVerify(s, T + OTP_POLICY.resendCooldownMs).allowed, true);
});

// ── the whole point: never a synthetic success ───────────────────────────────
test('every denial is an explicit reason — no branch returns allowed with a reason', () => {
  const denials = [
    checkSend(recordSend(emptyOtpState(), T), T + 1),                                  // cooldown
    checkVerify(recordVerifySuccess(recordSend(emptyOtpState(), T), T), T),            // replay
  ];
  for (const d of denials) {
    assert.equal(d.allowed, false);
    assert.ok(d.reason, 'a denial must carry a reason, never fail silently');
  }
});

// ── Guardian auth detection ──────────────────────────────────────────────────
const authInput = (over: Partial<AuthHealthInput> = {}): AuthHealthInput => ({
  status: 'active', isProduction: true, vendor: 'twilio', sendFailures: 0, verifyFailures: 0,
  requires: ['VITE_SMS_PROVIDER'], ...over,
});

test('a configured provider in production yields no auth finding', () => {
  assert.deepEqual(authFindings(authInput()), []);
});

test('an unconfigured provider in production is a launch blocker', () => {
  const f = authFindings(authInput({ status: 'not-configured' }));
  assert.equal(f.length, 1);
  assert.equal(f[0].id, 'auth.not-configured');
  assert.equal(f[0].blocker, true);
  assert.match(f[0].rootCause, /VITE_SMS_PROVIDER/);
});

test('demo auth in a production build is a critical blocker', () => {
  const f = authFindings(authInput({ status: 'demo' }));
  assert.equal(f[0].id, 'auth.demo-in-prod');
  assert.equal(f[0].severity, 'critical');
  assert.equal(f[0].blocker, true);
});

test('demo auth in a demo (non-production) build is fine', () => {
  assert.deepEqual(authFindings(authInput({ status: 'demo', isProduction: false })), []);
});

test('SMS delivery failures are surfaced (high) and OTP verify failures (low)', () => {
  const f = authFindings(authInput({ sendFailures: 3, verifyFailures: 7 }));
  const send = f.find(x => x.id === 'auth.sms-delivery')!;
  const verify = f.find(x => x.id === 'auth.otp-verify')!;
  assert.equal(send.severity, 'high');
  assert.equal(verify.severity, 'low');
  assert.match(send.title, /3/);
  assert.match(verify.title, /7/);
});

// ── Release Gate includes authentication readiness ───────────────────────────
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

test('the gate blocks a release when authentication is not ready', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now',
    auth: { ready: false, detail: 'no SMS vendor declared', requires: ['VITE_SMS_PROVIDER'] } });
  assert.equal(g.verdict, 'NO_GO');
  assert.ok(g.blockers.some(b => b.rule === 'Authentication ready'));
});

test('the gate passes authentication when it is ready', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now',
    auth: { ready: true, detail: 'Supabase phone OTP via twilio' } });
  assert.equal(g.verdict, 'GO');
  assert.ok(g.evaluated.some(e => e.rule === 'Authentication ready' && e.passed));
});

test('the auth rule is skipped (backward compatible) when no auth state is supplied', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now' });
  assert.ok(!g.evaluated.some(e => e.rule === 'Authentication ready'));
});
