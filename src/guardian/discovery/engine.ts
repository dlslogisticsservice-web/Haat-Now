// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Platform Discovery Engine + the Guardian module that installs it.
//
//   Guardian.use(createDiscoveryModule({ repository, schema, env, deployment }))
//
// One pass: parse → scan → build graph → analyze → fingerprint → index knowledge.
// Everything downstream (QA, AI, Launch Guardian) reads the twin — never re-scans.
//
// Plugs into the Phase-1 kernel with ZERO kernel changes: it is just a
// GuardianModule that registers knowledge sources, provides services and a job.
// ─────────────────────────────────────────────────────────────────────────────
import type { GuardianContext } from '../kernel/kernel';
import type { GuardianModule } from '../kernel/registry';
import type { Hasher } from '../kernel/types';
import { djb2Hasher } from '../kernel/types';
import type { DiscoveryPorts, Inventory, FileNode, AnalysisFindings } from './types';
import { emptyInventory } from './types';
import { RepositoryAnalyzer } from './analyzers';
import { scanAll } from './scanners';
import { DiscoveryRegistry, buildGraph } from './registry';
import { KnowledgeGraph } from './graph';
import { DigitalTwin } from './twin';
import type { Fingerprint, FingerprintDiff } from './fingerprint';
import { fingerprint, diffFingerprint } from './fingerprint';

export interface DiscoveryResult {
  inventory: Inventory;
  findings: AnalysisFindings | null;
  fingerprint: Fingerprint;
  diff: FingerprintDiff;
  graph: { nodes: number; edges: number };
  ms: number;
}

export interface DiscoveryEngineOptions { ports: DiscoveryPorts; hasher?: Hasher; largeFileLoc?: number; entryPoints?: string[] }

export class DiscoveryEngine {
  readonly registry = new DiscoveryRegistry();
  /**
   * Graph and twin are created ONCE and mutated in place. The service locator hands
   * these references to other modules at register time; re-discovery must update them,
   * never replace them, or every holder would keep a stale empty graph.
   */
  private readonly _graph = new KnowledgeGraph();
  private readonly _twin: DigitalTwin;
  private _fingerprint: Fingerprint | null = null;
  private readonly hasher: Hasher;

  constructor(private readonly opts: DiscoveryEngineOptions) {
    this.hasher = opts.hasher ?? djb2Hasher;
    this._twin = new DigitalTwin(this._graph, this.registry);
  }

  get graph(): KnowledgeGraph { return this._graph; }
  get twin(): DigitalTwin { return this._twin; }
  get lastFingerprint(): Fingerprint | null { return this._fingerprint; }

  /** Full discovery pass. Degrades gracefully: a missing port narrows the model, never throws. */
  discover(nowIso: string, nowMs = 0): DiscoveryResult {
    const t0 = nowMs;
    const repo = this.opts.ports.repository;

    let files: FileNode[] = [];
    let findings: AnalysisFindings | null = null;
    let inventory: Inventory = emptyInventory();

    if (repo) {
      const analyzer = new RepositoryAnalyzer(repo);
      files = analyzer.parse();
      findings = analyzer.analyze({ hash: (s) => this.hasher.hash(s), largeFileLoc: this.opts.largeFileLoc, entryPoints: this.opts.entryPoints });
      inventory = scanAll({ files, repository: repo, schema: this.opts.ports.schema, env: this.opts.ports.env, deployment: this.opts.ports.deployment });
    } else if (this.opts.ports.schema) {
      // schema-only discovery (e.g. an Edge Function with no source access)
      inventory = scanAll({ files: [], repository: { listFiles: () => [], read: () => null }, schema: this.opts.ports.schema, env: this.opts.ports.env, deployment: this.opts.ports.deployment });
    }

    // rebuild in place — preserves the identity handed to the service locator
    this._graph.replaceWith(buildGraph({ inventory, files, read: (p) => repo?.read(p) ?? null }));
    this.registry.set(inventory, files, findings ?? { files: 0, totalLoc: 0, circular: [], unusedFiles: [], largeFiles: [], duplicates: [], layerViolations: [], coupling: [] }, nowIso);

    const fp = fingerprint({ files, inventory, graph: this._graph, at: nowIso }, this.hasher);
    const diff = diffFingerprint(this._fingerprint, fp);
    this._fingerprint = fp;

    const s = this._graph.stats();
    return { inventory, findings, fingerprint: fp, diff, graph: { nodes: s.nodes, edges: s.edges }, ms: Math.max(0, nowMs - t0) };
  }
}

export const DISCOVERY_MODULE_ID = 'guardian.discovery';

/** Service ids other modules resolve (never import). */
export const DISCOVERY_SERVICES = {
  engine: 'discovery.engine',
  registry: 'discovery.registry',
  graph: 'discovery.graph',
  twin: 'discovery.twin',
} as const;

export interface DiscoveryModuleOptions extends DiscoveryEngineOptions { /** Re-discovery interval; 0 disables the job. */ intervalMs?: number }

/**
 * The installable module. Registers config, the ten knowledge sources, a re-discovery
 * job, and publishes engine/registry/graph/twin through the service locator.
 */
export function createDiscoveryModule(opts: DiscoveryModuleOptions): GuardianModule {
  const engine = new DiscoveryEngine(opts);
  let sourcesRegistered = false;

  return {
    id: DISCOVERY_MODULE_ID,
    version: '1.0.0',
    capabilities: ['discovery', 'knowledge.sources', 'digital.twin'],
    provides: [DISCOVERY_SERVICES.engine, DISCOVERY_SERVICES.registry, DISCOVERY_SERVICES.graph, DISCOVERY_SERVICES.twin],

    register(ctx: GuardianContext) {
      ctx.defineConfig({
        intervalMs: opts.intervalMs ?? 0,
        largeFileLoc: opts.largeFileLoc ?? 500,
      });
      // Identities are stable across re-discovery (the engine mutates in place),
      // so it is safe to publish them once, here.
      ctx.provide(DISCOVERY_SERVICES.engine, engine);
      ctx.provide(DISCOVERY_SERVICES.registry, engine.registry);
      ctx.provide(DISCOVERY_SERVICES.graph, engine.graph);
      ctx.provide(DISCOVERY_SERVICES.twin, engine.twin);
    },

    start(ctx: GuardianContext) {
      const run = (): void => {
        const before = engine.lastFingerprint;
        const r = engine.discover(ctx.ports.clock.iso(), ctx.ports.clock.now());
        if (!sourcesRegistered) {
          for (const s of allSourcesFor(engine)) ctx.addKnowledgeSource(s);
          sourcesRegistered = true;
        }
        ctx.log('discovery.completed', {
          nodes: r.graph.nodes, edges: r.graph.edges,
          services: r.inventory.services.length, tables: r.inventory.tables.length,
          fingerprint: r.fingerprint.composite,
          changed: before ? r.diff.changed : true,
          summary: r.diff.summary,
        });
      };

      run();  // discover immediately on boot

      const interval = ctx.config.getOr(DISCOVERY_MODULE_ID, 'intervalMs', 0) as number;
      if (interval > 0) ctx.defineJob({ id: 'discovery.rescan', intervalMs: interval, handler: run });
    },
  };
}

// imported lazily to keep the module file readable; sources need engine internals
import { allSources } from './sources';
const allSourcesFor = (engine: DiscoveryEngine) => allSources(engine.registry, engine.graph);
