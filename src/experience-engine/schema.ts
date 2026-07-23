// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · Experience Schema hierarchy (STEP 7).
//
// Inheritance only — no logic. Every channel schema EXTENDS BaseExperienceSchema, sharing
// its fields + validators and adding channel-specific structure. This replaces the
// website-only schema with a channel-neutral base (see EXPERIENCE_PLATFORM_PHASE0_5.md §9).
//
// Forward-compat rule (inherited from website.service): unknown fields from newer schema
// versions are preserved, never dropped — modelled by the `ext` bag on the base.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, ExperienceId, Json, LocaleCode, SemVer, TenantId } from './types';
import type { TreeNode } from './tree';
import type { ValidationMetadata } from './metadata';

/** The root every experience schema inherits. */
export interface BaseExperienceSchema {
  id: ExperienceId;
  channel: ChannelId;
  tenantId?: TenantId;
  schemaVersion: SemVer;
  /** The experience's node tree (layout + components). */
  layout: TreeNode;
  /** Theme reference (the resolved token set lives in a theme config, not here). */
  theme?: string;
  locales: LocaleCode[];
  defaultLocale: LocaleCode;
  /** Declarative validation rules applied before publish. */
  validation?: ValidationMetadata[];
  meta?: { title?: string; description?: string };
  /** Unknown fields from newer versions — preserved, never dropped (forward compatibility). */
  ext?: { [key: string]: Json };
}

// ── Channel schemas — each EXTENDS the base and adds channel structure ─────────
export interface WebsiteSchema extends BaseExperienceSchema {
  channel: 'website';
  pages: Array<{ path: string; title: string; layout: TreeNode; seo?: { title?: string; description?: string } }>;
  nav?: Array<{ label: string; href: string; order?: number }>;
  blog?: { enabled: boolean };
}

export interface CustomerSchema extends BaseExperienceSchema {
  channel: 'customer';
  screens: Array<{ key: string; title: string; layout: TreeNode }>;
  tabs?: Array<{ key: string; label: string; order?: number }>;
  deeplinks?: string[];
}

export interface DriverSchema extends BaseExperienceSchema {
  channel: 'driver';
  shiftScreens: Array<{ key: string; layout: TreeNode }>;
  mapLayers?: string[];
}

export interface MerchantSchema extends BaseExperienceSchema {
  channel: 'merchant';
  dashboards: Array<{ key: string; layout: TreeNode }>;
  kitchenDisplay?: { enabled: boolean };
}

export interface AffiliateSchema extends BaseExperienceSchema {
  channel: 'affiliate';
  referral: { layout: TreeNode };
  payouts?: { layout: TreeNode };
}

export interface PartnerSchema extends BaseExperienceSchema {
  channel: 'partner';
  onboarding: { layout: TreeNode };
  applications?: { layout: TreeNode };
}

export interface AdminSchema extends BaseExperienceSchema {
  channel: 'admin';
  workspaces: Array<{ key: string; layout: TreeNode }>;
  consoles?: string[];
}

/** Any concrete channel schema. */
export type ExperienceSchema =
  | WebsiteSchema | CustomerSchema | DriverSchema | MerchantSchema
  | AffiliateSchema | PartnerSchema | AdminSchema;
