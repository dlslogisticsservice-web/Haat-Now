// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Service context (Wave 1).
// The dependency bundle every service receives. Services use repositories, the
// audit recorder, the event bus, the unit of work, the snapshot store and the
// storage gateway — never the database directly.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID } from '../shared/types';
import type { RepositoryBundle, RepositoryBackend } from '../repositories/registry';
import { createRepositoryBundle } from '../repositories/registry';
import type { ChildRepositoryBundle } from '../repositories/child';
import { createChildBundle } from '../repositories/child';
import type { AuditRecorder } from '../audit/audit';
import { createAuditRecorder } from '../audit/audit';
import type { OutboxBus } from '../outbox/outbox';
import { createOutboxBus } from '../outbox/outbox';
import type { SnapshotStore } from '../snapshot/snapshot';
import { createSnapshotStore } from '../snapshot/snapshot';
import type { StorageGateway } from '../storage/storage';
import { createStorageGateway } from '../storage/storage';
import type { UnitOfWork } from '../persistence/unit-of-work';
import { SagaUnitOfWork } from '../persistence/unit-of-work';
import type { JobQueue } from '../workers/workers';
import { createJobQueue } from '../workers/workers';
import type { Environment } from '../flags/flags';

/** Per-operation caller context (who + correlation). */
export interface OperationContext {
  tenantId: UUID;
  actorId: UUID | null;
  correlationId: string;
}

export interface PlatformContext {
  repos: RepositoryBundle;
  children: ChildRepositoryBundle;
  audit: AuditRecorder;
  events: OutboxBus;
  snapshots: SnapshotStore;
  storage: StorageGateway;
  uow: UnitOfWork;
  jobs: JobQueue;
  environment: Environment;
  clock: () => string;
  idgen: () => UUID;
}

export interface PlatformContextOptions {
  backend: RepositoryBackend;
  environment?: Environment;
  clock?: () => string;
  idgen?: () => UUID;
}

/** Wire a full platform context for the chosen backend. */
export function createPlatformContext(opts: PlatformContextOptions): PlatformContext {
  const backend = opts.backend;
  return {
    repos: createRepositoryBundle(backend),
    children: createChildBundle(backend),
    audit: createAuditRecorder(backend),
    events: createOutboxBus(backend),
    snapshots: createSnapshotStore(backend),
    storage: createStorageGateway(backend),
    uow: new SagaUnitOfWork(),
    jobs: createJobQueue(backend),
    environment: opts.environment ?? 'sandbox',
    clock: opts.clock ?? (() => new Date().toISOString()),
    idgen: opts.idgen ?? (() => crypto.randomUUID()),
  };
}
