// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Compatibility layer (Wave 0).
// Bridges the legacy Website Center (src/services/website.service — localStorage,
// single-blob model) to the new platform domain, and provides a flag-gated backend
// selector. In Wave 0 the selector ALWAYS resolves to 'legacy' (the DB_BACKEND flag
// defaults disabled), so behavior is byte-identical. Later waves flip the flag per
// tenant for a zero-downtime, reversible migration.
//
// The legacy service is imported TYPE-ONLY (erased at compile) — no runtime coupling,
// no side effects, no behavior change.
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteSite as LegacySite, WebsitePage as LegacyPage } from '../../services/website.service';
import type { CreateSiteDto, CreatePageDto } from '../domain/dto';
import type { SiteStatus } from '../domain/enums';
import type { UUID } from '../shared/types';
import type { FlagContext, FlagResolver } from '../flags/flags';
import { WEBSITE_FLAGS, defaultFlagResolver } from '../flags/flags';

export type WebsiteBackend = 'legacy' | 'platform';

/**
 * Decide which backend serves a tenant's website. Resolves to 'platform' ONLY when
 * the DB_BACKEND flag is enabled for the context; otherwise 'legacy'. Default
 * resolver ⇒ always 'legacy' in Wave 0.
 */
export function selectWebsiteBackend(ctx: FlagContext, resolver: FlagResolver = defaultFlagResolver): WebsiteBackend {
  return resolver.isEnabled(WEBSITE_FLAGS.DB_BACKEND, ctx) ? 'platform' : 'legacy';
}

/** Map the legacy site status union onto the platform SiteStatus. */
function mapStatus(status: LegacySite['status']): SiteStatus {
  switch (status) {
    case 'published': return 'published';
    case 'suspended': return 'suspended';
    case 'draft': return 'draft';
    default: return 'draft';
  }
}

/**
 * Translate a legacy site blob into a platform CreateSiteDto (the seed for a one-time
 * import). Locale defaults to the app's AR/EN pair; the legacy model is single-locale.
 */
export function legacySiteToCreateDto(tenantId: UUID, legacy: LegacySite): CreateSiteDto {
  return {
    tenantId,
    slug: legacy.slug,
    name: legacy.siteName,
    status: mapStatus(legacy.status),
    defaultLocale: 'ar',
    locales: ['ar', 'en'],
    settings: {
      maintenance: legacy.maintenance,
      analytics: legacy.analytics ?? {},
      cookie: legacy.cookie ?? { enabled: true, policyPath: '/privacy' },
      importedFrom: 'legacy_website_center',
    },
  };
}

/** Translate a legacy page into a platform CreatePageDto for a target site. */
export function legacyPageToCreateDto(tenantId: UUID, siteId: UUID, legacy: LegacyPage): CreatePageDto {
  const slug = legacy.path === '/' ? 'home' : legacy.path.replace(/^\/+/, '').replace(/\/+$/, '') || 'page';
  return {
    tenantId,
    siteId,
    slug,
    title: legacy.title,
    routeType: 'static',
    locale: 'ar',
    inNav: legacy.nav,
    position: legacy.navOrder,
  };
}

/** A one-time importer plan: the DTOs to write when migrating a legacy site. */
export interface LegacyImportPlan {
  site: CreateSiteDto;
  pages: CreatePageDto[];
}

/** Build (but do not execute) an import plan from a legacy site blob. */
export function planLegacyImport(tenantId: UUID, legacy: LegacySite): LegacyImportPlan {
  const site = legacySiteToCreateDto(tenantId, legacy);
  // siteId is unknown until the site row is created; the executor fills it in per page.
  const pages = legacy.pages.map(p => legacyPageToCreateDto(tenantId, '00000000-0000-0000-0000-000000000000', p));
  return { site, pages };
}
