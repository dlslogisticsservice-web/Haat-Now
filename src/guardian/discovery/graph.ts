// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Knowledge Graph.
//
// A directed multigraph of the platform. Edges point in the direction of
// DEPENDENCY / FLOW:  A --depends_on--> B  means "A needs B".
//
// Therefore:
//   dependencies(A) = forward closure  → what A needs
//   dependents(A)   = reverse closure  → WHO BREAKS IF A BREAKS   ← blast radius
//
// Pure data structure. No I/O. Deterministic ordering everywhere so fingerprints
// and tests are stable.
// ─────────────────────────────────────────────────────────────────────────────
import type { EdgeType, GraphEdge, GraphNode, NodeType } from './types';

export interface GraphStats { nodes: number; edges: number; byType: Record<string, number>; byEdge: Record<string, number> }

export class KnowledgeGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly out = new Map<string, GraphEdge[]>();
  private readonly in = new Map<string, GraphEdge[]>();
  private readonly edgeKeys = new Set<string>();

  // ── construction ───────────────────────────────────────────────────────────
  /** Idempotent: re-adding a node merges meta/tags rather than duplicating. */
  addNode(node: GraphNode): GraphNode {
    const existing = this.nodes.get(node.id);
    if (existing) {
      if (node.meta) existing.meta = { ...existing.meta, ...node.meta };
      if (node.tags) existing.tags = [...new Set([...(existing.tags ?? []), ...node.tags])];
      if (!existing.origin && node.origin) existing.origin = node.origin;
      return existing;
    }
    this.nodes.set(node.id, { ...node });
    return node;
  }

  /** Idempotent. Edges to unknown nodes are ignored — the graph never lies about what exists. */
  addEdge(edge: GraphEdge): boolean {
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) return false;
    if (edge.from === edge.to) return false;                       // self-edges carry no information
    const k = `${edge.from}|${edge.type}|${edge.to}`;
    if (this.edgeKeys.has(k)) return false;
    this.edgeKeys.add(k);
    if (!this.out.has(edge.from)) this.out.set(edge.from, []);
    if (!this.in.has(edge.to)) this.in.set(edge.to, []);
    this.out.get(edge.from)!.push(edge);
    this.in.get(edge.to)!.push(edge);
    return true;
  }

  // ── access ─────────────────────────────────────────────────────────────────
  has(id: string): boolean { return this.nodes.has(id); }
  node(id: string): GraphNode | undefined { return this.nodes.get(id); }
  allNodes(): GraphNode[] { return [...this.nodes.values()].sort((a, b) => a.id.localeCompare(b.id)); }
  allEdges(): GraphEdge[] {
    return [...this.out.values()].flat().sort((a, b) => `${a.from}${a.type}${a.to}`.localeCompare(`${b.from}${b.type}${b.to}`));
  }
  byType(type: NodeType): GraphNode[] { return this.allNodes().filter(n => n.type === type); }
  edgesFrom(id: string, type?: EdgeType): GraphEdge[] {
    return (this.out.get(id) ?? []).filter(e => !type || e.type === type);
  }
  edgesTo(id: string, type?: EdgeType): GraphEdge[] {
    return (this.in.get(id) ?? []).filter(e => !type || e.type === type);
  }

  /** Direct neighbours only. */
  dependenciesOf(id: string, type?: EdgeType): string[] {
    return [...new Set(this.edgesFrom(id, type).map(e => e.to))].sort();
  }
  dependentsOf(id: string, type?: EdgeType): string[] {
    return [...new Set(this.edgesTo(id, type).map(e => e.from))].sort();
  }

  // ── closures (the questions the Digital Twin answers) ──────────────────────
  /** Transitive forward closure — everything `id` needs, directly or indirectly. */
  reachable(id: string, maxDepth = Infinity): string[] {
    return this.walk(id, 'out', maxDepth);
  }
  /** Transitive reverse closure — everything that breaks if `id` breaks. THE blast radius. */
  impactOf(id: string, maxDepth = Infinity): string[] {
    return this.walk(id, 'in', maxDepth);
  }

  private walk(start: string, dir: 'in' | 'out', maxDepth: number): string[] {
    if (!this.nodes.has(start)) return [];
    const seen = new Set<string>();
    let frontier = [start];
    let depth = 0;
    while (frontier.length && depth < maxDepth) {
      const next: string[] = [];
      for (const id of frontier) {
        const edges = dir === 'out' ? (this.out.get(id) ?? []) : (this.in.get(id) ?? []);
        for (const e of edges) {
          const other = dir === 'out' ? e.to : e.from;
          if (other !== start && !seen.has(other)) { seen.add(other); next.push(other); }
        }
      }
      frontier = next;
      depth++;
    }
    return [...seen].sort();
  }

  /** Shortest dependency path A→B (why does A need B?). Empty when unreachable. */
  path(from: string, to: string): string[] {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return [];
    const prev = new Map<string, string>();
    const seen = new Set([from]);
    const q = [from];
    while (q.length) {
      const cur = q.shift()!;
      if (cur === to) {
        const out = [to];
        let c = to;
        while (prev.has(c)) { c = prev.get(c)!; out.unshift(c); }
        return out;
      }
      for (const e of this.out.get(cur) ?? []) {
        if (!seen.has(e.to)) { seen.add(e.to); prev.set(e.to, cur); q.push(e.to); }
      }
    }
    return [];
  }

  /** Nodes nothing points at. Candidate dead code / unused API / unused table. */
  orphans(type?: NodeType): GraphNode[] {
    return this.allNodes().filter(n => (!type || n.type === type) && (this.in.get(n.id)?.length ?? 0) === 0);
  }
  /** Nodes that point at nothing (leaves). */
  leaves(type?: NodeType): GraphNode[] {
    return this.allNodes().filter(n => (!type || n.type === type) && (this.out.get(n.id)?.length ?? 0) === 0);
  }

  /** All simple cycles (Tarjan SCCs of size > 1, plus 2-cycles). Deterministic. */
  cycles(): string[][] {
    const index = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const out: string[][] = [];
    let counter = 0;

    const strongConnect = (v: string): void => {
      index.set(v, counter); low.set(v, counter); counter++;
      stack.push(v); onStack.add(v);
      for (const e of this.out.get(v) ?? []) {
        const w = e.to;
        if (!index.has(w)) { strongConnect(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
        else if (onStack.has(w)) { low.set(v, Math.min(low.get(v)!, index.get(w)!)); }
      }
      if (low.get(v) === index.get(v)) {
        const comp: string[] = [];
        let w: string;
        do { w = stack.pop()!; onStack.delete(w); comp.push(w); } while (w !== v);
        if (comp.length > 1) out.push(comp.sort());
      }
    };

    for (const id of [...this.nodes.keys()].sort()) if (!index.has(id)) strongConnect(id);
    return out.sort((a, b) => a[0].localeCompare(b[0]));
  }

  stats(): GraphStats {
    const byType: Record<string, number> = {};
    for (const n of this.nodes.values()) byType[n.type] = (byType[n.type] ?? 0) + 1;
    const byEdge: Record<string, number> = {};
    for (const e of this.allEdges()) byEdge[e.type] = (byEdge[e.type] ?? 0) + 1;
    return { nodes: this.nodes.size, edges: this.edgeKeys.size, byType, byEdge };
  }

  /** Stable serialization — the basis of the dependency fingerprint. */
  serialize(): string {
    return JSON.stringify({
      nodes: this.allNodes().map(n => [n.id, n.type]),
      edges: this.allEdges().map(e => [e.from, e.type, e.to]),
    });
  }

  clear(): void { this.nodes.clear(); this.out.clear(); this.in.clear(); this.edgeKeys.clear(); }

  /**
   * Replace all content IN PLACE, preserving this object's identity.
   * Critical: the service locator hands out the graph/twin at register time, but
   * discovery re-runs later. Rebuilding into a NEW instance would leave every holder
   * pointing at a stale, empty graph. Identity must survive re-discovery.
   */
  replaceWith(other: KnowledgeGraph): void {
    this.clear();
    for (const n of other.allNodes()) this.addNode(n);
    for (const e of other.allEdges()) this.addEdge(e);
  }
}
