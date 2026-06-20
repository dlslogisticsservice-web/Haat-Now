import { supabase } from '../lib/supabase';
import { User } from '../features/auth/types';
import { toE164 } from '../utils/phone';

// ─────────────────────────────────────────────────────────────────────────────
// Dual-mode authentication.
//   VITE_AUTH_MODE=sandbox   → local demo OTP (123456) + fixed demo accounts.
//   VITE_AUTH_MODE=supabase  → real Supabase phone OTP (production).
// The mode is selected ONLY by the env var (not by dev/prod build), so the
// production implementation is never removed.
// ─────────────────────────────────────────────────────────────────────────────
const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || 'supabase';
const isSandbox = () => AUTH_MODE === 'sandbox';

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

// Resolves the highest-priority role for a user from the database (supabase mode).
async function resolveHighestRole(userId: string): Promise<User['role']> {
  const { data } = await supabase
    .from('user_roles')
    .select('roles(name, priority)')
    .eq('user_id', userId)
    .order('priority', { ascending: false, referencedTable: 'roles' })
    .limit(1)
    .maybeSingle();
  const name = (data as any)?.roles?.name as string | undefined;
  return (name === 'admin' || name === 'merchant' || name === 'driver' || name === 'customer') ? name : 'customer';
}

function readSandboxSession(): User | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SANDBOX_SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

export const authService = {
  // ── Request OTP ────────────────────────────────────────────────────────────
  async sendOtp(phoneNumber: string): Promise<{ error: any }> {
    const phone = toE164(phoneNumber);
    if (isSandbox()) {
      if (!DEMO_ACCOUNTS[phone]) {
        return { error: { message: 'رقم غير مسجّل في وضع التجربة. استخدم أحد أرقام الحسابات التجريبية.' } };
      }
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error };
  },

  // ── Verify OTP → establish session ──────────────────────────────────────────
  async verifyOtp(phoneNumber: string, token: string): Promise<{ data: { user: User | null }; error: any }> {
    const phone = toE164(phoneNumber);

    if (isSandbox()) {
      const acct = DEMO_ACCOUNTS[phone];
      if (!acct) return { data: { user: null }, error: { message: 'رقم غير مسجّل في وضع التجربة.' } };
      if (token !== SANDBOX_OTP) return { data: { user: null }, error: { message: `رمز غير صحيح. استخدم ${SANDBOX_OTP}.` } };
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
    if (error) return { data: { user: null }, error };
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

  // ── Resolve current user (session recovery after refresh) ───────────────────
  async getCurrentUser(): Promise<User | null> {
    if (isSandbox()) return readSandboxSession();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const role = await resolveHighestRole(user.id);
    return { id: user.id, phone_number: user.phone || '', role };
  },

  // ── Access token (for authenticated edge-function / API calls) ───────────────
  // Single source of truth for the bearer token. Sandbox has no real Supabase JWT.
  async getAccessToken(): Promise<string> {
    if (isSandbox()) return '';
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  },

  // ── Subscribe to auth changes (login / logout / token refresh) ───────────────
  // Supabase mode → real onAuthStateChange. Sandbox mode → no-op (state is driven
  // by the login/logout handlers; the real client would emit INITIAL_SESSION=null
  // and wipe the sandbox session).
  subscribeToAuthChanges(onChange: (user: User | null) => void): () => void {
    if (isSandbox()) return () => {};
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sbSession) => {
      if (!sbSession) { onChange(null); return; }
      this.getCurrentUser().then(onChange).catch(console.error);
    });
    return () => subscription.unsubscribe();
  },

  // ── Logout ──────────────────────────────────────────────────────────────────
  async signOut(): Promise<{ error: any }> {
    if (isSandbox()) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(SANDBOX_SESSION_KEY);
      return { error: null };
    }
    const { error } = await supabase.auth.signOut();
    return { error };
  },
};
