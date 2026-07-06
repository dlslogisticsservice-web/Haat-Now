// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · SEO generator (Wave 2).
// Produces per-page SEO artifacts (meta, OpenGraph, Twitter, JSON-LD, robots,
// canonical, breadcrumb) and site-level sitemap.xml / robots.txt from a compiled
// snapshot. Pure + deterministic; reusable by every white-label tenant.
// ─────────────────────────────────────────────────────────────────────────────

import type { JsonObject, JsonValue } from '../domain/entities';
import type { CompiledPage, SiteSnapshot } from '../publishing/contracts';

function str(v: JsonValue | undefined, fallback = ''): string {
  return typeof v === 'string' ? v : v == null ? fallback : String(v);
}
function obj(v: JsonValue | undefined): JsonObject {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
function arr(v: JsonValue | undefined): JsonValue[] {
  return Array.isArray(v) ? v : [];
}
function xmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] as string));
}

export interface SeoInput {
  origin: string;                 // e.g. https://haatnow.app
  siteName: string;
  page: CompiledPage;
  logoUrl?: string;
  twitterHandle?: string;
}

export interface SeoOutput {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  openGraph: JsonObject;
  twitter: JsonObject;
  jsonLd: JsonObject[];
  /** Ready-to-inject <head> tags (server-rendered SEO). */
  headTags: string[];
}

export function generateSeo(input: SeoInput): SeoOutput {
  const seo = obj(input.page.seo as unknown as JsonValue);
  const title = str(seo.title, `${str(obj(input.page.content).title, input.siteName)} — ${input.siteName}`);
  const description = str(seo.description, `${input.siteName} — order food, groceries, pharmacy and parcels, delivered fast.`);
  const url = `${input.origin}${input.page.path === '/' ? '' : input.page.path}`;
  const canonical = str(seo.canonical, url);
  const robots = str(seo.robots, 'index,follow');
  const image = input.logoUrl ?? `${input.origin}/og-default.png`;

  const openGraph: JsonObject = { 'og:type': 'website', 'og:title': title, 'og:description': description, 'og:url': canonical, 'og:image': image, 'og:site_name': input.siteName };
  const twitter: JsonObject = { 'twitter:card': 'summary_large_image', 'twitter:title': title, 'twitter:description': description, 'twitter:image': image, ...(input.twitterHandle ? { 'twitter:site': input.twitterHandle } : {}) };

  const jsonLd: JsonObject[] = [
    organizationJsonLd(input.siteName, input.origin, input.logoUrl),
    websiteJsonLd(input.siteName, input.origin),
    breadcrumbJsonLd(input.page, input.origin, input.siteName),
  ];
  const faq = faqJsonLd(input.page);
  if (faq) jsonLd.push(faq);

  const headTags = buildHeadTags({ title, description, canonical, robots, openGraph, twitter, jsonLd });
  return { title, description, canonical, robots, openGraph, twitter, jsonLd, headTags };
}

function buildHeadTags(o: { title: string; description: string; canonical: string; robots: string; openGraph: JsonObject; twitter: JsonObject; jsonLd: JsonObject[] }): string[] {
  const tags: string[] = [
    `<title>${xmlEscape(o.title)}</title>`,
    `<meta name="description" content="${xmlEscape(o.description)}">`,
    `<meta name="robots" content="${xmlEscape(o.robots)}">`,
    `<link rel="canonical" href="${xmlEscape(o.canonical)}">`,
  ];
  for (const k of Object.keys(o.openGraph)) tags.push(`<meta property="${k}" content="${xmlEscape(str(o.openGraph[k]))}">`);
  for (const k of Object.keys(o.twitter)) tags.push(`<meta name="${k}" content="${xmlEscape(str(o.twitter[k]))}">`);
  for (const ld of o.jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
  return tags;
}

export function organizationJsonLd(siteName: string, origin: string, logo?: string): JsonObject {
  return { '@context': 'https://schema.org', '@type': 'Organization', name: siteName, url: origin, ...(logo ? { logo } : {}) };
}
export function websiteJsonLd(siteName: string, origin: string): JsonObject {
  return {
    '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: origin,
    potentialAction: { '@type': 'SearchAction', target: `${origin}/search?q={query}`, 'query-input': 'required name=query' },
  };
}
export function breadcrumbJsonLd(page: CompiledPage, origin: string, siteName: string): JsonObject {
  const segments = page.path.split('/').filter(Boolean);
  const items: JsonObject[] = [{ '@type': 'ListItem', position: 1, name: siteName, item: origin }];
  let acc = '';
  segments.forEach((seg, i) => { acc += `/${seg}`; items.push({ '@type': 'ListItem', position: i + 2, name: titleCase(seg), item: `${origin}${acc}` }); });
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}
export function faqJsonLd(page: CompiledPage): JsonObject | null {
  const sections = arr(obj(page.content).sections);
  for (const s of sections) {
    for (const b of arr(obj(s).blocks)) {
      const block = obj(b);
      if (block.type === 'faq') {
        const items = arr(obj(block.props).items).map(it => ({ '@type': 'Question', name: str(obj(it).q), acceptedAnswer: { '@type': 'Answer', text: str(obj(it).a) } }));
        if (items.length) return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items };
      }
    }
  }
  return null;
}

function titleCase(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Site-level ────────────────────────────────────────────────────────────────────
export function generateSitemap(snapshot: SiteSnapshot, origin: string): string {
  const urls = snapshot.pages
    .filter(p => str(obj(p.seo as unknown as JsonValue).robots, 'index,follow').indexOf('noindex') === -1)
    .map(p => `  <url><loc>${xmlEscape(`${origin}${p.path === '/' ? '' : p.path}`)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export function generateRobots(origin: string, indexable: boolean): string {
  return indexable
    ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml`
    : `User-agent: *\nDisallow: /`;
}

/** SEO validation for launch — flags missing/oversized fields. */
export interface SeoIssue { path: string; rule: string }
export function validateSeo(snapshot: SiteSnapshot, siteName: string, origin: string): SeoIssue[] {
  const issues: SeoIssue[] = [];
  for (const page of snapshot.pages) {
    const out = generateSeo({ origin, siteName, page });
    if (!out.title || out.title.length > 65) issues.push({ path: page.path, rule: 'title-length' });
    if (!out.description || out.description.length < 50 || out.description.length > 165) issues.push({ path: page.path, rule: 'description-length' });
    if (!out.canonical.startsWith('http')) issues.push({ path: page.path, rule: 'canonical' });
  }
  return issues;
}
