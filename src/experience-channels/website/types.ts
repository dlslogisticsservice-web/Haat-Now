// ─────────────────────────────────────────────────────────────────────────────
// Website Channel · content-source boundary.
//
// The Experience Engine must WRAP the existing Website, never rewrite it. This interface
// is the seam: it names exactly what the Website channel needs from website.service. The
// REAL implementation (contentSource.ts) wraps `websiteService`; tests inject a fake. So
// the resolvers stay pure and independent of localStorage / website.service internals.
//
// The `WebsiteSite` import is TYPE-ONLY (erased at runtime) — importing this file loads no
// website.service code, so it is safe under the node test runner.
// ─────────────────────────────────────────────────────────────────────────────
import type { WebsiteSite } from '../../services/website.service';

/** Read-only view over website.service — the only surface the channel depends on. */
export interface WebsiteContentSource {
  /** The published site for a tenant slug/id, or null. Wraps websiteService.getPublishedSite. */
  getPublishedSite(slugOrId: string): WebsiteSite | null;
  /** The draft (working copy) — used for Studio preview. Wraps websiteService.getDraftSite. */
  getDraftSite(slugOrId: string): WebsiteSite | null;
  /** The current version number from website.service's version model. */
  getVersion(slugOrId: string): number | null;
  /** Site ids to pre-register as experiences. Wraps websiteService.listSites(). */
  listSiteIds(): string[];
}
