// Website Runtime — resolvers. Pure composition over existing services (no duplication):
//   tenant.service (brand/theme spine + applyTheme), website.service (content), monitoring (analytics seam).
import { tenantService } from '../../services/tenant.service';
import { websiteService, resolveTenantBySlug, type WebsiteSite, type WebsitePage, type WebsiteSeo, type BlogPost } from '../../services/website.service';
import { monitoring } from '../../services/monitoring.service';

const APP_HOSTS = ['localhost', '127.0.0.1', 'haat-now.vercel.app'];
const RESERVED_SUB = new Set(['www', 'app', 'admin', 'api', 'haat-now', 'haatnow']);

export interface PublicRequest { isPublicSite: boolean; slug: string | null; path: string; host: string }

/** Decide whether this request targets a tenant website, and which tenant + path.
 *  Sandbox/dev: `?site=<slug>` (+ optional `?path=/about`). Live: subdomain or custom domain. */
export function resolvePublicRequest(loc: Location): PublicRequest {
  const host = loc.hostname || '';
  const params = new URLSearchParams(loc.search);
  const path = params.get('path') || (loc.pathname && loc.pathname !== '/' ? loc.pathname : '/');

  // 1) Explicit sandbox/dev signal.
  const siteParam = params.get('site');
  if (siteParam) return { isPublicSite: true, slug: siteParam.toLowerCase(), path, host };

  // 2) Subdomain of a haatnow host: <slug>.haatnow.app / .com
  const m = host.match(/^([a-z0-9-]+)\.haatnow\.(app|com)$/i);
  if (m && !RESERVED_SUB.has(m[1].toLowerCase())) return { isPublicSite: true, slug: m[1].toLowerCase(), path, host };

  // 3) A custom domain (any host that is not an app host and not a bare IP): resolve by domain.
  const isAppHost = APP_HOSTS.includes(host) || host.endsWith('.vercel.app');
  if (host && !isAppHost && host.includes('.')) {
    // Custom-domain resolution is by the tenant's stored domain; the runtime looks it up in website.service.
    return { isPublicSite: true, slug: null, path, host };
  }

  return { isPublicSite: false, slug: null, path, host };
}

/** Resolve the tenant (by slug or custom domain host) → the published site. */
export function resolveSite(req: PublicRequest): { tenant: any | null; site: WebsiteSite | null } {
  let tenant = req.slug ? resolveTenantBySlug(req.slug) : null;
  let site = req.slug ? websiteService.getPublishedSite(req.slug) : null;
  if (!site && !req.slug && req.host) {
    // custom-domain path: find a site whose domain/customDomain matches the host
    const match = websiteService.listSites().find(() => false); // sandbox has no custom-domain map; live would query website_domains
    if (match) site = websiteService.getPublishedSite(match.tenantId);
  }
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
export interface ResolvedSeo { title: string; description: string; ogImage: string; canonical: string; noindex: boolean; jsonLd: object }

export function buildSeo(site: WebsiteSite, opts: { seo?: WebsiteSeo; title?: string; host: string; path: string; brand: any }): ResolvedSeo {
  const d = site.seoDefaults || {};
  const s = opts.seo || {};
  const title = s.title || opts.title ? `${s.title || opts.title}` : (d.title || site.siteName);
  const description = s.description || d.description || `${site.siteName}, powered by HAAT NOW.`;
  const origin = opts.host ? `https://${opts.host}` : `https://${site.slug}.haatnow.app`;
  const canonical = s.canonical || `${origin}${opts.path === '/' ? '' : opts.path}`;
  const ogImage = s.ogImage || opts.brand?.social_banner_url || opts.brand?.logo_url || d.ogImage || '';
  return {
    title, description, ogImage, canonical, noindex: !!s.noindex,
    jsonLd: { '@context': 'https://schema.org', '@type': 'Organization', name: site.siteName, url: origin, logo: opts.brand?.logo_url || undefined },
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
    if (seo.ogImage) set('meta[property="og:image"]', { property: 'og:image', content: seo.ogImage });
    set('meta[name="twitter:card"]', { name: 'twitter:card', content: seo.ogImage ? 'summary_large_image' : 'summary' });
    set('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
    set('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });
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
