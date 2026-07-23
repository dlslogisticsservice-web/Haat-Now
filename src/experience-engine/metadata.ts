// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · metadata models (STEP 5).
//
// Metadata makes everything describable, discoverable and governable. Nothing here is a
// runtime object — these are the descriptors the registries hold, the Studio lists, the AI
// builder composes within, and Guardian audits. Pure data shapes only.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ChannelId, ComponentId, DeviceKind, ExperienceId, LocaleCode, PlatformKind, RoleId, SemVer, Timestamp,
} from './types';

/** Common provenance carried by every metadata record. */
export interface MetadataBase {
  id: string;
  name: string;
  version: SemVer;
  description?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  tags?: string[];
}

export interface ExperienceMetadata extends MetadataBase {
  id: ExperienceId;
  channel: ChannelId;
  supportedPlatforms: PlatformKind[];
  supportedDevices: DeviceKind[];
  supportedRoles: RoleId[];
  requiredPermissions: string[];
  locales: LocaleCode[];
  themes: string[];
  featureFlags: string[];
  publishingStatus: 'draft' | 'review' | 'approved' | 'testing' | 'staging' | 'published' | 'archived';
  dependencies: string[];
}

/** The metadata contract from EXPERIENCE_PLATFORM_PHASE0_5.md §8. */
export interface ComponentMetadata extends MetadataBase {
  id: ComponentId;
  supportedChannels: ChannelId[];
  supportedRoles: RoleId[];
  responsive: boolean;
  rtl: boolean;
  darkMode: boolean;
  accessibility: boolean;
  featureFlagKey?: string;
  abTestable: boolean;
  personalizable: boolean;
  analyticsEvents: string[];
  dependencies: ComponentId[];
  permissions: string[];
  validationRules: ValidationMetadata[];
  previewSupport: boolean;
  publishingConstraints: string[];
}

export interface ChannelMetadata extends MetadataBase {
  id: ChannelId;
  supportedPlatforms: PlatformKind[];
  supportedDevices: DeviceKind[];
  defaultLocale: LocaleCode;
  roles: RoleId[];
}

export interface RendererMetadata extends MetadataBase {
  /** Which channels this renderer can emit for. */
  channels: ChannelId[];
  /** Output target, e.g. 'react-dom' | 'html-string' | 'native' | 'voice' | 'scene'. */
  target: string;
  /** Higher wins when several renderers match the same criteria. Default 0. */
  priority?: number;
  /** Free-form capability tags used for matching, e.g. ['ssr','rtl','streaming']. */
  capabilities?: string[];
}

export interface ThemeMetadata extends MetadataBase {
  channels: ChannelId[];
  supportsDarkMode: boolean;
  supportsRtl: boolean;
  /** Names of the design tokens this theme provides (values live in a theme config, not here). */
  tokenKeys: string[];
}

export interface AssetMetadata extends MetadataBase {
  kind: 'image' | 'video' | 'font' | 'icon' | 'document' | (string & {});
  mimeType: string;
  byteSize?: number;
  locale?: LocaleCode;
}

export interface AnalyticsMetadata extends MetadataBase {
  /** Event key emitted, e.g. 'component.clicked'. */
  event: string;
  /** Declared payload property names (shape only — no values). */
  properties: string[];
}

export interface RuleMetadata extends MetadataBase {
  /** Predicate dimensions this rule reads, e.g. ['country','role','season']. */
  dimensions: string[];
  /** What the rule decides, e.g. 'select-experience' | 'select-variant' | 'toggle-flag'. */
  decides: string;
}

export interface PluginMetadata extends MetadataBase {
  /** Extension points this plugin registers into. */
  contributes: Array<'component' | 'channel' | 'theme' | 'renderer' | 'rule' | 'analytics' | 'asset' | 'lifecycle'>;
  /** Other plugin ids this one requires. */
  requires: string[];
}

export interface ValidationMetadata {
  /** The field path this rule applies to, e.g. 'title' or 'sections[].body'. */
  path: string;
  /** Rule kind, e.g. 'required' | 'maxLength' | 'enum' | 'pattern'. */
  rule: string;
  /** Optional constraint payload (e.g. the max length, the enum values). */
  constraint?: unknown;
  message?: string;
}
