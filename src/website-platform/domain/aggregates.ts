// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Additional aggregate + child entity types (Wave 1).
// Additive to Wave 0 domain/entities.ts (which is frozen). Covers the tables Wave 1
// persists that Wave 0 did not model as entities.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, ISODateTime } from '../shared/types';
import type { Auditable, JsonObject } from './entities';

// ── Full aggregates (version + soft delete) ────────────────────────────────────
export interface WebsiteMediaFolder extends Auditable {
  parentId: UUID | null;
  name: string;
}

export interface WebsiteMediaVariant extends Auditable {
  assetId: UUID;
  variant: string;
  format: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  cdnUrl: string;
}

export interface WebsiteTemplate extends Auditable {
  scope: 'site' | 'page' | 'section';
  name: string;
  category: string | null;
  previewUrl: string | null;
  payload: JsonObject;
  visibility: 'private' | 'tenant' | 'marketplace';
  installs: number;
}

export interface WebsiteCustomCode extends Auditable {
  siteId: UUID;
  scope: 'site_head' | 'site_body' | 'page_head' | 'page_body';
  pageId: UUID | null;
  code: string;
  enabled: boolean;
  requiresFlag: string;
}

// ── Child / append-only / registry entities (no version + soft delete) ──────────
export interface WebsiteThemeTokenRow {
  id: UUID;
  tenantId: UUID;
  themeId: UUID;
  groupKey: string;
  tokenKey: string;
  value: string;
  mode: 'light' | 'dark';
}

export interface WebsiteSettingRow {
  id: UUID;
  tenantId: UUID;
  siteId: UUID;
  key: string;
  value: JsonObject;
}

export interface WebsiteRevisionRow {
  id: UUID;
  tenantId: UUID;
  siteId: UUID;
  entityType: string;
  entityId: UUID;
  snapshot: JsonObject;
  reason: string | null;
  createdBy: UUID | null;
  createdAt: ISODateTime;
}

export interface WebsitePublishHistoryRow {
  id: UUID;
  tenantId: UUID;
  siteId: UUID;
  publishVersion: number;
  snapshot: JsonObject;
  scope: 'full' | 'partial';
  publishedBy: UUID | null;
  publishedAt: ISODateTime;
  idempotencyKey: string | null;
}

export interface WebsiteComponentRow {
  type: string;
  category: 'layout' | 'content' | 'commerce' | 'dynamic' | 'form' | 'advanced';
  name: string;
  icon: string | null;
  schema: JsonObject;
  isDynamic: boolean;
  minPlan: string | null;
  featureFlag: string | null;
  version: number;
}

export interface WebsiteFeatureFlagRow {
  id: UUID;
  tenantId: UUID;
  siteId: UUID | null;
  flag: string;
  state: 'enabled' | 'disabled' | 'beta';
  version: number;
}

export interface WebsiteAssetUsageRow {
  id: UUID;
  tenantId: UUID;
  assetId: UUID;
  blockId: UUID | null;
  pageId: UUID | null;
  fieldPath: string | null;
}

export interface WebsiteFormSubmissionRow {
  id: UUID;
  tenantId: UUID;
  formId: UUID;
  data: JsonObject;
  spamScore: number | null;
  status: string;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: ISODateTime;
}
