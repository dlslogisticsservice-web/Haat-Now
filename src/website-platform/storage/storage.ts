// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Storage gateway (Wave 1) — integration only, NO UI.
// Wraps Supabase Storage for website media (images, documents, video metadata).
// Paths are tenant-namespaced (tenant isolation) and versioned; returns durable
// public URLs. The asset METADATA lives in website_assets (repository); this gateway
// only moves bytes + resolves URLs.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../../lib/supabase';
import type { UUID, Result } from '../shared/types';
import { ok, err } from '../shared/types';
import { errors } from '../shared/errors';

export const WEBSITE_MEDIA_BUCKET = 'website-media';

export interface StoredObjectRef {
  bucket: string;
  path: string;
  publicUrl: string;
}

export interface UploadInput {
  tenantId: UUID;
  /** Logical asset id (groups an original + its variants under one prefix). */
  assetId: UUID;
  filename: string;
  /** Optional variant discriminator (e.g. 'orig' | 'webp' | 'w320'). */
  variant?: string;
  contentType: string;
  body: Blob | ArrayBuffer | Uint8Array;
  upsert?: boolean;
}

/** Storage abstraction — a memory impl (tests) and a Supabase impl satisfy it. */
export interface StorageGateway {
  /** Deterministic, tenant-namespaced object path. */
  pathFor(tenantId: UUID, assetId: UUID, filename: string, variant?: string): string;
  upload(input: UploadInput): Promise<Result<StoredObjectRef>>;
  publicUrl(path: string): string;
  remove(path: string): Promise<Result<true>>;
}

function objectPath(tenantId: UUID, assetId: UUID, filename: string, variant?: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return variant ? `${tenantId}/${assetId}/${variant}/${safe}` : `${tenantId}/${assetId}/${safe}`;
}

// ── Supabase-backed gateway ──────────────────────────────────────────────────────
interface StorageError { message: string }
interface UploadResponse { error: StorageError | null }
interface UrlResponse { data: { publicUrl: string } }
interface Bucket {
  upload(path: string, body: unknown, opts: { contentType: string; upsert: boolean }): PromiseLike<UploadResponse>;
  getPublicUrl(path: string): UrlResponse;
  remove(paths: string[]): PromiseLike<{ error: StorageError | null }>;
}
function bucket(name: string): Bucket {
  return supabase.storage.from(name) as unknown as Bucket;
}

export class SupabaseStorageGateway implements StorageGateway {
  constructor(private readonly bucketName: string = WEBSITE_MEDIA_BUCKET) {}

  pathFor(tenantId: UUID, assetId: UUID, filename: string, variant?: string): string {
    return objectPath(tenantId, assetId, filename, variant);
  }

  async upload(input: UploadInput): Promise<Result<StoredObjectRef>> {
    const path = this.pathFor(input.tenantId, input.assetId, input.filename, input.variant);
    const { error } = await bucket(this.bucketName).upload(path, input.body, {
      contentType: input.contentType, upsert: input.upsert ?? false,
    });
    if (error) return err(errors.conflict('Storage upload failed', { message: error.message }));
    return ok({ bucket: this.bucketName, path, publicUrl: this.publicUrl(path) });
  }

  publicUrl(path: string): string {
    return bucket(this.bucketName).getPublicUrl(path).data.publicUrl;
  }

  async remove(path: string): Promise<Result<true>> {
    const { error } = await bucket(this.bucketName).remove([path]);
    if (error) return err(errors.unknown('Storage delete failed', { message: error.message }));
    return ok(true);
  }
}

// ── In-memory gateway (tests) ────────────────────────────────────────────────────
export class MemoryStorageGateway implements StorageGateway {
  private readonly objects = new Map<string, { contentType: string }>();
  constructor(private readonly base = 'https://storage.local') {}

  pathFor(tenantId: UUID, assetId: UUID, filename: string, variant?: string): string {
    return objectPath(tenantId, assetId, filename, variant);
  }
  async upload(input: UploadInput): Promise<Result<StoredObjectRef>> {
    const path = this.pathFor(input.tenantId, input.assetId, input.filename, input.variant);
    if (this.objects.has(path) && !input.upsert) return err(errors.conflict('object exists', { path }));
    this.objects.set(path, { contentType: input.contentType });
    return ok({ bucket: WEBSITE_MEDIA_BUCKET, path, publicUrl: this.publicUrl(path) });
  }
  publicUrl(path: string): string {
    return `${this.base}/${WEBSITE_MEDIA_BUCKET}/${path}`;
  }
  async remove(path: string): Promise<Result<true>> {
    this.objects.delete(path);
    return ok(true);
  }
}

export function createStorageGateway(backend: 'supabase' | 'memory'): StorageGateway {
  return backend === 'supabase' ? new SupabaseStorageGateway() : new MemoryStorageGateway();
}
