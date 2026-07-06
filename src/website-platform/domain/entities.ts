// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Domain entities (Wave 0).
// The in-application shape of each website_* aggregate. These are the canonical
// types repositories return and services operate on. Row ↔ entity mapping lives
// in the repository layer (repositories/mappers.ts).
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, ISODateTime } from '../shared/types';
import type {
  SiteStatus, PageStatus, RouteType, SectionScope, DomainKind, DomainStatus,
  AssetKind, RedirectCode, RedirectMatchType, PublishScope, FlagState,
  TranslationStatus, FormKind, ComponentCategory,
} from './enums';

/** Fields shared by every persisted aggregate. */
export interface Auditable {
  id: UUID;
  tenantId: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Optimistic-lock version; incremented on every update. */
  version: number;
  /** Soft-delete marker (null = live). */
  deletedAt: ISODateTime | null;
}

/** Per-device visibility toggles carried by sections/blocks. */
export interface DeviceVisibility {
  desktop?: boolean;
  tablet?: boolean;
  mobile?: boolean;
}

export interface WebsiteSite extends Auditable {
  siteId: UUID; // alias of id for readability in child relations
  slug: string;
  name: string;
  status: SiteStatus;
  defaultLocale: string;
  locales: string[];
  primaryDomainId: UUID | null;
  activeThemeId: UUID | null;
  maintenance: boolean;
  publishedVersion: number;
  settings: JsonObject;
}

export interface WebsitePage extends Auditable {
  siteId: UUID;
  parentId: UUID | null;
  slug: string;
  title: string;
  routeType: RouteType;
  dataSource: JsonObject | null;
  status: PageStatus;
  publishAt: ISODateTime | null;
  position: number;
  inNav: boolean;
  locale: string;
}

export interface WebsiteSection extends Auditable {
  siteId: UUID;
  pageId: UUID | null;
  scope: SectionScope;
  key: string | null;
  name: string | null;
  position: number;
  settings: JsonObject;
  visibility: DeviceVisibility;
}

export interface WebsiteBlock extends Auditable {
  siteId: UUID;
  sectionId: UUID;
  type: string;
  props: JsonObject;
  position: number;
  visibility: DeviceVisibility;
  enabled: boolean;
}

export interface WebsiteMenu extends Auditable {
  siteId: UUID;
  key: string;
  name: string;
}

export interface WebsiteNavItem extends Auditable {
  siteId: UUID;
  menuId: UUID;
  parentId: UUID | null;
  label: string;
  pageId: UUID | null;
  externalUrl: string | null;
  position: number;
  visibility: DeviceVisibility;
}

export interface WebsiteSeo extends Auditable {
  pageId: UUID;
  locale: string;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string[];
  canonical: string | null;
  robots: string;
  og: JsonObject | null;
  twitter: JsonObject | null;
  jsonLd: JsonObject[];
  score: number | null;
}

export interface WebsiteRedirect extends Auditable {
  siteId: UUID;
  sourcePath: string;
  targetPath: string;
  code: RedirectCode;
  matchType: RedirectMatchType;
  hits: number;
}

export interface WebsiteDomain extends Auditable {
  siteId: UUID;
  host: string;
  kind: DomainKind;
  isPrimary: boolean;
  status: DomainStatus;
  verifyToken: string | null;
  dnsRecords: JsonObject | null;
  sslExpiresAt: ISODateTime | null;
}

export interface WebsiteAsset extends Auditable {
  folderId: UUID | null;
  kind: AssetKind;
  originalFilename: string | null;
  altText: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  checksum: string | null;
  storageBucket: string;
  storagePath: string;
}

export interface WebsiteTranslation extends Auditable {
  siteId: UUID;
  entityType: string;
  entityId: UUID;
  locale: string;
  fieldPath: string;
  value: string;
  sourceHash: string | null;
  status: TranslationStatus;
}

export interface WebsiteForm extends Auditable {
  siteId: UUID;
  key: string;
  name: string;
  kind: FormKind;
  schema: JsonArray;
  spamProtection: 'none' | 'honeypot' | 'turnstile' | 'recaptcha';
  webhookUrl: string | null;
  notifyEmails: string[];
}

export interface WebsiteThemeToken {
  groupKey: string;
  tokenKey: string;
  value: string;
  mode: 'light' | 'dark';
}

export interface WebsiteTheme extends Auditable {
  siteId: UUID | null;
  name: string;
  basePreset: string | null;
  isActive: boolean;
  mode: 'light' | 'dark' | 'both';
  tokens: WebsiteThemeToken[];
}

export interface WebsitePublishRecord extends Auditable {
  siteId: UUID;
  publishVersion: number;
  snapshot: JsonObject;
  scope: PublishScope;
  publishedBy: UUID | null;
  publishedAt: ISODateTime;
  idempotencyKey: string | null;
}

export interface WebsiteComponentDef {
  type: string;
  category: ComponentCategory;
  name: string;
  icon: string | null;
  schema: JsonObject;
  isDynamic: boolean;
  minPlan: string | null;
  featureFlag: string | null;
  version: number;
}

export interface WebsiteFeatureFlagRecord extends Auditable {
  siteId: UUID | null;
  flag: string;
  state: FlagState;
}

// ── JSON value types (structural; avoids `any` for jsonb columns) ──────────────
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue }
export type JsonArray = JsonValue[];
