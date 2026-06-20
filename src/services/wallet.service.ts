import { supabase } from '../lib/supabase';
import { notificationService } from './notification.service';
import { Wallet, WalletTransaction } from './types';

export const walletService = {
  // Get wallet balance for any system entity (customer, merchant, driver)
  async getWallet(ownerType: 'customer' | 'driver' | 'merchant', ownerId: string): Promise<{ data: Wallet | null; error: any }> {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .single();

    // Auto-create wallet if it doesn't exist
    if (!data && !error) {
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({
          owner_type: ownerType,
          owner_id: ownerId,
          balance: 0.00
        })
        .select()
        .single();
      return { data: newWallet, error: createError };
    }
    
    return { data, error };
  },

  // Get chronological transaction history for a specific wallet
  async getTransactions(walletId: string): Promise<{ data: WalletTransaction[]; error: any }> {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false });
    
    return { data: data || [], error };
  },

  // Phase 15 — single atomic call: status transition + earnings + wallet credit + ledger in one DB transaction.
  // The RPC reads delivery_fee from orders.delivery_fee; the caller supplies no amounts.
  async completeDelivery(
    orderId: string,
    driverId: string
  ): Promise<{ error: any }> {
    try {
      const { data, error } = await supabase.rpc('complete_delivery', {
        p_order_id:  orderId,
        p_driver_id: driverId,
      });
      if (error) {
        console.error('complete_delivery RPC error:', error);
        return { error };
      }
      if (data && !data.already_processed && data.customer_id) {
        notificationService
          .sendNotification(data.customer_id, 'تم توصيل طلبك بنجاح. شكراً لك!', 'order')
          .catch((e: any) => console.error('delivery notification failed:', e));
      }
      return { error: null };
    } catch (err: any) {
      console.error('complete_delivery failed:', err);
      return { error: err };
    }
  },

};
