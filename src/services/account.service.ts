// ─────────────────────────────────────────────────────────────────────────────
// Account self-deletion + data export (store-compliance).
// deleteMyAccount() calls the SECURITY DEFINER RPC `delete_my_account` (migration
// 20260627000001) which anonymizes transactional profiles, hard-deletes personal
// rows, and removes the auth identity. Sandbox mode has no real backend, so it
// clears local state and resolves (the UI then signs the user out).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox' || !supabase;

export const accountService = {
  /** Permanently delete the signed-in user's account + personal data. */
  async deleteMyAccount(): Promise<{ error: any }> {
    if (SANDBOX) {
      try {
        // Clear all locally-held personal state for the demo session.
        for (const k of Object.keys(localStorage)) {
          if (/^haat_(cart|recent|notif|merchant_settings|platform|admin_recent)/.test(k)) localStorage.removeItem(k);
        }
      } catch { /* ignore */ }
      return { error: null };
    }
    const { error } = await supabase.rpc('delete_my_account');
    if (!error) { try { await supabase.auth.signOut(); } catch { /* ignore */ } }
    return { error };
  },
};
