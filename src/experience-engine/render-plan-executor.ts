// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Render Plan Executor (Wave 14).
//
// Interprets a RenderPlan against a resolved experience and produces a TRANSFORMED resolution
// that the existing RenderingPort renders. The renderer never sees the plan — the pipeline hands
// it an ordinary resolution whose schema already reflects the plan.
//
//   RenderPlan → RenderPlanExecutor → transformed Resolution → RenderingPort → Renderer
//
// PURE + IMMUTABLE. The input resolution/schema is never mutated: the tree transform is
// clone-on-write (unchanged branches keep their identity). It NEVER throws. This module does NOT
// import pipeline.ts — the pipeline declares the executor seam structurally — so the existing
// context↔pipeline type edge is not turned into a module cycle.
// ─────────────────────────────────────────────────────────────────────────────
import type { Json, Timestamp } from './types';
import type { ExperienceContext, ExperienceResolution } from './context';
import type { ExperienceSchema } from './schema';
import type { TreeNode } from './tree';
import type { RenderPlan } from './render-plan';

/** A tree node viewed permissively (component nodes carry componentId/props). */
type AnyNode = TreeNode & { componentId?: string; props?: { [k: string]: Json }; children?: TreeNode[] };

export interface RenderPlanExecutionResult {
  /** The resolution to render — transformed when operations applied, else the original. */
  resolution: ExperienceResolution;
  redirect: string | null;
  applied: string[];
  skipped: string[];
  /** Distinct tree nodes actually changed (hidden, replaced or overridden) — a rollout metric. */
  nodesModified: number;
  executionMs: number;
  diagnostics: string[];
}

export interface RenderPlanExecutor {
  execute(resolution: ExperienceResolution, context: ExperienceContext): RenderPlanExecutionResult;
}

export interface RenderPlanExecutorOptions { clock?: () => number }

const defaultClock = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);
const isPlainObject = (v: unknown): v is { [k: string]: Json } => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Build an executor bound to one plan. Matching rule: a plan node applies to the tree node whose
 * `id` equals the plan node's `key` (documented, deterministic — never matched by componentId,
 * which would apply a change to every block of a type).
 */
export function createRenderPlanExecutor(plan: RenderPlan, execOpts: RenderPlanExecutorOptions = {}): RenderPlanExecutor {
  const clock = execOpts.clock ?? defaultClock;

  return {
    execute(resolution: ExperienceResolution, _context: ExperienceContext): RenderPlanExecutionResult {
      const t0 = clock();
      const applied: string[] = [];
      const skipped: string[] = [];
      const diagnostics: string[] = [];

      // Redirect short-circuits: the pipeline will not call the port at all.
      if (plan.redirect) {
        applied.push(`redirect → ${plan.redirect}`);
        return { resolution, redirect: plan.redirect, applied, skipped, nodesModified: 0, executionMs: clock() - t0, diagnostics };
      }

      if (resolution.status !== 'resolved' || !resolution.schema) {
        skipped.push('nothing to execute against (unresolved experience)');
        return { resolution, redirect: null, applied, skipped, nodesModified: 0, executionMs: clock() - t0, diagnostics };
      }

      // ── STEP 2 · gather the operations ──
      const hide = new Set<string>();
      const replace = new Map<string, Json>();
      for (const n of plan.nodes) {
        if (n.visibility === 'hidden') hide.add(n.key);
        else skipped.push(`show ${n.id}: visible is the default (no-op)`);
        if (n.replaced) {
          if (n.content === undefined) skipped.push(`replace ${n.id}: no content`);
          else if (!isPlainObject(n.content)) skipped.push(`replace ${n.id}: content is not an object`);
          else replace.set(n.key, n.content);
        }
      }
      const overrides = plan.overrides;
      const overrideKeys = Object.keys(overrides);

      // Fast path: a plan with no tree-affecting operation never walks the tree. Most requests
      // carry an empty or metadata-only plan, so this keeps the gate-on cost near the gate-off cost.
      if (hide.size === 0 && replace.size === 0 && overrideKeys.length === 0) {
        const annKeys = Object.keys(plan.metadata.annotations);
        if (annKeys.length > 0) diagnostics.push(`metadata: ${annKeys.join(', ')}`);
        return { resolution, redirect: null, applied, skipped, nodesModified: 0, executionMs: clock() - t0, diagnostics };
      }

      const hit = { hide: new Set<string>(), replace: new Set<string>(), override: 0 };
      const modified = new Set<string>();

      // ── the pure, clone-on-write tree transform ──
      const walk = (node: TreeNode): TreeNode | null => {
        const n = node as AnyNode;
        if (n.id !== undefined && hide.has(n.id)) { hit.hide.add(n.id); modified.add(n.id); return null; }

        let next: AnyNode = n;
        const clone = (): AnyNode => (next === n ? { ...n } : next);

        // replace → swap the component node's props wholesale
        if (n.id !== undefined && replace.has(n.id)) {
          if (n.type === 'component') {
            next = clone();
            next.props = replace.get(n.id) as { [k: string]: Json };
            hit.replace.add(n.id);
            modified.add(n.id);
          } else {
            skipped.push(`replace ${n.id}: only component nodes carry props`);
          }
        }

        // override → only rewrite props that ALREADY exist (never invent a prop)
        if (overrideKeys.length > 0 && next.props) {
          let changed = false;
          let props = next.props;
          for (const k of overrideKeys) {
            if (Object.prototype.hasOwnProperty.call(props, k) && props[k] !== overrides[k]) {
              if (!changed) { props = { ...props }; changed = true; }
              props[k] = overrides[k];
              hit.override++;
            }
          }
          if (changed) { next = clone(); next.props = props; if (n.id !== undefined) modified.add(n.id); }
        }

        // children (clone-on-write)
        if (n.children && n.children.length > 0) {
          const kids: TreeNode[] = [];
          let kidsChanged = false;
          for (const child of n.children) {
            const out = walk(child);
            if (out === null) { kidsChanged = true; continue; }
            if (out !== child) kidsChanged = true;
            kids.push(out);
          }
          if (kidsChanged) { next = clone(); next.children = kids; }
        }

        return next;
      };

      const schema = resolution.schema as ExperienceSchema & { pages?: Array<{ layout: TreeNode; [k: string]: unknown }> };
      let schemaChanged = false;

      // root layout
      let layout = schema.layout;
      const rootOut = walk(schema.layout);
      if (rootOut === null) {
        skipped.push('hide on the root layout: the root cannot be removed');
      } else if (rootOut !== schema.layout) {
        layout = rootOut;
        schemaChanged = true;
      }

      // per-page layouts (website-shaped schemas)
      let pages = schema.pages;
      if (Array.isArray(schema.pages)) {
        const nextPages: Array<{ layout: TreeNode; [k: string]: unknown }> = [];
        let pagesChanged = false;
        for (const page of schema.pages) {
          const out = page.layout ? walk(page.layout) : page.layout;
          if (out === null) { skipped.push(`hide on a page root layout (${String(page.path ?? '?')}): the root cannot be removed`); nextPages.push(page); continue; }
          if (out !== page.layout) { nextPages.push({ ...page, layout: out }); pagesChanged = true; }
          else nextPages.push(page);
        }
        if (pagesChanged) { pages = nextPages; schemaChanged = true; }
      }

      // ── report ──
      for (const key of hide) (hit.hide.has(key) ? applied : skipped).push(hit.hide.has(key) ? `hide ${key}` : `hide ${key}: no matching node`);
      for (const key of replace.keys()) (hit.replace.has(key) ? applied : skipped).push(hit.replace.has(key) ? `replace ${key}` : `replace ${key}: no matching node`);
      if (overrideKeys.length > 0) {
        if (hit.override > 0) applied.push(`override ×${hit.override} (${overrideKeys.join(', ')})`);
        else skipped.push(`override (${overrideKeys.join(', ')}): no matching props`);
      }

      // metadata is non-visual: reported, never rendered
      const annotationKeys = Object.keys(plan.metadata.annotations);
      if (annotationKeys.length > 0) diagnostics.push(`metadata: ${annotationKeys.join(', ')}`);

      const nextResolution: ExperienceResolution = schemaChanged
        ? { ...resolution, schema: { ...(schema as object), layout, ...(pages !== schema.pages ? { pages } : {}) } as ExperienceSchema }
        : resolution;

      return { resolution: nextResolution, redirect: null, applied, skipped, nodesModified: modified.size, executionMs: clock() - t0, diagnostics };
    },
  };
}

/** Convenience: the timestamp helper kept for symmetry with the other capability modules. */
export type RenderPlanExecutedAt = Timestamp;
