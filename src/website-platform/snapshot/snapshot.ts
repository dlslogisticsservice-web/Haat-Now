// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Snapshot storage (Wave 1) — PERSISTENCE ONLY (no rendering).
// Stores draft + published snapshots with a deterministic content hash + checksum,
// a monotonic version, and an optional storage reference. Backed by the generic
// collection (website_snapshots).
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, ISODateTime, Result } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import { errors } from '../shared/errors';
import type { JsonValue, JsonObject } from '../domain/entities';
import type { CollectionRepository } from '../repositories/collection';
import { createCollection } from '../repositories/collection';
import type { RepositoryBackend } from '../repositories/registry';

export type SnapshotKind = 'draft' | 'published';

export interface SnapshotRecord {
  id: UUID;
  tenantId: UUID;
  siteId: UUID;
  kind: SnapshotKind;
  version: number;
  hash: string;
  checksum: string;
  storageRef: string | null;
  snapshot: JsonObject;
  createdAt: ISODateTime;
}
type SnapshotRow = SnapshotRecord & Record<string, unknown>;

export interface SaveSnapshotInput {
  tenantId: UUID;
  siteId: UUID;
  kind: SnapshotKind;
  version: number;
  snapshot: JsonObject;
  storageRef?: string | null;
}

// ── Deterministic hashing (no crypto dependency; stable key ordering) ────────────
function stableStringify(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify((value as JsonObject)[k])).join(',') + '}';
}
/** FNV-1a 32-bit hash → 8-hex-char string (deterministic, fast, dependency-free). */
export function contentHash(value: JsonValue): string {
  const str = stableStringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
/** A simple length+hash checksum for integrity verification. */
export function checksum(value: JsonValue): string {
  const str = stableStringify(value);
  return `${str.length.toString(16)}:${contentHash(value)}`;
}

export interface SnapshotStore {
  save(input: SaveSnapshotInput): Promise<Result<SnapshotRecord>>;
  latest(tenantId: UUID, siteId: UUID, kind: SnapshotKind): Promise<Result<SnapshotRecord | null>>;
  getByVersion(tenantId: UUID, siteId: UUID, kind: SnapshotKind, version: number): Promise<Result<SnapshotRecord | null>>;
  verify(record: SnapshotRecord): boolean;
}

export class CollectionSnapshotStore implements SnapshotStore {
  constructor(
    private readonly collection: CollectionRepository<SnapshotRow>,
    private readonly clock: () => ISODateTime = () => new Date().toISOString(),
    private readonly idgen: () => UUID = () => crypto.randomUUID(),
  ) {}

  async save(input: SaveSnapshotInput): Promise<Result<SnapshotRecord>> {
    if (input.version < 0) return err(errors.validation('version must be >= 0'));
    const record: SnapshotRow = {
      id: this.idgen(),
      tenantId: input.tenantId,
      siteId: input.siteId,
      kind: input.kind,
      version: input.version,
      hash: contentHash(input.snapshot),
      checksum: checksum(input.snapshot),
      storageRef: input.storageRef ?? null,
      snapshot: input.snapshot,
      createdAt: this.clock(),
    };
    const r = await this.collection.insert(record);
    return r.ok ? ok(r.value) : r;
  }

  async latest(tenantId: UUID, siteId: UUID, kind: SnapshotKind): Promise<Result<SnapshotRecord | null>> {
    const r = await this.collection.find({ tenantId, siteId, kind });
    if (!isOk(r)) return err(r.error);
    const sorted = [...r.value].sort((a, b) => b.version - a.version);
    return ok(sorted[0] ?? null);
  }

  async getByVersion(tenantId: UUID, siteId: UUID, kind: SnapshotKind, version: number): Promise<Result<SnapshotRecord | null>> {
    const r = await this.collection.findOne({ tenantId, siteId, kind, version });
    return r.ok ? ok(r.value) : r;
  }

  /** Integrity check — recompute the hash and compare. */
  verify(record: SnapshotRecord): boolean {
    return contentHash(record.snapshot) === record.hash && checksum(record.snapshot) === record.checksum;
  }
}

export function createSnapshotStore(backend: RepositoryBackend): SnapshotStore {
  return new CollectionSnapshotStore(createCollection<SnapshotRow>(backend, 'website_snapshots'));
}
