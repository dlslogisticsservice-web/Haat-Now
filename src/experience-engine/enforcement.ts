// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Decision Enforcement Engine (Wave 11).
//
// A Runtime capability (not new infrastructure). The Runtime already EVALUATES decisions
// (policy effect + directives, feature flags); this engine RESOLVES those into typed decisions
// and APPLIES them to an authoritative EnforcedState immediately before rendering.
//
//   … → Policy → Decision Enforcement → Rendering → Response
//
// PURE + FRAMEWORK ONLY. It applies decisions to a state model and reports what happened; it does
// NOT change UI rendering (the EnforcedState is the seam a later wave binds to the renderer).
// Depends only on the type/policy/flags CONTRACTS (one-directional — policy.ts and flags.ts do
// NOT import this module — so there is no cycle).
// ─────────────────────────────────────────────────────────────────────────────
import type { ExperienceId, Json, Timestamp } from './types';
import type { EffectivePolicyDecision } from './policy';
import type { EffectiveFlags } from './flags';

// ── STEP 1 · Decision model ─────────────────────────────────────────────────────
/** STEP 3 · the supported actions. */
export type DecisionAction = 'enable' | 'disable' | 'replace' | 'override' | 'redirect' | 'annotate';
export type DecisionSource = 'policy' | 'feature-flag' | (string & {});
export type DecisionTargetType = 'experience' | 'flag' | 'configuration' | 'route' | 'section' | 'annotation' | (string & {});

export interface DecisionTarget { type: DecisionTargetType; key?: string }

export interface Decision {
  id: string;
  action: DecisionAction;
  target: DecisionTarget;
  value?: Json;
  priority: number;
  source: DecisionSource;
  reason?: string;
}

/** The state decisions are applied to — models the enforcement effect without touching rendering. */
export interface EnforcedState {
  enabled: string[];
  disabled: string[];
  overrides: { [key: string]: Json };
  replacements: { [key: string]: Json };
  annotations: { [key: string]: Json };
  redirect: string | null;
}

/** STEP 1 · a per-decision record (the decision trace). */
export interface DecisionTrace {
  decisionId: string;
  action: DecisionAction;
  target: DecisionTarget;
  applied: boolean;
  source: DecisionSource;
  reason: string;
}

export interface DecisionConflict { target: string; winner: string; loser: string; winningAction: DecisionAction; losingAction: DecisionAction }

/** STEP 1 · the outcome of applying a set of decisions (diagnostics · STEP 7). */
export interface DecisionOutcome {
  state: EnforcedState;
  applied: DecisionTrace[];
  skipped: DecisionTrace[];
  conflicts: DecisionConflict[];
  executionMs: number;
}

// ── Events (STEP 8) ──────────────────────────────────────────────────────────────
export type DecisionEventType = 'decision.applied' | 'decision.skipped' | 'decision.conflict';
export interface DecisionEvent { type: DecisionEventType; decisionId?: string; target?: string; at: Timestamp; message?: string }

const defaultClock = (): number => (typeof performance !== 'undefined' && performance.now ? performance.now() : 0);
const emptyState = (): EnforcedState => ({ enabled: [], disabled: [], overrides: {}, replacements: {}, annotations: {}, redirect: null });
const targetKey = (t: DecisionTarget): string => `${t.type}:${t.key ?? '*'}`;
const sameEffect = (a: Decision, b: Decision): boolean => a.action === b.action && JSON.stringify(a.value ?? null) === JSON.stringify(b.value ?? null);
const trace = (d: Decision, applied: boolean, reason: string): DecisionTrace => ({ decisionId: d.id, action: d.action, target: d.target, applied, source: d.source, reason });

// ── STEP 2 · Decision Resolver (effective decision + flags → typed decisions) ───
export interface DecisionResolverInput {
  policy?: EffectivePolicyDecision;
  flags?: EffectiveFlags;
  experienceId?: ExperienceId;
}

export interface DecisionResolver { resolve(input: DecisionResolverInput): Decision[] }

/**
 * Map the effective Policy Decision (STEP 4) and effective Feature Flags (STEP 5) to decisions.
 * Convention: policy `deny` disables the experience; a `redirect` directive redirects; `override.*`
 * / `replace.*` prefixes map to those actions; `flag.*` directives are ignored (flags are the
 * authoritative flag source); everything else annotates. Each flag becomes an enable/disable.
 */
export function createDecisionResolver(): DecisionResolver {
  return {
    resolve(input: DecisionResolverInput): Decision[] {
      const out: Decision[] = [];
      let n = 0;
      const id = (s: string): string => `dec_${n++}_${s}`;

      const p = input.policy;
      if (p) {
        if (p.effect === 'deny') out.push({ id: id('deny'), action: 'disable', target: { type: 'experience', key: input.experienceId }, priority: 1000, source: 'policy', reason: 'policy deny' });
        for (const key of Object.keys(p.directives)) {
          const value = p.directives[key];
          if (key.startsWith('flag.')) continue;
          else if (key === 'redirect') out.push({ id: id('redirect'), action: 'redirect', target: { type: 'route' }, value, priority: 200, source: 'policy', reason: 'policy redirect' });
          else if (key.startsWith('override.')) out.push({ id: id(key), action: 'override', target: { type: 'configuration', key: key.slice('override.'.length) }, value, priority: 100, source: 'policy' });
          else if (key.startsWith('replace.')) out.push({ id: id(key), action: 'replace', target: { type: 'section', key: key.slice('replace.'.length) }, value, priority: 100, source: 'policy' });
          else out.push({ id: id(key), action: 'annotate', target: { type: 'annotation', key }, value, priority: 50, source: 'policy' });
        }
      }

      const flags = input.flags;
      if (flags) {
        for (const key of Object.keys(flags)) {
          const f = flags[key];
          out.push({ id: id(`flag_${key}`), action: f.enabled ? 'enable' : 'disable', target: { type: 'flag', key }, value: f.variant ?? f.value, priority: 10, source: 'feature-flag', reason: f.enabled ? 'flag on' : 'flag off' });
        }
      }
      return out;
    },
  };
}

// ── STEP 2 · Decision Enforcer ──────────────────────────────────────────────────
export interface DecisionEnforcerOptions { clock?: () => number; onEvent?: (e: DecisionEvent) => void }

export class DecisionEnforcer {
  private readonly clock: () => number;
  private readonly onEvent?: (e: DecisionEvent) => void;
  constructor(opts: DecisionEnforcerOptions = {}) { this.clock = opts.clock ?? defaultClock; this.onEvent = opts.onEvent; }

  private applyToState(d: Decision, state: EnforcedState): void {
    const key = d.target.key;
    switch (d.action) {
      case 'enable': if (key && !state.enabled.includes(key)) state.enabled.push(key); break;
      case 'disable': if (key && !state.disabled.includes(key)) state.disabled.push(key); break;
      case 'override': if (key) state.overrides[key] = d.value as Json; break;
      case 'replace': if (key) state.replacements[key] = d.value as Json; break;
      case 'annotate': if (key) state.annotations[key] = d.value as Json; break;
      case 'redirect': state.redirect = typeof d.value === 'string' ? d.value : String(d.value ?? ''); break;
    }
  }

  /** Apply one decision to a state + owner map. Returns whether it applied (+ any conflict). */
  apply(decision: Decision, state: EnforcedState, owner: { [k: string]: Decision }, at: Timestamp): { applied: boolean; conflict?: DecisionConflict; trace: DecisionTrace } {
    const tkey = targetKey(decision.target);
    const prev = owner[tkey];
    if (prev) {
      if (sameEffect(prev, decision)) {
        const t = trace(decision, false, `redundant with ${prev.id}`);
        this.onEvent?.({ type: 'decision.skipped', decisionId: decision.id, target: tkey, at, message: 'redundant' });
        return { applied: false, trace: t };
      }
      const conflict: DecisionConflict = { target: tkey, winner: prev.id, loser: decision.id, winningAction: prev.action, losingAction: decision.action };
      const t = trace(decision, false, `conflict: superseded by ${prev.id}`);
      this.onEvent?.({ type: 'decision.conflict', decisionId: decision.id, target: tkey, at, message: `superseded by ${prev.id}` });
      this.onEvent?.({ type: 'decision.skipped', decisionId: decision.id, target: tkey, at, message: 'conflict' });
      return { applied: false, conflict, trace: t };
    }
    this.applyToState(decision, state);
    owner[tkey] = decision;
    const t = trace(decision, true, decision.reason ?? 'applied');
    this.onEvent?.({ type: 'decision.applied', decisionId: decision.id, target: tkey, at, message: decision.action });
    return { applied: true, trace: t };
  }

  /** Apply many decisions in priority order (highest first). Deterministic conflict resolution. */
  applyMany(decisions: Decision[], at: Timestamp = ''): DecisionOutcome {
    const t0 = this.clock();
    const sorted = [...decisions].sort((a, b) => b.priority - a.priority);
    const state = emptyState();
    const owner: { [k: string]: Decision } = {};
    const applied: DecisionTrace[] = [];
    const skipped: DecisionTrace[] = [];
    const conflicts: DecisionConflict[] = [];
    for (const d of sorted) {
      const r = this.apply(d, state, owner, at);
      if (r.applied) applied.push(r.trace); else skipped.push(r.trace);
      if (r.conflict) conflicts.push(r.conflict);
    }
    return { state, applied, skipped, conflicts, executionMs: this.clock() - t0 };
  }
}

export function createDecisionEnforcer(opts: DecisionEnforcerOptions = {}): DecisionEnforcer { return new DecisionEnforcer(opts); }

// ── The enforcement coordinator the Runtime drives ──────────────────────────────
export interface EnforceOptions { onEvent?: (e: DecisionEvent) => void; at?: Timestamp }

export interface DecisionEnforcement {
  enforce(input: DecisionResolverInput, opts?: EnforceOptions): DecisionOutcome;
}

export function createDecisionEnforcement(opts: { clock?: () => number } = {}): DecisionEnforcement {
  const resolver = createDecisionResolver();
  return {
    enforce(input: DecisionResolverInput, enforceOpts: EnforceOptions = {}): DecisionOutcome {
      const enforcer = new DecisionEnforcer({ clock: opts.clock, onEvent: enforceOpts.onEvent });
      return enforcer.applyMany(resolver.resolve(input), enforceOpts.at ?? '');
    },
  };
}
