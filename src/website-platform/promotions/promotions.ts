// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Promotion Engine (Wave 4, Part 6).
// Configurable banners: homepage / campaign / timed / geo-targeted / device-targeted /
// category / checkout, with a dynamic CTA. Reuses the Wave 3 targeting matcher (geo/
// device/country/language/visitor) — no duplicate logic. Tenant-scoped
// (website_promotions aggregate). Reusable by every tenant.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, ISODateTime, Result } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import type { Auditable } from '../domain/entities';
import { Validator, isUuid, isNonEmptyString } from '../shared/validation';
import type { Repository } from '../repositories/repository';
import { defineAggregate } from '../repositories/mapping';
import type { RepositoryBackend } from '../repositories/registry';
import { matchTargeting, type ConversionTargeting, type ConversionRuntime } from '../conversion/conversion';

export const BANNER_PLACEMENTS = ['homepage', 'campaign', 'category', 'checkout', 'global'] as const;
export type BannerPlacement = typeof BANNER_PLACEMENTS[number];

export interface BannerContent {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  cta?: { label: string; href: string };
  couponCode?: string;
}
export interface BannerSchedule { startsAt?: ISODateTime | null; endsAt?: ISODateTime | null }

export interface PromotionBanner extends Auditable {
  siteId: UUID;
  name: string;
  enabled: boolean;
  priority: number;
  placement: BannerPlacement;
  category: string | null;         // for category banners
  targeting: ConversionTargeting;  // geo/device/country/language/visitor
  schedule: BannerSchedule;        // timed
  content: BannerContent;
}

export interface CreateBannerDto {
  tenantId: UUID; siteId: UUID; name: string; placement: BannerPlacement; content: BannerContent;
  enabled?: boolean; priority?: number; category?: string | null; targeting?: ConversionTargeting; schedule?: BannerSchedule;
}
export interface UpdateBannerDto {
  name?: string; enabled?: boolean; priority?: number; placement?: BannerPlacement; category?: string | null;
  targeting?: ConversionTargeting; schedule?: BannerSchedule; content?: BannerContent; expectedVersion?: number;
}

export function validateCreateBanner(i: CreateBannerDto): Result<CreateBannerDto> {
  return new Validator()
    .field(i.tenantId, 'tenantId', isUuid, 'uuid')
    .field(i.siteId, 'siteId', isUuid, 'uuid')
    .check(isNonEmptyString(i.name), 'name', 'required')
    .check((BANNER_PLACEMENTS as readonly string[]).includes(i.placement), 'placement', 'enum')
    .check(!!i.content && isNonEmptyString(i.content.title), 'content.title', 'required')
    .toResult(i);
}

export interface BannerRuntime extends ConversionRuntime { category?: string }

function scheduleActive(s: BannerSchedule, nowIso: ISODateTime): boolean {
  if (s.startsAt && nowIso < s.startsAt) return false;
  if (s.endsAt && nowIso > s.endsAt) return false;
  return true;
}

/** Resolve the ordered banners for a placement + runtime. Pure. */
export function resolveBanners(banners: ReadonlyArray<PromotionBanner>, placement: BannerPlacement, runtime: BannerRuntime, nowIso: ISODateTime): PromotionBanner[] {
  return banners
    .filter(b => b.enabled && b.deletedAt === null)
    .filter(b => b.placement === placement)
    .filter(b => scheduleActive(b.schedule, nowIso))
    .filter(b => !b.category || b.category === runtime.category)
    .filter(b => matchTargeting(b.targeting, runtime))
    .sort((a, b) => b.priority - a.priority);
}

// ── Repository + service ────────────────────────────────────────────────────────────
const bannerAggregate = defineAggregate<PromotionBanner, CreateBannerDto, UpdateBannerDto>({
  table: 'website_promotions', entityName: 'PromotionBanner',
  defaults: i => ({ enabled: i.enabled ?? true, priority: i.priority ?? 0, category: i.category ?? null, targeting: i.targeting ?? {}, schedule: i.schedule ?? {} }),
});

export class PromotionService {
  constructor(private readonly repo: Repository<PromotionBanner, CreateBannerDto, UpdateBannerDto>) {}
  async create(input: CreateBannerDto): Promise<Result<PromotionBanner>> {
    const v = validateCreateBanner(input);
    if (!isOk(v)) return err(v.error);
    return this.repo.create(input);
  }
  update(tenantId: UUID, id: UUID, patch: UpdateBannerDto, expectedVersion?: number): Promise<Result<PromotionBanner>> {
    return this.repo.update(tenantId, id, patch, expectedVersion);
  }
  remove(tenantId: UUID, id: UUID): Promise<Result<PromotionBanner>> { return this.repo.softDelete(tenantId, id); }
  async listEnabled(tenantId: UUID, siteId: UUID): Promise<Result<PromotionBanner[]>> {
    const r = await this.repo.list(tenantId, { pageSize: 200, filters: [{ field: 'siteId', operator: 'eq', value: siteId }, { field: 'enabled', operator: 'eq', value: true }] });
    return isOk(r) ? ok(r.value.items) : err(r.error);
  }
  async resolve(tenantId: UUID, siteId: UUID, placement: BannerPlacement, runtime: BannerRuntime, nowIso: ISODateTime): Promise<Result<PromotionBanner[]>> {
    const list = await this.listEnabled(tenantId, siteId);
    if (!isOk(list)) return err(list.error);
    return ok(resolveBanners(list.value, placement, runtime, nowIso));
  }
}

export function createPromotionService(backend: RepositoryBackend): PromotionService {
  return new PromotionService(backend === 'supabase' ? bannerAggregate.supabase() : bannerAggregate.memory());
}
