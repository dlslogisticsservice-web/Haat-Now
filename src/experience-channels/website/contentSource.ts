// ─────────────────────────────────────────────────────────────────────────────
// Website Channel · real content source (browser glue).
//
// The ONE file that imports website.service at runtime. It satisfies WebsiteContentSource by
// delegating to the existing `websiteService` — no new logic, no copied logic. Tests do NOT
// import this file; they inject a fake source, keeping the resolvers pure. This is the single
// wiring point between the Engine and the live Website content model.
// ─────────────────────────────────────────────────────────────────────────────
import { websiteService } from '../../services/website.service';
import type { WebsiteContentSource } from './types';

/** Wrap the live websiteService as a WebsiteContentSource. */
export function createWebsiteContentSource(): WebsiteContentSource {
  return {
    getPublishedSite: (id) => websiteService.getPublishedSite(id),
    getDraftSite: (id) => websiteService.getDraftSite(id),
    getVersion: (id) => {
      try { return websiteService.healthReport(id).latest; } catch { return null; }
    },
    listSiteIds: () => websiteService.listSites().map(s => s.tenantId),
  };
}
