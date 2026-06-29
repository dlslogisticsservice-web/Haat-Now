import { supabase } from '../../lib/supabase';
import { sandboxStore } from '../sandboxStore';

export interface WalletSummary {
  available: number;
  pending: number;
  paid: number;
  lifetime: number;
}

export interface PayoutRequest {
  id: string;
  driver_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  note: string | null;
  requested_at: string;
  processed_at: string | null;
  processed_by: string | null;
}

export interface EarningRow {
  id: string;
  order_id: string | null;
  delivery_fee_earned: number;
  tip_earned: number;
  bonus_earned: number;
  payout_status: 'pending' | 'available' | 'paid';
  created_at: string;
}

// Demo is client-side — read the sandbox wallet; never hit Supabase (avoids wallet 403s).
const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

/** Driver payout engine: wallet (available/pending), payout requests + approval, history. */
export const payoutService = {
  async walletSummary(driverId: string): Promise<{ data: WalletSummary; error: any }> {
    if (SANDBOX) {
      const available = sandboxStore.getWallet('driver', driverId);
      return { data: { available, pending: 0, paid: 0, lifetime: available }, error: null };
    }
    const { data, error } = await supabase.rpc('driver_wallet_summary', { p_driver_id: driverId });
    const row = Array.isArray(data) ? data[0] : data;
    return {
      data: {
        available: Number(row?.available ?? 0),
        pending: Number(row?.pending ?? 0),
        paid: Number(row?.paid ?? 0),
        lifetime: Number(row?.lifetime ?? 0),
      },
      error,
    };
  },

  /** Driver requests a payout against their available balance. */
  async request(driverId: string, amount: number): Promise<{ data: PayoutRequest | null; error: any }> {
    if (SANDBOX) return { data: null, error: null };
    const { data, error } = await supabase.rpc('request_payout', { p_driver_id: driverId, p_amount: amount });
    return { data: (data as PayoutRequest) ?? null, error };
  },

  /** Admin approves a pending payout (marks earnings paid FIFO). */
  async approve(requestId: string): Promise<{ error: any }> {
    if (SANDBOX) return { error: null };
    const { error } = await supabase.rpc('approve_payout', { p_request_id: requestId });
    return { error };
  },

  async reject(requestId: string, note?: string): Promise<{ error: any }> {
    if (SANDBOX) return { error: null };
    const { error } = await supabase.rpc('reject_payout', { p_request_id: requestId, p_note: note ?? null });
    return { error };
  },

  /** Payout requests — all (admin) or scoped to a driver. */
  async listRequests(driverId?: string): Promise<{ data: PayoutRequest[]; error: any }> {
    if (SANDBOX) {
      let drivers: any[] = []; try { drivers = JSON.parse(localStorage.getItem('haat_crud_drivers') || '[]'); } catch { /* */ }
      const data = drivers.slice(0, 6).map((d, i) => ({ id: `pr-${d.id}`, driver_id: d.id, amount: 80 + i * 45, status: (i % 3 === 0 ? 'approved' : i % 3 === 1 ? 'pending' : 'paid') as PayoutRequest['status'], note: null, requested_at: new Date(Date.now() - (i + 1) * 3600000).toISOString(), processed_at: i % 3 === 2 ? new Date().toISOString() : null, processed_by: null, drivers: { full_name: d.full_name, phone_number: d.phone_number } } as any));
      return { data: driverId ? data.filter(x => x.driver_id === driverId) : data, error: null };
    }
    let q = supabase.from('payout_requests').select('*, drivers(full_name, phone_number)').order('requested_at', { ascending: false });
    if (driverId) q = q.eq('driver_id', driverId);
    const { data, error } = await q;
    return { data: (data as any) || [], error };
  },

  async earnings(driverId: string, limit = 50): Promise<{ data: EarningRow[]; error: any }> {
    if (SANDBOX) return { data: [], error: null };
    const { data, error } = await supabase
      .from('driver_earnings')
      .select('id, order_id, delivery_fee_earned, tip_earned, bonus_earned, payout_status, created_at')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data: (data as any) || [], error };
  },
};
