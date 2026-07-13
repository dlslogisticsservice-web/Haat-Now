// Website Runtime — resolvers. Pure composition over existing services (no duplication):
//   tenant.service (brand/theme spine + applyTheme), website.service (content), monitoring (analytics seam).
// Pure route resolution lives in routes.ts (dependency-free); re-exported here so existing
// imports (`from './runtime'`) are unchanged.
import { tenantService } from '../../services/tenant.service';
import { websiteService, resolveTenantBySlug, type WebsiteSite, type WebsitePage, type WebsiteSeo, type BlogPost } from '../../services/website.service';
import { monitoring } from '../../services/monitoring.service';
import { FLAGSHIP_SLUG, APP_ROUTE_PREFIX, CONSOLE_ROUTES, isAppRoute, isConsoleRoute, resolvePublicRequest, type PublicVia, type PublicRequest } from './routes';

export { FLAGSHIP_SLUG, APP_ROUTE_PREFIX, CONSOLE_ROUTES, isAppRoute, isConsoleRoute, resolvePublicRequest };
export type { PublicVia, PublicRequest };

/** Resolve the tenant (by custom-domain host or slug) → the site (published, or draft when preview). */
export function resolveSite(req: PublicRequest): { tenant: any | null; site: WebsiteSite | null } {
  let tenant: any | null = null;
  let key: string | null = req.slug;
  if (!key && req.via === 'custom-domain' && req.host) {
    const t = websiteService.resolveTenantByDomain(req.host);
    if (t) { tenant = t; key = String(t.id); }
  }
  if (!key) return { tenant: null, site: null };
  const site = req.preview ? websiteService.getDraftSite(key) : websiteService.getPublishedSite(key);
  if (site && !tenant) tenant = resolveTenantBySlug(site.slug) || { id: site.tenantId, slug: site.slug, brand_name: site.siteName };
  return { tenant, site };
}

/** Brand/Theme runtime — reuse the ONE theme engine so the site re-skins with the tenant's brand. */
export function applyBrand(tenant: any): void {
  if (!tenant) { tenantService.restoreDefaultTheme(); return; }
  tenantService.applyTheme(tenant);                    // colors/typography/logo/favicon → CSS vars (no rebuild)
  const fav = tenant.favicon_url || '';
  if (fav) setFavicon(fav);
}

function setFavicon(href: string) {
  try {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = href;
  } catch { /* ignore */ }
}

/** Page resolver — path → page | blog post | 404. */
export function resolvePage(site: WebsiteSite, path: string): { page?: WebsitePage; post?: BlogPost; notFound?: boolean } {
  const clean = path.replace(/\/+$/, '') || '/';
  const blogMatch = clean.match(/^\/blog\/(.+)$/);
  if (blogMatch) {
    const post = site.blog.find(b => b.slug === blogMatch[1]);
    return post ? { post } : { notFound: true };
  }
  const page = site.pages.find(p => p.path.replace(/\/+$/, '') === clean || (clean === '/' && p.path === '/'));
  return page ? { page } : { notFound: true };
}

// ── SEO runtime ──────────────────────────────────────────────────────────────
export interface ResolvedSeo { title: string; description: string; ogImage: string; canonical: string; noindex: boolean; siteName: string; jsonLd: object }

/** Breadcrumb trail from the URL path, resolving segment titles from the site's pages. */
export function breadcrumbTrail(site: WebsiteSite, path: string, origin: string): { name: string; item: string }[] {
  const clean = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  const trail: { name: string; item: string }[] = [{ name: 'Home', item: `${origin}/` }];
  if (clean === '/') return trail;
  const titleFor = (p: string): string => {
    const page = site.pages.find(x => x.path.replace(/\/+$/, '') === p);
    if (page) return page.title;
    const seg = p.split('/').filter(Boolean).pop() || '';
    return seg ? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ') : 'Page';
  };
  const segs = clean.split('/').filter(Boolean);
  let acc = '';
  for (const s of segs) { acc += `/${s}`; trail.push({ name: titleFor(acc), item: `${origin}${acc}` }); }
  return trail;
}

export function buildSeo(site: WebsiteSite, opts: { seo?: WebsiteSeo; title?: string; host: string; path: string; brand: any }): ResolvedSeo {
  const d = site.seoDefaults || {};
  const s = opts.seo || {};
  const title = (s.title || opts.title) ? `${s.title || opts.title}` : (d.title || site.siteName);
  const description = s.description || d.description || `${site.siteName}, powered by HAAT NOW.`;
  const origin = opts.host ? `https://${opts.host}` : `https://${site.slug}.haatnow.app`;
  const canonical = s.canonical || `${origin}${opts.path === '/' ? '' : opts.path}`;
  const ogImage = s.ogImage || opts.brand?.social_banner_url || opts.brand?.logo_url || d.ogImage || '';
  const trail = breadcrumbTrail(site, opts.path, origin);
  const graph: object[] = [
    { '@type': 'Organization', name: site.siteName, url: origin, logo: opts.brand?.logo_url || undefined },
    { '@type': 'WebSite', name: site.siteName, url: origin, potentialAction: { '@type': 'SearchAction', target: `${origin}/restaurants?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
  ];
  // BreadcrumbList on every non-home page → richer search results + clearer site structure.
  if (trail.length > 1) graph.push({ '@type': 'BreadcrumbList', itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) });
  return {
    title, description, ogImage, canonical, noindex: !!s.noindex, siteName: site.siteName,
    jsonLd: { '@context': 'https://schema.org', '@graph': graph },
  };
}

/** Inject SEO into <head>: title, description, canonical, OpenGraph, Twitter cards, robots, structured data. */
export function applySeo(seo: ResolvedSeo): void {
  try {
    document.title = seo.title;
    const set = (sel: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector<HTMLElement>(sel);
      if (!el) { el = document.createElement('meta'); document.head.appendChild(el); }
      Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    };
    set('meta[name="description"]', { name: 'description', content: seo.description });
    set('meta[name="robots"]', { name: 'robots', content: seo.noindex ? 'noindex,nofollow' : 'index,follow' });
    set('meta[property="og:title"]', { property: 'og:title', content: seo.title });
    set('meta[property="og:description"]', { property: 'og:description', content: seo.description });
    set('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    set('meta[property="og:url"]', { property: 'og:url', content: seo.canonical });
    set('meta[property="og:site_name"]', { property: 'og:site_name', content: seo.siteName });
    set('meta[property="og:locale"]', { property: 'og:locale', content: 'en_US' });
    if (seo.ogImage) set('meta[property="og:image"]', { property: 'og:image', content: seo.ogImage });
    set('meta[name="twitter:card"]', { name: 'twitter:card', content: seo.ogImage ? 'summary_large_image' : 'summary' });
    set('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
    set('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });
    if (seo.ogImage) set('meta[name="twitter:image"]', { name: 'twitter:image', content: seo.ogImage });
    let canon = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon); }
    canon.href = seo.canonical;
    let ld = document.getElementById('haat-jsonld') as HTMLScriptElement | null;
    if (!ld) { ld = document.createElement('script'); ld.id = 'haat-jsonld'; ld.type = 'application/ld+json'; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify(seo.jsonLd);
  } catch { /* ssr / non-DOM */ }
}

/** Per-tenant sitemap.xml (from published pages + blog). Served at the edge in production; generated here. */
export function generateSitemap(site: WebsiteSite, origin: string): string {
  const urls = [
    ...site.pages.filter(p => !p.seo?.noindex).map(p => p.path),
    ...site.blog.map(b => `/blog/${b.slug}`),
  ];
  const body = urls.map(u => `  <url><loc>${origin}${u === '/' ? '' : u}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

/** Per-tenant robots.txt. */
export function generateRobots(site: WebsiteSite, origin: string): string {
  if (site.status !== 'published' || site.maintenance) return 'User-agent: *\nDisallow: /';
  return `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml`;
}

// ── Analytics runtime (reuse the existing monitoring seam; no new analytics service) ──
export function trackPageview(site: WebsiteSite, path: string): void {
  monitoring.track('website_pageview', { tenant: site.slug, path, provider: site.analytics?.providerId || null });
}
