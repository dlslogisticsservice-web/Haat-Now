// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Homepage Builder (Wave 4, Part 2).
// Homepage sections are fully configurable from Website Center: show/hide, reorder,
// schedule, personalize, and feature-flag each section. Tenant-scoped
// (website_homepage_sections aggregate). Reuses the Wave 3 targeting matcher for
// personalization — no duplicate logic. Reusable by every tenant.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, ISODateTime, Result } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import type { Auditable, JsonObject } from '../domain/entities';
import { Validator, isUuid, isNonEmptyString } from '../shared/validation';
import type { Repository } from '../repositories/repository';
import { defineAggregate } from '../repositories/mapping';
import type { RepositoryBackend } from '../repositories/registry';
import { matchTargeting, type ConversionTargeting, type ConversionRuntime } from '../conversion/conversion';

export const HOMEPAGE_SECTION_TYPES = ['hero', 'collections', 'promo_banners', 'categories', 'offers', 'app_cta', 'stats', 'testimonials', 'custom'] as const;
export type HomepageSectionType = typeof HOMEPAGE_SECTION_TYPES[number];

export interface SectionSchedule { startsAt?: ISODateTime | null; endsAt?: ISODateTime | null }

export interface HomepageSection extends Auditable {
  siteId: UUID;
  key: string;                        // stable admin key
  type: HomepageSectionType;
  title: string | null;
  enabled: boolean;                   // show / hide
  position: number;                   // reorder
  schedule: SectionSchedule;          // scheduling
  personalization: ConversionTargeting; // audience/country/language/device/visitor
  featureFlag: string | null;         // gate behind a flag
  config: JsonObject;                 // section-specific (which collection, banner set, …)
}

export interface CreateHomepageSectionDto {
  tenantId: UUID; siteId: UUID; key: string; type: HomepageSectionType;
  title?: string | null; enabled?: boolean; position?: number;
  schedule?: SectionSchedule; personalization?: ConversionTargeting; featureFlag?: string | null; config?: JsonObject;
}
export interface UpdateHomepageSectionDto {
  title?: string | null; enabled?: boolean; position?: number;
  schedule?: SectionSchedule; personalization?: ConversionTargeting; featureFlag?: string | null; config?: JsonObject; type?: HomepageSectionType;
  expectedVersion?: number;
}

export function validateCreateHomepageSection(i: CreateHomepageSectionDto): Result<CreateHomepageSectionDto> {
  return new Validator()
    .field(i.tenantId, 'tenantId', isUuid, 'uuid')
    .field(i.siteId, 'siteId', isUuid, 'uuid')
    .check(isNonEmptyString(i.key), 'key', 'required')
    .check((HOMEPAGE_SECTION_TYPES as readonly string[]).includes(i.type), 'type', 'enum')
    .toResult(i);
}

/** Runtime context for personalization + scheduling. */
export interface HomepageRuntime extends ConversionRuntime {
  flags?: Readonly<Record<string, boolean>>;
}

function scheduleActive(s: SectionSchedule, nowIso: ISODateTime): boolean {
  if (s.startsAt && nowIso < s.startsAt) return false;
  if (s.endsAt && nowIso > s.endsAt) return false;
  return true;
}
function flagOn(flag: string | null, flags: Readonly<Record<string, boolean>> | undefined): boolean {
  return !flag || !!flags?.[flag];
}

/** Resolve the ordered, visible homepage for a runtime (the render-time entry point). */
export function resolveHomepage(sections: ReadonlyArray<HomepageSection>, runtime: HomepageRuntime, nowIso: ISODateTime): HomepageSection[] {
  return sections
    .filter(s => s.enabled && s.deletedAt === null)
    .filter(s => scheduleActive(s.schedule, nowIso))
    .filter(s => matchTargeting(s.personalization, runtime))
    .filter(s => flagOn(s.featureFlag, runtime.flags))
    .sort((a, b) => a.position - b.position);
}

// ── Repository + service ────────────────────────────────────────────────────────────
const homepageAggregate = defineAggregate<HomepageSection, CreateHomepageSectionDto, UpdateHomepageSectionDto>({
  table: 'website_homepage_sections', entityName: 'HomepageSection',
  defaults: i => ({
    title: i.title ?? null, enabled: i.enabled ?? true, position: i.position ?? 0,
    schedule: i.schedule ?? {}, personalization: i.personalization ?? {}, featureFlag: i.featureFlag ?? null, config: i.config ?? {},
  }),
});

export class HomepageService {
  constructor(private readonly repo: Repository<HomepageSection, CreateHomepageSectionDto, UpdateHomepageSectionDto>) {}

  async create(input: CreateHomepageSectionDto): Promise<Result<HomepageSection>> {
    const v = validateCreateHomepageSection(input);
    if (!isOk(v)) return err(v.error);
    return this.repo.create(input);
  }
  update(tenantId: UUID, id: UUID, patch: UpdateHomepageSectionDto, expectedVersion?: number): Promise<Result<HomepageSection>> {
    return this.repo.update(tenantId, id, patch, expectedVersion);
  }
  show(tenantId: UUID, id: UUID): Promise<Result<HomepageSection>> { return this.repo.update(tenantId, id, { enabled: true }); }
  hide(tenantId: UUID, id: UUID): Promise<Result<HomepageSection>> { return this.repo.update(tenantId, id, { enabled: false }); }
  remove(tenantId: UUID, id: UUID): Promise<Result<HomepageSection>> { return this.repo.softDelete(tenantId, id); }

  async list(tenantId: UUID, siteId: UUID): Promise<Result<HomepageSection[]>> {
    const r = await this.repo.list(tenantId, { pageSize: 100, filters: [{ field: 'siteId', operator: 'eq', value: siteId }], sort: [{ field: 'position', direction: 'asc' }] });
    return isOk(r) ? ok(r.value.items) : err(r.error);
  }
  /** Reorder sections atomically (positions = array index). */
  async reorder(tenantId: UUID, orderedIds: ReadonlyArray<UUID>): Promise<Result<number>> {
    let n = 0;
    for (let i = 0; i < orderedIds.length; i++) {
      const r = await this.repo.update(tenantId, orderedIds[i], { position: i });
      if (!isOk(r)) return err(r.error);
      n++;
    }
    return ok(n);
  }
  async resolve(tenantId: UUID, siteId: UUID, runtime: HomepageRuntime, nowIso: ISODateTime): Promise<Result<HomepageSection[]>> {
    const list = await this.list(tenantId, siteId);
    if (!isOk(list)) return err(list.error);
    return ok(resolveHomepage(list.value, runtime, nowIso));
  }
}

export function createHomepageService(backend: RepositoryBackend): HomepageService {
  return new HomepageService(backend === 'supabase' ? homepageAggregate.supabase() : homepageAggregate.memory());
}
