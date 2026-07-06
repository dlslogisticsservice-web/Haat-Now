// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Deep linking (Wave 2).
// Deferred deep linking for the App Conversion Engine: build app deep links + store
// fallbacks (Google Play / App Store / Huawei AppGallery), and a portable resume token
// that lets checkout resume inside the app after install. Pure + isomorphic (Node +
// browser); no native code. Reusable by every white-label tenant.
// ─────────────────────────────────────────────────────────────────────────────

import { contentHash } from '../snapshot/snapshot';
import type { JsonObject } from '../domain/entities';

export type MobilePlatform = 'android' | 'ios' | 'huawei' | 'unknown';

export interface StoreLinks {
  android?: string;   // Google Play URL
  ios?: string;       // App Store URL
  huawei?: string;    // Huawei AppGallery URL
}

/** Detect the mobile platform from a User-Agent (best-effort; huawei before android). */
export function detectMobilePlatform(userAgent: string): MobilePlatform {
  const ua = userAgent.toLowerCase();
  if (/huawei|honor|hms|harmonyos/.test(ua)) return 'huawei';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'unknown';
}

/** The right store URL for a platform, or null if not configured. */
export function storeUrl(platform: MobilePlatform, links: StoreLinks): string | null {
  if (platform === 'ios') return links.ios ?? null;
  if (platform === 'huawei') return links.huawei ?? links.android ?? null;
  if (platform === 'android') return links.android ?? null;
  return links.android ?? links.ios ?? null;
}

/** Build an app deep link URL: `<scheme>://<path>?<params>`. */
export function buildDeepLink(scheme: string, path: string, params: Readonly<Record<string, string>> = {}): string {
  const qs = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  const cleanPath = path.replace(/^\/+/, '');
  return `${scheme}://${cleanPath}${qs ? `?${qs}` : ''}`;
}

// ── Resume token (portable, integrity-checked; NOT encryption) ─────────────────────
export interface ResumePayload extends JsonObject {
  intent: string;        // e.g. 'checkout'
  issuedAt: number;
}

/** Encode a resume payload → URL-safe token with an integrity hash. Isomorphic. */
export function buildResumeToken(payload: ResumePayload): string {
  const body = encodeURIComponent(JSON.stringify(payload));
  const sig = contentHash(payload);
  return `${sig}.${body}`;
}

/** Decode + verify a resume token. Returns null if tampered/malformed. */
export function parseResumeToken(token: string): ResumePayload | null {
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const sig = token.slice(0, dot);
  const body = token.slice(dot + 1);
  try {
    const payload = JSON.parse(decodeURIComponent(body)) as ResumePayload;
    return contentHash(payload) === sig ? payload : null;
  } catch {
    return null;
  }
}

// ── Deferred deep-link resolution ──────────────────────────────────────────────────
export interface DeferredLinkInput {
  scheme: string;            // app URL scheme, e.g. 'haatnow'
  deepPath: string;          // e.g. 'checkout'
  storeLinks: StoreLinks;
  platform: MobilePlatform;
  resume?: ResumePayload;    // checkout state to carry across install
}

export interface DeferredLinkResult {
  /** Try this first (app installed → resumes in-app). */
  deepLink: string;
  /** Fallback when the app is NOT installed. */
  storeUrl: string | null;
  /** Token to persist (cookie/clipboard/deferred-link service) and read post-install. */
  resumeToken: string | null;
}

/**
 * Deferred deep linking: if the app is installed the deepLink resumes checkout in-app;
 * otherwise the client sends the user to the store, having stashed `resumeToken` so the
 * app can resume checkout on first open. The install-attribution/deferred-link service
 * (native) carries the token — this function produces both destinations + the token.
 */
export function resolveDeferredLink(input: DeferredLinkInput): DeferredLinkResult {
  const resumeToken = input.resume ? buildResumeToken(input.resume) : null;
  const deepLink = buildDeepLink(input.scheme, input.deepPath, resumeToken ? { resume: resumeToken } : {});
  return { deepLink, storeUrl: storeUrl(input.platform, input.storeLinks), resumeToken };
}
