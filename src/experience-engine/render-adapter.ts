// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Render Decision Adapter (Wave 12).
//
// Decision Enforcement produces an EnforcedState. This adapter converts that state into
// renderer-AGNOSTIC instructions — it does NOT bind to, or change, the renderer. The instruction
// set is surfaced on the execution for a future renderer-binding wave to consume.
//
//   Decision Enforcement → Render Decision Adapter → RenderInstructionSet → (future) Renderer
//
// PURE + FRAMEWORK ONLY. It reads EnforcedState and emits instructions; it enforces nothing and
// renders nothing. Depends only on the enforcement/type CONTRACTS (one-directional — enforcement.ts
// does NOT import this module — so there is no cycle).
// ─────────────────────────────────────────────────────────────────────────────
import type { Json, Timestamp } from './types';
import type { EnforcedState } from './enforcement';

// ── STEP 1 · Render instruction model ───────────────────────────────────────────
/** STEP 3 · the supported instruction types. */
export type RenderInstructionType = 'hide' | 'show' | 'replace' | 'override' | 'redirect' | 'annotate';
export type RenderInstructionTargetType = 'section' | 'flag' | 'route' | 'configuration' | 'annotation' | (string & {});

export interface RenderInstructionTarget { type: RenderInstructionTargetType; key?: string }

export interface RenderInstruction {
  id: string;
  type: RenderInstructionType;
  target: RenderInstructionTarget;
  value?: Json;
  /** Where in the EnforcedState this instruction came from (diagnostics). */
  source: string;
}

export interface RenderAdapterIgnored { reason: string; detail?: string }

/** STEP 1 · the renderer-agnostic instruction set (+ diagnostics, STEP 6). */
export interface RenderInstructionSet {
  instructions: RenderInstruction[];
  redirect: string | null;
  produced: number;
  ignored: RenderAdapterIgnored[];
  executionMs: number;
}

// ── Events (STEP 7) ──────────────────────────────────────────────────────────────
export type RenderInstructionEventType = 'instruction.created' | 'instruction.ignored';
export interface RenderInstructionEvent { type: RenderInstructionEventType; instructionId?: string; target?: string; at: Timestamp; message?: string }

const defaultClock = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);
const targetKey = (t: RenderInstructionTarget): string => `${t.type}:${t.key ?? '*'}`;

// ── STEP 2 · Render Decision Adapter ────────────────────────────────────────────
export interface RenderDecisionAdapterOptions { clock?: () => number }
export interface AdaptOptions { onEvent?: (e: RenderInstructionEvent) => void; at?: Timestamp }

export interface RenderDecisionAdapter {
  adapt(state: EnforcedState, opts?: AdaptOptions): RenderInstructionSet;
  adaptMany(states: EnforcedState[], opts?: AdaptOptions): RenderInstructionSet[];
}

export function createRenderDecisionAdapter(adapterOpts: RenderDecisionAdapterOptions = {}): RenderDecisionAdapter {
  const clock = adapterOpts.clock ?? defaultClock;

  const adapt = (state: EnforcedState, opts: AdaptOptions = {}): RenderInstructionSet => {
    const at = opts.at ?? '';
    const t0 = clock();
    const instructions: RenderInstruction[] = [];
    const ignored: RenderAdapterIgnored[] = [];
    let n = 0;

    const create = (type: RenderInstructionType, target: RenderInstructionTarget, source: string, value?: Json): void => {
      const instr: RenderInstruction = { id: `ins_${n++}_${type}`, type, target, value, source };
      instructions.push(instr);
      opts.onEvent?.({ type: 'instruction.created', instructionId: instr.id, target: targetKey(target), at, message: type });
    };
    const ignore = (reason: string, detail?: string): void => {
      ignored.push({ reason, detail });
      opts.onEvent?.({ type: 'instruction.ignored', at, message: detail ? `${reason}: ${detail}` : reason });
    };

    // disabled → hide · enabled → show
    for (const key of state.disabled) create('hide', { type: 'flag', key }, 'enforced-state.disabled');
    for (const key of state.enabled) create('show', { type: 'flag', key }, 'enforced-state.enabled');

    // overrides / replacements / annotations — vacuous (undefined value) entries are ignored
    for (const key of Object.keys(state.overrides)) {
      const v = state.overrides[key];
      if (v === undefined) ignore('empty override', key);
      else create('override', { type: 'configuration', key }, 'enforced-state.overrides', v);
    }
    for (const key of Object.keys(state.replacements)) {
      const v = state.replacements[key];
      if (v === undefined) ignore('empty replacement', key);
      else create('replace', { type: 'section', key }, 'enforced-state.replacements', v);
    }
    for (const key of Object.keys(state.annotations)) {
      const v = state.annotations[key];
      if (v === undefined) ignore('empty annotation', key);
      else create('annotate', { type: 'annotation', key }, 'enforced-state.annotations', v);
    }

    // redirect
    let redirect: string | null = null;
    if (state.redirect !== null && state.redirect !== undefined) {
      if (state.redirect === '') ignore('empty redirect');
      else { redirect = state.redirect; create('redirect', { type: 'route' }, 'enforced-state.redirect', state.redirect); }
    }

    return { instructions, redirect, produced: instructions.length, ignored, executionMs: clock() - t0 };
  };

  return {
    adapt,
    adaptMany: (states, opts) => states.map(s => adapt(s, opts)),
  };
}
