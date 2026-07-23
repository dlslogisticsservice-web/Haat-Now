// Operations readiness · Go-Live decision rules.
//
// These encode the rules that must not quietly drift, because each one exists to stop
// a specific expensive mistake:
//   · a demo build can NEVER be declared launch-ready
//   · a merchant with no orders is UNKNOWN, not failing
//   · the verdict cannot be talked into a GO while a critical alert is outstanding
//   · SLA statuses must match the vocabulary the database actually uses
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  healthBand, summariseHealth, deriveAlerts, computeVerdict, incidentTiming,
  isBreaching, ACTIVE_ORDER_STATUSES, FAILED_ORDER_STATUSES, QUEUE_THRESHOLDS,
  type AlertInput, type ChecklistItemRule, type ChecklistStateRule,
} from '../golive-rules';

// A healthy live platform with nothing wrong — the baseline every test varies from.
const CLEAN: AlertInput = {
  apiOk: true,
  isSandbox: false,
  activeOrders: 12,
  unassignedOrders: 1,
  availableDrivers: 6,
  openSev1: 0,
  expiredDocuments: 0,
  merchantsAtRisk: 0,
  unconfiguredProviders: [],
};

const ITEMS: ChecklistItemRule[] = [
  { key: 'a', ar: 'أ', en: 'Blocking A', blocking: true },
  { key: 'b', ar: 'ب', en: 'Blocking B', blocking: true },
  { key: 'c', ar: 'ج', en: 'Optional C', blocking: false },
];

const allChecked: ChecklistStateRule = { a: { checked: true }, b: { checked: true }, c: { checked: true } };

// ── Health banding ────────────────────────────────────────────────────────────
test('health bands split at the documented thresholds', () => {
  assert.equal(healthBand(100), 'healthy');
  assert.equal(healthBand(85), 'healthy');
  assert.equal(healthBand(84.9), 'watch');
  assert.equal(healthBand(65), 'watch');
  assert.equal(healthBand(64.9), 'at_risk');
  assert.equal(healthBand(0), 'at_risk');
});

test('a merchant with no data is UNKNOWN, never at risk', () => {
  // This matters: a brand-new merchant with zero orders must not appear in the
  // "at risk" list beside merchants that are genuinely failing.
  assert.equal(healthBand(null), 'no_data');
  assert.equal(healthBand(undefined), 'no_data');
  assert.equal(healthBand(NaN), 'no_data');
  assert.notEqual(healthBand(null), 'at_risk');
});

test('summariseHealth counts every band and loses nothing', () => {
  const scores = [95, 88, 70, 66, 40, 10, null, undefined];
  const s = summariseHealth(scores);
  assert.deepEqual(s, { healthy: 2, watch: 2, atRisk: 2, noData: 2 });
  assert.equal(s.healthy + s.watch + s.atRisk + s.noData, scores.length);
});

// ── Alerts ────────────────────────────────────────────────────────────────────
test('a clean live platform raises no alerts at all', () => {
  assert.deepEqual(deriveAlerts(CLEAN), []);
});

test('a sandbox build ALWAYS raises a critical alert', () => {
  // The single most expensive launch-night mistake is shipping the demo build and
  // believing it took a real order. This must be impossible to miss.
  const alerts = deriveAlerts({ ...CLEAN, isSandbox: true });
  const sandbox = alerts.find(a => a.id === 'sandbox');
  assert.ok(sandbox, 'sandbox build must raise an alert');
  assert.equal(sandbox.level, 'critical');
});

test('platform down is critical', () => {
  const alerts = deriveAlerts({ ...CLEAN, apiOk: false });
  assert.equal(alerts.find(a => a.id === 'api_down')?.level, 'critical');
});

test('active orders with zero available drivers is critical', () => {
  const alerts = deriveAlerts({ ...CLEAN, activeOrders: 8, availableDrivers: 0 });
  assert.equal(alerts.find(a => a.id === 'no_drivers')?.level, 'critical');
});

test('zero available drivers with NO active orders is not an alert', () => {
  // 3am with an empty marketplace is not an incident. Alerting here would train
  // operators to ignore the alert that matters.
  const alerts = deriveAlerts({ ...CLEAN, activeOrders: 0, availableDrivers: 0 });
  assert.equal(alerts.find(a => a.id === 'no_drivers'), undefined);
});

test('expired documents are critical; a lapsing-soon document is not', () => {
  assert.equal(deriveAlerts({ ...CLEAN, expiredDocuments: 2 }).find(a => a.id === 'docs_expired')?.level, 'critical');
  assert.equal(deriveAlerts({ ...CLEAN, expiredDocuments: 0 }).find(a => a.id === 'docs_expired'), undefined);
});

test('the unassigned-orders alert fires only above the shared threshold', () => {
  assert.equal(deriveAlerts({ ...CLEAN, unassignedOrders: QUEUE_THRESHOLDS.unassigned }).find(a => a.id === 'unassigned'), undefined);
  assert.equal(deriveAlerts({ ...CLEAN, unassignedOrders: QUEUE_THRESHOLDS.unassigned + 1 }).find(a => a.id === 'unassigned')?.level, 'warning');
});

test('unconfigured providers are a warning live, but only info in a demo build', () => {
  const live = deriveAlerts({ ...CLEAN, unconfiguredProviders: ['push', 'sms'] });
  assert.equal(live.find(a => a.id === 'providers')?.level, 'warning');
  const demo = deriveAlerts({ ...CLEAN, isSandbox: true, unconfiguredProviders: ['push', 'sms'] });
  assert.equal(demo.find(a => a.id === 'providers')?.level, 'info');
});

test('every alert carries both Arabic and English text', () => {
  const alerts = deriveAlerts({
    apiOk: false, isSandbox: true, activeOrders: 5, unassignedOrders: 99,
    availableDrivers: 0, openSev1: 2, expiredDocuments: 3, merchantsAtRisk: 4,
    unconfiguredProviders: ['push'],
  });
  assert.ok(alerts.length >= 7);
  for (const a of alerts) {
    assert.ok(a.ar.trim().length > 0, `${a.id} missing Arabic`);
    assert.ok(a.en.trim().length > 0, `${a.id} missing English`);
  }
});

// ── Verdict ───────────────────────────────────────────────────────────────────
test('GO requires every blocking item ticked AND no critical alert', () => {
  const v = computeVerdict(ITEMS, allChecked, deriveAlerts(CLEAN));
  assert.equal(v.go, true);
  assert.equal(v.completed, 2);
  assert.equal(v.totalBlocking, 2);
  assert.deepEqual(v.blockers, []);
});

test('an unticked blocking item forces NO-GO', () => {
  const v = computeVerdict(ITEMS, { a: { checked: true } }, []);
  assert.equal(v.go, false);
  assert.equal(v.completed, 1);
  assert.ok(v.blockers.includes('Blocking B'));
});

test('an unticked OPTIONAL item does not block', () => {
  const v = computeVerdict(ITEMS, { a: { checked: true }, b: { checked: true } }, []);
  assert.equal(v.go, true);
  assert.ok(!v.blockers.some(b => b.includes('Optional')));
});

test('a critical alert forces NO-GO even with a fully ticked checklist', () => {
  // The checklist is human input; the alert is machine truth. Truth wins.
  const v = computeVerdict(ITEMS, allChecked, deriveAlerts({ ...CLEAN, apiOk: false }));
  assert.equal(v.go, false);
  assert.ok(v.blockers.some(b => b.includes('not responding')));
});

test('a sandbox build can NEVER be declared GO', () => {
  // The load-bearing test of this whole module.
  const v = computeVerdict(ITEMS, allChecked, deriveAlerts({ ...CLEAN, isSandbox: true }));
  assert.equal(v.go, false, 'a demo build must never report GO');
});

test('a warning-level alert does not block launch', () => {
  const v = computeVerdict(ITEMS, allChecked, deriveAlerts({ ...CLEAN, merchantsAtRisk: 3 }));
  assert.equal(v.go, true);
});

test('blockers are reported in both languages, same length', () => {
  const v = computeVerdict(ITEMS, {}, deriveAlerts({ ...CLEAN, apiOk: false }));
  assert.equal(v.blockers.length, v.blockersAr.length);
  assert.ok(v.blockers.length > 0);
});

// ── Incident timing ───────────────────────────────────────────────────────────
const T0 = '2026-07-20T10:00:00.000Z';
const NOW = Date.parse('2026-07-20T12:30:00.000Z');

test('incident timing measures from detection to each milestone', () => {
  const t = incidentTiming({
    detected_at: T0,
    acknowledged_at: '2026-07-20T10:12:00.000Z',
    resolved_at: '2026-07-20T11:00:00.000Z',
  }, NOW);
  assert.equal(t.toAcknowledge, 12);
  assert.equal(t.toResolve, 60);
  assert.equal(t.openFor, null); // resolved incidents are not "open for" anything
});

test('an unresolved incident reports how long it has been open', () => {
  const t = incidentTiming({ detected_at: T0, acknowledged_at: null, resolved_at: null }, NOW);
  assert.equal(t.toAcknowledge, null);
  assert.equal(t.toResolve, null);
  assert.equal(t.openFor, 150);
});

test('incident timing is deterministic and never reads a clock', () => {
  const i = { detected_at: T0, acknowledged_at: null, resolved_at: null };
  assert.equal(incidentTiming(i, NOW).openFor, incidentTiming(i, NOW).openFor);
});

test('an unparseable timestamp yields nulls, never a wrong number', () => {
  const t = incidentTiming({ detected_at: 'not-a-date', acknowledged_at: null, resolved_at: null }, NOW);
  assert.deepEqual(t, { toAcknowledge: null, toResolve: null, openFor: null });
});

// ── SLA ───────────────────────────────────────────────────────────────────────
test('SLA statuses match the vocabulary the database actually uses', () => {
  // The regression this guards: the monitor previously watched 'confirmed' and
  // 'delivering', which exist nowhere in this schema, and missed 'accepted' and
  // 'on_the_way' — the two states most likely to be breaching.
  assert.deepEqual([...ACTIVE_ORDER_STATUSES], ['pending', 'accepted', 'preparing', 'on_the_way']);
  assert.ok(!ACTIVE_ORDER_STATUSES.includes('confirmed' as never));
  assert.ok(!ACTIVE_ORDER_STATUSES.includes('delivering' as never));
  assert.deepEqual([...FAILED_ORDER_STATUSES], ['cancelled', 'rejected']);
});

test('breach detection is strictly past the target, not at it', () => {
  const created = '2026-07-20T12:00:00.000Z';
  const at45 = Date.parse('2026-07-20T12:45:00.000Z');
  const at46 = Date.parse('2026-07-20T12:46:00.000Z');
  assert.equal(isBreaching(created, 45, at45), false);
  assert.equal(isBreaching(created, 45, at46), true);
});

test('an unparseable created_at never counts as a breach', () => {
  assert.equal(isBreaching('', 45, NOW), false);
  assert.equal(isBreaching('garbage', 45, NOW), false);
});
