// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Aggregate DTOs + validators (Wave 1).
// Create/Update shapes for every persisted aggregate, plus a DRY validator
// (`requireFields`) so 15 aggregates share one validation implementation
// (no duplicate logic). Field names match entity/column camelCase so the generic
// mapper (repositories/mapping.ts) writes rows directly.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, Result, WebsitePlatformError } from '../shared/types';
import { Validator, isUuid, isNonEmptyString } from '../shared/validation';
import type { JsonObject, DeviceVisibility } from './entities';
import type {
  RedirectCode, RedirectMatchType, DomainKind, DomainStatus, AssetKind, SectionScope,
} from './enums';

// ── DRY validator ────────────────────────────────────────────────────────────
export interface FieldSpec<T> {
  uuids?: ReadonlyArray<keyof T>;
  nonEmpty?: ReadonlyArray<keyof T>;
}
export function requireFields<T>(input: T, spec: FieldSpec<T>): Result<T, WebsitePlatformError> {
  const rec = input as unknown as Record<string, unknown>;
  const v = new Validator();
  for (const f of spec.uuids ?? []) v.field(rec[String(f)], String(f), isUuid, 'uuid');
  for (const f of spec.nonEmpty ?? []) v.check(isNonEmptyString(rec[String(f)]), String(f), 'required');
  return v.toResult(input);
}

// ── Section ────────────────────────────────────────────────────────────────────
export interface UpdateSectionDto { name?: string | null; position?: number; settings?: JsonObject; visibility?: DeviceVisibility; scope?: SectionScope; key?: string | null; expectedVersion?: number }

// ── Menu / Navigation ───────────────────────────────────────────────────────────
export interface CreateMenuDto { tenantId: UUID; siteId: UUID; key: string; name: string }
export interface UpdateMenuDto { name?: string; key?: string; expectedVersion?: number }
export interface CreateNavItemDto { tenantId: UUID; siteId: UUID; menuId: UUID; label: string; parentId?: UUID | null; pageId?: UUID | null; externalUrl?: string | null; position?: number; visibility?: DeviceVisibility }
export interface UpdateNavItemDto { label?: string; parentId?: UUID | null; pageId?: UUID | null; externalUrl?: string | null; position?: number; visibility?: DeviceVisibility; expectedVersion?: number }

// ── Theme ────────────────────────────────────────────────────────────────────────
export interface CreateThemeDto { tenantId: UUID; siteId?: UUID | null; name: string; basePreset?: string | null; mode?: 'light' | 'dark' | 'both'; isActive?: boolean }
export interface UpdateThemeDto { name?: string; basePreset?: string | null; mode?: 'light' | 'dark' | 'both'; isActive?: boolean; expectedVersion?: number }

// ── Media (assets / folders / variants) ─────────────────────────────────────────
export interface CreateAssetDto { tenantId: UUID; folderId?: UUID | null; kind: AssetKind; storageBucket: string; storagePath: string; originalFilename?: string | null; altText?: string | null; title?: string | null; width?: number | null; height?: number | null; bytes?: number | null; checksum?: string | null }
export interface UpdateAssetDto { altText?: string | null; title?: string | null; folderId?: UUID | null; expectedVersion?: number }
export interface CreateMediaFolderDto { tenantId: UUID; parentId?: UUID | null; name: string }
export interface UpdateMediaFolderDto { name?: string; parentId?: UUID | null; expectedVersion?: number }
export interface CreateMediaVariantDto { tenantId: UUID; assetId: UUID; variant: string; cdnUrl: string; format?: string | null; width?: number | null; height?: number | null; bytes?: number | null }
export interface UpdateMediaVariantDto { cdnUrl?: string; format?: string | null; expectedVersion?: number }

// ── SEO ──────────────────────────────────────────────────────────────────────────
export interface CreateSeoDto { tenantId: UUID; pageId: UUID; locale?: string; metaTitle?: string | null; metaDescription?: string | null; keywords?: string[]; canonical?: string | null; robots?: string }
export interface UpdateSeoDto { metaTitle?: string | null; metaDescription?: string | null; keywords?: string[]; canonical?: string | null; robots?: string; score?: number | null; og?: JsonObject | null; twitter?: JsonObject | null; expectedVersion?: number }

// ── Translation ───────────────────────────────────────────────────────────────────
export interface CreateTranslationDto { tenantId: UUID; siteId: UUID; entityType: string; entityId: UUID; locale: string; fieldPath: string; value: string; sourceHash?: string | null }
export interface UpdateTranslationDto { value?: string; status?: 'draft' | 'translated' | 'reviewed' | 'stale'; sourceHash?: string | null; expectedVersion?: number }

// ── Template ─────────────────────────────────────────────────────────────────────
export interface CreateTemplateDto { tenantId?: UUID | null; scope: 'site' | 'page' | 'section'; name: string; payload: JsonObject; category?: string | null; previewUrl?: string | null; visibility?: 'private' | 'tenant' | 'marketplace' }
export interface UpdateTemplateDto { name?: string; category?: string | null; previewUrl?: string | null; visibility?: 'private' | 'tenant' | 'marketplace'; payload?: JsonObject; expectedVersion?: number }

// ── Form ─────────────────────────────────────────────────────────────────────────
export interface CreateFormDto { tenantId: UUID; siteId: UUID; key: string; name: string; kind?: string; schema?: unknown[]; spamProtection?: 'none' | 'honeypot' | 'turnstile' | 'recaptcha'; webhookUrl?: string | null; notifyEmails?: string[] }
export interface UpdateFormDto { name?: string; schema?: unknown[]; spamProtection?: 'none' | 'honeypot' | 'turnstile' | 'recaptcha'; webhookUrl?: string | null; notifyEmails?: string[]; expectedVersion?: number }

// ── Redirect ─────────────────────────────────────────────────────────────────────
export interface CreateRedirectDto { tenantId: UUID; siteId: UUID; sourcePath: string; targetPath: string; code?: RedirectCode; matchType?: RedirectMatchType }
export interface UpdateRedirectDto { targetPath?: string; code?: RedirectCode; matchType?: RedirectMatchType; expectedVersion?: number }

// ── Domain ───────────────────────────────────────────────────────────────────────
export interface CreateDomainDto { tenantId: UUID; siteId: UUID; host: string; kind: DomainKind; isPrimary?: boolean; status?: DomainStatus }
export interface UpdateDomainDto { status?: DomainStatus; isPrimary?: boolean; verifyToken?: string | null; dnsRecords?: JsonObject | null; sslExpiresAt?: string | null; expectedVersion?: number }

// ── Custom code ────────────────────────────────────────────────────────────────────
export interface CreateCustomCodeDto { tenantId: UUID; siteId: UUID; scope: 'site_head' | 'site_body' | 'page_head' | 'page_body'; code: string; pageId?: UUID | null; enabled?: boolean }
export interface UpdateCustomCodeDto { code?: string; enabled?: boolean; expectedVersion?: number }

// ── Validators (thin wrappers over the DRY helper — no duplicated logic) ──────────
export const validateCreateMenu = (i: CreateMenuDto) => requireFields(i, { uuids: ['tenantId', 'siteId'], nonEmpty: ['key', 'name'] });
export const validateCreateNavItem = (i: CreateNavItemDto) => requireFields(i, { uuids: ['tenantId', 'siteId', 'menuId'], nonEmpty: ['label'] });
export const validateCreateTheme = (i: CreateThemeDto) => requireFields(i, { uuids: ['tenantId'], nonEmpty: ['name'] });
export const validateCreateAsset = (i: CreateAssetDto) => requireFields(i, { uuids: ['tenantId'], nonEmpty: ['kind', 'storageBucket', 'storagePath'] });
export const validateCreateSeo = (i: CreateSeoDto) => requireFields(i, { uuids: ['tenantId', 'pageId'] });
export const validateCreateTranslation = (i: CreateTranslationDto) => requireFields(i, { uuids: ['tenantId', 'siteId', 'entityId'], nonEmpty: ['entityType', 'locale', 'fieldPath', 'value'] });
export const validateCreateForm = (i: CreateFormDto) => requireFields(i, { uuids: ['tenantId', 'siteId'], nonEmpty: ['key', 'name'] });
export const validateCreateRedirect = (i: CreateRedirectDto) => requireFields(i, { uuids: ['tenantId', 'siteId'], nonEmpty: ['sourcePath', 'targetPath'] });
export const validateCreateDomain = (i: CreateDomainDto) => requireFields(i, { uuids: ['tenantId', 'siteId'], nonEmpty: ['host', 'kind'] });
export const validateCreateTemplate = (i: CreateTemplateDto) => requireFields(i, { nonEmpty: ['scope', 'name'] });
export const validateCreateCustomCode = (i: CreateCustomCodeDto) => requireFields(i, { uuids: ['tenantId', 'siteId'], nonEmpty: ['scope', 'code'] });
