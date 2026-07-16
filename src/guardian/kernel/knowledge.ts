// ─────────────────────────────────────────────────────────────────────────────
// Guardian Kernel · Knowledge Engine.   ← the strategic core
//
// This is what makes Guardian more than a monitor: a structured, queryable model
// of what HAAT NOW *is*. Future AI requests consume ONLY this — never raw memory,
// never ad-hoc scraping. No AI here; this is the substrate the AI will read.
//
// Design:
//  · Sources REGISTER themselves (`ctx.knowledge.addSource(...)`) — no hardcoded
//    list of what to index. A future Database module indexes tables; a Release
//    module indexes deployments; a Docs module indexes markdown.
//  · Everything normalizes to a FACT: {facet, key, title, body, refs, tags}.
//  · Retrieval is deterministic scoring (facet/tag/text) — NOT embeddings. Vector
//    search can be added later behind the same `query()` seam without changing callers.
//  · assembleContext() produces a token-BUDGETED, provenance-tagged bundle. Every
//    fact carries its source, so an AI answer can always be traced to evidence.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, ISODateTime, Result } from './types';
import { ok, err } from './types';

/** The dimensions Guardian can reason over. Fixed vocabulary keeps retrieval predictable. */
export type KnowledgeFacet =
  | 'architecture' | 'service' | 'database' | 'table' | 'relation' | 'api'
  | 'business_rule' | 'environment' | 'commit' | 'deployment' | 'document'
  | 'ownership' | 'dependency' | 'route' | 'configuration';

export const KNOWLEDGE_FACETS: readonly KnowledgeFacet[] = [
  'architecture', 'service', 'database', 'table', 'relation', 'api', 'business_rule',
  'environment', 'commit', 'deployment', 'document', 'ownership', 'dependency', 'route', 'configuration',
];

export interface KnowledgeFact {
  /** Stable identity: `${facet}:${key}` — re-indexing replaces, never duplicates. */
  readonly id: string;
  readonly facet: KnowledgeFacet;
  readonly key: string;
  readonly title: string;
  readonly body: string;
  /** Links to other facts (`table:orders`, `service:payments`) — the graph. */
  readonly refs?: readonly string[];
  readonly tags?: readonly string[];
  readonly sourceId: string;
  readonly indexedAt: ISODateTime;
}

export type FactInput = Omit<KnowledgeFact, 'id' | 'sourceId' | 'indexedAt'>;

/**
 * A contributor of knowledge. Pull-based so the kernel controls cost and cadence.
 * Implemented later by Database/Release/Docs/Config modules — never by the kernel.
 */
export interface KnowledgeSource {
  readonly id: string;
  readonly facets: readonly KnowledgeFacet[];
  /** Must be side-effect free and cheap enough to re-run on demand. */
  collect(): FactInput[] | Promise<FactInput[]>;
}

export interface KnowledgeQuery {
  facets?: readonly KnowledgeFacet[];
  tags?: readonly string[];
  /** Case-insensitive term match over title/body/key. */
  text?: string;
  /** Expand to facts referenced by matches (1 hop) — pulls in related tables/services. */
  expandRefs?: boolean;
  limit?: number;
}

export interface ContextBundle {
  facts: KnowledgeFact[];
  /** Provenance: which sources contributed. An AI answer must be traceable. */
  sources: string[];
  /** Rough size guard so a caller can respect a model budget. */
  approxChars: number;
  truncated: boolean;
  builtAt: ISODateTime;
}

/** ~4 chars/token is the standard rough heuristic; exact counting belongs to the provider. */
const approxTokens = (chars: number): number => Math.ceil(chars / 4);

export class KnowledgeEngine {
  private readonly sources = new Map<string, KnowledgeSource>();
  private readonly facts = new Map<string, KnowledgeFact>();

  constructor(private readonly clock: Clock) {}

  addSource(source: KnowledgeSource): Result<true> {
    if (this.sources.has(source.id)) return err(`knowledge source already registered: ${source.id}`);
    this.sources.set(source.id, source);
    return ok(true);
  }

  listSources(): { id: string; facets: readonly KnowledgeFacet[] }[] {
    return [...this.sources.values()].map(s => ({ id: s.id, facets: s.facets }));
  }

  /** Re-index one source or all. Replaces that source's facts atomically (no stale residue). */
  async index(sourceId?: string): Promise<Result<{ indexed: number; sources: number }>> {
    const targets = sourceId ? [this.sources.get(sourceId)].filter(Boolean) as KnowledgeSource[] : [...this.sources.values()];
    if (sourceId && targets.length === 0) return err(`unknown source: ${sourceId}`);
    let indexed = 0;
    for (const src of targets) {
      let collected: FactInput[];
      try { collected = await src.collect(); }
      catch (e) { return err(`source '${src.id}' failed: ${String(e)}`); }
      // drop this source's previous facts, then insert fresh
      for (const [id, f] of [...this.facts]) if (f.sourceId === src.id) this.facts.delete(id);
      const at = this.clock.iso();
      for (const f of collected) {
        const id = `${f.facet}:${f.key}`;
        this.facts.set(id, { ...f, id, sourceId: src.id, indexedAt: at });
        indexed++;
      }
    }
    return ok({ indexed, sources: targets.length });
  }

  /** Deterministic retrieval. Scoring is explainable — no black box. */
  query(q: KnowledgeQuery = {}): KnowledgeFact[] {
    const term = q.text?.toLowerCase().trim();
    let out = [...this.facts.values()];
    if (q.facets?.length) out = out.filter(f => q.facets!.includes(f.facet));
    if (q.tags?.length) out = out.filter(f => (f.tags ?? []).some(t => q.tags!.includes(t)));
    if (term) {
      const score = (f: KnowledgeFact): number => {
        const k = f.key.toLowerCase(), t = f.title.toLowerCase(), b = f.body.toLowerCase();
        return (k === term ? 100 : k.includes(term) ? 40 : 0) + (t.includes(term) ? 20 : 0) + (b.includes(term) ? 5 : 0);
      };
      out = out.map(f => ({ f, s: score(f) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.f);
    } else {
      out.sort((a, b) => a.id.localeCompare(b.id));
    }
    if (q.expandRefs) {
      const seen = new Set(out.map(f => f.id));
      for (const f of [...out]) for (const r of f.refs ?? []) {
        const ref = this.facts.get(r);
        if (ref && !seen.has(ref.id)) { out.push(ref); seen.add(ref.id); }
      }
    }
    return out.slice(0, q.limit ?? 50);
  }

  /**
   * Build the bundle a future AI request will consume. Budgeted and provenance-tagged.
   * Facts are included in query order, so callers control priority by querying well.
   */
  assembleContext(q: KnowledgeQuery, maxChars = 24_000): ContextBundle {
    const picked: KnowledgeFact[] = [];
    const sources = new Set<string>();
    let chars = 0, truncated = false;
    for (const f of this.query(q)) {
      const size = f.title.length + f.body.length + 32;
      if (chars + size > maxChars) { truncated = true; break; }
      picked.push(f); sources.add(f.sourceId); chars += size;
    }
    return { facts: picked, sources: [...sources].sort(), approxChars: chars, truncated, builtAt: this.clock.iso() };
  }

  /** Graph neighbours of a fact — the basis for future blast-radius reasoning. */
  related(factId: string): KnowledgeFact[] {
    const f = this.facts.get(factId);
    if (!f) return [];
    const outbound = (f.refs ?? []).map(r => this.facts.get(r)).filter(Boolean) as KnowledgeFact[];
    const inbound = [...this.facts.values()].filter(x => (x.refs ?? []).includes(factId));
    return [...new Map([...outbound, ...inbound].map(x => [x.id, x])).values()];
  }

  get(id: string): KnowledgeFact | undefined { return this.facts.get(id); }
  size(): number { return this.facts.size; }
  stats(): { facts: number; sources: number; byFacet: Record<string, number>; approxTokens: number } {
    const byFacet: Record<string, number> = {};
    let chars = 0;
    for (const f of this.facts.values()) { byFacet[f.facet] = (byFacet[f.facet] ?? 0) + 1; chars += f.title.length + f.body.length; }
    return { facts: this.facts.size, sources: this.sources.size, byFacet, approxTokens: approxTokens(chars) };
  }
}
