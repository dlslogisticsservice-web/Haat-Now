// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Phase 8 validation for the Product Wiring Sprint.
//
// Runs a real discovery pass over the working tree and prints the architectural
// facts the sprint must not regress: dependency graph size, runtime cycles, layer
// violations, duplicate logic, route table and the repository fingerprint.
//
//   npx tsx docs/testing/guardian_validate.ts
// ─────────────────────────────────────────────────────────────────────────────
import { DiscoveryEngine } from '../../src/guardian/discovery/engine';
import { createNodeRepositoryReader } from '../../src/guardian/discovery/adapters/nodeRepositoryReader';
import { writeFileSync } from 'node:fs';

/**
 * Architecture baseline, verified by discovering a clean worktree at c233720 (the commit
 * before the Product Wiring Sprint) and diffing the sets architecturePrint() hashes: the
 * result was byte-identical to the post-sprint tree, so the sprint moved no structure.
 * `composite` intentionally has no baseline — it changes on every code edit by design.
 */
const BASELINE = { architecture: 'fa958e32' };

const ROOT = process.argv[2] ?? process.cwd();
const DUMP = process.argv[3];   // optional: write the architecture sets here for diffing

const engine = new DiscoveryEngine({ ports: { repository: createNodeRepositoryReader({ root: ROOT }) } });
const r = engine.discover(new Date().toISOString(), 0);
const f = r.findings!;
const fp = r.fingerprint as unknown as Record<string, string>;

const line = (k: string, v: unknown) => console.log(`  ${k.padEnd(26)} ${String(v)}`);

console.log('\n═══ Guardian · Repository Discovery ═══');
line('files', f.files);
line('total LOC', f.totalLoc);
line('graph nodes / edges', `${r.graph.nodes} / ${r.graph.edges}`);
line('services', r.inventory.services.length);
line('features', r.inventory.features.length);
line('routes', r.inventory.routes.length);

console.log('\n═══ Architecture health (must stay zero) ═══');
line('runtime circular deps', f.circular.length);
if (f.circular.length) console.log(JSON.stringify(f.circular, null, 2));
line('layer violations', f.layerViolations.length);
if (f.layerViolations.length) console.log(JSON.stringify(f.layerViolations, null, 2));
line('duplicate logic blocks', f.duplicates.length);
if (f.duplicates.length) console.log(JSON.stringify(f.duplicates.map(d => d.paths), null, 2));

console.log('\n═══ Blast radius of the touched files ═══');
for (const p of [
  'src/features/home/HomeScreen.tsx',
  'src/features/restaurant/RestaurantScreen.tsx',
  'src/App.tsx',
  'src/i18n/index.ts',
  'src/services/home.service.ts',
  'src/repositories/catalog.repository.ts',
]) {
  const c = f.coupling.find(x => x.path === p);
  const inbound = c ? c.fanIn : (engine.registry as any)?.files?.filter?.((x: any) => x.imports.includes(p)).length ?? 0;
  line(p.replace('src/', ''), c ? `fanIn=${c.fanIn} fanOut=${c.fanOut}` : `fanIn=${inbound} (not in top-25 coupling)`);
}

console.log('\n═══ Fingerprint vs verified pre-sprint baseline ═══');
line('composite', `${fp.composite}  (changes on any edit — not a regression signal)`);
line('architecture', `${fp.architecture}  (baseline ${BASELINE.architecture})`);
line('architecture drift?', fp.architecture === BASELINE.architecture ? 'NONE — structure identical' : 'YES — inspect the sets above');

// The exact sets architecturePrint() hashes — dumped so two trees can be diffed.
if (DUMP) {
  const inv = r.inventory;
  writeFileSync(DUMP, JSON.stringify({
    services: inv.services.map(s => `${s.kind}:${s.key}`).sort(),
    features: inv.features.map(x => x.key).sort(),
    routes: inv.routes.map(x => x.key).sort(),
    apis: inv.apis.map(x => x.key).sort(),
    tables: inv.tables.map(t => t.name).sort(),
    events: inv.events.map(e => e.key).sort(),
    permissions: inv.permissions.map(p => p.key).sort(),
    jobs: inv.jobs.map(j => j.key).sort(),
    integrations: inv.integrations.map(i => i.key).sort(),
    env: inv.env.map(e => e.key).sort(),
  }, null, 1));
  console.log(`\n(architecture sets → ${DUMP})`);
}

const regressions = f.circular.length + f.layerViolations.length;
console.log(`\n═══ ${regressions === 0 ? 'PASS' : 'FAIL'} — ${regressions} architectural regression(s) ═══\n`);
process.exit(regressions === 0 ? 0 : 1);
