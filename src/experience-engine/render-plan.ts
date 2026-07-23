// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Render Plan Builder (Wave 13).
//
// The Render Decision Adapter produces renderer-agnostic instructions. Those instructions are
// still imperative ("hide this", "replace that"). This builder compiles them into a DECLARATIVE
// RenderPlan — the shape a renderer can consume directly, without interpreting instruction order.
//
//   RenderInstructionSet → RenderPlanBuilder → RenderPlan → (future) Renderer
//
// PURE + FRAMEWORK ONLY. It compiles a plan and validates it; it renders nothing and the renderer
// is untouched. Depends only on the render-adapter/type CONTRACTS (one-directional — the adapter
// does NOT import this module — so there is no cycle).
// ─────────────────────────────────────────────────────────────────────────────
import type { Json, Timestamp } from './types';
import type { RenderInstruction, RenderInstructionSet } from './render-adapter';

// ── STEP 1 · Model ───────────────────────────────────────────────────────────────
export type RenderNodeVisibility = 'visible' | 'hidden';

/** The compiled plan for one addressable node (a section, a flag-gated block, …). */
export interface RenderNodePlan {
  /** Qualified, collision-free id: `<targetType>:<key>`. */
  id: string;
  key: string;
  targetType: string;
  visibility: RenderNodeVisibility;
  replaced: boolean;
  /** Replacement content when `replaced` is true. */
  content?: Json;
  overrides?: { [key: string]: Json };
  /** Instruction ids that shaped this node (traceability). */
  sources: string[];
}

/** STEP 6 · plan diagnostics travel with the plan. */
export interface RenderPlanMetadata {
  builtAt: Timestamp;
  /** Instructions consumed to build this plan. */
  instructionCount: number;
  nodeCount: number;
  /** Total addressable entries: nodes + overrides + annotations + redirect. */
  planSize: number;
  hasRedirect: boolean;
  buildMs: number;
  /** `annotate` instructions land here — non-visual metadata, never markup. */
  annotations: { [key: string]: Json };
}

export interface RenderPlan {
  nodes: RenderNodePlan[];
  visible: string[];
  hidden: string[];
  replaced: { [id: string]: Json };
  overrides: { [key: string]: Json };
  redirect: string | null;
  metadata: RenderPlanMetadata;
  diagnostics: string[];
}

export interface RenderPlanValidation { valid: boolean; errors: string[]; warnings: string[] }

// ── Events (STEP 7) ──────────────────────────────────────────────────────────────
export type RenderPlanEventType = 'plan.built';
export interface RenderPlanEvent { type: RenderPlanEventType; at: Timestamp; nodes: number; planSize: number; message?: string }

const defaultClock = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);
const nodeId = (i: RenderInstruction): string => `${i.target.type}:${i.target.key ?? '*'}`;

const emptyMetadata = (at: Timestamp): RenderPlanMetadata =>
  ({ builtAt: at, instructionCount: 0, nodeCount: 0, planSize: 0, hasRedirect: false, buildMs: 0, annotations: {} });

/** An empty plan — the no-op baseline. */
export function emptyRenderPlan(at: Timestamp = ''): RenderPlan {
  return { nodes: [], visible: [], hidden: [], replaced: {}, overrides: {}, redirect: null, metadata: emptyMetadata(at), diagnostics: [] };
}

// ── STEP 2 · Builder ─────────────────────────────────────────────────────────────
export interface RenderPlanBuilderOptions { clock?: () => number }
export interface BuildPlanOptions { onEvent?: (e: RenderPlanEvent) => void; at?: Timestamp }

export interface RenderPlanBuilder {
  build(set: RenderInstructionSet, opts?: BuildPlanOptions): RenderPlan;
  merge(base: RenderPlan, overlay: RenderPlan): RenderPlan;
  validate(plan: RenderPlan): RenderPlanValidation;
}

/** Recompute the derived projections (visible/hidden/replaced + sizes) from the nodes. */
function finalize(plan: RenderPlan): RenderPlan {
  const visible: string[] = [];
  const hidden: string[] = [];
  const replaced: { [id: string]: Json } = {};
  for (const n of plan.nodes) {
    (n.visibility === 'hidden' ? hidden : visible).push(n.id);
    if (n.replaced && n.content !== undefined) replaced[n.id] = n.content;
  }
  plan.visible = visible;
  plan.hidden = hidden;
  plan.replaced = replaced;
  plan.metadata.nodeCount = plan.nodes.length;
  plan.metadata.hasRedirect = plan.redirect !== null;
  plan.metadata.planSize =
    plan.nodes.length + Object.keys(plan.overrides).length + Object.keys(plan.metadata.annotations).length + (plan.redirect !== null ? 1 : 0);
  return plan;
}

export function createRenderPlanBuilder(builderOpts: RenderPlanBuilderOptions = {}): RenderPlanBuilder {
  const clock = builderOpts.clock ?? defaultClock;

  const build = (set: RenderInstructionSet, opts: BuildPlanOptions = {}): RenderPlan => {
    const at = opts.at ?? '';
    const t0 = clock();
    const plan = emptyRenderPlan(at);
    const byId = new Map<string, RenderNodePlan>();

    const node = (i: RenderInstruction): RenderNodePlan => {
      const id = nodeId(i);
      let n = byId.get(id);
      if (!n) {
        n = { id, key: i.target.key ?? '*', targetType: i.target.type, visibility: 'visible', replaced: false, sources: [] };
        byId.set(id, n);
        plan.nodes.push(n);
      }
      n.sources.push(i.id);
      return n;
    };

    for (const instr of set.instructions) {
      switch (instr.type) {
        case 'show': {
          const n = node(instr);
          // `hide` is fail-closed: once hidden, a later `show` does not re-expose the node.
          if (n.visibility === 'hidden') plan.diagnostics.push(`show ignored for ${n.id}: already hidden (hide wins)`);
          else n.visibility = 'visible';
          break;
        }
        case 'hide': {
          const n = node(instr);
          if (n.visibility === 'visible' && n.sources.length > 1) plan.diagnostics.push(`hide overrides an earlier show for ${n.id}`);
          n.visibility = 'hidden';
          break;
        }
        case 'replace': {
          const n = node(instr);
          n.replaced = true;
          n.content = instr.value;
          break;
        }
        case 'override': {
          if (instr.target.key) plan.overrides[instr.target.key] = instr.value as Json;
          break;
        }
        case 'annotate': {
          if (instr.target.key) plan.metadata.annotations[instr.target.key] = instr.value as Json;
          break;
        }
        case 'redirect': {
          plan.redirect = typeof instr.value === 'string' && instr.value !== '' ? instr.value : plan.redirect;
          break;
        }
      }
    }

    plan.metadata.instructionCount = set.instructions.length;
    finalize(plan);
    plan.metadata.buildMs = clock() - t0;

    opts.onEvent?.({ type: 'plan.built', at, nodes: plan.metadata.nodeCount, planSize: plan.metadata.planSize, message: `${plan.metadata.instructionCount} instruction(s)` });
    return plan;
  };

  /** Deterministic merge: the overlay wins on every conflict. */
  const merge = (base: RenderPlan, overlay: RenderPlan): RenderPlan => {
    const merged = emptyRenderPlan(overlay.metadata.builtAt || base.metadata.builtAt);
    const byId = new Map<string, RenderNodePlan>();
    for (const n of [...base.nodes, ...overlay.nodes]) {
      const prev = byId.get(n.id);
      if (!prev) {
        byId.set(n.id, { ...n, sources: [...n.sources], overrides: n.overrides ? { ...n.overrides } : undefined });
      } else {
        // overlay (second) wins on visibility/content; sources and overrides accumulate
        prev.visibility = n.visibility;
        prev.replaced = n.replaced || prev.replaced;
        if (n.content !== undefined) prev.content = n.content;
        prev.overrides = (prev.overrides || n.overrides) ? { ...prev.overrides, ...n.overrides } : undefined;
        prev.sources = [...prev.sources, ...n.sources];
      }
    }
    merged.nodes = [...byId.values()];
    merged.overrides = { ...base.overrides, ...overlay.overrides };
    merged.redirect = overlay.redirect ?? base.redirect;
    merged.metadata.annotations = { ...base.metadata.annotations, ...overlay.metadata.annotations };
    merged.metadata.instructionCount = base.metadata.instructionCount + overlay.metadata.instructionCount;
    merged.metadata.buildMs = base.metadata.buildMs + overlay.metadata.buildMs;
    merged.diagnostics = [...base.diagnostics, ...overlay.diagnostics];
    return finalize(merged);
  };

  /** Structural invariants — catches hand-built or merged plans that cannot be rendered. */
  const validate = (plan: RenderPlan): RenderPlanValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const seen = new Set<string>();
    for (const n of plan.nodes) {
      if (seen.has(n.id)) errors.push(`duplicate node id: ${n.id}`);
      seen.add(n.id);
      if (n.replaced && n.content === undefined) errors.push(`node ${n.id} is replaced but has no content`);
      if (n.replaced && n.visibility === 'hidden') warnings.push(`node ${n.id} is replaced but hidden — the replacement will not show`);
      if (n.visibility === 'hidden' && n.overrides && Object.keys(n.overrides).length > 0) warnings.push(`node ${n.id} is hidden but carries overrides`);
    }
    for (const id of plan.visible) if (plan.hidden.includes(id)) errors.push(`node ${id} is both visible and hidden`);
    if (plan.redirect === '') errors.push('redirect is an empty string');
    if (plan.metadata.nodeCount !== plan.nodes.length) errors.push('metadata.nodeCount does not match nodes.length');

    return { valid: errors.length === 0, errors, warnings };
  };

  return { build, merge, validate };
}
