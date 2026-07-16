// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Discovery Registry + Graph Builder.
//
// Registry = the unified inventory (one place to ask "what exists?").
// Builder  = turns that inventory into the Knowledge Graph (nodes + edges).
//
// Edge direction is always "A depends on B" so the reverse closure is the blast
// radius. Every edge must be PROVABLE from source — no speculative links.
// ─────────────────────────────────────────────────────────────────────────────
import type { AnalysisFindings, FileNode, Inventory, NodeType } from './types';
import { emptyInventory, nodeId } from './types';
import { KnowledgeGraph } from './graph';

export class DiscoveryRegistry {
  private inv: Inventory = emptyInventory();
  private findings: AnalysisFindings | null = null;
  private files: FileNode[] = [];
  private at = '';

  set(inventory: Inventory, files: FileNode[], findings: AnalysisFindings, at: string): void {
    this.inv = inventory; this.files = files; this.findings = findings; this.at = at;
  }

  inventory(): Inventory { return this.inv; }
  analysis(): AnalysisFindings | null { return this.findings; }
  fileNodes(): FileNode[] { return this.files; }
  discoveredAt(): string { return this.at; }

  counts(): Record<string, number> {
    return {
      services: this.inv.services.length,
      features: this.inv.features.length,
      routes: this.inv.routes.length,
      apis: this.inv.apis.length,
      tables: this.inv.tables.length,
      views: this.inv.views.length,
      relations: this.inv.relations.length,
      policies: this.inv.policies.length,
      buckets: this.inv.buckets.length,
      edgeFunctions: this.inv.edgeFunctions.length,
      events: this.inv.events.length,
      permissions: this.inv.permissions.length,
      jobs: this.inv.jobs.length,
      integrations: this.inv.integrations.length,
      env: this.inv.env.length,
      files: this.files.length,
    };
  }

  /** Generic lookup used by the twin/AI later. */
  find(type: NodeType, key: string): unknown {
    switch (type) {
      case 'service': case 'repository': return this.inv.services.find(s => s.key === key);
      case 'feature': return this.inv.features.find(f => f.key === key);
      case 'route': return this.inv.routes.find(r => r.key === key || r.path === key);
      case 'api': return this.inv.apis.find(a => a.key === key || a.name === key);
      case 'table': return this.inv.tables.find(t => t.name === key);
      case 'event': return this.inv.events.find(e => e.key === key);
      case 'permission': return this.inv.permissions.find(p => p.key === key);
      case 'job': return this.inv.jobs.find(j => j.key === key);
      case 'integration': return this.inv.integrations.find(i => i.key === key);
      case 'environment': return this.inv.env.find(e => e.key === key);
      case 'storage': return this.inv.buckets.find(b => b.id === key);
      case 'edge_function': return this.inv.edgeFunctions.find(f => f.slug === key);
      default: return undefined;
    }
  }
}

/** Table names referenced by a source file — proof of a data dependency. */
const tableRefs = (src: string, tables: string[]): string[] => {
  const out = new Set<string>();
  for (const t of tables) {
    const re = new RegExp(`\\.from\\(\\s*['"]${t}['"]|\\b${t}\\b(?=\\s*(?:\\(|\\s|$))`, 'i');
    if (new RegExp(`\\.from\\(\\s*['"]${t}['"]`).test(src)) { out.add(t); continue; }
    if (re.test(src) && src.includes(`'${t}'`)) out.add(t);
  }
  return [...out];
};

export interface BuildInput { inventory: Inventory; files: FileNode[]; read: (p: string) => string | null }

/**
 * Build the Digital Twin graph.
 *
 *   feature --depends_on--> service --depends_on--> repository --reads/writes--> table
 *   service --exposes--> api        service --emits--> event      route --renders--> feature
 *   table  --relates_to--> table    permission --guards--> service/api
 *   * --uses--> integration | environment
 */
export function buildGraph(input: BuildInput): KnowledgeGraph {
  const g = new KnowledgeGraph();
  const { inventory: inv, files, read } = input;
  const tableNames = inv.tables.map(t => t.name);

  // ── nodes ────────────────────────────────────────────────────────────────
  // The database node is only created when there is EVIDENCE of a database.
  // Guardian must never invent a platform fact; with no schema port, no DB exists
  // as far as the twin is concerned. (Edges to it are then ignored automatically —
  // addEdge drops edges whose endpoints are unknown.)
  const dbId = nodeId('database', 'primary');
  const hasDatabase = inv.tables.length > 0 || inv.views.length > 0 || inv.edgeFunctions.length > 0 || inv.buckets.length > 0;
  if (hasDatabase) g.addNode({ id: dbId, type: 'database', key: 'primary', label: 'Primary database', origin: 'supabase' });

  for (const s of inv.services) {
    const type: NodeType = s.kind === 'repository' ? 'repository' : 'service';
    g.addNode({ id: nodeId(type, s.key), type, key: s.key, label: s.key, origin: s.file, tags: [s.kind], meta: { loc: s.loc, kind: s.kind } });
  }
  for (const f of inv.features) g.addNode({ id: nodeId('feature', f.key), type: 'feature', key: f.key, label: f.key, origin: f.dir, meta: { files: f.files, loc: f.loc } });
  for (const r of inv.routes) g.addNode({ id: nodeId('route', r.key), type: 'route', key: r.key, label: r.path, origin: r.origin, tags: [r.surface] });
  for (const a of inv.apis) g.addNode({ id: nodeId('api', a.key), type: 'api', key: a.key, label: a.name, origin: a.origin, tags: [a.kind] });
  for (const t of inv.tables) g.addNode({ id: nodeId('table', t.name), type: 'table', key: t.name, label: t.name, origin: 'database', meta: { rls: t.rls, rows: t.rows } });
  for (const v of inv.views) g.addNode({ id: nodeId('view', v.name), type: 'view', key: v.name, label: v.name, origin: 'database' });
  for (const p of inv.policies) g.addNode({ id: nodeId('policy', p.name), type: 'policy', key: p.name, label: p.name, origin: p.table });
  for (const b of inv.buckets) g.addNode({ id: nodeId('storage', b.id), type: 'storage', key: b.id, label: b.id, origin: 'supabase.storage', meta: { public: b.public } });
  for (const ef of inv.edgeFunctions) g.addNode({ id: nodeId('edge_function', ef.slug), type: 'edge_function', key: ef.slug, label: ef.slug, origin: 'supabase/functions' });
  for (const e of inv.events) g.addNode({ id: nodeId('event', e.key), type: 'event', key: e.key, label: e.key, origin: e.origin });
  for (const p of inv.permissions) g.addNode({ id: nodeId('permission', p.key), type: 'permission', key: p.key, label: p.key, origin: p.origin });
  for (const j of inv.jobs) g.addNode({ id: nodeId('job', j.key), type: 'job', key: j.key, label: j.key, origin: j.origin, meta: { schedule: j.schedule } });
  for (const i of inv.integrations) g.addNode({ id: nodeId('integration', i.key), type: 'integration', key: i.key, label: i.key, origin: i.origin, tags: [i.category], meta: { configured: i.configured } });
  for (const e of inv.env) g.addNode({ id: nodeId('environment', e.key), type: 'environment', key: e.key, label: e.key, origin: e.origin, meta: { secret: e.secret } });

  // ── edges ────────────────────────────────────────────────────────────────
  const fileToNode = new Map<string, string>();
  for (const s of inv.services) fileToNode.set(s.file, nodeId(s.kind === 'repository' ? 'repository' : 'service', s.key));

  // service → service/repository (proved by imports)
  for (const s of inv.services) {
    const from = fileToNode.get(s.file)!;
    for (const imp of s.imports) {
      const to = fileToNode.get(imp);
      if (to) g.addEdge({ from, to, type: 'depends_on' });
    }
  }

  // feature → service (any file in the feature importing a service file)
  for (const f of files) {
    const m = /^src\/features\/([^/]+)\//.exec(f.path);
    if (!m) continue;
    const from = nodeId('feature', m[1]);
    if (!g.has(from)) continue;
    for (const imp of f.imports) {
      const to = fileToNode.get(imp);
      if (to) g.addEdge({ from, to, type: 'depends_on' });
    }
  }

  // service/repository → table (reads/writes), and → database
  for (const s of inv.services) {
    const from = fileToNode.get(s.file)!;
    const src = read(s.file);
    if (!src) continue;
    const refs = tableRefs(src, tableNames);
    for (const t of refs) {
      const to = nodeId('table', t);
      if (!g.has(to)) continue;
      const writes = new RegExp(`from\\(\\s*['"]${t}['"]\\s*\\)\\s*\\.(insert|update|upsert|delete)`).test(src);
      g.addEdge({ from, to, type: writes ? 'writes' : 'reads' });
      g.addEdge({ from: to, to: dbId, type: 'depends_on' });
    }
    // service → api (rpc it calls)  ·  service → event (it emits)  ·  service → env/integration
    for (const a of inv.apis) if (a.kind === 'rpc' && new RegExp(`rpc\\(\\s*['"]${a.name}['"]`).test(src)) g.addEdge({ from, to: nodeId('api', a.key), type: 'exposes' });
    for (const e of inv.events) if (src.includes(`'${e.key}'`)) g.addEdge({ from, to: nodeId('event', e.key), type: 'emits' });
    for (const en of inv.env) if (src.includes(en.key)) g.addEdge({ from, to: nodeId('environment', en.key), type: 'uses' });
  }

  // table ↔ table (FK)
  for (const r of inv.relations) {
    const from = nodeId('table', r.fromTable), to = nodeId('table', r.toTable);
    g.addEdge({ from, to, type: 'relates_to', meta: { fromColumn: r.fromColumn, toColumn: r.toColumn } });
  }

  // policy → table  ·  edge function → database
  for (const p of inv.policies) g.addEdge({ from: nodeId('policy', p.name), to: nodeId('table', p.table), type: 'guards' });
  for (const ef of inv.edgeFunctions) g.addEdge({ from: nodeId('edge_function', ef.slug), to: dbId, type: 'depends_on' });

  // route → feature (surface heuristic proved by the routing source)
  for (const r of inv.routes) {
    const from = nodeId('route', r.key);
    const target = r.surface === 'public' ? 'website' : r.surface === 'admin' || r.surface === 'console' ? 'admin' : null;
    if (target && g.has(nodeId('feature', target))) g.addEdge({ from, to: nodeId('feature', target), type: 'renders' });
  }

  // integration ← env (an integration is configured through its env key)
  for (const i of inv.integrations) {
    for (const e of inv.env) {
      if (e.key.toLowerCase().includes(i.key.split('_')[0])) g.addEdge({ from: nodeId('integration', i.key), to: nodeId('environment', e.key), type: 'uses' });
    }
  }

  return g;
}
