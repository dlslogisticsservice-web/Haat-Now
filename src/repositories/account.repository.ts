import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// account.repository (Phase-2 service→repository migration).
// Supabase access for account self-deletion (SECURITY DEFINER RPC) + sign-out.
// The sandbox local-state clearing stays in account.service.
// ─────────────────────────────────────────────────────────────────────────────

export const accountRepository = {
  deleteMyAccount() {
    return supabase.rpc('delete_my_account');
  },

  async signOut(): Promise<void> {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
  },
};
