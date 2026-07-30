// ─────────────────────────────────────────────────────────────────────────────
// Auth provider registry.
//
// Adding a channel (OAuth, guest, an alternate SMS vendor) = implement OtpAuthProvider
// and register it here. Nothing else in the auth stack changes — authService, the
// LoginScreen state machine, and session handling are all channel-agnostic.
// ─────────────────────────────────────────────────────────────────────────────
import type { AuthChannel, OtpAuthProvider } from './types';
import { emailOtpProvider } from './emailOtpProvider';
import { phoneOtpProvider } from './phoneOtpProvider';

export const AUTH_PROVIDERS: Record<AuthChannel, OtpAuthProvider> = {
  email: emailOtpProvider,
  phone: phoneOtpProvider,
};

/**
 * The production login channel for the current launch. Email OTP for the Egypt-first
 * closed beta; switch to 'phone' (or surface a chooser) once CEQUENS SMS is wired.
 */
export const ACTIVE_AUTH_CHANNEL: AuthChannel = 'email';

export const getAuthProvider = (channel: AuthChannel = ACTIVE_AUTH_CHANNEL): OtpAuthProvider =>
  AUTH_PROVIDERS[channel];
