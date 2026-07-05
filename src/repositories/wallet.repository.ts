import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// wallet.repository (Phase-2 service→repository migration).
// Supabase data access for wallets, transactions and the atomic complete_delivery RPC.
// No business logic — the auto-create-wallet decision and the delivery notification
// side-effect stay in wallet.service.
// ─────────────────────────────────────────────────────────────────────────────

export const walletRepository = {
  getWallet(ownerType: string, ownerId: string) {
    return supabase.from('wallets').select('*').eq('owner_type', ownerType).eq('owner_id', ownerId).single();
  },

  createWallet(ownerType: string, ownerId: string) {
    return supabase.from('wallets').insert({ owner_type: ownerType, owner_id: ownerId, balance: 0.00 }).select().single();
  },

  getTransactions(walletId: string) {
    return supabase.from('wallet_transactions').select('*').eq('wallet_id', walletId).order('created_at', { ascending: false });
  },

  completeDelivery(orderId: string, driverId: string) {
    return supabase.rpc('complete_delivery', { p_order_id: orderId, p_driver_id: driverId });
  },
};
