import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// inventory.repository (Phase-2 service→repository migration).
// Supabase data access for product stock + movements (adjust_product_stock RPC).
// No business logic — the aggregate stats are computed in inventory.service.
// ─────────────────────────────────────────────────────────────────────────────

export const inventoryRepository = {
  getInventory(branchId: string) {
    return supabase.from('products').select('id, branch_id, category_id, name, price, stock, low_stock_threshold, is_active').eq('branch_id', branchId).order('name');
  },

  adjustStock(productId: string, delta: number, reason: string) {
    return supabase.rpc('adjust_product_stock', { p_product_id: productId, p_delta: delta, p_reason: reason });
  },

  getStockHistory(productId: string) {
    return supabase.from('stock_movements').select('*').eq('product_id', productId).order('created_at', { ascending: false }).limit(50);
  },
};
