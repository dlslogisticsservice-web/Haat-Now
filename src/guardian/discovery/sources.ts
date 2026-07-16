// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Knowledge Sources.
//
// Each source turns one discovered slice into kernel FACTS. These are what a future
// AI Engine consumes — nothing else. No AI here; this is the substrate.
//
// Sources are PULL-based (kernel contract) and read from the DiscoveryRegistry, so
// they never re-scan and never disagree with the graph.
// ─────────────────────────────────────────────────────────────────────────────
import type { FactInput, KnowledgeSource } from '../kernel/knowledge';
import type { DiscoveryRegistry } from './registry';
import type { KnowledgeGraph } from './graph';
import { nodeId } from './types';

const mk = (id: string, facets: Parameters<typeof makeSource>[1], collect: () => FactInput[]): KnowledgeSource => makeSource(id, facets, collect);
function makeSource(id: string, facets: KnowledgeSource['facets'], collect: () => FactInput[]): KnowledgeSource {
  return { id, facets, collect };
}

/** service / repository / manager / engine / controller inventory. */
export const servicesSource = (reg: DiscoveryRegistry, g: KnowledgeGraph): KnowledgeSource =>
  mk('discovery.services', ['service', 'dependency', 'ownership'], () =>
    reg.inventory().services.map(s => {
      const id = nodeId(s.kind === 'repository' ? 'repository' : 'service', s.key);
      const deps = g.dependenciesOf(id);
      const dependents = g.dependentsOf(id);
      return {
        facet: 'service',
        key: s.key,
        title: `${s.kind}: ${s.key}`,
        body: `File ${s.file} (${s.loc} LOC). Exports: ${s.exports.slice(0, 12).join(', ') || 'none'}. `
          + `Depends on ${deps.length} node(s). ${dependents.length} node(s) depend on it.`,
        refs: [...deps, ...dependents].slice(0, 40),
        tags: [s.kind],
      } as FactInput;
    }));

export const databaseSource = (reg: DiscoveryRegistry, g: KnowledgeGraph): KnowledgeSource =>
  mk('discovery.database', ['database', 'table', 'relation'], () => {
    const inv = reg.inventory();
    const facts: FactInput[] = inv.tables.map(t => {
      const id = nodeId('table', t.name);
      const readers = g.dependentsOf(id);
      const rel = inv.relations.filter(r => r.fromTable === t.name || r.toTable === t.name);
      return {
        facet: 'table',
        key: t.name,
        title: `table ${t.name}`,
        body: `Schema ${t.schema}. RLS ${t.rls ? 'enabled' : 'DISABLED'}. `
          + `${readers.length} service(s) touch it. ${rel.length} relation(s).`,
        refs: readers.slice(0, 30),
        tags: t.rls ? ['rls'] : ['rls-disabled'],
      };
    });
    for (const r of inv.relations) {
      facts.push({
        facet: 'relation', key: `${r.fromTable}.${r.fromColumn}->${r.toTable}.${r.toColumn}`,
        title: `FK ${r.fromTable} → ${r.toTable}`,
        body: `${r.fromTable}.${r.fromColumn} references ${r.toTable}.${r.toColumn}`,
        refs: [nodeId('table', r.fromTable), nodeId('table', r.toTable)],
      });
    }
    return facts;
  });

export const apiSource = (reg: DiscoveryRegistry, g: KnowledgeGraph): KnowledgeSource =>
  mk('discovery.api', ['api'], () =>
    reg.inventory().apis.map(a => ({
      facet: 'api', key: a.key, title: `${a.kind} ${a.name}`,
      body: `${a.kind} '${a.name}' declared at ${a.origin}. Callers: ${g.dependentsOf(nodeId('api', a.key)).length}.`,
      refs: g.dependentsOf(nodeId('api', a.key)).slice(0, 20), tags: [a.kind],
    })));

export const routesSource = (reg: DiscoveryRegistry): KnowledgeSource =>
  mk('discovery.routes', ['route'], () =>
    reg.inventory().routes.map(r => ({
      facet: 'route', key: r.key, title: `route ${r.path}`,
      body: `Surface '${r.surface}', declared in ${r.origin}.`, tags: [r.surface],
    })));

export const permissionsSource = (reg: DiscoveryRegistry): KnowledgeSource =>
  mk('discovery.permissions', ['business_rule', 'ownership'], () =>
    reg.inventory().permissions.map(p => ({
      facet: 'business_rule', key: `permission:${p.key}`, title: `permission ${p.key}`,
      body: `Authorization key '${p.key}' enforced from ${p.origin}.`, tags: ['permission'],
    })));

export const environmentSource = (reg: DiscoveryRegistry): KnowledgeSource =>
  mk('discovery.environment', ['environment'], () =>
    reg.inventory().env.map(e => ({
      facet: 'environment', key: e.key,
      title: `env ${e.key}`,
      // SECURITY: keys + provenance only. A VALUE is never read, indexed or hashed.
      body: `Environment key '${e.key}' used from ${e.origin}. ${e.secret ? 'SECRET — value never indexed.' : 'Non-secret.'}`,
      tags: e.secret ? ['secret'] : ['config'],
    })));

export const integrationSource = (reg: DiscoveryRegistry): KnowledgeSource =>
  mk('discovery.integrations', ['dependency', 'configuration'], () =>
    reg.inventory().integrations.map(i => ({
      facet: 'dependency', key: `integration:${i.key}`, title: `integration ${i.key}`,
      body: `External ${i.category} integration '${i.key}', referenced at ${i.origin}. Configured: ${i.configured ? 'yes' : 'unknown'}.`,
      tags: [i.category],
    })));

export const websiteSource = (reg: DiscoveryRegistry): KnowledgeSource =>
  mk('discovery.website', ['route', 'architecture'], () => {
    const routes = reg.inventory().routes.filter(r => r.surface === 'public');
    return [{
      facet: 'architecture', key: 'website-platform',
      title: 'Website platform',
      body: `Public website surface with ${routes.length} route(s). Studio and public render through one shared block renderer (single rendering engine).`,
      refs: routes.map(r => nodeId('route', r.key)).slice(0, 30), tags: ['website'],
    }];
  });

export const deploymentSource = (reg: DiscoveryRegistry): KnowledgeSource =>
  mk('discovery.deployment', ['deployment'], () => {
    const d = reg.inventory().deployment;
    if (!d) return [];
    return [{
      facet: 'deployment', key: d.sha,
      title: `deployment ${d.shortSha ?? d.sha.slice(0, 7)}`,
      body: `Env ${d.env ?? 'unknown'}, built ${d.builtAt ?? 'unknown'}. Current production build.`,
      tags: ['release'],
    }];
  });

export const architectureSource = (reg: DiscoveryRegistry, g: KnowledgeGraph): KnowledgeSource =>
  mk('discovery.architecture', ['architecture', 'dependency'], () => {
    const a = reg.analysis();
    const s = g.stats();
    const facts: FactInput[] = [{
      facet: 'architecture', key: 'overview',
      title: 'HAAT NOW architecture overview',
      body: `${reg.counts().services} services, ${reg.counts().features} features, ${reg.counts().tables} tables, `
        + `${reg.counts().apis} APIs, ${reg.counts().routes} routes. Graph: ${s.nodes} nodes / ${s.edges} edges. `
        + `Layers: app → feature → service → repository → lib/supabase.`,
      tags: ['overview'],
    }];
    if (a) {
      facts.push({
        facet: 'architecture', key: 'health',
        title: 'Architecture health',
        body: `${a.files} code files, ${a.totalLoc} LOC. Circular dependencies: ${a.circular.length}. `
          + `Unused files: ${a.unusedFiles.length}. Large files (>=500 LOC): ${a.largeFiles.length}. `
          + `Duplicate bodies: ${a.duplicates.length}. Layer violations: ${a.layerViolations.length}.`,
        tags: ['analysis'],
      });
      for (const v of a.layerViolations.slice(0, 20)) {
        facts.push({
          facet: 'architecture', key: `violation:${v.from}->${v.to}`,
          title: 'Layer violation', body: `${v.from} imports ${v.to} — ${v.rule}`, tags: ['violation'],
        });
      }
    }
    return facts;
  });

/** Every source, in one call. */
export const allSources = (reg: DiscoveryRegistry, g: KnowledgeGraph): KnowledgeSource[] => [
  architectureSource(reg, g), servicesSource(reg, g), databaseSource(reg, g), apiSource(reg, g),
  routesSource(reg), permissionsSource(reg), environmentSource(reg), integrationSource(reg),
  websiteSource(reg), deploymentSource(reg),
];
