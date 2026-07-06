// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Dynamic Navigation (Wave 4, Part 3).
// Header / footer / mega-menu / breadcrumbs / sticky / search-nav — all editable from
// Website Center. Builds on the Wave 1 website_menus + website_navigation data (no
// duplication): pure tree/breadcrumb builders + a resolver over the existing repos +
// a navigation config (website_settings). Reusable by every tenant.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, Result } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import type { WebsiteNavItem, WebsitePage } from '../domain/entities';
import type { PlatformContext } from '../services/context';

/** A resolved navigation node (tree). Mega-menu = a top-level node with grouped children. */
export interface NavNode {
  id: UUID;
  label: string;
  href: string;
  children: NavNode[];
}

export interface NavigationConfig {
  sticky: boolean;
  showSearch: boolean;
  headerMenuKey: string;
  footerMenuKey: string;
}
export function defaultNavigationConfig(): NavigationConfig {
  return { sticky: true, showSearch: true, headerMenuKey: 'header', footerMenuKey: 'footer' };
}

/** Path resolver for a nav item: page → its path, else external url, else '#'. */
export type PathResolver = (pageId: UUID | null, externalUrl: string | null) => string;

/** Build a nav tree from flat nav items (parentId links), ordered by position. Pure. */
export function buildNavTree(items: ReadonlyArray<WebsiteNavItem>, resolvePath: PathResolver): NavNode[] {
  const nodes = new Map<UUID, NavNode>();
  const sorted = [...items].filter(i => i.deletedAt === null).sort((a, b) => a.position - b.position);
  for (const item of sorted) nodes.set(item.id, { id: item.id, label: item.label, href: resolvePath(item.pageId, item.externalUrl), children: [] });
  const roots: NavNode[] = [];
  for (const item of sorted) {
    const node = nodes.get(item.id)!;
    if (item.parentId && nodes.has(item.parentId)) nodes.get(item.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export interface Breadcrumb { label: string; href: string }

/** Build breadcrumbs for a path from the site's pages. Pure. */
export function buildBreadcrumbs(path: string, pages: ReadonlyArray<WebsitePage>, homeLabel = 'Home'): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [{ label: homeLabel, href: '/' }];
  if (path === '/' || path === '') return crumbs;
  const segments = path.split('/').filter(Boolean);
  let acc = '';
  for (const seg of segments) {
    acc += `/${seg}`;
    const page = pages.find(p => p.slug === seg && p.deletedAt === null);
    crumbs.push({ label: page ? page.title : titleCase(seg), href: acc });
  }
  return crumbs;
}

function titleCase(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export interface ResolvedNavigation {
  config: NavigationConfig;
  header: NavNode[];
  footer: NavNode[];
}

export class DynamicNavigationService {
  constructor(private readonly ctx: PlatformContext) {}

  private async pathResolver(tenantId: UUID, siteId: UUID): Promise<PathResolver> {
    const pagesRes = await this.ctx.repos.pages.list(tenantId, { pageSize: 200, filters: [{ field: 'siteId', operator: 'eq', value: siteId }] });
    const byId = new Map<UUID, WebsitePage>();
    if (isOk(pagesRes)) for (const p of pagesRes.value.items) byId.set(p.id, p);
    return (pageId, externalUrl) => {
      if (pageId && byId.has(pageId)) { const p = byId.get(pageId)!; return p.slug === 'home' ? '/' : `/${p.slug}`; }
      return externalUrl ?? '#';
    };
  }

  private async menuTree(tenantId: UUID, siteId: UUID, menuKey: string, resolve: PathResolver): Promise<NavNode[]> {
    const menus = await this.ctx.repos.menus.list(tenantId, { pageSize: 20, filters: [{ field: 'siteId', operator: 'eq', value: siteId }] });
    const menu = isOk(menus) ? menus.value.items.find(m => m.key === menuKey) : undefined;
    if (!menu) return [];
    const items = await this.ctx.repos.navigation.list(tenantId, { pageSize: 200, filters: [{ field: 'menuId', operator: 'eq', value: menu.id }] });
    return isOk(items) ? buildNavTree(items.value.items, resolve) : [];
  }

  /** Read the navigation config (website_settings key='navigation'). */
  async getConfig(tenantId: UUID, siteId: UUID): Promise<NavigationConfig> {
    const row = await this.ctx.children.settings.findOne({ tenantId, siteId, key: 'navigation' });
    const stored = isOk(row) && row.value ? (row.value.value as Partial<NavigationConfig>) : {};
    return { ...defaultNavigationConfig(), ...stored };
  }

  async resolve(tenantId: UUID, siteId: UUID): Promise<Result<ResolvedNavigation>> {
    const config = await this.getConfig(tenantId, siteId);
    const resolve = await this.pathResolver(tenantId, siteId);
    const header = await this.menuTree(tenantId, siteId, config.headerMenuKey, resolve);
    const footer = await this.menuTree(tenantId, siteId, config.footerMenuKey, resolve);
    return ok({ config, header, footer });
  }

  async breadcrumbs(tenantId: UUID, siteId: UUID, path: string): Promise<Result<Breadcrumb[]>> {
    const pagesRes = await this.ctx.repos.pages.list(tenantId, { pageSize: 200, filters: [{ field: 'siteId', operator: 'eq', value: siteId }] });
    if (!isOk(pagesRes)) return err(pagesRes.error);
    return ok(buildBreadcrumbs(path, pagesRes.value.items));
  }
}

export function createDynamicNavigationService(ctx: PlatformContext): DynamicNavigationService {
  return new DynamicNavigationService(ctx);
}
