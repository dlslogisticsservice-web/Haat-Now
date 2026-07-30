// ─────────────────────────────────────────────────────────────────────────────
// Authentication provider contract.
//
// An OTP channel (Email today; Phone/CEQUENS + OAuth later) implements ONLY its
// channel-specific concerns — normalize/validate an identity, send + verify a code
// via Supabase, and resolve a sandbox demo account. Everything channel-agnostic
// (rate-limit guard, RBAC role resolution, customer-profile creation, session
// lifecycle, logout) is owned by the unified `authService`. Adding a provider must
// never require touching authService, the login state machine, or session handling.
// ─────────────────────────────────────────────────────────────────────────────
import type { User } from '../types';

export type AuthChannel = 'email' | 'phone';

/** The subset of a Supabase auth user the identity layer needs. */
export interface SupabaseAuthUser {
  id: string;
  email?: string | null;
  phone?: string | null;
}

/** A fixed demo identity used ONLY in the sandbox build (no real backend). */
export interface DemoAccount {
  id: string;
  role: User['role'];
  country: 'EG' | 'SA';
  name: string;
  scope?: 'super' | 'country';
  email: string;
  phone: string;
}

/** Identity fields persisted on the app User + customer row after authentication. */
export interface ResolvedIdentity {
  email: string | null;
  phone_number: string | null;
}

export interface OtpAuthProvider {
  /** Channel key (also the registry key). */
  readonly channel: AuthChannel;
  /** Stable id for logs/telemetry, e.g. 'email-otp'. */
  readonly id: string;
  /** Normalize a raw, user-entered identity (email → trim+lowercase; phone → E.164). */
  normalize(raw: string): string;
  /** Is a normalized identity well-formed for this channel? */
  isValid(identity: string): boolean;
  /** LIVE — ask Supabase to send an OTP for this channel. */
  requestOtp(identity: string): Promise<{ error: unknown }>;
  /** LIVE — verify an OTP with Supabase; resolves the authenticated user. */
  confirmOtp(identity: string, token: string): Promise<{ data: { user: SupabaseAuthUser | null }; error: unknown }>;
  /** SANDBOX — the demo account for this identity, or null if not a demo identity. */
  sandboxAccount(identity: string): DemoAccount | null;
  /** Identity fields to persist (from the live Supabase user, falling back to input). */
  resolveIdentity(identity: string, sbUser: SupabaseAuthUser | null): ResolvedIdentity;
  /** Redact an identity for logs/telemetry — never record it in full. */
  mask(identity: string): string;
}
