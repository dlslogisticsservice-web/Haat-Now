// ─────────────────────────────────────────────────────────────────────────────
// Website route resolution — PURE (zero service imports). Decides, from a Location,
// whether a request targets the public website, the role application, or the
// internal/staff console. Kept dependency-free so it is trivially testable and so
// importing it never drags the service graph. runtime.ts re-exports these.
// ─────────────────────────────────────────────────────────────────────────────

// Canonical app hosts: the flagship marketing website is served at `/` and the role app at
// `/app` on each of these. The production apex `haatnow.app` (+ www + .com) must be listed
// here — otherwise the apex is misclassified as a third-party custom-domain tenant lookup
// (slug=null → no tenant → "Site not found"). `/app` is unaffected either way because
// isAppRoute() short-circuits before host classification.
const APP_HOSTS = ['localhost', '127.0.0.1', 'haat-now.vercel.app', 'haatnow.app', 'www.haatnow.app', 'haatnow.com', 'www.haatnow.com'];
const RESERVED_SUB = new Set(['www', 'app', 'admin', 'api', 'haat-now', 'haatnow']);

/** The flagship tenant. Its marketing website is the CANONICAL public entry point at the app host `/`. */
export const FLAGSHIP_SLUG = 'haat-now';
/** Reserved route prefix that mounts the role APPLICATION (customer/merchant/driver/admin), never the website. */
export const APP_ROUTE_PREFIX = '/app';
// Dedicated INTERNAL login entry points. These mount the role application in "admin"
// gateway mode (staff roles only). They are NEVER linked from the public website, so
// customers never encounter them — but a staff member can navigate to them directly.
export const CONSOLE_ROUTES = ['/console', '/admin/login', '/admin', '/internal', '/internal/login'];

export type PublicVia = 'custom-domain' | 'subdomain' | 'param' | 'default' | 'none';
export interface PublicRequest { isPublicSite: boolean; slug: string | null; path: string; host: string; preview: boolean; via: PublicVia }

/** True when the path targets the role application (the `/app` route and anything nested under it). */
export function isAppRoute(path: string): boolean {
  return path === APP_ROUTE_PREFIX || path.startsWith(APP_ROUTE_PREFIX + '/');
}
/** True when the path is a dedicated internal/staff login entry (mounts the app, admin mode). */
export function isConsoleRoute(path: string): boolean {
  const p = (path || '').toLowerCase().replace(/\/+$/, '') || '/';
  return CONSOLE_ROUTES.some(r => p === r || p.startsWith(r + '/'));
}

/** Decide whether this request targets the public website (and which tenant) or the role application.
 *  RESOLUTION ORDER:
 *    0.  Application route — `/app[...]` always mounts the role app (never the website).
 *    0b. Internal console  — `/console`, `/admin/login`, … mount the app in admin mode (staff only).
 *    1.  Custom Domain     — any non-app host that is not a haatnow subdomain (→ resolve by stored domain)
 *    2.  Tenant Subdomain  — <slug>.haatnow.(app|com)
 *    3.  Dev query param   — `?site=<slug>` (dev override for viewing a specific tenant)
 *    4.  Default (app host) — the FLAGSHIP marketing website is the canonical public entry point at `/`.
 *  This is what makes the website the production root: `/` renders the website, `/app` renders the app. */
export function resolvePublicRequest(loc: Location): PublicRequest {
  const host = (loc.hostname || '').toLowerCase();
  const params = new URLSearchParams(loc.search);
  const path = params.get('path') || (loc.pathname && loc.pathname !== '/' ? loc.pathname : '/');
  const preview = params.get('preview') === '1';
  const base = { path, host, preview };
  const isAppHost = APP_HOSTS.includes(host) || host.endsWith('.vercel.app');
  const sub = host.match(/^([a-z0-9-]+)\.haatnow\.(app|com)$/i);

  // Priority 0 — Application route. The role app owns `/app`; it is never the public website.
  if (isAppRoute(path)) return { isPublicSite: false, slug: null, via: 'none', ...base };
  // Priority 0b — Internal/staff console entry (e.g. /console, /admin/login). Mounts the app
  // (in admin gateway mode) on the app host; never rendered as the public website.
  if (isAppHost && isConsoleRoute(path)) return { isPublicSite: false, slug: null, via: 'none', ...base };
  // Priority 1 — Custom domain.
  if (host && !isAppHost && !sub && host.includes('.')) return { isPublicSite: true, slug: null, via: 'custom-domain', ...base };
  // Priority 2 — Tenant subdomain.
  if (sub && !RESERVED_SUB.has(sub[1].toLowerCase())) return { isPublicSite: true, slug: sub[1].toLowerCase(), via: 'subdomain', ...base };
  // Priority 3 — Development query parameter (view a specific tenant by slug on an app host).
  const siteParam = params.get('site');
  if (siteParam) return { isPublicSite: true, slug: siteParam.toLowerCase(), via: 'param', ...base };
  // Priority 4 — Default. On the canonical app host, the flagship website is the public entry point.
  if (isAppHost) return { isPublicSite: true, slug: FLAGSHIP_SLUG, via: 'default', ...base };

  return { isPublicSite: false, slug: null, via: 'none', ...base };
}
