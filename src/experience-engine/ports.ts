// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · ports (STEP 3).
//
// Every external concern the Engine touches arrives through a PORT — an interface an
// adapter satisfies later (Supabase, an edge function, React, a vendor). The Engine core
// stays pure and testable because it depends only on these shapes, never on an
// implementation. Mirrors the ports-and-adapters design of src/guardian/discovery.
//
// INTERFACES ONLY. No adapters, no wiring.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, Environment, ExperienceId, Json, LocaleCode, RoleId, SemVer, TenantId, TextDirection, Timestamp } from './types';
import type { ExperienceContext, ExperienceResolution } from './context';
import type { ExperienceSchema } from './schema';
import type { ExperienceEvent, EventMap } from './events';
import type { AssetMetadata } from './metadata';
import type { TreeNode } from './tree';

/** Remote configuration delivery — signed, versioned, cache-aware (see §5). */
export interface ConfigurationPort {
  load(tenantId: TenantId, channel: ChannelId, env: Environment): Promise<{ config: Json; version: SemVer; fromCache: boolean } | null>;
  /** Verify a signed config bundle's authenticity (HMAC), never trusting an unsigned payload. */
  verifySignature(payload: Json, signature: string): Promise<boolean>;
}

/** Durable persistence of experience schemas + version history. */
export interface StoragePort {
  read(experienceId: ExperienceId, version?: SemVer): Promise<ExperienceSchema | null>;
  write(schema: ExperienceSchema): Promise<{ version: SemVer }>;
  history(experienceId: ExperienceId): Promise<Array<{ version: SemVer; at: Timestamp }>>;
}

/** Draft → published transitions. */
export interface PublishingPort {
  publish(experienceId: ExperienceId, version: SemVer): Promise<{ ok: boolean }>;
  unpublish(experienceId: ExperienceId): Promise<{ ok: boolean }>;
}

/** Emits a resolved experience for a specific channel target (DOM, string, native, voice…). */
export interface RenderingPort<Out = unknown> {
  readonly target: string;
  render(resolution: ExperienceResolution, context: ExperienceContext): Out;
}

export interface AnalyticsPort {
  dispatch(event: ExperienceEvent): void;
}

/** Decides what/when/for-whom from a context (see Rules Engine §10). */
export interface RuleEnginePort {
  evaluate(context: ExperienceContext, candidates: ExperienceId[]): Promise<{ experienceId: ExperienceId | null; appliedRules: string[] }>;
}

export interface ThemePort {
  resolveTokens(themeId: string, direction: TextDirection, dark: boolean): Promise<{ [token: string]: string }>;
}

export interface AssetPort {
  url(assetId: string): Promise<string | null>;
  metadata(assetId: string): Promise<AssetMetadata | null>;
}

/** Generic registry access surface (see registries.ts for the concrete registries). */
export interface RegistryPort<T> {
  register(id: string, value: T): void;
  get(id: string): T | null;
  list(): T[];
  has(id: string): boolean;
}

export interface LocalizationPort {
  translate(key: string, locale: LocaleCode): string;
  direction(locale: LocaleCode): TextDirection;
}

export interface NavigationPort {
  resolve(channel: ChannelId, context: ExperienceContext): Promise<TreeNode | null>;
}

export interface FeatureFlagPort {
  isEnabled(flagKey: string, context: ExperienceContext): Promise<boolean>;
  all(context: ExperienceContext): Promise<{ [key: string]: boolean }>;
}

export interface ExperimentPort {
  assign(experimentId: string, context: ExperienceContext): Promise<{ variant: string }>;
}

export interface TenantPort {
  resolve(host: string): Promise<{ tenantId: TenantId } | null>;
}

export interface PermissionPort {
  can(role: RoleId, permission: string, context: ExperienceContext): Promise<boolean>;
}

/** Pluggable AI provider for the future AI Experience Builder (draft-only, see §12). */
export interface AIProviderPort {
  /** Translate an intent into a schema PATCH proposal — never auto-applied. */
  proposePatch(intent: string, current: ExperienceSchema): Promise<{ patch: Json; rationale: string }>;
}

export interface NotificationPort {
  notify(channel: string, message: string): Promise<void>;
}

export interface LoggingPort {
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Json): void;
}

export interface EventBusPort {
  publish(event: ExperienceEvent): void;
  subscribe<K extends keyof EventMap>(type: K, handler: (e: EventMap[K]) => void): () => void;
}

export interface HealthPort {
  report(): { healthy: boolean; details?: string };
}

/** The full set of ports the Engine is constructed with. All optional at foundation stage. */
export interface EnginePorts {
  configuration?: ConfigurationPort;
  storage?: StoragePort;
  publishing?: PublishingPort;
  analytics?: AnalyticsPort;
  rules?: RuleEnginePort;
  theme?: ThemePort;
  asset?: AssetPort;
  localization?: LocalizationPort;
  navigation?: NavigationPort;
  featureFlags?: FeatureFlagPort;
  experiment?: ExperimentPort;
  tenant?: TenantPort;
  permission?: PermissionPort;
  ai?: AIProviderPort;
  notification?: NotificationPort;
  logging?: LoggingPort;
  events?: EventBusPort;
  health?: HealthPort;
}
