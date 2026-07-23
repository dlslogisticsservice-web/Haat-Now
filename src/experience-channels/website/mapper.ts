// ─────────────────────────────────────────────────────────────────────────────
// Website Channel · content → schema mapper.
//
// A PURE PROJECTION of the existing website content model (WebsiteSite) onto the Engine's
// channel-neutral WebsiteSchema. It copies NO business logic and reimplements nothing — it
// only re-shapes data the Website already owns into the Engine's vocabulary. website.service
// types are imported TYPE-ONLY (erased), so this module runs anywhere.
// ─────────────────────────────────────────────────────────────────────────────
import type { WebsiteSite, WebsitePage, WebsiteBlock } from '../../services/website.service';
import type {
  WebsiteSchema, TreeNode, LayoutNode, ComponentNode, ExperienceMetadata, ExperienceContext, Json,
} from '../../experience-engine';
import { assignBlockIds } from './blockId';

/**
 * One website block → one component node.
 * Wave 16: the node id is the STABLE block id (`assignBlockIds`), not a positional `blk_<i>`, so a
 * render plan keeps targeting the same authored block when other blocks are inserted or reordered.
 * The live runtime derives ids from the same helper — one id scheme, no drift between the two.
 */
function blockToNode(block: WebsiteBlock, id: string): ComponentNode {
  return {
    id,
    type: 'component',
    componentId: block.type,
    // Blocks are JSON content; carried verbatim so the renderer maps them back unchanged.
    props: (block as unknown) as { [key: string]: Json },
  };
}

/** A page's sections → a layout node. */
function pageLayout(page: WebsitePage): LayoutNode {
  const sections = page.sections ?? [];
  const ids = assignBlockIds(sections);
  return {
    id: `page_${page.id}`,
    type: 'layout',
    layout: 'section',
    children: sections.map((block, i) => blockToNode(block, ids[i])),
  };
}

const emptyLayout = (): LayoutNode => ({ id: 'root', type: 'layout', layout: 'section', children: [] });

/** Project a WebsiteSite onto the Engine's WebsiteSchema for a given context + version. */
export function mapSiteToSchema(site: WebsiteSite, context: ExperienceContext, version: number): WebsiteSchema {
  const home = site.pages.find(p => p.path === '/') ?? site.pages[0];
  const base: TreeNode = home ? pageLayout(home) : emptyLayout();
  return {
    id: site.tenantId,
    channel: 'website',
    tenantId: site.tenantId,
    schemaVersion: String(site.schemaVersion ?? version ?? 1),
    layout: base,
    locales: ['ar', 'en'],
    defaultLocale: context.locale === 'en' ? 'en' : 'ar',
    meta: { title: site.siteName },
    pages: site.pages.map(p => ({ path: p.path, title: p.title, layout: pageLayout(p), seo: p.seo })),
    nav: site.navigation.map((l, i) => ({ label: l.label, href: l.path, order: i })),
    blog: { enabled: (site.blog?.length ?? 0) > 0 },
  };
}

/** Project a WebsiteSite onto ExperienceMetadata (for the registry). */
export function mapSiteToMetadata(site: WebsiteSite, version: number): ExperienceMetadata {
  const publishingStatus: ExperienceMetadata['publishingStatus'] =
    site.status === 'published' ? 'published' : site.status === 'suspended' ? 'archived' : 'draft';
  return {
    id: site.tenantId,
    name: site.siteName,
    version: String(version ?? 1),
    channel: 'website',
    supportedPlatforms: ['web'],
    supportedDevices: ['mobile', 'tablet', 'desktop'],
    supportedRoles: ['guest', 'customer'],
    requiredPermissions: [],
    locales: ['ar', 'en'],
    themes: ['website:default'],
    featureFlags: [],
    publishingStatus,
    dependencies: [],
  };
}
