// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Rollout Controls & Metrics (Wave 15 · Production Enablement).
//
// NOT a new architectural layer. This is the operational control surface for the feature gate
// that Wave 14 already introduced: who gets Render Plan execution, how to turn it off instantly,
// and what it costs. Two small pieces:
//
//   RolloutGate    — global OFF / tenant ON / experience ON / percentage, + kill switch + breaker
//   RenderPlanMetrics — latency, plan size, nodes modified, operations executed/skipped
//
// PURE + DETERMINISTIC. Percentage bucketing is a stable hash of tenant+experience — never
// Math.random — so a given experience is consistently in or out of the canary across requests
// and processes. Default is DENY: an unconfigured gate executes nothing.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, ExperienceId, TenantId } from './types';

// ── STEP 1 · Feature gate ───────────────────────────────────────────────────────
export interface RolloutConfig {
  /** GLOBAL master switch. `false` (the default) is a hard OFF for every tenant. */
  enabled: boolean;
  /** Tenants explicitly opted in. */
  tenants?: TenantId[];
  /** Experiences explicitly opted in (the narrowest canary). */
  experiences?: ExperienceId[];
  /** Deterministic percentage rollout, 0–100. */
  percentage?: number;
  /** Circuit breaker: trip (auto-disable) after N consecutive execution failures. */
  tripAfterFailures?: number;
}

export interface RolloutContext { tenantId: TenantId; experienceId: ExperienceId; channel?: ChannelId }

export type RolloutReason =
  | 'global-off' | 'tripped' | 'experience-allowlist' | 'tenant-allowlist'
  | 'percentage-in' | 'percentage-out' | 'no-criteria';

export interface RolloutDecision { execute: boolean; reason: RolloutReason; bucket?: number }

export interface RolloutStatus {
  enabled: boolean;
  tripped: boolean;
  consecutiveFailures: number;
  totalFailures: number;
  lastDisableReason: string | null;
}

export interface RolloutGate {
  shouldExecute(ctx: RolloutContext): RolloutDecision;
  /** STEP 3 · instant disable (kill switch). Takes effect on the very next request. */
  disable(reason?: string): void;
  enable(): void;
  update(patch: Partial<RolloutConfig>): void;
  config(): Readonly<RolloutConfig>;
  /** Feed execution outcomes so the circuit breaker can trip on repeated failures. */
  recordOutcome(ok: boolean): void;
  tripped(): boolean;
  reset(): void;
  status(): RolloutStatus;
}

/** Stable, seedless hash → deterministic bucketing (no Math.random anywhere in the engine). */
export function rolloutBucket(tenantId: TenantId, experienceId: ExperienceId): number {
  const s = `${tenantId}:${experienceId}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h % 100;
}

export function createRolloutGate(initial: RolloutConfig = { enabled: false }): RolloutGate {
  let config: RolloutConfig = { ...initial };
  let consecutiveFailures = 0;
  let totalFailures = 0;
  let isTripped = false;
  let lastDisableReason: string | null = null;

  return {
    shouldExecute(ctx: RolloutContext): RolloutDecision {
      if (isTripped) return { execute: false, reason: 'tripped' };
      if (!config.enabled) return { execute: false, reason: 'global-off' };

      if (config.experiences && config.experiences.includes(ctx.experienceId)) {
        return { execute: true, reason: 'experience-allowlist' };
      }
      if (config.tenants && config.tenants.includes(ctx.tenantId)) {
        return { execute: true, reason: 'tenant-allowlist' };
      }
      if (typeof config.percentage === 'number' && config.percentage > 0) {
        const bucket = rolloutBucket(ctx.tenantId, ctx.experienceId);
        return bucket < config.percentage
          ? { execute: true, reason: 'percentage-in', bucket }
          : { execute: false, reason: 'percentage-out', bucket };
      }
      // Enabled but nothing selected — deny by default rather than roll out globally.
      return { execute: false, reason: 'no-criteria' };
    },

    disable(reason = 'manual kill switch'): void { config = { ...config, enabled: false }; lastDisableReason = reason; },
    enable(): void { config = { ...config, enabled: true }; },
    update(patch: Partial<RolloutConfig>): void { config = { ...config, ...patch }; },
    config(): Readonly<RolloutConfig> { return { ...config }; },

    recordOutcome(ok: boolean): void {
      if (ok) { consecutiveFailures = 0; return; }
      consecutiveFailures++;
      totalFailures++;
      const limit = config.tripAfterFailures;
      if (typeof limit === 'number' && limit > 0 && consecutiveFailures >= limit && !isTripped) {
        isTripped = true;
        lastDisableReason = `circuit breaker: ${consecutiveFailures} consecutive failures`;
      }
    },
    tripped(): boolean { return isTripped; },
    reset(): void { isTripped = false; consecutiveFailures = 0; lastDisableReason = null; },
    status(): RolloutStatus { return { enabled: config.enabled, tripped: isTripped, consecutiveFailures, totalFailures, lastDisableReason }; },
  };
}

// ── STEP 2 · Metrics ────────────────────────────────────────────────────────────
export interface RenderPlanSample {
  executionMs: number;
  planSize: number;
  nodesModified: number;
  applied: number;
  skipped: number;
  redirected: boolean;
  failed: boolean;
}

export interface RenderPlanMetricsSnapshot {
  executions: number;
  failures: number;
  redirects: number;
  latencyMs: { total: number; min: number; max: number; avg: number };
  planSize: { total: number; max: number; avg: number };
  nodesModified: number;
  operationsExecuted: number;
  operationsSkipped: number;
}

export interface RenderPlanMetrics {
  record(sample: RenderPlanSample): void;
  snapshot(): RenderPlanMetricsSnapshot;
  reset(): void;
}

export function createRenderPlanMetrics(): RenderPlanMetrics {
  let executions = 0, failures = 0, redirects = 0;
  let latTotal = 0, latMin = Number.POSITIVE_INFINITY, latMax = 0;
  let sizeTotal = 0, sizeMax = 0;
  let nodesModified = 0, opsExecuted = 0, opsSkipped = 0;

  return {
    record(s: RenderPlanSample): void {
      executions++;
      if (s.failed) failures++;
      if (s.redirected) redirects++;
      latTotal += s.executionMs;
      if (s.executionMs < latMin) latMin = s.executionMs;
      if (s.executionMs > latMax) latMax = s.executionMs;
      sizeTotal += s.planSize;
      if (s.planSize > sizeMax) sizeMax = s.planSize;
      nodesModified += s.nodesModified;
      opsExecuted += s.applied;
      opsSkipped += s.skipped;
    },
    snapshot(): RenderPlanMetricsSnapshot {
      return {
        executions, failures, redirects,
        latencyMs: { total: latTotal, min: executions ? latMin : 0, max: latMax, avg: executions ? latTotal / executions : 0 },
        planSize: { total: sizeTotal, max: sizeMax, avg: executions ? sizeTotal / executions : 0 },
        nodesModified, operationsExecuted: opsExecuted, operationsSkipped: opsSkipped,
      };
    },
    reset(): void {
      executions = 0; failures = 0; redirects = 0;
      latTotal = 0; latMin = Number.POSITIVE_INFINITY; latMax = 0;
      sizeTotal = 0; sizeMax = 0; nodesModified = 0; opsExecuted = 0; opsSkipped = 0;
    },
  };
}
