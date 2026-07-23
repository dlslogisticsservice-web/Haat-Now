// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · typed event model (STEP 9).
//
// Contracts only — NO runtime wiring, no bus implementation. Everything the Engine does
// will emit one of these; Analytics, Personalization, Experiments and Guardian subscribe.
// The EventBusPort (ports.ts) transports them. Defined as a discriminated union keyed by
// `type`, plus an EventMap for type-safe per-event subscription.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, ComponentId, ExperienceId, SemVer, TenantId, Timestamp } from './types';

export interface ExperienceEventBase {
  type: ExperienceEventType;
  at: Timestamp;
  tenantId?: TenantId;
  channel?: ChannelId;
}

export type ExperienceEventType =
  | 'experience.created' | 'experience.updated' | 'experience.published' | 'experience.archived'
  | 'experience.viewed' | 'experience.resolved'
  | 'component.rendered' | 'component.clicked'
  | 'rule.triggered' | 'theme.applied' | 'feature.enabled'
  | 'experiment.started' | 'configuration.loaded' | 'tenant.resolved';

export interface ExperienceLifecycleEvent extends ExperienceEventBase {
  type: 'experience.created' | 'experience.updated' | 'experience.published' | 'experience.archived';
  experienceId: ExperienceId;
  version?: SemVer;
}
export interface ExperienceViewedEvent extends ExperienceEventBase { type: 'experience.viewed'; experienceId: ExperienceId }
export interface ExperienceResolvedEvent extends ExperienceEventBase { type: 'experience.resolved'; experienceId: ExperienceId; version: SemVer }
export interface ComponentRenderedEvent extends ExperienceEventBase { type: 'component.rendered'; componentId: ComponentId; nodeId: string }
export interface ComponentClickedEvent extends ExperienceEventBase { type: 'component.clicked'; componentId: ComponentId; nodeId: string }
export interface RuleTriggeredEvent extends ExperienceEventBase { type: 'rule.triggered'; ruleId: string; decision: string }
export interface ThemeAppliedEvent extends ExperienceEventBase { type: 'theme.applied'; themeId: string }
export interface FeatureEnabledEvent extends ExperienceEventBase { type: 'feature.enabled'; flagKey: string }
export interface ExperimentStartedEvent extends ExperienceEventBase { type: 'experiment.started'; experimentId: string; variant: string }
export interface ConfigurationLoadedEvent extends ExperienceEventBase { type: 'configuration.loaded'; version: SemVer; fromCache: boolean }
export interface TenantResolvedEvent extends ExperienceEventBase { type: 'tenant.resolved'; tenantId: TenantId }

/** Every event the Engine may emit. */
export type ExperienceEvent =
  | ExperienceLifecycleEvent | ExperienceViewedEvent | ExperienceResolvedEvent
  | ComponentRenderedEvent | ComponentClickedEvent | RuleTriggeredEvent | ThemeAppliedEvent
  | FeatureEnabledEvent | ExperimentStartedEvent | ConfigurationLoadedEvent | TenantResolvedEvent;

/** Map from event type → its concrete event shape, for type-safe subscription. */
export interface EventMap {
  'experience.created': ExperienceLifecycleEvent;
  'experience.updated': ExperienceLifecycleEvent;
  'experience.published': ExperienceLifecycleEvent;
  'experience.archived': ExperienceLifecycleEvent;
  'experience.viewed': ExperienceViewedEvent;
  'experience.resolved': ExperienceResolvedEvent;
  'component.rendered': ComponentRenderedEvent;
  'component.clicked': ComponentClickedEvent;
  'rule.triggered': RuleTriggeredEvent;
  'theme.applied': ThemeAppliedEvent;
  'feature.enabled': FeatureEnabledEvent;
  'experiment.started': ExperimentStartedEvent;
  'configuration.loaded': ConfigurationLoadedEvent;
  'tenant.resolved': TenantResolvedEvent;
}
