import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// checkout.repository (Phase-2 architecture stabilization).
// Supabase data access for the checkout prerequisites: zones, addresses, branch
// coordinates, product images, and product-variant resolution. No business logic.
// ─────────────────────────────────────────────────────────────────────────────

export const checkoutRepository = {
  listZones() {
    return supabase.from('zones').select('*');
  },

  listAddresses(customerId: string) {
    return supabase.from('addresses').select('*').eq('customer_id', customerId).order('is_default', { ascending: false });
  },

  getBranchCoords(branchId: string) {
    return supabase.from('merchant_branches').select('latitude,longitude').eq('id', branchId).maybeSingle();
  },

  listProductImages(productIds: string[]) {
    return supabase.from('product_images').select('product_id,url').in('product_id', productIds);
  },

  insertAddress(row: { customer_id: string; zone_id: string; address_line: string; label: string }) {
    return supabase.from('addresses').insert(row).select().single();
  },

  findVariant(productId: string) {
    return supabase.from('product_variants').select('id').eq('product_id', productId).limit(1);
  },

  insertDefaultVariant(productId: string) {
    return supabase.from('product_variants').insert({ product_id: productId, name: 'الافتراضي', price_modifier: 0.00 }).select().single();
  },
};
