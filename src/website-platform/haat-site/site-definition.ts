// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Official HaaT Now website — content definition (Wave 2).
// The first PRODUCTION website built on the platform. Defined as ordinary content
// data (pages → blocks) so it is fully editable later from Website Center and 100%
// reusable by white-label tenants. A seeder persists it via the services; a compiler
// produces a SiteSnapshot directly (for rendering/SEO without a DB).
// ─────────────────────────────────────────────────────────────────────────────

import type { ISODateTime, Result, UUID } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import type { JsonObject } from '../domain/entities';
import type { CompiledPage, SiteSnapshot } from '../publishing/contracts';
import { contentHash } from '../snapshot/snapshot';
import type { PlatformContext, OperationContext } from '../services/context';
import { createServices } from '../services/services';

export interface BlockDef { type: string; props: JsonObject }
export interface PageDef {
  slug: string;
  title: string;
  blocks: BlockDef[];
  seo: { title: string; description: string };
}
export interface SiteDef { slug: string; name: string; defaultLocale: string; pages: PageDef[] }

const hero = (title: string, subtitle: string, cta = 'Get the app', href = '/'): BlockDef => ({ type: 'hero', props: { title, subtitle, cta: { label: cta, href } } });
const features = (heading: string, items: [string, string][]): BlockDef => ({ type: 'features', props: { heading, items: items.map(([t, b]) => ({ title: t, body: b })) } });
const cta = (title: string, subtitle: string, label: string, href: string): BlockDef => ({ type: 'cta', props: { title, subtitle, button: { label, href } } });
const rich = (heading: string, body: string): BlockDef => ({ type: 'richtext', props: { heading, body } });
const faqBlock = (items: [string, string][]): BlockDef => ({ type: 'faq', props: { heading: 'Frequently asked questions', items: items.map(([q, a]) => ({ q, a })) } });
const contact = (): BlockDef => ({ type: 'contact', props: { heading: 'Get in touch', email: 'hello@haatnow.app', phone: '' } });

/** The official HaaT Now website — 19 pages. */
export const HAAT_SITE: SiteDef = {
  slug: 'haatnow', name: 'HaaT Now', defaultLocale: 'en',
  pages: [
    { slug: 'home', title: 'HaaT Now — Everything delivered, fast', seo: { title: 'HaaT Now — Food, Grocery, Pharmacy & Parcels Delivered', description: 'Order food, groceries, pharmacy and parcels from local partners — delivered in ~30 minutes. Download the HaaT Now app.' }, blocks: [
      hero('Everything you need, delivered', 'Food, groceries, pharmacy and parcels from local partners — in ~30 minutes.', 'Order now', '/restaurants'),
      features('Why HaaT Now', [['Fast delivery', 'Most orders arrive in about 30 minutes.'], ['Trusted partners', 'Vetted merchants and captains you can rely on.'], ['One app', 'Food, market, pharmacy and parcels in one place.']]),
      cta('Ready to order?', 'Join thousands of happy customers today.', 'Get the app', '/'),
    ] },
    { slug: 'about', title: 'About HaaT Now', seo: { title: 'About HaaT Now', description: 'HaaT Now is a modern multi-category delivery platform connecting customers, merchants and captains through one seamless experience.' }, blocks: [
      rich('About HaaT Now', 'HaaT Now is a modern delivery marketplace. We connect customers, merchants and captains through one seamless experience across food, grocery, pharmacy and parcels.'),
      features('Our mission', [['Reliable', 'Delivery you can count on, every time.'], ['Local', 'We grow local merchants and create captain jobs.'], ['Simple', 'A clean, effortless ordering experience.']]),
    ] },
    { slug: 'services', title: 'Services', seo: { title: 'HaaT Now Services', description: 'Food delivery, grocery, pharmacy and parcel delivery — everything HaaT Now offers in one place.' }, blocks: [
      hero('One platform, every errand', 'Food, grocery, pharmacy and parcels — all in the HaaT Now app.'),
      features('What we deliver', [['Restaurants', 'Your favourite meals, fast.'], ['Grocery', 'Fresh groceries to your door.'], ['Pharmacy', 'Medicine and essentials, discreetly.'], ['Parcels', 'Send packages across the city.']]),
    ] },
    { slug: 'restaurants', title: 'Restaurant Delivery', seo: { title: 'Restaurant Delivery — HaaT Now', description: 'Order from the best local restaurants and get your meal delivered fast with HaaT Now.' }, blocks: [
      hero('Your favourite restaurants, delivered', 'Discover local restaurants and order in one tap.', 'Browse restaurants', '/restaurants'),
      features('Order with confidence', [['Live tracking', 'Follow your order in real time.'], ['Great prices', 'Deals and coupons every day.'], ['Fast', 'Hot food in ~30 minutes.']]),
    ] },
    { slug: 'grocery', title: 'Grocery Delivery', seo: { title: 'Grocery Delivery — HaaT Now', description: 'Fresh groceries and daily essentials delivered to your door with HaaT Now.' }, blocks: [
      hero('Groceries in minutes', 'Fresh produce and daily essentials, delivered.', 'Shop grocery', '/grocery'),
      features('Fresh & fast', [['Fresh picks', 'Hand-picked quality produce.'], ['Wide range', 'Thousands of everyday items.'], ['On demand', 'Delivered when you need it.']]),
    ] },
    { slug: 'pharmacy', title: 'Pharmacy Delivery', seo: { title: 'Pharmacy Delivery — HaaT Now', description: 'Medicine and health essentials delivered quickly and discreetly with HaaT Now.' }, blocks: [
      hero('Pharmacy, delivered discreetly', 'Medicine and health essentials to your door.', 'Order pharmacy', '/pharmacy'),
      features('Care you can trust', [['Discreet', 'Private, careful delivery.'], ['Licensed', 'Verified pharmacy partners.'], ['Quick', 'Essentials when you need them.']]),
    ] },
    { slug: 'parcel-delivery', title: 'Parcel Delivery', seo: { title: 'Parcel Delivery — HaaT Now', description: 'Send parcels across the city with HaaT Now captains — fast, tracked and affordable.' }, blocks: [
      hero('Send parcels across the city', 'Fast, tracked, affordable parcel delivery.', 'Send a parcel', '/parcel-delivery'),
      features('Delivery on your terms', [['Same-day', 'Across-city delivery in hours.'], ['Tracked', 'Real-time updates end to end.'], ['Affordable', 'Transparent, fair pricing.']]),
    ] },
    { slug: 'become-a-driver', title: 'Become a Driver', seo: { title: 'Become a HaaT Now Driver', description: 'Earn on your schedule as a HaaT Now captain. Flexible hours, weekly pay, and support.' }, blocks: [
      hero('Drive with HaaT Now', 'Earn on your own schedule. Flexible hours, weekly pay.', 'Apply now', '/become-a-driver'),
      features('Why drive with us', [['Flexible', 'Work whenever suits you.'], ['Weekly pay', 'Reliable, transparent earnings.'], ['Support', '24/7 captain support.']]),
      cta('Ready to earn?', 'Sign up as a captain in minutes.', 'Start your application', '/become-a-driver'),
    ] },
    { slug: 'become-a-merchant', title: 'Become a Merchant', seo: { title: 'Sell on HaaT Now — Become a Merchant', description: 'Grow your business with HaaT Now. Reach more customers with delivery, marketing and analytics.' }, blocks: [
      hero('Grow your business with HaaT Now', 'Reach more customers with delivery, marketing and analytics.', 'Partner with us', '/become-a-merchant'),
      features('Everything to grow', [['More orders', 'Reach new customers daily.'], ['Marketing', 'Promotions and campaigns built in.'], ['Insights', 'Real-time sales analytics.']]),
      cta('Start selling', 'Join HaaT Now and grow your revenue.', 'Become a merchant', '/become-a-merchant'),
    ] },
    { slug: 'franchise', title: 'Franchise', seo: { title: 'HaaT Now Franchise & White Label', description: 'Launch your own delivery brand with the HaaT Now white-label platform. Your brand, our technology.' }, blocks: [
      hero('Launch your own delivery brand', 'Your brand, our technology. Franchise & white-label opportunities.', 'Enquire now', '/franchise'),
      features('Why franchise HaaT Now', [['Proven platform', 'Battle-tested delivery technology.'], ['Your brand', 'Fully white-labelled experience.'], ['Fast launch', 'Go live in weeks, not months.']]),
    ] },
    { slug: 'pricing', title: 'Pricing', seo: { title: 'HaaT Now Pricing', description: 'Simple, transparent pricing for customers, merchants and franchise partners.' }, blocks: [
      hero('Simple, transparent pricing', 'No hidden fees. Clear pricing for everyone.'),
      features('For everyone', [['Customers', 'Pay only for what you order + a clear delivery fee.'], ['Merchants', 'Fair commission, no lock-in.'], ['Franchise', 'Custom plans for your market.']]),
    ] },
    { slug: 'faq', title: 'FAQ', seo: { title: 'HaaT Now FAQ', description: 'Answers to common questions about ordering, delivery, payments and support on HaaT Now.' }, blocks: [
      faqBlock([['How fast is delivery?', 'Most orders arrive within about 30 minutes.'], ['How do I track my order?', 'Open the app and go to Orders to track in real time.'], ['What can I order?', 'Food, groceries, pharmacy items and parcels.'], ['How do I contact support?', 'Email hello@haatnow.app or use in-app support.']]),
    ] },
    { slug: 'contact', title: 'Contact', seo: { title: 'Contact HaaT Now', description: 'Get in touch with the HaaT Now team for support, partnerships or press.' }, blocks: [contact()] },
    { slug: 'careers', title: 'Careers', seo: { title: 'Careers at HaaT Now', description: 'Join HaaT Now and help build the future of delivery. See open roles.' }, blocks: [
      hero('Build the future of delivery', 'Join a team obsessed with reliability and craft.'),
      features('Life at HaaT Now', [['Impact', 'Ship features used by thousands daily.'], ['Growth', 'Learn fast, own your work.'], ['People', 'A team that has your back.']]),
    ] },
    { slug: 'blog', title: 'Blog', seo: { title: 'HaaT Now Blog', description: 'News, product updates and stories from the HaaT Now team.' }, blocks: [rich('HaaT Now Blog', 'News, product updates and stories from the HaaT Now team. Articles are managed in Website Center.')] },
    { slug: 'help', title: 'Help Center', seo: { title: 'HaaT Now Help Center', description: 'Guides and answers for customers, merchants and captains.' }, blocks: [
      rich('Help Center', 'Find guides and answers for ordering, delivery, payments and account questions.'),
      faqBlock([['I need a refund', 'Open the order and tap Help to request a refund.'], ['My order is late', 'Track it live in the app; contact support if needed.']]),
    ] },
    { slug: 'privacy', title: 'Privacy Policy', seo: { title: 'Privacy Policy — HaaT Now', description: 'How HaaT Now collects, uses and protects your data.' }, blocks: [rich('Privacy Policy', 'HaaT Now respects your privacy. We collect only the data needed to provide the service and never sell it. Edit this policy in Website Center.')] },
    { slug: 'terms', title: 'Terms of Service', seo: { title: 'Terms of Service — HaaT Now', description: 'The terms and conditions that govern your access to and use of HaaT Now delivery services and apps.' }, blocks: [rich('Terms of Service', 'By using HaaT Now you agree to these terms. Edit this document in Website Center.')] },
    { slug: 'cookie-policy', title: 'Cookie Policy', seo: { title: 'Cookie Policy — HaaT Now', description: 'How HaaT Now uses cookies and how to manage your preferences.' }, blocks: [rich('Cookie Policy', 'HaaT Now uses essential and optional cookies. Manage your preferences via the cookie banner. Edit this policy in Website Center.')] },
  ],
};

// ── Direct snapshot compile (no DB) — for rendering / SEO / static generation ──────
export function compileHaatSnapshot(siteId: UUID, now: ISODateTime, locale = HAAT_SITE.defaultLocale): SiteSnapshot {
  const pages: CompiledPage[] = HAAT_SITE.pages.map(p => {
    const content: JsonObject = { pageId: p.slug, title: p.title, sections: [{ id: `sec_${p.slug}`, blocks: p.blocks.map((b, i) => ({ id: `blk_${p.slug}_${i}`, type: b.type, props: b.props })) }] };
    const seo: JsonObject = { title: p.seo.title, description: p.seo.description, robots: 'index,follow' };
    return { path: p.slug === 'home' ? '/' : `/${p.slug}`, locale, content, seo, html: null, etag: contentHash({ content, seo }) };
  });
  return { siteId, version: 1, scope: 'full', pages, theme: {}, compiledAt: now };
}

// ── Seeder — persists the definition via the services (editable later) ─────────────
export async function seedHaatSite(ctx: PlatformContext, op: OperationContext): Promise<Result<UUID>> {
  const services = createServices(ctx);
  const siteRes = await services.websites.create(op, { tenantId: op.tenantId, slug: HAAT_SITE.slug, name: HAAT_SITE.name, defaultLocale: HAAT_SITE.defaultLocale, locales: ['en', 'ar'], status: 'draft' });
  if (!isOk(siteRes)) return err(siteRes.error);
  const siteId = siteRes.value.id;

  for (const [i, page] of HAAT_SITE.pages.entries()) {
    const pageRes = await services.pages.create(op, { tenantId: op.tenantId, siteId, slug: page.slug, title: page.title, locale: HAAT_SITE.defaultLocale, position: i });
    if (!isOk(pageRes)) return err(pageRes.error);
    const pageId = pageRes.value.id;
    const sectionRes = await services.sections.create(op, { tenantId: op.tenantId, siteId, pageId, scope: 'local', position: 0 });
    if (!isOk(sectionRes)) return err(sectionRes.error);
    const sectionId = sectionRes.value.id;
    for (const [j, block] of page.blocks.entries()) {
      const blockRes = await services.blocks.create(op, { tenantId: op.tenantId, siteId, sectionId, type: block.type, props: block.props, position: j });
      if (!isOk(blockRes)) return err(blockRes.error);
    }
    await services.seo.create(op, { tenantId: op.tenantId, pageId, locale: HAAT_SITE.defaultLocale, metaTitle: page.seo.title, metaDescription: page.seo.description });
  }
  return ok(siteId);
}
