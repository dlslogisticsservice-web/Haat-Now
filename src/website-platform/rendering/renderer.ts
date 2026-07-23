// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Renderer Foundation (Wave 2).
// Turns a compiled snapshot page into HTML — pure, DOM-free, edge-ready (no window,
// no React runtime), so it runs identically in Node, an edge function, or at build
// time (static rendering). A block-type → HTML registry generates markup from block
// props; unknown blocks are skipped safely. Includes asset fingerprinting + a cache
// manifest. No visual builder. Implements the Wave 0 Renderer contract.
// ─────────────────────────────────────────────────────────────────────────────

import type { Result, ISODateTime } from '../shared/types';
import { ok } from '../shared/types';
import type { JsonObject, JsonValue } from '../domain/entities';
import type { CompiledPage, SiteSnapshot, RenderContext, RenderedResponse, Renderer } from '../publishing/contracts';
import { contentHash } from '../snapshot/snapshot';

// ── HTML escaping (XSS-safe text) ────────────────────────────────────────────────
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
function attr(v: string): string {
  return escapeHtml(v);
}
/**
 * Restrict generated link hrefs to safe schemes. escapeHtml() neutralises quotes/brackets
 * but NOT a `javascript:` (or `data:`/`vbscript:`) scheme, which would execute on click in
 * tenant-authored content. Whitespace/control chars are stripped before the scheme test so
 * `java\tscript:` cannot slip through. http(s)/mailto/tel/relative/anchor links pass unchanged.
 */
export function safeUrl(v: string): string {
  const cleaned = v.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  if (/^(javascript|data|vbscript):/.test(cleaned)) return '#';
  return v;
}
function str(v: JsonValue | undefined, fallback = ''): string {
  return typeof v === 'string' ? v : v == null ? fallback : String(v);
}
function arr(v: JsonValue | undefined): JsonValue[] {
  return Array.isArray(v) ? v : [];
}
function obj(v: JsonValue | undefined): JsonObject {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

// ── Block renderers (server-side, string HTML) ────────────────────────────────────
export type BlockHtmlRenderer = (props: JsonObject) => string;

const BLOCK_RENDERERS: Record<string, BlockHtmlRenderer> = {
  hero: p => `<section class="wp-hero"><h1>${escapeHtml(str(p.title))}</h1>${p.subtitle ? `<p>${escapeHtml(str(p.subtitle))}</p>` : ''}${renderCta(p.cta)}</section>`,
  heading: p => `<h2 class="wp-heading">${escapeHtml(str(p.text))}</h2>`,
  text: p => `<p class="wp-text">${escapeHtml(str(p.body))}</p>`,
  richtext: p => `<div class="wp-richtext">${p.heading ? `<h2>${escapeHtml(str(p.heading))}</h2>` : ''}<p>${escapeHtml(str(p.body))}</p></div>`,
  button: p => renderCta({ label: p.label, href: p.href }),
  features: p => `<section class="wp-features">${p.heading ? `<h2>${escapeHtml(str(p.heading))}</h2>` : ''}<ul>${arr(p.items).map(it => `<li><strong>${escapeHtml(str(obj(it).title))}</strong><span>${escapeHtml(str(obj(it).body))}</span></li>`).join('')}</ul></section>`,
  cards: p => `<section class="wp-cards">${p.heading ? `<h2>${escapeHtml(str(p.heading))}</h2>` : ''}<div class="wp-grid">${arr(p.items).map(it => `<article><h3>${escapeHtml(str(obj(it).title))}</h3><p>${escapeHtml(str(obj(it).body))}</p></article>`).join('')}</div></section>`,
  stats: p => `<section class="wp-stats">${arr(p.items).map(it => `<div><b>${escapeHtml(str(obj(it).value))}</b><span>${escapeHtml(str(obj(it).label))}</span></div>`).join('')}</section>`,
  faq: p => `<section class="wp-faq">${p.heading ? `<h2>${escapeHtml(str(p.heading))}</h2>` : ''}<dl>${arr(p.items).map(it => `<dt>${escapeHtml(str(obj(it).q))}</dt><dd>${escapeHtml(str(obj(it).a))}</dd>`).join('')}</dl></section>`,
  cta: p => `<section class="wp-cta"><h2>${escapeHtml(str(p.title))}</h2>${p.subtitle ? `<p>${escapeHtml(str(p.subtitle))}</p>` : ''}${renderCta(p.button)}</section>`,
  contact: p => `<section class="wp-contact">${p.heading ? `<h2>${escapeHtml(str(p.heading))}</h2>` : ''}${p.email ? `<a href="mailto:${attr(str(p.email))}">${escapeHtml(str(p.email))}</a>` : ''}${p.phone ? `<span>${escapeHtml(str(p.phone))}</span>` : ''}</section>`,
  image: p => p.src ? `<img class="wp-image" src="${attr(str(p.src))}" alt="${attr(str(p.alt))}" loading="lazy" decoding="async">` : '',
};

function renderCta(v: JsonValue | undefined): string {
  const c = obj(v);
  if (!c.label) return '';
  return `<a class="wp-cta-btn" href="${attr(safeUrl(str(c.href, '#')))}">${escapeHtml(str(c.label))}</a>`;
}

/** Register/override a block renderer (extension point; reusable by white-label tenants). */
export function registerBlockRenderer(type: string, renderer: BlockHtmlRenderer): void {
  BLOCK_RENDERERS[type] = renderer;
}

// ── Snapshot renderer ──────────────────────────────────────────────────────────────
export interface CacheManifestEntry { key: string; etag: string; path: string; locale: string }
export interface CacheManifest { siteId: string; version: number; entries: CacheManifestEntry[] }

export class SnapshotRenderer implements Renderer {
  /** Render one compiled page's body HTML (static; deterministic). */
  renderPageBody(page: CompiledPage): string {
    const sections = arr(obj(page.content).sections);
    return sections.map(s => {
      const blocks = arr(obj(s).blocks);
      return `<div class="wp-section">${blocks.map(b => {
        const block = obj(b);
        const renderer = BLOCK_RENDERERS[str(block.type)];
        return renderer ? renderer(obj(block.props)) : '';
      }).join('')}</div>`;
    }).join('');
  }

  /** Full document (head + body) for a page within a snapshot. */
  renderDocument(snapshot: SiteSnapshot, page: CompiledPage): string {
    const seo = obj(page.seo as unknown as JsonValue);
    const themeVars = renderThemeVars(obj(snapshot.theme).light as JsonValue | undefined);
    const dir = page.locale === 'ar' ? 'rtl' : 'ltr';
    return `<!doctype html><html lang="${attr(page.locale)}" dir="${dir}">`
      + `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
      + `<title>${escapeHtml(str(seo.title, 'HaaT Now'))}</title>`
      + (seo.description ? `<meta name="description" content="${attr(str(seo.description))}">` : '')
      + `<meta name="robots" content="${attr(str(seo.robots, 'index,follow'))}">`
      + (themeVars ? `<style>:root{${themeVars}}</style>` : '')
      + `</head><body>${this.renderPageBody(page)}</body></html>`;
  }

  async render(snapshot: SiteSnapshot, context: RenderContext): Promise<Result<RenderedResponse>> {
    const page = snapshot.pages.find(p => p.path === context.path && p.locale === context.locale)
      ?? snapshot.pages.find(p => p.path === context.path);
    if (!page) {
      return ok({ status: 404, html: '<!doctype html><title>404</title><h1>Not found</h1>', headers: {}, cacheKey: cacheKey(context) });
    }
    const html = this.renderDocument(snapshot, page);
    return ok({
      status: 200,
      html,
      headers: { 'content-type': 'text/html; charset=utf-8', etag: page.etag, 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' },
      cacheKey: cacheKey(context),
    });
  }
}

function renderThemeVars(light: JsonValue | undefined): string {
  const tokens = obj(light);
  return Object.keys(tokens).map(k => `--${k.replace(/[^a-z0-9-]/gi, '-')}:${escapeHtml(str(tokens[k]))}`).join(';');
}

function cacheKey(ctx: RenderContext): string {
  return `${ctx.host}:${ctx.path}:${ctx.locale}:${ctx.variantKey}:${ctx.deviceClass}`;
}

// ── Asset fingerprinting + cache manifest ─────────────────────────────────────────
/** Fingerprint an asset URL/path (content-addressed cache-busting). */
export function fingerprintAsset(pathOrUrl: string): string {
  const fp = contentHash(pathOrUrl);
  const dot = pathOrUrl.lastIndexOf('.');
  return dot > 0 ? `${pathOrUrl.slice(0, dot)}.${fp}${pathOrUrl.slice(dot)}` : `${pathOrUrl}?v=${fp}`;
}

/** Build a per-path cache manifest from a snapshot (edge/CDN key set). */
export function buildCacheManifest(snapshot: SiteSnapshot, host: string): CacheManifest {
  return {
    siteId: snapshot.siteId,
    version: snapshot.version,
    entries: snapshot.pages.map(p => ({ key: `${host}:${p.path}:${p.locale}`, etag: p.etag, path: p.path, locale: p.locale })),
  };
}

export function createRenderer(): SnapshotRenderer {
  return new SnapshotRenderer();
}

/** A rendered static bundle: every page pre-rendered to HTML (static generation). */
export interface StaticRenderResult { siteId: string; version: number; pages: { path: string; locale: string; html: string; etag: string }[]; generatedAt: ISODateTime }

export function renderStatic(snapshot: SiteSnapshot, renderer: SnapshotRenderer, now: ISODateTime): StaticRenderResult {
  return {
    siteId: snapshot.siteId,
    version: snapshot.version,
    pages: snapshot.pages.map(p => ({ path: p.path, locale: p.locale, html: renderer.renderDocument(snapshot, p), etag: p.etag })),
    generatedAt: now,
  };
}
