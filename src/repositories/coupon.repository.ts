import { supabase } from '../lib/supabase';
import { Coupon } from '../services/types';

// ─────────────────────────────────────────────────────────────────────────────
// coupon.repository (Phase-2 service→repository migration).
// Supabase data access for coupons + the validate_coupon RPC. No business logic.
// ─────────────────────────────────────────────────────────────────────────────

export const couponRepository = {
  list() {
    return supabase.from('coupons').select('*').order('created_at', { ascending: false });
  },

  insert(row: Record<string, any>) {
    return supabase.from('coupons').insert(row).select().single();
  },

  update(id: string, patch: Partial<Coupon>) {
    return supabase.from('coupons').update(patch).eq('id', id);
  },

  validate(code: string, country: string | null) {
    return supabase.rpc('validate_coupon', { p_code: code, p_country: country });
  },
};
