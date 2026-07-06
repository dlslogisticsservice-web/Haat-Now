// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Smart Checkout Migration (Wave 3, Part 6).
// At a configurable checkout progress (default 50%), offer the customer a value-based
// choice: "Continue in App" (with coupon injection + deferred deep link that resumes
// checkout) or "Continue on Website". Never forces. Everything editable from Website
// Center. Reuses the deep-link module; reusable by every tenant.
// ─────────────────────────────────────────────────────────────────────────────

import { resolveDeferredLink, type StoreLinks, type MobilePlatform, type ResumePayload } from '../conversion/deeplink';

export interface CheckoutMigrationConfig {
  enabled: boolean;
  thresholdPct: number;            // default 50 — show at/after this checkout progress
  title: string;                   // e.g. "Continue in the app and get 10% OFF"
  body: string;
  continueInAppLabel: string;      // e.g. "Continue in App"
  continueOnWebsiteLabel: string;  // e.g. "Continue on Website"
  couponCode?: string;             // injected into the resumed checkout
  appScheme: string;               // e.g. 'haatnow'
  deepLinkPath: string;            // e.g. 'checkout'
  storeLinks: StoreLinks;
  imageUrl?: string;
  videoUrl?: string;
}

export function defaultCheckoutMigrationConfig(): CheckoutMigrationConfig {
  return {
    enabled: false,                // OFF by default (flag/admin enables)
    thresholdPct: 50,
    title: 'Continue in the app and get 10% OFF your next order.',
    body: 'Faster checkout, live tracking and app-only deals.',
    continueInAppLabel: 'Continue in App',
    continueOnWebsiteLabel: 'Continue on Website',
    couponCode: undefined,
    appScheme: 'haatnow',
    deepLinkPath: 'checkout',
    storeLinks: {},
  };
}

export interface CheckoutState {
  cartId?: string;
  cartValue: number;
  progressPct: number;             // 0..100
  itemCount?: number;
}

export interface MigrationOffer {
  eligible: boolean;
  title: string;
  body: string;
  imageUrl?: string;
  videoUrl?: string;
  couponCode?: string;
  /** "Continue in App" — resumes checkout in the app (coupon carried in the resume token). */
  continueInApp?: { label: string; deepLink: string; storeUrl: string | null; resumeToken: string | null };
  /** "Continue on Website" — always present; never force. */
  continueOnWebsite: { label: string };
}

/**
 * Build the migration offer for the current checkout. Eligible only at/after the
 * configured threshold. The resume payload carries the cart id + injected coupon so the
 * app resumes exactly where the customer left off, with the discount applied.
 */
export function buildCheckoutMigration(
  config: CheckoutMigrationConfig,
  checkout: CheckoutState,
  platform: MobilePlatform,
  nowMs: number,
): MigrationOffer {
  const eligible = config.enabled && checkout.progressPct >= config.thresholdPct;
  const base: MigrationOffer = {
    eligible,
    title: config.title,
    body: config.body,
    imageUrl: config.imageUrl,
    videoUrl: config.videoUrl,
    couponCode: config.couponCode,
    continueOnWebsite: { label: config.continueOnWebsiteLabel },
  };
  if (!eligible) return base;

  const resume: ResumePayload = {
    intent: 'checkout',
    issuedAt: nowMs,
    ...(checkout.cartId ? { cartId: checkout.cartId } : {}),
    ...(config.couponCode ? { coupon: config.couponCode } : {}),
    cartValue: checkout.cartValue,
  };
  const deferred = resolveDeferredLink({ scheme: config.appScheme, deepPath: config.deepLinkPath, storeLinks: config.storeLinks, platform, resume });
  return {
    ...base,
    continueInApp: { label: config.continueInAppLabel, deepLink: deferred.deepLink, storeUrl: deferred.storeUrl, resumeToken: deferred.resumeToken },
  };
}
