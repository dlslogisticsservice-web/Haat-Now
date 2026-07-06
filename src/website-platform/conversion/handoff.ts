// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Commerce hand-off (Launch Sprint 2, Part 7).
// Transfers the full website commerce context into the mobile app with ZERO
// information loss: cart, coupon, merchant, products, modifiers, address, payment,
// session, campaign, referral, UTM and locale. Reuses the Wave 2 deep-link + resume
// token (integrity-checked, isomorphic) — no new transport, no duplicated logic.
// ─────────────────────────────────────────────────────────────────────────────

import type { JsonValue } from '../domain/entities';
import {
  buildResumeToken, parseResumeToken, resolveDeferredLink,
  type ResumePayload, type StoreLinks, type MobilePlatform, type DeferredLinkResult,
} from './deeplink';

/** One cart line, carried losslessly (product + variant + modifiers + qty + price). */
export interface HandoffCartItem {
  productId: string;
  name?: string;
  quantity: number;
  unitPrice?: number;
  variantId?: string | null;
  modifiers?: string[];      // selected modifier/add-on ids
  notes?: string;
}

export interface HandoffAddress {
  id?: string;
  label?: string;
  text?: string;
  lat?: number;
  lng?: number;
}

export interface HandoffUtm {
  source?: string; medium?: string; campaign?: string; term?: string; content?: string;
}

/** The complete website→app commerce context. Every field is optional so a hand-off can
 *  carry as much or as little as the moment has (e.g. just a merchant, or a full cart). */
export interface CommerceHandoff {
  merchantId?: string;
  branchId?: string;
  cart?: HandoffCartItem[];
  couponCode?: string;
  address?: HandoffAddress;
  paymentMethodId?: string;
  sessionToken?: string;      // authenticated session continuity
  campaign?: string;
  referral?: string;
  utm?: HandoffUtm;
  locale?: string;
}

const HANDOFF_INTENT = 'commerce.handoff';

/** Wrap a hand-off into a resume payload (integrity-checked when tokenised). */
export function buildCommerceHandoff(handoff: CommerceHandoff, nowMs: number): ResumePayload {
  return { intent: HANDOFF_INTENT, issuedAt: nowMs, handoff: handoff as unknown as JsonValue };
}

/** Encode a hand-off → URL-safe, tamper-evident token. */
export function encodeCommerceHandoff(handoff: CommerceHandoff, nowMs: number): string {
  return buildResumeToken(buildCommerceHandoff(handoff, nowMs));
}

/** Decode + verify a hand-off token. Returns null if tampered, malformed, or wrong intent. */
export function decodeCommerceHandoff(token: string): CommerceHandoff | null {
  const payload = parseResumeToken(token);
  if (!payload || payload.intent !== HANDOFF_INTENT) return null;
  const h = (payload as { handoff?: unknown }).handoff;
  return (h && typeof h === 'object') ? (h as CommerceHandoff) : null;
}

/** Build the deferred deep link (app-first, store fallback) carrying the full hand-off. */
export function buildCommerceHandoffLink(input: {
  scheme: string;              // app URL scheme, e.g. 'haatnow'
  deepPath?: string;           // e.g. 'checkout' | 'restaurant'
  storeLinks: StoreLinks;
  platform: MobilePlatform;
  handoff: CommerceHandoff;
  nowMs: number;
}): DeferredLinkResult {
  return resolveDeferredLink({
    scheme: input.scheme,
    deepPath: input.deepPath ?? 'checkout',
    storeLinks: input.storeLinks,
    platform: input.platform,
    resume: buildCommerceHandoff(input.handoff, input.nowMs),
  });
}

/** Read UTM/referral/campaign from a URL query string (isomorphic; no globals). */
export function readAttributionFromQuery(search: string): { utm: HandoffUtm; campaign?: string; referral?: string } {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const utm: HandoffUtm = {
    source: p.get('utm_source') ?? undefined,
    medium: p.get('utm_medium') ?? undefined,
    campaign: p.get('utm_campaign') ?? undefined,
    term: p.get('utm_term') ?? undefined,
    content: p.get('utm_content') ?? undefined,
  };
  return { utm, campaign: p.get('campaign') ?? undefined, referral: p.get('ref') ?? p.get('referral') ?? undefined };
}
