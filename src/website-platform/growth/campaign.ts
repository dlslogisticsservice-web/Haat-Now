// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Mobile App Growth Engine (Wave 3, Part 5).
// A configurable campaign PLATFORM (not a popup): administrators control every field
// from Website Center; multiple campaigns run concurrently with A/B variants. Reuses the
// Wave 2 Conversion Engine helpers (targeting/triggers/frequency) + deep linking — no
// duplicated logic. Tenant-scoped (website_growth_campaigns); reusable by every tenant.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, ISODateTime, Result } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import type { Auditable } from '../domain/entities';
import { Validator, isUuid, isNonEmptyString } from '../shared/validation';
import type { Repository } from '../repositories/repository';
import { defineAggregate } from '../repositories/mapping';
import type { RepositoryBackend } from '../repositories/registry';
import { contentHash } from '../snapshot/snapshot';
import {
  matchTargeting, matchTrigger, frequencyAllowsFor,
  type ConversionTargeting, type ConversionTrigger, type ConversionContent,
  type ConversionFrequency, type ConversionTiming, type ConversionRuntime, type ConversionSession,
} from '../conversion/conversion';
import { resolveDeferredLink, type MobilePlatform, type ResumePayload, type DeferredLinkResult } from '../conversion/deeplink';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'expired';

/** UTM / referral matching (all admin-configurable). */
export interface UtmMatch { source?: string[]; medium?: string[]; campaign?: string[] }

/** One A/B variant of a campaign (content + optional coupon). */
export interface CampaignVariant {
  key: string;
  weight: number;                 // relative weight for deterministic assignment
  content: ConversionContent;
}

export interface GrowthCampaign extends Auditable {
  siteId: UUID | null;
  name: string;
  status: CampaignStatus;
  priority: number;
  targeting: ConversionTargeting;   // audience/device/country/language/visitor
  utm: UtmMatch;                    // referral source / UTM
  triggerMatch: 'all' | 'any';
  triggers: ConversionTrigger[];    // delay/scroll%/checkout%/cartValue/visitCount/referral
  frequency: ConversionFrequency;   // frequency/cooldown
  timing: ConversionTiming;         // delay
  startsAt: ISODateTime | null;
  expiresAt: ISODateTime | null;    // expiration
  variants: CampaignVariant[];      // 1+ (A/B); each carries CTA/images/videos/coupon
}

export interface CreateGrowthCampaignDto {
  tenantId: UUID;
  siteId?: UUID | null;
  name: string;
  status?: CampaignStatus;
  priority?: number;
  targeting?: ConversionTargeting;
  utm?: UtmMatch;
  triggerMatch?: 'all' | 'any';
  triggers?: ConversionTrigger[];
  frequency?: ConversionFrequency;
  timing?: ConversionTiming;
  startsAt?: ISODateTime | null;
  expiresAt?: ISODateTime | null;
  variants: CampaignVariant[];
}
export interface UpdateGrowthCampaignDto {
  name?: string; status?: CampaignStatus; priority?: number;
  targeting?: ConversionTargeting; utm?: UtmMatch; triggerMatch?: 'all' | 'any';
  triggers?: ConversionTrigger[]; frequency?: ConversionFrequency; timing?: ConversionTiming;
  startsAt?: ISODateTime | null; expiresAt?: ISODateTime | null; variants?: CampaignVariant[];
  expectedVersion?: number;
}

export function validateCreateCampaign(i: CreateGrowthCampaignDto): Result<CreateGrowthCampaignDto> {
  return new Validator()
    .field(i.tenantId, 'tenantId', isUuid, 'uuid')
    .check(isNonEmptyString(i.name), 'name', 'required')
    .check(Array.isArray(i.variants) && i.variants.length > 0, 'variants', 'required')
    .check(!i.variants || i.variants.every(v => isNonEmptyString(v.key) && !!v.content && isNonEmptyString(v.content.title)), 'variants', 'invalid')
    .toResult(i);
}

// ── Runtime ──────────────────────────────────────────────────────────────────────
export interface GrowthRuntime extends ConversionRuntime {
  utm?: { source?: string; medium?: string; campaign?: string };
}

function inList(value: string | undefined, list: string[] | undefined): boolean {
  return !list || list.length === 0 || (value !== undefined && list.includes(value));
}
function matchUtm(utm: UtmMatch, r: GrowthRuntime): boolean {
  return inList(r.utm?.source, utm.source) && inList(r.utm?.medium, utm.medium) && inList(r.utm?.campaign, utm.campaign);
}
function withinSchedule(c: GrowthCampaign, nowIso: ISODateTime): boolean {
  if (c.startsAt && nowIso < c.startsAt) return false;
  if (c.expiresAt && nowIso > c.expiresAt) return false;
  return true;
}
function triggersPass(c: GrowthCampaign, r: GrowthRuntime): boolean {
  if (c.triggers.length === 0) return true;
  return c.triggerMatch === 'any' ? c.triggers.some(t => matchTrigger(t, r)) : c.triggers.every(t => matchTrigger(t, r));
}

/** Deterministically assign a variant for a visitor (weighted; stable per anon+campaign). */
export function assignVariant(campaign: GrowthCampaign, anonId: string): CampaignVariant {
  const total = campaign.variants.reduce((s, v) => s + Math.max(0, v.weight), 0) || campaign.variants.length;
  const bucket = parseInt(contentHash(`${campaign.id}:${anonId}`), 16) % total;
  let acc = 0;
  for (const v of campaign.variants) {
    acc += Math.max(0, v.weight) || 1;
    if (bucket < acc) return v;
  }
  return campaign.variants[0];
}

export interface CampaignMatch {
  campaign: GrowthCampaign;
  variant: CampaignVariant;
  deferred?: DeferredLinkResult;
}

/** Select the highest-priority eligible campaign + assign a variant. Supports many campaigns. */
export function selectCampaign(
  campaigns: ReadonlyArray<GrowthCampaign>,
  runtime: GrowthRuntime,
  session: ConversionSession,
  nowIso: ISODateTime,
  nowMs: number,
  anonId: string,
  platform: MobilePlatform = 'unknown',
  resume?: ResumePayload,
): CampaignMatch | null {
  const eligible = campaigns
    .filter(c => c.status === 'active' && c.deletedAt === null)
    .filter(c => withinSchedule(c, nowIso))
    .filter(c => matchTargeting(c.targeting, runtime))
    .filter(c => matchUtm(c.utm, runtime))
    .filter(c => triggersPass(c, runtime))
    .filter(c => frequencyAllowsFor(c.id, c.frequency, session, nowMs))
    .sort((a, b) => b.priority - a.priority);

  const campaign = eligible[0];
  if (!campaign) return null;
  const variant = assignVariant(campaign, anonId);

  let deferred: DeferredLinkResult | undefined;
  const content = variant.content;
  if (content.appScheme && content.deepLinkPath && content.storeLinks) {
    deferred = resolveDeferredLink({ scheme: content.appScheme, deepPath: content.deepLinkPath, storeLinks: content.storeLinks, platform, resume });
  }
  return { campaign, variant, deferred };
}

// ── Repository + service ────────────────────────────────────────────────────────────
const growthAggregate = defineAggregate<GrowthCampaign, CreateGrowthCampaignDto, UpdateGrowthCampaignDto>({
  table: 'website_growth_campaigns',
  entityName: 'GrowthCampaign',
  defaults: i => ({
    siteId: i.siteId ?? null, status: i.status ?? 'draft', priority: i.priority ?? 0,
    targeting: i.targeting ?? {}, utm: i.utm ?? {}, triggerMatch: i.triggerMatch ?? 'all',
    triggers: i.triggers ?? [], frequency: i.frequency ?? { dismissible: true }, timing: i.timing ?? {},
    startsAt: i.startsAt ?? null, expiresAt: i.expiresAt ?? null,
  }),
});

export class GrowthEngine {
  constructor(private readonly repo: Repository<GrowthCampaign, CreateGrowthCampaignDto, UpdateGrowthCampaignDto>) {}

  async create(input: CreateGrowthCampaignDto): Promise<Result<GrowthCampaign>> {
    const v = validateCreateCampaign(input);
    if (!isOk(v)) return err(v.error);
    return this.repo.create(input);
  }
  update(tenantId: UUID, id: UUID, patch: UpdateGrowthCampaignDto, expectedVersion?: number): Promise<Result<GrowthCampaign>> {
    return this.repo.update(tenantId, id, patch, expectedVersion);
  }
  setStatus(tenantId: UUID, id: UUID, status: CampaignStatus): Promise<Result<GrowthCampaign>> {
    return this.repo.update(tenantId, id, { status });
  }
  remove(tenantId: UUID, id: UUID): Promise<Result<GrowthCampaign>> {
    return this.repo.softDelete(tenantId, id);
  }
  async listActive(tenantId: UUID): Promise<Result<GrowthCampaign[]>> {
    const r = await this.repo.list(tenantId, { pageSize: 200, filters: [{ field: 'status', operator: 'eq', value: 'active' }] });
    return isOk(r) ? ok(r.value.items) : err(r.error);
  }
  async resolve(tenantId: UUID, runtime: GrowthRuntime, session: ConversionSession, nowIso: ISODateTime, nowMs: number, anonId: string, platform: MobilePlatform = 'unknown', resume?: ResumePayload): Promise<Result<CampaignMatch | null>> {
    const list = await this.listActive(tenantId);
    if (!isOk(list)) return err(list.error);
    return ok(selectCampaign(list.value, runtime, session, nowIso, nowMs, anonId, platform, resume));
  }
}

export function createGrowthEngine(backend: RepositoryBackend): GrowthEngine {
  return new GrowthEngine(backend === 'supabase' ? growthAggregate.supabase() : growthAggregate.memory());
}
