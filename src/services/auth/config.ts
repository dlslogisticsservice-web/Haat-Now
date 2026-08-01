// ─────────────────────────────────────────────────────────────────────────────
// Authentication configuration — the active channel and feature flags, resolved
// from the environment (or runtime override) with NO code change required to switch.
//
//   VITE_AUTH_CHANNEL = email | phone            → the active OTP login channel
//   VITE_AUTH_FLAGS   = comma-list of enabled features, e.g. "email_otp,guest"
//                       (when unset, the DEFAULT_FEATURES below apply)
//
// Vite automatically exposes any VITE_-prefixed var on import.meta.env, so an
// operator flips channels/flags by setting env vars in Vercel — no rebuild of code.
// Guarded reads (import.meta.env → process.env) so it never throws under node/tsx.
// Defaults preserve the current shipped behavior exactly (email OTP active).
// ─────────────────────────────────────────────────────────────────────────────
import type { AuthChannel } from './types';

export type AuthFeature =
  | 'email_otp'
  | 'phone_otp'
  | 'google_oauth'
  | 'apple_oauth'
  | 'facebook_oauth'
  | 'guest';

const ALL_FEATURES: AuthFeature[] = ['email_otp', 'phone_otp', 'google_oauth', 'apple_oauth', 'facebook_oauth', 'guest'];
const KNOWN_CHANNELS: AuthChannel[] = ['email', 'phone'];

// Defaults chosen to match what ships today: email OTP active; Apple/Google entry
// points visible (still non-functional placeholders); phone/facebook/guest off.
const DEFAULT_FEATURES: Record<AuthFeature, boolean> = {
  email_otp: true,
  phone_otp: false,
  google_oauth: true,
  apple_oauth: true,
  facebook_oauth: false,
  guest: false,
};

type EnvBag = Record<string, string | undefined>;
const ENV: EnvBag =
  ((typeof import.meta !== 'undefined' && (import.meta as { env?: EnvBag }).env) as EnvBag) ||
  ((typeof process !== 'undefined' ? (process.env as EnvBag) : undefined)) ||
  {};

function resolveChannel(): AuthChannel {
  const raw = (ENV.VITE_AUTH_CHANNEL || '').trim().toLowerCase();
  return (KNOWN_CHANNELS as string[]).includes(raw) ? (raw as AuthChannel) : 'email';
}

function resolveFeatures(): Record<AuthFeature, boolean> {
  const raw = (ENV.VITE_AUTH_FLAGS || '').trim();
  if (!raw) return { ...DEFAULT_FEATURES };
  // An explicit flag list is authoritative: only listed features are enabled.
  const enabled = new Set(raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  return ALL_FEATURES.reduce((acc, f) => { acc[f] = enabled.has(f); return acc; }, {} as Record<AuthFeature, boolean>);
}

/**
 * Runtime auth configuration. Mutable ONLY via `configureAuth` (tests / runtime
 * config injection); production reads come from the environment at load time.
 */
export const authConfig: { activeChannel: AuthChannel; features: Record<AuthFeature, boolean> } = {
  activeChannel: resolveChannel(),
  features: resolveFeatures(),
};

/** Is an auth feature enabled? */
export const isFeatureEnabled = (feature: AuthFeature): boolean => authConfig.features[feature] === true;

/** The feature key that gates a given OTP channel. */
export const channelFeature = (channel: AuthChannel): AuthFeature => (channel === 'phone' ? 'phone_otp' : 'email_otp');

/**
 * Runtime override (e.g. remote config, or tests). Merges the given partial over the
 * env-resolved config. Kept explicit so switching providers/flags never needs a code edit.
 */
export function configureAuth(next: { activeChannel?: AuthChannel; features?: Partial<Record<AuthFeature, boolean>> }): void {
  if (next.activeChannel && (KNOWN_CHANNELS as string[]).includes(next.activeChannel)) {
    authConfig.activeChannel = next.activeChannel;
  }
  if (next.features) authConfig.features = { ...authConfig.features, ...next.features };
}
