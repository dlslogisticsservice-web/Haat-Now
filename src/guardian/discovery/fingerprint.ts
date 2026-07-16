// ─────────────────────────────────────────────────────────────────────────────
// Guardian · Fingerprints.
//
// Four independent hashes so Guardian can tell WHAT KIND of change happened:
//
//   repository   — the files themselves (any code edit)
//   architecture — the shape (services/features/routes/tables added or removed)
//   dependency   — the edges (who depends on whom)
//   knowledge    — the indexed facts
//
// Signal: repository changes + architecture stable = ordinary edit.
//         architecture/dependency changed          = structural change → review.
//         dependency changed while repository did NOT = drift in the backend/env.
//
// Deterministic: same input ⇒ same hash, on every runtime.
// ─────────────────────────────────────────────────────────────────────────────
import type { Hasher } from '../kernel/types';
import type { Inventory } from './types';
import type { KnowledgeGraph } from './graph';
import type { FileNode } from './types';

export interface Fingerprint {
  repository: string;
  architecture: string;
  dependency: string;
  knowledge: string;
  /** Combined — one value to store and compare. */
  composite: string;
  at: string;
}

export interface FingerprintDiff {
  changed: boolean;
  repository: boolean;
  architecture: boolean;
  dependency: boolean;
  knowledge: boolean;
  /** Human/AI-readable interpretation of the change class. */
  summary: string;
}

export interface FingerprintInput {
  files: FileNode[];
  inventory: Inventory;
  graph: KnowledgeGraph;
  knowledgeFacts?: { id: string; body: string }[];
  at: string;
}

/** Repository: path + size + import edges. Catches any code edit, ignores mtime/order. */
const repositoryPrint = (files: FileNode[], h: Hasher): string =>
  h.hash(JSON.stringify(
    [...files].sort((a, b) => a.path.localeCompare(b.path)).map(f => [f.path, f.loc, f.imports]),
  ));

/** Architecture: the SHAPE only — names and counts, not contents. */
const architecturePrint = (inv: Inventory, h: Hasher): string =>
  h.hash(JSON.stringify({
    services: inv.services.map(s => `${s.kind}:${s.key}`).sort(),
    features: inv.features.map(f => f.key).sort(),
    routes: inv.routes.map(r => r.key).sort(),
    apis: inv.apis.map(a => a.key).sort(),
    tables: inv.tables.map(t => t.name).sort(),
    views: inv.views.map(v => v.name).sort(),
    buckets: inv.buckets.map(b => b.id).sort(),
    edgeFunctions: inv.edgeFunctions.map(f => f.slug).sort(),
    events: inv.events.map(e => e.key).sort(),
    permissions: inv.permissions.map(p => p.key).sort(),
    jobs: inv.jobs.map(j => j.key).sort(),
    integrations: inv.integrations.map(i => i.key).sort(),
    env: inv.env.map(e => e.key).sort(),          // KEYS ONLY — never values
  }));

/** Dependency: the edge set. */
const dependencyPrint = (graph: KnowledgeGraph, h: Hasher): string => h.hash(graph.serialize());

/** Knowledge: the indexed facts. */
const knowledgePrint = (facts: { id: string; body: string }[] | undefined, h: Hasher): string =>
  h.hash(JSON.stringify((facts ?? []).map(f => [f.id, f.body.length]).sort()));

export function fingerprint(input: FingerprintInput, h: Hasher): Fingerprint {
  const repository = repositoryPrint(input.files, h);
  const architecture = architecturePrint(input.inventory, h);
  const dependency = dependencyPrint(input.graph, h);
  const knowledge = knowledgePrint(input.knowledgeFacts, h);
  return {
    repository, architecture, dependency, knowledge,
    composite: h.hash([repository, architecture, dependency, knowledge].join(':')),
    at: input.at,
  };
}

export function diffFingerprint(prev: Fingerprint | null, next: Fingerprint): FingerprintDiff {
  if (!prev) return { changed: true, repository: true, architecture: true, dependency: true, knowledge: true, summary: 'first discovery — baseline established' };
  const d: FingerprintDiff = {
    repository: prev.repository !== next.repository,
    architecture: prev.architecture !== next.architecture,
    dependency: prev.dependency !== next.dependency,
    knowledge: prev.knowledge !== next.knowledge,
    changed: prev.composite !== next.composite,
    summary: '',
  };
  const parts: string[] = [];
  if (!d.changed) parts.push('no change');
  else {
    if (d.architecture) parts.push('ARCHITECTURE changed (components added/removed) — review');
    if (d.dependency && !d.repository) parts.push('DEPENDENCY changed without a code edit — backend/env drift');
    else if (d.dependency) parts.push('dependency graph changed');
    if (d.repository && !d.architecture && !d.dependency) parts.push('ordinary code edit (shape unchanged)');
    if (d.knowledge) parts.push('knowledge re-indexed');
  }
  d.summary = parts.join(' · ');
  return d;
}
