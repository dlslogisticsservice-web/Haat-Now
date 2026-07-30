// ─────────────────────────────────────────────────────────────────────────────
// Phone OTP provider — FUTURE channel (CEQUENS SMS). Fully implemented and kept
// registered so phone login can be re-activated by flipping ACTIVE_AUTH_CHANNEL
// (or exposing a channel chooser) with NO refactor of authService or the UI.
// Not the active production channel for the Egypt-first email-only beta.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../../lib/supabase';
import { toE164 } from '../../utils/phone';
import { demoByPhone } from './demoAccounts';
import type { OtpAuthProvider, ResolvedIdentity } from './types';

// E.164: leading +, country digit 1-9, then up to 14 more digits.
const E164_RE = /^\+[1-9]\d{6,14}$/;

export const phoneOtpProvider: OtpAuthProvider = {
  channel: 'phone',
  id: 'phone-otp',

  normalize: (raw) => toE164(raw),
  isValid: (phone) => E164_RE.test(phone),

  async requestOtp(phone) {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error };
  },

  async confirmOtp(phone, token) {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    return { data: { user: data?.user ?? null }, error };
  },

  sandboxAccount: (phone) => demoByPhone(phone),

  resolveIdentity(phone, sbUser): ResolvedIdentity {
    return { email: sbUser?.email ?? null, phone_number: sbUser?.phone ?? phone ?? null };
  },

  mask: (p) => (p.length > 5 ? `${p.slice(0, 3)}***${p.slice(-2)}` : '***'),
};
