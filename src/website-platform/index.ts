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

// Publishing contracts (interfaces only in Wave 0)
export * from './publishing/contracts';

// API contracts (no endpoints in Wave 0)
export * from './api/contracts';

// Compatibility layer
export * from './compat/legacy-adapter';
