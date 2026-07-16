// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Digital Twin.
//
// A queryable model of HAAT NOW. This is the thing that lets Guardian reason
// about the platform instead of merely watching it.
//
// It answers, with EVIDENCE (every answer carries the graph path):
//   · what depends on Orders / Wallet?
//   · if service X breaks, what is affected?
//   · if we delete feature F, what breaks?
//   · which services / APIs / tables / routes / jobs are unused?
//
// Pure: reads the graph + registry. No I/O, no AI.
// ─────────────────────────────────────────────────────────────────────────────
import type { GraphNode, NodeType } from './types';
import { nodeId } from './types';
import type { KnowledgeGraph } from './graph';
import type { DiscoveryRegistry } from './registry';

export interface ImpactReport {
  target: string;
  exists: boolean;
  /** Everything that transitively depends on the target — the blast radius. */
  affected: GraphNode[];
  /** Grouped for humans/AI. */
  byType: Record<string, string[]>;
  /** Direct dependents only. */
  direct: string[];
  /** Worst-case severity hint from what is hit (finance/tables ⇒ higher). */
  criticality: 'low' | 'medium' | 'high' | 'critical';
}

export interface RemovalReport { target: string; exists: boolean; breaks: GraphNode[]; safe: boolean; reason: string }

export interface UnusedReport { type: NodeType; nodes: { id: string; label: string; origin?: string }[]; note: string }

const CRITICAL_HINT = /(ledger|wallet|settlement|payment|commission|order|refund)/i;

export class DigitalTwin {
  constructor(private readonly graph: KnowledgeGraph, private readonly registry: DiscoveryRegistry) {}

  // ── resolution ─────────────────────────────────────────────────────────────
  /** Accept 'orders', 'table:orders' or 'service:order.service' — humans shouldn't have to know ids. */
  resolve(query: string, type?: NodeType): GraphNode | undefined {
    if (this.graph.has(query)) return this.graph.node(query);
    if (type && this.graph.has(nodeId(type, query))) return this.graph.node(nodeId(type, query));
    const lower = query.toLowerCase();
    const all = this.graph.allNodes().filter(n => !type || n.type === type);
    return all.find(n => n.key.toLowerCase() === lower)
      ?? all.find(n => n.label.toLowerCase() === lower)
      ?? all.find(n => n.key.toLowerCase().includes(lower));
  }

  // ── the questions ──────────────────────────────────────────────────────────
  /** "What depends on Orders?" */
  whatDependsOn(query: string, type?: NodeType): ImpactReport {
    const node = this.resolve(query, type);
    if (!node) return { target: query, exists: false, affected: [], byType: {}, direct: [], criticality: 'low' };
    const ids = this.graph.impactOf(node.id);
    const affected = ids.map(id => this.graph.node(id)!).filter(Boolean);
    const byType: Record<string, string[]> = {};
    for (const n of affected) (byType[n.type] ??= []).push(n.key);
    for (const k of Object.keys(byType)) byType[k].sort();
    return {
      target: node.id, exists: true, affected, byType,
      direct: this.graph.dependentsOf(node.id),
      criticality: this.rate(node, affected),
    };
  }

  /** "If this service goes down, what is affected?" — identical closure, framed for incidents. */
  blastRadius(query: string, type?: NodeType): ImpactReport { return this.whatDependsOn(query, type); }

  /** "If we delete this feature, what breaks?" */
  ifRemoved(query: string, type?: NodeType): RemovalReport {
    const node = this.resolve(query, type);
    if (!node) return { target: query, exists: false, breaks: [], safe: false, reason: 'not found in the twin' };
    const breaks = this.graph.impactOf(node.id).map(id => this.graph.node(id)!).filter(Boolean);
    return {
      target: node.id, exists: true, breaks, safe: breaks.length === 0,
      reason: breaks.length === 0
        ? 'nothing depends on it — safe to remove'
        : `${breaks.length} node(s) depend on it, including ${breaks.slice(0, 5).map(b => b.id).join(', ')}`,
    };
  }

  /** Why does A need B? The shortest proven path. */
  why(from: string, to: string): string[] {
    const a = this.resolve(from), b = this.resolve(to);
    return a && b ? this.graph.path(a.id, b.id) : [];
  }

  // ── unused / dead ──────────────────────────────────────────────────────────
  private unused(type: NodeType, note: string): UnusedReport {
    const nodes = this.graph.orphans(type).map(n => ({ id: n.id, label: n.label, origin: n.origin }));
    return { type, nodes, note };
  }
  unusedServices(): UnusedReport { return this.unused('service', 'no feature/service imports it (entry points excluded elsewhere)'); }
  unusedApis(): UnusedReport { return this.unused('api', 'declared but no caller found in source'); }
  unusedTables(): UnusedReport { return this.unused('table', 'no service reads or writes it'); }
  deadRoutes(): UnusedReport { return this.unused('route', 'route declared but renders nothing known'); }
  unusedJobs(): UnusedReport { return this.unused('job', 'defined but nothing schedules/depends on it'); }
  unusedIntegrations(): UnusedReport { return this.unused('integration', 'referenced but not wired to a consumer'); }

  /** Everything unused, in one pass. */
  deadCode(): UnusedReport[] {
    return [this.unusedServices(), this.unusedApis(), this.unusedTables(), this.deadRoutes(), this.unusedJobs(), this.unusedIntegrations()];
  }

  // ── overview ───────────────────────────────────────────────────────────────
  private rate(node: GraphNode, affected: GraphNode[]): ImpactReport['criticality'] {
    const touchesMoney = CRITICAL_HINT.test(node.key) || affected.some(a => CRITICAL_HINT.test(a.key));
    const n = affected.length;
    if (touchesMoney && n >= 3) return 'critical';
    if (touchesMoney || n >= 15) return 'high';
    if (n >= 5) return 'medium';
    return 'low';
  }

  /** The most-depended-upon nodes — where fragility concentrates. */
  hotspots(limit = 10): { id: string; label: string; dependents: number }[] {
    return this.graph.allNodes()
      .map(n => ({ id: n.id, label: n.label, dependents: this.graph.impactOf(n.id).length }))
      .sort((a, b) => b.dependents - a.dependents || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  describe(): {
    discoveredAt: string;
    counts: Record<string, number>;
    graph: { nodes: number; edges: number; byType: Record<string, number> };
    cycles: number;
    hotspots: { id: string; dependents: number }[];
    dead: Record<string, number>;
  } {
    const s = this.graph.stats();
    const dead: Record<string, number> = {};
    for (const r of this.deadCode()) dead[r.type] = r.nodes.length;
    return {
      discoveredAt: this.registry.discoveredAt(),
      counts: this.registry.counts(),
      graph: { nodes: s.nodes, edges: s.edges, byType: s.byType },
      cycles: this.graph.cycles().length,
      hotspots: this.hotspots(5).map(h => ({ id: h.id, dependents: h.dependents })),
      dead,
    };
  }
}
