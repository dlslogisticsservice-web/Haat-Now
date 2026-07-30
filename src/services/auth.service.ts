import { supabase } from '../lib/supabase';
import { User } from './types';
import { monitoring } from './monitoring.service';
import {
  emptyOtpState, checkSend, recordSend, checkVerify, recordVerifyFailure, recordVerifySuccess,
  type OtpGuardState, type OtpDecision,
} from './otp-policy';
import { getAuthProvider, ACTIVE_AUTH_CHANNEL } from './auth/registry';
import { DEMO_OTP, demoById } from './auth/demoAccounts';
import type { AuthChannel } from './auth/types';
import { IS_SANDBOX } from '../config/runtime';

// ─────────────────────────────────────────────────────────────────────────────
// Unified authentication service.
//
// Channel-specific work (send/verify an OTP, normalize/validate an identity, resolve
// a sandbox account) is delegated to an OtpAuthProvider (email today; phone/CEQUENS +
// OAuth later — see services/auth/registry.ts). Everything channel-agnostic lives HERE:
// the client-side rate-limit guard, RBAC role resolution, customer-profile creation,
// session lifecycle, admin scope, and logout.
//
// Dual-mode via the single source of truth (config/runtime IS_SANDBOX, derived from
// VITE_AUTH_MODE at build time):
//   sandbox  → local demo code (123456) + fixed demo accounts (the self-contained demo;
//              forced in vite.config so production ships as the demo).
//   supabase → real Supabase OTP (opt in with HAAT_LIVE_BACKEND=1).
// ─────────────────────────────────────────────────────────────────────────────
const SANDBOX_SESSION_KEY = 'haat_sandbox_session';

const VALID_ROLES = ['admin', 'merchant', 'driver', 'customer'] as const;
const isValidRole = (n: unknown): n is User['role'] =>
  typeof n === 'string' && (VALID_ROLES as readonly string[]).includes(n);

// Resolves the highest-priority role for a user from the database (supabase mode).
// NOTE: we deliberately do NOT use PostgREST's embedded ordering
// (`.order('priority', { referencedTable: 'roles' })`) — ordering the parent
// `user_roles` rows by a column on the to-one embedded `roles` resource is not
// reliably applied, so `.limit(1)` returned an arbitrary row (usually the
// first-seeded `customer` assignment), downgrading every multi-role user to
// customer. Instead we fetch ALL assignments and pick the highest priority here.
async function resolveHighestRole(userId: string): Promise<User['role']> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('roles(name, priority)')
    .eq('user_id', userId);

  if (error) {
    console.error(`[auth] resolveHighestRole: query failed for user ${userId} — defaulting to customer.`, error);
    return 'customer';
  }

  // PostgREST types the embedded `roles` as an array, though a to-one FK returns a
  // single object at runtime. Normalise both shapes so resolution is robust.
  type RoleRef = { name: string; priority: number };
  const assignments = ((data ?? []) as Array<{ roles: RoleRef | RoleRef[] | null }>)
    .flatMap(r => (Array.isArray(r.roles) ? r.roles : r.roles ? [r.roles] : []))
    .filter((r): r is RoleRef => !!r && typeof r.priority === 'number');

  if (assignments.length === 0) {
    // No role rows is a legitimate state (brand-new auth user) → customer.
    console.warn(`[auth] resolveHighestRole: no role assignments for user ${userId} — defaulting to customer.`);
    return 'customer';
  }

  const highest = assignments.reduce((a, b) => (b.priority > a.priority ? b : a));

  if (!isValidRole(highest.name)) {
    // Role data EXISTS but is unrecognised — do not silently swallow it; log loudly.
    console.error(`[auth] resolveHighestRole: unrecognised highest role "${highest.name}" for user ${userId} — defaulting to customer.`);
    return 'customer';
  }
  return highest.name;
}

function readSandboxSession(): User | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SANDBOX_SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

// ── OTP abuse guard (client-side defense-in-depth) ────────────────────────────
// Per-IDENTITY state (email or phone), in memory only — it holds counters/timestamps,
// NEVER an OTP. The OTP lifecycle itself stays server-side (Supabase Auth). This layer
// only fast-fails abuse with a specific reason; the server remains authoritative.
const otpGuards = new Map<string, OtpGuardState>();
const readGuard = (identity: string): OtpGuardState => otpGuards.get(identity) ?? emptyOtpState();
const writeGuard = (identity: string, s: OtpGuardState): void => { otpGuards.set(identity, s); };

/** Map a policy denial to an explicit, localised auth error (never a silent success). */
function otpPolicyError(d: OtpDecision): { message: string; code: string; retryAfterSec?: number } {
  const s = d.retryAfterSec ?? 0;
  const msg =
    d.reason === 'cooldown'      ? `انتظر ${s} ثانية قبل إعادة إرسال الرمز.` :
    d.reason === 'send_limit'    ? `تجاوزت الحد المسموح لطلب الرموز. حاول بعد ${s} ثانية.` :
    d.reason === 'attempt_limit' ? 'محاولات كثيرة غير صحيحة. اطلب رمزًا جديدًا.' :
    d.reason === 'locked'        ? `تم قفل المحاولات مؤقتًا. حاول بعد ${s} ثانية.` :
    d.reason === 'replay'        ? 'تم استخدام هذا الرمز بالفعل. اطلب رمزًا جديدًا.' :
    'تعذّر إتمام العملية.';
  return { message: msg, code: `otp_${d.reason}`, retryAfterSec: d.retryAfterSec };
}

export const authService = {
  // ── Request OTP ────────────────────────────────────────────────────────────
  async sendOtp(identity: string, channel: AuthChannel = ACTIVE_AUTH_CHANNEL): Promise<{ error: any }> {
    const provider = getAuthProvider(channel);
    const id = provider.normalize(identity);
    const now = Date.now();

    if (!provider.isValid(id)) {
      return { error: { message: 'أدخل بريدًا إلكترونيًا صحيحًا.', code: 'invalid_identity' } };
    }
    // Guard first — refuse before wasting a round-trip. Explicit reason, never a fake OK.
    const gate = checkSend(readGuard(id), now);
    if (!gate.allowed) return { error: otpPolicyError(gate) };

    if (IS_SANDBOX) {
      if (!provider.sandboxAccount(id)) {
        return { error: { message: 'هذا الحساب غير مسجّل في وضع التجربة. استخدم أحد حسابات التجربة.', code: 'unknown_demo' } };
      }
      writeGuard(id, recordSend(readGuard(id), now));
      return { error: null };
    }

    // Production: Supabase generates + sends the OTP via its configured provider.
    const { error } = await provider.requestOtp(id);
    if (error) {
      // Delivery / provider failure — surfaced to Guardian, never swallowed.
      const msg = (error as { message?: string }).message || 'unknown';
      monitoring.log('error', `[auth] send_failed(${provider.channel}): ${msg}`, { identity: provider.mask(id) });
      return { error };
    }
    writeGuard(id, recordSend(readGuard(id), now));
    return { error: null };
  },

  // ── Verify OTP → establish session ──────────────────────────────────────────
  async verifyOtp(identity: string, token: string, channel: AuthChannel = ACTIVE_AUTH_CHANNEL): Promise<{ data: { user: User | null }; error: any }> {
    const provider = getAuthProvider(channel);
    const id = provider.normalize(identity);
    const now = Date.now();

    const gate = checkVerify(readGuard(id), now);
    if (!gate.allowed) return { data: { user: null }, error: otpPolicyError(gate) };

    if (IS_SANDBOX) {
      const acct = provider.sandboxAccount(id);
      if (!acct) return { data: { user: null }, error: { message: 'هذا الحساب غير مسجّل في وضع التجربة.', code: 'unknown_demo' } };
      if (token !== DEMO_OTP) {
        writeGuard(id, recordVerifyFailure(readGuard(id), now));
        return { data: { user: null }, error: { message: `رمز غير صحيح. استخدم ${DEMO_OTP}.`, code: 'otp_invalid' } };
      }
      writeGuard(id, recordVerifySuccess(readGuard(id), now));
      const user: User = { id: acct.id, email: acct.email, phone_number: acct.phone, role: acct.role };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SANDBOX_SESSION_KEY, JSON.stringify(user));
        // Align the active country with the demo account's country.
        localStorage.setItem('haat_country', acct.country);
        localStorage.setItem('haat_country_manual', '1');
      }
      return { data: { user }, error: null };
    }

    const { data, error } = await provider.confirmOtp(id, token);
    if (error) {
      writeGuard(id, recordVerifyFailure(readGuard(id), now));
      const msg = (error as { message?: string }).message || 'invalid code';
      monitoring.log('error', `[auth] verify_failed(${provider.channel}): ${msg}`, { identity: provider.mask(id) });
      return { data: { user: null }, error };
    }
    writeGuard(id, recordVerifySuccess(readGuard(id), now));
    const sbUser = data.user;
    if (!sbUser) return { data: { user: null }, error: new Error('No authenticated user returned') };

    const role = await resolveHighestRole(sbUser.id);
    const ident = provider.resolveIdentity(id, sbUser);
    // First-time customer → create the profile row. phone_number is optional
    // (nullable since 20260731000001) and may be attached later.
    if (role === 'customer') {
      const { data: profile } = await supabase.from('customers').select('id').eq('id', sbUser.id).maybeSingle();
      if (!profile) {
        await supabase.from('customers').insert({
          id: sbUser.id, email: ident.email, phone_number: ident.phone_number, full_name: 'عميل جديد',
        });
      }
    }
    return { data: { user: { id: sbUser.id, email: ident.email, phone_number: ident.phone_number, role } }, error: null };
  },

  // ── Raw auth user id (lightweight — no role resolution) ─────────────────────
  async getAuthUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  },

  // ── Resolve current user (session recovery after refresh) ───────────────────
  async getCurrentUser(): Promise<User | null> {
    if (IS_SANDBOX) return readSandboxSession();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const role = await resolveHighestRole(user.id);
    return { id: user.id, email: user.email ?? null, phone_number: user.phone ?? null, role };
  },

  // ── Admin scope (authoritative super/country gate) ──────────────────────────
  // Single source of truth for super-vs-country, consistent across modes. Returns
  // 'super' | 'country' for admins, or null for non-admins / unknown. Used to gate
  // Design Center, Campaign Center, global settings and cross-country data.
  async getAdminScope(userId: string): Promise<'super' | 'country' | null> {
    if (IS_SANDBOX) {
      const acct = demoById(userId);
      if (!acct || acct.role !== 'admin') return null;
      return acct.scope === 'super' ? 'super' : 'country';
    }
    const { data, error } = await supabase
      .from('admin_users').select('scope').eq('user_id', userId).maybeSingle();
    if (error) {
      console.error(`[auth] getAdminScope: query failed for user ${userId} — denying super scope.`, error);
      return null;
    }
    const scope = (data as { scope?: string } | null)?.scope;
    return scope === 'super' ? 'super' : scope === 'country' ? 'country' : null;
  },

  // ── Access token (for authenticated edge-function / API calls) ───────────────
  // Single source of truth for the bearer token. Sandbox has no real Supabase JWT.
  async getAccessToken(): Promise<string> {
    if (IS_SANDBOX) return '';
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  },

  // ── Subscribe to auth changes (login / logout / token refresh) ───────────────
  // Supabase mode → real onAuthStateChange. Sandbox mode → no-op (state is driven
  // by the login/logout handlers; the real client would emit INITIAL_SESSION=null
  // and wipe the sandbox session).
  subscribeToAuthChanges(onChange: (user: User | null) => void): () => void {
    if (IS_SANDBOX) return () => {};
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sbSession) => {
      if (!sbSession) { onChange(null); return; }
      this.getCurrentUser().then(onChange).catch(console.error);
    });
    return () => subscription.unsubscribe();
  },

  // ── Logout ──────────────────────────────────────────────────────────────────
  async signOut(): Promise<{ error: any }> {
    if (IS_SANDBOX) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(SANDBOX_SESSION_KEY);
      return { error: null };
    }
    const { error } = await supabase.auth.signOut();
    return { error };
  },
};
