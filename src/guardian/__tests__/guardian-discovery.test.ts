import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Guardian, counterIds, silentLogger, djb2Hasher } from '../index';
import type { Clock } from '../index';
import {
  DiscoveryEngine, createDiscoveryModule, DISCOVERY_SERVICES, KnowledgeGraph, DigitalTwin,
  DiscoveryRegistry, buildGraph, RepositoryAnalyzer, layerOf, fingerprint, diffFingerprint,
  scanAll, allSources, nodeId,
} from '../discovery/index';
import type { RepositoryReader, SchemaReader } from '../discovery/index';
import { createNodeRepositoryReader } from '../discovery/adapters/nodeRepositoryReader';

let t = 1_700_000_000_000;
const clock: Clock = { now: () => t, iso: () => new Date(t).toISOString() };

// ── A miniature HAAT-NOW-shaped repo (mirrors the real layering) ─────────────
const FILES: Record<string, string> = {
  'src/main.tsx': `import { App } from './App';`,
  'src/App.tsx': `import { OrdersPage } from './features/orders/OrdersPage';`,
  'src/features/orders/OrdersPage.tsx': `import { orderService } from '../../services/order.service';`,
  'src/features/wallet/WalletPage.tsx': `import { walletService } from '../../services/wallet.service';`,
  'src/services/order.service.ts': `
    import { orderRepository } from '../repositories/order.repository';
    import { walletService } from './wallet.service';
    export const orderService = {
      async create() { await supabase.from('orders').insert({}); await supabase.rpc('create_order_atomic'); },
      emit() { bus.emit('order.created', {}); },
      key: import.meta.env.VITE_SUPABASE_URL,
    };`,
  'src/services/wallet.service.ts': `
    import { walletRepository } from '../repositories/wallet.repository';
    export const walletService = { async credit() { await supabase.from('wallets').update({}); } };`,
  'src/services/orphan.service.ts': `export const orphanService = { noop() {} };`,
  'src/repositories/order.repository.ts': `import { supabase } from '../lib/supabase'; export const orderRepository = { all() { return supabase.from('orders').select(); } };`,
  'src/repositories/wallet.repository.ts': `import { supabase } from '../lib/supabase'; export const walletRepository = { all() { return supabase.from('wallets').select(); } };`,
  'src/lib/supabase.ts': `export const supabase = {} as any;`,
  'src/features/website/routes.ts': `
    export const APP_ROUTE_PREFIX = '/app';
    export const CONSOLE_ROUTES = ['/console', '/admin/login'];`,
  'src/services/website.service.ts': `const pages = [{ path: '/' }, { path: '/offers' }];`,
};

const reader: RepositoryReader = {
  listFiles: () => Object.keys(FILES).sort(),
  read: (p) => FILES[p] ?? null,
};

const schema: SchemaReader = {
  tables: () => [
    { name: 'orders', schema: 'public', rls: true, rows: 10 },
    { name: 'wallets', schema: 'public', rls: true, rows: 4 },
    { name: 'ghost_table', schema: 'public', rls: false, rows: 0 },
  ],
  views: () => [],
  relations: () => [{ fromTable: 'orders', fromColumn: 'wallet_id', toTable: 'wallets', toColumn: 'id' }],
  indexes: () => [],
  policies: () => [{ name: 'orders_read', table: 'orders' }],
  functions: () => [{ name: 'create_order_atomic', kind: 'function' }, { name: 'never_called_rpc', kind: 'function' }],
  buckets: () => [{ id: 'avatars', public: true }],
  edgeFunctions: () => [{ slug: 'payment-initiate', verifyJwt: true, status: 'ACTIVE' }],
};

const newEngine = () => new DiscoveryEngine({ ports: { repository: reader, schema, env: { keys: () => ['VITE_SUPABASE_URL', 'MOYASAR_SECRET_KEY'] } }, hasher: djb2Hasher });

// ── analyzer ────────────────────────────────────────────────────────────────
test('analyzer: resolves imports, layers, coupling, dead code, cycles', () => {
  const a = new RepositoryAnalyzer(reader);
  const files = a.parse();
  assert.equal(files.length, Object.keys(FILES).length);

  const orderSvc = files.find(f => f.path === 'src/services/order.service.ts')!;
  assert.deepEqual(orderSvc.imports, ['src/repositories/order.repository.ts', 'src/services/wallet.service.ts'], 'relative imports resolved');
  assert.equal(orderSvc.layer, 'service');
  assert.equal(layerOf('src/features/orders/OrdersPage.tsx'), 'feature');
  assert.equal(layerOf('src/guardian/kernel/kernel.ts'), 'guardian');

  const f = a.analyze({ hash: djb2Hasher.hash });
  assert.equal(f.circular.length, 0, 'fixture has no cycles');
  assert.ok(f.unusedFiles.includes('src/services/orphan.service.ts'), 'dead code detected');
  assert.ok(!f.unusedFiles.includes('src/main.tsx'), 'entry point is not dead');
  assert.ok(f.totalLoc > 0);
  const supa = f.coupling.find(c => c.path === 'src/lib/supabase.ts');
  assert.equal(supa?.fanIn, 2, 'fan-in counted');
});

test('analyzer: detects a circular dependency', () => {
  const cyc: Record<string, string> = {
    'src/services/a.service.ts': `import { b } from './b.service';`,
    'src/services/b.service.ts': `import { a } from './a.service';`,
  };
  const r: RepositoryReader = { listFiles: () => Object.keys(cyc), read: p => cyc[p] ?? null };
  const f = new RepositoryAnalyzer(r).analyze({ hash: djb2Hasher.hash });
  assert.equal(f.circular.length, 1);
  assert.deepEqual(f.circular[0], ['src/services/a.service.ts', 'src/services/b.service.ts']);
});

test('analyzer: type-only imports are erased → never a runtime cycle', () => {
  // `import type` is removed by the compiler, so a type-only loop is NOT a runtime cycle.
  // (Both cycles initially reported in the real repo were exactly this class.)
  const cyc: Record<string, string> = {
    'src/services/a.service.ts': `import type { B } from './b.service';\nexport type A = { b?: B };`,
    'src/services/b.service.ts': `import type { A } from './a.service';\nexport type B = { a?: A };`,
  };
  const r: RepositoryReader = { listFiles: () => Object.keys(cyc), read: p => cyc[p] ?? null };
  const a = new RepositoryAnalyzer(r);
  const files = a.parse();
  assert.deepEqual(files[0].imports, [], 'type import is not a runtime import');
  assert.deepEqual(files[0].typeImports, ['src/services/b.service.ts'], 'tracked separately');
  assert.equal(a.analyze({ hash: djb2Hasher.hash }).circular.length, 0, 'no runtime cycle reported');
});

test('analyzer: test files are exempt from layer rules', () => {
  const t: Record<string, string> = {
    'src/website-platform/__tests__/x.test.ts': `import { r } from '../../features/website/routes';`,
    'src/features/website/routes.ts': `export const r = 1;`,
  };
  const r: RepositoryReader = { listFiles: () => Object.keys(t), read: p => t[p] ?? null };
  const f = new RepositoryAnalyzer(r).analyze({ hash: djb2Hasher.hash });
  assert.equal(f.layerViolations.length, 0, 'a test may reach across layers');
});

test('analyzer: flags a layer violation (feature → lib/supabase)', () => {
  const bad: Record<string, string> = {
    'src/features/x/Bad.tsx': `import { supabase } from '../../lib/supabase';`,
    'src/lib/supabase.ts': `export const supabase = {};`,
  };
  const r: RepositoryReader = { listFiles: () => Object.keys(bad), read: p => bad[p] ?? null };
  const f = new RepositoryAnalyzer(r).analyze({ hash: djb2Hasher.hash });
  assert.equal(f.layerViolations.length, 1);
  assert.match(f.layerViolations[0].rule, /features must not import lib\/supabase/);
});

test('analyzer: detects duplicate logic (identical bodies)', () => {
  const body = `export const thing = { doWork() { return ${'x'.repeat(220)}; } };`;
  const dup: Record<string, string> = { 'src/services/one.service.ts': body, 'src/services/two.service.ts': body };
  const r: RepositoryReader = { listFiles: () => Object.keys(dup), read: p => dup[p] ?? null };
  const f = new RepositoryAnalyzer(r).analyze({ hash: djb2Hasher.hash });
  assert.equal(f.duplicates.length, 1);
  assert.deepEqual(f.duplicates[0].paths, ['src/services/one.service.ts', 'src/services/two.service.ts']);
});

// ── scanners / registry ─────────────────────────────────────────────────────
test('scanners: build the unified inventory from ports', () => {
  const files = new RepositoryAnalyzer(reader).parse();
  const inv = scanAll({ files, repository: reader, schema, env: { keys: () => ['MOYASAR_SECRET_KEY'] } });

  assert.ok(inv.services.some(s => s.key === 'order.service' && s.kind === 'service'));
  assert.ok(inv.services.some(s => s.key === 'order.repository' && s.kind === 'repository'));
  assert.ok(inv.features.some(f => f.key === 'orders'));
  assert.ok(inv.routes.some(r => r.path === '/app' && r.surface === 'app'));
  assert.ok(inv.routes.some(r => r.path === '/console' && r.surface === 'console'));
  assert.ok(inv.routes.some(r => r.path === '/offers' && r.surface === 'public'));
  assert.ok(inv.apis.some(a => a.key === 'rpc:create_order_atomic'));
  assert.ok(inv.apis.some(a => a.key === 'edge:payment-initiate'));
  assert.equal(inv.tables.length, 3);
  assert.ok(inv.events.some(e => e.key === 'order.created'));
  assert.ok(inv.integrations.some(i => i.key === 'supabase'));

  // SECURITY: secret keys are catalogued, values never touched
  const secret = inv.env.find(e => e.key === 'MOYASAR_SECRET_KEY');
  assert.ok(secret, 'secret key discovered');
  assert.equal(secret!.secret, true, 'flagged as secret');
  assert.equal(JSON.stringify(inv).includes('sk_live'), false, 'no secret value anywhere in the inventory');
});

// ── graph ───────────────────────────────────────────────────────────────────
test('graph: nodes, typed edges, dedupe, no self/dangling edges', () => {
  const g = new KnowledgeGraph();
  g.addNode({ id: 'service:a', type: 'service', key: 'a', label: 'a' });
  g.addNode({ id: 'service:a', type: 'service', key: 'a', label: 'a', tags: ['x'] });   // merge
  g.addNode({ id: 'table:t', type: 'table', key: 't', label: 't' });
  assert.equal(g.allNodes().length, 2, 'node add is idempotent');
  assert.deepEqual(g.node('service:a')?.tags, ['x'], 'meta merged');

  assert.equal(g.addEdge({ from: 'service:a', to: 'table:t', type: 'reads' }), true);
  assert.equal(g.addEdge({ from: 'service:a', to: 'table:t', type: 'reads' }), false, 'edge dedupe');
  assert.equal(g.addEdge({ from: 'service:a', to: 'service:a', type: 'depends_on' }), false, 'no self-edge');
  assert.equal(g.addEdge({ from: 'service:a', to: 'nope:x', type: 'reads' }), false, 'no dangling edge');
  assert.equal(g.stats().edges, 1);
});

test('graph: reachability, impact closure, path, cycles, orphans', () => {
  const g = new KnowledgeGraph();
  for (const id of ['feature:f', 'service:s', 'repository:r', 'table:t', 'service:lonely']) {
    const [type, key] = id.split(':');
    g.addNode({ id, type: type as never, key, label: key });
  }
  g.addEdge({ from: 'feature:f', to: 'service:s', type: 'depends_on' });
  g.addEdge({ from: 'service:s', to: 'repository:r', type: 'depends_on' });
  g.addEdge({ from: 'repository:r', to: 'table:t', type: 'reads' });

  assert.deepEqual(g.reachable('feature:f'), ['repository:r', 'service:s', 'table:t'], 'forward closure = what it needs');
  assert.deepEqual(g.impactOf('table:t'), ['feature:f', 'repository:r', 'service:s'], 'reverse closure = blast radius');
  assert.deepEqual(g.path('feature:f', 'table:t'), ['feature:f', 'service:s', 'repository:r', 'table:t']);
  assert.deepEqual(g.impactOf('table:t', 1), ['repository:r'], 'depth-limited');
  assert.ok(g.orphans().some(n => n.id === 'service:lonely'), 'orphan detected');
  assert.equal(g.cycles().length, 0);
});

// ── build graph from the real inventory ─────────────────────────────────────
test('buildGraph: wires feature → service → repository → table → database', () => {
  const files = new RepositoryAnalyzer(reader).parse();
  const inv = scanAll({ files, repository: reader, schema });
  const g = buildGraph({ inventory: inv, files, read: p => reader.read(p) });

  assert.ok(g.has(nodeId('service', 'order.service')));
  assert.ok(g.has(nodeId('table', 'orders')));
  assert.ok(g.dependenciesOf(nodeId('feature', 'orders')).includes(nodeId('service', 'order.service')), 'feature → service');
  assert.ok(g.dependenciesOf(nodeId('service', 'order.service')).includes(nodeId('service', 'wallet.service')), 'service → service');
  assert.ok(g.dependenciesOf(nodeId('service', 'order.service')).includes(nodeId('repository', 'order.repository')), 'service → repository');
  assert.ok(g.edgesFrom(nodeId('service', 'order.service'), 'writes').some(e => e.to === nodeId('table', 'orders')), 'service writes orders');
  assert.ok(g.dependenciesOf(nodeId('table', 'orders')).includes(nodeId('database', 'primary')), 'table → database');
  assert.ok(g.edgesFrom(nodeId('table', 'orders'), 'relates_to').some(e => e.to === nodeId('table', 'wallets')), 'FK edge');
  assert.ok(g.edgesFrom(nodeId('service', 'order.service'), 'emits').some(e => e.to === nodeId('event', 'order.created')), 'service emits event');
});

// ── digital twin ────────────────────────────────────────────────────────────
test('twin: what depends on Orders / Wallet, blast radius, criticality', () => {
  const e = newEngine();
  e.discover(clock.iso(), clock.now());

  const orders = e.twin.whatDependsOn('orders', 'table');
  assert.equal(orders.exists, true);
  const ids = orders.affected.map(a => a.id);
  assert.ok(ids.includes(nodeId('service', 'order.service')), 'order.service depends on orders');
  assert.ok(ids.includes(nodeId('feature', 'orders')), 'transitively, the orders feature does too');
  assert.equal(orders.criticality, 'critical', 'money-touching + fan-out ⇒ critical');

  const wallet = e.twin.blastRadius('wallets', 'table');
  assert.ok(wallet.affected.map(a => a.id).includes(nodeId('service', 'wallet.service')));

  assert.deepEqual(e.twin.why('feature:orders', 'table:orders').slice(0, 2), ['feature:orders', 'service:order.service']);
  assert.equal(e.twin.whatDependsOn('does-not-exist').exists, false, 'unknown target is honest, not invented');
});

test('twin: if removed, unused services/APIs/tables/routes/jobs', () => {
  const e = newEngine();
  e.discover(clock.iso(), clock.now());

  const rm = e.twin.ifRemoved('order.service', 'service');
  assert.equal(rm.safe, false);
  assert.match(rm.reason, /depend on it/);

  const orphan = e.twin.ifRemoved('orphan.service', 'service');
  assert.equal(orphan.safe, true, 'nothing depends on the orphan → safe to delete');

  assert.ok(e.twin.unusedServices().nodes.some(n => n.id === nodeId('service', 'orphan.service')));
  assert.ok(e.twin.unusedTables().nodes.some(n => n.id === nodeId('table', 'ghost_table')), 'unused table found');
  assert.ok(e.twin.unusedApis().nodes.some(n => n.id === nodeId('api', 'rpc:never_called_rpc')), 'uncalled RPC found');
  assert.equal(e.twin.deadCode().length, 6);

  const hot = e.twin.hotspots(3);
  assert.ok(hot.length > 0 && hot[0].dependents >= hot[hot.length - 1].dependents, 'hotspots ranked');
});

// ── fingerprints ────────────────────────────────────────────────────────────
test('fingerprint: deterministic, and classifies the kind of change', () => {
  const files = new RepositoryAnalyzer(reader).parse();
  const inv = scanAll({ files, repository: reader, schema });
  const g = buildGraph({ inventory: inv, files, read: p => reader.read(p) });

  const a = fingerprint({ files, inventory: inv, graph: g, at: 'T1' }, djb2Hasher);
  const b = fingerprint({ files, inventory: inv, graph: g, at: 'T2' }, djb2Hasher);
  assert.equal(a.composite, b.composite, 'same input ⇒ same fingerprint (time excluded)');
  assert.equal(diffFingerprint(a, b).changed, false);
  assert.match(diffFingerprint(null, a).summary, /baseline/);

  // architectural change: add a service
  const files2 = [...files, { path: 'src/services/new.service.ts', loc: 3, imports: [], typeImports: [], layer: 'service' as const }];
  const inv2 = { ...inv, services: [...inv.services, { key: 'new.service', file: 'src/services/new.service.ts', kind: 'service' as const, exports: [], imports: [], loc: 3 }] };
  const c = fingerprint({ files: files2, inventory: inv2, graph: g, at: 'T3' }, djb2Hasher);
  const d = diffFingerprint(a, c);
  assert.equal(d.changed, true);
  assert.equal(d.architecture, true);
  assert.equal(d.repository, true);
  assert.match(d.summary, /ARCHITECTURE changed/);
});

// ── knowledge sources ───────────────────────────────────────────────────────
test('knowledge sources: produce facts, never leak secret values', async () => {
  const e = newEngine();
  e.discover(clock.iso(), clock.now());
  const sources = allSources(e.registry, e.graph);
  assert.equal(sources.length, 10, 'ten discovery sources');

  const k = new (await import('../kernel/knowledge')).KnowledgeEngine(clock);
  for (const s of sources) k.addSource(s);
  const r = await k.index();
  assert.equal(r.ok, true);
  assert.ok(k.size() > 0);

  const table = k.query({ facets: ['table'], text: 'orders' })[0];
  assert.ok(table, 'table fact indexed');
  assert.match(table.body, /RLS enabled/);

  const envFacts = k.query({ facets: ['environment'] });
  assert.ok(envFacts.some(f => f.key === 'MOYASAR_SECRET_KEY'));
  assert.ok(envFacts.every(f => !/sk_live|secret_value/i.test(f.body)), 'secret VALUES never indexed');

  const bundle = k.assembleContext({ facets: ['architecture'] }, 8000);
  assert.ok(bundle.facts.length > 0);
  assert.ok(bundle.sources.includes('discovery.architecture'), 'provenance tagged');
});

// ── kernel integration ──────────────────────────────────────────────────────
test('module: Guardian.use(discovery) boots, provides services, indexes knowledge', async () => {
  const g = Guardian.create({ ports: { clock, ids: counterIds(), logger: silentLogger, hasher: djb2Hasher } });
  g.use(createDiscoveryModule({ ports: { repository: reader, schema }, hasher: djb2Hasher }));
  const r = await g.start();
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.started, ['guardian.discovery']);

  const twin = g.registry.resolve<DigitalTwin>(DISCOVERY_SERVICES.twin);
  const reg = g.registry.resolve<DiscoveryRegistry>(DISCOVERY_SERVICES.registry);
  assert.ok(twin && reg, 'services published to the locator');
  assert.ok(reg!.counts().services > 0);

  const idx = await g.knowledge.index();
  assert.equal(idx.ok, true);
  assert.ok(g.knowledge.size() > 0, 'discovery facts landed in the kernel Knowledge Engine');

  // discovery is audited through the kernel's chain
  assert.ok(g.audit.list({ limit: 200 }).some(e => e.action === 'discovery.completed'));
  assert.equal(g.audit.verify().ok, true);

  const d = twin!.describe();
  assert.ok(d.graph.nodes > 0 && d.graph.edges > 0);
  await g.stop();
});

test('engine: degrades gracefully with no ports (never throws)', () => {
  const e = new DiscoveryEngine({ ports: {}, hasher: djb2Hasher });
  const r = e.discover('T', 0);
  assert.equal(r.graph.nodes, 0);
  assert.equal(r.inventory.services.length, 0);
  assert.ok(r.fingerprint.composite.length > 0, 'still fingerprints an empty platform');
});

// ── the real repository (proof it works on HAAT NOW itself) ─────────────────
test('LIVE: discovers the real HAAT NOW repository', () => {
  const root = process.cwd();
  const live = createNodeRepositoryReader({ root, include: ['src'], extensions: ['.ts', '.tsx'] });
  const e = new DiscoveryEngine({ ports: { repository: live }, hasher: djb2Hasher });
  const r = e.discover(clock.iso(), clock.now());

  assert.ok(r.inventory.services.length >= 40, `expected the real service layer, got ${r.inventory.services.length}`);
  assert.ok(r.inventory.features.length >= 10, `expected the real features, got ${r.inventory.features.length}`);
  assert.ok(r.graph.nodes > 50 && r.graph.edges > 50, 'a real graph was built');
  assert.ok(r.findings!.totalLoc > 10_000, 'real LOC counted');

  // the twin knows the real platform
  const twin = e.twin;
  const orderSvc = twin.resolve('order.service', 'service');
  assert.ok(orderSvc, 'found the real order.service');
  assert.ok(twin.whatDependsOn('order.service', 'service').affected.length > 0, 'real dependents found');
  assert.ok(r.fingerprint.repository.length > 0 && r.fingerprint.architecture.length > 0);
});
