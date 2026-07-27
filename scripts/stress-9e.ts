// Phase 9E — production stress benchmark for the Website Studio engines.
// Pure-engine load test (no DOM): BuilderStore data engine + query engine + expression engine +
// seed generator + component tree. Prints wall-clock timings at enterprise scale. Run:
//   npx tsx scripts/stress-9e.ts
import '../src/component-platform/components'; // register the component library (side-effect)
import { BuilderStore } from '../src/component-platform/BuilderStore';

const ms = (fn: () => void): number => { const t = performance.now(); fn(); return +(performance.now() - t).toFixed(1); };
const row = (name: string, val: string) => console.log(`  ${name.padEnd(42)} ${val}`);
const heapMB = () => (process.memoryUsage().heapUsed / 1048576).toFixed(1);

console.log('\n══════════ HAAT NOW Website Studio · Phase 9E Stress Benchmark ══════════\n');
const store = new BuilderStore();

// ── 1. Component tree: 5,000 components ──
const t1 = ms(() => { for (let i = 0; i < 5000; i++) store.insert('spacer', 'root'); });
row('Insert 5,000 components', `${t1}ms  (${(t1 / 5).toFixed(2)}ms/1k)`);
const t1b = ms(() => { store.getRoot().children.length; });
row('Read tree (5,000 nodes)', `${t1b}ms`);

// ── 2. Data: install HAAT schema + 100,000 records ──
store.installHaatModels(0);
const orders = store.entities().find(e => e.name === 'Orders')!;
const t2 = ms(() => { store.generateSeed(orders.id, 100000); });
row('Seed 100,000 records', `${t2}ms  (${(t2 / 100).toFixed(2)}ms/1k)`);
row('Total records', store.records(orders.id, { includeArchived: true }).length.toLocaleString());

// ── 3. Query + filter over 100k ──
const t3 = ms(() => { for (let i = 0; i < 20; i++) store.query({ entityId: orders.id, select: [], where: { combinator: 'AND', conditions: [{ field: 'status', op: 'eq', value: 'active' }] }, sort: [{ field: 'total', dir: 'desc' }], limit: 50 }); });
row('20 filtered+sorted queries / 100k', `${t3}ms  (${(t3 / 20).toFixed(1)}ms each)`);
const t3b = ms(() => { store.query({ entityId: orders.id, select: [], where: { combinator: 'AND', conditions: [] }, sort: [], aggregate: { fn: 'sum', field: 'total' } }); });
row('Aggregate sum over 100k', `${t3b}ms`);

// ── 4. Expressions + bindings: 1,000 evaluations ──
store.addVariable({ name: 'count', scope: 'global', type: 'number', value: 7 });
store.addVariable({ name: 'name', scope: 'global', type: 'string', value: 'HAAT' });
const t4 = ms(() => { for (let i = 0; i < 1000; i++) store.evalExpr('upper(var.name) + " " + (var.count * 2 + len(var.name))'); });
row('1,000 expression evaluations', `${t4}ms  (${(t4 / 1000).toFixed(3)}ms each)`);

// ── 5. Undo / Redo on a large state ──
const t5 = ms(() => { store.undo(); });
row('Undo (large state snapshot)', `${t5}ms`);
const t5b = ms(() => { store.redo(); });
row('Redo (large state snapshot)', `${t5b}ms`);

// ── 6. Import 10k rows with validation ──
const rows = Array.from({ length: 10000 }, (_, i) => ({ title: `row ${i}`, active: true }));
const t6 = ms(() => { store.importRows(orders.id, rows); });
row('Import 10,000 rows (validated)', `${t6}ms`);

// ── 7. Health/analyzer over the full model ──
const t7 = ms(() => { store.health(); });
row('Health + analyzer (full model)', `${t7}ms`);

console.log('');
row('Peak heap used', `${heapMB()} MB`);
row('Entities / relations', `${store.entities().length} / ${store.relations().length}`);
console.log('\n═══════════════════════════════════════════════════════════════════════\n');
