import { supabase } from '../lib/supabase';
import { User } from './types';
import { toE164 } from '../utils/phone';
import { monitoring } from './monitoring.service';
import {
  emptyOtpState, checkSend, recordSend, checkVerify, recordVerifyFailure, recordVerifySuccess,
  type OtpGuardState, type OtpDecision,
} from './otp-policy';

// ─────────────────────────────────────────────────────────────────────────────
// Dual-mode authentication — keyed off VITE_AUTH_MODE ONLY (must match lib/supabase.ts
// and every other service; do NOT re-add an `&& import.meta.env.DEV` gate — that made
// the demo unable to log in on the deployed production build, where DEV is false).
//   VITE_AUTH_MODE=sandbox   → local demo OTP (123456) + fixed demo accounts (the demo;
//                              forced in vite.config so production ships as the demo).
//   VITE_AUTH_MODE=supabase  → real Supabase phone OTP (opt in with HAAT_LIVE_BACKEND=1).
// ─────────────────────────────────────────────────────────────────────────────
const IS_SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

export const SANDBOX_OTP = '123456';
const SANDBOX_SESSION_KEY = 'haat_sandbox_session';

interface DemoAccount { id: string; role: User['role']; country: 'EG' | 'SA'; name: string; scope?: 'super' | 'country' }

// Demo accounts (E.164 keyed). UUID ids are valid so uuid-typed queries never 22P02.
export const DEMO_ACCOUNTS: Record<string, DemoAccount> = {
  '+201000000001': { id: '11111111-0000-0000-0000-000000000001', role: 'customer', country: 'EG', name: 'عميل مصر' },
  '+966500000001': { id: '11111111-0000-0000-0000-000000000002', role: 'customer', country: 'SA', name: 'عميل السعودية' },
  '+201000000002': { id: '22222222-0000-0000-0000-000000000001', role: 'merchant', country: 'EG', name: 'تاجر مصر' },
  '+966500000002': { id: '22222222-0000-0000-0000-000000000002', role: 'merchant', country: 'SA', name: 'تاجر السعودية' },
  '+201000000003': { id: '33333333-0000-0000-0000-000000000001', role: 'driver',   country: 'EG', name: 'كابتن مصر' },
  '+966500000003': { id: '33333333-0000-0000-0000-000000000002', role: 'driver',   country: 'SA', name: 'كابتن السعودية' },
  '+201000000004': { id: '44444444-0000-0000-0000-000000000001', role: 'admin',     country: 'EG', name: 'مدير مصر',     scope: 'country' },
  '+966500000004': { id: '44444444-0000-0000-0000-000000000002', role: 'admin',     country: 'SA', name: 'مدير السعودية', scope: 'country' },
  '+201000000005': { id: '55555555-0000-0000-0000-000000000005', role: 'admin',     country: 'EG', name: 'المدير العام',  scope: 'super' },
  '+201000000006': { id: '44444444-0000-0000-0000-000000000003', role: 'admin',     country: 'SA', name: 'مدير السعودية', scope: 'country' },
};

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
// Per-phone state, in memory only — it holds counters/timestamps, NEVER an OTP. The
// OTP lifecycle itself stays server-side (Supabase Auth). This layer only fast-fails
// abuse with a specific reason; the server remains authoritative.
const otpGuards = new Map<string, OtpGuardState>();
const readGuard = (phone: string): OtpGuardState => otpGuards.get(phone) ?? emptyOtpState();
const writeGuard = (phone: string, s: OtpGuardState): void => { otpGuards.set(phone, s); };

/** Log/telemetry-safe phone — never record a full number. */
const maskPhone = (p: string): string => (p.length > 5 ? `${p.slice(0, 3)}***${p.slice(-2)}` : '***');

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
  async sendOtp(phoneNumber: string): Promise<{ error: any }> {
    const phone = toE164(phoneNumber);
    const now = Date.now();
    // Guard first — refuse before wasting a round-trip. Explicit reason, never a fake OK.
    const gate = checkSend(readGuard(phone), now);
    if (!gate.allowed) return { error: otpPolicyError(gate) };

    if (IS_SANDBOX) {
      if (!DEMO_ACCOUNTS[phone]) {
        return { error: { message: 'رقم غير مسجّل في وضع التجربة. استخدم أحد أرقام الحسابات التجريبية.' } };
      }
      writeGuard(phone, recordSend(readGuard(phone), now));
      return { error: null };
    }

    // Production: Supabase generates + sends the OTP via its configured SMS provider.
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      // SMS delivery / provider failure — surfaced to Guardian, never swallowed.
      monitoring.log('error', `[auth] send_failed: ${error.message || 'unknown'}`, { phone: maskPhone(phone) });
      return { error };
    }
    writeGuard(phone, recordSend(readGuard(phone), now));
    return { error: null };
  },

  // ── Verify OTP → establish session ──────────────────────────────────────────
  async verifyOtp(phoneNumber: string, token: string): Promise<{ data: { user: User | null }; error: any }> {
    const phone = toE164(phoneNumber);
    const now = Date.now();
    const gate = checkVerify(readGuard(phone), now);
    if (!gate.allowed) return { data: { user: null }, error: otpPolicyError(gate) };

    if (IS_SANDBOX) {
      const acct = DEMO_ACCOUNTS[phone];
      if (!acct) return { data: { user: null }, error: { message: 'رقم غير مسجّل في وضع التجربة.' } };
      if (token !== SANDBOX_OTP) {
        writeGuard(phone, recordVerifyFailure(readGuard(phone), now));
        return { data: { user: null }, error: { message: `رمز غير صحيح. استخدم ${SANDBOX_OTP}.` } };
      }
      writeGuard(phone, recordVerifySuccess(readGuard(phone), now));
      const user: User = { id: acct.id, phone_number: phone, role: acct.role };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SANDBOX_SESSION_KEY, JSON.stringify(user));
        // Align the active country with the demo account's country.
        localStorage.setItem('haat_country', acct.country);
        localStorage.setItem('haat_country_manual', '1');
      }
      return { data: { user }, error: null };
    }

    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) {
      writeGuard(phone, recordVerifyFailure(readGuard(phone), now));
      // OTP verification failure — surfaced to Guardian.
      monitoring.log('error', `[auth] verify_failed: ${error.message || 'invalid code'}`, { phone: maskPhone(phone) });
      return { data: { user: null }, error };
    }
    writeGuard(phone, recordVerifySuccess(readGuard(phone), now));
    const sbUser = data.user;
    if (!sbUser) return { data: { user: null }, error: new Error('No authenticated user returned') };
    const role = await resolveHighestRole(sbUser.id);
    if (role === 'customer') {
      const { data: profile } = await supabase.from('customers').select('id').eq('id', sbUser.id).maybeSingle();
      if (!profile) {
        await supabase.from('customers').insert({ id: sbUser.id, phone_number: sbUser.phone || phone, full_name: 'عميل جديد', email: null });
      }
    }
    return { data: { user: { id: sbUser.id, phone_number: sbUser.phone || phone, role } }, error: null };
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
    return { id: user.id, phone_number: user.phone || '', role };
  },

  // ── Admin scope (authoritative super/country gate) ──────────────────────────
  // Single source of truth for super-vs-country, consistent across modes. Returns
  // 'super' | 'country' for admins, or null for non-admins / unknown. Used to gate
  // Design Center, Campaign Center, global settings and cross-country data.
  async getAdminScope(userId: string): Promise<'super' | 'country' | null> {
    if (IS_SANDBOX) {
      const acct = Object.values(DEMO_ACCOUNTS).find(a => a.id === userId);
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
