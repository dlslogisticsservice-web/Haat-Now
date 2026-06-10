import { supabase } from '../lib/supabase';
import { Order, Product } from './types';

export const merchantService = {
  // Query all order files dispatched to a particular branch ID
  async getBranchOrders(branchId: string): Promise<{ data: Order[]; error: any }> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, customers(*), order_items(*, product_variants(*, products(*)))')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    
    return { data: data || [], error };
  },

  // Modify merchant branch service settings
  async updateBranchInfo(branchId: string, payload: { name: string }): Promise<{ error: any }> {
    const { error } = await supabase
      .from('merchant_branches')
      .update(payload)
      .eq('id', branchId);
    return { error };
  },

  // Insert or update restaurant menu product
  async upsertProduct(product: Partial<Product> & { name: string; price: number; branch_id: string }): Promise<{ data: Product | null; error: any }> {
    const { data, error } = await supabase
      .from('products')
      .upsert(product)
      .select()
      .single();
    return { data, error };
  },

  // Delete product from store catalog
  async deleteProduct(productId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);
    return { error };
  }
};
