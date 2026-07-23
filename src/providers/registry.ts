// ─────────────────────────────────────────────────────────────────────────────
// Provider registry — the ONE place a real vendor gets plugged in.
//
// Every adapter here DELEGATES to the service that already owns the behaviour
// (authService, paymentOrchestrator, storageService, notificationService, monitoring).
// Nothing is reimplemented and no state is duplicated: the registry decides WHICH
// implementation answers, not WHAT it does.
//
// Capabilities with no vendor (push, sms, email, geocoding) resolve to an adapter that
// throws ProviderNotConfiguredError. That is deliberate. A silent no-op would let an
// unsent OTP look like a sent one, and this codebase has already been bitten by
// "absence read as success" (see scripts/check-demo-isolation.cjs).
//
// TO GO LIVE: set the env keys listed in `capabilities()` and replace the null adapter
// with a real one — no call site changes.
// ─────────────────────────────────────────────────────────────────────────────
import { IS_SANDBOX } from '../config/runtime';
import { authService } from '../services/auth.service';
import { paymentOrchestrator } from '../services/payment-orchestrator.service';
import { storageService } from '../services/storage.service';
import { notificationService } from '../services/notification.service';
import { monitoring } from '../services/monitoring.service';
import type {
  AnalyticsProvider, AuthProvider, Capability, Coordinates, EmailProvider, InAppProvider,
  LocationProvider, MapsProvider, PaymentProvider, ProviderInfo, PushProvider, SmsProvider, StorageProvider,
} from './contracts';
import { ProviderNotConfiguredError } from './contracts';

const env = (k: string): string | undefined => {
  const v = (import.meta.env as Record<string, unknown> | undefined)?.[k];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
};

/**
 * The SMS vendor Supabase uses to deliver OTP, declared by NAME (e.g. 'twilio'). This is
 * NOT a secret — the vendor's auth token lives server-side in the Supabase project, never
 * in the client bundle. The name lets Guardian report which provider is wired and lets a
 * future vendor swap happen by changing config, not code (no hardcoded vendor logic).
 */
export const declaredSmsVendor = (): string | undefined => env('VITE_SMS_PROVIDER');

/**
 * The maps/geocoding vendor, declared by NAME (e.g. 'google', 'mapbox'). Any secret key
 * stays server-side (geocoding runs behind an edge function), so no vendor secret enters
 * the client bundle. Naming — not hardcoding — the vendor keeps geocoding provider-driven
 * and lets a future swap be a config change, not a code change.
 */
export const declaredMapsVendor = (): string | undefined => env('VITE_MAPS_PROVIDER');

/**
 * The push vendor, declared by NAME (e.g. 'fcm', 'apns', 'onesignal'). The provider
 * secret (server key) stays server-side — push fan-out runs in an edge function, never
 * from the client. Naming the vendor keeps push provider-driven and future-swappable.
 */
export const declaredPushVendor = (): string | undefined => env('VITE_PUSH_PROVIDER');

/**
 * The card gateway, declared by NAME (e.g. 'moyasar', 'paymob'). The gateway secret NEVER
 * enters the client — charges run through the payment-initiate edge function. Naming the
 * gateway keeps it provider-driven and lets a swap be config, not code. COD is always
 * available and needs no gateway, so its absence only disables card payment, not checkout.
 */
export const declaredPaymentGateway = (): string | undefined => env('VITE_PAYMENT_PROVIDER');

/**
 * The transactional-email vendor, declared by NAME (e.g. 'resend', 'sendgrid', 'ses',
 * 'mailgun'). The API key / SMTP secret NEVER enters the client — email is sent from a
 * server-side function. Naming the vendor keeps email provider-driven and swappable.
 */
export const declaredEmailVendor = (): string | undefined => env('VITE_EMAIL_PROVIDER');

/** Env keys each capability needs before it can go live. NAMES ONLY — never values. */
export const REQUIRED_ENV: Record<Capability, string[]> = {
  // Real phone OTP needs the backend AND a declared SMS vendor — reachable Supabase alone
  // cannot deliver an SMS, so auth is not "active" until the vendor is named.
  auth: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SMS_PROVIDER'],
  location: [],                                   // browser geolocation needs no key
  maps: ['VITE_MAPS_PROVIDER'],                   // geocoding/routing vendor; secret stays server-side
  inapp: [],                                      // in-app notifications need no external vendor
  // Card gateway needs the backend AND a declared gateway vendor. Reachable Supabase alone
  // cannot charge a card, so payment is not "active" until the gateway is named. COD works
  // regardless — a missing gateway means COD-only, not a broken checkout.
  payment: ['VITE_SUPABASE_URL', 'VITE_PAYMENT_PROVIDER'],
  push: ['VITE_PUSH_PROVIDER'],                   // push vendor name; server key stays server-side
  sms: ['VITE_SMS_PROVIDER'],                     // SMS vendor name; secret stays server-side (never a client key)
  email: ['VITE_EMAIL_PROVIDER'],                 // email vendor name; API key stays server-side
  storage: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
  analytics: ['VITE_ANALYTICS_URL'],
  crash: ['VITE_SENTRY_DSN'],
};

const hasEnv = (c: Capability): boolean => REQUIRED_ENV[c].every(k => !!env(k));

// ── Auth ─────────────────────────────────────────────────────────────────────
// authService already branches sandbox↔supabase; the adapter exposes it as a contract.
export const authProvider: AuthProvider = {
  id: IS_SANDBOX ? 'sandbox-otp' : 'supabase-otp',
  methods: ['sms-otp'],   // google/apple/email are contracted but not implemented
  sendOtp: (p) => authService.sendOtp(p),
  verifyOtp: (p, t) => authService.verifyOtp(p, t),
  getCurrentUser: () => authService.getCurrentUser(),
  getAccessToken: () => authService.getAccessToken(),
  signOut: () => authService.signOut(),
  // signInWith is intentionally absent — a caller must not be able to "try" Google and
  // silently get nothing. Its absence is the honest signal that it is not built.
};

// ── Location ─────────────────────────────────────────────────────────────────
// The SOURCE of coordinates. location.service.ts keeps owning the maths.
export const locationProvider: LocationProvider = {
  id: 'browser-geolocation',
  current: () => new Promise<Coordinates | null>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }),
      () => resolve(null),                       // denied/unavailable is null, never a fake fix
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }),
  watch: (onFix, onError) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return () => {};
    const id = navigator.geolocation.watchPosition(
      p => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }),
      e => onError?.(e),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  },
  // geocode/reverseGeocode are absent until a Maps provider is wired.
};

// ── Payment ──────────────────────────────────────────────────────────────────
export const paymentProvider: PaymentProvider = {
  id: 'edge-function',                            // gateway chosen server-side
  initiate: (req) => paymentOrchestrator.initiate(req),
  recordCod: (req) => paymentOrchestrator.recordCod(req),
};

// ── Messaging ────────────────────────────────────────────────────────────────
export const inAppProvider: InAppProvider = {
  id: 'haat-inapp',
  send: (userId, message, type) => notificationService.sendNotification(userId, message, type),
};

const rejecting = <T extends object>(capability: Capability, id: string): T =>
  new Proxy({ id } as T, {
    get(target, prop) {
      if (prop === 'id') return id;
      return () => { throw new ProviderNotConfiguredError(capability, REQUIRED_ENV[capability]); };
    },
  });

/** No vendor yet — these throw rather than pretend. Replace with a real adapter to go live. */
// Geocoding/routing has no client-side vendor wired (the secret + call belong server-side).
// Until a maps edge function exists, every method throws rather than fabricate a coordinate
// or a route. location.service still provides straight-line distance/ETA for estimates.
export const mapsProvider: MapsProvider = rejecting<MapsProvider>('maps', 'none');

export const pushProvider: PushProvider = rejecting<PushProvider>('push', 'none');
export const smsProvider: SmsProvider = rejecting<SmsProvider>('sms', 'none');
export const emailProvider: EmailProvider = rejecting<EmailProvider>('email', 'none');

// ── Storage ──────────────────────────────────────────────────────────────────
// Typed uploads stay on storageService (each owns its path convention) — see the
// StorageProvider contract for why this port is intentionally narrow.
export const storageProvider: StorageProvider = {
  id: 'supabase-storage',
  publicUrl: (bucket, path) => storageService.getPublicUrl(bucket as never, path),
  remove: (bucket, path) => storageService.deleteImage(bucket as never, path),
};

// ── Analytics / crash ────────────────────────────────────────────────────────
export const analyticsProvider: AnalyticsProvider = {
  id: monitoring.isAnalyticsEnabled() ? 'configured-collector' : 'console',
  track: (e, p) => monitoring.track(e, p),
  captureError: (e, c) => monitoring.captureError(e, c),
};

/**
 * What is actually wired, right now. This is the truth the ops workspace renders instead
 * of a hand-written claim, and it is derived from env + mode — never asserted.
 */
export function capabilities(): ProviderInfo[] {
  const info = (capability: Capability, provider: string, status: ProviderInfo['status'], detail: string): ProviderInfo =>
    ({ capability, provider, status, requires: REQUIRED_ENV[capability], detail });

  return [
    info('auth', authProvider.id, IS_SANDBOX ? 'demo' : hasEnv('auth') ? 'active' : 'not-configured',
      IS_SANDBOX
        ? 'Demo OTP (123456) + fixed demo accounts — sandbox build only.'
        : hasEnv('auth')
          ? `Supabase phone OTP; OTP generated/sent/verified server-side, delivered via ${declaredSmsVendor()} (secret stays in Supabase).`
          : 'Supabase phone OTP, but no SMS vendor declared (VITE_SMS_PROVIDER) — the server cannot deliver an OTP yet.'),
    info('location', locationProvider.id, 'active',
      'Browser geolocation — the device coordinate source. Position source is live; this is distinct from the maps vendor below.'),
    info('maps', mapsProvider.id, IS_SANDBOX ? 'demo' : hasEnv('maps') ? 'active' : 'not-configured',
      IS_SANDBOX
        ? 'Demo build — geocoding/routing not required; the app uses stored branch coordinates.'
        : hasEnv('maps')
          ? `Maps vendor '${declaredMapsVendor()}' declared; geocoding/routing run via a server-side function (key stays server-side).`
          : 'No maps vendor declared (VITE_MAPS_PROVIDER) — geocoding/reverse-geocoding/routing are unavailable; any call throws.'),
    info('payment', paymentProvider.id, IS_SANDBOX ? 'demo' : hasEnv('payment') ? 'active' : 'not-configured',
      IS_SANDBOX
        ? 'Demo build — COD is wired end-to-end; no real gateway is charged.'
        : hasEnv('payment')
          ? `Card gateway '${declaredPaymentGateway()}' declared; charges run via the payment-initiate edge function (secret stays server-side). COD also available.`
          : 'COD is available and needs no gateway. No card gateway declared (VITE_PAYMENT_PROVIDER) — card payment is unavailable until one is wired.'),
    info('inapp', inAppProvider.id, 'active',
      'In-app notifications are live — stored and delivered via notification.service + realtime subscribe.'),
    info('push', pushProvider.id, IS_SANDBOX ? 'demo' : hasEnv('push') ? 'active' : 'not-configured',
      IS_SANDBOX
        ? 'Demo build — push not required; in-app notifications carry the demo.'
        : hasEnv('push')
          ? `Push vendor '${declaredPushVendor()}' declared; device tokens are stored, fan-out runs server-side (key stays server-side).`
          : 'Device tokens are stored, but no push vendor is declared (VITE_PUSH_PROVIDER) — nothing sends; any client call throws.'),
    info('sms', smsProvider.id, IS_SANDBOX ? 'demo' : hasEnv('sms') ? 'active' : 'not-configured',
      IS_SANDBOX
        ? 'Demo build — transactional SMS not required.'
        : hasEnv('sms')
          ? `SMS vendor '${declaredSmsVendor()}' declared; transactional SMS sends via a server-side function (secret stays server-side).`
          : 'No transactional SMS vendor declared (VITE_SMS_PROVIDER) — direct transactional SMS is unavailable; any client call throws.'),
    info('email', emailProvider.id, IS_SANDBOX ? 'demo' : hasEnv('email') ? 'active' : 'not-configured',
      IS_SANDBOX
        ? 'Demo build — transactional email not required; in-app/SMS carry the demo.'
        : hasEnv('email')
          ? `Email vendor '${declaredEmailVendor()}' declared; messages send via a server-side function (API key stays server-side).`
          : 'No transactional email vendor declared (VITE_EMAIL_PROVIDER) — email is unavailable; any client call throws.'),
    info('storage', storageProvider.id, hasEnv('storage') ? 'active' : 'not-configured', 'Supabase Storage buckets.'),
    info('analytics', analyticsProvider.id, hasEnv('analytics') ? 'active' : 'not-configured',
      hasEnv('analytics') ? 'Events POST to the configured collector.' : 'Console only — no collector configured.'),
    info('crash', monitoring.isCrashReportingEnabled() ? 'configured-dsn' : 'console', hasEnv('crash') ? 'active' : 'not-configured',
      hasEnv('crash') ? 'Crashes POST to the configured DSN.' : 'Console only — crashes are not durably reported.'),
  ];
}
