// ─────────────────────────────────────────────────────────────────────────────
// Email OTP provider — the PRODUCTION login channel (Egypt-first closed beta).
// Uses Supabase email OTP (a 6-digit code); no deprecated APIs.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../../lib/supabase';
import { demoByEmail } from './demoAccounts';
import type { OtpAuthProvider, ResolvedIdentity, SupabaseAuthUser } from './types';

// Pragmatic, non-catastrophic email shape: local@domain.tld with no whitespace.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailOtpProvider: OtpAuthProvider = {
  channel: 'email',
  id: 'email-otp',

  normalize: (raw) => raw.trim().toLowerCase(),
  isValid: (email) => EMAIL_RE.test(email),

  async requestOtp(email) {
    // Sends a 6-digit email OTP; shouldCreateUser lets a first-time customer self-register.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    return { error };
  },

  async confirmOtp(email, token) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    return { data: { user: data?.user ?? null }, error };
  },

  sandboxAccount: (email) => demoByEmail(email),

  resolveIdentity(email, sbUser): ResolvedIdentity {
    return { email: sbUser?.email ?? email ?? null, phone_number: sbUser?.phone ?? null };
  },

  mask(email) {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 2)}***@${domain}`;
  },
};

export type { SupabaseAuthUser };
