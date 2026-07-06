// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Collections Platform (Wave 4, Part 5).
// Reusable, config-driven collections (popular / nearby / top-rated / fast-delivery /
// best-offers / trending / seasonal / city). A collection is a definition + a resolver
// over a pool of items (merchants/products from the ordering port). Tenant-scoped
// (website_collections aggregate). Reuses the search engine's sort/nearby — no dup.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, Result } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import type { Auditable, JsonObject } from '../domain/entities';
import { Validator, isUuid, isNonEmptyString } from '../shared/validation';
import type { Repository } from '../repositories/repository';
import { defineAggregate } from '../repositories/mapping';
import type { RepositoryBackend } from '../repositories/registry';
import { sortItems, nearbyItems, filterItems, type SearchableItem } from '../search/search';

export const COLLECTION_KINDS = ['popular', 'nearby', 'top_rated', 'fast_delivery', 'best_offers', 'trending', 'seasonal', 'city'] as const;
export type CollectionKind = typeof COLLECTION_KINDS[number];

export interface CollectionParams {
  limit?: number;
  city?: string;
  tags?: string[];              // seasonal / curated
  radiusKm?: number;            // nearby
  ids?: string[];               // hand-picked (curated collection)
}

export interface Collection extends Auditable {
  siteId: UUID;
  key: string;
  kind: CollectionKind;
  title: string;
  enabled: boolean;
  position: number;
  params: CollectionParams;
}

export interface CreateCollectionDto {
  tenantId: UUID; siteId: UUID; key: string; kind: CollectionKind; title: string;
  enabled?: boolean; position?: number; params?: CollectionParams;
}
export interface UpdateCollectionDto {
  title?: string; enabled?: boolean; position?: number; params?: CollectionParams; kind?: CollectionKind; expectedVersion?: number;
}

export function validateCreateCollection(i: CreateCollectionDto): Result<CreateCollectionDto> {
  return new Validator()
    .field(i.tenantId, 'tenantId', isUuid, 'uuid')
    .field(i.siteId, 'siteId', isUuid, 'uuid')
    .check(isNonEmptyString(i.key), 'key', 'required')
    .check((COLLECTION_KINDS as readonly string[]).includes(i.kind), 'kind', 'enum')
    .check(isNonEmptyString(i.title), 'title', 'required')
    .toResult(i);
}

export interface CollectionRuntime { lat?: number; lng?: number; city?: string }

/** Resolve a collection's items from a pool. Pure. */
export function resolveCollection(def: Collection, pool: ReadonlyArray<SearchableItem>, runtime: CollectionRuntime = {}): SearchableItem[] {
  const limit = def.params.limit ?? 12;
  let items: SearchableItem[];
  switch (def.kind) {
    case 'popular':
    case 'trending':
      items = sortItems(pool, 'popularity');
      break;
    case 'top_rated':
      items = sortItems(pool, 'rating');
      break;
    case 'fast_delivery':
      items = sortItems(pool, 'delivery_time');
      break;
    case 'best_offers':
      items = sortItems(pool.filter(i => (i.keywords ?? []).some(k => k.toLowerCase().includes('offer'))), 'popularity');
      break;
    case 'nearby':
      items = (runtime.lat !== undefined && runtime.lng !== undefined) ? nearbyItems(pool, runtime.lat, runtime.lng, def.params.radiusKm ?? 10) : sortItems(pool, 'rating');
      break;
    case 'city':
      items = filterItems(pool, { city: def.params.city ?? runtime.city });
      break;
    case 'seasonal':
      items = pool.filter(i => (def.params.tags ?? []).some(t => (i.keywords ?? []).map(k => k.toLowerCase()).includes(t.toLowerCase())));
      break;
    default:
      items = [...pool];
  }
  if (def.params.ids && def.params.ids.length > 0) {
    const set = new Set(def.params.ids);
    items = pool.filter(i => set.has(i.id));
  }
  return items.slice(0, limit);
}

// ── Repository + service ────────────────────────────────────────────────────────────
const collectionAggregate = defineAggregate<Collection, CreateCollectionDto, UpdateCollectionDto>({
  table: 'website_collections', entityName: 'Collection',
  defaults: i => ({ enabled: i.enabled ?? true, position: i.position ?? 0, params: (i.params ?? {}) as unknown as JsonObject as CollectionParams }),
});

export class CollectionsService {
  constructor(private readonly repo: Repository<Collection, CreateCollectionDto, UpdateCollectionDto>) {}
  async create(input: CreateCollectionDto): Promise<Result<Collection>> {
    const v = validateCreateCollection(input);
    if (!isOk(v)) return err(v.error);
    return this.repo.create(input);
  }
  update(tenantId: UUID, id: UUID, patch: UpdateCollectionDto, expectedVersion?: number): Promise<Result<Collection>> {
    return this.repo.update(tenantId, id, patch, expectedVersion);
  }
  remove(tenantId: UUID, id: UUID): Promise<Result<Collection>> { return this.repo.softDelete(tenantId, id); }
  async listEnabled(tenantId: UUID, siteId: UUID): Promise<Result<Collection[]>> {
    const r = await this.repo.list(tenantId, { pageSize: 100, filters: [{ field: 'siteId', operator: 'eq', value: siteId }, { field: 'enabled', operator: 'eq', value: true }], sort: [{ field: 'position', direction: 'asc' }] });
    return isOk(r) ? ok(r.value.items) : err(r.error);
  }
}

export function createCollectionsService(backend: RepositoryBackend): CollectionsService {
  return new CollectionsService(backend === 'supabase' ? collectionAggregate.supabase() : collectionAggregate.memory());
}
