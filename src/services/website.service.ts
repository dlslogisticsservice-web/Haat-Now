// AUTHORIZED BY: Website Platform Runtime sprint, per docs/architecture/WEBSITE_PLATFORM_ARCHITECTURE.md
// Phase: Website Runtime
// Purpose: Website content engine — per-tenant site (pages/sections/nav/footer/blog/legal/SEO) with
//   draft/publish/version/rollback, mirroring experience.service's publishing pattern (one CMS model).
//   Owner: Experience/Platform.
// Existing services reused: tenant.service (brand/theme spine + tenant resolution), designSystem/tenantTheme
//   (theming — applied by the runtime, not here), monitoring (analytics seam), assets (media URLs).
// Why a new service is required: no service models website page content. experience.service covers only the 3
//   auth screens (splash/login/onboarding); this is the website-pages extension of the same model.
// Duplicate analysis: no new theming/media/tenant/subscription/audit system; brand/theme come from the tenant
//   record + theme engine at render. Sandbox store mirrors the future website_* tables (WEBSITE_DATABASE.md).
// Consumers: the Public Website Runtime (features/website/*) + (future) a Website Center admin console.
// Future merge candidate: NO
import { supabase } from '../lib/supabase';

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox' || !supabase;
const LS_KEY = 'haat_sb_website_v1';
const TENANTS_KEY = 'haat_crud_tenants';

// ── Content model ─────────────────────────────────────────────────────────────
export type WebsitePageKind = 'landing' | 'about' | 'contact' | 'blog_index' | 'help_index' | 'legal' | 'custom';
export type WebsiteBlock =
  | { type: 'hero'; title: string; subtitle?: string; cta?: { label: string; href: string }; image?: string }
  | { type: 'richtext'; heading?: string; body: string }
  | { type: 'features'; heading?: string; items: { title: string; body: string }[] }
  | { type: 'cta'; title: string; subtitle?: string; button: { label: string; href: string } }
  | { type: 'gallery'; heading?: string; images: string[] }
  | { type: 'faq'; heading?: string; items: { q: string; a: string }[] }
  | { type: 'contact'; heading?: string; email?: string; phone?: string; address?: string };

export interface WebsiteSeo { title?: string; description?: string; ogImage?: string; canonical?: string; noindex?: boolean }
export interface WebsiteLink { label: string; path: string }
export interface WebsitePage { id: string; path: string; kind: WebsitePageKind; title: string; nav: boolean; navOrder: number; seo: WebsiteSeo; sections: WebsiteBlock[] }
export interface BlogPost { id: string; slug: string; title: string; excerpt: string; cover?: string; body: WebsiteBlock[]; author: string; publishedAt: string; tags: string[]; seo: WebsiteSeo }
export interface WebsiteFooter { columns: { title: string; links: WebsiteLink[] }[]; social: { label: string; href: string }[]; legalLinks: WebsiteLink[]; copyright: string }
export interface WebsiteSite {
  tenantId: string; slug: string; siteName: string;
  status: 'draft' | 'published' | 'suspended';
  maintenance: boolean;
  navigation: WebsiteLink[];
  footer: WebsiteFooter;
  pages: WebsitePage[];
  blog: BlogPost[];
  seoDefaults: WebsiteSeo;
  analytics: { providerId?: string; measurementId?: string };
  cookie: { enabled: boolean; policyPath: string };
  domain?: string; customDomain?: string; sslStatus?: 'none' | 'provisioning' | 'active';
  updatedAt: string;
}
interface Record_ { draft: WebsiteSite; published: WebsiteSite; version: number; history: { version: number; at: string; site: WebsiteSite }[] }
type Store = Record<string, Record_>; // key = tenantId

const readStore = (): Store => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };
const writeStore = (s: Store) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ } };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const now = () => new Date().toISOString();

/** Notify the running public site that content/brand/status changed → instant re-render, no rebuild/redeploy. */
function emitChange(tenantId: string) {
  try { window.dispatchEvent(new CustomEvent('haat:website', { detail: { tenantId } })); } catch { /* ssr */ }
}

// ── Tenant resolution (reuse the tenant store; no duplicate tenant registry) ──
function allTenants(): any[] { try { return JSON.parse(localStorage.getItem(TENANTS_KEY) || '[]'); } catch { return []; } }
export function resolveTenantBySlug(slug: string): any | null {
  const s = (slug || '').toLowerCase();
  return allTenants().find(t => (t.slug || '').toLowerCase() === s) || null;
}
export function resolveTenantById(id: string): any | null {
  return allTenants().find(t => String(t.id) === String(id)) || null;
}

// ── Default site generator (seeded from the tenant record + template cms_structure) ──
function defaultSite(tenant: any): WebsiteSite {
  const name: string = tenant.site_name || tenant.brand_name || 'HAAT NOW';
  const slug: string = tenant.slug || 'site';
  const support = tenant.support_email || 'hello@haatnow.app';
  const cmsPages: string[] = Array.isArray(tenant?.cms_structure?.pages) ? tenant.cms_structure.pages : [];

  const home: WebsitePage = {
    id: 'p_home', path: '/', kind: 'landing', title: name, nav: true, navOrder: 0,
    seo: { title: `${name} — ${slug}`, description: `${name} · fast delivery, powered by HAAT NOW.` },
    sections: [
      { type: 'hero', title: name, subtitle: 'Everything you need, delivered — fast, reliable, beautifully simple.', cta: { label: 'Get started', href: '/contact' } },
      { type: 'features', heading: 'Why choose us', items: [
        { title: 'Fast delivery', body: 'Orders arrive in ~30 minutes across the city.' },
        { title: 'Trusted partners', body: 'Vetted merchants and captains you can rely on.' },
        { title: 'One tap', body: 'A clean, effortless ordering experience.' },
      ] },
      { type: 'cta', title: 'Ready to order?', subtitle: 'Join thousands of happy customers today.', button: { label: 'Contact sales', href: '/contact' } },
    ],
  };
  const about: WebsitePage = { id: 'p_about', path: '/about', kind: 'about', title: 'About', nav: true, navOrder: 1,
    seo: { title: `About ${name}`, description: `About ${name}.` },
    sections: [{ type: 'richtext', heading: `About ${name}`, body: `${name} is a modern delivery platform built on HAAT NOW. We connect customers, merchants and captains through one seamless experience.` }] };
  const contact: WebsitePage = { id: 'p_contact', path: '/contact', kind: 'contact', title: 'Contact', nav: true, navOrder: 4,
    seo: { title: `Contact ${name}`, description: `Get in touch with ${name}.` },
    sections: [{ type: 'contact', heading: 'Get in touch', email: support, phone: tenant.support_phone || '', address: '' }] };
  const blog: WebsitePage = { id: 'p_blog', path: '/blog', kind: 'blog_index', title: 'Blog', nav: true, navOrder: 2,
    seo: { title: `${name} Blog`, description: `News and updates from ${name}.` }, sections: [] };
  const help: WebsitePage = { id: 'p_help', path: '/help', kind: 'help_index', title: 'Help Center', nav: true, navOrder: 3,
    seo: { title: `${name} Help Center`, description: `Answers and support for ${name}.` },
    sections: [{ type: 'faq', heading: 'Frequently asked questions', items: [
      { q: 'How fast is delivery?', a: 'Most orders arrive within 30 minutes.' },
      { q: 'How do I track my order?', a: 'Open the app and go to Orders to track in real time.' },
      { q: 'How do I contact support?', a: `Email us at ${support} or use the in-app support center.` },
    ] }] };
  const privacy: WebsitePage = { id: 'p_privacy', path: '/privacy', kind: 'legal', title: 'Privacy Policy', nav: false, navOrder: 10,
    seo: { title: `Privacy Policy — ${name}`, noindex: false },
    sections: [{ type: 'richtext', heading: 'Privacy Policy', body: `${name} respects your privacy. We collect only the data needed to provide the service and never sell it. This is a starter policy — edit it in the Website Center.` }] };
  const terms: WebsitePage = { id: 'p_terms', path: '/terms', kind: 'legal', title: 'Terms of Service', nav: false, navOrder: 11,
    seo: { title: `Terms of Service — ${name}` },
    sections: [{ type: 'richtext', heading: 'Terms of Service', body: `By using ${name} you agree to these terms. This is a starter document — edit it in the Website Center.` }] };

  // Extra custom pages declared by the template's cms_structure (reuse the manifest structure).
  const known = new Set(['home', 'about', 'contact', 'blog', 'help', 'privacy', 'terms', 'menu', 'offers']);
  const customPages: WebsitePage[] = cmsPages.filter(p => !known.has(p)).map((p, i) => ({
    id: `p_${p}`, path: `/${p}`, kind: 'custom' as const, title: p.charAt(0).toUpperCase() + p.slice(1), nav: true, navOrder: 5 + i,
    seo: { title: `${p} — ${name}` }, sections: [{ type: 'richtext', heading: p, body: `The ${p} page. Edit its content in the Website Center.` }],
  }));

  const posts: BlogPost[] = [
    { id: 'b_launch', slug: 'were-live', title: `${name} is live`, excerpt: 'We are excited to bring fast, reliable delivery to your city.', body: [{ type: 'richtext', body: `Today we launch ${name}, powered by HAAT NOW. Order in one tap and track in real time.` }], author: name, publishedAt: now(), tags: ['news'], seo: { title: `${name} is live` } },
    { id: 'b_tips', slug: 'delivery-tips', title: '5 tips for faster delivery', excerpt: 'Small things that get your order to you quicker.', body: [{ type: 'richtext', body: 'Keep your address precise, add a note for the captain, and order at off-peak times.' }], author: name, publishedAt: now(), tags: ['guide'], seo: { title: 'Delivery tips' } },
  ];

  return {
    tenantId: String(tenant.id), slug, siteName: name,
    status: 'published', maintenance: false,
    navigation: [home, about, blog, help, contact, ...customPages].filter(p => p.nav).sort((a, b) => a.navOrder - b.navOrder).map(p => ({ label: p.title, path: p.path })),
    footer: {
      columns: [
        { title: 'Company', links: [{ label: 'About', path: '/about' }, { label: 'Blog', path: '/blog' }, { label: 'Contact', path: '/contact' }] },
        { title: 'Support', links: [{ label: 'Help Center', path: '/help' }] },
      ],
      social: [{ label: 'Twitter', href: '#' }, { label: 'Instagram', href: '#' }],
      legalLinks: [{ label: 'Privacy', path: '/privacy' }, { label: 'Terms', path: '/terms' }],
      copyright: `© ${new Date().getFullYear()} ${name}. All rights reserved.`,
    },
    pages: [home, about, blog, help, contact, privacy, terms, ...customPages],
    blog: posts,
    seoDefaults: { title: name, description: `${name}, powered by HAAT NOW.` },
    analytics: {}, cookie: { enabled: true, policyPath: '/privacy' },
    domain: `${slug}.haatnow.app`, sslStatus: 'active',
    updatedAt: now(),
  };
}

function ensureRecord(store: Store, tenant: any): Record_ {
  const id = String(tenant.id);
  if (!store[id]) {
    const site = defaultSite(tenant);
    store[id] = { draft: clone(site), published: clone(site), version: 1, history: [] };
  }
  return store[id];
}

export const websiteService = {
  isSandbox: SANDBOX,

  /** Published site for a tenant (by slug or id). Seeds a default site on first access. Read-only, fast.
   *  Falls back to a synthesized tenant when the slug isn't in the tenant store yet (demo robustness). */
  getPublishedSite(slugOrId: string): WebsiteSite | null {
    if (!slugOrId) return null;
    const tenant = resolveTenantBySlug(slugOrId) || resolveTenantById(slugOrId)
      || { id: `site-${slugOrId}`, slug: slugOrId, brand_name: slugOrId };
    const store = readStore();
    const rec = ensureRecord(store, tenant);
    writeStore(store); // persist seed
    return rec.published;
  },

  /** Draft site for editing / preview (by slug or id; synthesizes a tenant when unseeded). */
  getDraftSite(slugOrId: string): WebsiteSite | null {
    if (!slugOrId) return null;
    const tenant = resolveTenantBySlug(slugOrId) || resolveTenantById(slugOrId)
      || { id: `site-${slugOrId}`, slug: slugOrId, brand_name: slugOrId };
    const store = readStore(); const rec = ensureRecord(store, tenant); writeStore(store);
    return rec.draft;
  },

  /** Resolve a tenant by the site's custom domain / subdomain (host resolution priority 1). */
  resolveTenantByDomain(host: string): any | null {
    const h = (host || '').toLowerCase();
    for (const t of allTenants()) {
      const s = this.getPublishedSite(String(t.id));
      if (s && ((s.customDomain || '').toLowerCase() === h || (s.domain || '').toLowerCase() === h)) return t;
    }
    return null;
  },

  listSites(): { tenantId: string; slug: string; siteName: string; status: string }[] {
    return allTenants().map(t => { const s = this.getPublishedSite(String(t.id)); return s ? { tenantId: s.tenantId, slug: s.slug, siteName: s.siteName, status: s.status } : null; }).filter(Boolean) as any;
  },

  /** Persist a draft mutation (does NOT publish). */
  saveDraft(tenantId: string, patch: Partial<WebsiteSite>): void {
    const tenant = resolveTenantById(tenantId); if (!tenant) return;
    const store = readStore(); const rec = ensureRecord(store, tenant);
    rec.draft = { ...rec.draft, ...patch, updatedAt: now() };
    writeStore(store);
  },

  updatePage(tenantId: string, page: WebsitePage): void {
    const s = this.getDraftSite(tenantId); if (!s) return;
    const pages = s.pages.some(p => p.id === page.id) ? s.pages.map(p => (p.id === page.id ? page : p)) : [...s.pages, page];
    this.saveDraft(tenantId, { pages });
  },
  addPage(tenantId: string, title: string, path: string): WebsitePage | null {
    const s = this.getDraftSite(tenantId); if (!s) return null;
    const clean = '/' + String(path || title).toLowerCase().replace(/[^a-z0-9/]+/g, '-').replace(/^-+|-+$/g, '').replace(/^\/*/, '');
    const page: WebsitePage = { id: `p_${Date.now().toString(36)}`, path: clean || '/page', kind: 'custom', title: title || 'New page', nav: true, navOrder: 50, seo: { title }, sections: [{ type: 'richtext', heading: title, body: 'Edit this page in the Website Center.' }] };
    this.updatePage(tenantId, page);
    return page;
  },
  removePage(tenantId: string, pageId: string): void {
    const s = this.getDraftSite(tenantId); if (!s) return;
    this.saveDraft(tenantId, { pages: s.pages.filter(p => p.id !== pageId) });
  },
  upsertPost(tenantId: string, post: BlogPost): void {
    const s = this.getDraftSite(tenantId); if (!s) return;
    const blog = s.blog.some(b => b.id === post.id) ? s.blog.map(b => (b.id === post.id ? post : b)) : [post, ...s.blog];
    this.saveDraft(tenantId, { blog });
  },
  removePost(tenantId: string, postId: string): void {
    const s = this.getDraftSite(tenantId); if (!s) return;
    this.saveDraft(tenantId, { blog: s.blog.filter(b => b.id !== postId) });
  },
  setStatus(tenantId: string, status: WebsiteSite['status']): void { this.saveDraft(tenantId, { status }); this.publish(tenantId); },
  setMaintenance(tenantId: string, on: boolean): void { this.saveDraft(tenantId, { maintenance: on }); this.publish(tenantId); },

  /** Publish the draft → live. Immediate: bumps version, snapshots history, notifies the runtime. No rebuild. */
  publish(tenantId: string): void {
    const tenant = resolveTenantById(tenantId); if (!tenant) return;
    const store = readStore(); const rec = ensureRecord(store, tenant);
    rec.history.unshift({ version: rec.version, at: now(), site: rec.published });
    rec.history = rec.history.slice(0, 20);
    rec.version += 1;
    rec.published = clone({ ...rec.draft, updatedAt: now() });
    writeStore(store);
    emitChange(tenantId);
  },

  /** Rollback to a historical version. */
  rollback(tenantId: string, version: number): void {
    const tenant = resolveTenantById(tenantId); if (!tenant) return;
    const store = readStore(); const rec = ensureRecord(store, tenant);
    const h = rec.history.find(x => x.version === version); if (!h) return;
    rec.draft = clone(h.site); rec.published = clone(h.site); rec.version += 1;
    writeStore(store); emitChange(tenantId);
  },

  listVersions(tenantId: string): { version: number; at: string }[] {
    const tenant = resolveTenantById(tenantId); if (!tenant) return [];
    const rec = readStore()[String(tenant.id)];
    return rec ? rec.history.map(h => ({ version: h.version, at: h.at })) : [];
  },
};

// Dev hook (DEV only) — drive the runtime from the console / probes.
try { if (import.meta.env.DEV) (window as any).__site = websiteService; } catch { /* ignore */ }
