// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Experimentation (Wave 3, Part 7).
// A/B testing over Growth Engine campaign variants: deterministic assignment (see
// growth/campaign.ts assignVariant), exposure/conversion/install/coupon tracking, and
// statistical winner detection. Backed by the generic collection
// (website_experiment_results); reusable by every tenant.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, ISODateTime, Result } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import type { CollectionRepository } from '../repositories/collection';
import { createCollection } from '../repositories/collection';
import type { RepositoryBackend } from '../repositories/registry';

export type ExperimentMetric = 'exposures' | 'conversions' | 'installs' | 'couponRedemptions';

export interface ExperimentResultRow {
  id: UUID;
  tenantId: UUID;
  campaignId: UUID;
  variantKey: string;
  exposures: number;
  conversions: number;
  installs: number;
  couponRedemptions: number;
  updatedAt: ISODateTime;
}
type Row = ExperimentResultRow & Record<string, unknown>;

export interface VariantStats {
  variantKey: string;
  exposures: number;
  conversions: number;
  installs: number;
  couponRedemptions: number;
  conversionRate: number;   // 0..1
}

export interface WinnerResult {
  variantKey: string;
  conversionRate: number;
  confident: boolean;       // met min sample + significance
  zScore: number;
}

export class ExperimentTracker {
  constructor(
    private readonly col: CollectionRepository<Row>,
    private readonly idgen: () => UUID = () => crypto.randomUUID(),
    private readonly clock: () => ISODateTime = () => new Date().toISOString(),
  ) {}

  private async bump(tenantId: UUID, campaignId: UUID, variantKey: string, metric: ExperimentMetric, by = 1): Promise<Result<Row>> {
    const found = await this.col.findOne({ tenantId, campaignId, variantKey });
    if (!isOk(found)) return err(found.error);
    const base: Row = found.value ?? { id: this.idgen(), tenantId, campaignId, variantKey, exposures: 0, conversions: 0, installs: 0, couponRedemptions: 0, updatedAt: this.clock() };
    const next: Row = { ...base, [metric]: (base[metric] as number) + by, updatedAt: this.clock() };
    const up = await this.col.upsert(next, ['campaignId', 'variantKey']);
    return isOk(up) ? ok(up.value) : err(up.error);
  }

  recordExposure(tenantId: UUID, campaignId: UUID, variantKey: string): Promise<Result<Row>> { return this.bump(tenantId, campaignId, variantKey, 'exposures'); }
  recordConversion(tenantId: UUID, campaignId: UUID, variantKey: string): Promise<Result<Row>> { return this.bump(tenantId, campaignId, variantKey, 'conversions'); }
  recordInstall(tenantId: UUID, campaignId: UUID, variantKey: string): Promise<Result<Row>> { return this.bump(tenantId, campaignId, variantKey, 'installs'); }
  recordCoupon(tenantId: UUID, campaignId: UUID, variantKey: string): Promise<Result<Row>> { return this.bump(tenantId, campaignId, variantKey, 'couponRedemptions'); }

  async summary(tenantId: UUID, campaignId: UUID): Promise<Result<VariantStats[]>> {
    const rows = await this.col.find({ tenantId, campaignId });
    if (!isOk(rows)) return err(rows.error);
    return ok(rows.value.map(toStats).sort((a, b) => b.conversionRate - a.conversionRate));
  }

  async winner(tenantId: UUID, campaignId: UUID, minSample = 100, minZ = 1.96): Promise<Result<WinnerResult | null>> {
    const summary = await this.summary(tenantId, campaignId);
    if (!isOk(summary)) return err(summary.error);
    return ok(detectWinner(summary.value, minSample, minZ));
  }
}

function toStats(r: Row): VariantStats {
  return { variantKey: r.variantKey, exposures: r.exposures, conversions: r.conversions, installs: r.installs, couponRedemptions: r.couponRedemptions, conversionRate: r.exposures ? r.conversions / r.exposures : 0 };
}

/** Two-proportion z-test of the best variant vs the runner-up (pooled). */
export function detectWinner(stats: ReadonlyArray<VariantStats>, minSample: number, minZ: number): WinnerResult | null {
  if (stats.length === 0) return null;
  const sorted = [...stats].sort((a, b) => b.conversionRate - a.conversionRate);
  const best = sorted[0];
  if (best.exposures < minSample) return { variantKey: best.variantKey, conversionRate: best.conversionRate, confident: false, zScore: 0 };
  const runner = sorted[1];
  if (!runner || runner.exposures < minSample) return { variantKey: best.variantKey, conversionRate: best.conversionRate, confident: false, zScore: 0 };

  const p1 = best.conversionRate, n1 = best.exposures;
  const p2 = runner.conversionRate, n2 = runner.exposures;
  const pPool = (best.conversions + runner.conversions) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  const z = se > 0 ? (p1 - p2) / se : 0;
  return { variantKey: best.variantKey, conversionRate: best.conversionRate, confident: z >= minZ, zScore: Math.round(z * 100) / 100 };
}

export function createExperimentTracker(backend: RepositoryBackend): ExperimentTracker {
  return new ExperimentTracker(createCollection<Row>(backend, 'website_experiment_results'));
}
