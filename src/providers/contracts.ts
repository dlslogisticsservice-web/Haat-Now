// ─────────────────────────────────────────────────────────────────────────────
// Provider contracts — the seams external vendors plug into.
//
// This file adds NO implementation and replaces NO service. It names the shape each
// capability must satisfy, so a real SMS/Maps/Push/Payment/Storage vendor can be added
// later by writing one adapter, with no architectural change at the call sites.
//
// THE RULE THAT MATTERS: a capability with no provider configured must FAIL LOUDLY.
// It must never return a synthetic success. A fake "sent" is worse than an error —
// an error gets fixed, while a fake success ships and is discovered by a customer who
// never got their OTP. `notConfigured()` below is the only sanctioned default.
//
// PURE types + one error class. No React, no DOM, no network.
// ─────────────────────────────────────────────────────────────────────────────

/** Every externally-provided capability the platform depends on. */
export type Capability =
  | 'auth' | 'location' | 'maps' | 'payment' | 'push' | 'inapp' | 'sms' | 'email' | 'storage' | 'analytics' | 'crash';

export type ProviderStatus =
  /** A real provider is wired and usable. */
  | 'active'
  /** The demo implementation is answering — sandbox only, never production. */
  | 'demo'
  /** No provider: calls fail loudly. This is the honest default. */
  | 'not-configured';

export interface ProviderInfo {
  capability: Capability;
  /** The implementation currently answering (e.g. 'supabase-otp', 'none'). */
  provider: string;
  status: ProviderStatus;
  /** Env keys this capability needs before it can go live. Names only — never values. */
  requires: string[];
  /** What is missing, in operator language. */
  detail: string;
}

/** Thrown by every unconfigured capability. Carries what the operator must set. */
export class ProviderNotConfiguredError extends Error {
  readonly capability: Capability;
  readonly requires: string[];
  constructor(capability: Capability, requires: string[]) {
    super(`No ${capability} provider is configured. Set ${requires.join(', ') || 'the provider env vars'} and register an adapter in src/providers/registry.ts.`);
    this.name = 'ProviderNotConfiguredError';
    this.capability = capability;
    this.requires = requires;
  }
}

/** Build a rejecting stub for a capability that has no provider yet. */
export const notConfigured = (capability: Capability, requires: string[]) => (): never => {
  throw new ProviderNotConfiguredError(capability, requires);
};

// ── Auth ─────────────────────────────────────────────────────────────────────
export type AuthMethod = 'sms-otp' | 'google' | 'apple' | 'email';

/**
 * Identity. `authService` already satisfies this (sandbox demo OTP vs real Supabase
 * phone OTP), so the contract is a description of today, not a rewrite of it. Adding
 * Google/Apple/Email later means adding methods to an adapter, not touching callers.
 */
export interface AuthProvider {
  readonly id: string;
  /** Methods this provider can actually perform right now. */
  readonly methods: readonly AuthMethod[];
  sendOtp(phoneNumber: string): Promise<{ error: unknown }>;
  verifyOtp(phoneNumber: string, token: string): Promise<{ data: { user: unknown | null }; error: unknown }>;
  getCurrentUser(): Promise<unknown | null>;
  getAccessToken(): Promise<string>;
  signOut(): Promise<{ error: unknown }>;
  /** Federated sign-in. Absent until a provider implements it. */
  signInWith?(method: Exclude<AuthMethod, 'sms-otp'>): Promise<{ error: unknown }>;
}

// ── Location ─────────────────────────────────────────────────────────────────
export interface Coordinates { lat: number; lng: number; accuracyM?: number }

/**
 * WHERE coordinates come from. Note the split: location.service.ts already owns the
 * pure math (distance, ETA) and stays untouched — this port is only the SOURCE, which
 * is currently `navigator.geolocation` called directly from features.
 */
export interface LocationProvider {
  readonly id: string;
  /** One-shot fix. Resolves null when the user denies or no fix is available. */
  current(): Promise<Coordinates | null>;
  /** Continuous fixes. Returns an unsubscribe. */
  watch(onFix: (c: Coordinates) => void, onError?: (e: unknown) => void): () => void;
  /** Address → coordinates. Absent until a geocoding provider is wired. */
  geocode?(address: string): Promise<Coordinates | null>;
  /** Coordinates → address. Absent until a geocoding provider is wired. */
  reverseGeocode?(c: Coordinates): Promise<string | null>;
}

// ── Maps (geocoding + routing vendor) ────────────────────────────────────────
//
// DISTINCT from LocationProvider: LocationProvider is the DEVICE source of coordinates
// (browser geolocation, no key). MapsProvider is the VENDOR that turns addresses into
// coordinates and draws routes (Google/Mapbox/…), which needs a key. Keeping them
// separate is why "location" can be active while "maps" is not-configured.
export interface RouteStep { lat: number; lng: number }
export interface RouteResult { distanceKm: number; etaMinutes: number; polyline?: RouteStep[] }

export interface MapsProvider {
  readonly id: string;
  /** Address → coordinates. */
  geocode(address: string): Promise<Coordinates | null>;
  /** Coordinates → address. */
  reverseGeocode(c: Coordinates): Promise<string | null>;
  /** A driving route between two points. */
  route(from: Coordinates, to: Coordinates): Promise<RouteResult | null>;
}

// ── Payment ──────────────────────────────────────────────────────────────────
export interface PaymentRequest { orderId: string; customerId: string; amount: number; currency: string }
export interface PaymentResult { ok: boolean; data: unknown }

/**
 * paymentOrchestrator already satisfies this. Gateway secrets stay server-side (the
 * client calls an edge function), so a new gateway is added behind that function —
 * this contract is what the CLIENT is allowed to know about payments.
 */
export interface PaymentProvider {
  readonly id: string;
  /** Hosted-gateway checkout. */
  initiate(req: PaymentRequest): Promise<PaymentResult>;
  /** Cash on delivery — no gateway, no secret. */
  recordCod(req: PaymentRequest): Promise<PaymentResult>;
}

// ── Messaging ────────────────────────────────────────────────────────────────
export interface MessageResult { ok: boolean; id?: string; error?: unknown }

/** Device push. Tokens are already stored by notificationService; nothing sends yet. */
export interface PushProvider {
  readonly id: string;
  send(token: string, title: string, body: string, data?: Record<string, unknown>): Promise<MessageResult>;
}
export interface SmsProvider {
  readonly id: string;
  send(toE164: string, message: string): Promise<MessageResult>;
}
export interface EmailProvider {
  readonly id: string;
  send(to: string, subject: string, body: string): Promise<MessageResult>;
}
/** In-app is already real (notificationService → repository). */
export interface InAppProvider {
  readonly id: string;
  send(userId: string | null, message: string, type?: string): Promise<{ error: unknown }>;
}

// ── Storage ──────────────────────────────────────────────────────────────────
/**
 * Object storage. Deliberately NARROW: only the vendor-facing operations.
 *
 * Uploads are NOT here. storageService owns an asset-typed API
 * (uploadProductImage(productId, file), uploadMerchantLogo(merchantId, file), …) where
 * each method owns its path convention. A generic `upload(bucket, path, file)` on this
 * port would invite callers to invent their own paths, duplicating that convention in
 * every feature. A future vendor swap happens INSIDE storageService, behind those
 * methods — which is exactly the seam this sprint is meant to protect.
 */
export interface StorageProvider {
  readonly id: string;
  publicUrl(bucket: string, path: string): string;
  remove(bucket: string, path: string): Promise<{ error: unknown }>;
}

// ── Analytics / crash ────────────────────────────────────────────────────────
export interface AnalyticsProvider {
  readonly id: string;
  track(event: string, props?: Record<string, unknown>): void;
  captureError(error: unknown, context?: Record<string, unknown>): void;
}
