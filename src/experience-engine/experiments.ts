// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Experiment Engine (Wave 17).
//
// The first Dynamic Experience capability. It assigns a deterministic variant per unit, records
// exposure/click/conversion/completion, and reports per-variant rates.
//
//   Audience → Feature Flags → EXPERIMENT → Decision → Execution
//
// It plugs into the EXISTING decision pipeline as an `ExperimentPolicy` — the policy type that
// policy.ts has declared since Wave 7 — so the Runtime, the Rendering pipeline and the Engine are
// untouched. Registering the policy on `engine.policies` is the whole integration.
//
// PURE + DETERMINISTIC. Bucketing is a stable hash — never Math.random, never Date.now. The same
// unit always lands in the same variant, in every process, forever. Timestamps are injected.
// NO Personalization and NO AI: this allocates and measures, it does not infer.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, Environment, ExperienceId, Json, Timestamp } from './types';
import type { Policy, PolicyContext, PolicyResult } from './policy';

// ── STEP 1 · Model ───────────────────────────────────────────────────────────────
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

/** The allocation unit. `visitor` needs an injected stable id — see `resolveUnit`. */
export type ExperimentUnit = 'visitor' | 'tenant' | 'experience' | (string & {});

export interface ExperimentVariant {
  key: string;
  /** Relative weight. Two variants at 50/50 is A/B; three at 1/1/1 is an even multi-variant split. */
  weight: number;
  /** Optional payload the downstream decision can carry (e.g. a copy string, a layout token). */
  value?: Json;
  /** Marks the control arm — used for lift, never for allocation. */
  control?: boolean;
}

export interface ExperimentAllocation {
  unit: ExperimentUnit;
  /** Changes the hash space — rotate to re-randomise an experiment without renaming it. */
  salt?: string;
  /** Percentage of units eligible at all, 0–100 (default 100). Independent of variant weights. */
  traffic?: number;
}

/** Where an experiment is allowed to run. Matched against the PolicyContext. */
export interface ExperimentScope {
  audiences?: string[];
  experiences?: ExperienceId[];
  channels?: ChannelId[];
  environments?: Environment[];
}

export interface ExperimentMetadata {
  id: string;
  name: string;
  version: string;
  priority?: number;
  description?: string;
  hypothesis?: string;
}

export interface Experiment {
  metadata: ExperimentMetadata;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  allocation: ExperimentAllocation;
  scope?: ExperimentScope;
}

export type AssignmentReason =
  | 'assigned' | 'not-running' | 'no-variants' | 'invalid-weights' | 'out-of-traffic' | 'out-of-scope';

export interface ExperimentAssignment {
  experimentId: string;
  /** null when the unit is not in the experiment (see `reason`). */
  variant: string | null;
  value?: Json;
  control: boolean;
  bucket: number;
  reason: AssignmentReason;
}

export interface Exposure { experimentId: string; variant: string; unitId: string; at: Timestamp }
export interface Conversion { experimentId: string; variant: string; unitId: string; metric: string; value: number; at: Timestamp }

// ── STEP 2 · Deterministic bucketing ─────────────────────────────────────────────
const BUCKETS = 10_000;

const djb2 = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
};

/** Stable bucket in [0, 10000). Same inputs → same bucket, in every process, always. */
export function experimentBucket(unitId: string, salt = ''): number {
  return djb2(`${salt}|${unitId}`) % BUCKETS;
}

/**
 * Allocate a variant for a unit. Pure and stable.
 *
 * Traffic gating uses a SEPARATE hash space from variant selection, so raising `traffic` admits
 * new units without reshuffling the variant of anyone already in the experiment.
 */
export function allocateVariant(experiment: Experiment, unitId: string): ExperimentAssignment {
  const id = experiment.metadata.id;
  const salt = experiment.allocation.salt ?? '';
  const bucket = experimentBucket(`${unitId}|${id}`, salt);
  const base: ExperimentAssignment = { experimentId: id, variant: null, control: false, bucket, reason: 'assigned' };

  if (experiment.status !== 'running') return { ...base, reason: 'not-running' };
  if (!experiment.variants || experiment.variants.length === 0) return { ...base, reason: 'no-variants' };

  const total = experiment.variants.reduce((sum, v) => sum + (v.weight > 0 ? v.weight : 0), 0);
  if (total <= 0) return { ...base, reason: 'invalid-weights' };

  const traffic = experiment.allocation.traffic;
  if (typeof traffic === 'number' && traffic < 100) {
    if (traffic <= 0) return { ...base, reason: 'out-of-traffic' };
    const trafficBucket = experimentBucket(`${unitId}|${id}`, `${salt}:traffic`) % 100;
    if (trafficBucket >= traffic) return { ...base, reason: 'out-of-traffic' };
  }

  // Cumulative-weight selection over the stable bucket.
  const point = (bucket / BUCKETS) * total;
  let acc = 0;
  for (const v of experiment.variants) {
    if (v.weight <= 0) continue;
    acc += v.weight;
    if (point < acc) return { ...base, variant: v.key, value: v.value, control: !!v.control, reason: 'assigned' };
  }
  const last = experiment.variants[experiment.variants.length - 1];
  return { ...base, variant: last.key, value: last.value, control: !!last.control, reason: 'assigned' };
}

// ── Scope matching (pure) ────────────────────────────────────────────────────────
const hit = <T>(allowed: T[] | undefined, value: T | undefined): boolean =>
  !allowed || allowed.length === 0 || (value !== undefined && allowed.includes(value));
const overlaps = (allowed: string[] | undefined, values: string[] | undefined): boolean =>
  !allowed || allowed.length === 0 || (!!values && values.some(v => allowed.includes(v)));

export function experimentInScope(experiment: Experiment, ctx: PolicyContext): boolean {
  const s = experiment.scope;
  if (!s) return true;
  return hit(s.channels, ctx.channel)
    && hit(s.environments, ctx.environment)
    && hit(s.experiences, ctx.experienceId)
    && overlaps(s.audiences, ctx.audiences);
}

// ── Registry ─────────────────────────────────────────────────────────────────────
export interface ExperimentRegistry {
  register(experiment: Experiment): void;
  unregister(id: string): void;
  get(id: string): Experiment | null;
  has(id: string): boolean;
  all(): Experiment[];
  running(): Experiment[];
  setStatus(id: string, status: ExperimentStatus): void;
  ids(): string[];
  size(): number;
  clear(): void;
}

export class InMemoryExperimentRegistry implements ExperimentRegistry {
  private readonly experiments = new Map<string, Experiment>();
  register(e: Experiment): void { this.experiments.set(e.metadata.id, e); }
  unregister(id: string): void { this.experiments.delete(id); }
  get(id: string): Experiment | null { return this.experiments.get(id) ?? null; }
  has(id: string): boolean { return this.experiments.has(id); }
  all(): Experiment[] { return [...this.experiments.values()]; }
  running(): Experiment[] { return this.all().filter(e => e.status === 'running'); }
  setStatus(id: string, status: ExperimentStatus): void {
    const e = this.experiments.get(id);
    if (e) this.experiments.set(id, { ...e, status });
  }
  ids(): string[] { return [...this.experiments.keys()]; }
  size(): number { return this.experiments.size; }
  clear(): void { this.experiments.clear(); }
}

export function createExperimentRegistry(): ExperimentRegistry { return new InMemoryExperimentRegistry(); }

// ── STEP 4/5 · Exposure tracking + metrics ──────────────────────────────────────
export interface VariantStats {
  variant: string;
  exposures: number;
  clicks: number;
  conversions: number;
  completions: number;
  /** clicks ÷ exposures */
  ctr: number;
  /** conversions ÷ exposures */
  conversionRate: number;
  /** completions ÷ exposures */
  completionRate: number;
}

export interface WinnerVerdict {
  variant: string | null;
  /** False whenever the data does not support calling it — read `reason`. */
  confident: boolean;
  reason: string;
  /** Relative lift of the winner's conversion rate over the runner-up (or control). */
  lift?: number;
}

export interface ExperimentReport {
  experimentId: string;
  totals: { exposures: number; clicks: number; conversions: number; completions: number };
  variants: VariantStats[];
  winner: WinnerVerdict;
}

export interface WinnerOptions {
  /** Minimum exposures PER VARIANT before a winner may be called (default 100). */
  minExposures?: number;
  /** Minimum relative lift over the runner-up to call separation (default 0.05 = 5%). */
  minLift?: number;
}

export interface ExperimentTracker {
  exposure(experimentId: string, variant: string, unitId: string, at?: Timestamp): void;
  click(experimentId: string, variant: string, unitId: string, at?: Timestamp): void;
  conversion(experimentId: string, variant: string, unitId: string, metric?: string, value?: number, at?: Timestamp): void;
  completion(experimentId: string, variant: string, unitId: string, at?: Timestamp): void;
  /** Exposures are de-duplicated per (experiment, unit) so a re-render is not a second exposure. */
  report(experimentId: string, opts?: WinnerOptions): ExperimentReport;
  exposures(): Exposure[];
  conversions(): Conversion[];
  reset(): void;
}

interface Counters { exposures: number; clicks: number; conversions: number; completions: number }
const emptyCounters = (): Counters => ({ exposures: 0, clicks: 0, conversions: 0, completions: 0 });
const rate = (n: number, d: number): number => (d > 0 ? n / d : 0);

export interface ExperimentTrackerOptions {
  /** Optional sink so a host can forward exposure/conversion to its own analytics seam. */
  onEvent?: (event: 'exposure' | 'click' | 'conversion' | 'completion', payload: Record<string, unknown>) => void;
}

export function createExperimentTracker(opts: ExperimentTrackerOptions = {}): ExperimentTracker {
  const counters = new Map<string, Map<string, Counters>>();   // experimentId → variant → counters
  const exposedUnits = new Set<string>();                       // `${experimentId}|${unitId}`
  const exposureLog: Exposure[] = [];
  const conversionLog: Conversion[] = [];

  const bucketFor = (experimentId: string, variant: string): Counters => {
    let byVariant = counters.get(experimentId);
    if (!byVariant) { byVariant = new Map(); counters.set(experimentId, byVariant); }
    let c = byVariant.get(variant);
    if (!c) { c = emptyCounters(); byVariant.set(variant, c); }
    return c;
  };

  return {
    exposure(experimentId, variant, unitId, at = ''): void {
      const key = `${experimentId}|${unitId}`;
      if (exposedUnits.has(key)) return;   // one exposure per unit — re-renders must not inflate it
      exposedUnits.add(key);
      bucketFor(experimentId, variant).exposures++;
      exposureLog.push({ experimentId, variant, unitId, at });
      opts.onEvent?.('exposure', { experimentId, variant, unitId, at });
    },
    click(experimentId, variant, unitId, at = ''): void {
      bucketFor(experimentId, variant).clicks++;
      opts.onEvent?.('click', { experimentId, variant, unitId, at });
    },
    conversion(experimentId, variant, unitId, metric = 'default', value = 1, at = ''): void {
      bucketFor(experimentId, variant).conversions++;
      conversionLog.push({ experimentId, variant, unitId, metric, value, at });
      opts.onEvent?.('conversion', { experimentId, variant, unitId, metric, value, at });
    },
    completion(experimentId, variant, unitId, at = ''): void {
      bucketFor(experimentId, variant).completions++;
      opts.onEvent?.('completion', { experimentId, variant, unitId, at });
    },

    report(experimentId, winnerOpts: WinnerOptions = {}): ExperimentReport {
      const byVariant = counters.get(experimentId) ?? new Map<string, Counters>();
      const variants: VariantStats[] = [...byVariant.entries()].map(([variant, c]) => ({
        variant,
        exposures: c.exposures, clicks: c.clicks, conversions: c.conversions, completions: c.completions,
        ctr: rate(c.clicks, c.exposures),
        conversionRate: rate(c.conversions, c.exposures),
        completionRate: rate(c.completions, c.exposures),
      })).sort((a, b) => b.conversionRate - a.conversionRate);

      const totals = variants.reduce((t, v) => ({
        exposures: t.exposures + v.exposures, clicks: t.clicks + v.clicks,
        conversions: t.conversions + v.conversions, completions: t.completions + v.completions,
      }), { exposures: 0, clicks: 0, conversions: 0, completions: 0 });

      return { experimentId, totals, variants, winner: decideWinner(variants, winnerOpts) };
    },

    exposures: () => exposureLog.slice(),
    conversions: () => conversionLog.slice(),
    reset(): void { counters.clear(); exposedUnits.clear(); exposureLog.length = 0; conversionLog.length = 0; },
  };
}

/**
 * A deliberately CONSERVATIVE winner heuristic.
 *
 * This is a guard-rail, NOT a statistical significance test. It refuses to call a winner on thin
 * data or a narrow margin, and reports why. A real rollout decision should still be confirmed with
 * a proper significance calculation on the exported counts.
 */
export function decideWinner(variants: VariantStats[], opts: WinnerOptions = {}): WinnerVerdict {
  const minExposures = opts.minExposures ?? 100;
  const minLift = opts.minLift ?? 0.05;

  if (variants.length === 0) return { variant: null, confident: false, reason: 'no data' };
  if (variants.length === 1) return { variant: null, confident: false, reason: 'only one variant has data' };

  const underpowered = variants.filter(v => v.exposures < minExposures);
  if (underpowered.length > 0) {
    return { variant: null, confident: false, reason: `insufficient exposures (need ${minExposures} per variant; ${underpowered.map(v => `${v.variant}=${v.exposures}`).join(', ')})` };
  }

  const [best, runnerUp] = variants;   // already sorted by conversionRate desc
  if (best.conversionRate <= 0) return { variant: null, confident: false, reason: 'no conversions recorded' };

  const lift = runnerUp.conversionRate > 0
    ? (best.conversionRate - runnerUp.conversionRate) / runnerUp.conversionRate
    : Number.POSITIVE_INFINITY;

  if (lift < minLift) {
    return { variant: null, confident: false, reason: `no separation (lift ${(lift * 100).toFixed(1)}% < ${(minLift * 100).toFixed(0)}%)`, lift };
  }
  return { variant: best.variant, confident: true, reason: `leads by ${(lift * 100).toFixed(1)}% conversion lift`, lift: lift === Number.POSITIVE_INFINITY ? undefined : lift };
}

// ── STEP 6 · Runtime integration via the EXISTING decision pipeline ─────────────
export interface ExperimentPolicyOptions {
  id?: string;
  priority?: number;
  tracker?: ExperimentTracker;
  /**
   * The stable allocation unit for a request. The default (`tenant:experience`) is COARSE — every
   * visitor of a page lands in the same variant. Inject a visitor/session id for true user-level
   * A/B; this module will not fabricate one.
   */
  resolveUnit?: (ctx: PolicyContext) => string;
  /** Timestamp for exposure records (injected — this module never reads a clock). */
  now?: (ctx: PolicyContext) => Timestamp;
}

const defaultUnit = (ctx: PolicyContext): string => `${ctx.tenantId}:${ctx.experienceId ?? '-'}`;

/**
 * An `experiment`-typed Policy that allocates variants and emits them as `experiment.<id>`
 * directives. The Policy Engine already runs in the runtime's policy stage, so registering this on
 * `engine.policies` is the entire integration — no Runtime, Rendering or Engine change.
 */
export function createExperimentPolicy(registry: ExperimentRegistry, opts: ExperimentPolicyOptions = {}): Policy {
  const metadata = {
    id: opts.id ?? 'policy.experiments',
    name: 'Experiment Policy',
    type: 'experiment' as const,
    version: '1.0.0',
    priority: opts.priority ?? 0,
  };
  const resolveUnit = opts.resolveUnit ?? defaultUnit;
  const at = opts.now ?? ((ctx: PolicyContext) => ctx.now ?? '');

  return {
    metadata,
    applies: () => true,
    health: () => ({ status: 'healthy' as const }),
    evaluate(ctx: PolicyContext): PolicyResult {
      const unitId = resolveUnit(ctx);
      const directives: Array<{ key: string; value: Json }> = [];

      for (const experiment of registry.running()) {
        if (!experimentInScope(experiment, ctx)) continue;
        const assignment = allocateVariant(experiment, unitId);
        if (!assignment.variant) continue;   // out of traffic / not eligible → no directive, no exposure
        opts.tracker?.exposure(experiment.metadata.id, assignment.variant, unitId, at(ctx));
        directives.push({ key: `experiment.${experiment.metadata.id}`, value: assignment.variant });
      }

      return { effect: 'annotate', directives, reason: directives.length ? 'experiment variants assigned' : 'no experiments assigned' };
    },
  };
}
