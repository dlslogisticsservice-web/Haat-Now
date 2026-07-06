// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Marketing Platform (Wave 3, Part 8).
// Reusable marketing page builders (landing / campaign / referral / partner / city /
// restaurant collection / SEO collection / seasonal) that compose ordinary content
// blocks and persist via the services — so every page is editable later in Website
// Center. SEO-ready. Reusable by every tenant.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, Result } from '../shared/types';
import { ok, err, isOk } from '../shared/types';
import type { JsonObject } from '../domain/entities';
import type { BlockDef } from '../haat-site/site-definition';
import type { PlatformContext, OperationContext } from '../services/context';
import { createServices } from '../services/services';

export const MARKETING_KINDS = ['landing', 'campaign', 'referral', 'partner', 'city', 'restaurant_collection', 'seo_collection', 'seasonal'] as const;
export type MarketingPageKind = typeof MARKETING_KINDS[number];

export interface MarketingItem { title: string; body: string; href?: string; image?: string }

export interface MarketingPageSpec {
  kind: MarketingPageKind;
  slug: string;
  title: string;
  heading: string;
  subheading?: string;
  ctaLabel?: string;
  ctaHref?: string;
  items?: MarketingItem[];         // cards/collection entries
  couponCode?: string;             // campaign/referral
  city?: string;                   // city pages
  seo: { title: string; description: string };
}

/** Compose the content blocks for a marketing page kind (reuses the renderer's block types). */
export function buildMarketingBlocks(spec: MarketingPageSpec): BlockDef[] {
  const blocks: BlockDef[] = [
    { type: 'hero', props: { title: spec.heading, subtitle: spec.subheading ?? '', ...(spec.ctaLabel ? { cta: { label: spec.ctaLabel, href: spec.ctaHref ?? '/' } } : {}) } },
  ];
  if (spec.couponCode) {
    blocks.push({ type: 'cta', props: { title: `Use code ${spec.couponCode}`, subtitle: 'Limited-time offer.', button: { label: spec.ctaLabel ?? 'Claim offer', href: spec.ctaHref ?? '/' } } });
  }
  if (spec.items && spec.items.length > 0) {
    blocks.push({ type: 'cards', props: { heading: spec.city ? `In ${spec.city}` : 'Featured', items: spec.items.map(i => ({ title: i.title, body: i.body, image: i.image, href: i.href })) } });
  }
  if (spec.kind === 'referral') {
    blocks.push({ type: 'features', props: { heading: 'How it works', items: [{ title: 'Share', body: 'Send your referral link to a friend.' }, { title: 'They order', body: 'Your friend gets a discount on their first order.' }, { title: 'You earn', body: 'You get rewarded when they order.' }] } });
  }
  blocks.push({ type: 'cta', props: { title: 'Get the HaaT Now app', subtitle: 'Order in one tap. Track in real time.', button: { label: spec.ctaLabel ?? 'Get the app', href: spec.ctaHref ?? '/' } } });
  return blocks;
}

export interface MarketingPageResult { pageId: UUID; slug: string; kind: MarketingPageKind }

export class MarketingService {
  constructor(private readonly ctx: PlatformContext) {}

  /** Create a marketing page (persisted via the services → editable in Website Center). */
  async createPage(op: OperationContext, siteId: UUID, spec: MarketingPageSpec, position = 100): Promise<Result<MarketingPageResult>> {
    const services = createServices(this.ctx);
    const page = await services.pages.create(op, { tenantId: op.tenantId, siteId, slug: spec.slug, title: spec.title, locale: 'en', position });
    if (!isOk(page)) return err(page.error);
    const section = await services.sections.create(op, { tenantId: op.tenantId, siteId, pageId: page.value.id, scope: 'local', position: 0, settings: { marketingKind: spec.kind } as JsonObject });
    if (!isOk(section)) return err(section.error);
    const blocks = buildMarketingBlocks(spec);
    for (const [i, block] of blocks.entries()) {
      const b = await services.blocks.create(op, { tenantId: op.tenantId, siteId, sectionId: section.value.id, type: block.type, props: block.props, position: i });
      if (!isOk(b)) return err(b.error);
    }
    await services.seo.create(op, { tenantId: op.tenantId, pageId: page.value.id, locale: 'en', metaTitle: spec.seo.title, metaDescription: spec.seo.description });
    return ok({ pageId: page.value.id, slug: spec.slug, kind: spec.kind });
  }
}

export function createMarketingService(ctx: PlatformContext): MarketingService {
  return new MarketingService(ctx);
}
