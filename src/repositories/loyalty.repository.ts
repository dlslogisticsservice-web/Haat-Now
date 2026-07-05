import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// loyalty.repository (Phase-2 service→repository migration).
// Supabase data access for loyalty points (balance/award/redeem RPCs + history).
// No business logic — the insufficient-balance mapping stays in loyalty.service.
// ─────────────────────────────────────────────────────────────────────────────

export const loyaltyRepository = {
  balance(customerId: string) {
    return supabase.rpc('loyalty_balance', { p_customer_id: customerId });
  },

  history(customerId: string) {
    return supabase.from('loyalty_transactions').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(50);
  },

  award(customerId: string, points: number, reason: string) {
    return supabase.rpc('award_loyalty_points', { p_customer_id: customerId, p_points: points, p_reason: reason });
  },

  redeem(customerId: string, points: number, reason: string) {
    return supabase.rpc('redeem_loyalty_points', { p_customer_id: customerId, p_points: points, p_reason: reason });
  },
};
