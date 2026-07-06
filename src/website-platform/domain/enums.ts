// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Domain enums (Wave 0).
// Canonical string unions mirrored by the website_* table CHECK constraints
// (see supabase/migrations/20260705000100_website_platform_foundation.sql).
// ─────────────────────────────────────────────────────────────────────────────

export const SITE_STATUSES = ['draft', 'published', 'suspended', 'archived'] as const;
export type SiteStatus = typeof SITE_STATUSES[number];

export const PAGE_STATUSES = ['draft', 'published', 'scheduled', 'unpublished'] as const;
export type PageStatus = typeof PAGE_STATUSES[number];

export const ROUTE_TYPES = ['static', 'dynamic', 'system'] as const;
export type RouteType = typeof ROUTE_TYPES[number];

export const SECTION_SCOPES = ['local', 'global'] as const;
export type SectionScope = typeof SECTION_SCOPES[number];

export const MENU_KEYS = ['header', 'footer', 'mobile', 'legal'] as const;
export type MenuKey = typeof MENU_KEYS[number] | string;

export const DOMAIN_KINDS = ['subdomain', 'custom'] as const;
export type DomainKind = typeof DOMAIN_KINDS[number];

export const DOMAIN_STATUSES = ['pending', 'verifying', 'verified', 'ssl_pending', 'active', 'failed'] as const;
export type DomainStatus = typeof DOMAIN_STATUSES[number];

export const ASSET_KINDS = ['image', 'video', 'doc', 'font', 'icon'] as const;
export type AssetKind = typeof ASSET_KINDS[number];

export const REDIRECT_CODES = [301, 302, 307, 308] as const;
export type RedirectCode = typeof REDIRECT_CODES[number];

export const REDIRECT_MATCH_TYPES = ['exact', 'prefix', 'wildcard'] as const;
export type RedirectMatchType = typeof REDIRECT_MATCH_TYPES[number];

export const PUBLISH_SCOPES = ['full', 'partial'] as const;
export type PublishScope = typeof PUBLISH_SCOPES[number];

export const FLAG_STATES = ['enabled', 'disabled', 'beta'] as const;
export type FlagState = typeof FLAG_STATES[number];

export const TRANSLATION_STATUSES = ['draft', 'translated', 'reviewed', 'stale'] as const;
export type TranslationStatus = typeof TRANSLATION_STATUSES[number];

export const FORM_KINDS = ['contact', 'support', 'merchant_app', 'driver_app', 'newsletter', 'feedback', 'booking', 'custom'] as const;
export type FormKind = typeof FORM_KINDS[number];

export const COMPONENT_CATEGORIES = ['layout', 'content', 'commerce', 'dynamic', 'form', 'advanced'] as const;
export type ComponentCategory = typeof COMPONENT_CATEGORIES[number];
