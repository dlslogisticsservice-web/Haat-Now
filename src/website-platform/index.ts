// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Public module surface (Wave 0).
// The single import point for every future consumer. Establishing the boundary now
// keeps the legacy Website Center and the new platform cleanly separated. This
// module is NOT imported by the running app in Wave 0 (additive foundation only).
// ─────────────────────────────────────────────────────────────────────────────

// Shared kernel
export * from './shared/types';
export * from './shared/errors';
export * from './shared/validation';

// Domain
export * from './domain/enums';
export * from './domain/entities';
export * from './domain/dto';
export * from './domain/aggregates';
export * from './domain/dto-ext';

// Feature flags
export * from './flags/flags';

// Events
export * from './events/events';
export * from './events/bus';

// Repositories
export * from './repositories/repository';
export * from './repositories/memory.repository';
export * from './repositories/memory-config';
export * from './repositories/rows';
export * from './repositories/supabase.repository';
export * from './repositories/mapping';
export * from './repositories/collection';
export * from './repositories/registry';
export * from './repositories/child';

// Persistence engine (Wave 1)
export * from './persistence/unit-of-work';
// Disambiguate: the Wave 1 UnitOfWork (transaction-based) is the canonical one at the
// module surface; the Wave 0 repository.UnitOfWork (run-based) remains internal.
export type { UnitOfWork } from './persistence/unit-of-work';
export * from './audit/audit';
export * from './outbox/outbox';
export * from './snapshot/snapshot';
export * from './storage/storage';
export * from './observability/observability';
export * from './workers/workers';
export * from './services/context';
export * from './services/services';

// Publishing contracts (interfaces only in Wave 0)
export * from './publishing/contracts';

// API contracts (no endpoints in Wave 0)
export * from './api/contracts';

// Compatibility layer
export * from './compat/legacy-adapter';
