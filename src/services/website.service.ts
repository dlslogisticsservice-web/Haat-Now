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
export interface BlockVisibility { desktop?: boolean; tablet?: boolean; mobile?: boolean }
export interface WebsiteCta { label: string; href: string; style?: 'primary' | 'secondary' }
// Every section carries per-section controls: enable/disable + responsive visibility.
interface BlockBase { enabled?: boolean; visibility?: BlockVisibility }
// Marketplace card models (Featured Restaurants / Stores / Popular / Trending / Nearby).
export interface MerchantCard { name: string; emoji?: string; image?: string; cuisine?: string; rating?: number; reviews?: number; eta?: string; fee?: string; distance?: string; badge?: string; promo?: string; href?: string; closed?: boolean }
export interface DealCard { title: string; merchant?: string; emoji?: string; image?: string; discount?: string; code?: string; endsInMin?: number; href?: string }
export interface CategoryTile { label: string; emoji?: string; href: string; tint?: string }

export type WebsiteBlock = BlockBase & (
  | { type: 'hero'; title: string; subtitle?: string; cta?: { label: string; href: string }; ctas?: WebsiteCta[]; bgImage?: string; bgVideo?: string; overlay?: number; layout?: 'center' | 'left'; search?: boolean; searchPlaceholder?: string; searchAction?: string; chips?: WebsiteLink[] }
  | { type: 'richtext'; heading?: string; body: string }
  | { type: 'features'; heading?: string; items: { title: string; body: string; icon?: string }[] }
  | { type: 'cards'; heading?: string; items: { title: string; body: string; image?: string; href?: string }[] }
  | { type: 'stats'; heading?: string; items: { value: string; label: string }[] }
  | { type: 'testimonials'; heading?: string; items: { quote: string; author: string; role?: string; avatar?: string }[] }
  | { type: 'partners'; heading?: string; logos: string[] }
  | { type: 'cta'; title: string; subtitle?: string; button: { label: string; href: string } }
  | { type: 'gallery'; heading?: string; images: string[] }
  | { type: 'app_download'; heading: string; subtitle?: string; iosUrl?: string; androidUrl?: string; image?: string }
  | { type: 'faq'; heading?: string; items: { q: string; a: string }[] }
  | { type: 'contact'; heading?: string; email?: string; phone?: string; address?: string }
  // ── Marketplace blocks (Launch Sprint 1) ──
  | { type: 'categories'; heading?: string; subtitle?: string; items: CategoryTile[] }
  | { type: 'merchants'; heading?: string; subtitle?: string; layout?: 'grid' | 'rail'; viewAll?: WebsiteCta; items: MerchantCard[] }
  | { type: 'deals'; heading?: string; subtitle?: string; items: DealCard[] }
  | { type: 'steps'; heading?: string; subtitle?: string; items: { title: string; body: string; icon?: string }[] }
  // ── Pre-launch waitlist / Notify-me (client-only email capture; no backend) ──
  | { type: 'waitlist'; heading?: string; subtitle?: string; placeholder?: string; cta?: string; note?: string; badge?: string }
);
export type WebsiteBlockType = WebsiteBlock['type'];

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
  const rawName: string = tenant.site_name || tenant.brand_name || 'HAAT NOW';
  // Prettify slug-like names (e.g. "haat-now" → "HaaT Now") so every site shows a polished brand.
  let name = /^[a-z0-9][a-z0-9-_ ]*$/.test(rawName) && rawName === rawName.toLowerCase()
    ? rawName.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : rawName;
  if (name.toLowerCase() === 'haat now') name = 'HaaT Now';
  const slug: string = tenant.slug || 'site';
  const support = tenant.support_email || 'hello@haatnow.app';
  const phone: string = tenant.support_phone || '+966 11 000 0000';
  const cmsPages: string[] = Array.isArray(tenant?.cms_structure?.pages) ? tenant.cms_structure.pages : [];
  // The flagship HaaT Now site is the premium reference implementation (full marketplace
  // content). White-label tenants get the same premium shell without HaaT-specific merchants.
  const isFlagship = /haat/i.test(slug) || name.toUpperCase().includes('HAAT NOW');

  // ── Homepage (premium, marketplace-grade) ──
  const homeSections: WebsiteBlock[] = [
    { type: 'hero', layout: 'center', title: 'Your city’s food, groceries & pharmacy — delivered',
      subtitle: 'HaaT Now is a new local delivery service launching soon. Order in a few taps, pay cash at your door, and track every delivery live.',
      search: true, searchPlaceholder: 'Search for a restaurant, dish or store', searchAction: '/restaurants',
      chips: [{ label: '🍔 Restaurants', path: '/restaurants' }, { label: '🛒 Grocery', path: '/grocery' }, { label: '💊 Pharmacy', path: '/pharmacy' }, { label: '🔥 Offers', path: '/offers' }],
      ctas: [{ label: 'Order now', href: '/menu', style: 'primary' }, { label: 'Join the waitlist', href: '/waitlist', style: 'secondary' }] },
    { type: 'features', heading: 'Why HaaT Now?', items: [
      { title: 'Everything, one place', body: 'Restaurants, grocery and pharmacy from your neighbourhood — in a single app.', icon: '🧺' },
      { title: 'Fair for everyone', body: 'Honest pricing for customers, fair commissions for merchants, weekly payouts for captains.', icon: '⚖️' },
      { title: 'Pay cash, no account', body: 'Order as a guest and pay cash on delivery. Cards and wallet are coming soon.', icon: '💵' },
      { title: 'Live, transparent tracking', body: 'Follow your order end to end — no guessing where it is.', icon: '📍' },
    ] },
    { type: 'categories', heading: 'What are you craving?', subtitle: 'Explore the categories launching in your city', items: CATEGORY_TILES },
  ];
  if (isFlagship) {
    homeSections.push(
      { type: 'merchants', heading: 'A preview of what’s coming', subtitle: 'Sample partners — real merchants are onboarding now for launch', layout: 'rail', viewAll: { label: 'See the lineup', href: '/restaurants' }, items: FEATURED_RESTAURANTS },
      { type: 'merchants', heading: 'Grocery & pharmacy', subtitle: 'Preview — neighbourhood stores joining at launch', layout: 'rail', viewAll: { label: 'See the lineup', href: '/grocery' }, items: FEATURED_STORES },
      { type: 'deals', heading: '⚡ Launch offers (preview)', subtitle: 'Example deals — your first-order offer lands when we go live', items: FLASH_DEALS },
    );
  }
  homeSections.push(
    { type: 'steps', heading: 'How it works', subtitle: 'Three taps to your door', items: [
      { title: 'Browse & choose', body: 'Discover restaurants and stores near you, with clear ETAs and prices.', icon: '🔎' },
      { title: 'Order & pay cash', body: 'Check out as a guest and pay cash on delivery — no account or card needed.', icon: '🛍️' },
      { title: 'Track live', body: 'Follow your order in real time, right to your door.', icon: '🛵' },
    ] },
    { type: 'waitlist', badge: 'Launching soon', heading: 'Be among the first to order', subtitle: 'HaaT Now is launching in your city. Join the waitlist and we’ll email you the moment we go live — with a first-order offer.', placeholder: 'you@email.com', cta: 'Join the waitlist', note: 'No spam. One email when we launch.' },
    { type: 'cards', heading: 'Grow with us', items: [
      { title: 'Become a partner →', body: 'List your restaurant or store and reach new local customers from day one.', href: '/merchants' },
      { title: 'Drive & earn →', body: 'Flexible hours and weekly payouts. Deliver on your schedule.', href: '/drivers' },
      { title: 'Own a franchise →', body: 'Bring HaaT Now to your city with a full launch playbook.', href: '/franchise' },
    ] },
    { type: 'app_download', heading: 'The HaaT Now app is coming', subtitle: 'One-tap reordering, live tracking and launch-day offers — landing on iOS and Android soon. Join the waitlist to be first.' },
    { type: 'cta', title: 'Hungry to get started?', subtitle: 'Order now, or join the waitlist for launch updates.', button: { label: 'Start an order', href: '/menu' } },
  );

  const home: WebsitePage = {
    id: 'p_home', path: '/', kind: 'landing', title: 'Home', nav: true, navOrder: 0,
    seo: { title: `${name} — Food, grocery & pharmacy delivery`, description: `Order food, groceries and pharmacy from the best local merchants with ${name}. Fast delivery, live tracking, great offers.` },
    sections: homeSections,
  };

  // ── Category / discovery pages (flagship) ──
  const categoryPage = (path: string, title: string, heading: string, sub: string, items: MerchantCard[], seoDesc: string): WebsitePage => ({
    id: `p_${path.replace(/\//g, '')}`, path, kind: 'custom', title, nav: true, navOrder: 1,
    seo: { title: `${title} — ${name}`, description: seoDesc },
    sections: [
      { type: 'hero', layout: 'left', title: heading, subtitle: sub, search: true, searchAction: path, searchPlaceholder: `Search ${title.toLowerCase()}` },
      { type: 'merchants', heading: `${title} — preview lineup`, subtitle: 'Sample partners shown while real merchants onboard for launch.', layout: 'grid', items },
      { type: 'cta', title: 'Want launch updates?', subtitle: 'Join the waitlist and we’ll tell you when HaaT Now goes live in your city.', button: { label: 'Join the waitlist', href: '/waitlist' } },
    ],
  });

  const restaurants = categoryPage('/restaurants', 'Restaurants', 'Order from the best restaurants', 'From street food to fine dining — delivered hot and fast.', [...FEATURED_RESTAURANTS, ...POPULAR, ...TRENDING], 'Browse and order from top-rated restaurants near you.');
  const grocery = categoryPage('/grocery', 'Grocery', 'Groceries in minutes', 'Fresh produce and daily essentials from local markets.', FEATURED_STORES.filter(s => s.cuisine !== 'Pharmacy'), 'Order groceries online with fast delivery near you.');
  const pharmacy = categoryPage('/pharmacy', 'Pharmacy', 'Pharmacy, delivered discreetly', 'Medicines, wellness and personal care to your door.', FEATURED_STORES.filter(s => s.cuisine === 'Pharmacy').concat(NEARBY.slice(0, 2)), 'Order pharmacy and wellness essentials with fast delivery.');
  const offers: WebsitePage = { id: 'p_offers', path: '/offers', kind: 'custom', title: 'Offers', nav: true, navOrder: 2,
    seo: { title: `Offers & deals — ${name}`, description: `Today's best food, grocery and pharmacy deals on ${name}.` },
    sections: [
      { type: 'hero', layout: 'left', title: 'Launch offers are on the way', subtitle: 'A preview of the deals coming to your city. Join the waitlist to unlock your first-order offer at launch.' },
      { type: 'deals', heading: '⚡ Launch offers (preview)', subtitle: 'Example deals — real offers activate when we go live', items: FLASH_DEALS },
      { type: 'waitlist', badge: 'Launching soon', heading: 'Get your first-order offer', subtitle: 'Join the waitlist and we’ll send your launch-day discount.', placeholder: 'you@email.com', cta: 'Join the waitlist', note: 'One email at launch. No spam.' },
    ] };

  // ── Marketing / partner pages (flagship) ──
  const merchants: WebsitePage = { id: 'p_merchants', path: '/merchants', kind: 'landing', title: 'For Merchants', nav: false, navOrder: 20,
    seo: { title: `Partner with ${name} — grow your business`, description: `List your restaurant or store on ${name} and reach thousands of new customers with zero setup cost.` },
    sections: [
      { type: 'hero', layout: 'left', title: 'Grow your business with ' + name, subtitle: 'Reach new customers, boost orders and manage everything from one dashboard.', ctas: [{ label: 'Become a partner', href: '/contact', style: 'primary' }, { label: 'Talk to sales', href: '/contact', style: 'secondary' }] },
      { type: 'stats', heading: 'Why merchants choose us', items: [{ value: '+30%', label: 'Avg order uplift' }, { value: '0', label: 'Setup fee' }, { value: '24/7', label: 'Partner support' }, { value: '48h', label: 'Go live time' }] },
      { type: 'features', heading: 'Everything you need to sell more', items: [
        { title: 'More customers', body: 'Get discovered by hungry customers actively searching nearby.', icon: '📈' },
        { title: 'Smart dashboard', body: 'Menus, offers, hours and live orders in one place.', icon: '🧑‍🍳' },
        { title: 'Fast payouts', body: 'Reliable weekly settlements with transparent reporting.', icon: '💳' },
        { title: 'Marketing built in', body: 'Run offers and flash deals to drive repeat orders.', icon: '🎯' },
      ] },
      { type: 'steps', heading: 'Live in 3 steps', items: [{ title: 'Sign up', body: 'Tell us about your business.', icon: '📝' }, { title: 'Add your menu', body: 'We help you onboard fast.', icon: '📋' }, { title: 'Start selling', body: 'Go live and receive orders.', icon: '🚀' }] },
      { type: 'faq', heading: 'Merchant FAQ', items: [{ q: 'How much does it cost?', a: 'No setup fee — a simple commission per completed order.' }, { q: 'How fast can I go live?', a: 'Most partners are live within 48 hours.' }, { q: 'Do I need my own drivers?', a: 'No — our captain network handles delivery for you.' }] },
      { type: 'cta', title: 'Ready to grow?', subtitle: 'Join thousands of merchants already on the platform.', button: { label: 'Become a partner', href: '/contact' } },
    ] };
  const drivers: WebsitePage = { id: 'p_drivers', path: '/drivers', kind: 'landing', title: 'Drive & Earn', nav: false, navOrder: 21,
    seo: { title: `Deliver with ${name} — flexible earnings`, description: `Earn on your own schedule as a ${name} captain. Weekly payouts, live navigation and full support.` },
    sections: [
      { type: 'hero', layout: 'left', title: 'Drive with ' + name + ', earn on your terms', subtitle: 'Flexible hours, weekly payouts and a smart captain app that guides every trip.', ctas: [{ label: 'Start earning', href: '/contact', style: 'primary' }] },
      { type: 'features', heading: 'Why drive with us', items: [
        { title: 'Flexible hours', body: 'Go online whenever it suits you.', icon: '⏰' },
        { title: 'Weekly payouts', body: 'Get paid reliably, every week.', icon: '💰' },
        { title: 'Smart routing', body: 'Live navigation and batched trips to earn more.', icon: '🗺️' },
        { title: 'Support that cares', body: 'Real help, day or night.', icon: '🤝' },
      ] },
      { type: 'steps', heading: 'Start in 3 steps', items: [{ title: 'Apply', body: 'Share your details and documents.', icon: '📝' }, { title: 'Get verified', body: 'Quick background and vehicle check.', icon: '✅' }, { title: 'Hit the road', body: 'Go online and start earning.', icon: '🛵' }] },
      { type: 'faq', heading: 'Captain FAQ', items: [{ q: 'What do I need?', a: 'A vehicle, a smartphone and valid documents.' }, { q: 'When do I get paid?', a: 'Earnings are settled weekly to your account.' }] },
      { type: 'cta', title: 'Your city needs captains', subtitle: 'Turn your free time into earnings.', button: { label: 'Start earning', href: '/contact' } },
    ] };
  const franchise: WebsitePage = { id: 'p_franchise', path: '/franchise', kind: 'landing', title: 'Franchise', nav: false, navOrder: 22,
    seo: { title: `Own a ${name} franchise`, description: `Bring ${name} to your city with a proven playbook, technology and operational support.` },
    sections: [
      { type: 'hero', layout: 'left', title: 'Bring ' + name + ' to your city', subtitle: 'A proven delivery platform, launch playbook and hands-on support — from day one.', ctas: [{ label: 'Request the deck', href: '/contact', style: 'primary' }] },
      { type: 'stats', heading: 'A model that scales', items: [{ value: '15+', label: 'Cities' }, { value: '90d', label: 'To launch' }, { value: 'Full', label: 'Tech stack' }, { value: '1:1', label: 'Launch support' }] },
      { type: 'features', heading: 'What you get', items: [
        { title: 'Turnkey platform', body: 'Customer app, merchant tools and dispatch — ready to run.', icon: '🧩' },
        { title: 'Launch playbook', body: 'Marketing, onboarding and ops, documented end to end.', icon: '📚' },
        { title: 'Local brand', body: 'Your brand, your city — powered by our technology.', icon: '🏙️' },
      ] },
      { type: 'faq', heading: 'Franchise FAQ', items: [{ q: 'What investment is required?', a: 'It varies by market — request the deck for details.' }, { q: 'Do I keep my brand?', a: 'Yes, franchise partners can run under their own local brand.' }] },
      { type: 'cta', title: 'Let’s build in your city', subtitle: 'Request the franchise deck and we’ll be in touch.', button: { label: 'Request the deck', href: '/contact' } },
    ] };
  const business: WebsitePage = { id: 'p_business', path: '/business', kind: 'landing', title: 'Business API', nav: false, navOrder: 23,
    seo: { title: `${name} Business API — delivery as a service`, description: `Integrate ${name} delivery into your product with a clean, well-documented API.` },
    sections: [
      { type: 'hero', layout: 'left', title: 'Delivery, by API', subtitle: 'Add on-demand delivery to your app with a clean REST API, webhooks and live tracking.', ctas: [{ label: 'Read the docs', href: '/contact', style: 'primary' }, { label: 'Get API keys', href: '/contact', style: 'secondary' }] },
      { type: 'features', heading: 'Built for developers', items: [
        { title: 'REST + webhooks', body: 'Create orders, get real-time status callbacks.', icon: '🔌' },
        { title: 'Live tracking', body: 'Driver location and ETA out of the box.', icon: '📡' },
        { title: 'Sandbox', body: 'Test end to end before you go live.', icon: '🧪' },
      ] },
      { type: 'cards', heading: 'Use cases', items: [
        { title: 'Marketplaces', body: 'Add delivery to your storefront checkout.' },
        { title: 'Retail chains', body: 'Fulfil online orders from every branch.' },
        { title: 'Enterprise ops', body: 'Automate B2B and internal logistics.' },
      ] },
      { type: 'cta', title: 'Start building', subtitle: 'Get sandbox keys and ship in days, not months.', button: { label: 'Get API keys', href: '/contact' } },
    ] };
  const enterprise: WebsitePage = { id: 'p_enterprise', path: '/enterprise', kind: 'landing', title: 'Enterprise', nav: false, navOrder: 24,
    seo: { title: `${name} for Enterprise`, description: `Enterprise-grade delivery, dispatch and analytics with SLAs, SSO and dedicated support.` },
    sections: [
      { type: 'hero', layout: 'left', title: 'Enterprise delivery, done right', subtitle: 'Scale, security and support for large operations — with SLAs and dedicated success.', ctas: [{ label: 'Contact sales', href: '/contact', style: 'primary' }] },
      { type: 'features', heading: 'Enterprise-ready', items: [
        { title: 'SSO & RBAC', body: 'Enterprise auth and granular permissions.', icon: '🔐' },
        { title: 'SLAs', body: '99.9% uptime with priority support.', icon: '📶' },
        { title: 'Analytics', body: 'Live operational dashboards and exports.', icon: '📊' },
        { title: 'Dedicated success', body: 'A named team for onboarding and growth.', icon: '🎧' },
      ] },
      { type: 'stats', heading: 'Trusted at scale', items: [{ value: '99.9%', label: 'Uptime SLA' }, { value: 'SOC-ready', label: 'Security' }, { value: '24/7', label: 'Support' }, { value: 'Global', label: 'Coverage' }] },
      { type: 'cta', title: 'Let’s talk scale', subtitle: 'Tell us your requirements and we’ll design a plan.', button: { label: 'Contact sales', href: '/contact' } },
    ] };
  const careers: WebsitePage = { id: 'p_careers', path: '/careers', kind: 'custom', title: 'Careers', nav: false, navOrder: 25,
    seo: { title: `Careers at ${name}`, description: `Join ${name} and help build the future of delivery.` },
    sections: [
      { type: 'hero', layout: 'left', title: 'Build the future of delivery', subtitle: 'We’re a team obsessed with speed, craft and customers. Come build with us.' },
      { type: 'richtext', heading: 'Life at ' + name, body: 'We move fast, care deeply about quality, and take ownership end to end. If that sounds like you, we’d love to talk.' },
      { type: 'cards', heading: 'Open roles', items: [
        { title: 'Senior Frontend Engineer', body: 'React · TypeScript · Design systems', href: '/contact' },
        { title: 'Operations Manager', body: 'City launches · Dispatch · Growth', href: '/contact' },
        { title: 'Product Designer', body: 'Mobile-first · Marketplace · UX', href: '/contact' },
      ] },
      { type: 'cta', title: 'Don’t see your role?', subtitle: 'We’re always meeting great people.', button: { label: 'Send your CV', href: '/contact' } },
    ] };

  const appPage: WebsitePage = { id: 'p_app', path: '/waitlist', kind: 'custom', title: 'Join the Waitlist', nav: false, navOrder: 26,
    seo: { title: `Join the ${name} waitlist`, description: `${name} is launching soon. Join the waitlist to be first to order and get a launch-day offer.` },
    sections: [
      { type: 'hero', layout: 'left', title: 'The HaaT Now app is on its way', subtitle: 'We’re putting the finishing touches on the iOS and Android apps. Join the waitlist and we’ll notify you the moment they’re live.' },
      { type: 'waitlist', badge: 'Launching soon', heading: 'Get notified at launch', subtitle: 'Be first to order — and get an exclusive first-order offer.', placeholder: 'you@email.com', cta: 'Notify me', note: 'We’ll only email you about the launch.' },
      { type: 'features', heading: 'What to expect', items: [
        { title: 'One-tap reorder', body: 'Your favourites, a tap away — once you’ve placed your first order.', icon: '🔁' },
        { title: 'Launch offers', body: 'Early members get first access to launch-day deals.', icon: '🎁' },
        { title: 'Live tracking', body: 'Watch your order arrive in real time.', icon: '📍' },
      ] },
    ] };

  // ── Evergreen pages (all tenants) ──
  const about: WebsitePage = { id: 'p_about', path: '/about', kind: 'about', title: 'About', nav: true, navOrder: 3,
    seo: { title: `About ${name}`, description: `${name} is a modern delivery platform connecting customers, merchants and captains.` },
    sections: [
      { type: 'hero', layout: 'left', title: 'About ' + name, subtitle: 'A modern delivery platform connecting customers, merchants and captains through one seamless experience.' },
      { type: 'features', heading: 'What we stand for', items: [
        { title: 'Speed', body: 'Fast, reliable delivery is the promise we intend to keep every day.', icon: '⚡' },
        { title: 'Fairness', body: 'A fair deal for customers, merchants and captains alike.', icon: '⚖️' },
        { title: 'Craft', body: 'A beautiful, effortless experience end to end.', icon: '✨' },
      ] },
      { type: 'richtext', heading: 'Where we are today', body: 'HaaT Now is pre-launch. We’re onboarding our first merchants and captains and preparing to go live city by city. We’d rather be transparent than show inflated numbers — so instead of vanity metrics, here’s our commitment: fast delivery, fair pricing and real support from day one.' },
      { type: 'cta', title: 'Want to be first?', subtitle: 'Join the waitlist and we’ll tell you when we launch in your city.', button: { label: 'Join the waitlist', href: '/waitlist' } },
    ] };
  const contact: WebsitePage = { id: 'p_contact', path: '/contact', kind: 'contact', title: 'Contact', nav: true, navOrder: 5,
    seo: { title: `Contact ${name}`, description: `Get in touch with ${name}.` },
    sections: [
      { type: 'hero', layout: 'left', title: 'Get in touch', subtitle: 'We’re here to help — reach out any time.' },
      { type: 'contact', heading: 'Contact us', email: support, phone, address: '' },
    ] };
  const blog: WebsitePage = { id: 'p_blog', path: '/blog', kind: 'blog_index', title: 'Blog', nav: true, navOrder: 4,
    seo: { title: `${name} Blog`, description: `News and updates from ${name}.` }, sections: [] };
  const help: WebsitePage = { id: 'p_help', path: '/help', kind: 'help_index', title: 'Help', nav: true, navOrder: 6,
    seo: { title: `${name} Help Center`, description: `Answers and support for ${name}.` },
    sections: [
      { type: 'hero', layout: 'left', title: 'Help Center', subtitle: `Answers to common questions — and how to reach the ${name} team.` },
      { type: 'faq', heading: 'Frequently asked questions', items: [
        { q: 'How fast is delivery?', a: 'Most orders arrive within 30 minutes.' },
        { q: 'How do I track my order?', a: 'Open your account and go to Orders to track in real time.' },
        { q: 'What payment methods are accepted?', a: 'At launch, cash on delivery — no account or card needed. Cards and wallet are coming soon.' },
        { q: 'How do I contact support?', a: `Email us at ${support} or open a support request from your account.` },
      ] },
      { type: 'cta', title: 'Still need help?', subtitle: 'Our team is happy to assist.', button: { label: 'Contact us', href: '/contact' } },
    ] };
  const privacy: WebsitePage = { id: 'p_privacy', path: '/privacy', kind: 'legal', title: 'Privacy Policy', nav: false, navOrder: 30,
    seo: { title: `Privacy Policy — ${name}`, noindex: false },
    sections: [
      { type: 'hero', layout: 'left', title: 'Privacy Policy', subtitle: 'How we collect, use and protect your data.' },
      { type: 'richtext', body: `${name} respects your privacy. We collect only the data needed to provide the service, protect it with industry-standard security, and never sell it. You can request access or deletion of your data at any time by contacting ${support}.` },
      { type: 'cta', title: 'Questions about your data?', subtitle: 'We’re here to help.', button: { label: 'Contact us', href: '/contact' } },
    ] };
  const terms: WebsitePage = { id: 'p_terms', path: '/terms', kind: 'legal', title: 'Terms of Service', nav: false, navOrder: 31,
    seo: { title: `Terms of Service — ${name}` },
    sections: [
      { type: 'hero', layout: 'left', title: 'Terms of Service', subtitle: `The terms that apply when you use ${name}.` },
      { type: 'richtext', body: `By using ${name} you agree to these terms. Orders are subject to merchant availability and delivery-area coverage. Prices, fees and offers may change. For the full agreement or any questions, contact ${support}.` },
      { type: 'cta', title: 'Questions about these terms?', subtitle: 'Get in touch any time.', button: { label: 'Contact us', href: '/contact' } },
    ] };

  // Extra custom pages declared by the template's cms_structure (reuse the manifest structure).
  // 'app' stays reserved so a tenant's cms_structure can never mint a `/app` website page — that path is
  // owned by the role application (see runtime.ts APP_ROUTE_PREFIX). 'waitlist' is the pre-launch page.
  const known = new Set(['home', 'about', 'contact', 'blog', 'help', 'privacy', 'terms', 'menu', 'offers', 'restaurants', 'grocery', 'pharmacy', 'merchants', 'drivers', 'franchise', 'business', 'enterprise', 'careers', 'app', 'waitlist']);
  const customPages: WebsitePage[] = cmsPages.filter(p => !known.has(p)).map((p, i) => ({
    id: `p_${p}`, path: `/${p}`, kind: 'custom' as const, title: p.charAt(0).toUpperCase() + p.slice(1), nav: true, navOrder: 40 + i,
    seo: { title: `${p} — ${name}` }, sections: [{ type: 'richtext', heading: p, body: `The ${p} page. Edit its content in the Website Center.` }],
  }));

  const flagshipPages: WebsitePage[] = isFlagship
    ? [restaurants, grocery, pharmacy, offers, merchants, drivers, franchise, business, enterprise, careers, appPage]
    : [appPage];

  const posts: BlogPost[] = [
    { id: 'b_launch', slug: 'were-live', title: `${name} is live`, excerpt: 'We are excited to bring fast, reliable delivery to your city.', body: [{ type: 'richtext', body: `Today we launch ${name}, powered by HAAT NOW. Order in one tap and track in real time.` }], author: name, publishedAt: now(), tags: ['news'], seo: { title: `${name} is live` } },
    { id: 'b_tips', slug: 'delivery-tips', title: '5 tips for faster delivery', excerpt: 'Small things that get your order to you quicker.', body: [{ type: 'richtext', body: 'Keep your address precise, add a note for the captain, and order at off-peak times.' }], author: name, publishedAt: now(), tags: ['guide'], seo: { title: 'Delivery tips' } },
  ];

  const allPages = [home, ...flagshipPages, about, blog, help, contact, privacy, terms, ...customPages];
  const partnerLinks = isFlagship
    ? [{ label: 'For Merchants', path: '/merchants' }, { label: 'Drive & Earn', path: '/drivers' }, { label: 'Franchise', path: '/franchise' }, { label: 'Business API', path: '/business' }, { label: 'Enterprise', path: '/enterprise' }]
    : [];

  return {
    tenantId: String(tenant.id), slug, siteName: name,
    status: 'published', maintenance: false,
    navigation: allPages.filter(p => p.nav).sort((a, b) => a.navOrder - b.navOrder).map(p => ({ label: p.title, path: p.path })),
    footer: {
      columns: [
        { title: 'Company', links: [{ label: 'About', path: '/about' }, { label: 'Careers', path: '/careers' }, { label: 'Blog', path: '/blog' }, { label: 'Contact', path: '/contact' }] },
        ...(partnerLinks.length ? [{ title: 'Partners', links: partnerLinks }] : []),
        { title: 'Support', links: [{ label: 'Help Center', path: '/help' }, { label: 'Offers', path: '/offers' }] },
      ],
      social: [{ label: 'Twitter', href: '#' }, { label: 'Instagram', href: '#' }, { label: 'TikTok', href: '#' }],
      legalLinks: [{ label: 'Privacy', path: '/privacy' }, { label: 'Terms', path: '/terms' }],
      copyright: `© ${new Date().getFullYear()} ${name}. All rights reserved.`,
    },
    pages: allPages,
    blog: posts,
    seoDefaults: { title: name, description: `${name} — fast food, grocery and pharmacy delivery.` },
    analytics: {}, cookie: { enabled: true, policyPath: '/privacy' },
    domain: `${slug}.haatnow.app`, sslStatus: 'active',
    updatedAt: now(),
  };
}

// ── Curated marketplace content for the flagship homepage (marketing showcase). ──
const CATEGORY_TILES: CategoryTile[] = [
  { label: 'Restaurants', emoji: '🍔', href: '/restaurants' },
  { label: 'Grocery', emoji: '🛒', href: '/grocery' },
  { label: 'Pharmacy', emoji: '💊', href: '/pharmacy' },
  { label: 'Coffee', emoji: '☕', href: '/restaurants?c=coffee' },
  { label: 'Sweets', emoji: '🍰', href: '/restaurants?c=sweets' },
  { label: 'Healthy', emoji: '🥗', href: '/restaurants?c=healthy' },
  { label: 'Flowers', emoji: '💐', href: '/offers' },
  { label: 'Parcels', emoji: '📦', href: '/offers' },
];
const FLASH_DEALS: DealCard[] = [
  { title: '50% off your first order', merchant: 'HaaT Kitchen', emoji: '🍔', discount: '-50%', code: 'HAAT50', endsInMin: 90, href: '/restaurants' },
  { title: 'Free delivery weekend', merchant: 'Fresh Market', emoji: '🛒', discount: 'Free delivery', endsInMin: 240, href: '/grocery' },
  { title: 'Buy 1 Get 1 pizza', merchant: 'Napoli Pizza', emoji: '🍕', discount: 'BOGO', code: 'PIZZABOGO', endsInMin: 45, href: '/restaurants' },
  { title: '20% off wellness', merchant: 'CarePlus Pharmacy', emoji: '💊', discount: '-20%', endsInMin: 600, href: '/pharmacy' },
];
const FEATURED_RESTAURANTS: MerchantCard[] = [
  { name: 'Napoli Pizza', emoji: '🍕', cuisine: 'Italian · Pizza', rating: 4.8, reviews: 1200, eta: '25–35 min', fee: 'Free delivery', promo: '-20%', href: '/restaurants' },
  { name: 'Burger House', emoji: '🍔', cuisine: 'American · Burgers', rating: 4.7, reviews: 980, eta: '20–30 min', fee: 'SAR 8', href: '/restaurants' },
  { name: 'Sushi Zen', emoji: '🍣', cuisine: 'Japanese · Sushi', rating: 4.9, reviews: 640, eta: '30–40 min', fee: 'SAR 10', badge: 'Top rated', href: '/restaurants' },
  { name: 'Shawarma King', emoji: '🌯', cuisine: 'Levantine · Grills', rating: 4.6, reviews: 2100, eta: '15–25 min', fee: 'Free delivery', promo: 'BOGO', href: '/restaurants' },
  { name: 'Green Bowl', emoji: '🥗', cuisine: 'Healthy · Salads', rating: 4.7, reviews: 420, eta: '20–30 min', fee: 'SAR 6', href: '/restaurants' },
  { name: 'Sweet Tooth', emoji: '🍰', cuisine: 'Desserts · Bakery', rating: 4.8, reviews: 760, eta: '25–35 min', fee: 'SAR 7', href: '/restaurants' },
];
const FEATURED_STORES: MerchantCard[] = [
  { name: 'Fresh Market', emoji: '🛒', cuisine: 'Grocery', rating: 4.6, reviews: 540, eta: '20–35 min', fee: 'Free delivery', href: '/grocery' },
  { name: 'Daily Greens', emoji: '🥬', cuisine: 'Grocery', rating: 4.7, reviews: 310, eta: '25–40 min', fee: 'SAR 9', promo: '-15%', href: '/grocery' },
  { name: 'CarePlus Pharmacy', emoji: '💊', cuisine: 'Pharmacy', rating: 4.8, reviews: 220, eta: '15–25 min', fee: 'SAR 5', href: '/pharmacy' },
  { name: 'Wellness Point', emoji: '🧴', cuisine: 'Pharmacy', rating: 4.5, reviews: 180, eta: '20–30 min', fee: 'Free delivery', href: '/pharmacy' },
];
const POPULAR: MerchantCard[] = [
  { name: 'Taco Fiesta', emoji: '🌮', cuisine: 'Mexican', rating: 4.6, reviews: 890, eta: '20–30 min', fee: 'SAR 8', href: '/restaurants' },
  { name: 'Noodle Bar', emoji: '🍜', cuisine: 'Asian · Noodles', rating: 4.7, reviews: 510, eta: '25–35 min', fee: 'Free delivery', href: '/restaurants' },
  { name: 'Grill Master', emoji: '🍖', cuisine: 'BBQ · Grills', rating: 4.5, reviews: 1300, eta: '30–45 min', fee: 'SAR 12', href: '/restaurants' },
  { name: 'Bean & Brew', emoji: '☕', cuisine: 'Coffee', rating: 4.8, reviews: 670, eta: '15–20 min', fee: 'SAR 5', promo: '-10%', href: '/restaurants' },
];
const TRENDING: MerchantCard[] = [
  { name: 'Poké Corner', emoji: '🍥', cuisine: 'Hawaiian · Poké', rating: 4.7, reviews: 240, eta: '25–35 min', fee: 'SAR 7', badge: 'New', href: '/restaurants' },
  { name: 'Falafel Street', emoji: '🧆', cuisine: 'Vegetarian', rating: 4.6, reviews: 430, eta: '15–25 min', fee: 'Free delivery', href: '/restaurants' },
  { name: 'Ice & Slice', emoji: '🍧', cuisine: 'Desserts', rating: 4.9, reviews: 150, eta: '20–30 min', fee: 'SAR 6', promo: '-25%', href: '/restaurants' },
  { name: 'Curry Leaf', emoji: '🍛', cuisine: 'Indian', rating: 4.7, reviews: 980, eta: '30–40 min', fee: 'SAR 10', href: '/restaurants' },
];
const NEARBY: MerchantCard[] = [
  { name: 'Corner Bakery', emoji: '🥐', cuisine: 'Bakery · 0.4 km', rating: 4.5, reviews: 120, eta: '10–20 min', fee: 'SAR 4', distance: '0.4 km', href: '/restaurants' },
  { name: 'Mini Mart', emoji: '🏪', cuisine: 'Convenience · 0.6 km', rating: 4.3, reviews: 90, eta: '10–15 min', fee: 'Free delivery', distance: '0.6 km', href: '/grocery' },
  { name: 'Juice Lab', emoji: '🧃', cuisine: 'Juices · 0.8 km', rating: 4.8, reviews: 210, eta: '15–20 min', fee: 'SAR 5', distance: '0.8 km', href: '/restaurants' },
  { name: 'Night Pharmacy', emoji: '💊', cuisine: 'Pharmacy · 1.1 km', rating: 4.6, reviews: 60, eta: '15–25 min', fee: 'SAR 6', distance: '1.1 km', closed: true, href: '/pharmacy' },
];

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
