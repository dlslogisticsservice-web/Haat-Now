// ─────────────────────────────────────────────────────────────────────────────
// Guardian · public surface.
//
// The ONLY import path for future modules:  import { Guardian, type GuardianModule } from '@/guardian';
// Nothing outside the kernel may deep-import kernel internals — that keeps the
// kernel replaceable and the module contract stable.
//
// PHASE 1 = KERNEL ONLY. No UI, no dashboards, no QA, no monitoring, no release
// center, no AI provider. Those all arrive later as modules via Guardian.use(...).
// ─────────────────────────────────────────────────────────────────────────────

// Kernel + extension SDK
export { Guardian } from './kernel/kernel';
export type { GuardianContext, GuardianOptions, KernelPhase } from './kernel/kernel';
export type { GuardianModule, ModuleRecord, ModuleState } from './kernel/registry';
export { ModuleRegistry } from './kernel/registry';

// Core types + ports (hosts inject adapters; tests inject fakes)
export type {
  Result, Ok, Err, Id, ISODateTime, Severity, HealthStatus,
  Clock, IdGenerator, Logger, Hasher, Scheduler, KernelPorts,
} from './kernel/types';
export {
  ok, err, isOk, isErr, SEVERITY_ORDER, severityRank, maxSeverity, worstStatus,
  systemClock, counterIds, silentLogger, djb2Hasher, manualScheduler,
} from './kernel/types';

// Event bus
export { EventBus } from './kernel/events';
export type { GuardianEvent, GuardianEventMap, EventType, Handler, AnyHandler, Middleware, Unsubscribe } from './kernel/events';

// Configuration
export { ConfigStore } from './kernel/config';
export type { ConfigBag, ConfigSource, ConfigValue } from './kernel/config';

// Audit
export { AuditLog } from './kernel/audit';
export type { AuditEntry, AuditSink, AppendInput } from './kernel/audit';

// Permissions
export { PermissionRegistry, applyKernelPolicy, GUARDIAN_ROLES, KERNEL_PERMISSIONS } from './kernel/permissions';
export type { GuardianRole, GuardianPrincipal, PermissionDef } from './kernel/permissions';

// Health engine
export { HealthEngine } from './kernel/health';
export type { HealthCheckDef, HealthReport, CheckState, Incident, IncidentStatus } from './kernel/health';

// Knowledge engine
export { KnowledgeEngine, KNOWLEDGE_FACETS } from './kernel/knowledge';
export type { KnowledgeFacet, KnowledgeFact, FactInput, KnowledgeSource, KnowledgeQuery, ContextBundle } from './kernel/knowledge';

// AI abstraction (interfaces only — no provider)
export { AiRegistry } from './kernel/ai';
export type { AiProvider, AiRequest, AiResponse, AiMessage, AiUsage, AiCapability, AiRoutingRule } from './kernel/ai';

// Jobs
export { JobScheduler } from './kernel/jobs';
export type { JobDef, JobRecord, JobState } from './kernel/jobs';
