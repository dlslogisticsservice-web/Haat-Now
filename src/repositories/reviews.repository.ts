import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// reviews.repository (Phase-2 architecture stabilization).
// Supabase read access used to resolve a completed order's review targets
// (merchant / driver / products) and any already-submitted reviews. No business logic.
// (Review submission itself goes through cxService.submitReview.)
// ─────────────────────────────────────────────────────────────────────────────

export const reviewsRepository = {
  /** The order's branch + its merchant (to build the "merchant" review target). */
  getOrderBranch(branchId: string) {
    return supabase.from('merchant_branches').select('merchant_id, name, merchants(business_name)').eq('id', branchId).maybeSingle();
  },

  /** The assigned driver's display name. */
  getDriver(driverId: string) {
    return supabase.from('drivers').select('full_name').eq('id', driverId).maybeSingle();
  },

  /** The order's line items → distinct products (for per-product review targets). */
  getOrderItems(orderId: string) {
    return supabase.from('order_items').select('variant_id, product_variants(product_id, products(id, name))').eq('order_id', orderId);
  },

  /** An existing review for a given target on this order, if already submitted. */
  getExistingReview(orderId: string, targetType: string, targetId: string) {
    return supabase.from('reviews').select('rating, comment').eq('order_id', orderId).eq('target_type', targetType).eq('target_id', targetId).maybeSingle();
  },
};
