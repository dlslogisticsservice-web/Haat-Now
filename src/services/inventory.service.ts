import { supabase } from '../lib/supabase';
import { Product, StockMovement } from './types';

// Inventory / stock control — real Supabase counterpart of sandboxStore inventory.
// Backed by migration 0020 (products.stock + stock_movements + adjust_product_stock RPC).
export const inventoryService = {
  // All products for a branch with their stock levels.
  async getInventory(branchId: string): Promise<{ data: Product[]; error: any }> {
    const { data, error } = await supabase
      .from('products')
      .select('id, branch_id, category_id, name, price, stock, low_stock_threshold, is_active')
      .eq('branch_id', branchId)
      .order('name');
    return { data: (data as Product[]) || [], error };
  },

  // Atomic stock adjustment (records a movement + auto out-of-stock toggle). Returns new stock.
  async adjustStock(productId: string, delta: number, reason = 'تعديل يدوي'): Promise<{ stock: number | null; error: any }> {
    const { data, error } = await supabase.rpc('adjust_product_stock', {
      p_product_id: productId, p_delta: delta, p_reason: reason,
    });
    return { stock: (data as number) ?? null, error };
  },

  // Movement history for one product.
  async getStockHistory(productId: string): Promise<{ data: StockMovement[]; error: any }> {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50);
    return { data: (data as StockMovement[]) || [], error };
  },

  // Aggregate stats for a branch (total / low / out / units).
  async getInventoryStats(branchId: string): Promise<{ data: { total: number; low: number; out: number; units: number }; error: any }> {
    const { data, error } = await this.getInventory(branchId);
    const ps = data || [];
    return {
      data: {
        total: ps.length,
        low: ps.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.low_stock_threshold ?? 5)).length,
        out: ps.filter(p => (p.stock ?? 0) === 0).length,
        units: ps.reduce((s, p) => s + (p.stock ?? 0), 0),
      },
      error,
    };
  },
};
