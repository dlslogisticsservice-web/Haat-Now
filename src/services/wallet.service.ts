import { walletRepository } from '../repositories/wallet.repository';
import { notificationService } from './notification.service';
import { Wallet, WalletTransaction } from './types';

export const walletService = {
  // Get wallet balance for any system entity (customer, merchant, driver)
  async getWallet(ownerType: 'customer' | 'driver' | 'merchant', ownerId: string): Promise<{ data: Wallet | null; error: any }> {
    const { data, error } = await walletRepository.getWallet(ownerType, ownerId);

    // Auto-create wallet if it doesn't exist
    if (!data && !error) {
      const { data: newWallet, error: createError } = await walletRepository.createWallet(ownerType, ownerId);
      return { data: newWallet, error: createError };
    }
    
    return { data, error };
  },

  // Get chronological transaction history for a specific wallet
  async getTransactions(walletId: string): Promise<{ data: WalletTransaction[]; error: any }> {
    const { data, error } = await walletRepository.getTransactions(walletId);
    return { data: data || [], error };
  },

  // Phase 15 — single atomic call: status transition + earnings + wallet credit + ledger in one DB transaction.
  // The RPC reads delivery_fee from orders.delivery_fee; the caller supplies no amounts.
  async completeDelivery(
    orderId: string,
    driverId: string
  ): Promise<{ error: any }> {
    try {
      const { data, error } = await walletRepository.completeDelivery(orderId, driverId);
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
