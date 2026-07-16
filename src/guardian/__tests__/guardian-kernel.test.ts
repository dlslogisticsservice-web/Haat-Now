import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Guardian, EventBus, ConfigStore, AuditLog, PermissionRegistry, applyKernelPolicy,
  HealthEngine, KnowledgeEngine, AiRegistry, worstStatus, maxSeverity,
  counterIds, silentLogger, djb2Hasher,
} from '../index';
import type { GuardianModule, AiProvider, KnowledgeSource, Clock } from '../index';

// Deterministic ports — the kernel owns no clock/ids of its own, so tests are exact.
let t = 1_700_000_000_000;
const clock: Clock = { now: () => t, iso: () => new Date(t).toISOString() };
const newGuardian = () => Guardian.create({ ports: { clock, ids: counterIds(), logger: silentLogger, hasher: djb2Hasher } });

// ── types / algebra ──────────────────────────────────────────────────────────
test('status algebra: worst-of-children, unknown never reads as green', () => {
  assert.equal(worstStatus(['green', 'green']), 'green');
  assert.equal(worstStatus(['green', 'unknown']), 'unknown');
  assert.equal(worstStatus(['yellow', 'red']), 'red');
  assert.equal(worstStatus(['red', 'yellow', 'green']), 'red');   // yellow never masks red
  assert.equal(maxSeverity('low', 'critical'), 'critical');
});

// ── event bus ────────────────────────────────────────────────────────────────
test('event bus: typed publish/subscribe, wildcard, once, handler isolation', async () => {
  const bus = new EventBus(clock, counterIds(), silentLogger);
  const seen: string[] = [];
  bus.on('order.created', e => { seen.push(`order:${e.payload.orderId}`); });
  bus.onAny(e => { seen.push(`any:${e.type}`); });
  bus.once('order.failed', () => { seen.push('once'); });

  // a throwing handler must NOT break the bus (fail-open)
  bus.on('order.created', () => { throw new Error('bad module'); });

  await bus.emit('order.created', { orderId: 'o1', total: 10 }, 'test');
  await bus.emit('order.failed', { orderId: 'o1', reason: 'x' }, 'test');
  await bus.emit('order.failed', { orderId: 'o2', reason: 'y' }, 'test');

  assert.ok(seen.includes('order:o1'));
  assert.ok(seen.includes('any:order.created'));
  assert.equal(seen.filter(s => s === 'once').length, 1, 'once fires exactly once');
  assert.equal(bus.recent(10)[0].type, 'order.failed');
});

test('event bus: middleware can drop an event', async () => {
  const bus = new EventBus(clock, counterIds(), silentLogger);
  let got = 0;
  bus.use(e => e.type !== 'database.slow');
  bus.on('database.slow', () => { got++; });
  await bus.emit('database.slow', { query: 'q', ms: 900 }, 'test');
  assert.equal(got, 0);
});

// ── config ───────────────────────────────────────────────────────────────────
test('config: namespaced defaults, override precedence, freeze', () => {
  const c = new ConfigStore();
  assert.equal(c.defineNamespace('health', { intervalMs: 60000, enabled: true }).ok, true);
  assert.equal(c.defineNamespace('health', {}).ok, false, 'duplicate namespace rejected');
  assert.equal(c.get('health', 'intervalMs'), 60000);
  c.addSource({ id: 'env', load: () => ({ 'health.intervalMs': 30000 }) });
  assert.equal(c.get('health', 'intervalMs'), 30000, 'source beats default');
  c.set('health', 'intervalMs', 5000);
  assert.equal(c.get('health', 'intervalMs'), 5000, 'override beats source');
  assert.equal(c.getOr('health', 'missing', 'fallback'), 'fallback');
  assert.equal(c.set('nope', 'k', 1).ok, false, 'unknown namespace rejected');
  c.freeze();
  assert.equal(c.set('health', 'intervalMs', 1).ok, false, 'frozen config rejects writes');
});

// ── audit (immutability + tamper evidence) ───────────────────────────────────
test('audit: append-only, frozen entries, hash chain detects tampering', () => {
  const log = new AuditLog(clock, counterIds(), djb2Hasher);
  log.append({ actor: 'kernel', action: 'a' });
  const e2 = log.append({ actor: 'user1', action: 'incident.acked', subject: 'inc_1', reason: 'investigating' });
  log.append({ actor: 'kernel', action: 'c' });

  assert.equal(log.size(), 3);
  assert.equal(log.verify().ok, true, 'clean chain verifies');
  assert.throws(() => { (e2 as unknown as { action: string }).action = 'hacked'; }, 'entries are frozen');

  // simulate storage tampering: mutate the private array through a cast
  const entries = (log as unknown as { entries: { action: string }[] }).entries;
  entries[1] = { ...entries[1], action: 'tampered' };
  const v = log.verify();
  assert.equal(v.ok, false, 'tampering detected');
  if (!v.ok) assert.equal(v.error.brokenAt, 1);
});

// ── permissions ──────────────────────────────────────────────────────────────
test('permissions: fail-closed, super_admin short-circuit, module-defined perms', () => {
  const p = new PermissionRegistry();
  applyKernelPolicy(p);
  const viewer = { id: 'u1', roles: ['guardian_viewer'] };
  const devops = { id: 'u2', roles: ['devops'] };
  const su = { id: 'u3', roles: ['super_admin'] };

  assert.equal(p.can(viewer, 'guardian.view'), true);
  assert.equal(p.can(viewer, 'guardian.health.ack'), false, 'least privilege');
  assert.equal(p.can(devops, 'guardian.health.ack'), true);
  assert.equal(p.can(su, 'anything.at.all'), true, 'super_admin short-circuits');
  assert.equal(p.can(viewer, 'undeclared.permission'), false, 'unknown permission fails closed');
  assert.equal(p.grant('guardian_viewer', 'not.declared').ok, false, 'cannot grant undeclared permission');

  // a module extends the model without touching the kernel
  assert.equal(p.definePermission({ key: 'qa.run', description: 'run suites', owner: 'qa' }).ok, true);
  assert.equal(p.grant('qa_engineer', 'qa.run').ok, true);
  assert.equal(p.can({ id: 'u4', roles: ['qa_engineer'] }, 'qa.run'), true);
});

// ── health engine ────────────────────────────────────────────────────────────
test('health: hysteresis, incident open, ack, escalate, auto-resolve on recovery', async () => {
  const bus = new EventBus(clock, counterIds(), silentLogger);
  const h = new HealthEngine(bus, clock, counterIds());
  const events: string[] = [];
  bus.onAny(e => { events.push(e.type); });

  h.registerCheck({ key: 'api.ping', service: 'api', owner: 'test', hysteresis: 2, escalationMs: [1000, 2000] });
  assert.equal(h.state('api.ping')?.status, 'unknown', 'starts unknown, not green');

  await h.report({ key: 'api.ping', status: 'red' });
  assert.equal(h.state('api.ping')?.status, 'unknown', 'hysteresis: one sample is not a transition');
  await h.report({ key: 'api.ping', status: 'red' });
  assert.equal(h.state('api.ping')?.status, 'red', 'transitions after 2 samples');

  const open = h.listIncidents({ status: 'open' });
  assert.equal(open.length, 1);
  assert.equal(open[0].severity, 'high');
  assert.ok(events.includes('health.incident.opened'));

  // escalation is time-driven and stops at ack
  t += 1500;
  assert.equal(await h.escalateDue(t), 1);
  assert.equal(h.incident(open[0].id)?.escalationLevel, 1);
  await h.acknowledge(open[0].id, 'u1');
  t += 5000;
  assert.equal(await h.escalateDue(t), 0, 'ack stops escalation');

  // recovery auto-resolves
  await h.report({ key: 'api.ping', status: 'green' });
  await h.report({ key: 'api.ping', status: 'green' });
  assert.equal(h.state('api.ping')?.status, 'green');
  assert.equal(h.incident(open[0].id)?.status, 'resolved');
  assert.ok(events.includes('health.recovered'));
});

test('health: severity floor cannot be lowered; roll-up is worst-of', async () => {
  const bus = new EventBus(clock, counterIds(), silentLogger);
  const h = new HealthEngine(bus, clock, counterIds());
  h.registerCheck({ key: 'biz.ledger', service: 'finance', owner: 'test', severityFloor: 'critical' });
  h.registerCheck({ key: 'biz.other', service: 'finance', owner: 'test' });
  await h.report({ key: 'biz.ledger', status: 'yellow' });          // yellow ⇒ medium, but floor is critical
  assert.equal(h.listIncidents({ status: 'open' })[0].severity, 'critical');
  await h.report({ key: 'biz.other', status: 'green' });
  assert.equal(h.serviceStatus('finance'), 'yellow', 'worst-of children');
});

test('health: stale sweep turns a check unknown, never green', async () => {
  const bus = new EventBus(clock, counterIds(), silentLogger);
  const h = new HealthEngine(bus, clock, counterIds());
  h.registerCheck({ key: 'x', service: 's', owner: 't', staleAfterMs: 1000 });
  await h.report({ key: 'x', status: 'green' });
  assert.equal(h.state('x')?.status, 'green');
  t += 5000;
  assert.equal(await h.sweepStale(t), 1);
  assert.equal(h.state('x')?.status, 'unknown');
});

// ── knowledge engine ─────────────────────────────────────────────────────────
test('knowledge: sources index, query, refs expansion, budgeted context bundle', async () => {
  const k = new KnowledgeEngine(clock);
  const src: KnowledgeSource = {
    id: 'db',
    facets: ['table', 'relation'],
    collect: () => [
      { facet: 'table', key: 'orders', title: 'orders table', body: 'customer orders', refs: ['table:wallets'], tags: ['core'] },
      { facet: 'table', key: 'wallets', title: 'wallets table', body: 'driver balances', tags: ['finance'] },
    ],
  };
  assert.equal(k.addSource(src).ok, true);
  assert.equal(k.addSource(src).ok, false, 'duplicate source rejected');

  const r = await k.index();
  assert.equal(r.ok, true);
  assert.equal(k.size(), 2);

  assert.equal(k.query({ text: 'orders' })[0].key, 'orders', 'exact key ranks first');
  assert.equal(k.query({ tags: ['finance'] }).length, 1);
  assert.equal(k.query({ text: 'orders', expandRefs: true }).length, 2, 'refs pull in related facts');
  assert.equal(k.related('table:orders').length, 1, 'graph neighbours');

  const bundle = k.assembleContext({ facets: ['table'] }, 24_000);
  assert.equal(bundle.facts.length, 2);
  assert.deepEqual(bundle.sources, ['db'], 'provenance tagged');
  assert.equal(bundle.truncated, false);

  const tiny = k.assembleContext({ facets: ['table'] }, 40);
  assert.equal(tiny.truncated, true, 'budget enforced');

  // re-index replaces, never duplicates
  await k.index('db');
  assert.equal(k.size(), 2);
});

// ── AI abstraction (no provider implemented) ─────────────────────────────────
test('ai: provider-agnostic routing, capability filtering, failover', async () => {
  const reg = new AiRegistry();
  assert.equal((await reg.complete({ task: 'rca', messages: [] })).ok, false, 'no providers ⇒ explicit failure');

  const flaky: AiProvider = {
    id: 'flaky', models: ['m1'], capabilities: ['text'],
    complete: async () => ({ ok: false, error: 'boom' }),
  };
  const good: AiProvider = {
    id: 'good', models: ['m2'], capabilities: ['text', 'structured'],
    complete: async () => ({ ok: true, value: { providerId: 'good', model: 'm2', text: 'ok', usage: { inputTokens: 1, outputTokens: 1 }, finishReason: 'stop' } }),
  };
  reg.register(flaky); reg.register(good);
  assert.equal(reg.register(flaky).ok, false, 'duplicate provider rejected');

  const res = await reg.complete({ task: 'rca', messages: [] });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.value.providerId, 'good', 'failover past the failing provider');

  // structured requires capability — 'flaky' is filtered out entirely
  assert.deepEqual(reg.resolve('rca', ['structured']).map(p => p.id), ['good']);

  reg.addRule({ task: 'cheap', providers: ['flaky'] });
  assert.deepEqual(reg.resolve('cheap').map(p => p.id), ['flaky'], 'routing rule wins');
});

// ── kernel: extension SDK, lifecycle, discovery ──────────────────────────────
test('kernel: use() → start() boots modules in dependency order', async () => {
  const g = newGuardian();
  const order: string[] = [];
  const base: GuardianModule = { id: 'base', version: '1.0.0', start: () => { order.push('base'); } };
  const mid: GuardianModule = { id: 'mid', version: '1.0.0', dependsOn: ['base'], start: () => { order.push('mid'); } };
  const top: GuardianModule = { id: 'top', version: '1.0.0', dependsOn: ['mid'], start: () => { order.push('top'); } };

  g.use(top).use(base).use(mid);            // registration order is irrelevant
  const r = await g.start();
  assert.equal(r.ok, true);
  assert.deepEqual(order, ['base', 'mid', 'top'], 'topological start order');
  assert.equal(g.phase, 'running');

  const d = g.describe();
  assert.equal(d.modules.length, 3);
  assert.ok(d.modules.every(m => m.state === 'started'));

  const s = await g.stop();
  assert.equal(s.ok, true);
  if (s.ok) assert.deepEqual(s.value.stopped, ['top', 'mid', 'base'], 'reverse order shutdown');
});

test('kernel: missing dependency and cycles fail the boot loudly', async () => {
  const a = Guardian.create({ ports: { clock, ids: counterIds() } });
  a.use({ id: 'x', version: '1', dependsOn: ['ghost'] });
  const r1 = await a.start();
  assert.equal(r1.ok, false);
  if (!r1.ok) assert.match(r1.error, /missing dependency/);

  const b = Guardian.create({ ports: { clock, ids: counterIds() } });
  b.use({ id: 'p', version: '1', dependsOn: ['q'] }).use({ id: 'q', version: '1', dependsOn: ['p'] });
  const r2 = await b.start();
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.match(r2.error, /cycle/);
});

test('kernel: a failing module is isolated — the kernel still boots (fail-open)', async () => {
  const g = newGuardian();
  g.use({ id: 'bad', version: '1', start: () => { throw new Error('module exploded'); } });
  g.use({ id: 'good', version: '1' });
  const r = await g.start();
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value.failed, ['bad']);
    assert.deepEqual(r.value.started, ['good']);
  }
  assert.equal(g.registry.get('bad')?.state, 'failed');
  assert.equal(g.phase, 'running', 'one bad module never takes the kernel down');
});

test('kernel: service discovery + capability peers, no module imports another', async () => {
  const g = newGuardian();
  g.use({
    id: 'provider', version: '1', provides: ['db.reader'], capabilities: ['storage'],
    register: ctx => { ctx.provide('db.reader', { read: () => 'data' }); },
  });
  let found = '';
  let peerIds: string[] = [];
  g.use({
    id: 'consumer', version: '1', dependsOn: ['provider'], capabilities: ['storage'],
    start: ctx => {
      found = ctx.resolve<{ read: () => string }>('db.reader')?.read() ?? 'none';
      peerIds = ctx.peers('storage').map(m => m.id);
    },
  });
  await g.start();
  assert.equal(found, 'data', 'resolved via the locator, not an import');
  assert.deepEqual(peerIds, ['provider'], 'capability discovery excludes self');
  assert.equal(g.registry.listServices().length, 1);
});

test('kernel: duplicate module id and service conflicts are rejected', async () => {
  const g = newGuardian();
  g.use({ id: 'dup', version: '1' }).use({ id: 'dup', version: '2' });
  const r = await g.start();
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /already registered/);

  const g2 = newGuardian();
  g2.use({ id: 'a', version: '1', provides: ['svc'] }).use({ id: 'b', version: '1', provides: ['svc'] });
  const r2 = await g2.start();
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.match(r2.error, /service conflict/);
});

test('kernel: every bus event is audited automatically (modules cannot bypass)', async () => {
  const g = newGuardian();
  g.use({ id: 'm', version: '1', start: ctx => { void ctx.events.emit('order.created', { orderId: 'o9', total: 5 }, 'm'); } });
  await g.start();
  const audited = g.audit.list({ limit: 100 }).map(e => e.action);
  assert.ok(audited.includes('order.created'), 'module event landed in the audit chain');
  assert.ok(audited.includes('guardian.module.started'));
  assert.equal(g.audit.verify().ok, true, 'chain intact');
});

test('kernel: module config + jobs are namespaced and owned', async () => {
  const g = newGuardian();
  let ran = 0;
  g.use({
    id: 'sweeper', version: '1',
    register: ctx => { ctx.defineConfig({ intervalMs: 1000 }); },
    start: ctx => { ctx.defineJob({ id: 'sweep', intervalMs: ctx.config.getOr('sweeper', 'intervalMs', 1000) as number, handler: () => { ran++; } }); },
  });
  await g.start();
  assert.equal(g.jobs.get('sweep')?.def.owner, 'sweeper', 'job provenance stamped by the kernel');

  t += 2000;
  const r = await g.jobs.tick(t);
  assert.deepEqual(r.ran, ['sweep']);
  assert.equal(ran, 1);
  assert.equal(g.jobs.get('sweep')?.state, 'idle');
});

test('kernel: a throwing job is isolated, recorded, and does not wedge', async () => {
  const g = newGuardian();
  g.use({ id: 'j', version: '1', start: ctx => { ctx.defineJob({ id: 'boom', intervalMs: 10, handler: () => { throw new Error('nope'); } }); } });
  await g.start();
  t += 100;
  const r = await g.jobs.tick(t);
  assert.deepEqual(r.failed, ['boom']);
  const rec = g.jobs.get('boom');
  assert.equal(rec?.failures, 1);
  assert.equal(rec?.state, 'idle', 'failure does not wedge the job');
});
