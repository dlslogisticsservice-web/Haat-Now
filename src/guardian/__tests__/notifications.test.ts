// Production notification platform — delivery pipeline, preferences (incl. quiet hours),
// and Guardian's notification detection. The rule that matters everywhere: a message never
// silently succeeds — failures retry with backoff, then fail or expire, and are counted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  queue, markSent, markDelivered, markAcknowledged, markFailed, dueForRetry, applyExpiry,
  backoffMs, queueStats, isDeliveryActive, isDeliveryTerminal, DELIVERY_POLICY,
} from '../../services/delivery-policy';
import {
  defaultPreferences, loadPreferences, isInQuietHours, isAllowed, QUIET_HOURS_EXEMPT, type NotificationPreferences,
} from '../../services/notification-prefs';
import { notificationFindings, type NotificationHealthInput } from '../ops/findings';
import { evaluateGate } from '../ops/gate';
import type { GuardianSnapshot } from '../ops/types';

const T = 1_000_000_000_000;

// ── delivery lifecycle ───────────────────────────────────────────────────────
test('the happy path runs queued → sent → delivered → acknowledged', () => {
  let s = queue(T);
  assert.equal(s.status, 'queued');
  s = markSent(s, T + 1);
  assert.equal(s.status, 'sent');
  assert.equal(s.attempts, 1);
  s = markDelivered(s, T + 2);
  assert.equal(s.status, 'delivered');
  s = markAcknowledged(s, T + 3);
  assert.equal(s.status, 'acknowledged');
  assert.ok(isDeliveryTerminal('acknowledged') && !isDeliveryActive('acknowledged'));
});

test('a transient failure schedules a retry with backoff, not a silent success', () => {
  let s = markSent(queue(T), T);          // attempt 1
  s = markFailed(s, T, 'timeout');
  assert.equal(s.status, 'retry');
  assert.equal(s.lastError, 'timeout');
  assert.equal(s.nextRetryAt, T + backoffMs(1));
  assert.equal(dueForRetry(s, s.nextRetryAt), true);
  assert.equal(dueForRetry(s, T + 1), false, 'not due before the backoff elapses');
});

test('backoff grows exponentially and is capped', () => {
  assert.equal(backoffMs(1), DELIVERY_POLICY.baseBackoffMs);
  assert.equal(backoffMs(2), DELIVERY_POLICY.baseBackoffMs * 2);
  assert.equal(backoffMs(3), DELIVERY_POLICY.baseBackoffMs * 4);
  assert.equal(backoffMs(99), DELIVERY_POLICY.maxBackoffMs, 'never waits longer than the ceiling');
});

test('retries are bounded — after maxAttempts the message is failed, not retried forever', () => {
  let s = queue(T);
  for (let i = 0; i < DELIVERY_POLICY.maxAttempts; i++) { s = markSent(s, T); s = markFailed(s, T); }
  assert.equal(s.attempts, DELIVERY_POLICY.maxAttempts);
  assert.equal(s.status, 'failed');
  assert.equal(s.nextRetryAt, null);
  assert.ok(isDeliveryTerminal('failed'));
});

test('a message past its TTL expires and is never delivered late', () => {
  const s = queue(T);
  assert.equal(applyExpiry(s, T + 1000).status, 'queued');
  assert.equal(applyExpiry(s, T + DELIVERY_POLICY.ttlMs + 1).status, 'expired');
});

test('expiry never resurrects a terminal message', () => {
  const delivered = markDelivered(markSent(queue(T), T), T);
  assert.equal(applyExpiry(delivered, T + DELIVERY_POLICY.ttlMs + 1).status, 'delivered');
});

test('queue stats separate backlog from dropped', () => {
  const stats = queueStats([
    queue(T),                                   // queued
    markSent(queue(T), T),                      // sent
    markFailed(markSent(queue(T), T), T),       // retry
    markDelivered(markSent(queue(T), T), T),    // delivered
    { ...queue(T), status: 'failed' },
    { ...queue(T), status: 'expired' },
  ]);
  assert.equal(stats.backlog, 3, 'queued + sent + retry');
  assert.equal(stats.dropped, 2, 'failed + expired');
  assert.equal(stats.delivered, 1);
});

// ── preferences ──────────────────────────────────────────────────────────────
test('a fresh install has sensible defaults', () => {
  const p = defaultPreferences('en');
  assert.equal(p.enabled, true);
  assert.deepEqual(p.categories, { orders: true, offers: true, news: false });
  assert.equal(p.quietHours.enabled, false);
  assert.equal(p.language, 'en');
});

test('the master switch overrides every category', () => {
  const p: NotificationPreferences = { ...defaultPreferences(), enabled: false };
  assert.equal(isAllowed(p, 'orders', new Date(T)), false);
  assert.equal(isAllowed(p, 'offers', new Date(T)), false);
});

test('a muted category is not delivered; an enabled one is', () => {
  const p: NotificationPreferences = { ...defaultPreferences(), categories: { orders: true, offers: false, news: false } };
  const noon = new Date('2026-01-01T12:00:00');
  assert.equal(isAllowed(p, 'orders', noon), true);
  assert.equal(isAllowed(p, 'offers', noon), false);
});

test('quiet hours suppress non-transactional categories but NOT order updates', () => {
  const p: NotificationPreferences = { ...defaultPreferences(), quietHours: { enabled: true, startHour: 22, endHour: 7 } };
  const night = new Date('2026-01-01T23:30:00');     // inside 22→7
  assert.equal(isInQuietHours(p.quietHours, night), true);
  assert.equal(isAllowed(p, 'offers', night), false, 'offers are silenced at night');
  assert.equal(isAllowed(p, 'orders', night), true, 'order updates bypass quiet hours');
  assert.ok(QUIET_HOURS_EXEMPT.includes('orders'));
});

test('a quiet-hours window that wraps midnight is handled', () => {
  const q = { enabled: true, startHour: 22, endHour: 7 };
  assert.equal(isInQuietHours(q, new Date('2026-01-01T23:00:00')), true);   // before midnight
  assert.equal(isInQuietHours(q, new Date('2026-01-01T03:00:00')), true);   // after midnight
  assert.equal(isInQuietHours(q, new Date('2026-01-01T12:00:00')), false);  // daytime
});

test('legacy {orders,offers,news} preferences upgrade in place without loss', () => {
  const storage: Record<string, string> = { haat_notif_prefs: JSON.stringify({ orders: false, offers: true, news: true }) };
  const g = globalThis as { localStorage?: unknown };
  const original = g.localStorage;
  g.localStorage = { getItem: (k: string) => storage[k] ?? null, setItem: () => {}, removeItem: () => {} };
  try {
    const p = loadPreferences('ar');
    assert.equal(p.categories.orders, false, 'legacy value preserved');
    assert.equal(p.categories.news, true);
    assert.equal(p.enabled, true, 'new field defaulted, not disabled');
    assert.equal(p.quietHours.enabled, false);
  } finally {
    if (original === undefined) delete g.localStorage; else g.localStorage = original;
  }
});

// ── Guardian notification detection ───────────────────────────────────────────
const notify = (over: Partial<NotificationHealthInput> = {}): NotificationHealthInput => ({
  inAppActive: true, pushStatus: 'active', isProduction: true, pushVendor: 'fcm',
  deliveryFailures: 0, retrying: 0, dropped: 0, backlog: 0, ...over,
});

test('a healthy notification platform yields no findings', () => {
  assert.deepEqual(notificationFindings(notify()), []);
});

test('in-app down is a blocker — it is the always-on channel', () => {
  const f = notificationFindings(notify({ inAppActive: false }));
  assert.equal(f[0].id, 'notify.inapp-down');
  assert.equal(f[0].blocker, true);
});

test('push not configured in production is surfaced but does NOT block (in-app still delivers)', () => {
  const f = notificationFindings(notify({ pushStatus: 'not-configured' }));
  const p = f.find(x => x.id === 'notify.push-not-configured')!;
  assert.equal(p.severity, 'medium');
  assert.equal(p.blocker, false);
});

test('delivery failures, drops and backlog are surfaced with the right severities', () => {
  const f = notificationFindings(notify({ deliveryFailures: 2, dropped: 3, backlog: 5 }));
  assert.equal(f.find(x => x.id === 'notify.delivery-failures')!.severity, 'high');
  assert.equal(f.find(x => x.id === 'notify.dropped')!.severity, 'medium');
  assert.equal(f.find(x => x.id === 'notify.backlog')!.severity, 'low');
  assert.ok(f.every(x => !x.blocker));
});

// ── Release Gate includes Notification readiness ─────────────────────────────
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

test('the gate blocks when the in-app channel is down', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now',
    notification: { ready: false, detail: 'in-app channel unavailable' } });
  assert.equal(g.verdict, 'NO_GO');
  assert.ok(g.blockers.some(b => b.rule === 'Notification ready'));
});

test('the gate passes notifications when in-app is live (push absent is fine)', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now',
    notification: { ready: true, detail: 'in-app live' } });
  assert.ok(g.evaluated.some(e => e.rule === 'Notification ready' && e.passed));
});

test('the notification rule is skipped when no notification state is supplied', () => {
  const g = evaluateGate({ findings: [], issues: [], snapshot: snapshot(), now: 'now' });
  assert.ok(!g.evaluated.some(e => e.rule === 'Notification ready'));
});
