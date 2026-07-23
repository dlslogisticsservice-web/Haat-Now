// Production transactional email — template rendering (incl. the missing-variable guard
// the catalog lacked), the delivery lifecycle (which REUSES the notification retry engine),
// and Guardian's email detection. Rule that dominates: never produce or send a blank email,
// and never retry a hard bounce.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderEmail, missingVariables, EMAIL_TYPES, EMAIL_TYPE_KEYS, type EmailType,
} from '../../services/email-templates';
import { commsTemplate } from '../../services/comms-templates';
import {
  queueEmail, markSending, markSent, markDelivered, markOpened, markFailed, dueForRetry,
  applyExpiry, classifyBounce, emailQueueStats, isEmailTerminal,
} from '../../services/email-policy';
import { DELIVERY_POLICY, backoffMs } from '../../services/delivery-policy';
import { emailFindings, type EmailHealthInput } from '../ops/findings';
import { evaluateGate } from '../ops/gate';
import type { GuardianSnapshot } from '../ops/types';

const T = 1_000_000_000_000;

// ── templates ────────────────────────────────────────────────────────────────
test('all 15 transactional email types map to a real, renderable template', () => {
  assert.equal(EMAIL_TYPE_KEYS.length, 15);
  for (const type of EMAIL_TYPE_KEYS) {
    // supply a dummy for every declared var so the render is complete
    const key = EMAIL_TYPES[type];
    const r = renderEmail(type, dummyVars(type), 'en');
    assert.equal(r.ok, true, `${type} (${key}) should render ok`);
    assert.ok(r.subject.length > 0, `${type} needs a subject`);
    assert.ok(r.html.includes('<html'), `${type} must produce HTML`);
  }
});

test('a missing variable makes the render NOT ok — a blank email is never sendable', () => {
  const r = renderEmail('welcome', {}, 'en');   // 'welcome' needs {name}
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingVars, ['name']);
  assert.match(r.error ?? '', /missing variables: name/);
});

test('missingVariables reports exactly the unfilled declared vars', () => {
  assert.deepEqual(missingVariables('password_reset', { name: 'Sara' }), ['link']);
  assert.deepEqual(missingVariables('password_reset', { name: 'Sara', link: 'x' }), []);
});

test('locale drives direction: Arabic is RTL, English is LTR', () => {
  const ar = renderEmail('welcome', { name: 'سارة' }, 'ar');
  const en = renderEmail('welcome', { name: 'Sara' }, 'en');
  assert.equal(ar.dir, 'rtl');
  assert.ok(ar.html.includes('dir="rtl"'));
  assert.equal(en.dir, 'ltr');
  assert.ok(en.html.includes('dir="ltr"'));
});

test('brand + country variables flow into the envelope (white-label)', () => {
  const r = renderEmail('welcome', { name: 'Sara' }, 'en',
    { brandName: 'Acme Foods', brandColor: '#ff0000', supportEmail: 'help@acme.test' },
    { country: 'KSA', currency: 'SAR' });
  assert.ok(r.html.includes('Acme Foods'));
  assert.ok(r.html.includes('#ff0000'));
  assert.ok(r.html.includes('help@acme.test'));
  assert.ok(r.html.includes('KSA'));
});

test('variable content is HTML-escaped (no injection through a variable)', () => {
  const r = renderEmail('welcome', { name: '<script>alert(1)</script>' }, 'en');
  assert.ok(!r.html.includes('<script>alert(1)</script>'));
  assert.ok(r.html.includes('&lt;script&gt;'));
});

test('an unknown brand color falls back rather than injecting arbitrary CSS', () => {
  const r = renderEmail('welcome', { name: 'Sara' }, 'en', { brandColor: 'red; }malicious' });
  assert.ok(!r.html.includes('malicious'));
});

function dummyVars(type: EmailType): Record<string, string> {
  // fill every variable the mapped template actually declares with a placeholder
  const t = commsTemplate(EMAIL_TYPES[type]);
  const vars: Record<string, string> = {};
  for (const v of t?.vars ?? []) vars[v] = 'x';
  return vars;
}

// ── delivery lifecycle ─────────────────────────────────────────────────────────
test('the happy path runs queued → sending → sent → delivered → opened', () => {
  let s = queueEmail(T);
  assert.equal(s.status, 'queued');
  s = markSending(s, T + 1); assert.equal(s.status, 'sending'); assert.equal(s.attempts, 1);
  s = markSent(s, T + 2); assert.equal(s.status, 'sent');
  s = markDelivered(s, T + 3); assert.equal(s.status, 'delivered');
  s = markOpened(s, T + 4); assert.equal(s.status, 'opened');
  assert.ok(isEmailTerminal('opened'));
});

test('a soft failure retries with the SHARED notification backoff (no duplicate engine)', () => {
  let s = markSending(queueEmail(T), T);
  s = markFailed(s, T, 'temporary greylist 4.2.1');
  assert.equal(s.status, 'retry');
  assert.equal(s.bounce, 'soft');
  assert.equal(s.nextRetryAt, T + backoffMs(1), 'reuses delivery-policy backoff');
  assert.equal(dueForRetry(s, s.nextRetryAt), true);
});

test('a HARD bounce is terminal and is NEVER retried', () => {
  let s = markSending(queueEmail(T), T);
  s = markFailed(s, T, '550 5.1.1 no such user');
  assert.equal(s.status, 'failed');
  assert.equal(s.bounce, 'hard');
  assert.equal(s.nextRetryAt, null);
});

test('bounce classification distinguishes hard from soft from none', () => {
  assert.equal(classifyBounce('550 mailbox not found'), 'hard');
  assert.equal(classifyBounce('mailbox does not exist'), 'hard');
  assert.equal(classifyBounce('temporary failure, try later'), 'soft');
  assert.equal(classifyBounce(undefined), 'none');
});

test('retries are bounded by the shared attempt cap, then fail', () => {
  let s = queueEmail(T);
  for (let i = 0; i < DELIVERY_POLICY.maxAttempts; i++) { s = markSending(s, T); s = markFailed(s, T, 'soft'); }
  assert.equal(s.status, 'failed');
  assert.equal(s.attempts, DELIVERY_POLICY.maxAttempts);
});

test('an email past its TTL expires and is not delivered late', () => {
  assert.equal(applyExpiry(queueEmail(T), T + DELIVERY_POLICY.ttlMs + 1).status, 'expired');
  const opened = markOpened(queueEmail(T), T);
  assert.equal(applyExpiry(opened, T + DELIVERY_POLICY.ttlMs + 1).status, 'opened', 'terminal is never resurrected');
});

test('queue stats separate backlog, dropped and bounced', () => {
  const s = emailQueueStats([
    queueEmail(T),
    markSending(queueEmail(T), T),
    markFailed(markSending(queueEmail(T), T), T, 'soft'),         // retry (soft bounce)
    markDelivered(markSent(markSending(queueEmail(T), T), T), T), // delivered
    markFailed(markSending(queueEmail(T), T), T, '550 no such user'), // failed (hard bounce)
  ]);
  assert.equal(s.backlog, 3, 'queued + sending + retry');
  assert.equal(s.dropped, 1, 'the hard-bounced failure');
  assert.equal(s.bounced, 2, 'soft + hard');
  assert.equal(s.delivered, 1);
});

// ── Guardian email detection ──────────────────────────────────────────────────
const eh = (over: Partial<EmailHealthInput> = {}): EmailHealthInput => ({
  vendorStatus: 'active', isProduction: true, vendor: 'resend',
  deliveryFailures: 0, templateFailures: 0, bounces: 0, retrying: 0, backlog: 0, ...over,
});

test('a healthy email platform yields no findings', () => {
  assert.deepEqual(emailFindings(eh()), []);
});

test('a template rendering failure is the one email blocker (a broken email must not send)', () => {
  const f = emailFindings(eh({ templateFailures: 2 }));
  const t = f.find(x => x.id === 'email.template-failures')!;
  assert.equal(t.severity, 'high');
  assert.equal(t.blocker, true);
});

test('a missing email vendor is surfaced but does NOT block (email is an enhancement channel)', () => {
  const f = emailFindings(eh({ vendorStatus: 'not-configured' }));
  const m = f.find(x => x.id === 'email.not-configured')!;
  assert.equal(m.severity, 'medium');
  assert.equal(m.blocker, false);
});

test('delivery failures / bounces / backlog surface with the right severities, none blocking', () => {
  const f = emailFindings(eh({ deliveryFailures: 2, bounces: 3, backlog: 4 }));
  assert.equal(f.find(x => x.id === 'email.delivery-failures')!.severity, 'high');
  assert.equal(f.find(x => x.id === 'email.bounces')!.severity, 'medium');
  assert.equal(f.find(x => x.id === 'email.backlog')!.severity, 'low');
  assert.ok(f.every(x => !x.blocker));
});

// ── Release Gate includes Email readiness ────────────────────────────────────
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

test('the gate passes email on templates alone — a missing vendor does not block launch', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now',
    email: { ready: true, detail: 'templates render; vendor not configured' } });
  assert.equal(g.verdict, 'GO');
  assert.ok(g.evaluated.some(e => e.rule === 'Email ready' && e.passed));
});

test('the gate blocks email only when templates cannot render', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now',
    email: { ready: false, detail: 'template rendering failing' } });
  assert.equal(g.verdict, 'NO_GO');
  assert.ok(g.blockers.some(b => b.rule === 'Email ready'));
});

test('the email rule is skipped when no email state is supplied', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now' });
  assert.ok(!g.evaluated.some(e => e.rule === 'Email ready'));
});
