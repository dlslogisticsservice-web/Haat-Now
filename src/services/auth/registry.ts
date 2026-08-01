// ─────────────────────────────────────────────────────────────────────────────
// Auth provider registry.
//
// Adding a channel (OAuth, guest, an alternate SMS vendor) = implement OtpAuthProvider
// and register it here. Nothing else in the auth stack changes — authService, the
// LoginScreen state machine, and session handling are all channel-agnostic. The ACTIVE
// channel is NOT hardcoded here: it comes from authConfig (env / runtime — see config.ts).
// ─────────────────────────────────────────────────────────────────────────────
import type { AuthChannel, OtpAuthProvider } from './types';
import { emailOtpProvider } from './emailOtpProvider';
import { phoneOtpProvider } from './phoneOtpProvider';
import { authConfig } from './config';

export const AUTH_PROVIDERS: Record<AuthChannel, OtpAuthProvider> = {
  email: emailOtpProvider,
  phone: phoneOtpProvider,
};

/** Resolve a provider — defaults to the configured active channel (env/runtime). */
export const getAuthProvider = (channel: AuthChannel = authConfig.activeChannel): OtpAuthProvider =>
  AUTH_PROVIDERS[channel];

/**
 * @deprecated Read `authConfig.activeChannel` (config.ts) — it reflects env + runtime
 * overrides. Retained as a load-time snapshot for backward compatibility.
 */
export const ACTIVE_AUTH_CHANNEL: AuthChannel = authConfig.activeChannel;
