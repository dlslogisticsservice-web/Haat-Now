import { supabase } from '../lib/supabase';
import { Merchant, MerchantBranch } from './types';

export const restaurantService = {
  // Query all restaurants/merchants registered in the marketplace
  async getAllMerchants(): Promise<{ data: Merchant[]; error: any }> {
    const { data, error } = await supabase
      .from('merchants')
      .select('*');
    return { data: data || [], error };
  },

  // Query details about a specific restaurant/merchant
  async getMerchantById(id: string): Promise<{ data: Merchant | null; error: any }> {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error };
  },

  // Get active local branches within a specific service zone
  async getBranchesByZone(zoneId: string): Promise<{ data: MerchantBranch[]; error: any }> {
    const { data, error } = await supabase
      .from('merchant_branches')
      .select('*, merchants(*)')
      .eq('zone_id', zoneId);
    return { data: data || [], error };
  },

  // Get active local branches for a specific merchant ID
  async getBranchesByMerchant(merchantId: string): Promise<{ data: MerchantBranch[]; error: any }> {
    const { data, error } = await supabase
      .from('merchant_branches')
      .select('*, zones(*)')
      .eq('merchant_id', merchantId);
    return { data: data || [], error };
  }
};
