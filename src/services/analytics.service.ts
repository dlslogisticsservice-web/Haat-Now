import { supabase } from '../lib/supabase';

// Analytics aggregates — real Supabase counterpart of sandboxStore analytics.
// Read-only; computed from orders/driver_earnings (RLS-scoped per role).
export interface PlatformAnalytics { totalOrders: number; delivered: number; cancelled: number; revenue: number; avgOrder: number; activeOrders: number }
export interface MerchantAnalytics { orders: number; delivered: number; revenue: number; avgOrder: number }
export interface DriverAnalytics { trips: number; totalEarned: number; avgPerTrip: number; active: number }

const ACTIVE = ['pending', 'accepted', 'preparing', 'on_the_way'];

export const analyticsService = {
  async getPlatformAnalytics(): Promise<{ data: PlatformAnalytics; error: any }> {
    const { data, error } = await supabase.from('orders').select('status, total_amount');
    const rows = (data as { status: string; total_amount: number }[]) || [];
    const delivered = rows.filter(o => o.status === 'delivered');
    const revenue = delivered.reduce((s, o) => s + Number(o.total_amount), 0);
    return {
      data: {
        totalOrders: rows.length,
        delivered: delivered.length,
        cancelled: rows.filter(o => o.status === 'cancelled').length,
        revenue,
        avgOrder: delivered.length ? Math.round(revenue / delivered.length) : 0,
        activeOrders: rows.filter(o => ACTIVE.includes(o.status)).length,
      },
      error,
    };
  },

  async getMerchantAnalytics(branchId: string): Promise<{ data: MerchantAnalytics; error: any }> {
    const { data, error } = await supabase.from('orders').select('status, total_amount').eq('branch_id', branchId);
    const rows = (data as { status: string; total_amount: number }[]) || [];
    const delivered = rows.filter(o => o.status === 'delivered');
    const revenue = delivered.reduce((s, o) => s + Number(o.total_amount), 0);
    return {
      data: { orders: rows.length, delivered: delivered.length, revenue, avgOrder: delivered.length ? Math.round(revenue / delivered.length) : 0 },
      error,
    };
  },

  async getDriverAnalytics(driverId: string): Promise<{ data: DriverAnalytics; error: any }> {
    const [earn, active] = await Promise.all([
      supabase.from('driver_earnings').select('delivery_fee_earned').eq('driver_id', driverId),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('driver_id', driverId).in('status', ACTIVE),
    ]);
    const rows = (earn.data as { delivery_fee_earned: number }[]) || [];
    const totalEarned = rows.reduce((s, e) => s + Number(e.delivery_fee_earned), 0);
    return {
      data: { trips: rows.length, totalEarned, avgPerTrip: rows.length ? Math.round(totalEarned / rows.length) : 0, active: active.count ?? 0 },
      error: earn.error || active.error,
    };
  },
};
