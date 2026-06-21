import { supabase } from '../lib/supabase';
import { LoyaltyTransaction } from './types';

// Loyalty / rewards — real Supabase counterpart of sandboxStore loyalty.
// Backed by migration 0020 (loyalty_transactions + balance/award/redeem RPCs).
export const loyaltyService = {
  async getPoints(customerId: string): Promise<{ points: number; error: any }> {
    const { data, error } = await supabase.rpc('loyalty_balance', { p_customer_id: customerId });
    return { points: (data as number) ?? 0, error };
  },

  async getHistory(customerId: string): Promise<{ data: LoyaltyTransaction[]; error: any }> {
    const { data, error } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50);
    return { data: (data as LoyaltyTransaction[]) || [], error };
  },

  // Award points (e.g. on delivery). Returns new balance.
  async awardPoints(customerId: string, points: number, reason: string): Promise<{ balance: number; error: any }> {
    const { data, error } = await supabase.rpc('award_loyalty_points', {
      p_customer_id: customerId, p_points: points, p_reason: reason,
    });
    return { balance: (data as number) ?? 0, error };
  },

  // Redeem points. RPC returns -1 (mapped to error) when balance is insufficient.
  async redeemPoints(customerId: string, points: number, reason: string): Promise<{ balance: number; ok: boolean; error: any }> {
    const { data, error } = await supabase.rpc('redeem_loyalty_points', {
      p_customer_id: customerId, p_points: points, p_reason: reason,
    });
    const balance = (data as number) ?? -1;
    return { balance, ok: !error && balance >= 0, error };
  },
};
