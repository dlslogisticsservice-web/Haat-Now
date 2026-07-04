import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// merchant.repository (Phase-2 architecture stabilization).
// Supabase data access for the merchant portal: the merchant record, its branches,
// categories, the branch-orders realtime stream, and the logo upsert. No business logic.
// (Product reads use catalog.repository; orders/inventory/analytics use their services.)
// ─────────────────────────────────────────────────────────────────────────────

export const merchantRepository = {
  listBranches(merchantId: string) {
    return supabase.from('merchant_branches').select('*').eq('merchant_id', merchantId);
  },

  getMerchant(merchantId: string) {
    return supabase.from('merchants').select('id, business_name, logo_url').eq('id', merchantId).maybeSingle();
  },

  listCategories() {
    return supabase.from('categories').select('*');
  },

  upsertMerchant(row: { id: string; business_name: string; logo_url: string }) {
    return supabase.from('merchants').upsert(row);
  },

  /** Realtime: re-fetch when any order for this branch is inserted or updated. */
  subscribeBranchOrders(branchId: string, onChange: () => void): any {
    return supabase
      .channel(`merchant-orders-${branchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `branch_id=eq.${branchId}` }, () => onChange())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `branch_id=eq.${branchId}` }, () => onChange())
      .subscribe();
  },

  unsubscribe(channel: any): void {
    if (channel) supabase.removeChannel(channel);
  },
};
