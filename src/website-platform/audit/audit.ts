// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Audit trail (Wave 1).
// Records who/when/before/after/correlation/tenant/environment for every mutation.
// Backed by the generic collection (website_audit_log) — memory or Supabase.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, ISODateTime, Result } from '../shared/types';
import { ok } from '../shared/types';
import type { JsonValue } from '../domain/entities';
import type { CollectionRepository, RowFilter } from '../repositories/collection';
import { createCollection } from '../repositories/collection';
import type { RepositoryBackend } from '../repositories/registry';
import type { Environment } from '../flags/flags';

export interface AuditContext {
  tenantId: UUID;
  actorId: UUID | null;
  correlationId: string;
  environment: Environment;
}

export interface AuditInput {
  action: string;                 // e.g. 'website.page.update'
  entityType: string;
  entityId: UUID;
  before: JsonValue | null;
  after: JsonValue | null;
}

export interface AuditEntry extends AuditInput {
  id: UUID;
  tenantId: UUID;
  actorId: UUID | null;
  correlationId: string;
  environment: Environment;
  createdAt: ISODateTime;
}

type AuditRow = AuditEntry & Record<string, unknown>;

export interface AuditRecorder {
  record(ctx: AuditContext, input: AuditInput): Promise<Result<AuditEntry>>;
  query(filter: RowFilter<AuditRow>): Promise<Result<AuditEntry[]>>;
}

export class CollectionAuditRecorder implements AuditRecorder {
  constructor(
    private readonly collection: CollectionRepository<AuditRow>,
    private readonly clock: () => ISODateTime = () => new Date().toISOString(),
    private readonly idgen: () => UUID = () => crypto.randomUUID(),
  ) {}

  async record(ctx: AuditContext, input: AuditInput): Promise<Result<AuditEntry>> {
    const entry: AuditRow = {
      id: this.idgen(),
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      correlationId: ctx.correlationId,
      environment: ctx.environment,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before,
      after: input.after,
      createdAt: this.clock(),
    };
    const r = await this.collection.insert(entry);
    return r.ok ? ok(r.value) : r;
  }

  async query(filter: RowFilter<AuditRow>): Promise<Result<AuditEntry[]>> {
    return this.collection.find(filter);
  }
}

export function createAuditRecorder(backend: RepositoryBackend): AuditRecorder {
  return new CollectionAuditRecorder(createCollection<AuditRow>(backend, 'website_audit_log'));
}
