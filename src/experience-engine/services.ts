// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · service contracts (STEP 8).
//
// Public contracts ONLY — no implementations. Each resolver/coordinator is a seam a later
// wave fills, composing ports + registries. Naming and signatures are fixed here so the
// Studio, channels and tests can depend on stable shapes before any logic exists.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ChannelId, Environment, ExperienceId, LocaleCode, RoleId, SemVer, TenantId, TextDirection,
} from './types';
import type { ExperienceContext, ExperienceRequest, ExperienceResolution } from './context';
import type { ExperienceSchema } from './schema';
import type { ExperienceEvent } from './events';
import type { TreeNode } from './tree';

/** Assembles the ExperienceContext from ambient inputs (host, headers, session). */
export interface ContextResolver {
  resolve(input: { host: string; role: RoleId; locale: LocaleCode; env: Environment }): Promise<ExperienceContext>;
}

/** The heart: turn a request into a resolved experience. */
export interface ExperienceResolver {
  resolve(request: ExperienceRequest): Promise<ExperienceResolution>;
}

export interface VersionResolver {
  /** Pick the version to serve for a context (published, or a preview/staging override). */
  pick(experienceId: ExperienceId, context: ExperienceContext, preview?: boolean): Promise<SemVer | null>;
}

export interface ThemeResolver {
  resolve(themeId: string, direction: TextDirection, dark: boolean): Promise<{ [token: string]: string }>;
}

export interface RuleResolver {
  decide(context: ExperienceContext, candidates: ExperienceId[]): Promise<{ experienceId: ExperienceId | null; appliedRules: string[] }>;
}

export interface RendererResolver {
  /** Choose the renderer registered for a channel's target. */
  forChannel(channel: ChannelId): { target: string } | null;
}

export interface LocalizationResolver {
  translate(key: string, locale: LocaleCode): string;
  direction(locale: LocaleCode): TextDirection;
}

export interface TenantResolver {
  fromHost(host: string): Promise<{ tenantId: TenantId } | null>;
}

export interface NavigationResolver {
  resolve(channel: ChannelId, context: ExperienceContext): Promise<TreeNode | null>;
}

export interface PermissionResolver {
  can(role: RoleId, permission: string, context: ExperienceContext): Promise<boolean>;
}

export interface ConfigurationResolver {
  load(tenantId: TenantId, channel: ChannelId, env: Environment): Promise<{ version: SemVer; fromCache: boolean } | null>;
}

export interface AnalyticsDispatcher {
  dispatch(event: ExperienceEvent): void;
}

export interface EventDispatcher {
  emit(event: ExperienceEvent): void;
}

export interface PublishingCoordinator {
  publish(experienceId: ExperienceId, version: SemVer): Promise<{ ok: boolean }>;
}

export interface RollbackCoordinator {
  rollback(experienceId: ExperienceId, toVersion: SemVer): Promise<{ ok: boolean; restored: SemVer | null }>;
}

/** The full service surface the Engine exposes once wired. All optional at foundation stage. */
export interface EngineServices {
  context?: ContextResolver;
  experience?: ExperienceResolver;
  version?: VersionResolver;
  theme?: ThemeResolver;
  rules?: RuleResolver;
  renderer?: RendererResolver;
  localization?: LocalizationResolver;
  tenant?: TenantResolver;
  navigation?: NavigationResolver;
  permission?: PermissionResolver;
  configuration?: ConfigurationResolver;
  analytics?: AnalyticsDispatcher;
  events?: EventDispatcher;
  publishing?: PublishingCoordinator;
  rollback?: RollbackCoordinator;
}

// Keep otherwise-unused schema/ExperienceSchema import meaningful for downstream waves.
export type ResolvedSchema = ExperienceSchema;
